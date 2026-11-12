'use client'

/**
 * src/app/(app)/agenda/guardadoCitas.ts
 *
 * El guardado de citas y eventos: mover/redimensionar en el calendario
 * (`handleEventDrop`, `handleEventResize`, con su candado de conversión
 * todo-el-día `esGestoDeTodoElDia` y su `ejecutarDrop` compartido), y el
 * alta/edición/baja del modal (`handleSave`, `handleDelete`). Movido tal cual
 * desde `AgendaCliente.tsx` (A2.5.7, movimiento puro, con sus comentarios);
 * sólo cambiaron los parámetros, el retorno, y que `horario`, `profile`, etc.
 * llegan por parámetro en vez de la clausura del componente.
 *
 * ⚠️ NO ES UN HOOK, Y ES DECISIÓN DEL PASO, NO UN DESCUIDO. Ninguna de las
 * cuatro funciones que devuelve, ni sus ayudantes internos, llaman a
 * `useState`/`useRef`/`useEffect`/`useCallback`: todo lo que necesitan —
 * `calendarRef`, los `setState` del modal, `refetch`, `firmarEscritura`,
 * `aplicarAppointmentAlEvento`— llega por parámetro desde el componente, que
 * es quien de verdad tiene el estado. Nombrarlo `useGuardadoCitas` prometería
 * un hook que no hay y, peor, invitaría a llamarlo condicionalmente o a
 * memoizar su resultado con las reglas de un hook que no le aplican: esta
 * función se vuelve a invocar en cada render del componente (son «frescas»,
 * ver A2.5 §G) y no hay ningún candado de orden que respetar.
 *
 * `pacienteParaInvitacion` se exporta aparte, pura y suelta: la usa este
 * módulo en `handleSave` y también `AgendaCliente.tsx` directo en el botón
 * «Agregar invitados» del modal de edición (`onInvitar`), que no pasa por
 * `handleSave` porque la cita ya existe.
 */

