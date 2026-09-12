'use client'

import { useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AnalitoCatalogo, MedicionAnalito } from '@/types'
import type { AnalitoRastreado } from '@/hooks/useAnalitosRastreados'
import { statusOf, type Sexo, type AnalitoStatus } from '@/lib/labs/utils'

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

const ESTILO_DELTA: Record<DeltaColor, { background: string; color: string }> = {
  'up-bad':    { background: 'var(--sp-danger-bg)',  color: 'var(--sp-danger)' },
  'up-good':   { background: 'var(--sp-success-bg)', color: 'var(--sp-success-strong)' },
  'down-bad':  { background: 'var(--sp-danger-bg)',  color: 'var(--sp-danger)' },
  'down-good': { background: 'var(--sp-success-bg)', color: 'var(--sp-success-strong)' },
  'neutral':   { background: 'var(--sp-surface-muted)', color: 'var(--sp-ink-600)' },
}

/** El chip de estado del último valor. Sin rango de referencia no se dibuja. */
function chipEstado(estado: AnalitoStatus): { texto: string; background: string; color: string } | null {
  if (estado === 'ok')   return { texto: 'En rango',      background: 'var(--sp-success-bg)', color: 'var(--sp-success-strong)' }
  if (estado === 'warn') return { texto: 'A vigilar',     background: 'var(--sp-warn-bg)',    color: 'var(--sp-warn)' }
  if (estado === 'bad')  return { texto: 'Fuera de rango', background: 'var(--sp-danger-bg)',  color: 'var(--sp-danger)' }
  return null
}

/** Chip neutro de categoría y de unidad. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--sp-r-btn-sm)] bg-[var(--sp-surface-muted)] px-[8px] py-[3px] text-[10.5px] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-500)]">
      {children}
    </span>
  )
}

interface Props {
  analito: AnalitoRastreado
  analitoCatalogo: AnalitoCatalogo | null
  mediciones: MedicionAnalito[]
  sexoPaciente: Sexo
  /**
   * El filtro de mediciones, que vive en la MISMA fila que la variación y el
   * estado. Llega como ranura y no se construye aquí: el filtro es estado de la
   * sección —gobierna la gráfica y la tabla— y esta cabecera solo le presta su
   * sitio. El mockup los pone juntos porque se leen juntos.
   *
   * ⚠️ SIN TIPO CONCRETO A PROPÓSITO. Se llamaba `filtroTemporal` y era el
   * selector de ventanas de tiempo; al cambiar el eje a «últimas N mediciones»
   * el nombre habría quedado mintiendo. Como ranura, esta cabecera no tiene que
   * enterarse de qué filtra.
   */
  filtro?: React.ReactNode
}

export default function AnalitoDetailHeader({ analito, analitoCatalogo, mediciones, sexoPaciente, filtro }: Props) {
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

  const estado = chipEstado(statusOf(Number(info.actual.valor), analitoCatalogo, sexoPaciente))

  return (
    /* ⚠️ SIN MARCO PROPIO. Esta cabecera es la primera ZONA de la card única
       del detalle, no una card dentro de otra: el contenedor, su borde y su
       relleno los pone `SeccionMedicionesLabs`. Si le devuelves el borde,
       vuelven los compartimentos. */
    <div>
      <div className="flex flex-wrap items-start justify-between gap-[var(--sp-4)]">
        <div className="min-w-0 flex-1">
          {/* Nombre y, JUNTO A ÉL, los dos chips: categoría y unidad. */}
          <div className="flex flex-wrap items-center gap-[var(--sp-2)]">
            <h3 className="text-[length:var(--sp-fs-modal)] font-bold leading-tight text-[var(--sp-ink-800)]">
              {analito.nombre}
            </h3>
            <Chip>{labelCategoria(String(analito.categoria))}</Chip>
            <Chip>{analito.unidad || 'sin unidad'}</Chip>
            {analito.analitoId === null && <Chip>Custom</Chip>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-[var(--sp-1-5)]">
            <span className="text-[32px] font-extrabold leading-none tracking-[var(--sp-ls-tight)] tabular-nums text-[var(--sp-ink-900)]">
              {valorActualStr}
            </span>
            <span className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">{analito.unidad}</span>
          </div>
          <p className="mt-[var(--sp-1)] text-[11px] text-[var(--sp-ink-350)]">{fechaActualLarga}</p>
        </div>
      </div>

      {/* ⚠️ UNA SOLA FILA: variación, estado y filtro. Estaban en dos
          bloques y el filtro en una tercera fila aparte; los tres califican al
          mismo valor —cuánto se movió, si está en rango, en qué ventana se
          mira— y separarlos obligaba a recomponerlos con la vista. */}
      <div className="mt-[var(--sp-4)] flex flex-wrap items-center gap-x-[var(--sp-2-5)] gap-y-[var(--sp-2)] border-t border-[color:var(--sp-line-divider)] pt-[var(--sp-3-5)]">
        {hayDelta ? (
          <>
            <span
              className="inline-flex items-center gap-[var(--sp-1)] rounded-[var(--sp-r-btn-sm)] px-[8px] py-[4px] text-[length:var(--sp-fs-hint)] font-semibold tabular-nums"
              style={ESTILO_DELTA[color]}
            >
              <Icon size={12} />
              {signo}{formatValor(absDelta, precision)} {analito.unidad}
              <span className="opacity-70">({signo}{Math.abs(pct).toFixed(1)}%)</span>
            </span>
            <span className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">desde el inicio</span>
          </>
        ) : (
          <span className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">Primera medición registrada</span>
        )}

        {estado && (
          <span
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--sp-r-btn-sm)] px-[8px] py-[4px] text-[length:var(--sp-fs-hint)] font-semibold"
            style={{ background: estado.background, color: estado.color }}
          >
            {estado.texto}
          </span>
        )}

        {filtro && <div className="ml-auto min-w-0">{filtro}</div>}
      </div>
    </div>
  )
}
