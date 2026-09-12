/**
 * src/lib/agenda/rangoQuePedir.ts
 *
 * Decide QUÉ RANGO se le pide al servidor cuando FullCalendar va a buscar
 * eventos: toma el que la vista entrega y lo ensancha a semanas naturales
 * completas.
 *
 * Vivía dentro de `src/app/(app)/agenda/page.tsx`, sin exportar y por tanto sin
 * pruebas posibles —importar esa página desde un test arrastra FullCalendar,
 * Supabase y el árbol de cliente entero—. Salió aquí para poder fijarla:
 * **causó dos de los cuatro fallos graves** de la primera auditoría del botón
 * «Compactar», y lo que la sostenía era la comprobación a mano en el navegador.
 * Su comportamiento NO cambió al mudarse. Ver `src/lib/tests/rangoQuePedir.test.ts`.
 *
 * ⚠️  TODAS LAS CITAS A `@fullcalendar/core` SON DE LA VERSIÓN 6.1.20, la
 * instalada al escribirlas. Si los números de línea no cuadran, comprueba la
 * versión antes de concluir que el razonamiento caducó.
 */

/**
 * El primer día de la semana, y de dónde sale.
 *
 * ⚠️  NO ES UNA ELECCIÓN DE ESTE MÓDULO: la agenda monta FullCalendar con
 * `locale={esLocale}`, y `@fullcalendar/core/locales/es` trae `week: { dow: 1 }`
 * — lunes. La página NO pasa `firstDay`, así que manda el locale.
 *
 * Si algún día alguien le pasa `firstDay` al calendario, o cambia el locale, el
 * encaje de aquí deja de coincidir con el de la vista y hay que traer ese valor
 * hasta acá. Mientras tanto, duplicarlo como constante es más honesto que
 * calcularlo: se ve, y se ve de dónde viene.
 */
const PRIMER_DIA_SEMANA = 1

/**
 * El rango que se le PIDE al servidor: el que la vista entrega, ensanchado a
 * SEMANAS NATURALES COMPLETAS (de lunes a lunes, `firstDay: 1`, que es lo que
 * fija `esLocale.week.dow`).
 *
 * Dos reglas, y las dos se pagaron con un defecto:
 *
 * ⚠️  1. SE CONSTRUYE DESDE `info`, NUNCA LEYENDO LA VISTA. Al despachar
 * `PREV`/`NEXT`/`CHANGE_DATE`/`CHANGE_VIEW_TYPE`, `_handleAction` llama a
 * `reduceEventSources` en `@fullcalendar/core/index.js:1394`, que invoca esta
 * callback SÍNCRONAMENTE; pero `this.state` no se escribe hasta `:1433` y
 * `this.data` hasta `updateData()` en `:1442`. O sea que en el instante del
 * fetch `getApi().view` todavía describe el perfil ANTERIOR. Pedir por ahí hacía
 * que «siguiente» trajera la semana que ya estabas viendo, y como FullCalendar
 * registra la respuesta con el `fetchRange` NUEVO, se creía servido y no volvía
 * a pedir: la semana nueva se quedaba en blanco para siempre. `info` viene del
 * perfil correcto por construcción.
 *
 * ⚠️  2. EL RANGO PEDIDO NUNCA PUEDE SER MÁS ESTRECHO QUE LO QUE SE PINTA. Ésta
 * es la regla que manda, y por eso se ensancha en vez de recortar. Un intento
 * anterior pedía por `currentRange` para esquivar `hiddenDays`, y en vista MES
 * dejaba huecos: ahí `activeRange ⊋ currentRange` —`buildDayTableRenderRange`
 * encaja el mes a semanas completas y `fixedWeekCount` lo rellena a seis
 * (`@fullcalendar/daygrid/internal.js:949-958`), y `showNonCurrentDates` es
 * `true` por defecto, así que el relleno se PINTA—. Agosto de 2026 enseña desde
 * el 26 de julio, y esas citas no llegaban.
 *
 * Y lo que el ensanchado compra: `trimHiddenDays` mueve los BORDES del rango
 * activo al plegar columnas, así que pedir por él tal cual convertía un cambio
 * de vista en una petición de red —medido: con sábado y domingo plegados en la
 * semana del 17 al 21 de agosto de 2026, la URL pedía hasta el 23 en vez del
 * 25—. Un margen fijo no lo arreglaba: correr el borde un día lo movía con él en
 * vez de fijarlo. Encajado a semanas naturales sí queda quieto, porque el
 * recorte sólo come días de los extremos y la semana que los contiene no cambia.
 *
 * Por qué la MISMA regla en las tres vistas, sin mirar el tipo:
 *  · Semana: ya es de lunes a lunes; el ensanchado deshace el recorte.
 *  · Mes: el rango activo ya viene encajado a semanas, así que no hace nada.
 *  · Día: pide la semana entera del día mostrado. Se trae de más a propósito;
 *    a cambio la URL no depende de `hiddenDays` y no hay que preguntarle el
 *    tipo a una vista que —por el punto 1— puede estar caducada.
 *
 * Se avanza con `setDate()`, aritmética de CALENDARIO: en el cambio de horario
 * de verano un día no dura 24 horas y restar milisegundos desalinea el encaje.
 */
export function rangoQuePedir(info: { startStr: string; endStr: string }): { startStr: string; endStr: string } {
  /* Medianoche del primer día de la semana que contiene a `d`. El `+ 7` antes
     del módulo es para que el domingo (`getDay() === 0`) caiga en el séptimo
     lugar de una semana que empieza en lunes, y no en el primero. */
  const inicioDeSemana = (d: Date): Date => {
    const desplazamiento = (d.getDay() - PRIMER_DIA_SEMANA + 7) % 7
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - desplazamiento)
  }

  const desde = inicioDeSemana(new Date(info.startStr))

  /* El fin es EXCLUSIVO, así que se encaja el último día que el rango toca de
     verdad (`- 1 ms`) y se cierra en el lunes siguiente: un rango que ya acaba
     en lunes 00:00 se queda donde está en vez de estirarse una semana de más. */
  const ultimo = inicioDeSemana(new Date(new Date(info.endStr).getTime() - 1))
  const hasta = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + 7)

  return { ...info, startStr: desde.toISOString(), endStr: hasta.toISOString() }
}
