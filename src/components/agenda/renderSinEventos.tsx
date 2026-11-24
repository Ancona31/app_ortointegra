'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
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

   ⚠️ DEVUELVE UNA CADENA PELADA, SIN MARCADO (salvo el enlace de B13 · AG10, abajo). La caja ya la pone el plugin
   (`.fc-list-empty` con su `.fc-list-empty-cushion` dentro), y aquí no hay ni
   icono ni botón A PROPÓSITO: eso se decide viendo la pantalla, no antes.
   Mismo trato que la rama de Mes en `renderDayHeader`, que también devuelve
   texto.

   El `arg.text` del final es el `noEventsText` del locale —«No hay eventos para
   mostrar»— y cubre a cualquier vista de lista que se monte sin pasar por aquí:
   es peor texto que los dos de arriba, pero es texto. */
/* B13 · AG10 (CALMA §29.12, línea de CONFIGURACIÓN; el resto del archivo es de la línea de vistas): la lista
   vacía ofrece además un enlace a «Configuración de la agenda». Esa página sólo existe con la v2 encendida, así
   que el enlace nace OCULTO y sólo lo enseña la raíz v2 (`.agc-vacio-config` en `globals.css`, bloque
   `ag-config`): la función sigue sin saber del interruptor y conserva su identidad estable. El texto de siempre
   va primero y sin cambiar. */
function conEnlace(texto: string): ReactNode {
  return (
    <>
      {texto}
      <Link href="/agenda/configuracion" className="agc-vacio-config">Configuración de la agenda</Link>
    </>
  )
}

export function renderSinEventos(arg: NoEventsContentArg): ReactNode {
  if (arg.view.type === 'listDay')  return conEnlace('Sin citas este día')
  if (arg.view.type === 'listWeek') return conEnlace('Sin citas esta semana')
  return arg.text
}
