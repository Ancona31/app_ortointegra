/**
 * src/lib/avisos/avisosServidor.ts — leer y marcar revisados los «Avisos» de
 * la clínica (tanda I, punto 19). SÓLO SERVIDOR.
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: la RLS de
 * `avisos_clinica` sólo deja ver los de la clínica de la sesión y de citas que
 * quien mira ve (el médico invitado, sólo los de sus citas); las consultas
 * llevan además `clinica_id` explícito.
 *
 * Tolerante: sin la migración `20261121150000` (producción hoy) la tabla no
 * existe y la respuesta es `{ disponible: false, avisos: [] }`; quien la pinta
 * vuelve a lo de antes (las canceladas y los empalmes calculados al vuelo).
 */
import { z } from 'zod'
import type { ClienteSesion } from '@/lib/reserva/gestionServidor'
import { TIPOS_AVISO, type AvisoClinica, type RespuestaAvisos } from '@/lib/avisos/avisosClinica'
import { logger } from '@/lib/logger'

/** Lo que cabe en la campana. Lo que no se revise se sigue viendo al revisar lo de arriba. */
export const TOPE_AVISOS = 50

/** Tabla o columna ausente (base sin la migración). */
const AUSENTE = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

/* ⚠️ `tipo` SE LEE COMO TEXTO Y SE FILTRA DESPUÉS (`conTipoConocido`), NO CON `z.enum` EN EL
   ESQUEMA DE LA FILA. La migración que añade un tipo puede llegar a la base antes que el código
   que lo pinta (otra rama, el orden de despliegue): con `z.enum` aquí, UN aviso de un tipo
   desconocido tiraba el `parse` del arreglo entero y la campana se quedaba vacía. */
const FilaAvisoCruda = z.object({ id: z.string(), tipo: z.string(), cita_id: z.string(), creado_en: z.string() })
const TipoAviso = z.enum(TIPOS_AVISO)
type FilaAviso = Omit<z.infer<typeof FilaAvisoCruda>, 'tipo'> & { tipo: z.infer<typeof TipoAviso> }

/** Las filas cuyo tipo conoce este código; las demás se saltan (con un aviso en el log, sin el id de nada). */
function conTipoConocido(datos: unknown): FilaAviso[] {
  const desconocidos = new Set<string>()
  const filas = z.array(FilaAvisoCruda).parse(datos ?? []).flatMap((f): FilaAviso[] => {
    const t = TipoAviso.safeParse(f.tipo)
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

const COLUMNAS_CITA = 'id, title, start_time, end_time, status, medico_id, paciente_id, reserva_nombre, consultorio_timezone'

/**
 * Las citas de los avisos, con `reserva_canal` y `google_asignacion` (I3). Sin
 * la columna de I3 (42703 / PGRST204), la lectura de antes: el aviso se pinta
 * igual, sin el botón.
 */
async function leerCitasDeAvisos(supabase: ClienteSesion, clinicaId: string, ids: string[]) {
  const pedir = (columnas: string) => supabase.from('appointments').select(columnas).eq('clinica_id', clinicaId).in('id', ids)
  const r = await pedir(`${COLUMNAS_CITA}, reserva_canal, google_asignacion`)
  return r.error?.code && AUSENTE.has(r.error.code) ? pedir(COLUMNAS_CITA) : r
}

/** Los avisos sin revisar de la clínica, los más nuevos primero, con su cita. Nunca lanza. */
export async function leerAvisosClinica(supabase: ClienteSesion, clinicaId: string): Promise<RespuestaAvisos> {
  try {
    const { data, error } = await supabase.from('avisos_clinica').select('id, tipo, cita_id, creado_en')
      .eq('clinica_id', clinicaId).is('revisado_en', null)
      /* Sólo los tipos que este código conoce: si no, 50 sin revisar de un tipo nuevo taparían a
         los demás (`limit`). `conTipoConocido` queda de red por si el filtro no llegara. */
      .in('tipo', [...TIPOS_AVISO])
      .order('creado_en', { ascending: false }).limit(TOPE_AVISOS)
    if (error) {
      if (!(error.code && AUSENTE.has(error.code))) logger.error('avisos', `avisos sin leer: ${error.code ?? ''}`)
      return { disponible: false, avisos: [] }
    }
    const filas = conTipoConocido(data)
    if (filas.length === 0) return { disponible: true, avisos: [] }
    const { data: citas, error: e2 } = await leerCitasDeAvisos(supabase, clinicaId, [...new Set(filas.map(f => f.cita_id))])
    if (e2) {
      logger.error('avisos', `citas de los avisos sin leer: ${e2.code ?? ''}`)
      return { disponible: false, avisos: [] }
    }
    const porId = new Map(z.array(FilaCita).parse(citas ?? []).map(c => [c.id, c]))
    return { disponible: true, avisos: filas.flatMap((f): AvisoClinica[] => {
      const c = porId.get(f.cita_id)
      if (!c) return []
      return [{ id: f.id, tipo: f.tipo, creado_en: f.creado_en, cita: {
        id: c.id, title: c.title ?? '', start_time: c.start_time, end_time: c.end_time, status: c.status,
        medico_id: c.medico_id, paciente_id: c.paciente_id, reserva_nombre: c.reserva_nombre, zona: c.consultorio_timezone,
        reserva_canal: c.reserva_canal ?? null, google_asignacion: c.google_asignacion ?? null,
      } }]
    }) }
  } catch (err: unknown) {
    logger.error('avisos', `avisos sin leer: ${err instanceof Error ? err.name : 'error'}`)
    return { disponible: false, avisos: [] }
  }
}

export type ResultadoRevisar = { ok: true; revisados: string[] } | { ok: false; motivo: 'no_disponible' | 'error' }

/**
 * Marca revisados los avisos dados (de los que quien llama ve). La hora la pone la base (`aviso_clinica_revisar`) y la policy exige
 * que `revisado_por` sea quien llama.
 */
export async function marcarAvisosRevisados(
  supabase: ClienteSesion, clinicaId: string, usuarioId: string, ids: readonly string[],
): Promise<ResultadoRevisar> {
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
