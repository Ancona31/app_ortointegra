/**
 * src/lib/agenda/ajustesAgenda.ts
 *
 * Los cuatro ajustes de la agenda por clínica (`mejora_agendaV2.md` §2,
 * «Ajustes editables por clínica») y el interruptor de la agenda v2, que viven
 * en `public.agenda_ajustes` (migración `20261112130000_agenda_b1_ajustes_interruptor.sql`).
 *
 * ⚠️ MÓDULO NEUTRO, sin `'use client'` ni nada de servidor: el esquema lo
 * usarán la ruta de guardado (B4) y la pantalla de configuración. Las dos
 * lecturas reciben el cliente que les den; hoy sólo las llama el servidor.
 *
 * ⚠️⚠️ LOS LÍMITES ESTÁN DOS VECES: aquí y en los CHECK de la tabla. Si cambias
 * uno, cambia el otro (lo dice también el COMMENT ON TABLE).
 *
 * ⚠️⚠️ FALLA CERRADO. Con un error de red, con la tabla todavía sin crear o con
 * una fila que no cuadra: valores de fábrica e interruptor APAGADO. Lo nuevo
 * sólo se ve cuando la base dice, sin duda, que está encendido. Desde «agenda
 * para todos» (M3) «sin fila» ya no es apagado: lo decide la base
 * (`agendaV2Encendida`, abajo).
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`: la RLS de
 * `agenda_ajustes` deja leer a los miembros de la clínica, y el
 * `eq('clinica_id')` es explícito aunque la RLS ya filtre (pendiente
 * prioritario de `CLAUDE.md`). El candado (`candado_*`) no se lee aquí: no se
 * expone (§2).
 */
