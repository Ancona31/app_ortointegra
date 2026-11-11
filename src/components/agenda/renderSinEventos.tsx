'use client'

import type { NoEventsContentArg } from '@fullcalendar/list'

/* El estado vacío de las listas.
   Una rejilla vacía sigue siendo una rejilla —se ven las horas, hay dónde
   pulsar— y por eso las de tiempo no llevan nada de esto. Una lista sin filas no
   es nada: sin este texto sale un hueco blanco que se lee como un fallo de
   carga.

   ⚠️ A NIVEL DE MÓDULO POR LA REGLA DE IDENTIDAD ESTABLE, como las fuentes y los
   otros renderizadores. Una función declarada en el JSX sería nueva en cada
   render y FullCalendar vuelve a refinar sus opciones cuando la referencia
   cambia.

   ⚠️ DEVUELVE UNA CADENA PELADA, SIN MARCADO. La caja ya la pone el plugin
   (`.fc-list-empty` con su `.fc-list-empty-cushion` dentro), y aquí no hay ni
   icono ni botón A PROPÓSITO: eso se decide viendo la pantalla, no antes.
   Mismo trato que la rama de Mes en `renderDayHeader`, que también devuelve
   texto.

   El `arg.text` del final es el `noEventsText` del locale —«No hay eventos para
   mostrar»— y cubre a cualquier vista de lista que se monte sin pasar por aquí:
   es peor texto que los dos de arriba, pero es texto. */
export function renderSinEventos(arg: NoEventsContentArg): string {
  if (arg.view.type === 'listDay')  return 'Sin citas este día'
  if (arg.view.type === 'listWeek') return 'Sin citas esta semana'
  return arg.text
}
