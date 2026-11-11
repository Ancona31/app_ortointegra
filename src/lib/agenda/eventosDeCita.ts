/**
 * src/lib/agenda/eventosDeCita.ts
 *
 * La traducción de una cita —de la red o de un alta optimista— al
 * `EventInput` que pinta FullCalendar, y las dos constantes que esa
 * traducción comparte con el resto de la agenda. Movido tal cual desde
 * `AgendaCliente.tsx` (A2.5.1, movimiento puro), con sus comentarios; sólo
 * cambiaron los `import`/`export` que hacían falta.
 */

import type { EventInput } from '@fullcalendar/core'
import type { Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
import { puntasParaLaRejilla } from '@/lib/agenda/fechasAgenda'

/** Id de la eventSource de citas; ver `eventSourcesStable`. */
export const FUENTE_APPOINTMENTS = 'appointments'

/** Prefijo del id temporal que lleva una cita aun no confirmada por el servidor. */
export const PREFIJO_OPTIMISTA = 'optimistic-'

/**
 * Una cita de `/api/appointments` → lo que pinta FullCalendar. La usan la
 * fuente de citas y la semilla del servidor (A1.4c): UNA sola traducción, para
 * que lo sembrado y lo traído sean el mismo evento.
 */
export function citaAEvento(apt: Appointment): EventInput {
  return {
    id:              apt.id,
    title:           apt.title,
    /* Las dos puntas y el `allDay`, de `puntasParaLaRejilla`: una fila de
       todo el día sale como fechas-solo en la zona de su consultorio, y
       cualquier otra como los instantes de siempre. Sin esto, un evento de
       todo el día entraba en la rejilla horaria como un bloque de 24 h a
       caballo entre dos días. */
    ...puntasParaLaRejilla(apt),
    // Harness transparente: el color de la cita —que es el de su ESTADO— lo
    // pone `eventContent` leyendo los tokens al pintar. Aquí NO va
    // `textColor`: FullCalendar lo aplicaría como `color` en línea sobre
    // `.fc-event-main`, y las tres tarjetas fijan el suyo en cada texto, así
    // que no se heredaba nada. Lo que sí hacía era obligar a resolver un
    // color aquí, que es de donde salía la segunda paleta.
    backgroundColor: 'transparent',
    borderColor:     'transparent',
    extendedProps:   { ...apt },
  }
}

/* ── Helper: construir EventInput desde datos de cita ── */
/* ⚠️ EL PARÁMETRO ES `DatosGuardado` Y NO `Partial<Appointment>`, Y ES LO QUE
   ARREGLA EL ALTA OPTIMISTA DE TODO EL DÍA. El camino optimista llama a esto
   con lo que el modal mandó a guardar, que en todo el día son
   `all_day_desde`/`all_day_hasta` y NO `start_time`. Con el tipo viejo esas
   dos claves ni se veían, así que salía un `EventInput` sin `start`,
   `addEvent` devolvía `null` y no se pintaba nada hasta que contestara el
   servidor. `DatosGuardado` es un superconjunto, así que los demás llamadores
   no se enteran. */
export function buildEventInput(data: DatosGuardado): EventInput {
  return {
    id:              data.id ?? `${PREFIJO_OPTIMISTA}${Date.now()}`,
    title:           data.title ?? '',
    ...puntasParaLaRejilla(data),
    // Sin `textColor`, por el mismo motivo que en `appointmentSource`: el
    // color de estado lo pinta `eventContent` desde los tokens.
    backgroundColor: 'transparent',
    borderColor:     'transparent',
    extendedProps:   { ...data },
  }
}