import { z } from 'zod'
import type { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

/** Valores de fábrica de §2: los que vale una clínica sin fila. */
export const FABRICA_AJUSTES_AGENDA = {
  recordatorio_horas: 24,
  anticipacion_min_horas: 2,
  horizonte_dias: 60,
  vigencia_enlace_unico_dias: 7,
} as const

/** Límites de §2, inclusivos. Los mismos que los CHECK de `agenda_ajustes`. */
export const LIMITES_AJUSTES_AGENDA = {
  recordatorio_horas: { min: 1, max: 72 },
  anticipacion_min_horas: { min: 0, max: 72 },
  horizonte_dias: { min: 1, max: 365 },
  vigencia_enlace_unico_dias: { min: 1, max: 30 },
} as const

export type CampoAjusteAgenda = keyof typeof LIMITES_AJUSTES_AGENDA

/** Cómo se llama cada ajuste en pantalla y en los mensajes del 400 (§2). */
export const ETIQUETAS_AJUSTES_AGENDA: Record<CampoAjusteAgenda, { nombre: string; unidad: string }> = {
  recordatorio_horas: { nombre: 'Recordatorio por correo', unidad: 'horas antes de la cita' },
  anticipacion_min_horas: { nombre: 'Anticipación mínima para reservar por enlace', unidad: 'horas' },
  horizonte_dias: { nombre: 'Hasta cuándo se puede reservar', unidad: 'días adelante' },
  vigencia_enlace_unico_dias: { nombre: 'Vigencia del enlace de un solo uso', unidad: 'días' },
}

/**
 * Qué hace cada ajuste, en UNA línea (tanda H, punto 8 de Angel). Lo pinta la
 * pantalla de configuración debajo de cada campo. El del recordatorio dice
 * qué ES el recordatorio: un correo que Spinus manda al paciente.
 */
export const EXPLICACION_AJUSTES_AGENDA: Record<CampoAjusteAgenda, string> = {
  recordatorio_horas: 'El recordatorio es un correo que Spinus manda al paciente antes de su cita; aquí eliges cuántas horas antes.',
  anticipacion_min_horas: 'Lo mínimo que tiene que faltar para una cita para que un paciente la pueda reservar con un enlace.',
  horizonte_dias: 'Hasta cuántos días adelante ve horarios un paciente que reserva con un enlace.',
  vigencia_enlace_unico_dias: 'Cuántos días sirve un enlace de un solo uso antes de caducar si nadie lo usa.',
}

/** El orden en que se pintan y se validan. */
export const CAMPOS_AJUSTES_AGENDA: readonly CampoAjusteAgenda[] = [
  'recordatorio_horas', 'anticipacion_min_horas', 'horizonte_dias', 'vigencia_enlace_unico_dias',
]

const entero = (campo: CampoAjusteAgenda) => {
  const l = LIMITES_AJUSTES_AGENDA[campo]
  const { nombre, unidad } = ETIQUETAS_AJUSTES_AGENDA[campo]
  const rango = `${nombre}: de ${l.min} a ${l.max} ${unidad}`
  return z.number(rango).int(`${nombre}: tiene que ser un número entero`).min(l.min, rango).max(l.max, rango)
}

/**
 * Los cuatro ajustes y NADA MÁS: `strictObject` rechaza cualquier otra clave
 * —`agenda_v2_encendida`, `candado_*`, `clinica_id`— en vez de ignorarla. El
 * interruptor y el candado sólo se cambian desde el editor SQL.
 */
export const AjustesAgendaSchema = z.strictObject({
  recordatorio_horas: entero('recordatorio_horas'),
  anticipacion_min_horas: entero('anticipacion_min_horas'),
  horizonte_dias: entero('horizonte_dias'),
  vigencia_enlace_unico_dias: entero('vigencia_enlace_unico_dias'),
})

export type AjustesAgenda = z.infer<typeof AjustesAgendaSchema>

/**
 * Lo que el formulario de la pantalla de configuración (B4) tiene escrito, a
 * los cuatro ajustes, con el MISMO esquema que aplica el servidor. Un campo
 * vacío es un error propio y no un 0: `Number('')` vale 0, y 0 es un valor
 * válido de la anticipación. Sólo ayuda a avisar antes de enviar; quien manda
 * es el `safeParse` de la ruta.
 */
export function ajustesDesdeFormulario(
  valores: Record<CampoAjusteAgenda, string>,
): { ok: true; ajustes: AjustesAgenda } | { ok: false; error: string } {
  const vacio = CAMPOS_AJUSTES_AGENDA.find(c => valores[c].trim() === '')
  if (vacio) return { ok: false, error: `${ETIQUETAS_AJUSTES_AGENDA[vacio].nombre}: escribe un número` }
  const r = AjustesAgendaSchema.safeParse(
    Object.fromEntries(CAMPOS_AJUSTES_AGENDA.map(c => [c, Number(valores[c])])),
  )
  return r.success ? { ok: true, ajustes: r.data } : { ok: false, error: r.error.issues[0]?.message ?? 'Datos inválidos' }
}

/** Las columnas de los cuatro ajustes: ni el candado ni el interruptor. */
export const COLUMNAS_AJUSTES = 'recordatorio_horas, anticipacion_min_horas, horizonte_dias, vigencia_enlace_unico_dias'

/** Los ajustes de la clínica, o los de fábrica si no hay fila o algo falla. */
export async function leerAjustesAgenda(supabase: ClienteSesion, clinicaId: string): Promise<AjustesAgenda> {
  try {
    const { data, error } = await supabase
      .from('agenda_ajustes').select(COLUMNAS_AJUSTES).eq('clinica_id', clinicaId).maybeSingle()
    if (error) {
      logger.warn('agenda', `ajustes de la agenda sin leer: ${error.message}`)
      return { ...FABRICA_AJUSTES_AGENDA }
    }
    if (!data) return { ...FABRICA_AJUSTES_AGENDA }
    const r = AjustesAgendaSchema.safeParse(data)
    if (!r.success) {
      logger.warn('agenda', 'ajustes de la agenda con forma inesperada; se usan los de fábrica')
      return { ...FABRICA_AJUSTES_AGENDA }
    }
    return r.data
  } catch (err: unknown) {
    logger.warn('agenda', `ajustes de la agenda sin leer: ${err instanceof Error ? err.message : 'error'}`)
    return { ...FABRICA_AJUSTES_AGENDA }
  }
}

/**
 * El interruptor del recordatorio automático por correo (tanda H, punto 9;
 * columna `recordatorio_encendido`, migración `20261120120000`), lo único que
 * acepta `PATCH /api/me/ajustes-agenda`. `strictObject`: ninguna otra clave.
 */
export const RecordatorioEncendidoSchema = z.strictObject({ recordatorio_encendido: z.boolean() })

/**
 * ¿Tiene esta clínica encendido el recordatorio automático? `null` = no se
 * pudo saber (la columna no existe todavía —base sin la migración—, error o
 * sin fila): la pantalla lo enseña como no disponible y no deja cambiarlo. La
 * tarea programada no usa esto: decide la base en su listado.
 */
export async function leerRecordatorioEncendido(supabase: ClienteSesion, clinicaId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('agenda_ajustes').select('recordatorio_encendido').eq('clinica_id', clinicaId).maybeSingle()
    if (error) {
      logger.warn('agenda', `interruptor del recordatorio sin leer: ${error.code ?? ''}`)
      return null
    }
    return typeof data?.recordatorio_encendido === 'boolean' ? data.recordatorio_encendido : null
  } catch (err: unknown) {
    logger.warn('agenda', `interruptor del recordatorio sin leer: ${err instanceof Error ? err.message : 'error'}`)
    return null
  }
}

