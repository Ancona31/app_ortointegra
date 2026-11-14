/**
 * POST /api/agenda/whatsapp — el WhatsApp MANUAL de una cita (agenda E7).
 * Cuerpo: `{ cita_id, paso: 'preparar' | 'abierto', tipo: 'enlace' | 'recordatorio' }`.
 *
 *   · `preparar`: emite (o reutiliza) el enlace de confirmación de E2 y
 *     devuelve `{ url }`, el `https://wa.me/521…?text=…` listo para abrir.
 *     NO MARCA NADA.
 *   · `abierto`: el personal pulsó el enlace. Marca `whatsapp_sent_at` (el
 *     botón de la cita, `tipo:'enlace'`) o `whatsapp_reminder_sent_at` (la
 *     lista de mañana, `tipo:'recordatorio'`) con la hora del servidor. Marca
 *     que SE ABRIÓ, no que se envió: eso no se puede saber (§5 E).
 *
 * Puertas: `entradaGestion()` (401 / 403 sin clínica / 404 con el interruptor
 * apagado) → cuerpo estricto (400) → la cita con la SESIÓN (RLS: el invitado,
 * sólo las suyas; 404 si no la ve) → con paciente o por ligar, agendada o
 * confirmada, futura (409 `no_aplica` con su `motivo`, T1) → teléfono, con
 * formato de México (422 `sin_telefono` / `telefono_invalido`).
 *
 * ⚠️ La marca va con el cliente de SESIÓN (la RLS de `appointments_update`
 * decide) y NO toca `updated_at`: no provoca un 409 en el modal abierto ni gana
 * un conflicto con Google por algo que Google no ve. `log_cita_change` la
 * audita como `cita_editada` a nombre de quien pulsó (plan_E §0.2).
 * ⚠️ El cliente de servicio sólo entra por `emitirEnlaceConfirmacion`
 * (`.rpc()` con el `clinica_id` del PERFIL, nunca de la petición).
 * ⚠️ Al log, nada del teléfono, el texto ni la URL.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { entradaGestion } from '@/lib/reserva/gestionServidor'
import { leerCitaWhatsApp, telefonoDeCita, type CitaWhatsApp } from '@/lib/agenda/whatsappServidor'
import { enlaceWaMe, motivoSinWhatsApp, textoWhatsApp } from '@/lib/agenda/whatsappCita'
import { emitirEnlaceConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import { fechaYHora } from '@/lib/confirmacion/correosCita'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const
const CuerpoSchema = z.strictObject({
  cita_id: z.guid(),
  paso: z.enum(['preparar', 'abierto']),
  tipo: z.enum(['enlace', 'recordatorio']),
})

function json(cuerpo: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE })
}

async function preparar(clinicaId: string, perfilId: string, cita: CitaWhatsApp): Promise<NextResponse> {
  const telefono = telefonoDeCita(cita)
  const enlace = await emitirEnlaceConfirmacion(clinicaId, cita.id, perfilId)
  if (!enlace) return json({ error: 'sin_enlace' }, 503)
  const { fecha, hora } = fechaYHora(cita.start_time, cita.consultorio_timezone || 'America/Mexico_City')
  const texto = textoWhatsApp({
    fecha, hora, medico: cita.medico ? componerNombreMedicoCompleto(cita.medico) : '',
    consultorio: cita.consultorio_nombre ?? '', url: enlace.url, confirmada: cita.status === 'confirmed',
  })
  const url = enlaceWaMe(telefono, texto)
  return url ? json({ url }) : json({ error: 'telefono_invalido' }, 422)
}

async function marcarAbierto(e: Extract<Awaited<ReturnType<typeof entradaGestion>>, { ok: true }>, citaId: string, tipo: 'enlace' | 'recordatorio'): Promise<NextResponse> {
  const columna = tipo === 'enlace' ? 'whatsapp_sent_at' : 'whatsapp_reminder_sent_at'
  const ahora = new Date().toISOString()
  const { data, error } = await e.supabase.from('appointments').update({ [columna]: ahora })
    .eq('id', citaId).eq('clinica_id', e.clinicaId).select('id').maybeSingle()
  if (error) {
    logger.error('agenda', `marca de WhatsApp sin escribir: ${error.code ?? ''}`)
    return json({ error: 'Error interno' }, 500)
  }
  return data ? json({ marcado: ahora }) : json({ error: 'Cita no encontrada' }, 404)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  let cuerpo: unknown
  try { cuerpo = await req.json() } catch { return json({ error: 'cuerpo_invalido' }, 400) }
  const p = CuerpoSchema.safeParse(cuerpo)
  if (!p.success) return json({ error: 'cuerpo_invalido' }, 400)
  try {
    const cita = await leerCitaWhatsApp(e.supabase, e.clinicaId, p.data.cita_id)
    if (!cita) return json({ error: 'Cita no encontrada' }, 404)
    /* T1: la regla compartida con el botón (`motivoSinWhatsApp`), y el MOTIVO
       en el 409 para que el botón lo diga en llano («La cita ya pasó»). El
       teléfono sin formato se rechaza aquí, antes de emitir ningún enlace. */
    const motivo = motivoSinWhatsApp(cita, telefonoDeCita(cita), Date.now())
    if (motivo === 'sin_telefono' || motivo === 'telefono_invalido') return json({ error: motivo }, 422)
    if (motivo) return json({ error: 'no_aplica', motivo }, 409)
    return p.data.paso === 'preparar'
      ? await preparar(e.clinicaId, e.perfil.id, cita)
      : await marcarAbierto(e, cita.id, p.data.tipo)
  } catch (err: unknown) {
    logger.error('agenda', `POST whatsapp: ${err instanceof Error ? err.name : 'error'}`)
    return json({ error: 'Error interno' }, 500)
  }
}
