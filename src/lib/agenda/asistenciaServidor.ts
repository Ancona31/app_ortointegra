/**
 * src/lib/agenda/asistenciaServidor.ts — Tanda I (punto 11 de Angel) · las
 * citas por las que hay que PREGUNTAR si el paciente asistió. SÓLO SERVIDOR; lo
 * llama `agenda/page.tsx` con el interruptor encendido, y viaja con la página
 * (como los tipos del ajuste al turno): el navegador no pide nada al abrir.
 *
 * Cuáles: agendada o confirmada, con hora (no de todo el día), con paciente o
 * por ligar (un evento sin paciente no tiene asistencia), cuyo INICIO pasó hace
 * más de 48 horas (`HORAS_SIN_PREGUNTAR`) y sin nota clínica ligada
 * (`consultas.appointment_id`). Nada cambia de estado aquí: sólo se lee.
 *
 * Quién: el médico, las suyas; el administrador y la secretaria, las de la
 * clínica (`canVerAgendaCompleta`). Las citas se leen con el cliente de SESIÓN
 * (la RLS de `appointments_select` dice lo mismo) y la clínica explícita.
 *
 * ⚠️ LA NOTA SE COMPRUEBA CON CLIENTE DE SERVICIO, como `notaLigadaServidor.ts`
 * y por lo mismo: la RLS de `consultas` no le enseña a la secretaria (ni al
 * médico, las de otro) las notas, y una cita con nota saldría como «sin nota».
 * Filtrada por la clínica de la sesión (por el paciente: `consultas` no tiene
 * `clinica_id`) y por las citas que la sesión ya leyó; sólo sale el id de la
 * cita, nada de la nota.
 *
 * TOLERANCIA: cualquier error da `null` (no se pregunta nada, como hoy).
 */
import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canVerAgendaCompleta } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import type { Status } from '@/lib/agenda/tiposAgenda'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

/** Antes de esto no se pregunta nada (Angel: «antes de las 48 horas no se pregunta»). */
export const HORAS_SIN_PREGUNTAR = 48
/** Las más recientes primero; las que no caben salen la vez siguiente. */
export const MAX_PREGUNTAS = 50

/** Lo que la ventana enseña de cada cita: quién y cuándo, nada clínico. */
export interface CitaPorAsistir {
  id: string
  start_time: string
  status: Status
  nombre: string
}

/** Lo que hace falta del perfil de la sesión, ya validado (`analizarPerfilSesion`). */
export interface PerfilAsistencia {
  id: string
  role: 'super_admin' | 'medico' | 'secretaria'
  clinica_id: string
  es_admin_de_clinica: boolean
}

/** El médico cuyas citas se preguntan: `''` = todas las de la clínica; `null` = nadie (rol sin agenda). */
export function alcanceDeAsistencia(p: PerfilAsistencia): string | null {
  if (canVerAgendaCompleta(p)) return ''
  return p.role === 'medico' ? p.id : null
}

/** El instante antes del cual una cita ya se pregunta. */
export function corteDeAsistencia(ahora: number): string {
  return new Date(ahora - HORAS_SIN_PREGUNTAR * 3_600_000).toISOString()
}

interface FilaAsistencia {
  id: string; start_time: string; status: Status; title: string | null; reserva_nombre: string | null
  /* Sin tipos generados, PostgREST se infiere como lista; llega un objeto (FK a uno). */
  pacientes: { nombre: string; apellidos: string } | { nombre: string; apellidos: string }[] | null
}

function nombreDe(f: FilaAsistencia): string {
  const p = Array.isArray(f.pacientes) ? f.pacientes[0] : f.pacientes
  if (p) return `${p.nombre} ${p.apellidos}`.trim()
  return f.reserva_nombre ?? f.title ?? ''
}

/** Los ids, de entre `ids`, que tienen nota clínica ligada. Lanza si la lectura falla. */
async function conNota(clinicaId: string, ids: string[]): Promise<Set<string>> {
  const { data, error } = await createAdminClient().from('consultas')
    .select('appointment_id, pacientes!inner(clinica_id)')
    .in('appointment_id', ids).eq('pacientes.clinica_id', clinicaId)
  if (error) throw new Error(`notas ligadas sin leer: ${error.code ?? ''}`)
  const filas: { appointment_id: string | null }[] = data ?? []
  return new Set(filas.map(n => n.appointment_id).filter((id): id is string => typeof id === 'string'))
}

/** Las citas por las que preguntar, o `null` si no se puede saber. */
export async function leerAsistenciaPendiente(
  supabase: ClienteSesion, perfil: PerfilAsistencia, ahora: number = Date.now(),
): Promise<CitaPorAsistir[] | null> {
  const medico = alcanceDeAsistencia(perfil)
  if (medico === null) return null
  let q = supabase.from('appointments')
    .select('id, start_time, status, title, reserva_nombre, pacientes(nombre, apellidos)')
    .eq('clinica_id', perfil.clinica_id)
    .in('status', ['scheduled', 'confirmed'])
    .eq('all_day', false)
    .or('paciente_id.not.is.null,reserva_canal.not.is.null')
    .lt('start_time', corteDeAsistencia(ahora))
    .order('start_time', { ascending: false })
    .limit(MAX_PREGUNTAS)
  if (medico) q = q.eq('medico_id', medico)
  const { data, error } = await q
  if (error) { logger.warn('agenda', `asistencia sin leer: ${error.code ?? ''}`); return null }
  const filas: FilaAsistencia[] = data ?? []
  if (filas.length === 0) return []
  const notas = await conNota(perfil.clinica_id, filas.map(f => f.id))
  return filas.filter(f => !notas.has(f.id))
    .map(f => ({ id: f.id, start_time: f.start_time, status: f.status, nombre: nombreDe(f) }))
}
