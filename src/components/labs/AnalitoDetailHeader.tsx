'use client'

import { useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AnalitoCatalogo, MedicionAnalito } from '@/types'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'

const CATEGORIA_LABEL: Record<string, string> = {
  antropometria: 'Antropometría',
  signos_vitales: 'Signos vitales',
  hematologia: 'Hematología',
  quimica: 'Química',
  hueso: 'Hueso',
  endocrino: 'Endocrino',
  inmunologia: 'Inmunología',
  coagulacion: 'Coagulación',
  cardiaco: 'Cardíaco',
  marcador_tumoral: 'Marcadores tumorales',
  vitaminas_minerales: 'Vitaminas y minerales',
  otros: 'Otros',
}

function labelCategoria(c: string): string {
  return CATEGORIA_LABEL[c] ?? c
}

function formatValor(v: number, precision: number): string {
  if (precision <= 0) return String(Math.round(v))
  return v.toFixed(precision)
}

type DeltaColor = 'up-bad' | 'up-good' | 'down-bad' | 'down-good' | 'neutral'

function calcularColor(
  delta: number,
  analitoCatalogo: AnalitoCatalogo | null,
): DeltaColor {
  if (delta === 0) return 'neutral'
  const bands = analitoCatalogo?.bands_type
  if (bands === 'high-bad') {
    return delta > 0 ? 'up-bad' : 'down-good'
  }
  if (bands === 'low-bad') {
    return delta > 0 ? 'up-good' : 'down-bad'
  }
  return 'neutral'
}

const COLOR_CLASSES: Record<DeltaColor, string> = {
  'up-bad': 'bg-red-50 text-red-700',
  'up-good': 'bg-emerald-50 text-emerald-700',
  'down-bad': 'bg-red-50 text-red-700',
  'down-good': 'bg-emerald-50 text-emerald-700',
  'neutral': 'bg-slate-50 text-slate-600',
}

interface Props {
  analito: AnalitoRastreado
  analitoCatalogo: AnalitoCatalogo | null
  mediciones: MedicionAnalito[]
}

export default function AnalitoDetailHeader({ analito, analitoCatalogo, mediciones }: Props) {
  const precision = analitoCatalogo?.precision_decimales ?? 2

  const info = useMemo(() => {
    if (mediciones.length === 0) return null
    const actual = mediciones[0]
    const primera = mediciones[mediciones.length - 1]
    return { actual, primera }
  }, [mediciones])

  if (!info) return null

  const valorActualStr = formatValor(Number(info.actual.valor), precision)
  const delta = Number(info.actual.valor) - Number(info.primera.valor)
  const hayDelta = mediciones.length >= 2
  const color = hayDelta ? calcularColor(delta, analitoCatalogo) : 'neutral'
  const absDelta = Math.abs(delta)
  const pct =
    Number(info.primera.valor) !== 0
      ? (delta / Number(info.primera.valor)) * 100
      : 0

  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus
  const signo = delta > 0 ? '+' : delta < 0 ? '-' : ''
  const fechaActualLarga = format(parseISO(info.actual.medido_en), "d MMM yyyy, HH:mm", { locale: es })

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-semibold text-slate-900 leading-tight">
            {analito.nombre}
          </h3>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-slate-100 text-slate-600">
              {labelCategoria(String(analito.categoria))}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-50 text-slate-500 border border-slate-100">
              {analito.unidad || 'sin unidad'}
            </span>
            {analito.analitoId === null && (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-md bg-violet-50 text-violet-600 border border-violet-100">
                Custom
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="flex items-baseline gap-1.5 justify-end">
            <span className="text-[32px] font-semibold text-slate-900 leading-none tabular-nums">
              {valorActualStr}
            </span>
            <span className="text-[13px] text-slate-500">{analito.unidad}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{fechaActualLarga}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        {hayDelta ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium ${COLOR_CLASSES[color]}`}
            >
              <Icon size={12} />
              {signo}
              {formatValor(absDelta, precision)} {analito.unidad}
              <span className="opacity-70">
                ({signo}
                {Math.abs(pct).toFixed(1)}%)
              </span>
            </span>
            <span className="text-[12px] text-slate-500">desde el inicio</span>
            <span className="text-[11px] text-slate-400">
              · {mediciones.length} mediciones
            </span>
          </div>
        ) : (
          <p className="text-[12px] text-slate-500">Primera medición registrada</p>
        )}
      </div>
    </div>
  )
}
