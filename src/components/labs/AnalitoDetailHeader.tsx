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

/* Rediseño B7: la variación es texto con su flecha en el tono del estado, sin
   caja (CALMA §3); el color sólo cuando el catálogo dice qué lado es malo. */
const ESTILO_DELTA: Record<DeltaColor, string> = {
  'up-bad':    'text-mal-tinta',
  'up-good':   'text-ok-tinta',
  'down-bad':  'text-mal-tinta',
  'down-good': 'text-ok-tinta',
  'neutral':   'text-tinta2',
}

/** El chip de estado del último valor. Sin rango de referencia no se dibuja. */
function chipEstado(estado: AnalitoStatus): { texto: string; clase: string } | null {
  if (estado === 'ok')   return { texto: 'En rango',       clase: 'k-etq k-etq-ok' }
  if (estado === 'warn') return { texto: 'A vigilar',      clase: 'k-etq k-etq-aviso' }
  if (estado === 'bad')  return { texto: 'Fuera de rango', clase: 'k-etq k-etq-mal' }
  return null
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Nombre y, debajo, categoría y unidad como texto plano (CALMA §3);
              «Custom» es la única etiqueta. */}
          <h3 className="k-t-tarjeta">{analito.nombre}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-tinta2">
            {labelCategoria(String(analito.categoria))} · {analito.unidad || 'sin unidad'}
            {analito.analitoId === null && <span className="k-etq">Custom</span>}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="k-num text-[28px] font-bold leading-none tracking-[-0.4px] text-tinta">
              {valorActualStr}
            </span>
            <span className="text-[13px] text-tinta2">{analito.unidad}</span>
          </div>
          <p className="k-num mt-1 text-[13px] leading-[18px] text-tinta2">{fechaActualLarga}</p>
        </div>
      </div>

      {/* ⚠️ UNA SOLA FILA: variación, estado y filtro. Estaban en dos
          bloques y el filtro en una tercera fila aparte; los tres califican al
          mismo valor —cuánto se movió, si está en rango, en qué ventana se
          mira— y separarlos obligaba a recomponerlos con la vista. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
        {hayDelta ? (
          <>
            <span className={`k-num inline-flex items-center gap-1 text-[13px] font-semibold leading-[18px] ${ESTILO_DELTA[color]}`}>
              <Icon size={14} aria-hidden="true" />
              {signo}{formatValor(absDelta, precision)} {analito.unidad}
              <span className="font-normal">({signo}{Math.abs(pct).toFixed(1)}%)</span>
            </span>
            <span className="text-[13px] leading-[18px] text-tinta2">desde el inicio</span>
          </>
        ) : (
          <span className="text-[13px] leading-[18px] text-tinta2">Primera medición registrada</span>
        )}

        {estado && <span className={estado.clase}>{estado.texto}</span>}

        {filtro && <div className="ml-auto min-w-0">{filtro}</div>}
      </div>
    </div>
  )
}