/**
 * I5 (punto 20) · El interruptor del correo a la clínica por cada reserva
 * nueva por enlace (columna `correo_reserva_clinica`, migración
 * `20261121150000`, APAGADO de fábrica). La otra forma que acepta
 * `PATCH /api/me/ajustes-agenda`; `strictObject`: ninguna otra clave.
 */
export const CorreoReservaClinicaSchema = z.strictObject({ correo_reserva_clinica: z.boolean() })

/** Copia de `leerRecordatorioEncendido` para la otra columna: `null` = no se pudo saber (base sin la migración). */
export async function leerCorreoReservaClinica(supabase: ClienteSesion, clinicaId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('agenda_ajustes').select('correo_reserva_clinica').eq('clinica_id', clinicaId).maybeSingle()
    if (error) {
      logger.warn('agenda', `interruptor del correo a la clínica sin leer: ${error.code ?? ''}`)
      return null
    }
    return typeof data?.correo_reserva_clinica === 'boolean' ? data.correo_reserva_clinica : null
  } catch (err: unknown) {
    logger.warn('agenda', `interruptor del correo a la clínica sin leer: ${err instanceof Error ? err.message : 'error'}`)
    return null
  }
}

/**
 * ¿Está encendida la agenda v2 para esta clínica?
 *
 * AGENDA PARA TODOS (2026-11-25, decisión de Angel): la v2 está encendida de
 * fábrica; sólo una fila que diga `false` la apaga. La regla NO se escribe
 * aquí: se le PREGUNTA A LA BASE, a la misma función que usan sus
 * disparadores y sus RPC (`public.agenda_v2_encendida(uuid)`, de F1; M3
 * `20261206120000` cambia su «sin fila» de false a true). Así la app y la base
 * contestan siempre lo mismo, antes y después de aplicar M3.
 *
 * ⚠️ SIGUE FALLANDO CERRADO: un error de red, la función o la tabla ausentes,
 * o una respuesta que no sea `true`, cuentan como APAGADA. «Sin fila» no es un
 * error (lo contesta la base); un fallo de lectura sí, y no enciende nada.
 */
export async function agendaV2Encendida(supabase: ClienteSesion, clinicaId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('agenda_v2_encendida', { p_clinica_id: clinicaId })
    if (error) {
      logger.warn('agenda', `interruptor de la agenda sin leer (cuenta como apagado): ${error.message}`)
      return false
    }
    return data === true
  } catch (err: unknown) {
    logger.warn('agenda', `interruptor de la agenda sin leer (cuenta como apagado): ${err instanceof Error ? err.message : 'error'}`)
    return false
  }
}
