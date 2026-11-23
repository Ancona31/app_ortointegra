'use client'

/**
 * Paso 2 del funnel, «¿Cuánto dura tu consulta?» (tanda J, J5, punto 13;
 * maqueta `Main.dc.html`): 15/20/30/45/60/Otra, «Mi consulta dura [n]
 * minutos» con «Otra», y la línea de cuántas consultas caben en el primer día
 * abierto. No guarda: lo guarda «Continuar» (`PrimeraVez`).
 */
import { useId } from 'react'
import { CalendarDays } from 'lucide-react'
import { AYUDA, CABECERA_PASO, CAMPO_NUEVO, opcion, SECCION_PASO, SUB_PASO, SUPERFICIE, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'
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
    <section className={SECCION_PASO} aria-labelledby="primera-vez-titulo">
      <div className={CABECERA_PASO}>
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>¿Cuánto dura tu consulta?</h1>
        <p className={SUB_PASO}>Con esto sabemos cuántas citas caben en tu día.</p>
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className={SUPERFICIE}>
          <div className="grid grid-cols-3 gap-[8px] py-[16px]">
            {DURACIONES.map(d => (
              <button key={d} type="button" aria-pressed={!eleccion.otra && eleccion.minutos === d} className={opcion(!eleccion.otra && eleccion.minutos === d)}
                onClick={() => alCambiar({ ...eleccion, minutos: d, otra: false })}>{d} min</button>
            ))}
            <button type="button" aria-pressed={eleccion.otra} className={opcion(eleccion.otra)} onClick={() => alCambiar({ ...eleccion, otra: true })}>Otra</button>
          </div>
          {eleccion.otra && (
            <label htmlFor={`${id}-o`} className="flex flex-wrap items-center gap-[8px] pb-[16px] text-[15px] leading-[20px] text-tinta">Mi consulta dura
              <input id={`${id}-o`} type="number" inputMode="numeric" min={5} max={240} step={5} className={`${CAMPO_NUEVO} agc-num w-[76px]`}
                value={eleccion.texto} onChange={e => alCambiar({ ...eleccion, texto: e.target.value })} />
              minutos</label>
          )}
          {cabe && (
            <div className="flex items-start gap-[12px] border-t border-linea py-[14px] text-[15px] leading-[22px] text-tinta">
              <CalendarDays size={20} className="mt-[1px] flex-none text-enlace" aria-hidden="true" />
              <span>En un día de {cabe.desde} a {cabe.hasta} te caben <strong className="font-semibold">{cabe.cuantas} consultas</strong> de {minutos} minutos.</span>
            </div>
          )}
        </div>
        <p className={`m-0 px-[4px] ${AYUDA}`}>Si en algún consultorio dura distinto, lo cambias después en Configuración.</p>
      </div>
    </section>
  )
}
