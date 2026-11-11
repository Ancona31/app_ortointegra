/**
 * src/lib/agenda/tarjetasAgenda.ts
 *
 * Cómo se clasifica y se tiñe una fila en una tarjeta de la agenda: si es
 * cita o evento genérico, las clases CSS que le tocan, y los colores de los
 * chips de la banda de todo el día y del mes. Movido tal cual desde
 * `AgendaCliente.tsx` (A2.1, movimiento puro), con sus comentarios; sólo
 * cambiaron los `import`/`export` que hacían falta.
 */

import type { EventContentArg } from '@fullcalendar/core'
import type { IconoEvento, ColorEvento } from '@/lib/appointments'
import type { Status, Appointment } from './tiposAgenda'

export const ESTADOS_CITA:   readonly Status[] = ['scheduled', 'confirmed', 'cancelled', 'no_show', 'attended']

export const ICONO_ETIQUETA: Record<IconoEvento, string> = {
  // Quirófano y hospital
  cirugia:        'Cirugía',
  instrumental:   'Instrumental',
  urgencias:      'Urgencias',
  internamiento:  'Internamiento',
  ronda:          'Ronda hospitalaria',
  // Clínica y estudios
  columna:        'Columna',
  ortopedia:      'Ortopedia',
  imagen:         'Imagenología',
  ultrasonido:    'Ultrasonido',
  rehabilitacion: 'Rehabilitación',
  laboratorio:    'Laboratorio',
  vacuna:         'Vacunación',
  // Agenda no clínica
  junta:          'Junta',
  videollamada:   'Videollamada',
  docencia:       'Docencia',
  congreso:       'Congreso',
  viaje:          'Viaje',
  comida:         'Comida',
  personal:       'Personal',
  bloqueo:        'Bloqueo de horario',
}

export const COLOR_ETIQUETA: Record<ColorEvento, string> = {
  indigo:  'Índigo',
  magenta: 'Magenta',
  carmin:  'Carmín',
  oliva:   'Oliva',
  bronce:  'Bronce',
  grafito: 'Grafito',
}

/** True si la fila es un evento genérico y no una cita: lo decide el paciente. */
export function esEventoGenerico(apt: { paciente_id?: string | null }): boolean {
  return !apt.paciente_id
}

/* Las tintas del chip de la BANDA, derivadas de la fila. Fuera del componente
   por el mismo motivo que `tintasDelChipDeMes`: para que quepa en su
   presupuesto de líneas.

   ⚠️ ES LA TERCERA COPIA DE LA PRECEDENCIA «color elegido > estado», Y ESO ESTÁ
   DECIDIDO. `tintasDelChipDeMes` ya razona por qué no hay un helper común: son
   cajas distintas y compartirlo ataría la pinta de una a cualquier cambio de la
   otra. Lo que NO se duplica son las FÓRMULAS: el 10 % del fondo, el 32 % del
   marco y el token pelado del filo son exactamente los de `MemoizedEventContent`,
   que es donde se midieron. Si alguna vez hay que retocarlas, se retocan en los
   tres sitios o la agenda dice tres cosas del mismo evento.

   ⚠️ EL TÍTULO NO ENTRA AQUÍ, Y ES DELIBERADO. Va en tinta neutra por CLASE
   (`.ag-banda`), nunca en el color del evento, y el motivo está medido y escrito
   entero en `MemoizedEventContent`: el fondo es una MEZCLA DEL PROPIO COLOR al
   10 %, así que teñir el texto de ese mismo color acota el contraste a la
   distancia entre un color y una mezcla de sí mismo — cuatro de los seis caían
   por debajo de AA. El icono sí lo lleva, y ahí no hay problema: es objeto
   gráfico, umbral 3:1.

   `undefined` quiere decir «que lo ponga la clase», y sólo pasa con Google: su
   fondo, su marco y su tinta son fijos y viven en `.ag-banda--gcal`.

   ⚠️ SIN `status` NO HAY PALETA QUE INTERPOLAR —`var(--ag-status-undefined-bg)`
   no resuelve a nada y el chip saldría sin fondo—, así que el salvavidas cae a
   `--ag-muted` y a dejar el fondo a la clase. Mismo criterio que el mes. */
type TintasDeLaBanda = { fondo?: string; marco?: string; filo?: string; tinta: string }

export function tintasDelChipDeBanda(
  isGcal: boolean,
  color: ColorEvento | null,
  status: Status | undefined,
): TintasDeLaBanda {
  if (isGcal) return { tinta: 'var(--ag-gcal-accent)' }
  return {
    tinta: color ? `var(--ag-evento-${color})`
      : status ? `var(--ag-status-${status}-dot)` : 'var(--ag-muted)',
    fondo: color ? `color-mix(in srgb, var(--ag-evento-${color}) 10%, var(--ag-surface))`
      : status ? `var(--ag-status-${status}-bg)` : undefined,
    marco: color ? `color-mix(in srgb, var(--ag-evento-${color}) 32%, transparent)`
      : status ? `var(--ag-status-${status}-border)` : undefined,
    filo: color ? `var(--ag-evento-${color})`
      : status ? `var(--ag-status-${status}-dot)` : undefined,
  }
}