import type { Dispatch, RefObject, SetStateAction } from 'react'
import type FullCalendar from '@fullcalendar/react'
import { Calendar as CalendarioFC, type EventApi, type EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import type { Horario } from '@/lib/configApp'
import type { Profile } from '@/hooks/useProfile'
import type { useToast } from '@/components/ui/Toast'
import { canVerAgendaCompleta } from '@/lib/permissions'
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { buildEventInput, FUENTE_APPOINTMENTS, PREFIJO_OPTIMISTA } from '@/lib/agenda/eventosDeCita'
import { addMinutes, ultimoDiaIncluido } from '@/lib/agenda/fechasAgenda'
import { avisoFueraDeHorario, avisoFinFueraDeHorario } from '@/lib/agenda/horarioAgenda'
import { DEFAULT_DURATION } from '@/lib/agenda/duracionCita'
import { registrarNuevo, salirConAnimacion } from '@/lib/agenda/marcasMovimiento'
import type { Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
import {
  empalmesPintados, esListaDeEmpalmes, mensajeEmpalme, unirAceptados, ESTADOS_SIN_EMPALME, type Empalme,
} from '@/lib/agenda/empalmesCita'

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>

/* Mismas formas que los `useState` de `AgendaCliente.tsx` — duplicadas aquí a
   propósito y no importadas de un tipo compartido, igual que `CalRef` en los
   demás módulos de este paso: son estructuralmente la misma cosa para el
   compilador y no hace falta una abstracción nueva para que coincidan. */
type ConfirmState = { message: string; onConfirm: () => void; onCancel: () => void } | null
type InvitacionState = {
  citaId: string
  paciente: { id: string; nombre: string; correoFicha: string | null } | null
  esperandoEvento: boolean
} | null

/* El paciente tal como lo necesita el modal de invitación. Sale SIEMPRE de la
   cita guardada, nunca del formulario: invitar es un `patch` sobre el evento
   de Google, que refleja la cita tal como está en la base. */
export function pacienteParaInvitacion(cita: Partial<Appointment>) {
  return cita.pacientes
    ? {
        id: cita.pacientes.id,
        nombre: `${cita.pacientes.nombre} ${cita.pacientes.apellidos}`,
        correoFicha: cita.pacientes.email?.trim() || null,
      }
    : null
}

interface Params {
  calendarRef: CalRef
  horario: Horario
  profile: Profile | null
  toast: ReturnType<typeof useToast>
  setConfirm: Dispatch<SetStateAction<ConfirmState>>
  setCitaCreada: Dispatch<SetStateAction<boolean>>
  setInvitacion: Dispatch<SetStateAction<InvitacionState>>
  closeModal: () => void
  refetch: (forzarGoogle?: boolean) => void
  firmarEscritura: () => string
  aplicarAppointmentAlEvento: (appointment: Partial<Appointment> & { id?: string }) => void
  /** El interruptor de la agenda v2: decide si se avisa de empalmes (B7). */
  agendaV2: boolean
}

/** El cuerpo de error de la API de citas, sin creerle la forma a `res.json()`. */
type CuerpoDeError = { error?: string; message?: string; empalmes?: unknown } | null

export function crearGuardadoCitas({
  calendarRef, horario, profile, toast, setConfirm, setCitaCreada, setInvitacion, closeModal,
  refetch, firmarEscritura, aplicarAppointmentAlEvento, agendaV2,
}: Params) {
  /**
   * ¿Hay que REVERTIR este gesto? Devuelve `true` —y ya ha revertido— sólo en
   * una de las dos conversiones posibles. Los dos manejadores salen sin tocar
   * el servidor cuando contesta que sí.
   *
   * ⚠️ LA PREGUNTA ES EL CAMBIO DE TIPO, NO EL DESTINO. `arg.event.allDay` dice
   * dónde CAE el gesto; `extendedProps.all_day` dice qué ERA la fila. Cuando
   * coinciden no hay conversión —moverse dentro de la banda, o dentro de la
   * rejilla— y no hay nada que decidir aquí.
   *
   * ── LAS DOS DIRECCIONES, Y NO SE TRATAN IGUAL ──────────────────────────────
   *
   * · ENTRAR (cita → todo el día): SE REVIERTE. No es una limitación técnica
   *   que algún día se levante: «todo el día» es de EVENTOS y nunca de citas,
   *   porque una cita siempre lleva hora. Es la misma regla que el modal impone
   *   deshabilitando el conmutador «Cita» y que las dos rutas del servidor
   *   cierran con `todo_el_dia_con_paciente`; esto es la tercera copia, en el
   *   único idioma que entiende el ratón.
   *   Y evita además una fila corrupta que el CHECK no atraparía: la mutación
   *   llega con `standardProps.allDay = true` y `applyMutationToEventInstance`
   *   (`@fullcalendar/core/internal-common.js:3807-3811`) hace `forceAllDay` →
   *   `computeAlignedDayRange`. Con `allDayMaintainDuration` en su default
   *   `false` la duración NO se conserva: una cita de 09:00-10:00 quedaría
   *   00:00 → 00:00 del día siguiente. Y `appointments_all_day_medianoche_check`
   *   sólo mira las filas con `all_day` en `true`, así que la base guardaría tan
   *   contenta una cita con hora de 24 horas.
   *
   * · SALIR (todo el día → con hora): SE PERMITE, y esta función contesta
   *   `false` para dejarla pasar. Sacar un evento de la banda a la rejilla es
   *   exactamente lo mismo que apagar el interruptor en el modal, así que el
   *   ratón hace lo que ya hace el formulario. La conversión NO se hace aquí:
   *   la hace el llamador, mandando `all_day: false` junto a los dos instantes
   *   —ver `handleEventDrop`—. ⚠️ Contestar `false` a secas SIN esa rama es lo
   *   que estuvo mal: el gesto caía al camino de citas, mandaba instantes sin
   *   apagar la bandera, la fila se quedaba con `all_day` en `true` y horas que
   *   no son medianoche, y el CHECK la rechazaba con un 400 que el usuario no
   *   podía entender ni evitar.
   *
   * ⚠️ REDIMENSIONAR NO PUEDE LLEGAR A NINGUNA DE LAS DOS. El `computeMutation`
   * del redimensionado (`@fullcalendar/interaction/index.js:1716-1730`) sólo
   * devuelve `startDelta` o `endDelta` y NUNCA toca `standardProps`, así que el
   * tipo de la fila no cambia estirando. La llamada desde `handleEventResize`
   * se queda como red, no como camino vivo.
   *
   * VA ANTES DE LEER `start`/`end` Y ANTES DE CUALQUIER AVISO, a propósito: el
   * `avisoFueraDeHorario` compararía la medianoche y diría «vas a mover la cita
   * a las 00:00», describiendo un cambio de HORA cuando lo que ocurre es un
   * cambio de TIPO. Quien leyera eso y pulsara «sí» no habría consentido lo que
   * iba a pasar.
   */
  function esGestoDeTodoElDia(arg: EventDropArg | EventResizeDoneArg): boolean {
    const caeEnLaBanda   = arg.event.allDay === true
    const eraDeTodoElDia = arg.event.extendedProps.all_day === true
    /* La única prohibida. Las otras tres combinaciones pasan: las dos sin
       conversión, y la salida a la rejilla, que convierte el llamador. */
    if (!(caeEnLaBanda && !eraDeTodoElDia)) return false
    arg.revert()
    /* Ahora sí puede decir «cita» sin mentir: llegar aquí significa que la fila
       de origen NO es de todo el día, y en la banda sólo caben eventos. La
       versión anterior decía «no se puede mover nada», que era cierto entonces
       y hoy prometería lo contrario de lo que este mismo bloque habilita. */
    toast.info('Una cita no puede ser de todo el día.')
    return true
  }

  /* Las dos fechas que el servidor necesita para mover un evento de TODO EL DÍA,
     sacadas del evento que FullCalendar acaba de dejar en su sitio.

     ⚠️ `startStr`/`endStr` Y NO `start`/`end`, exactamente igual que en
     `handleSelect`. `EventImpl` los formatea con `omitTime: this._def.allDay`
     (`@fullcalendar/core/internal-common.js:4123-4139`), así que en una fila de
     todo el día salen ya como `YYYY-MM-DD` pelados. Los `Date` hermanos son
     marcadores en el huso del navegador, y componer la medianoche con el reloj
     del dispositivo es LO QUE EL BLOQUE 5B DECIDIÓ QUE EL CLIENTE NO HACE: la
     zona que vale es la del consultorio y sólo el servidor la conoce.

     ⚠️ EL FIN DE FULLCALENDAR ES EXCLUSIVO Y EL QUE ESPERA EL SERVIDOR ES EL
     ÚLTIMO DÍA INCLUIDO. La conversión es `ultimoDiaIncluido`, que ya existe:
     aquí no se escribe ningún desplazamiento nuevo.

     Sin `endStr` —`hasEnd` en falso— el evento dura un día y el último incluido
     es el primero. */
  function fechasDelGestoDeTodoElDia(evento: EventApi): { desde: string; hasta: string } | null {
    const desde = evento.startStr
    if (!desde) return null
    return { desde, hasta: evento.endStr ? ultimoDiaIncluido(evento.endStr) : desde }
  }

  async function handleEventDrop(arg: EventDropArg) {
    if (arg.event.extendedProps.isGcalBlock) { arg.revert(); return }
    if (esGestoDeTodoElDia(arg)) return
    const id         = arg.event.id

    /* ── MOVER UN EVENTO DE TODO EL DÍA ─────────────────────────────────────
       Sale por aquí y NO por el camino de abajo, que compondría instantes con
       el reloj del navegador. Llegar aquí ya significa que la fila es de todo
       el día: la guarda de arriba corta cualquier otra cosa que caiga en la
       banda.

       ⚠️ Y NO PASA POR `avisoFueraDeHorario`, a propósito. Ese aviso habla de
       horas —«vas a moverlo a las 00:00»— y aquí no hay ninguna que nadie haya
       elegido: la medianoche es un detalle de cómo se guarda la fila, no un dato
       del gesto. Es el mismo razonamiento que ya defiende el orden de la guarda.
       Un evento de todo el día tampoco puede caer «fuera de horario»: ocupa el
       día entero por definición y no reserva hueco. */
    if (arg.event.allDay) {
      const fechas = fechasDelGestoDeTodoElDia(arg.event)
      if (!fechas) { arg.revert(); return }
      ejecutarDrop(id, { all_day: true, all_day_desde: fechas.desde, all_day_hasta: fechas.hasta }, arg)
      return
    }

    const start_time = arg.event.start?.toISOString()
    if (!start_time) { arg.revert(); return }

    /* ── SACAR UN EVENTO DE TODO EL DÍA A LA REJILLA ─────────────────────────
       Llegar aquí con `all_day` en `true` sólo puede significar eso: la guarda
       ya dejó pasar la salida y la rama de arriba se llevó lo que sigue en la
       banda. Es la misma conversión que hace el modal al apagar el interruptor,
       y por eso `all_day: false` tiene que VIAJAR: sin él la fila conservaría la
       bandera con horas que no son medianoche, y el CHECK la rechazaría.

       ⚠️ EL FIN HAY QUE RECOMPONERLO, Y NO ES UN CAPRICHO. Al convertir de todo
       el día a con hora, `computeEventMutation` pone `standardProps.hasEnd` a
       `allDayMaintainDuration`, que en su default es `false`
       (`@fullcalendar/interaction/index.js:1529-1541`). El evento SÍ se pinta
       con una hora —`applyMutationToEventInstance` le da
       `getDefaultEventEnd`— pero el getter público `event.end` mira `hasEnd` y
       devuelve `null` (`@fullcalendar/core/internal-common.js:4118-4122`). O sea
       que sin este respaldo `end_time` saldría `undefined`, el PUT no tocaría la
       columna y la fila se quedaría terminando en la medianoche del día
       siguiente: diez horas en la base contra una en pantalla, y un salto en el
       siguiente refetch.

       ⚠️ Y NO SE INVENTA NINGUNA DURACIÓN: `DEFAULT_DURATION` son 60 minutos y el
       `defaultTimedEventDuration` de FullCalendar es `'01:00:00'`
       (`@fullcalendar/core/internal-common.js:1491`). Son el mismo número, así
       que lo que se guarda es exactamente lo que se está viendo. SI ALGUIEN
       CAMBIA UNO DE LOS DOS, HAY QUE CAMBIAR EL OTRO — hoy coinciden por valor y
       nada lo comprueba. */
    const dejaDeSerDeTodoElDia = arg.event.extendedProps.all_day === true
    const end_time = arg.event.end?.toISOString()
      ?? (dejaDeSerDeTodoElDia ? addMinutes(start_time, DEFAULT_DURATION) : undefined)
    const puntas: PuntasDelMovimiento = dejaDeSerDeTodoElDia
      ? { start_time, end_time, all_day: false }
      : { start_time, end_time }

    /* Arrastrar mueve el bloque entero: si el inicio queda dentro, el fin
       puede haberse salido igual (una cita de dos horas movida a las 18:00
       con horario hasta las 19:00).

       ⚠️ AQUÍ EL AVISO SÍ CORRE, Y ES LO CONTRARIO DE LA RAMA DE ENTRADA. Allí
       se calla porque no hay ninguna hora que nadie haya elegido; aquí el evento
       ACABA DE ESTRENAR una, y esa hora puede caer fuera del horario de la
       clínica igual que la de cualquier cita.

       El fin se mira desde `end_time` y no desde `arg.event.end`, que en la
       conversión es `null` por lo explicado arriba: con el getter, el aviso del
       fin se saltaba justo en el único caso donde el fin es nuevo. */
    const aviso = avisoFueraDeHorario(arg.event.start!, horario, 'Vas a moverlo a las')
      ?? (end_time ? avisoFinFueraDeHorario(new Date(end_time), horario) : null)
    /* B7b: el empalme va DESPUÉS del aviso de horario, y si los dos aplican
       salen seguidos, no uno combinado (P3). */
    const seguir = () => seguirSiNoSeEmpalma(arg, start_time, end_time, (aceptados) => ejecutarDrop(id, puntas, arg, aceptados))
    if (aviso) {
      setConfirm({
        message: aviso,
        onConfirm: () => { setConfirm(null); seguir() },
        onCancel:  () => { setConfirm(null); restaurarPosicion(arg) },
      })
      return
    }

    // Sin updated_at — drag & drop no requiere chequeo de concurrencia
    // FullCalendar ya movió el evento visualmente — solo sincronizar con servidor
    seguir()
  }

  /* Las dos formas del cuerpo de un movimiento, y NUNCA las cuatro claves a la
     vez. Es el mismo reparto que ya hace el modal en `DatosGuardado`, y por el
     mismo motivo: una fila de todo el día manda DÍAS y deja que el servidor
     componga la medianoche con la zona del consultorio. */
  type PuntasDelMovimiento =
    /* `all_day: false` sólo viaja cuando la fila DEJA de ser de todo el día. En
       un movimiento normal se omite, y el PUT no toca la columna: sólo la
       escribe si el campo viene. Por eso es opcional y no un booleano siempre
       presente — mandar `false` en cada arrastre convertiría un `UPDATE` de dos
       columnas en uno de tres sin que nadie lo hubiera pedido. */
    | { start_time: string; end_time: string | undefined; all_day?: false }
    | { all_day: true; all_day_desde: string; all_day_hasta: string }

  /* Deshace un gesto MÁS TARDE que en el propio manejador: al «Cancelar» del
     aviso de fuera de horario y cuando el PUT falla (E5-DT-8, B2).

     ⚠️ AQUÍ NO VALE `arg.revert()`, Y ESTÁ MEDIDO. `revert()` mergea la copia
     de antes del gesto indexada por su `defId` interno
     (`@fullcalendar/interaction/index.js:1389-1393`). El candado del gesto ya
     se soltó en `eventDragStop`, así que mientras el aviso está abierto o el
     PUT vuela puede entrar un `refetch()` (reconexión, foco tras 2 min): la
     cita se vuelve a parsear con un `defId` nuevo, el viejo ya no existe y
     `revert()` AÑADE una segunda tarjeta en vez de sustituir. Es el mismo
     mecanismo que describe la nota del candado en `useFuentesAgenda.ts`.
     `e2e/agenda-candado-gesto.e2e.ts` lo reproduce por las dos vías.

     `setDates` muta el evento VIVO, sea cual sea su `defId`: sin traída de por
     medio lo devuelve a su sitio; tras una traída ya está donde dice la base
     (que nunca recibió el cambio) y el delta es cero. Si la cita ya no está
     pintada —la borraron entretanto— no hay nada que devolver: `revert()` la
     resucitaría. Los `arg.revert()` SÍNCRONOS de los manejadores se quedan:
     ahí no hay hueco para que entre ninguna traída. */
  function restaurarPosicion(arg: EventDropArg | EventResizeDoneArg): void {
    const viejo = arg.oldEvent
    if (!viejo.start) return
    calendarRef.current?.getApi().getEventById(arg.event.id)
      ?.setDates(viejo.start, viejo.end, { allDay: viejo.allDay })
  }

  /* ── B7b: EL AVISO DE EMPALME DEL GESTO ────────────────────────────────
     Se pregunta con el gesto YA CERRADO (`eventDrop`/`eventResize`), leyendo
     lo pintado de forma síncrona: nada de traídas a mitad del gesto, y nada de
     `eventOverlap`/`eventAllow`, que bloquean y sólo ven lo pintado. No
     bloquea: «Aceptar» guarda con los ids aceptados; «Cancelar» deshace con
     `restaurarPosicion` (B2), nunca con `arg.revert()`, porque el aviso deja
     abierta la misma ventana en la que una traída duplicaba la tarjeta.
     Con el interruptor apagado no se mira nada y el gesto sigue como hoy. */
  function preguntarEmpalme(lista: readonly Empalme[], aceptar: () => void, cancelar: () => void): void {
    setConfirm({
      message:   mensajeEmpalme(lista),
      onConfirm: () => { setConfirm(null); aceptar() },
      onCancel:  () => { setConfirm(null); cancelar() },
    })
  }

  function seguirSiNoSeEmpalma(
    arg: EventDropArg | EventResizeDoneArg, inicio: string, fin: string | undefined,
    despues: (aceptados: string[]) => void,
  ): void {
    const api = calendarRef.current?.getApi()
    if (!agendaV2 || !api) { despues([]); return }
    const finEfectivo = fin ?? addMinutes(inicio, DEFAULT_DURATION)
    const medico = arg.event.extendedProps.medico_id
    const lista = empalmesPintados({
      id: arg.event.id, medicoId: typeof medico === 'string' ? medico : null,
      inicio: new Date(inicio), fin: new Date(finEfectivo), todoElDia: false,
      noOcupa: ESTADOS_SIN_EMPALME.includes(String(arg.event.extendedProps.status)),
      deGoogle: false, titulo: arg.event.title,
    }, api.getEvents())
    if (!lista.length) { despues([]); return }
    preguntarEmpalme(lista, () => despues(lista.map(e => e.id)), () => restaurarPosicion(arg))
  }

  async function ejecutarDrop(
    id: string, puntas: PuntasDelMovimiento, arg: EventDropArg | EventResizeDoneArg, aceptados: readonly string[] = [],
  ) {
    // Guarda: un id temporal no existe en la base, el PUT devolveria un error
    // sin sentido. El evento optimista ya nace con `editable: false`, asi que
    // esto solo cubre cualquier camino futuro que se nos escape.
    if (id.startsWith(PREFIJO_OPTIMISTA)) { arg.revert(); return }

    /* A1.5a: se vacía también al SALIR la escritura. Si no, navegar fuera y
       volver mientras está en vuelo sirve la semana de antes encima de lo
       optimista, y el eco propio —que se ignora— no lo repone. */
    vaciarCacheCitas()
    const res = await fetch(`/api/appointments/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      // `client_id` firma la escritura para que el eco de Realtime se
      // reconozca como propio (ver `firmarEscritura`).
      /* `empalmes_aceptados` sólo viaja si hay alguno (B7): con el interruptor
         apagado el cuerpo es el de siempre. */
      body:    JSON.stringify({ ...puntas, client_id: firmarEscritura(), ...(aceptados.length ? { empalmes_aceptados: aceptados } : {}) }),
    })
    // A1.5a: arrastre y redimensionado, salga bien o se revierta.
    vaciarCacheCitas()

    if (!res.ok) {
      /* B7b: un 409 `empalme` es lo que lo pintado no veía (otra persona, otra
         semana, el techo). Se atiende SIEMPRE, aunque el cliente crea el
         interruptor apagado: la tarjeta sigue en su sitio nuevo mientras se
         pregunta, y «Cancelar» la devuelve. Cualquier otro fallo, como hoy. */
      if (res.status === 409) {
        const cuerpo: CuerpoDeError = await res.json().catch(() => null)
        const lista = cuerpo?.error === 'empalme' && esListaDeEmpalmes(cuerpo.empalmes) ? cuerpo.empalmes : null
        if (lista) {
          preguntarEmpalme(lista, () => ejecutarDrop(id, puntas, arg, unirAceptados(aceptados, lista)), () => restaurarPosicion(arg))
          return
        }
        restaurarPosicion(arg)
        toast.error(cuerpo ? (cuerpo.message || cuerpo.error || 'Error de conexión — se devolvió a su horario original') : 'Error desconocido')
        return
      }
      restaurarPosicion(arg)
      const { error, message } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(message || error || 'Error de conexión — se devolvió a su horario original')
      return
    }

    /* Decía «Cita reagendada» y ahora va en neutro, porque este camino mueve
       también EVENTOS genéricos. ⚠️ Y NO DICE «Horario actualizado», que fue el
       primer intento: ésa es palabra por palabra la que ya usa el guardado del
       HORARIO DE LA CLÍNICA (`HorarioModal`, más abajo). Dos acciones muy
       distintas con el mismo acuse enseñan a no leerlo. */
    toast.success('Se movió en la agenda')

    // Sin esto, extendedProps.updated_at se queda con el valor de la carga
    // inicial y la siguiente edicion por formulario falla con 409.
    const json = await res.json().catch(() => null)
    if (json?.appointment) aplicarAppointmentAlEvento(json.appointment)

    // Glow verde de confirmación
    const el = arg.el as HTMLElement | null
    if (el) {
      el.classList.add('fc-event-drop-success')
      setTimeout(() => el.classList.remove('fc-event-drop-success'), 700)
    }
  }

  async function handleEventResize(arg: EventResizeDoneArg) {
    if (arg.event.extendedProps.isGcalBlock) { arg.revert(); return }
    if (esGestoDeTodoElDia(arg)) return
    const id         = arg.event.id

    /* ── ESTIRAR UN EVENTO DE TODO EL DÍA SÍ SIGNIFICA ALGO, y por eso tiene
       rama propia en vez de quedarse revirtiendo. En la banda el gesto es
       HORIZONTAL: arrastrar el borde derecho de un evento del 19 lo lleva al 22,
       que es exactamente «dura cuatro días» — el mismo dato que el campo del
       último día del modal, dicho con el ratón. Sin esto, la única forma de
       alargar un evento sería abrir el modal, que es peor y además incoherente
       con que la banda ya acepte el arrastre.

       Mismo cuerpo y mismas dos exclusiones que el movimiento: fechas de sólo
       día, y sin aviso de fuera de horario. */
    if (arg.event.allDay) {
      const fechas = fechasDelGestoDeTodoElDia(arg.event)
      if (!fechas) { arg.revert(); return }
      ejecutarDrop(id, { all_day: true, all_day_desde: fechas.desde, all_day_hasta: fechas.hasta }, arg)
      return
    }

    const start_time = arg.event.start?.toISOString()
    const end_time   = arg.event.end?.toISOString()
    if (!start_time) { arg.revert(); return }

    /* Redimensionar no avisaba de nada, y es el gesto que MÁS fácil saca una
       cita del horario sin tocar su inicio: estirar de 18:00-19:00 a
       18:00-21:00 con horario hasta las 19:00 deja el inicio intacto. Por eso
       aquí el FIN importa tanto como el inicio — `eventResizableFromStart`
       está puesto, así que se puede arrastrar cualquiera de los dos bordes. */
    const aviso = avisoFueraDeHorario(arg.event.start!, horario, 'Empezaría a las')
      ?? (arg.event.end ? avisoFinFueraDeHorario(arg.event.end, horario) : null)
    // B7b: como en el arrastre, el empalme después del aviso de horario.
    const seguir = () => seguirSiNoSeEmpalma(arg, start_time, end_time, (aceptados) => ejecutarDrop(id, { start_time, end_time }, arg, aceptados))
    if (aviso) {
      setConfirm({
        message: aviso,
        onConfirm: () => { setConfirm(null); seguir() },
        onCancel:  () => { setConfirm(null); restaurarPosicion(arg) },
      })
      return
    }

    seguir()
  }

  /* `reintentoEmpalme`: el reenvío tras aceptar un 409 `empalme` (B7c). El
     acuse optimista ya salió en el primer intento; repetirlo antes de saber si
     el segundo entra sería anunciar un éxito que todavía no hay. */
  async function handleSave(data: DatosGuardado, reintentoEmpalme = false) {
    const isEdit = !!data.id
    const api = calendarRef.current?.getApi()

    // ── Optimistic update: inyectar/actualizar evento en FullCalendar al instante ──
    closeModal()
    /* ⚠️ SIN LA PALABRA «CITA», Y NO ES DESCUIDO. Este mismo camino guarda CITAS
       y EVENTOS genéricos —unas vacaciones acababan saliendo como «Cita
       creada»—, así que el acuse va en neutro.
       Y en neutro EN VEZ DE ramificar, que fue lo primero que se probó: «cita» es
       femenino y «evento» masculino, de modo que una plantilla con el sustantivo
       dentro arrastra la concordancia de todo el participio («actualizada» /
       «actualizado») y acaba siendo dos frases escritas como una. Cuando la frase
       neutra sale natural, gana. Donde no —el botón de eliminar del modal, que es
       un control con etiqueta— sí se ramifica. */
    if (!reintentoEmpalme) toast.success(isEdit ? 'Cambios guardados' : 'Se agendó correctamente')
    if (!isEdit) setCitaCreada(true)

    let optimisticEvent: ReturnType<NonNullable<typeof api>['addEvent']> | null = null

    if (api) {
      if (isEdit) {
        // Actualizar el evento existente in-place
        const existing = api.getEventById(data.id!)
        if (existing) {
          /* A1-bis.1: las once mutaciones en un solo repintado. Ver la nota de
             `aplicarAppointmentAlEvento`. */
          const mutar = () => {
            if (data.start_time) existing.setStart(data.start_time)
            if (data.end_time)   existing.setEnd(data.end_time)
            if (data.title)      existing.setProp('title', data.title)
            // Actualizar extendedProps con el status nuevo. Ya no se copia
            // ningún `colorStyle`: el color se deriva del status al pintar, así
            // que basta con que el status esté al día.
            existing.setExtendedProp('status', data.status ?? existing.extendedProps.status)
            existing.setExtendedProp('notes', data.notes ?? existing.extendedProps.notes)
            existing.setExtendedProp('pacientes', data.pacientes ?? null)
            // La pinta del evento genérico. Va en la tanda optimista como el
            // resto: sin esto, cambiar el color no se vería hasta que respondiera
            // el servidor. `?? null` y no `??  lo que había`: el modal manda
            // siempre las dos, y en una cita manda null a propósito.
            existing.setExtendedProp('icono', data.icono ?? null)
            existing.setExtendedProp('color', data.color ?? null)
            // F3-6 fix Bug 1: actualizar también médico y consultorio_id (optimistic).
            // El chip de iniciales sale de `medico_id` al pintar, así que basta con esto.
            existing.setExtendedProp('medico_id', data.medico_id ?? null)
            existing.setExtendedProp('consultorio_id', data.consultorio_id ?? existing.extendedProps.consultorio_id)
          }
          if (api instanceof CalendarioFC) api.batchRendering(mutar)
          else mutar()
        }
      } else {
        // Crear evento optimista temporal. `editable: false` cubre arrastre y
        // redimension a la vez: una cita que todavia no existe en la base no
        // tiene id que mandarle al servidor, solo el temporal.
        const entrada = { ...buildEventInput(data), editable: false }
        /* F2.4: la cita que acabas de crear entra animada, y SÓLO ella. Se
           registra ANTES de `addEvent`, que pinta en síncrono y lee la marca
           en `eventClassNames` (ver `marcasMovimiento.ts`). La real que la
           sustituye abajo NO se registra: ésta ya entró en el mismo sitio. */
        if (typeof entrada.id === 'string') registrarNuevo(entrada.id)
        optimisticEvent = api.addEvent(entrada, FUENTE_APPOINTMENTS)
      }
    }

    // ── Llamada real al API ──
    // La firma hace dos cosas según el verbo: en el PUT identifica el eco de
    // Realtime como propio; en el POST es además la clave de idempotencia, y
    // un doble clic o un reintento devuelven la MISMA cita en vez de crear
    // otra (ver `firmarEscritura` y el manejo del 23505 en la ruta).
    vaciarCacheCitas() // A1.5a: también al salir; ver `ejecutarDrop`.
    const res = await fetch(
      isEdit ? `/api/appointments/${data.id}` : '/api/appointments',
      {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, client_id: firmarEscritura() }),
      }
    )
    // A1.5a: alta o edición, y antes del `refetch()` de su rollback.
    vaciarCacheCitas()

    if (!res.ok) {
      // Rollback: remover evento optimista y refrescar desde servidor
      if (optimisticEvent) optimisticEvent.remove()
      refetch()
      const cuerpo: CuerpoDeError = await res.json().catch(() => null)
      /* B7c: un 409 `empalme` es lo que el modal no vio pintado (otra semana,
         otro médico fuera del filtro, otra persona). Ya se deshizo lo
         optimista; se pregunta y, si se acepta, se reenvía lo mismo con los
         ids. El modal ya se cerró: «Cancelar» deja la agenda como estaba. */
      if (res.status === 409 && cuerpo?.error === 'empalme' && esListaDeEmpalmes(cuerpo.empalmes)) {
        const lista = cuerpo.empalmes
        preguntarEmpalme(
          lista,
          () => { void handleSave({ ...data, empalmes_aceptados: unirAceptados(data.empalmes_aceptados ?? [], lista) }, true) },
          () => toast.info('No se guardó: la agenda se quedó como estaba.'),
        )
        return
      }
      toast.error(cuerpo ? (cuerpo.message || cuerpo.error || 'No se pudo guardar') : 'Error desconocido')
      return
    }

    const json = await res.json()
    // B7c: el reintento se acusa cuando de verdad entró (ver el parámetro).
    if (reintentoEmpalme) toast.success(isEdit ? 'Cambios guardados' : 'Se agendó correctamente')

    if (isEdit && json.appointment) {
      aplicarAppointmentAlEvento(json.appointment)
    }

    if (!isEdit && json.appointment?.id) {
      // Reemplazar evento optimista con el real (que tiene ID de DB). Si un
      // refetch corrio durante el POST, la cita ya llego del servidor: hay que
      // re-hidratarla, no agregarla de nuevo — serian dos con el mismo id.
      //
      // ⚠️ NO SE EXIGE `optimisticEvent`, Y EL `?.` HOY ES UNA RED, NO UNA MULETA.
      // Nació siéndolo: el alta de todo el día manda FECHAS en vez de
      // `start_time`, `buildEventInput` salía sin `start`, `addEvent` devolvía
      // `null` y la condición vieja —que exigía el evento optimista— se llevaba
      // por delante también el alta REAL, que no aparecía hasta el siguiente
      // refetch. Eso YA NO PASA: `puntasParaLaRejilla` lee `all_day_desde` /
      // `all_day_hasta` y el evento optimista de todo el día se crea como
      // cualquier otro, así que aquí llega un objeto de verdad.
      //
      // El `?.` se queda de todas formas, y no por inercia: `addEvent` devuelve
      // `null` ante CUALQUIER `EventInput` que FullCalendar no sepa parsear, y
      // esta línea no debe ser la que rompa un alta que por lo demás salió bien.
      // Lo que ya no hay que hacer es leerlo como «aquí falta un caso».
      /* F2.4: quitar la optimista y poner la real en UN solo repintado, para
         que la tarjeta no pase ni un render sin estar y `eventsSet` salga una
         vez. `aplicarAppointmentAlEvento` agrupa por su cuenta, y
         `batchRendering` anidado no repinta hasta el último `resume`. */
      const sustituir = () => {
        optimisticEvent?.remove()
        const yaPresente = api?.getEventById(json.appointment.id)
        if (yaPresente) {
          aplicarAppointmentAlEvento(json.appointment)
        } else {
          api?.addEvent(buildEventInput({ ...data, ...json.appointment }), FUENTE_APPOINTMENTS)
        }
      }
      if (api instanceof CalendarioFC) api.batchRendering(sustituir)
      else sustituir()
    }

    // 'pending' es el caso normal —Google conectado, la escritura corre en el
    // after() de la ruta— y no debe sonar a problema. 'disconnected' sí lo es y
    // es lo único accionable: el médico tiene que ir a conectar Google.
    // 'skipped' (sólo al editar) es que no había nada que sincronizar.
    //
    // PENDIENTE: que la sincronización falle DESPUÉS de decir "sincronizando"
    // sigue sin verse. Para eso la agenda tendría que releer `gcal_sync_status`
    // cuando el trabajo de fondo termina; es otra rama.
    if (json.gcalSync === 'disconnected') {
      toast.info('Sin conexión con Google Calendar — se sincronizará pronto.')
    } else if (json.gcalSync === 'pending') {
      toast.info('Sincronizando con Google…')
    }

    /* ── LA INVITACIÓN SE OFRECE AL CREAR, Y SÓLO AL CREAR ──────────────────
       Antes había que guardar, volver a abrir la cita y pulsar el botón, porque
       al cerrar el modal el evento de Google todavía no existía. Fricción
       gratuita: se ofrece aquí mismo, y el modal espera al evento.

       NO al editar, y es decisión: una vez que alguien está en la lista de
       asistentes, Google le avisa SOLO de cada cambio que Spinus haga sobre el
       evento. Preguntar en cada edición sería resolver un problema que Google ya
       resuelve, y lo que cansa se cierra sin leer.

       Tres condiciones, y ninguna sobra:
        · sólo en el alta;
        · `gcalSync === 'pending'` — con 'disconnected' no hay conexión y el
          evento no va a existir NUNCA, así que el modal se abriría a esperar
          algo que no llega;
        · el permiso, o un médico invitado recibiría un modal condenado a un 403
          (el gate de verdad está en la ruta; esto sólo evita el paseo). */
    if (!isEdit && json.gcalSync === 'pending' && canVerAgendaCompleta(profile) && json.appointment?.id) {
      setInvitacion({
        citaId: json.appointment.id,
        paciente: pacienteParaInvitacion(json.appointment),
        esperandoEvento: true,
      })
    }
  }

  async function handleDelete(id: string) {
    closeModal()
    toast.success('Se eliminó de la agenda')

    // Optimistic: remover evento del calendario al instante.
    // Sin firma de escritura, y no hace falta: el eco de un DELETE llega
    // podado a `{ id }` —la RLS no puede evaluarse sobre una fila que ya no
    // existe—, así que ni siquiera traería el `client_id`. Como esta baja ya
    // quitó el evento, su propio eco no encuentra nada que quitar.
    /* F2.5: la tarjeta se desvanece (`--ag-dur-micro`) y DESPUÉS se quita;
       sin `Calendar` (no debería pasar) se quita de golpe, como antes. La
       única verdad sigue siendo el almacén de FullCalendar: ver
       `salirConAnimacion`. El rollback no cambia: el `refetch()` trae la cita
       como un objeto nuevo, sin la marca, y el temporizador no lo toca. */
    const api = calendarRef.current?.getApi()
    if (api instanceof CalendarioFC) salirConAnimacion(api, id)
    else api?.getEventById(id)?.remove()

    vaciarCacheCitas() // A1.5a: también al salir; ver `ejecutarDrop`.
    const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    vaciarCacheCitas() // A1.5a: baja, y antes del `refetch()` de su rollback.
    if (!res.ok) {
      // Rollback: restaurar estado desde servidor
      refetch()
      /* El 409 `cita_con_paciente` (B3) sólo sale con el interruptor encendido
         y una pestaña que aún no lo sabía: se dice por qué. Cualquier otro
         fallo conserva el aviso de siempre. */
      const cuerpo: { error?: string; message?: string } | null = await res.json().catch(() => null)
      toast.error(cuerpo?.error === 'cita_con_paciente' && cuerpo.message ? cuerpo.message : 'No se pudo eliminar')
    }
  }

  /* B3: «eliminar» una cita con paciente, con el interruptor encendido, la
     CANCELA. Mismo camino que cambiar el estado en el modal —el PUT de
     siempre—, así que el `after()` de la ruta ya marca el evento de Google
     con «CANCELADA — » en vez de borrarlo (P4), y la auditoría la deja el
     disparador de B0 (`cita_cancelada`). La tarjeta se queda, en cancelada. */
  async function handleCancelar(id: string) {
    closeModal()
    toast.success('Se canceló la cita')
    const evento = calendarRef.current?.getApi().getEventById(id)
    evento?.setExtendedProp('status', 'cancelled')

    vaciarCacheCitas() // A1.5a: también al salir; ver `ejecutarDrop`.
    const res = await fetch(`/api/appointments/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'cancelled', client_id: firmarEscritura() }),
    })
    vaciarCacheCitas()

    if (!res.ok) {
      refetch()
      const cuerpo: { error?: string; message?: string } | null = await res.json().catch(() => null)
      toast.error(cuerpo?.message || cuerpo?.error || 'No se pudo cancelar')
      return
    }
    const json: { appointment?: Partial<Appointment> & { id?: string } } | null = await res.json().catch(() => null)
    if (json?.appointment) aplicarAppointmentAlEvento(json.appointment)
  }

  return { handleEventDrop, handleEventResize, handleSave, handleDelete, handleCancelar }
}
