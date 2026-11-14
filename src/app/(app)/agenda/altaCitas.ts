'use client'

/**
 * src/app/(app)/agenda/altaCitas.ts
 *
 * El alta y la edición de citas/eventos desde la rejilla: los cuatro
 * manejadores de interacción de FullCalendar (`handleDateClick`,
 * `handleSelect`, `handleEventClick`, y `abrirCita` como la única puerta de
 * edición) más `abrirHueco`, la puerta del panel lateral de la vista Día.
 * Movido tal cual desde `AgendaCliente.tsx` (A2.5.8, movimiento puro, con sus
 * comentarios); sólo cambiaron los parámetros, el retorno, y que `isMobile`,
 * `horario`, etc. llegan por parámetro en vez de la clausura del componente.
 *
 * `cayoEnLaBandaDeTodoElDia` viene también de `AgendaCliente.tsx`, donde era
 * una función de módulo (fuera del componente, antes de A2.5.8): se mueve
 * aquí entera porque sólo la usan `handleDateClick` y `handleSelect`.
 */

import type { Dispatch, RefObject, SetStateAction } from 'react'
import type FullCalendar from '@fullcalendar/react'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { DateSelectArg, EventApi, EventClickArg } from '@fullcalendar/core'
import type { ModalState, TodoElDiaInicial } from '@/components/agenda/AppointmentModal'
import type { Horario } from '@/lib/configApp'
import type { SubscriptionState } from '@/lib/subscription'
import type { Tramo, ResumenDia } from '@/lib/agenda/huecosAgenda'
import { medianocheDe } from '@/lib/agenda/huecosAgenda'
import { avisoFueraDeHorario, avisoFinFueraDeHorario, avisoDiaCerrado } from '@/lib/agenda/horarioAgenda'
import { partirFechaHora, ultimoDiaIncluido } from '@/lib/agenda/fechasAgenda'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
/* F3 (interacciones v2): SÓLO TIPOS. La burbuja y la tarjeta viven en un chunk
   diferido (`InteraccionesV2.tsx`) que se llama por `interacciones`; con el
   interruptor apagado o el chunk sin llegar, la referencia está vacía y cada
   gesto abre el modal como siempre. Ver `contratosV2.ts`. */
import type { ApiInteraccionesV2, SeleccionDesdeHueco, SitioCita } from '@/lib/agenda/contratosV2'
import type { Caja, Punto } from '@/lib/agenda/posicionCapa'

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>

/* Misma forma que el `useState` de `AgendaCliente.tsx` — duplicada aquí a
   propósito, igual que en `guardadoCitas.ts` (A2.5.7): es la misma cosa
   estructural para el compilador y no hace falta un tipo compartido para
   que coincidan. */
type ConfirmState = { message: string; onConfirm: () => void; onCancel: () => void } | null

/**
 * ¿El gesto cayó en la BANDA DE TODO EL DÍA de Semana o Día, y no en una celda
 * de la vista Mes?
 *
 * ⚠️ `arg.allDay` NO BASTA, Y CREERLO FUE UN ERROR REAL DE ESTE BLOQUE. Esa
 * bandera llega en `true` en los DOS sitios: la banda de las vistas de tiempo y
 * cualquier celda de `dayGridMonth`. Decidir sólo por ella convertía el clic en
 * el mes —que es como se agenda todo el día— en un alta de evento de todo el
 * día. Sigue haciendo falta para saber si hay HORA; no sirve para saber DÓNDE.
 *
 * ⚠️ Y NO SE PREGUNTA POR `view.type`, que es la otra tentación: lo prohíbe el
 * aviso de `handleDateClick`, y con razón —la banda existe en tres vistas—.
 *
 * SE PREGUNTA POR EL DOM, que es donde la diferencia es real:
 *   · la vista de tiempo monta su raíz con la clase `fc-timegrid`
 *     (`@fullcalendar/timegrid/internal.js:200` y `:307`), y la banda es una
 *     sección del ScrollGrid que cuelga DENTRO de esa raíz (`:232`, el bloque
 *     `allDayContent`), así que todo elemento suyo la tiene por ancestro;
 *   · la vista Mes monta la suya con `fc-daygrid`
 *     (`@fullcalendar/daygrid/internal.js:35` y `:80`) y NUNCA emite
 *     `fc-timegrid` — cero coincidencias en todo el paquete.
 * Es la misma distinción de la que ya depende el CSS de la banda desde el
 * bloque 5 (`globals.css:2337-2339`, que acota los chips a `.fc-timegrid`
 * justamente para que el Mes no los herede).
 *
 * SIN OBJETIVO SE CONTESTA `false`, y es la respuesta prudente: `DateSelectArg`
 * trae `jsEvent` OPCIONAL —`null` cuando la selección no la hizo un gesto— y
 * quedarse corto abre una cita, que es lo recuperable. Al revés se estropearía
 * el alta desde el mes, que es el camino de todos los días.
 */
