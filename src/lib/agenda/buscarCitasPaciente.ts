'use client'

/**
 * src/lib/agenda/buscarCitasPaciente.ts
 *
 * La búsqueda por paciente de la agenda (bloque F, F3.6, detrás del
 * interruptor), y la búsqueda de pacientes que comparte con la burbuja de alta
 * rápida (F3.1). Cliente de SESIÓN de Supabase: la RLS decide qué se ve, y no
 * hay ruta de API nueva.
 *
 * ⚠️ LO QUE NO SE VE LO DECIDE LA RLS, NO ESTE ARCHIVO. `appointments_select`
 * deja ver una cita a su médico, al admin de la clínica y a la secretaria,
 * siempre dentro de la clínica (`get_clinica_id()`); un médico invitado no ve
 * las de otro. Aquí no se añade ningún filtro de médico «por si acaso»: con dos
 * criterios distintos, el día que diverjan uno de los dos mentiría.
 *
 * Primero pacientes (`buscarPacientes`, que desde T1 es también la consulta de
 * `usePacientes` de `AppointmentModal`: activos, palabra a palabra en nombre o
 * apellidos, 8, por apellidos), y después sus citas: desde hace 30 días hasta
 * dentro de un año, 20 como mucho (decisión 22). Con v2 se añaden las citas por
 * ligar por `reserva_nombre`.
 *
 * ⚠️ `limpiarTextoBusqueda` (de antes de T1; hoy decide el mínimo de 2
 * caracteres y limpia el texto de `buscarCitasPorLigar`): quita
 * `,`, `(`, `)`, `%`, `*`, `\` y `"` antes de ir dentro de `.or(...)`. Ahí
 * van sin escapar y son la sintaxis del filtro de PostgREST: una coma partía el
 * filtro en dos. No cambia lo que se encuentra (nadie busca un paciente por una
 * coma) y no abre nada: la RLS sigue mandando.
 *
 * Al log no va nunca el texto buscado ni un nombre: sólo el código del error.
 */
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import type { Status } from '@/lib/agenda/tiposAgenda'

export const MAX_PACIENTES = 8
export const MAX_CITAS = 20
export const DIAS_ATRAS = 30
export const DIAS_ADELANTE = 365

/** Una cita encontrada, con lo justo para listarla y saltar a ella. */
export interface CitaEncontrada {
  id: string
  title: string
  start_time: string
  end_time: string
  status: Status
  medico_id: string | null
  paciente_id: string | null
  /** Sólo en las por ligar (v2). */
  reserva_nombre?: string | null
}

