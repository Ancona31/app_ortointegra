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

function FilaDia({ dia, nombre, horario, alCambiar }: { dia: DiaSemana; nombre: string; horario: Horario; alCambiar: (h: Horario) => void }) {
  const id = useId()
  const d = horario[dia]
  const poner = (cambio: Partial<Horario[DiaSemana]>) => alCambiar({ ...horario, [dia]: { ...d, ...cambio } })
  const alReves = d.activo && d.inicio >= d.fin
  return (
    <div role="group" aria-label={nombre} className={`flex min-h-[68px] flex-wrap items-center gap-x-[16px] gap-y-[12px] rounded-[12px] px-[16px] py-[12px] ${d.activo
      ? 'bg-[var(--ag-primary-bg-faint)]' : 'bg-[var(--ag-surface-sunken)]'}`}>
      <div className="flex min-w-[160px] items-center gap-[14px]">
        <Interruptor encendido={d.activo} etiqueta={nombre} alCambiar={() => alCambiar(d.activo ? { ...horario, [dia]: { ...d, activo: false } } : prenderDia(horario, dia))} />
        <span className={`text-[15px] font-semibold ${d.activo ? 'text-[var(--ag-ink)]' : 'text-[var(--ag-muted)]'}`}>{nombre}</span>
      </div>
      {d.activo ? (
        <div className="flex flex-wrap items-center gap-[10px]">
          <label htmlFor={`${id}-e`} className="flex items-center gap-[6px] text-[14px] text-[var(--ag-text)]">Entras
            <input id={`${id}-e`} type="time" className={CAMPO_NUEVO} value={d.inicio} onChange={e => poner({ inicio: e.target.value })} />
          </label>
          <label htmlFor={`${id}-s`} className="flex items-center gap-[6px] text-[14px] text-[var(--ag-text)]">Sales
            <input id={`${id}-s`} type="time" className={CAMPO_NUEVO} value={d.fin} onChange={e => poner({ fin: e.target.value })} />
          </label>
          {alReves && <p role="alert" className={`${ERROR} basis-full`}>Sales antes de entrar: cambia una de las dos horas.</p>}
        </div>
      ) : (
        <span className="ml-auto text-[14px] italic text-[var(--ag-muted)]">Sin consulta</span>
      )}
    </div>
  )
}

export default function EditorDias({ horario, alCambiar, conInstruccion }: Props) {
  const ninguno = !DIAS.some(d => horario[d.key].activo)
  return (
    <div className="flex flex-col gap-[8px]">
      {conInstruccion && <p className="mb-[4px] mt-0 text-[14px] text-[var(--ag-text)]">Prende los días que vienes y pon a qué hora entras y sales.</p>}
      {DIAS.map(d => <FilaDia key={d.key} dia={d.key} nombre={d.label} horario={horario} alCambiar={alCambiar} />)}
      {ninguno && <p role="alert" className={ERROR}>Prende al menos un día.</p>}
    </div>
  )
}