function cayoEnLaBandaDeTodoElDia(objetivo: EventTarget | null | undefined, allDay: boolean): boolean {
  if (!allDay) return false
  return objetivo instanceof Element && objetivo.closest('.fc-timegrid') !== null
}

/* ── F3 · DÓNDE CAYÓ EL GESTO, PARA COLOCAR LA BURBUJA Y LA TARJETA ─────────
   Sin `instanceof MouseEvent`: se pregunta por las propiedades, como
   `esObjetivoEditable`, y `Element` se comprueba antes de usarlo, para que el
   enrutado se pueda probar en Vitest, que corre sin DOM. */

/** El punto pulsado. Con teclado (Enter en una cita) no hay punto. */
function puntoDe(e: Event | null | undefined): Punto | undefined {
  if (!e || !('clientX' in e) || !('clientY' in e)) return undefined
  const { clientX: x, clientY: y } = e
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined
}

/** Lo que se lee de un elemento para colocar la capa; un `Element` lo cumple. */
type ConCaja = { getBoundingClientRect(): { left: number; top: number; width: number; height: number } }

function cajaDe(el: ConCaja | null | undefined): Caja | null {
  if (!el) return null
  const { left, top, width, height } = el.getBoundingClientRect()
  return { left, top, width, height }
}

/** El elemento de la celda o la columna bajo el gesto (`jsEvent.target`). */
function celdaDe(e: Event | null | undefined): Element | null {
  const t = e?.target
  return typeof Element !== 'undefined' && t instanceof Element ? t.closest('.fc-daygrid-day, .fc-timegrid-col') : null
}

/**
 * El ancla de la burbuja: el ESPEJO de la selección si lo hay (`selectMirror`,
 * el tramo marcado en la rejilla), la celda si es del Mes, y si no un punto.
 * La columna entera de la rejilla horaria NO sirve de ancla: mide el día
 * entero y la capa no cabría a ningún lado.
 */
function anclaDelGesto(celda: Element | null | undefined, punto: Punto | undefined): Caja | null {
  const espejo = typeof document === 'undefined' ? null : document.querySelector('.fc-event-mirror')
  return cajaDe(espejo) ?? cajaDe(celda?.closest('.fc-daygrid-day'))
    ?? (punto ? { left: punto.x, top: punto.y, width: 1, height: 1 } : null)
}

/** El botón del hueco pulsado, si tiene el foco; si no, el panel de Día donde vive. */
function anclaDelHueco(): Element | null {
  if (typeof document === 'undefined') return null
  const activo = document.activeElement
  return activo?.closest('.ag-dia-aside') ? activo : document.querySelector('.ag-dia-aside')
}

/** Lo que la burbuja necesita del gesto, además de fecha y hora. `null`: no hay sitio, va al modal. */
type SitioDelGesto = { fin: Date | null; desdeHueco: boolean; ancla: Caja; punto?: Punto }

function sitioDelGesto(
  celda: Element | null | undefined, jsEvent: Event | null | undefined, fin: Date | null, hueco: { ancla: Caja | null } | null,
): SitioDelGesto | null {
  const punto = puntoDe(jsEvent)
  const ancla = hueco?.ancla ?? anclaDelGesto(celda, punto)
  return ancla ? { fin, desdeHueco: hueco !== null, ancla, ...(punto ? { punto } : {}) } : null
}

interface Params {
  calendarRef: CalRef
  isMobile: boolean
  setDiaSel: Dispatch<SetStateAction<Date | null>>
  subState: SubscriptionState
  openBloqueoModal: () => void
  horario: Horario
  setModal: Dispatch<SetStateAction<ModalState>>
  setConfirm: Dispatch<SetStateAction<ConfirmState>>
  resumenDia: ResumenDia | null
  citasIncompletas: boolean
  /** F3: el interruptor y la API del chunk de interacciones (vacía si no llegó). */
  agendaV2: boolean
  interacciones: { current: ApiInteraccionesV2 | null }
  seleccionDesdeHueco: SeleccionDesdeHueco
}

