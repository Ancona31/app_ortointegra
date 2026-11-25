'use client'

import { type ReactElement } from 'react'
import { type ResumenDia, etiquetaDeHoras } from '@/lib/agenda/huecosAgenda'
import { TileResumen } from '@/components/agenda/TileResumen'
import { DesgloseEstados } from '@/components/agenda/DesgloseEstados'

/* ⚠️ UN GUIÓN Y NO UN CERO, y es una regla de §11, no una preferencia. Un `0`
   es un dato: dice «hoy no tienes nada ocupado». El guión dice «esto no se
   sabe», que es lo cierto mientras el horario no ha llegado, el consultorio no
   abre o el filtro está en «Todos los médicos». Enseñar `0:00` en cualquiera de
   esos tres casos sería inventarse una jornada vacía. */
const SIN_DATO = '—'

/* ⚠️⚠️ `incompleto` ES LA TERCERA RAZÓN POR LA QUE LAS HORAS PASAN A GUIÓN, Y ES
   LA QUE FALTABA. Las otras dos —«Todos los médicos» y el día cerrado— ya
   estaban; ésta no llegaba al panel, y era el único sitio de la agenda al que no
   llegaba. El resultado era que la banda roja avisaba de la rejilla mientras el
   panel de al lado seguía afirmando `1:00 h ocupadas · 10:00 h libres` sobre un
   día del que faltaba la mitad de las citas.

   ⚠️ POR QUÉ LAS HORAS SE APAGAN Y LOS CONTEOS NO. Un conteo recortado es un
   SUELO y se puede decir entero con un «≥»: hay ésas y puede haber más. Las
   horas no admiten ese trato en las dos direcciones a la vez —las ocupadas son
   un suelo, pero las LIBRES son un TECHO, y un techo presentado como dato
   invita a agendar—, así que la única lectura honesta es no darlas. Es
   exactamente lo que ya significa el guión: «esto no se sabe». Ver `SIN_DATO`.

   No estrena estado visual ninguno: reutiliza el camino que el panel recorre
   cuando el filtro está en «Todos los médicos». */
export function CardResumen(
  { titulo, citas, eventos, resumen, horasVisibles, incompleto }: {
    titulo: string
    citas: number
    eventos: number
    resumen: ResumenDia | null
    /** `false` en «Todos los médicos»: los dos tiles de horas pasan a guión. */
    horasVisibles: boolean
    /** La traída vino recortada. Los conteos se cualifican y las horas se apagan. */
    incompleto: boolean
  },
): ReactElement {
  const conHoras = horasVisibles && !incompleto && resumen?.jornada != null
  /* El «≥» y no «al menos», por la misma razón que en la banda breve: el número
     del tile es grande y comparte caja con su etiqueta. Un carácter dice lo
     mismo, y la nota de abajo lo explica con palabras. */
  const suelo = (n: number) => (incompleto ? `≥${n}` : String(n))
  return (
    <section className="ag-panelcard" aria-label={titulo}>
      <h2 className="ag-panelcard-tit">{titulo}</h2>
      <div className="ag-tiles">
        <TileResumen valor={suelo(citas)} etiqueta={citas === 1 ? 'cita' : 'citas'} />
        <TileResumen valor={suelo(eventos)} etiqueta={eventos === 1 ? 'evento' : 'eventos'} />
        <TileResumen valor={conHoras ? etiquetaDeHoras(resumen.ocupadas) : SIN_DATO} etiqueta="h ocupadas" />
        <TileResumen valor={conHoras ? etiquetaDeHoras(resumen.libres) : SIN_DATO} etiqueta="h libres" tono="primario" />
      </div>
      <DesgloseEstados filas={resumen?.porEstado ?? []} incompleto={incompleto} />
      {/* Va la PRIMERA de las notas: es la que explica por qué los cuatro
          números de arriba dejaron de ser los de siempre. */}
      {incompleto && (
        <p className="ag-panelcard-nota">
          Faltan citas por cargar: las horas y los huecos de este día no se pueden calcular.
        </p>
      )}
      {!horasVisibles && (
        <p className="ag-panelcard-nota">Elige un médico para ver las horas y los huecos.</p>
      )}
      {/* `!incompleto`: con la traída recortada el guión de las horas lo explica
          la nota de arriba, y dos notas seguidas dando motivos distintos para el
          mismo guión se leen como una contradicción. */}
      {horasVisibles && !incompleto && resumen && resumen.jornada == null && (
        <p className="ag-panelcard-nota">Sin horario de consulta este día.</p>
      )}
      {/* Los de todo el día no dan horas y eso, sin decirlo, se lee como un
          error: la banda de arriba enseña una guardia de 24 h y el panel sigue
          ofreciendo huecos. La línea es la explicación. */}
      {horasVisibles && resumen && resumen.todoElDia > 0 && (
        <p className="ag-panelcard-nota">
          {resumen.todoElDia === 1
            ? '1 evento de todo el día, que no ocupa horas.'
            : `${resumen.todoElDia} eventos de todo el día, que no ocupan horas.`}
        </p>
      )}
    </section>
  )
}
