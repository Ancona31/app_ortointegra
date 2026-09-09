'use client'

import type { AnalitoCatalogo } from '@/types'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'
import { BAND_COLORS, getRangoEffective, type Sexo } from '@/lib/labs/utils'

interface Props {
  analito: AnalitoRastreado
  analitoCatalogo: AnalitoCatalogo | null
  sexoPaciente: Sexo
}

type Kind = 'ok' | 'warn' | 'bad'

/**
 * ⚠️ PUNTO Y TEXTO, SIN PASTILLA. Llevaba fondo y borde propios, o sea una
 * cajita por rango dentro de la card del detalle. La leyenda explica los colores
 * de la gráfica que tiene justo encima: un punto del mismo color y su rótulo
 * bastan, y así no compite con lo que describe.
 */
function Entrada({ kind, label }: { kind: Kind; label: string }) {
  const { fill } = BAND_COLORS[kind]
  return (
    <span className="inline-flex items-center gap-[var(--sp-1-5)] text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-600)]">
      <span
        aria-hidden
        className="h-[9px] w-[9px] shrink-0 rounded-[var(--sp-r-pill)]"
        style={{ background: fill }}
      />
      {label}
    </span>
  )
}

export default function LeyendaBandas({ analito, analitoCatalogo, sexoPaciente }: Props) {
  if (!analitoCatalogo || analitoCatalogo.bands_type === 'none') {
    return (
      <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
        Este analito no tiene rangos de referencia definidos.
      </p>
    )
  }

  const rango = getRangoEffective(analitoCatalogo, sexoPaciente)
  if (!rango) {
    return (
      <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
        Este analito no tiene rangos de referencia definidos.
      </p>
    )
  }

  const usingOverride =
    (sexoPaciente === 'M' && analitoCatalogo.rango_masculino !== null) ||
    (sexoPaciente === 'F' && analitoCatalogo.rango_femenino !== null)
  const unidad = analito.unidad

  const pills: { kind: Kind; label: string }[] = []

  if (analitoCatalogo.bands_type === 'high-bad') {
    if (rango.ok_max !== undefined) {
      pills.push({ kind: 'ok', label: `Normal: ≤ ${rango.ok_max} ${unidad}` })
    }
    if (rango.warn_max !== undefined && rango.ok_max !== undefined) {
      pills.push({
        kind: 'warn',
        label: `Atención: ${rango.ok_max}–${rango.warn_max} ${unidad}`,
      })
      pills.push({ kind: 'bad', label: `Fuera de rango: > ${rango.warn_max} ${unidad}` })
    } else if (rango.ok_max !== undefined) {
      pills.push({ kind: 'bad', label: `Fuera de rango: > ${rango.ok_max} ${unidad}` })
    }
  } else if (analitoCatalogo.bands_type === 'low-bad') {
    if (rango.ok_min !== undefined) {
      pills.push({ kind: 'ok', label: `Normal: ≥ ${rango.ok_min} ${unidad}` })
    }
    if (rango.warn_min !== undefined && rango.ok_min !== undefined) {
      pills.push({
        kind: 'warn',
        label: `Atención: ${rango.warn_min}–${rango.ok_min} ${unidad}`,
      })
      pills.push({ kind: 'bad', label: `Fuera de rango: < ${rango.warn_min} ${unidad}` })
    } else if (rango.ok_min !== undefined) {
      pills.push({ kind: 'bad', label: `Fuera de rango: < ${rango.ok_min} ${unidad}` })
    }
  } else if (analitoCatalogo.bands_type === 'low-and-high-bad') {
    if (rango.ok_min !== undefined && rango.ok_max !== undefined) {
      pills.push({
        kind: 'ok',
        label: `Normal: ${rango.ok_min}–${rango.ok_max} ${unidad}`,
      })
    }
    const warnParts: string[] = []
    if (rango.warn_min !== undefined && rango.ok_min !== undefined) {
      warnParts.push(`${rango.warn_min}–${rango.ok_min}`)
    }
    if (rango.ok_max !== undefined && rango.warn_max !== undefined) {
      warnParts.push(`${rango.ok_max}–${rango.warn_max}`)
    }
    if (warnParts.length > 0) {
      pills.push({ kind: 'warn', label: `Atención: ${warnParts.join(' o ')} ${unidad}` })
    }
    const lowBound =
      rango.warn_min !== undefined ? rango.warn_min : rango.ok_min
    const highBound =
      rango.warn_max !== undefined ? rango.warn_max : rango.ok_max
    if (lowBound !== undefined && highBound !== undefined) {
      pills.push({
        kind: 'bad',
        label: `Fuera de rango: < ${lowBound} o > ${highBound} ${unidad}`,
      })
    }
  }

  if (pills.length === 0) {
    return (
      <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
        Este analito no tiene rangos de referencia definidos.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--sp-1-5)]">
      <div className="flex flex-wrap gap-x-[var(--sp-4)] gap-y-[var(--sp-1-5)]">
        {pills.map((p, i) => (
          <Entrada key={i} kind={p.kind} label={p.label} />
        ))}
      </div>
      {usingOverride && (
        <p className="text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)]">
          Rangos ajustados para paciente {sexoPaciente === 'M' ? 'masculino' : 'femenino'}
        </p>
      )}
    </div>
  )
}
