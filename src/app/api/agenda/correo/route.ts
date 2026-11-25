/**
 * POST /api/agenda/correo — el correo de CONFIRMACIÓN de Spinus de una cita
 * (G3, punto 14 de la tanda de diseño), con o sin Google conectado.
 * Cuerpo: `{ cita_id }`.
 *
 * Puertas, en este orden (las del WhatsApp manual de E7):
 *   1. `entradaGestion()`: sesión (401), perfil con clínica (403) y el
 *      interruptor de la agenda v2 de ESA clínica (404 apagado o sin tabla).
 *   2. Cuerpo estricto (400).
 *   3. La cita con el cliente de SESIÓN y `clinica_id` explícito: qué cita se
 *      ve lo decide la RLS de `appointments` (el médico invitado, sólo las
 *      suyas); 404 si no la ve. Cualquier rol que la vea puede mandar el aviso,
 *      como el WhatsApp (decisión de E7: no hay permiso propio).
 *   4. `motivoSinCorreo` (la MISMA regla que pinta el botón): con paciente o
 *      por ligar, agendada o confirmada, con hora, futura → 409 `no_aplica`
 *      con su `motivo`; sin correo → 422 `sin_correo`. Una cita cancelada,
 *      atendida o con inasistencia NO recibe el aviso aunque se llame a mano.
 *   5. La base decide el resto al tomar el envío (interruptor, acceso, el
 *      destinatario y UNA confirmación por hora de inicio): si no lo da, 409
 *      `ya_enviado` (con la hora) o `no_disponible`.
 *
 * Respuestas: 200 `{ enviado: ISO }`; 409 `ya_enviado` / `no_disponible` /
 * `no_aplica`; 422 `sin_correo`; 503 `sin_enlace` o `no_disponible` (sin la
 * migración); 502 `no_enviado` (el transporte falló; se puede reintentar).
 *
 * Tanda L (punto 15): el correo saluda por el nombre (`pacientes.nombre`, sin
 * apellidos, o el `reserva_nombre` tecleado al reservar), leído aquí con la
 * SESIÓN junto con el correo. Sólo el nombre: nada clínico.
 *
 * ⚠️ El cliente de servicio sólo entra por `enviarConfirmacionCita` (`.rpc()`
 * con la `clinica_id` de la SESIÓN, nunca de la petición). Auditoría: la fila
 * de `cita_correos` (disparador `log_tabla_change`) y `logAudit`
 * `enviar_confirmacion_cita` a nombre de quien pulsó, sin dirección de correo.
 * Al log, nada del correo, la URL ni el contenido.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { entradaGestion, type ClienteSesion } from '@/lib/reserva/gestionServidor'
import { correoParaConfirmacion, motivoSinCorreo } from '@/lib/agenda/whatsappCita'
import { enviarConfirmacionCita } from '@/lib/confirmacion/confirmacionCita'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const
const CuerpoSchema = z.strictObject({ cita_id: z.guid() })

const CitaSchema = z.object({
  id: z.string(),
  status: z.string(),
  start_time: z.string(),
  all_day: z.boolean().nullable(),
  paciente_id: z.string().nullable(),
  reserva_canal: z.string().nullable(),
  reserva_correo: z.string().nullable(),
  /* Tanda L (punto 15): el nombre del saludo. Opcionales: una fila sin ellos manda el correo sin saludo. */
  reserva_nombre: z.string().nullable().optional(),
  pacientes: z.object({ email: z.string().nullable(), nombre: z.string().nullable().optional() }).nullable(),
})
type CitaCorreo = z.infer<typeof CitaSchema>

function json(cuerpo: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE })
}

/** La cita con la RLS de quien llama. null si no existe o no la deja ver; lanza si la lectura falla. */
async function leerCita(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<CitaCorreo | null> {
  const { data, error } = await supabase.from('appointments')
    .select('id, status, start_time, all_day, paciente_id, reserva_canal, reserva_correo, reserva_nombre, pacientes(email, nombre)')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) throw new Error(`cita para el correo sin leer: ${error.code ?? ''}`)
  if (!data) return null
  const p = CitaSchema.safeParse(data)
  if (!p.success) throw new Error('cita para el correo: forma inesperada')
  return p.data
}

/** ¿Ya salió (o está saliendo) la confirmación de esta hora? Con la sesión (RLS de E4). */
async function yaEnviado(supabase: ClienteSesion, clinicaId: string, cita: CitaCorreo): Promise<string | null> {
  const { data } = await supabase.from('cita_correos').select('estado, enviado_en')
    .eq('clinica_id', clinicaId).eq('appointment_id', cita.id).eq('tipo', 'confirmacion')
    .eq('inicio_cita', cita.start_time).in('estado', ['enviado', 'enviando']).maybeSingle()
  if (!data) return null
  return typeof data.enviado_en === 'string' ? data.enviado_en : ''
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  let cuerpo: unknown
  try { cuerpo = await req.json() } catch { return json({ error: 'cuerpo_invalido' }, 400) }
  const p = CuerpoSchema.safeParse(cuerpo)
  if (!p.success) return json({ error: 'cuerpo_invalido' }, 400)
  try {
    const cita = await leerCita(e.supabase, e.clinicaId, p.data.cita_id)
    if (!cita) return json({ error: 'Cita no encontrada' }, 404)
    const motivo = motivoSinCorreo(cita, correoParaConfirmacion(cita.pacientes?.email, cita.reserva_correo), Date.now())
    if (motivo === 'sin_correo') return json({ error: 'sin_correo' }, 422)
    if (motivo) return json({ error: 'no_aplica', motivo }, 409)
    // Tanda L (punto 15): el saludo, con el MISMO orden que el destinatario (el paciente ligado y, si no, la reserva).
    const nombre = cita.pacientes?.nombre?.trim() || cita.reserva_nombre?.trim() || null
    const r = await enviarConfirmacionCita(e.clinicaId, cita.id, e.perfil.id, { nombre })
    if (r.tipo === 'enviado') {
      await logAudit({ userId: e.perfil.id, accion: 'enviar_confirmacion_cita', tabla: 'appointments', registroId: cita.id,
        descripcion: 'Confirmación de la cita por correo (Spinus)' })
      return json({ enviado: new Date().toISOString() })
    }
    if (r.tipo === 'no_toca') {
      const en = await yaEnviado(e.supabase, e.clinicaId, cita)
      return en === null ? json({ error: 'no_disponible' }, 409) : json({ error: 'ya_enviado', enviado: en || null }, 409)
    }
    if (r.tipo === 'fallido') return json({ error: 'no_enviado' }, 502)
    return json({ error: r.tipo }, 503)
  } catch (err: unknown) {
    logger.error('agenda', `POST correo: ${err instanceof Error ? err.name : 'error'}`)
    return json({ error: 'Error interno' }, 500)
  }
}
