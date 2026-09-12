'use client'

import { memo, useMemo } from 'react'
import SelectorSegmentado, { type OpcionSegmentada } from '@/components/ui/SelectorSegmentado'

/**
 * Filtro de la card de mediciones: **las últimas N mediciones**.
 *
 * ⚠️ EL EJE YA NO ES TEMPORAL, Y POR ESO EL ARCHIVO CAMBIÓ DE NOMBRE. Se
 * llamaba `FiltroTemporal` y ofrecía ventanas de tiempo —1 mes, 3 meses, 1
 * año…—; en la práctica casi todos los rangos devolvían lo mismo y el control
 * no filtraba nada. Si ves `RangoTemporal` en algún sitio, es de aquella
 * versión.
 */

export type LimiteMediciones = '3' | '5' | '10' | 'todas'

/**
 * ⚠️ ESCALA FIJA, Y ESE ES EL PUNTO. Los números NO crecen con el historial:
 * «5» significa siempre las cinco últimas, tenga el paciente doce mediciones o
 * doscientas, así que el control significa lo mismo en todos los expedientes.
 *
 * ⚠️ NI 1 NI 2 ENTRAN, y no es un olvido: una gráfica de un punto no traza
 * tendencia y una de dos es una recta. El mínimo con el que filtrar dice algo
 * es tres.
 */
const ESCALA: readonly { valor: LimiteMediciones; n: number; rotulo: string }[] = [
  { valor: '3',  n: 3,  rotulo: '3' },
  { valor: '5',  n: 5,  rotulo: '5' },
  { valor: '10', n: 10, rotulo: '10' },
] as const

const TODAS: OpcionSegmentada<LimiteMediciones> = { valor: 'todas', rotulo: 'Todas' }

/**
 * Cuántas mediciones deja ver un límite. `slice` ya recorta solo si sobra, así
 * que un límite mayor que el total equivale a «todas» sin necesidad de
 * comprobarlo: es lo que hace que el filtro no pueda quedarse en un valor
 * imposible al borrar mediciones.
 */
export function recortar<T>(mediciones: T[], limite: LimiteMediciones): T[] {
  if (limite === 'todas') return mediciones
  return mediciones.slice(0, Number(limite))
}

interface Props {
  limite: LimiteMediciones
  /** Cuántas mediciones tiene el analito. Decide qué opciones existen. */
  total: number
  onChange: (l: LimiteMediciones) => void
}

function FiltroMedicionesBase({ limite, total, onChange }: Props) {
  const opciones = useMemo<OpcionSegmentada<LimiteMediciones>[]>(() => {
    /* Una opción solo se dibuja si el analito tiene MÁS mediciones que ese
       número: con 4 registros, «5» y «3» enseñarían lo mismo que «Todas» salvo
       «3», así que sale «3 · Todas». Con exactamente 3, ni eso — «3» y «Todas»
       serían el mismo recorte. */
    const vivas = ESCALA.filter(e => total > e.n).map(e => ({ valor: e.valor, rotulo: e.rotulo }))
    return vivas.length > 0 ? [...vivas, TODAS] : []
  }, [total])

  /* Con menos de dos opciones no hay nada que filtrar y la fila entera
     desaparece: un control que no puede cambiar nada es ruido. */
  if (opciones.length < 2) return null

  /* Si el valor activo dejó de existir —se borraron mediciones y su opción se
     retiró— la selección visual cae a «Todas», que es lo que el recorte hace de
     todos modos. */
  const valor = opciones.some(o => o.valor === limite) ? limite : 'todas'

  return (
    <SelectorSegmentado
      opciones={opciones}
      valor={valor}
      onChange={onChange}
      etiqueta="Últimas mediciones"
    />
  )
}

const FiltroMediciones = memo(FiltroMedicionesBase)
export default FiltroMediciones
