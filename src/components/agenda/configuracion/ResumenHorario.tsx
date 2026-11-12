/**
 * Un horario de siete días, en solo lectura: «Lunes 09:00 – 19:00», «Domingo
 * Cerrado». Lo usan el horario de la clínica y la disponibilidad de cada
 * consultorio en la pantalla de configuración del calendario.
 */
import { Fragment } from 'react'
import { DIAS } from '@/lib/agenda/horarioAgenda'
import type { Horario } from '@/lib/configApp'

export default function ResumenHorario({ horario }: { horario: Horario }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
      {DIAS.map(({ key, label }) => {
        const dia = horario[key]
        return (
          <Fragment key={key}>
            <dt className="text-[var(--ag-muted)]">{label}</dt>
            <dd className="text-[var(--ag-text)] tabular-nums">{dia?.activo ? `${dia.inicio} – ${dia.fin}` : 'Cerrado'}</dd>
          </Fragment>
        )
      })}
    </dl>
  )
}
