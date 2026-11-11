'use client'

import { type ReactElement } from 'react'
import type { Status } from '@/lib/agenda/tiposAgenda'

/** Las formas contadas de cada estado: «2 agendadas», «1 no asistió».
 *
 *  ⚠️ ES UNA SEGUNDA REDACCIÓN DE `STATUS_CONFIG`, y aquí sí hace falta. Aquél
 *  guarda la etiqueta suelta y capitalizada que pinta la leyenda y el selector
 *  («Agendada»); esto guarda la forma que va detrás de un número, en minúscula
 *  y con plural propio. No se puede derivar con un sufijo: «No asistió» en
 *  plural es «no asistieron», no «no asistiós». */
const ESTADO_CONTADO: Record<Status, { uno: string; varios: string }> = {
  scheduled: { uno: 'agendada',   varios: 'agendadas'     },
  confirmed: { uno: 'confirmada', varios: 'confirmadas'   },
  cancelled: { uno: 'cancelada',  varios: 'canceladas'    },
  no_show:   { uno: 'no asistió', varios: 'no asistieron' },
  attended:  { uno: 'atendida',   varios: 'atendidas'     },
}

/* El desglose por estado. Fuera de `CardResumen` porque es la costura natural
   de la tarjeta —arriba los cuatro números, abajo el detalle— y porque juntas
   pasaban de 50 líneas.

   ⚠️ LOS ESTADOS CON CERO NO SE LISTAN, y los filtra `desgloseDeEstados` antes
   de llegar aquí: esto es un RESUMEN, no una tabla (§8.3). Es justo lo
   contrario que la leyenda de la tarjeta del calendario, que sí pinta los cinco
   siempre — allí explica una escala, aquí cuenta lo que hay. */
export function DesgloseEstados(
  { filas, incompleto }: { filas: readonly { estado: Status; n: number }[]; incompleto: boolean },
): ReactElement | null {
  if (filas.length === 0) return null
  return (
    <ul className="ag-desglose">
      {filas.map(({ estado, n }) => (
        <li key={estado} className="ag-desglose-fila">
          {/* UN token y un solo color, `-dot`: el mismo que la tarjeta pinta en
              su `borderLeft` y el mismo que la leyenda. Nunca un hex. */}
          <span className="ag-desglose-punto" style={{ backgroundColor: `var(--ag-status-${estado}-dot)` }} />
          {/* El mismo «≥» del subtítulo breve, y por el mismo motivo: con la
              traída recortada esto deja de contar el día y pasa a ser un SUELO.
              «1 agendada» sobre un conjunto incompleto es falso; «≥ 1 agendada»
              es lo único que cabe afirmar. */}
          <span>{incompleto ? '≥ ' : ''}{n} {n === 1 ? ESTADO_CONTADO[estado].uno : ESTADO_CONTADO[estado].varios}</span>
        </li>
      ))}
    </ul>
  )
}