/* Los colores del chip de Mes, derivados de la fila. Vive FUERA de `MonthChip`
   para que el componente quepa en su presupuesto de líneas.

   Repite la precedencia de `MemoizedEventContent` (el color elegido manda sobre
   el del estado) en vez de compartirla, y la duplicación es deliberada: son dos
   cajas distintas, y un helper común ataría la pinta del mes a cualquier cambio
   de la semana. Si alguna vez divergen, es que tenían que divergir.

   `undefined` quiere decir «que lo ponga la clase», y sólo pasa con Google: su
   fondo y su tinta son fijos y viven en `.ag-mes--gcal`.

   ⚠️ SIN `status` NO HAY PALETA QUE INTERPOLAR: `var(--ag-status-undefined-bg)`
   no resuelve a nada y el chip saldría sin fondo. Es el mismo salvavidas que el
   despachador tiene abajo en su rama de texto pelado para Semana/Día. */
type TintasDelChip = { fondo?: string; tinta: string; hora?: string }

/* ⚠️ EL PARÁMETRO SE ENSANCHÓ A `Partial` EN EL PASO 9, y es un ensanche, no un
   aflojamiento: esta función sólo lee `color` y `status`, y ya trataba a los dos
   como ausentes en su cadena de ternarios —tenía que hacerlo, porque la fuente
   de Google no trae ninguno—. Lo que cambia es que ahora también la llama el
   panel del día, que anota `extendedProps` como `Partial` en vez de castearlo.
   Quien pasaba una cita entera (`MonthChip`) sigue pudiendo. */
export function tintasDelChipDeMes(
  ext: Partial<Appointment> & { isGcalBlock?: boolean },
  isGcal: boolean,
  esEvento: boolean,
): TintasDelChip {
  if (isGcal) return { tinta: 'var(--ag-gcal-text)' }
  const { color, status } = ext
  return {
    tinta: color ? `var(--ag-evento-${color})`
      : status ? `var(--ag-status-${status}-dot)` : 'var(--ag-muted)',
    fondo: color ? `color-mix(in srgb, var(--ag-evento-${color}) 10%, var(--ag-surface))`
      : status ? `var(--ag-status-${status}-bg)` : undefined,
    /* ⚠️ LA HORA DE UN EVENTO VA EN NEUTRO Y LA DE UNA CITA EN EL COLOR DE SU
       ESTADO. Está razonado entero en `MemoizedEventContent` y no se repite
       aquí, pero hay un motivo extra que es SÓLO del mes: en un chip de una
       línea la hora es el único texto que puede llevar color, así que es el
       único sitio donde cabe el signo de tipo «en color = cita, en neutro =
       evento». La tarjeta de Semana tiene otras cinco señales; ésta no. */
    hora: esEvento ? 'var(--ag-ink-600)'
      : status ? `var(--ag-status-${status}-text)` : 'var(--ag-muted)',
  }
}

