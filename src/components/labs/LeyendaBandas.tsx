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

function Pill({ kind, label }: { kind: Kind; label: string }) {
  const { fill } = BAND_COLORS[kind]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-slate-700 bg-slate-50 border border-slate-100">
      <span
        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
        style={{ background: fill }}
      />
      {label}
    </span>
  )
}

export default function LeyendaBandas({ analito, analitoCatalogo, sexoPaciente }: Props) {
  if (!analitoCatalogo || analitoCatalogo.bands_type === 'none') {
    return (
      <div className="text-[11px] text-slate-500 px-1">
        Este analito no tiene rangos de referencia definidos.
      </div>
    )
  }

  const rango = getRangoEffective(analitoCatalogo, sexoPaciente)
  if (!rango) {
    return (
      <div className="text-[11px] text-slate-500 px-1">
        Este analito no tiene rangos de referencia definidos.
      </div>
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
      <div className="text-[11px] text-slate-500 px-1">
        Este analito no tiene rangos de referencia definidos.
      </div>
    )
  }

  return (
    <div className="space-y-1.5 px-1">
      <div className="flex flex-wrap gap-1.5">
        {pills.map((p, i) => (
          <Pill key={i} kind={p.kind} label={p.label} />
        ))}
      </div>
      {usingOverride && (
        <p className="text-[10px] text-slate-400">
          Rangos ajustados para paciente {sexoPaciente === 'M' ? 'masculino' : 'femenino'}
        </p>
      )}
    </div>
  )
}
