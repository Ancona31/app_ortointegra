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
 * ⚠️⚠️ FALLA CERRADO. Sin fila, con un error de red, con la tabla todavía sin
 * crear o con una fila que no cuadra: valores de fábrica e interruptor
 * APAGADO. Lo nuevo sólo se ve cuando la base dice, sin duda, que está
 * encendido.
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

const entero = (l: { min: number; max: number }) => z.number().int().min(l.min).max(l.max)

/**
 * Los cuatro ajustes y NADA MÁS: `strictObject` rechaza cualquier otra clave
 * —`agenda_v2_encendida`, `candado_*`, `clinica_id`— en vez de ignorarla. El
 * interruptor y el candado sólo se cambian desde el editor SQL.
 */
export const AjustesAgendaSchema = z.strictObject({
  recordatorio_horas: entero(LIMITES_AJUSTES_AGENDA.recordatorio_horas),
  anticipacion_min_horas: entero(LIMITES_AJUSTES_AGENDA.anticipacion_min_horas),
  horizonte_dias: entero(LIMITES_AJUSTES_AGENDA.horizonte_dias),
  vigencia_enlace_unico_dias: entero(LIMITES_AJUSTES_AGENDA.vigencia_enlace_unico_dias),
})

export type AjustesAgenda = z.infer<typeof AjustesAgendaSchema>

const COLUMNAS_AJUSTES = 'recordatorio_horas, anticipacion_min_horas, horizonte_dias, vigencia_enlace_unico_dias'

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

/** ¿Está encendida la agenda v2 para esta clínica? Sólo `true` si la base lo dice sin duda. */
export async function agendaV2Encendida(supabase: ClienteSesion, clinicaId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('agenda_ajustes').select('agenda_v2_encendida').eq('clinica_id', clinicaId).maybeSingle()
    if (error) {
      logger.warn('agenda', `interruptor de la agenda sin leer (cuenta como apagado): ${error.message}`)
      return false
    }
    return data?.agenda_v2_encendida === true
  } catch (err: unknown) {
    logger.warn('agenda', `interruptor de la agenda sin leer (cuenta como apagado): ${err instanceof Error ? err.message : 'error'}`)
    return false
  }
}
