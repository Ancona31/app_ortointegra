/**
 * src/components/agenda/BandaChip.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import { memo } from 'react'
import type { IconoEvento, ColorEvento } from '@/lib/appointments'
import type { Status } from '@/lib/agenda/tiposAgenda'
import { tintasDelChipDeBanda } from '@/lib/agenda/tarjetasAgenda'
import { GoogleGIcon } from './GoogleGIcon'
import { IconoDelEvento } from './IconoDelEvento'

/* ══════════════════════════════════════════════════════════════════════
   CHIP DE LA BANDA DE TODO EL DÍA (`.ag-banda`) — bloque 5
   ══════════════════════════════════════════════════════════════════════
   La tarjeta de la fila de todo el día de Semana y Día, que existe desde que
   `allDaySlot` pasó a `true`. Es la CUARTA caja de la agenda, detrás de
   `.ag-tarjeta` (cita), `.ag-gcal` (evento de Google con hora) y `.ag-mes`.

   ⚠️ NO REUSA `.ag-gcal` NI `.ag-tarjeta`, Y NO ES POR GUSTO. Las dos llevan
   `height: 100%` para llenar su harness de la rejilla horaria, que tiene alto
   propio; el harness de la banda NO lo tiene —crece con su contenido—, así que
   ahí un `height: 100%` resuelve a `auto` y la caja colapsa. Y el sistema de
   tiers de `.ag-tarjeta` (`pisoFranja`, `umbralTiny`, `umbralCompact`) está
   calibrado sobre ALTURA DE FRANJA, que en la banda no significa nada: aquí
   todos los chips miden lo mismo, 20 px, sea el evento de un día o de quince.

   ⚠️ SU FONDO VA EN ESTE `<div>` Y NUNCA EN EL `<a>` RAÍZ, igual que en las
   otras tres. El `<a>` es el harness que `globals.css` fuerza a transparente
   con `!important` (`.fc .fc-event`), y las tres fuentes le pasan además
   `backgroundColor: 'transparent'`. Pintar ahí es cómo se rompe el harness.

   ⚠️ SÓLO EL TÍTULO, SIN UBICACIÓN, y está comprobado: la lista blanca del
   servidor (`EventoAgenda` en `/api/google/events:24-29`) son cuatro campos
   —`id`, `summary`, `start`, `end`— y `location` no viaja. El «Star Médica ·
   quirófano 2» del mockup NO es un campo de sede: es texto escrito a mano en
   `notes`, y eso ya está dicho y revocado en el docstring de
   `MemoizedEventContent`. No compongas un « · algo » que no tienes.

   ── EL HUECO DEL MARCADOR TIENE DOS INQUILINOS, Y SÓLO CABE UNO ────────────
   La banda tuvo un único origen posible —Google— y por eso este hueco fue
   durante un tiempo sólo la «G». Dejó de serlo cuando los eventos PROPIOS de
   todo el día empezaron a caer aquí (bloque 5B): un evento con icono asignado
   salía pelado en la banda mientras la rejilla y el mes sí lo enseñaban.

   Ahora el hueco lo ocupa, por este orden:
     · la «G» si la fila viene de Google, y
     · el icono del evento si el médico le puso uno.
   Sin icono y sin ser de Google no se pinta nada, y el título empieza pegado al
   borde: es el caso de un evento propio al que nadie le eligió pinta, y
   rellenarlo con un glifo por omisión sería inventarse un dato.

   LA «G» GANA, y es el mismo desempate que `MonthChip` («la G de Google gana a
   todo: es una marca»). Hoy no hay empate posible —los eventos de Google no
   traen `icono`, no son filas de `appointments`— así que el orden es una
   política escrita, no una rama que se ejecute.

   EL ICONO SE RESUELVE COMO EN LAS OTRAS DOS TARJETAS y no de una segunda
   forma: `IconoDelEvento` con el nombre que trae la fila, el mismo criterio de
   «sólo si lo hay», y el color del evento —`tinta`, de `tintasDelChipDeBanda`—
   igual que la tarjeta de la rejilla y el chip del mes. Ahí no hay problema de
   contraste: es objeto gráfico y le basta 3:1. El título es el que va en tinta
   neutra, y su porqué está medido en `MemoizedEventContent`.

   Lo único propio de aquí es el TAMAÑO: 14 px, el mismo que la «G» de este
   chip. Entra en los 18 px de contenido —20 menos los dos bordes— con 2 px de
   aire arriba y abajo, y ése es el techo: por encima de 14 la caja no crece
   (`height` es fijo) pero el `overflow: hidden` empezaría a recortar el glifo.

   ⚠️ LA «G» ES CONDICIONAL, Y NO POR SIMETRÍA CON LAS OTRAS TARJETAS. Se pintaba
   siempre, con este argumento: «el único origen de un `allDay` es Google, así
   que la marca sobra comprobarla». Eso es cierto del evento EN REPOSO y falso
   del ESPEJO DEL ARRASTRE: al arrastrar una cita de la rejilla hacia la banda,
   FullCalendar monta un `.fc-event-mirror` que pasa por `renderEventContent` con
   `allDay: true` —la mutación ya trae `forceAllDay`— aunque la fila sea una cita
   de un paciente. Con el icono incondicional, ese fantasma salía con la marca de
   Google encima de un dato que no es de Google, y la marca de un tercero no se
   pinta sobre lo que no le pertenece.
   El gesto termina revertido por `esGestoDeTodoElDia` (AG-DT-8), pero el
   fantasma se ve DURANTE el arrastre, que es antes de que nada revierta.
   El espejo tampoco trae icono ni color: sus `extendedProps` son los de una
   CITA, y una cita no tiene pinta. Lo que sí trae es `status`, así que el
   fantasma se viste con la paleta de SU ESTADO —la misma con la que se veía en
   la rejilla un segundo antes— en vez de con la de Google, que era lo que
   pasaba cuando la paleta vivía en la clase base. */