/* ⚠️ `clasesDelEvento` ESTUVO RETIRADA Y HA VUELTO EN EL BLOQUE 6. Lee esto
 * antes de tocarla: la condición con la que se fue sigue vigente.
 *
 * SE FUE porque emitía seis marcadores semánticos en el `<a>` raíz del evento y
 * cinco no los leyó nunca nadie. El último, `ag-ev-cita`, encendía la píldora de
 * estado sólo en las citas, y eso resultó ser el bug: la píldora es del ESTADO, y
 * un evento genérico tiene estado igual que una cita. Al corregirlo, la regla
 * dejó de necesitar distinguir categorías y el marcador se quedó sin consumidor.
 * Un marcador emitido que nadie lee no se distingue de un descuido, así que se
 * fue la función entera y con ella la prop. La condición para volver era: JUNTO
 * con la regla que lo lee, no antes.
 *
 * VUELVE PORQUE ESA REGLA EXISTE. Las vistas de lista pintan su marca de color
 * en un nodo que el plugin construye a mano —`<span class="fc-list-event-dot">`,
 * `@fullcalendar/list/internal.js:60-63`, sin `ContentContainer` ni generador de
 * contenido—, así que NO hay forma de componerlo desde `eventContent`. Y encima
 * llega invisible: su único color sale del `borderColor` en línea del evento, y
 * las tres fuentes de esta página pasan `borderColor: 'transparent'`. La única
 * vía es la hoja de estilos, y para llegar ahí la fila necesita marcadores.
 * Los consumidores están en `globals.css`, en el bloque de la fila de lista.
 *
 * LAS DOS COSAS QUE COSTARON ENCONTRARSE Y SIGUEN SIENDO CIERTAS:
 *
 *   1. NINGUNA CLASE PUEDE PINTAR EL `<a>` RAÍZ. Ese elemento es el harness
 *      TRANSPARENTE de `globals.css` (`.fc .fc-event`: fondo, borde y sombra a
 *      cero con `!important`) y toda la pinta la ponen las tarjetas de
 *      `eventContent` por dentro. Un marcador sirve como ANCESTRO y nada más.
 *      ⚠️ ESTOS MARCADORES SALEN EN LAS CUATRO VISTAS, no sólo en las listas:
 *      `eventClassNames` es una opción GLOBAL y en rejilla aterriza en ese `<a>`.
 *      Por eso TODA regla que los lea lleva `.fc-list-event` en el selector, sin
 *      excepción. Es lo que garantiza que la rejilla no se entere de que existen.
 *      Si añades una regla nueva sin ese trozo, estás pintando el `<a>`.
 *   2. EL TIPO SE DERIVA, NO SE GUARDA. La tentación es meter un campo `tipo` en
 *      `extendedProps`, pero ese objeto tiene TRES productores independientes:
 *      el GET de `/api/appointments` (que vuelca la fila con `{ ...apt }`), la
 *      escritura optimista de `buildEventInput` —luego fusionada clave por clave
 *      por `aplicarAppointmentAlEvento`— y la fuente de Google, que no produce
 *      filas de `appointments` en absoluto y pone `{ isGcalBlock: true }` y nada
 *      más. Un valor guardado habría que escribirlo en los tres y reescribirlo en
 *      cada fusión; el día que uno se olvide, la tarjeta se pinta con el tipo
 *      anterior y no falla nada. `esEventoGenerico(ext)` lo deriva de lo que ya
 *      llega y no hay nada que sincronizar. (Y `TipoFila` ya existe en este
 *      archivo y significa otra cosa.)
 *
 * ⚠️ LOS NOMBRES SON LOS DEL PRODUCTO Y EN INGLÉS —`scheduled`, `no_show`,
 * `attended`—, que es como están en la columna `appointments.status`, y NO los
 * del mockup, que los escribe en español. Lo mismo con los seis colores, que
 * viajan tal cual al `CHECK` `appointments_color_check`. Interpolar aquí el
 * valor de la base es lo que hace que añadir un estado o un color no obligue a
 * tocar esta función; lo que sí hay que añadir entonces es su línea de token en
 * `globals.css`, igual que ya pasa con los tokens `--ag-status-*`.
 *
 * ⚠️ `extendedProps` SE ANOTA, NO SE CASTEA. Su tipo es `Record<string, any>`
 * (`Dictionary`, `core/internal-common.d.ts:2305`), así que leerlo directo
 * mete `any` en el archivo. Asignarlo a un local ANOTADO lo estrecha sin `as` y
 * sin `any`, y de paso declara qué se espera encontrar: `Partial`, porque la
 * fuente de Google no trae ninguno de estos campos.
 */
export function clasesDelEvento(arg: EventContentArg): string[] {
  const ext: Partial<Appointment> & { isGcalBlock?: boolean } = arg.event.extendedProps
  const clases: string[] = []
  /* La bandera y no la vista: en una lista un evento de todo el día llega aquí
     igual que en la banda, y su columna de hora es la que cambia de pinta. */
  if (arg.event.allDay) clases.push('ag-ev-allday')
  /* Google sale por su propia puerta y no lleva ni estado ni color: su fuente no
     produce filas de `appointments`, así que no hay nada que interpolar. */
  if (ext.isGcalBlock === true) { clases.push('ag-ev-gcal'); return clases }
  if (esEventoGenerico(ext)) clases.push('ag-ev-evento')
  if (ext.status) clases.push(`ag-ev-status--${ext.status}`)
  if (ext.color)  clases.push(`ag-ev-color--${ext.color}`)
  return clases
}


/* SÓLO EL NOMBRE VISIBLE DE CADA ESTADO. El color NO está aquí y no debe
   volver: este mapa llegó a tener `bg`/`text`/`dot` con clases de Tailwind que
   ya nadie leía —el color salía de los tokens— y lo único que hacían era estar
   a mano para que alguien los usara por error y estrenara una tercera paleta.
   Ver el aviso junto a `STATUS_STYLE` en `AgendaCliente.tsx`. Vive aquí desde A2.2. */
export const STATUS_CONFIG: Record<Status, { label: string }> = {
  scheduled:  { label: 'Agendada'   },
  confirmed:  { label: 'Confirmada' },
  cancelled:  { label: 'Cancelada'  },
  no_show:    { label: 'No asistió' },
  attended:   { label: 'Atendida'   },
}
