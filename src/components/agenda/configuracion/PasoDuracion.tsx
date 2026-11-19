'use client'

/**
 * Paso 2 del funnel, «¿Cuánto dura tu consulta?» (tanda J, J5, punto 13;
 * maqueta `Main.dc.html`): 15/20/30/45/60/Otra, «Mi consulta dura [n]
 * minutos» con «Otra», y la línea de cuántas consultas caben en el primer día
 * abierto. No guarda: lo guarda «Continuar» (`PrimeraVez`).
 */
import { useId } from 'react'
import { CalendarDays } from 'lucide-react'
import { CAMPO_NUEVO, opcion, SUB_PASO, TARJETA, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'
import { consultasQueCaben } from '@/lib/agenda/gruposHorario'
import type { Horario } from '@/lib/configApp'

export const DURACIONES = [15, 20, 30, 45, 60] as const

export interface EleccionDuracion { minutos: number; otra: boolean; texto: string }

/** Los minutos que valen: los de la rejilla o lo escrito en «Otra». */
export const minutosDe = (e: EleccionDuracion): number => (e.otra ? Number(e.texto) || 0 : e.minutos)

/** Lo que sale elegido al entrar: la duración que ya tiene (en «Otra» si no es de la rejilla) o 30. */
export function eleccionInicial(actual: number | null): EleccionDuracion {
  if (actual === null) return { minutos: 30, otra: false, texto: '25' }
  return DURACIONES.some(d => d === actual) ? { minutos: actual, otra: false, texto: '25' } : { minutos: actual, otra: true, texto: String(actual) }
}

interface Props { eleccion: EleccionDuracion; horarios: readonly Horario[]; alCambiar: (e: EleccionDuracion) => void }

export default function PasoDuracion({ eleccion, horarios, alCambiar }: Props) {
  const id = useId()
  const minutos = minutosDe(eleccion)
  const cabe = consultasQueCaben(horarios, minutos)
  return (
    <section className="flex flex-col gap-[20px] sm:gap-[16px]" aria-labelledby="primera-vez-titulo">
      <div className="flex flex-col gap-[8px]">
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>¿Cuánto dura tu consulta?</h1>
        <p className={SUB_PASO}>Con esto sabemos cuántas citas caben en tu día.</p>
      </div>
      <div className={`${TARJETA} gap-[16px] sm:gap-[14px]`}>
        <div className="grid grid-cols-3 gap-[10px]">
          {DURACIONES.map(d => (
            <button key={d} type="button" aria-pressed={!eleccion.otra && eleccion.minutos === d} className={opcion(!eleccion.otra && eleccion.minutos === d)}
              onClick={() => alCambiar({ ...eleccion, minutos: d, otra: false })}>{d} min</button>
          ))}
          <button type="button" aria-pressed={eleccion.otra} className={opcion(eleccion.otra)} onClick={() => alCambiar({ ...eleccion, otra: true })}>Otra</button>
        </div>
        {eleccion.otra && (
          <label htmlFor={`${id}-o`} className="flex items-center gap-[10px] text-[14px] text-[var(--ag-text)]">Mi consulta dura
            <input id={`${id}-o`} type="number" inputMode="numeric" min={5} max={240} step={5} className={`${CAMPO_NUEVO} w-[96px]`}
              value={eleccion.texto} onChange={e => alCambiar({ ...eleccion, texto: e.target.value })} />
            minutos</label>
        )}
        {cabe && (
          <div className="flex items-center gap-[12px] rounded-[12px] bg-[var(--ag-primary-bg-faint)] p-[16px] sm:p-[14px] text-[14px] leading-[1.5] text-[var(--ag-ink)]">
            <CalendarDays size={22} className="flex-none text-[var(--ag-brand-legible)]" aria-hidden="true" />
            <span>En un día de {cabe.desde} a {cabe.hasta} te caben <strong>{cabe.cuantas} consultas</strong> de {minutos} minutos.</span>
          </div>
        )}
      </div>
      <p className="m-0 text-[13.5px] sm:text-[13px] text-[var(--ag-ink-600)]">Si en algún consultorio dura distinto, lo cambias después en Configuración.</p>
    </section>
  )
}
