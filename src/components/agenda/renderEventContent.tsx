/**
 * src/components/agenda/renderEventContent.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import type { EventContentArg } from '@fullcalendar/core'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { esVistaDeRejilla } from '@/lib/agenda/vistasAgenda'
import { esEventoGenerico, marcaPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { horaEnTZ, duracionDeLaFila } from '@/lib/agenda/fechasAgenda'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'
import { MonthChip } from './MonthChip'
import { BandaChip } from './BandaChip'
import { GoogleEventCard } from './GoogleEventCard'
import { FilaLista } from './FilaLista'
import { FilaListaDetalle } from './FilaListaDetalle'
import { MemoizedEventContent, FORMATO_HORA_INICIO } from './MemoizedEventContent'

/** Resuelve las iniciales del chip de médico de una cita ya pintada. */
export type InicialesDeCita = (ext: Appointment) => string | undefined

export function renderEventContent(arg: EventContentArg, navegadorTZ: string, inicialesDeCita: InicialesDeCita) {
  // Vista Mes: chip plano dedicado. El camino de Semana/Día (abajo) queda intacto.
  if (arg.view.type === 'dayGridMonth') return <MonthChip arg={arg} />
  /* La misma pregunta que la línea de arriba, en la otra dirección: allí «¿es
     Mes?», aquí «¿es rejilla?». Las dos piezas que la usan están abajo. */
  const enRejilla = esVistaDeRejilla(arg.view.type)
  /* Banda de todo el día de Semana y Día (bloque 5). Va DESPUÉS de Mes y no
     antes, y el orden es lo que decide: en Mes TODO evento es `allDay` —la
     rejilla del mes no tiene horas—, así que puesto delante se comería la vista
     entera y `MonthChip` no se pintaría nunca. (Que Mes haya devuelto ya no es
     lo ÚNICO que acota esta rama desde el bloque 6 — ver el aviso pegado al
     `if`—, pero sigue siendo necesario: el orden no se puede invertir.)

     `isGcalBlock` sale de `extendedProps` y es el MISMO criterio que usan
     `renderEventContent` cuatro líneas más abajo, `MonthChip` y `contarVisibles`;
     leerlo aquí y no fiarse de que «todo `allDay` es de Google» es lo que
     distingue al evento real del espejo del arrastre, que llega con `allDay` en
     `true` y con los `extendedProps` de una CITA. Ver el docstring de
     `BandaChip`.

     ⚠️ `ext` SE DECLARA ARRIBA DE ESTA RAMA Y NO DEBAJO, que es donde estuvo.
     Subirlo es lo que deja a la banda leer `icono` de la MISMA fila tipada que
     usan las otras dos tarjetas, en vez de estrenar una segunda forma de
     resolverlo. Es una lectura pura y la vista Mes ya ha devuelto más arriba,
     así que moverlo no cambia cuándo se evalúa para nadie. */
  const ext = arg.event.extendedProps as Appointment & { isGcalBlock?: boolean }
  /* ⚠️ `allDay` NO BASTA DESDE EL BLOQUE 6, y por eso lleva la segunda mitad.
     Esa bandera dice QUÉ es el evento —uno de todo el día—, no DÓNDE se está
     pintando, y sigue llegando en `true` en una vista de lista. Sin esta
     condición, un evento de todo el día en una lista se llevaba el chip de la
     banda: una caja de 20 px de alto FIJO, dimensionada para el contenedor de
     la banda de la rejilla, metida dentro de una fila que se dimensiona sola.
     `BandaChip` no cambia; lo que cambia es dónde se aplica.
     Con Mes ya devuelto arriba y la rejilla exigida aquí, llegar a este `return`
     sólo puede ser la banda de Semana o Día, que es lo que era antes. */
  if (arg.event.allDay && enRejilla) {
    return (
      <BandaChip
        title={arg.event.title}
        esDeGoogle={ext?.isGcalBlock === true}
        icono={ext?.icono ?? null}
        color={ext?.color ?? null}
        status={ext?.status}
      />
    )
  }
  /* ⚠️ LA RAMA DE LISTA VA ANTES QUE LA DE GOOGLE, Y EL ORDEN DECIDE. En una
     lista un evento de Google es una fila más —con su «G» delante del nombre—,
     no la tarjeta de la rejilla: puesta detrás, `GoogleEventCard` se quedaría
     con esas filas y metería una tarjeta de dos líneas dentro de un `<td>`.
     Y va DESPUÉS de la banda porque la banda ya exige rejilla, así que aquella
     rama no puede robarle nada a ésta.

     Aquí llegan las cuatro clases de fila —cita, evento propio, Google y el
     evento de todo el día de cualquiera de los tres—: la lista no separa por
     tipo como hace la rejilla, sólo cambia lo que se pinta dentro. */
  if (!enRejilla) {
    const pacLista = ext?.pacientes
    const nombreLista = pacLista ? `${pacLista.nombre} ${pacLista.apellidos}` : arg.event.title
    /* ⚠️ LAS DOS VARIANTES SE SEPARAN POR TIPO DE VISTA, Y SÓLO AQUÍ. `listDay`
       tiene ancho para el detalle; `listWeek` y el panel del mes se quedan con la
       compacta. Es el mismo `arg.view.type === 'listDay'` con el que la cabecera
       de día decide si escribe el año — y por el mismo motivo: en una lista de un
       solo día sobra sitio, en una de siete no. */
    if (arg.view.type === 'listDay') {
      return (
        <FilaListaDetalle
          citaId={arg.event.id}
          nombre={nombreLista}
          esDeGoogle={ext?.isGcalBlock === true}
          icono={ext?.icono ?? null}
          cancelada={ext?.status === 'cancelled'}
          /* Sin duración en un evento de todo el día: su tramo son días enteros
             —medianoche a medianoche del día siguiente, ver `all_day`— y
             contarlo en minutos daría «1440 min». La columna de hora ya dice
             «todo el día», que es lo que ahí significa la duración. */
          duracion={arg.event.allDay ? null : duracionDeLaFila(arg.event.start, arg.event.end)}
          motivo={ext?.notes?.trim() || null}
          status={ext?.status}
          esEvento={ext ? esEventoGenerico(ext) : false}
        />
      )
    }
    return (
      <FilaLista
        citaId={arg.event.id}
        nombre={nombreLista}
        esDeGoogle={ext?.isGcalBlock === true}
        icono={ext?.icono ?? null}
        /* La MISMA precedencia que la tarjeta de la rejilla y el chip del mes: el
           color elegido manda sobre el del estado cuando lo hay, y sólo lo hay en
           un evento genérico. Su porqué está entero en `MemoizedEventContent`. */
        tinta={ext?.color ? `var(--ag-evento-${ext.color})`
          : ext?.status ? `var(--ag-status-${ext.status}-dot)` : null}
        cancelada={ext?.status === 'cancelled'}
      />
    )
  }
  if (ext?.isGcalBlock) {
    return <GoogleEventCard timeText={arg.timeText} title={arg.event.title} />
  }
  /* Salvavidas: una fila sin `status` no sabe de qué color va, así que sale
     como texto pelado. El color es EXPLÍCITO y no decorativo — al quitar el
     `textColor` que las fuentes pasaban, lo que hereda `.fc-event-main` es
     `--fc-event-text-color`, que FullCalendar trae en BLANCO; sobre el harness
     transparente esto saldría invisible. */
  if (!ext?.status) return <span style={{ color: 'var(--ag-ink)' }}>{arg.event.title}</span>
  const pac = ext.pacientes

  // F3-6e: badge de hora en TZ del consultorio si la hora resultante difiere
  // de la hora en TZ del navegador. Comparamos horas resultantes, no strings
  // IANA, para evitar falsos positivos entre zonas del mismo offset (las 8
  // zonas UTC-6 mexicanas son IANA distintas pero comparten hora de pared).
  let tzDiff: string | undefined
  const consultorioTZ = ext.consultorio_timezone
  // F3-6e: usar arg.event.start (Date) en vez de ext.start_time (ISO de extendedProps)
  // para que el badge se actualice correctamente tras drag/resize. FullCalendar
  // actualiza arg.event.start automáticamente, pero NO toca extendedProps.start_time.
  const startISO = arg.event.start?.toISOString()
  if (consultorioTZ && startISO) {
    const horaConsultorio = horaEnTZ(startISO, consultorioTZ)
    const horaNavegador = horaEnTZ(startISO, navegadorTZ)
    if (horaConsultorio && horaConsultorio !== horaNavegador) {
      const region = regionDeTimezone(consultorioTZ)
      tzDiff = `${horaConsultorio} hora ${region}`
    }
  }

  const marca = marcaPorLigar(ext)
  return (
    <MemoizedEventContent
      citaId={arg.event.id}
      /* F1.4 · Sólo los enseña la vista Día (globals.css). El teléfono es el de
         la ficha y, en una cita por ligar, el que dejó al reservar. */
      telefono={pac?.telefono ?? ext.reserva_telefono ?? null}
      consultorio={ext.consultorio_nombre_corto ?? null}
      timeText={arg.timeText}
      horaInicio={arg.event.start ? FORMATO_HORA_INICIO.format(arg.event.start) : arg.timeText}
      title={ext.title}
      pacNombre={pac ? `${pac.nombre} ${pac.apellidos}` : null}
      status={ext.status}
      doctorInitial={inicialesDeCita(ext)}
      tzDiff={tzDiff}
      icono={ext.icono ?? null}
      color={ext.color ?? null}
      descriptor={ext.notes?.trim() || null}
      esEvento={esEventoGenerico(ext)}
      enRejilla={enRejilla}
      marca={marca?.texto ?? null}
      marcaTitulo={marca?.titulo ?? null}
    />
  )
}
