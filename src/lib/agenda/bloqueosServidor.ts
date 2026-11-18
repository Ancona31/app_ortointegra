/**
 * src/lib/agenda/bloqueosServidor.ts
 *
 * K1 · Las piezas de servidor de `/api/agenda/bloqueos` (POST) y
 * `/api/agenda/bloqueos/[id]` (PATCH, DELETE): el esquema del cuerpo, el
 * permiso, las puntas en la zona del bloqueo y el aviso «hay N citas».
 *
 * ⚠️ CLIENTE DE SESIÓN para todo lo que lee o escribe la fila: la RLS de
 * `agenda_bloqueos` es la de quien hoy puede agendar para ese médico (el
 * propio médico, el administrador de la clínica o la secretaria), y su
 * `WITH CHECK` lleva las puertas de suscripción y la v2. El permiso de aquí
 * es la MISMA regla dicha antes, para responder 403 y no un error de la base.
 */
import { z } from 'zod'
import type { createClient } from '@/lib/supabase/server'
import { canManageClinica, isSecretaria } from '@/lib/permissions'
import type { Profile } from '@/hooks/useProfile'
import { desplazarFecha, fechaHoraLocalAInstante } from '@/lib/dates'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

export type PerfilBloqueo = { userId: string; clinica_id: string | null } & Pick<Profile, 'role' | 'es_admin_de_clinica'>

/** Las columnas que devuelven las rutas y que necesita el empuje a Google. */
export const COLUMNAS_BLOQUEO_RUTA = 'id, clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo, google_event_id, gcal_calendar_id'

const zonaValida = z.string().min(1).max(64).refine((z0) => {
  try { new Intl.DateTimeFormat('es-MX', { timeZone: z0 }); return true } catch { return false }
}, 'Zona inválida')
const motivo = z.string().trim().max(120).nullable().optional()
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((f) => {
  const d = new Date(`${f}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f
}, 'Fecha inválida')
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** Las puntas como las teclea el modal: días (último incluido) o fecha y horas de pared. */
const PorDias = z.strictObject({ todo_el_dia: z.literal(true), desde: fecha, hasta: fecha, zona: zonaValida, motivo })
const PorHoras = z.strictObject({ todo_el_dia: z.literal(false), fecha, hora_inicio: hora, fecha_fin: fecha, hora_fin: hora, zona: zonaValida, motivo })
export const PuntasBloqueoSchema = z.discriminatedUnion('todo_el_dia', [PorDias, PorHoras])
export type PuntasBloqueo = z.infer<typeof PuntasBloqueoSchema>

/** Alta: además, el médico (y nada más: `clinica_id` sale del perfil). */
export const CrearBloqueoSchema = z.discriminatedUnion('todo_el_dia', [
  PorDias.extend({ medico_id: z.guid() }), PorHoras.extend({ medico_id: z.guid() }),
])

/** Las columnas a escribir, con las medianoches en la zona del bloqueo (fin exclusivo). */
export function columnasDePuntas(p: PuntasBloqueo): { inicio: string; fin: string; todo_el_dia: boolean; zona: string; motivo: string | null } {
  const m = p.motivo?.trim() ? p.motivo.trim() : null
  if (p.todo_el_dia) {
    return { inicio: fechaHoraLocalAInstante(p.desde, '00:00', p.zona), fin: fechaHoraLocalAInstante(desplazarFecha(p.hasta, { dias: 1 }), '00:00', p.zona), todo_el_dia: true, zona: p.zona, motivo: m }
  }
  return { inicio: fechaHoraLocalAInstante(p.fecha, p.hora_inicio, p.zona), fin: fechaHoraLocalAInstante(p.fecha_fin, p.hora_fin, p.zona), todo_el_dia: false, zona: p.zona, motivo: m }
}

/** Quien hoy puede agendar para ese médico: él mismo, el administrador o la secretaria. */
export function puedeBloquear(perfil: PerfilBloqueo, medicoId: string): boolean {
  return (perfil.role === 'medico' && perfil.userId === medicoId) || canManageClinica(perfil) || isSecretaria(perfil)
}

const FilaPerfil = z.object({
  clinica_id: z.string().nullable(),
  role: z.enum(['super_admin', 'medico', 'secretaria']),
  es_admin_de_clinica: z.boolean().nullable().transform(v => v === true),
})

/** El perfil de la sesión (`getUser()`: es una escritura). */
export async function perfilBloqueo(supabase: ClienteSesion): Promise<PerfilBloqueo | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('clinica_id, role, es_admin_de_clinica').eq('id', user.id).single()
  const fila = FilaPerfil.safeParse(data)
  return fila.success ? { userId: user.id, ...fila.data } : null
}

/** Punto 5 · Cuántas CITAS (no eventos sin paciente) vivas caen en el periodo. No las toca. */
export async function citasEnPeriodo(
  supabase: ClienteSesion, clinicaId: string, medicoId: string, inicio: string, fin: string,
): Promise<number> {
  const { count, error } = await supabase.from('appointments').select('id', { count: 'exact', head: true })
    .eq('clinica_id', clinicaId).eq('medico_id', medicoId)
    .lt('start_time', fin).gt('end_time', inicio)
    .not('status', 'in', '(cancelled,no_show)')
    .or('paciente_id.not.is.null,reserva_canal.not.is.null')
  return error ? 0 : (count ?? 0)
}

/** Los errores de la base que son del usuario, con su respuesta; el resto, 500. */
export function respuestaErrorBloqueo(error: { code?: string }): { status: number; error: string } {
  if (error.code === '42501') return { status: 403, error: 'Sin permisos' }
  if (error.code === '23514' || error.code === '22P02' || error.code === '22007') return { status: 400, error: 'El periodo no es válido' }
  if (error.code === '23503') return { status: 400, error: 'El médico no es de esta clínica' }
  return { status: 500, error: 'No se pudo guardar el bloqueo' }
}
