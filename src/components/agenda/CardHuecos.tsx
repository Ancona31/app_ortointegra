'use client'

import { type ReactElement } from 'react'
import { Calendar } from 'lucide-react'
import {
  type Tramo, HUECO_MINIMO, etiquetaDeRango, etiquetaDeDuracion,
  type ResumenDia,
} from '@/lib/agenda/huecosAgenda'

/* La tarjeta NO se oculta cuando no hay huecos, y es deliberado (§8.4): una
   card que desaparece se lee como un fallo de carga. Lo que cambia es el
   contenido, y el texto dice cuál de los dos motivos es. */
/* ⚠️⚠️ CON LA TRAÍDA RECORTADA NO SE PINTA NINGÚN HUECO, Y ESTO ES EL ARREGLO,
   NO UNA CAUTELA DE MÁS. Un hueco de aquí NO es un dato: es un BOTÓN que llama a
   `abrirHueco` → `api.select()` → el alta. Calculado sobre un día al que le
   faltan citas, el complemento de la ocupación incluye las horas de las citas
   que no llegaron, así que el panel ofrecía —comprobado el 2026-08-30 sobre el
   lunes 24— un hueco de 11:00 a 20:00 con una paciente dentro de 11:00 a 12:00.
   Pulsarlo abría el alta encima de ella. Es el daño exacto del que avisa la
   banda roja, servido por la tarjeta de al lado.

   ⚠️ Y NO VALE PINTARLOS «SÓLO INFORMATIVOS», sin `onClick`. Se verían igual que
   los de siempre, en el mismo sitio y con la misma forma, y el médico que ya
   sabe que ahí se pulsa no lee la diferencia: se convierte en un botón que no
   responde, que es peor que uno que responde mal. O son huecos de verdad o no
   hay huecos.

   La tarjeta NO desaparece, por la misma razón que ya está escrita abajo: una
   card que se va se lee como un fallo de carga. Lo que cambia es el contenido, y
   toma el MISMO camino visual que el consultorio cerrado. */
export function CardHuecos(
  { resumen, onHueco, incompleto }: {
    resumen: ResumenDia | null
    onHueco: (t: Tramo) => void
    /** La traída vino recortada: no hay huecos que ofrecer, sólo el motivo. */
    incompleto: boolean
  },
): ReactElement {
  const jornada = resumen?.jornada ?? null
  const huecos = incompleto ? [] : (resumen?.huecos ?? [])
  return (
    <section className="ag-panelcard" aria-label="Huecos disponibles">
      <h2 className="ag-panelcard-tit">Huecos disponibles</h2>
      {huecos.length > 0 ? (
        <div className="ag-huecos">
          {huecos.map(h => (
            <button
              key={`${h.desde}-${h.hasta}`}
              type="button"
              className="ag-hueco"
              onClick={() => onHueco(h)}
            >
              <span className="ag-hueco-rango">{etiquetaDeRango(h)}</span>
              <span className="ag-hueco-dur">{etiquetaDeDuracion(h.hasta - h.desde)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="ag-panelcard-vacio">
          <Calendar size={22} aria-hidden />
          {/* El recorte manda sobre los otros dos motivos: mientras falten
              citas no se sabe si el día está completo ni si queda algo libre,
              así que ninguna de las dos frases de abajo sería cierta. */}
          {incompleto
            ? 'Faltan citas por cargar · No se pueden calcular los huecos de este día'
            : jornada
              ? `Día completo · No queda ningún tramo de ${HUECO_MINIMO} min libre entre ${etiquetaDeRango(jornada)}`
              : 'Consultorio cerrado · No hay horario de consulta este día'}
        </p>
      )}
    </section>
  )
}
