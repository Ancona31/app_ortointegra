/**
 * POST /api/appointments/[id]/no-es-cita — «¿No es una cita?» (tanda I, punto
 * 10 de Angel): un evento NUEVO de Google que entró «por asignar» pasa a
 * evento sin paciente, en el momento y para siempre. Sin cuerpo.
 *
 * Puertas, en este orden:
 *   1. `entradaGestion()`: sesión con `getUser()` (401), perfil con clínica
 *      (403) e interruptor de la v2 de ESA clínica (404 apagado o sin tabla).
 *   2. El id con forma de uuid (400).
 *   3. La cita con el cliente de SESIÓN y `clinica_id` explícito: qué cita se
 *      ve lo decide la RLS de `appointments`; 404 si no la ve. Sin la columna
 *      (migración 20261121130000): 503 `no_disponible`.
 *   4. El rol, en el servidor: administrador o secretaria, o el médico de la
 *      cita (`puedeGestionarDelMedico`, la regla de los enlaces y bloqueos).
 *   5. Sólo una fila «por asignar» sin paciente ni reserva: ya «evento», 200
 *      (dos clics desde dos sitios no son un error); cualquier otra, 409.
 *
 * Escribe SÓLO `google_asignacion = 'evento'`, con la sesión y condicionado a
 * que siga «por asignar» y sin paciente (la base, además, sólo deja ese paso:
 * `cita_asignacion_google`). NO toca `updated_at`: no es contenido que viaje a
 * Google, y moverlo haría que el sondeo diera por más nuevo a Spinus frente a
 * un cambio de Google aún sin leer («gana el último», C5).
 *
 * Auditoría: `cita_no_es_cita` por `logAudit` (clínica y NOMBRE del campo) y
 * la `cita_editada` del disparador de citas. Nada de Google cambia: S1 sigue
 * igual (un evento nacido en Google sin paciente conserva su descripción).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { entradaGestion, type ClienteSesion } from '@/lib/reserva/gestionServidor'
import { puedeGestionarDelMedico } from '@/lib/reserva/gestionReserva'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const

const CitaSchema = z.object({
  medico_id: z.string().nullable(),
  paciente_id: z.string().nullable(),
  reserva_canal: z.string().nullable(),
  google_asignacion: z.string().nullable(),
})
type CitaAsignacion = z.infer<typeof CitaSchema>

function json(cuerpo: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE })
}

/** La columna aún no existe en esta base (42703 de Postgres o PGRST204/PGRST100 de PostgREST). */
function sinColumna(code: string | undefined): boolean {
  return code === '42703' || code === 'PGRST204' || code === 'PGRST100'
}

type Lectura = { tipo: 'cita'; cita: CitaAsignacion } | { tipo: 'no_encontrada' } | { tipo: 'sin_columna' }

/** La cita con la RLS de quien llama. Lanza si la lectura falla por otra cosa. */
async function leerCita(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<Lectura> {
  const { data, error } = await supabase.from('appointments')
    .select('medico_id, paciente_id, reserva_canal, google_asignacion')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) {
    if (sinColumna(error.code)) return { tipo: 'sin_columna' }
    throw new Error(`cita sin leer: ${error.code ?? ''}`)
  }
  if (!data) return { tipo: 'no_encontrada' }
  const p = CitaSchema.safeParse(data)
  if (!p.success) throw new Error('cita: forma inesperada')
  return { tipo: 'cita', cita: p.data }
}

/** El paso, condicionado a que siga por asignar y sin paciente. true = prendió. */
async function marcarEvento(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<boolean> {
  const { data, error } = await supabase.from('appointments')
    .update({ google_asignacion: 'evento' })
    .eq('id', citaId).eq('clinica_id', clinicaId).eq('google_asignacion', 'por_asignar').is('paciente_id', null)
    .select('id')
  if (error) {
    if (error.code === '42501') return false
    throw new Error(`no es cita sin escribir: ${error.code ?? ''}`)
  }
  return (data ?? []).length === 1
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  const { id } = await ctx.params
  if (!z.guid().safeParse(id).success) return json({ error: 'id_invalido' }, 400)
  try {
    const l = await leerCita(e.supabase, e.clinicaId, id)
    if (l.tipo === 'sin_columna') return json({ error: 'no_disponible' }, 503)
    if (l.tipo === 'no_encontrada') return json({ error: 'Cita no encontrada' }, 404)
    const { cita } = l
    if (!puedeGestionarDelMedico(e.perfil, cita.medico_id)) return json({ error: 'Sin permisos' }, 403)
    const sinPaciente = !cita.paciente_id && !cita.reserva_canal
    if (sinPaciente && cita.google_asignacion === 'evento') return json({ evento: true })
    if (!sinPaciente || cita.google_asignacion !== 'por_asignar') return json({ error: 'no_aplica' }, 409)
    if (!(await marcarEvento(e.supabase, e.clinicaId, id))) return json({ error: 'no_aplica' }, 409)
    await logAudit({
      userId: e.perfil.id, accion: 'cita_no_es_cita', tabla: 'appointments', registroId: id,
      descripcion: JSON.stringify({ clinica: e.clinicaId, campos: ['google_asignacion'] }),
    })
    return json({ evento: true })
  } catch (err: unknown) {
    logger.error('agenda', `POST no-es-cita: ${err instanceof Error ? err.message : 'error'}`)
    return json({ error: 'Error interno' }, 500)
  }
}
