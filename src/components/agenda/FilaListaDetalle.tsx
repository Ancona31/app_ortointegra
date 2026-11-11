/**
 * src/components/agenda/FilaListaDetalle.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo } from 'react'
import type { IconoEvento } from '@/lib/appointments'
import type { Status } from '@/lib/agenda/tiposAgenda'
import { STATUS_CONFIG } from '@/lib/agenda/tarjetasAgenda'
import { GoogleGIcon } from './GoogleGIcon'
import { IconoDelEvento } from './IconoDelEvento'

/* El glifo de cada estado en la píldora de `listDay`. Sale del mockup, que dibuja
   cuatro de los cinco; el de «cancelada» —la ✕— no lo dibuja porque su fila de
   ejemplo no aparece, así que lo elige esta línea y es lo único de la píldora
   que no viene de allí.
   ⚠️ VAN CON `aria-hidden`: son adorno, y quien nombra el estado es la etiqueta
   de al lado. Un lector de pantalla que leyera «punto Agendada» diría de más. */
const GLIFO_PILDORA: Record<Status, string> = {
  scheduled: '●', confirmed: '●', attended: '✓', no_show: '—', cancelled: '✕',
}

/* La fila ANCHA, sólo de `listDay`. Cuatro renglones: nombre · duración ·
   motivo · píldora, con la marca a la izquierda.

   ⚠️ ES UN COMPONENTE APARTE Y NO UNA RAMA DE `FilaLista`, a propósito. Son dos
   ÁRBOLES distintos —éste tiene envoltorio de cuerpo y tres hijos que el
   compacto no monta—, no dos hojas de estilo del mismo markup. Y separarlos es
   lo que garantiza que `listWeek` no se entere de este paso: su componente no se
   ha tocado. Si algún día se fusionan, el que hay que volver a mirar es el
   compacto.

   ⚠️ LA DURACIÓN VA EN SU PROPIO RENGLÓN Y NO BAJO LA HORA, que es donde la pone
   el mockup. Dos motivos, y el segundo es el que decide: la columna de la hora la
   compone el plugin y para un evento CON HORA no pasa por ningún generador de
   contenido (`@fullcalendar/list/internal.js:103`), así que ahí no se puede
   inyectar nada; y compartiendo línea con el nombre, un paciente de nombre largo
   se la comería. Renglón propio y no se discute.

   ⚠️ EL MOTIVO SON LAS NOTAS Y NADA MÁS. Sin notas no hay renglón. El mockup
   escribe «Google Calendar · solo lectura» en esa línea para los de Google; aquí
   NO se compone: sería un respaldo inventado, y es el mismo respaldo que se
   revocó en la tarjeta de la rejilla (ver el aviso de `descriptor` en
   `MemoizedEventContent`). No lo repongas. */
export const FilaListaDetalle = memo(function FilaListaDetalle(
  { nombre, esDeGoogle, icono, cancelada, duracion, motivo, status, esEvento }: {
    nombre: string; esDeGoogle: boolean; icono: IconoEvento | null
    cancelada: boolean; duracion: string | null; motivo: string | null
    status: Status | undefined; esEvento: boolean
  },
) {
  /* ⚠️ EL COLOR NO SE CALCULA AQUÍ Y NO ES UN OLVIDO: sale de `--ag-ev-marca`,
     la variable que `clasesDelEvento` ya declara en el `<tr>` de la fila y que
     baja por herencia hasta aquí. Es la MISMA que pinta el punto del compacto,
     así que las dos variantes no pueden divergir de color. */
  const marca = esDeGoogle
    ? <span className="ag-listadia-slot"><GoogleGIcon size={19} /></span>
    : icono
      ? <span className="ag-listadia-slot"><IconoDelEvento nombre={icono} size={21} color="var(--ag-ev-marca)" /></span>
      : <span className="ag-listadia-punto" />
  return (
    <span className="ag-listadia">
      {marca}
      <span className="ag-listadia-cuerpo">
        <span className={cancelada ? 'ag-listadia-nombre ag-listadia-nombre--cancelada' : 'ag-listadia-nombre'}>
          {nombre}
        </span>
        {duracion && <span className="ag-listadia-dur">{duracion}</span>}
        {motivo && <span className="ag-listadia-meta">{motivo}</span>}
        {/* La píldora de ESTADO es de las citas. Un evento genérico sí tiene
            estado en este producto —`ESTADOS_EVENTO`, dos de los cinco— pero
            aquí no se pinta, y eso NO reabre el bug de la píldora de la rejilla
            (ver su aviso en globals.css): allí el problema era que la píldora se
            encendía por CATEGORÍA mientras la misma información salía como texto
            en la otra, o sea dos formas del mismo dato en la misma columna. Aquí
            no hay texto de estado en ninguna fila, así que no hay asimetría que
            crear; y la única de las dos que importa de un vistazo —cancelada—
            sigue diciéndose con el tachado del nombre. */}
        {status && !esEvento && !esDeGoogle && (
          <span className="ag-listadia-pildora">
            <span aria-hidden="true">{GLIFO_PILDORA[status]}</span>
            {STATUS_CONFIG[status].label}
          </span>
        )}
        {/* Mismo texto que el badge de `MonthChip` y el de `GoogleEventCard`, y
            tiene que serlo: los tres nombran lo mismo y la agenda no puede decir
            dos cosas distintas del mismo evento según la vista. */}
        {esDeGoogle && <span className="ag-listadia-pildora ag-listadia-pildora--gcal">Evento</span>}
      </span>
    </span>
  )
})
