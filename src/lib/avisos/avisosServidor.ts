/**
 * src/lib/avisos/avisosServidor.ts — leer y marcar revisados los «Avisos» de
 * la clínica (tanda I, punto 19). Nació sólo de servidor; desde los avisos
 * globales (2026-11-24) `leerAvisosClinica` la usa TAMBIÉN el navegador
 * (`CampanaAvisos`), con su cliente de sesión: por eso no importa nada de
 * servidor (ni `server-only`, ni cookies, ni `createAdminClient`). Que siga así.
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: la RLS de
 * `avisos_clinica` sólo deja ver los de la clínica de la sesión y de citas que
 * quien mira ve (el médico invitado, sólo los de sus citas); las consultas
 * llevan además `clinica_id` explícito.
 *
 * Tolerante: sin la tabla la respuesta es `{ disponible: false, avisos: [] }`
 * y quien la pinta vuelve a lo de antes (las canceladas y los empalmes
 * calculados al vuelo).
 *
 * ⚠️ DOS FORMAS DE LA BASE, y las dos valen (avisos globales, M1 `20261202120000`):
 *   · CON M1: «pendiente» es POR USUARIO. Se lee con `avisos_pendientes`
 *     (lo que veo y no he visto desde su último cambio) y se marca escribiendo
 *     MI fila en `avisos_vistos`. Que uno lo revise no se lo quita a nadie.
 *   · SIN M1 (PGRST202 / 42P01 / PGRST205): lo de antes, por clínica: los
 *     `revisado_en IS NULL`, y revisar escribe `revisado_en` para todos.
 * No quites la rama de antes mientras M1 no esté aplicada en producción.
 */
import { z } from 'zod'
import type { ClienteSesion } from '@/lib/reserva/gestionServidor'
import {
  TIPOS_AVISO, TIPOS_CON_CITA, TIPOS_SIN_CITA, type AvisoClinica, type CitaDelAviso, type DatosAviso, type RespuestaAvisos,
  type TipoAviso,
} from '@/lib/avisos/avisosClinica'
import { logger } from '@/lib/logger'

/** Lo que cabe en la campana. Lo que no se revise se sigue viendo al revisar lo de arriba. */
export const TOPE_AVISOS = 50

/** Tabla, columna o función ausente (base sin la migración). */
const AUSENTE = new Set(['42P01', 'PGRST205', '42703', 'PGRST204', 'PGRST202'])

/* ⚠️ `tipo` SE LEE COMO TEXTO Y SE FILTRA DESPUÉS (`conTipoConocido`), NO CON `z.enum` EN EL
   ESQUEMA DE LA FILA. La migración que añade un tipo puede llegar a la base antes que el código
   que lo pinta: con `z.enum` aquí, UN aviso de un tipo desconocido tiraba el `parse` del arreglo
   entero y la campana se quedaba vacía. Las columnas de M1 son opcionales: sin M1 no vienen. */
const FilaAvisoCruda = z.object({
  id: z.string(), tipo: z.string(), cita_id: z.string().nullable(), creado_en: z.string(),
  destinatario_id: z.string().nullable().optional(), actor_id: z.string().nullable().optional(),
  medico_id: z.string().nullable().optional(), datos: z.record(z.string(), z.unknown()).nullable().optional(),
})
const Tipo = z.enum(TIPOS_AVISO)
type FilaAviso = Omit<z.infer<typeof FilaAvisoCruda>, 'tipo'> & { tipo: TipoAviso }

/** Las filas cuyo tipo conoce este código; las demás se saltan (con un aviso en el log, sin el id de nada). */
function conTipoConocido(datos: unknown): FilaAviso[] {
  const desconocidos = new Set<string>()
  const filas = z.array(FilaAvisoCruda).parse(datos ?? []).flatMap((f): FilaAviso[] => {
    const t = Tipo.safeParse(f.tipo)
    if (t.success) return [{ ...f, tipo: t.data }]
    desconocidos.add(f.tipo.slice(0, 40))
    return []
  })
  if (desconocidos.size) logger.warn('avisos', `avisos de un tipo que este código no conoce, saltados: ${[...desconocidos].join(', ')}`)
  return filas
}
const FilaCita = z.object({
  id: z.string(), title: z.string().nullable(), start_time: z.string(), end_time: z.string(),
  status: z.enum(['scheduled', 'confirmed', 'cancelled', 'no_show', 'attended']),
  medico_id: z.string().nullable(), paciente_id: z.string().nullable(),
  reserva_nombre: z.string().nullable(), consultorio_timezone: z.string().nullable(),
  /* Integración I: para «¿No es una cita?» en el aviso (I3, `esPorAsignar`). */
  reserva_canal: z.string().nullable().optional(), google_asignacion: z.string().nullable().optional(),
})
const FilaPerfil = z.object({ id: z.string(), nombres: z.string().nullable(), apellido_paterno: z.string().nullable() })

const COLUMNAS_CITA = 'id, title, start_time, end_time, status, medico_id, paciente_id, reserva_nombre, consultorio_timezone'

