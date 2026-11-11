'use client'

import { type ReactElement } from 'react'
import { type Tramo, type ResumenDia } from '@/lib/agenda/huecosAgenda'
import { CardResumen } from '@/components/agenda/CardResumen'
import { CardHuecos } from '@/components/agenda/CardHuecos'

/* ═══ BLOQUE 8 · EL PANEL LATERAL DE LA VISTA DÍA ══════════════════════════
   Dos tarjetas a la derecha de la rejilla, SÓLO en `timeGridDay` y SÓLO en
   escritorio. El montaje lo decide el tipo de vista que reporta FullCalendar,
   nunca un media query (SPEC_AGENDA §8.2).

   ⚠️ LAS REGLAS DE OCUPACIÓN DE AQUÍ CORRIGEN AL SPEC, Y LA DIFERENCIA IMPORTA.
   §8.3 y la tabla de §8.4 dicen que ni «cancelada» ni «no asistió» restan hueco.
   La decisión de producto es otra y es la que manda:

     · `cancelled` NO ocupa — el tramo queda libre y es el caso de negocio que
       crea huecos: alguien canceló, ¿qué me queda?
     · `no_show` SÍ ocupa — el paciente no vino, pero la hora se consumió y
       ofrecerla como libre sería ofrecer una hora que ya pasó.
     · Eventos de Google CON HORA ocupan, visibles u ocultos. Hoy no hay
       interruptor de visibilidad, así que la segunda mitad de esa frase no
       tiene todavía a qué aplicarse; se deja escrita porque el día que exista,
       ocultar no debe liberar.
     · Los de TODO EL DÍA no dan horas, ni de Google ni propios. Una guardia
       hospitalaria de 24 h no deja el día sin huecos.
     · Los eventos propios con hora ocupan.

   Si alguien vuelve al spec y ve la contradicción: la que vale es ésta. */

/**
 * El panel entero.
 *
 * ⚠️ LA TARJETA DE HUECOS NO SALE CON EL FILTRO EN «TODOS LOS MÉDICOS», y no es
 * un recorte de funciones: con varios médicos un hueco de uno es hora ocupada
 * de otro, así que CUALQUIER número sería mentira. Los conteos de citas y
 * eventos sí valen agregados —son cosas que existen, se sumen como se sumen—;
 * las horas y los huecos no, y por eso los tiles de horas pasan a guión por el
 * mismo camino (`horasVisibles`). Ver la nota de `SIN_DATO`.
 */
export function PanelDia(
  { titulo, citas, eventos, resumen, unMedico, onHueco, incompleto }: {
    titulo: string
    citas: number
    eventos: number
    resumen: ResumenDia | null
    unMedico: boolean
    onHueco: (t: Tramo) => void
    /** `citasIncompletas` de la página. Ver las cabeceras de las dos tarjetas. */
    incompleto: boolean
  },
): ReactElement {
  return (
    <aside className="ag-dia-aside">
      <CardResumen
        titulo={titulo}
        citas={citas}
        eventos={eventos}
        resumen={resumen}
        horasVisibles={unMedico}
        incompleto={incompleto}
      />
      {unMedico && <CardHuecos resumen={resumen} onHueco={onHueco} incompleto={incompleto} />}
    </aside>
  )
}