export function crearAltaCitas({
  calendarRef, isMobile, setDiaSel, subState, openBloqueoModal, horario, setModal, setConfirm,
  resumenDia, citasIncompletas, agendaV2, interacciones, seleccionDesdeHueco,
}: Params) {
  /* ── Handlers ────────────────────────────────────────── */
  /* ⚠️ `tipo: 'cita'` DE AQUÍ ABAJO ES EL VALOR DE PARTIDA, NO UN CIERRE.
     Pulsar un hueco o arrastrar sobre el calendario siguen abriendo CITA, que es
     lo que espera quien hace ese gesto y no ha cambiado. Lo que cambió es que
     desde el modal se puede cambiar de idea sin cerrarlo: el control de dos
     posiciones del alta llama a `onCambiarTipo` y reemplaza este `tipo`.
     Antes esto era la única forma de decidirlo y por eso no había vuelta atrás
     salvo cerrar el modal y entrar por un segundo botón del header, «Nuevo
     evento», que ya no existe: el conmutador lo dejó sin trabajo y se retiró
     para que el header cupiera en una línea. Ver la nota del botón «Agendar». */
  function handleDateClick(arg: DateClickArg) {
    /* ⚠️ EN EL MES DEL TELÉFONO UN TOQUE SELECCIONA, NO CREA, y va ANTES del
       gate de suscripción a propósito: elegir qué día enseña el panel es una
       lectura, y una clínica bloqueada sigue pudiendo leer su agenda. La puerta
       de creación en móvil es una sola y está abajo, en la barra fija.
       Sin esta rama el toque abría el alta —que es lo correcto en escritorio— y
       el panel se quedaba sin forma de cambiar de día. */
    if (isMobile && arg.view.type === 'dayGridMonth') { setDiaSel(arg.date); return }
    // Fase 8.2: bloqueo creación de citas si suscripción cancelada con >5 pacientes
    if (subState.isBlocked) { openBloqueoModal(); return }
    /* `allDay` y no `view.type === 'dayGridMonth'`: lo que decide es que el
       hueco pulsado sea un DÍA y no una hora, que es justo lo que esa bandera
       significa.

       ⚠️ Y DESDE EL BLOQUE 5 ESO YA NO ES SÓLO MES. `allDaySlot` está ENCENDIDO,
       así que Semana y Día tienen su banda de todo el día y un clic ahí llega
       con `arg.allDay === true` y `arg.date` a medianoche: el alta se abre sin
       hora, igual que en Mes. En la rejilla horaria sigue llegando `false` con
       hora real.

       POR ESO ESTA LÍNEA NO SE TOCÓ AL MONTAR LA BANDA, y es la única de los
       cuatro manejadores de interacción que no necesitó nada: preguntar por la
       BANDERA y no por la vista ya cubría un caso que entonces no existía.
       Decidir por `view.type` habría mandado el clic de la banda por el camino
       de la hora. No lo cambies a la vista.

       ⚠️ PARA LA HORA BASTA, PARA EL SITIO NO. La misma bandera llega en `true`
       en la banda Y en cualquier celda del mes, así que decidir con ella si se
       abre un evento de todo el día convertía el clic del mes —que es como se
       agenda— en un alta de evento. Esa pregunta la contesta el DOM, en
       `cayoEnLaBandaDeTodoElDia`; la de si hay hora se queda aquí. */
    const { fecha, hora } = partirFechaHora(arg.date.toISOString())
    const enLaBanda = cayoEnLaBandaDeTodoElDia(arg.dayEl, arg.allDay)
    /* F3: la banda de todo el día sigue yendo al modal (decisión 18); la
       rejilla horaria y la celda del Mes llevan su sitio, y con v2 abren la
       burbuja. Un clic no trae fin: la burbuja propone la duración por omisión. */
    const sitio = enLaBanda ? null : sitioDelGesto(arg.dayEl, arg.jsEvent, null, null)
    abrirAlta(arg.date, fecha, arg.allDay ? null : hora, enLaBanda ? 'fijo' : 'no', undefined, undefined, sitio)
  }

  /* El alta desde la rejilla, con o sin hora, y el aviso que corresponda a cada
     caso. Los dos caminos —clic y arrastre— pasan por aquí para que no se les
     desincronice el criterio del aviso, que es lo que ya pasó una vez.

     ⚠️ SIN HORA NO SE COMPRUEBA EL HORARIO, Y NO ES UN OLVIDO. `avisoFueraDeHorario`
     compara una hora contra el tramo del día; sin hora no hay nada que comparar,
     y forzarlo obligaría a inventarse una —que es justo lo que se retiró—. Lo
     que SÍ se comprueba es el día: `avisoDiaCerrado` no mira la hora, así que
     agendar en domingo sigue avisando. El aviso de hora no desaparece del
     sistema: salta al guardar, desde `handleSave`, cuando ya hay hora escrita.

     ⚠️ `'fijo'` ABRE EN LA RAMA DE EVENTO, y no es un capricho de tipo: una cita
     siempre lleva hora, así que el gesto sobre la BANDA no puede estar pidiendo
     una. Abrir ya en «evento» —en vez de en «cita» y que el médico cambie—
     evita el REMONTE del modal que provoca `key={modal.tipo}`, con el que se
     pierde lo que hubiera escrito (ver el aviso del montaje).
     Quién manda `'fijo'` lo decide `cayoEnLaBandaDeTodoElDia`, NO `arg.allDay`:
     esa bandera también llega en `true` en la vista Mes, y usarla aquí convertía
     el clic del mes en un alta de evento de todo el día. El mes abre en CITA sin
     hora, como siempre; quien quiera un evento de todo el día desde ahí conmuta
     a Evento y enciende el interruptor a mano. */
  /* ⚠️ `finParaAvisar` Y `ultimoDia` SON DOS COSAS DISTINTAS Y NO SE FUSIONAN.
     El primero es un `Date`, sólo se mira para el aviso de fuera de horario y
     NO entra en el modal. El segundo es una fecha-sola que SÍ entra, y nunca
     coinciden: el aviso es de citas con hora y el último día es de eventos de
     todo el día. Juntarlos en un parámetro obligaría a convertir de uno a otro,
     y esa conversión es justo la que corre un día cuando el huso no cuadra. */
  /* ⚠️ F3 · LA BURBUJA ENTRA POR AQUÍ DENTRO, DETRÁS DEL MISMO AVISO. Con v2
     y un `sitio` (rejilla horaria o celda del Mes), lo que se abre es la
     burbuja en vez del modal; el bloqueo de suscripción (antes, en los
     llamadores) y el aviso de fuera de horario (aquí) son los de siempre. Sin
     `sitio`, sin v2 o sin el chunk cargado, el modal de hoy. */
  function abrirAlta(
    instante: Date, fecha: string, hora: string | null,
    todoElDia: TodoElDiaInicial, finParaAvisar?: Date, ultimoDia?: string, sitio?: SitioDelGesto | null,
  ) {
    const aviso = hora === null
      ? avisoDiaCerrado(instante, horario)
      : (avisoFueraDeHorario(instante, horario, 'Vas a agendar a las')
         ?? (finParaAvisar ? avisoFinFueraDeHorario(finParaAvisar, horario) : null))
    const capas = agendaV2 && sitio ? interacciones.current : null
    const abrir = capas && sitio
      ? () => capas.abrirBurbuja({ fecha, hora, inicio: instante, ...sitio })
      : () => setModal({
        mode: 'create', fecha, hora,
        tipo: todoElDia === 'fijo' ? 'evento' : 'cita',
        todoElDia,
        ...(ultimoDia ? { fechaFin: ultimoDia } : {}),
      })
    if (aviso) {
      setConfirm({
        message: aviso,
        onConfirm: () => { setConfirm(null); abrir() },
        onCancel:  () => setConfirm(null),
      })
      return
    }
    abrir()
  }

  function handleSelect(arg: DateSelectArg) {
    // F3: la marca de `abrirHueco` se recoge y se vacía antes que nada.
    const hueco = seleccionDesdeHueco.current
    seleccionDesdeHueco.current = null
    // Fase 8.2: idem handleDateClick
    if (subState.isBlocked) { openBloqueoModal(); return }
    /* Arrastrar sobre la rejilla fija las dos puntas, así que se miran las dos:
       seleccionar de 18:00 a 21:00 con horario hasta las 19:00 no diría nada
       mirando sólo el inicio. El fin sólo se pasa cuando hay hora — arrastrar
       sobre las celdas del MES selecciona días enteros (`allDay`), y ahí el fin
       es medianoche del día siguiente, que no dice nada de la cita. */
    const { fecha, hora } = partirFechaHora(arg.start.toISOString())
    /* Mismo reparto que en `handleDateClick`, y por el mismo motivo: `allDay`
       dice si hay hora, el DOM dice si fue la banda. Aquí el objetivo sale de
       `jsEvent`, que `DateSelectArg` declara OPCIONAL —`MouseEvent | null`,
       `@fullcalendar/core/internal-common.d.ts:874-877`— porque una selección
       puede venir de la API y no de un gesto; sin él se contesta que no fue la
       banda, que es lo recuperable. */
    if (arg.allDay) {
      const enLaBanda = cayoEnLaBandaDeTodoElDia(arg.jsEvent?.target, true)
      /* ⚠️ `arg.endStr` Y NO `arg.end`, Y LA DIFERENCIA ES UN DÍA ENTERO.
         `buildRangeApi` formatea las dos cadenas con `omitTime: span.allDay`
         (`@fullcalendar/core/internal-common.js:4571-4577`), así que en la banda
         salen ya como `YYYY-MM-DD` PELADOS: son los días que el ratón marcó, sin
         huso que nadie pueda malinterpretar. `arg.end` es un `Date` construido
         con el huso del navegador, y leerlo de vuelta reintroduce exactamente el
         bug que `diaEnZonaDelConsultorio` existe para evitar.

         Y es FIN EXCLUSIVO —`joinHitsIntoSelection` toma el mayor de los cuatro
         extremos, que es el `addDays(start, 1)` del último día tocado
         (`@fullcalendar/interaction/index.js:1201-1223`)— mientras que el modal
         enseña el ÚLTIMO DÍA INCLUIDO. La conversión es `ultimoDiaIncluido`, que
         YA EXISTE: aquí no se escribe ningún desplazamiento nuevo.

         SÓLO SE SIEMBRA DESDE LA BANDA. La otra puerta de esta rama es la vista
         Mes, donde el modal abre como CITA y `fechaFin` significa otra cosa —el
         día del fin CON HORA—: sembrarlo allí cambiaría el alta de siempre. */
      const ultimoDia = enLaBanda && arg.endStr ? ultimoDiaIncluido(arg.endStr) : undefined
      /* F3: sólo la celda SUELTA del Mes va a la burbuja; arrastrar por varios
         días sigue abriendo el modal, como hoy. */
      const unDia = !enLaBanda && !!arg.endStr && ultimoDiaIncluido(arg.endStr) === arg.startStr
      const sitio = unDia ? sitioDelGesto(celdaDe(arg.jsEvent), arg.jsEvent, null, null) : null
      abrirAlta(arg.start, fecha, null, enLaBanda ? 'fijo' : 'no', undefined, ultimoDia, sitio)
      return
    }
    /* F3: el fin del arrastre viaja a la burbuja, que respeta la duración
       arrastrada (más de una franja); desde un hueco del panel, no. */
    abrirAlta(arg.start, fecha, hora, 'no', arg.end, undefined, sitioDelGesto(celdaDe(arg.jsEvent), arg.jsEvent, arg.end, hueco))
  }

  /* ⚠️ LA ÚNICA PUERTA A LA EDICIÓN DE UNA CITA, Y POR ESO ESTÁ SUELTA. Nació
     dentro de `handleEventClick` y salió en el paso 9, cuando el panel del mes
     estrenó una SEGUNDA forma de abrir la misma cita. Que las dos pasen por aquí
     es lo que garantiza que la regla de Google —los bloques del calendario de
     Google no abren nada, porque no son filas de `appointments` y no hay qué
     editar— no pueda aplicarse en una y olvidarse en la otra.
     Y de paso deja UN solo sitio en el archivo donde `extendedProps` se estrecha
     a `Appointment`. Si algún día se abre una tercera puerta, entra por aquí. */
  /* F3: con v2 (y el chunk cargado) la puerta abre la TARJETA DE LECTURA en
     vez del modal (§2); el modal sigue a un clic, en «Editar». Las dos puertas
     de hoy —el clic en la rejilla y el panel del Mes del teléfono— pasan por
     aquí, así que la tarjeta no puede faltar en una y estar en la otra. */
  function abrirCita(evento: EventApi, sitio?: SitioCita) {
    if (evento.extendedProps.isGcalBlock) return
    const cita = evento.extendedProps as Appointment
    const capas = agendaV2 ? interacciones.current : null
    /* T3 · Al pasar el ratón sólo hay tarjeta (no modal): nunca el modal, y sin
       la v2 nada (el oyente ni siquiera existe sin ella). */
    if (sitio?.alPasar) { capas?.abrirTarjeta(cita, sitio.ancla, sitio.punto, true); return }
    if (capas) { capas.abrirTarjeta(cita, sitio?.ancla ?? null, sitio?.punto); return }
    setModal({ mode: 'edit', appointment: cita })
  }

  /* `arg.el` es la tarjeta pulsada (o la que tenía el foco, con Enter: FC
     manda el `KeyboardEvent`, sin punto). */
  function handleEventClick(arg: EventClickArg) {
    /* F3.2 · LA CITA PULSADA SE ENFOCA ANTES DE ABRIR SU TARJETA. Con el ratón
       no recibe el foco sola: FullCalendar cancela el `mousedown` (es lo que le
       deja arrastrar), así que el foco seguía donde estaba —p. ej. en «›»— y
       `useDialogoModal` lo devolvía ahí al cerrar, no a la cita (diseño §3.2:
       «Escape devuelve el foco a la cita»). Sólo en el camino de la tarjeta:
       con el interruptor apagado el clic hace exactamente lo de hoy.
       ⚠️ EN LAS LISTAS DEL TELÉFONO NO HAY NADA QUE ENFOCAR, y no es de F: con
       `eventContent` propio FullCalendar no monta el `<a>` de la fila, y el
       `<tr>` no admite foco (`focus()` no hace nada). Allí el foco vuelve a lo
       que lo tenía, como antes. */
    if (agendaV2 && interacciones.current && !arg.event.extendedProps.isGcalBlock) arg.el.focus({ preventScroll: true })
    abrirCita(arg.event, { ancla: cajaDe(arg.el), punto: puntoDe(arg.jsEvent) })
  }

  /* ⚠️ `select()` ANTES DE ABRIR EL FORMULARIO, Y ESE ORDEN ES EL PUNTO (§8.4):
     el usuario ve marcado en la rejilla el tramo que va a ocupar antes de que el
     modal lo tape. Aquí NO se llama a `abrirAlta`: `select()` dispara el
     callback `select`, o sea `handleSelect`, que es LA MISMA PUERTA que el
     arrastre sobre la rejilla —mismo bloqueo por suscripción, mismo aviso de
     fuera de horario, mismo `tipo: 'cita'`—. Dos puertas al mismo sitio tienen
     que hacer lo mismo, y ésta lo consigue no siendo una segunda puerta.
     Requiere `selectable`, que en escritorio está encendido. */
  function abrirHueco(t: Tramo) {
    const api = calendarRef.current?.getApi()
    if (!api || !resumenDia) return
    /* ⚠️ EL CIERRE DE SEGURIDAD, Y NO SOBRA POR MUCHO QUE `CardHuecos` YA NO
       PINTE NINGÚN BOTÓN CUANDO FALTAN CITAS. Lo que está al otro lado de esta
       línea es abrir el alta sobre un tramo que puede tener una paciente dentro,
       y eso no puede depender de que una condición de render siga en su sitio
       dentro de seis meses. Es la misma disciplina que la doble guarda de la
       traída de citas: dos puertas al mismo daño. */
    if (citasIncompletas) return
    const base = medianocheDe(resumenDia.dia).getTime()
    /* F3 · `seleccionDesdeHueco`: un hueco de tres horas no propone tres horas
       (decisión 19). La burbuja se ancla al botón del hueco si tiene el foco
       y, si no (Safari no enfoca un botón al pulsarlo), al panel entero. */
    seleccionDesdeHueco.current = { ancla: cajaDe(anclaDelHueco()) }
    api.select(new Date(base + t.desde * 60_000), new Date(base + t.hasta * 60_000))
  }

  return { handleDateClick, handleSelect, handleEventClick, abrirCita, abrirHueco }
}