/**
 * Las citas de los avisos, con `reserva_canal` y `google_asignacion` (I3). Sin
 * la columna de I3 (42703 / PGRST204), la lectura de antes: el aviso se pinta
 * igual, sin el botón.
 */
async function leerCitasDeAvisos(supabase: ClienteSesion, clinicaId: string, ids: string[]): Promise<Map<string, CitaDelAviso> | null> {
  if (ids.length === 0) return new Map()
  const pedir = (columnas: string) => supabase.from('appointments').select(columnas).eq('clinica_id', clinicaId).in('id', ids)
  let r = await pedir(`${COLUMNAS_CITA}, reserva_canal, google_asignacion`)
  if (r.error?.code && AUSENTE.has(r.error.code)) r = await pedir(COLUMNAS_CITA)
  if (r.error) {
    logger.error('avisos', `citas de los avisos sin leer: ${r.error.code ?? ''}`)
    return null
  }
  return new Map(z.array(FilaCita).parse(r.data ?? []).map(c => [c.id, {
    id: c.id, title: c.title ?? '', start_time: c.start_time, end_time: c.end_time, status: c.status,
    medico_id: c.medico_id, paciente_id: c.paciente_id, reserva_nombre: c.reserva_nombre, zona: c.consultorio_timezone,
    reserva_canal: c.reserva_canal ?? null, google_asignacion: c.google_asignacion ?? null,
  }]))
}

/** Los nombres de quienes hicieron lo que cuentan los avisos del personal. Si falla, sin nombres: el aviso sale igual. */
async function leerActores(supabase: ClienteSesion, clinicaId: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('profiles').select('id, nombres, apellido_paterno').eq('clinica_id', clinicaId).in('id', ids)
  if (error) return new Map()
  return new Map(z.array(FilaPerfil).parse(data ?? []).map(p => [p.id, [p.nombres, p.apellido_paterno].filter(Boolean).join(' ')]))
}

function esTipoDe<T extends TipoAviso>(lista: readonly T[], tipo: TipoAviso): tipo is T {
  return (lista as readonly TipoAviso[]).includes(tipo)
}

/** Una fila con su cita y su actor → el aviso que pinta la campana; `[]` si le falta su cita (ya no existe o no la veo). */
function armarAviso(f: FilaAviso, citas: Map<string, CitaDelAviso>, actores: Map<string, string>): AvisoClinica[] {
  const comun = {
    id: f.id, creado_en: f.creado_en, actor: f.actor_id ? (actores.get(f.actor_id) ?? null) : null,
    dirigido: !!f.destinatario_id,
  }
  if (esTipoDe(TIPOS_SIN_CITA, f.tipo)) {
    return [{ ...comun, tipo: f.tipo, cita: null, medico_id: f.medico_id ?? null, datos: DatosDeAviso.parse(f.datos ?? {}) }]
  }
  const cita = f.cita_id ? citas.get(f.cita_id) : undefined
  return cita && esTipoDe(TIPOS_CON_CITA, f.tipo) ? [{ ...comun, tipo: f.tipo, cita }] : []
}

/* Lo que se deja pasar de `datos`: sólo lo que el código pinta. Cualquier otra llave se descarta. */
const DatosDeAviso: z.ZodType<DatosAviso> = z.object({
  nombre: z.string().max(120).optional(), intentos: z.number().int().optional(),
  inicio: z.string().optional(), fin: z.string().optional(), todo_el_dia: z.boolean().optional(),
  zona: z.string().nullable().optional(),
})

/** MIS pendientes (M1) o, sin M1, los sin revisar de la clínica. `null` = no se pudo leer. */
async function leerFilas(supabase: ClienteSesion, clinicaId: string): Promise<FilaAviso[] | null> {
  const nuevo = await supabase.rpc('avisos_pendientes', { p_tipos: [...TIPOS_AVISO], p_limite: TOPE_AVISOS })
  if (!nuevo.error) return conTipoConocido(nuevo.data)
  if (!(nuevo.error.code && AUSENTE.has(nuevo.error.code))) {
    logger.error('avisos', `avisos pendientes sin leer: ${nuevo.error.code ?? ''}`)
    return null
  }
  const { data, error } = await supabase.from('avisos_clinica').select('id, tipo, cita_id, creado_en')
    .eq('clinica_id', clinicaId).is('revisado_en', null)
    /* Sólo los tipos que este código conoce: si no, 50 sin revisar de un tipo nuevo taparían a los demás. */
    .in('tipo', [...TIPOS_AVISO])
    .order('creado_en', { ascending: false }).limit(TOPE_AVISOS)
  if (error) {
    if (!(error.code && AUSENTE.has(error.code))) logger.error('avisos', `avisos sin leer: ${error.code ?? ''}`)
    return null
  }
  return conTipoConocido(data)
}

/**
 * ¿Quedan avisos FUERA de la lectura acotada de la base (más de 60 días, o más de 500 recientes)?
 * `avisos_mas_antiguos` (M1), con la sesión y bajo RLS. Sin la función, o si falla, `false`: la
 * lista sale igual, sólo que sin la nota.
 */