/** El texto listo para ir dentro de `.or(...)`, o `null` si es demasiado corto (menos de 2). */
export function limpiarTextoBusqueda(texto: string): string | null {
  const limpio = texto.replace(/[,()%*\\"]/g, ' ').trim().replace(/\s+/g, ' ')
  return limpio.length >= 2 ? limpio : null
}

/** La ventana de búsqueda de citas, en ISO. */
export function rangoBusqueda(ahora: Date): { desde: string; hasta: string } {
  const dia = 24 * 60 * 60 * 1000
  return {
    desde: new Date(ahora.getTime() - DIAS_ATRAS * dia).toISOString(),
    hasta: new Date(ahora.getTime() + DIAS_ADELANTE * dia).toISOString(),
  }
}

/** Junta las dos listas sin repetir, por fecha, y recorta a 20. */
export function juntarCitas(a: readonly CitaEncontrada[], b: readonly CitaEncontrada[]): CitaEncontrada[] {
  const vistas = new Map<string, CitaEncontrada>()
  for (const c of [...a, ...b]) if (!vistas.has(c.id)) vistas.set(c.id, c)
  return [...vistas.values()].sort((x, y) => x.start_time.localeCompare(y.start_time)).slice(0, MAX_CITAS)
}

const COLUMNAS_CITA = 'id, title, start_time, end_time, status, medico_id, paciente_id'

/* Cada letra base con sus variantes acentuadas, en las dos cajas (las acentuadas
   no se confían a `~*`: plegar «É» a «é» depende del locale de la base). */
const VARIANTES: Readonly<Record<string, string>> = {
  a: 'aáàâäAÁÀÂÄ', e: 'eéèêëEÉÈÊË', i: 'iíìîïIÍÌÎÏ', o: 'oóòôöOÓÒÔÖ', u: 'uúùûüUÚÙÛÜ', n: 'nñNÑ', c: 'cçCÇ',
}
/** Tope de palabras: cada una es un filtro más en la URL. */
export const MAX_PALABRAS = 5

/**
 * T1 · Las palabras del texto, sin acentos y en minúsculas, sólo `[a-z0-9]`:
 * «Hugo  Interián» → ['hugo', 'interian']. Lo que no es letra ni dígito
 * (guion, apóstrofo, punto) separa palabras.
 */
export function palabrasDeBusqueda(texto: string): string[] {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean).slice(0, MAX_PALABRAS)
}

/**
 * La expresión regular de una palabra que ya pasó por `palabrasDeBusqueda`:
 * cada vocal, la n y la c con sus variantes (`interian` → `[iíì…]nt[eé…]r…`).
 * Sólo letras, dígitos y corchetes: nada que PostgREST ni la regex lean como
 * sintaxis, y ningún cuantificador del usuario.
 */
export function patronSinAcentos(palabra: string): string {
  return [...palabra].map(ch => (VARIANTES[ch] ? `[${VARIANTES[ch]}]` : ch)).join('')
}

/**
 * Pacientes activos cuyo nombre o apellidos contienen TODAS las palabras del
 * texto, en cualquier orden y sin mirar acentos ni mayúsculas (T1, punto 1 de
 * Angel). Vacío si el texto es corto o la consulta falla.
 *
 * ⚠️ UN `.or()` POR PALABRA, Y POSTGREST LOS JUNTA CON AND. Antes era un solo
 * `.or()` con el texto entero contra cada columna: «Hugo Interián» no está en
 * `nombre` («Hugo») ni en `apellidos` («Interián Canché»), así que no salía
 * nada; y `ilike` no iguala «interian» con «Interián». Ahora cada palabra va en
 * nombre O apellidos (`imatch`, `~*` en Postgres) y todas tienen que estar.
 * Sin función ni índice nuevo en la base: funciona igual con o sin las
 * migraciones de la agenda v2. La RLS sigue decidiendo qué pacientes se ven.
 */
export async function buscarPacientes(texto: string): Promise<PacienteBusqueda[]> {
  const palabras = limpiarTextoBusqueda(texto) ? palabrasDeBusqueda(texto) : []
  if (palabras.length === 0) return []
  let consulta = createClient()
    .from('pacientes')
    .select('id, nombre, apellidos, telefono')
    .neq('activo', false)
  for (const p of palabras) {
    const patron = patronSinAcentos(p)
    consulta = consulta.or(`nombre.imatch."${patron}",apellidos.imatch."${patron}"`)
  }
  const { data, error } = await consulta.order('apellidos').limit(MAX_PACIENTES)
  if (error) { logger.warn('buscarPacientes', error.code ?? 'sin código'); return [] }
  return data ?? []
}

/** Las citas de un paciente en la ventana de búsqueda. */
export async function buscarCitasDePaciente(pacienteId: string, ahora: Date = new Date()): Promise<CitaEncontrada[]> {
  const { desde, hasta } = rangoBusqueda(ahora)
  const { data, error } = await createClient()
    .from('appointments')
    .select(COLUMNAS_CITA)
    .eq('paciente_id', pacienteId)
    .gte('start_time', desde)
    .lt('start_time', hasta)
    .order('start_time')
    .limit(MAX_CITAS)
  if (error) { logger.warn('buscarCitasDePaciente', error.code ?? 'sin código'); return [] }
  return data ?? []
}

/**
 * Las citas por ligar cuyo nombre de reserva casa con el texto. SÓLO CON v2:
 * sin las columnas de D1 la consulta fallaría, así que el llamador la pide sólo
 * con el interruptor encendido.
 */
export async function buscarCitasPorLigar(texto: string, ahora: Date = new Date()): Promise<CitaEncontrada[]> {
  const q = limpiarTextoBusqueda(texto)
  if (!q) return []
  const { desde, hasta } = rangoBusqueda(ahora)
  const { data, error } = await createClient()
    .from('appointments')
    .select(`${COLUMNAS_CITA}, reserva_nombre`)
    .is('paciente_id', null)
    .not('reserva_canal', 'is', null)
    .ilike('reserva_nombre', `%${q}%`)
    .gte('start_time', desde)
    .lt('start_time', hasta)
    .order('start_time')
    .limit(MAX_CITAS)
  if (error) { logger.warn('buscarCitasPorLigar', error.code ?? 'sin código'); return [] }
  return data ?? []
}
