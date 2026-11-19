'use client'

/**
 * Paso de la clínica del funnel de primera vez (K3, punto 12 de Angel): el
 * PRIMERO, y sólo para el médico administrador. El horario de la clínica con
 * el mismo control de días (`EditorDias`) y su huso horario (`SelectorHuso`).
 * No guarda: lo guarda «Continuar» (`PrimeraVez`, `PUT /api/me/horario`).
 */
import EditorDias from '@/components/agenda/configuracion/EditorDias'
import SelectorHuso from '@/components/agenda/configuracion/SelectorHuso'
import { SUB_PASO, TARJETA, TITULO_PASO } from '@/components/agenda/configuracion/estilosConfig'
import type { Horario } from '@/lib/configApp'

export interface EleccionClinica { horario: Horario; huso: string }

export default function PasoClinica({ eleccion, alCambiar }: { eleccion: EleccionClinica; alCambiar: (e: EleccionClinica) => void }) {
  return (
    <section className="flex flex-col gap-[20px] sm:gap-[16px]" aria-labelledby="primera-vez-titulo">
      <div className="flex flex-col gap-[8px]">
        <h1 id="primera-vez-titulo" className={TITULO_PASO}>Horario de la clínica</h1>
        <p className={SUB_PASO}>
          Este horario se usará de fábrica en todos los consultorios que se creen. También puedes cambiar el horario y la ubicación de cada consultorio.
        </p>
      </div>
      <div className={`${TARJETA} gap-[18px] sm:gap-[16px]`}>
        <EditorDias horario={eleccion.horario} alCambiar={horario => alCambiar({ ...eleccion, horario })} />
        <SelectorHuso valor={eleccion.huso} alCambiar={huso => alCambiar({ ...eleccion, huso })} />
      </div>
    </section>
  )
}