async function hayMasAntiguos(supabase: ClienteSesion): Promise<boolean> {
  const { data, error } = await supabase.rpc('avisos_mas_antiguos', { p_tipos: [...TIPOS_AVISO] })
  return !error && data === true
}

/** Mis avisos pendientes, los más nuevos primero, con su cita y quién lo hizo. Nunca lanza. */
export async function leerAvisosClinica(supabase: ClienteSesion, clinicaId: string): Promise<RespuestaAvisos> {
  try {
    const [filas, fuera] = await Promise.all([leerFilas(supabase, clinicaId), hayMasAntiguos(supabase).catch(() => false)])
    if (filas === null) return { disponible: false, avisos: [] }
    /* Pasó del tope de la respuesta (lo demás sale al revisar lo de arriba) o la base dice que hay más atrás. */
    const mas_antiguos = fuera || filas.length >= TOPE_AVISOS
    if (filas.length === 0) return { disponible: true, avisos: [], mas_antiguos }
    const unicos = (ids: (string | null | undefined)[]): string[] => [...new Set(ids.filter((x): x is string => !!x))]
    const [citas, actores] = await Promise.all([
      leerCitasDeAvisos(supabase, clinicaId, unicos(filas.map(f => f.cita_id))),
      leerActores(supabase, clinicaId, unicos(filas.map(f => f.actor_id))),
    ])
    if (citas === null) return { disponible: false, avisos: [] }
    return { disponible: true, avisos: filas.flatMap(f => armarAviso(f, citas, actores)), mas_antiguos }
  } catch (err: unknown) {
    logger.error('avisos', `avisos sin leer: ${err instanceof Error ? err.name : 'error'}`)
    return { disponible: false, avisos: [] }
  }
}

export type ResultadoRevisar = { ok: true; revisados: string[] } | { ok: false; motivo: 'no_disponible' | 'error' }

/**
 * M1 · Marca vistos POR MÍ los avisos dados: mi fila en `avisos_vistos` (la hora la pone la base).
 * Dos pasos porque la sesión sólo puede insertar la fila o actualizar `visto_en`: primero refresca
 * las que ya tenía (un aviso reabierto) y luego inserta las que faltan. `null` = la base no tiene M1.
 */
async function marcarVistos(supabase: ClienteSesion, clinicaId: string, usuarioId: string, ids: readonly string[]): Promise<ResultadoRevisar | null> {
  const ya = await supabase.from('avisos_vistos').update({ visto_en: new Date().toISOString() })
    .eq('usuario_id', usuarioId).eq('clinica_id', clinicaId).in('aviso_id', [...ids]).select('aviso_id')
  if (ya.error) {
    if (ya.error.code && AUSENTE.has(ya.error.code)) return null
    logger.error('avisos', `avisos sin marcar como vistos: ${ya.error.code ?? ''}`)
    return { ok: false, motivo: 'error' }
  }
  const tenia = new Set(z.array(z.object({ aviso_id: z.string() })).parse(ya.data ?? []).map(f => f.aviso_id))
  const faltan = ids.filter(id => !tenia.has(id))
  if (faltan.length) {
    const alta = await supabase.from('avisos_vistos').insert(faltan.map(id => ({ aviso_id: id, usuario_id: usuarioId, clinica_id: clinicaId })))
    /* 23505: otra pestaña mía lo marcó entre los dos pasos. Ya está visto. */
    if (alta.error && alta.error.code !== '23505') {
      logger.error('avisos', `avisos sin marcar como vistos: ${alta.error.code ?? ''}`)
      return { ok: false, motivo: 'error' }
    }
  }
  return { ok: true, revisados: [...ids] }
}

/**
 * Marca revisados los avisos dados (de los que quien llama ve). Con M1, sólo PARA MÍ
 * (`marcarVistos`); sin M1, como antes: `revisado_en` para toda la clínica (la hora la pone la
 * base, `aviso_clinica_revisar`, y la policy exige que `revisado_por` sea quien llama).
 */
export async function marcarAvisosRevisados(
  supabase: ClienteSesion, clinicaId: string, usuarioId: string, ids: readonly string[],
): Promise<ResultadoRevisar> {
  const mios = await marcarVistos(supabase, clinicaId, usuarioId, ids)
  if (mios) return mios
  const { data, error } = await supabase.from('avisos_clinica')
    .update({ revisado_en: new Date().toISOString(), revisado_por: usuarioId })
    .eq('clinica_id', clinicaId).is('revisado_en', null).in('id', [...ids]).select('id')
  if (error) {
    if (error.code && AUSENTE.has(error.code)) return { ok: false, motivo: 'no_disponible' }
    logger.error('avisos', `avisos sin marcar: ${error.code ?? ''}`)
    return { ok: false, motivo: 'error' }
  }
  return { ok: true, revisados: z.array(z.object({ id: z.string() })).parse(data ?? []).map(f => f.id) }
}