export const BandaChip = memo(function BandaChip(
  { title, esDeGoogle, icono, color, status }: {
    title: string; esDeGoogle: boolean; icono: IconoEvento | null
    color: ColorEvento | null; status: Status | undefined
  },
) {
  /* LA PINTA VA EN ESTE `<div>` Y NUNCA EN EL `<a>` RAÍZ, que es el harness
     transparente de `globals.css` (`.fc .fc-event`, con `!important`). Misma
     regla que las otras tres tarjetas.

     Y va EN LÍNEA porque ahora sí depende de un dato de la fila —el color que
     eligió el médico—, que es la misma razón por la que `.ag-tarjeta` y
     `.ag-mes` llevan el suyo en línea. Lo que queda en la clase es lo fijo: la
     caja, la tinta neutra del título y, en `.ag-banda--gcal`, la paleta de
     Google, que no depende de ninguna fila.

     `undefined` en cualquiera de las tres deja mandar a la clase, que es como
     el chip de Google se queda con la suya sin una rama aparte.

     NI EL GLIFO NI EL TÍTULO PUEDEN ESTIRAR LA CAJA: los 20 px son fijos, el
     glifo mide 14 sobre 18 de contenido útil —2 px de aire arriba y abajo— y
     `IconoDelEvento` ya trae `flex: 0 0 auto`. La separación es el `gap: 5px`
     de `.ag-banda`, el mismo que separaba la «G», así que el título sólo pierde
     ancho —se trunca antes, con su elipsis— y nunca alto. */
  const { fondo, marco, filo, tinta } = tintasDelChipDeBanda(esDeGoogle, color, status)
  return (
    <div
      className={`ag-banda${esDeGoogle ? ' ag-banda--gcal' : ''}`}
      style={{ background: fondo, borderColor: marco, borderLeftColor: filo }}
    >
      {esDeGoogle
        ? <GoogleGIcon size={14} />
        : icono && <IconoDelEvento nombre={icono} size={14} color={tinta} />}
      <span className="ag-banda-titulo">{title}</span>
    </div>
  )
})
