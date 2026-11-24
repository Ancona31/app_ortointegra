'use client'

/**
 * El control de días y horas de las maquetas (tanda J, J5): una fila por día
 * con su interruptor, «Entras» y «Sales», o «Sin consulta». Lo usan el paso 1
 * del funnel, el diálogo del horario de un consultorio y el del horario de la
 * clínica (punto 15: «el mismo control»).
 *
 * Como la maqueta, prender un día copia las horas del día prendido anterior.
 * Además de «Prende al menos un día.», avisa de un día que sale antes de
 * entrar: el servidor lo rechaza (`horarioEnOrden`) y así se ve antes.
 *
 * ⚠️ UN SOLO TURNO POR DÍA: es lo que guarda el modelo (`Horario`). El doble
 * turno no existe hoy en los datos (notas de J5, punto 17).
 */
import { useId } from 'react'
import Interruptor from '@/components/agenda/configuracion/Interruptor'
import { CAMPO_NUEVO, ERROR } from '@/components/agenda/configuracion/estilosConfig'
import { DIAS } from '@/lib/agenda/horarioAgenda'
import type { DiaSemana, Horario } from '@/lib/configApp'

/** ¿Se puede guardar? Al menos un día prendido y, en cada uno, la salida después de la entrada. */
export function horarioGuardable(h: Horario): boolean {
  const abiertos = DIAS.filter(d => h[d.key].activo)
  return abiertos.length > 0 && abiertos.every(d => h[d.key].inicio < h[d.key].fin)
}

/** Prender un día copia las horas del prendido anterior (la maqueta). */
export function prenderDia(h: Horario, dia: DiaSemana): Horario {
  const i = DIAS.findIndex(d => d.key === dia)
  const previo = DIAS.slice(0, i).reverse().map(d => h[d.key]).find(d => d.activo)
  return { ...h, [dia]: previo ? { activo: true, inicio: previo.inicio, fin: previo.fin } : { ...h[dia], activo: true } }
}

interface Props {
  horario: Horario
  alCambiar: (h: Horario) => void
  /** La frase de arriba («Prende los días…»): la tiene el funnel, no el diálogo. */
  conInstruccion?: boolean
}

/** Un día (maqueta `ag-pv`, editor de días): interruptor · nombre · «Entras» y «Sales», o «Sin consulta». En el
    teléfono las horas bajan a una segunda línea; en ancho van a la derecha, en la misma fila. */
function FilaDia({ dia, nombre, horario, alCambiar }: { dia: DiaSemana; nombre: string; horario: Horario; alCambiar: (h: Horario) => void }) {
  const id = useId()
  const d = horario[dia]
  const poner = (cambio: Partial<Horario[DiaSemana]>) => alCambiar({ ...horario, [dia]: { ...d, ...cambio } })
  const alReves = d.activo && d.inicio >= d.fin
  return (
    <div role="group" aria-label={nombre} className="flex flex-wrap items-center gap-x-[16px] gap-y-[6px] border-t border-linea py-[10px] first:border-t-0 [p+&]:border-t-0 esc:py-[8px]">
      <div className="flex min-h-[44px] min-w-[160px] flex-1 items-center gap-[12px] esc:min-h-[36px]">
        <Interruptor encendido={d.activo} etiqueta={nombre} alCambiar={() => alCambiar(d.activo ? { ...horario, [dia]: { ...d, activo: false } } : prenderDia(horario, dia))} />
        <span className={`text-[15px] leading-[20px] ${d.activo ? 'font-semibold text-tinta' : 'text-tinta2'}`}>{nombre}</span>
      </div>
      {d.activo ? (
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-[8px]">
          <label htmlFor={`${id}-e`} className="flex items-center gap-[8px] text-[14px] leading-[20px] text-tinta2">Entras
            <input id={`${id}-e`} type="time" className={`${CAMPO_NUEVO} w-auto tabular-nums`} value={d.inicio} onChange={e => poner({ inicio: e.target.value })} />
          </label>
          <label htmlFor={`${id}-s`} className="flex items-center gap-[8px] text-[14px] leading-[20px] text-tinta2">Sales
            <input id={`${id}-s`} type="time" aria-invalid={alReves || undefined} className={`${CAMPO_NUEVO} w-auto tabular-nums`} value={d.fin} onChange={e => poner({ fin: e.target.value })} />
          </label>
        </div>
      ) : (
        <span className="ml-auto text-[15px] leading-[20px] text-tinta3">Sin consulta</span>
      )}
      {alReves && <p role="alert" className={`${ERROR} basis-full`}>Sales antes de entrar: cambia una de las dos horas.</p>}
    </div>
  )
}

export default function EditorDias({ horario, alCambiar, conInstruccion }: Props) {
  const ninguno = !DIAS.some(d => horario[d.key].activo)
  return (
    <div className="flex flex-col">
      {conInstruccion && <p className="m-0 pb-[6px] pt-[4px] text-[15px] leading-[21px] text-tinta">Prende los días que vienes y pon a qué hora entras y sales.</p>}
      {DIAS.map(d => <FilaDia key={d.key} dia={d.key} nombre={d.label} horario={horario} alCambiar={alCambiar} />)}
      {ninguno && <p role="alert" className={`${ERROR} pt-[8px]`}>Prende al menos un día.</p>}
    </div>
  )
}
