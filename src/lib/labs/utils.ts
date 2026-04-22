import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AnalitoCatalogo, RangoAnalito } from '@/types'

/**
 * Fuente única de verdad de los colores de las bandas de rango.
 * Si el repo añade CSS vars semánticas globales (success/warning/danger),
 * migrar a `var(--color-success)` etc.
 */
export const BAND_COLORS = {
  ok:   { fill: '#10b981', opacity: 0.12 },
  warn: { fill: '#f59e0b', opacity: 0.15 },
  bad:  { fill: '#ef4444', opacity: 0.12 },
} as const

export type Sexo = 'M' | 'F' | 'Otro' | null

export type AnalitoStatus = 'ok' | 'warn' | 'bad' | 'neutral'

export function getRangoEffective(
  analito: AnalitoCatalogo | null,
  sexo: Sexo,
): RangoAnalito | null {
  if (!analito) return null
  if (sexo === 'M' && analito.rango_masculino) return analito.rango_masculino
  if (sexo === 'F' && analito.rango_femenino) return analito.rango_femenino
  return analito.rango_default
}

export function statusOf(
  valor: number,
  analito: AnalitoCatalogo | null,
  sexo: Sexo,
): AnalitoStatus {
  if (!analito || analito.bands_type === 'none') return 'neutral'
  const rango = getRangoEffective(analito, sexo)
  if (!rango) return 'neutral'

  if (analito.bands_type === 'high-bad') {
    const { ok_max, warn_max } = rango
    if (ok_max === undefined) return 'neutral'
    if (valor <= ok_max) return 'ok'
    if (warn_max !== undefined && valor <= warn_max) return 'warn'
    return 'bad'
  }

  if (analito.bands_type === 'low-bad') {
    const { ok_min, warn_min } = rango
    if (ok_min === undefined) return 'neutral'
    if (valor >= ok_min) return 'ok'
    if (warn_min !== undefined && valor >= warn_min) return 'warn'
    return 'bad'
  }

  if (analito.bands_type === 'low-and-high-bad') {
    const { ok_min, ok_max, warn_min, warn_max } = rango
    if (ok_min === undefined || ok_max === undefined) return 'neutral'
    if (valor >= ok_min && valor <= ok_max) return 'ok'
    const inWarnLow = warn_min !== undefined && valor >= warn_min && valor < ok_min
    const inWarnHigh = warn_max !== undefined && valor > ok_max && valor <= warn_max
    if (inWarnLow || inWarnHigh) return 'warn'
    return 'bad'
  }

  return 'neutral'
}

/**
 * Etiqueta textual del estado clínico para tooltip de la gráfica.
 * Distingue entre "bajo" y "alto" cuando aplica.
 */
export function statusLabelDetailed(
  valor: number,
  analito: AnalitoCatalogo | null,
  sexo: Sexo,
): string {
  if (!analito || analito.bands_type === 'none') return 'Sin rango de referencia'
  const rango = getRangoEffective(analito, sexo)
  if (!rango) return 'Sin rango de referencia'
  const status = statusOf(valor, analito, sexo)
  if (status === 'ok') return 'En rango'
  if (status === 'neutral') return 'Sin rango de referencia'

  if (analito.bands_type === 'high-bad') {
    return status === 'warn' ? 'Sobre el rango normal' : 'Fuera de rango alto'
  }
  if (analito.bands_type === 'low-bad') {
    return status === 'warn' ? 'Bajo el rango normal' : 'Fuera de rango bajo'
  }
  if (analito.bands_type === 'low-and-high-bad') {
    const esAlto = rango.ok_max !== undefined && valor > rango.ok_max
    if (esAlto) return status === 'warn' ? 'Sobre el rango normal' : 'Fuera de rango alto'
    return status === 'warn' ? 'Bajo el rango normal' : 'Fuera de rango bajo'
  }
  return 'Sin rango de referencia'
}

export function formatFechaCorta(iso: string): string {
  return format(parseISO(iso), 'd MMM', { locale: es })
}

export function formatFechaLarga(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es })
}

export function formatFechaChart(iso: string): string {
  return format(parseISO(iso), 'dd/MM')
}
