'use client'

/**
 * src/app/(app)/agenda/useTiempoRealAgenda.ts
 *
 * La agenda compartida: el canal de Supabase Realtime sobre `appointments`
 * (E12), el refetch al volver a la pestaña tras 2 min (E13), el eco propio
 * (`escriturasPropias`, UN solo `Set` por instancia, que comparten este canal
 * y el guardado vía `firmarEscritura`) y la fusión de una fila canónica en el
 * evento ya pintado (`aplicarAppointmentAlEvento` → `fusionarCitaEnEvento`,
 * nombre que cita una migración: no se renombra). Movido tal cual desde
 * `AgendaCliente.tsx` (A2.5.6, movimiento puro, con sus comentarios); sólo
 * cambiaron los parámetros y el retorno. `refetch` llega estable de
 * `useFuentesAgenda`, así que las deps `[refetch]` del canal no lo vuelven a
 * suscribir: un solo `join` por apertura.
 */

import { useEffect, useRef, type RefObject } from 'react'
import type FullCalendar from '@fullcalendar/react'
import { Calendar as CalendarioFC, type CalendarApi } from '@fullcalendar/core'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { buildEventInput, FUENTE_APPOINTMENTS } from '@/lib/agenda/eventosDeCita'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { esCancelacionAjena } from '@/lib/agenda/avisoCancelacion'
import { registrarNuevo, salirConAnimacion } from '@/lib/agenda/marcasMovimiento'

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>

/**
 * Una fila de `appointments` tal como llega por Realtime: columnas de la
 * tabla y nada más. Los joins de `Appointment` (`pacientes`, `medico`) NO
 * viajan en el payload de `postgres_changes` — por eso están fuera del tipo,
 * para que el compilador impida leerlos de ahí.
 *
 * `client_id` es la firma de la escritura que la produjo (ver
 * `firmarEscritura`).
 */
type FilaRealtime = Omit<Appointment, 'pacientes' | 'medico'> & {
  clinica_id: string
  client_id: string | null
}

/* Antigüedad a partir de la cual volver a la pestaña sí pide datos otra vez.
   Ver el efecto de `visibilitychange`, que es quien lo justifica. */
const UMBRAL_REFETCH_FOCO_MS = 120_000

interface Params {
  calendarRef: CalRef
  filtroEfectivo: string | null
  refetch: (forzarGoogle?: boolean) => void
  ultimaTraidaRef: RefObject<number>
  /** E8: una cita PINTADA pasó a cancelada por un cambio ajeno (no eco propio).
   *  Sólo con la agenda v2 encendida; apagada, el padre no lo pasa. */
  onCanceladaAjena?: (id: string) => void
}

export function useTiempoRealAgenda({ calendarRef, filtroEfectivo, refetch, ultimaTraidaRef, onCanceladaAjena }: Params) {
  /**
   * Re-hidrata un evento del calendario con la fila canónica que devolvió el
   * servidor. Recorre `extendedProps` y FUSIONA clave por clave: no sustituye
   * el objeto en bloque. Antes se sincronizaban 6 campos a mano y `updated_at`
   * no estaba entre ellos, así que el segundo guardado de una misma cita
   * mandaba un valor viejo y el servidor respondía 409; de ahí que hoy se
   * recorra todo lo que llega en vez de una lista escrita a mano.
   *
   * QUE FUSIONE NO ES UN DESCUIDO: una clave AUSENTE conserva a propósito el
   * valor ya pintado, y de eso depende algo concreto. `appointments` se
   * publica en Realtime con `REPLICA IDENTITY` en default, y con esa identidad
   * walrus no puede reconstruir las columnas TOAST que el UPDATE no tocó: una
   * `notes` larga que nadie editó NO viaja en el payload. Al fusionar, esa
   * clave ausente deja en pie la nota que ya estaba, que es la correcta.
   *
   * Cambiarlo a un reemplazo en bloque la borraría de la tarjeta sin que nada
   * falle, y el siguiente guardado desde el modal escribiría ese vacío en la
   * base. Rompe igual a cualquier llamador que pase un `Partial<Appointment>`
   * incompleto. Ver la nota de
   * `supabase/migrations/20260816_agenda_realtime_appointments.sql`, que
   * apunta a esta función por su nombre.
   */
  function aplicarAppointmentAlEvento(appointment: Partial<Appointment> & { id?: string }) {
    /* ⚠️ A1-bis.1 · UN SOLO REPINTADO PARA TODA LA TANDA. `fusionarCitaEnEvento`
       hace un `setDates`, un `setProp` y un `setExtendedProp` POR CLAVE, y cada
       uno es una mutación propia: sin agrupar, cada una repintaba FullCalendar
       entero y emitía su `eventsSet` —~34 por cita; medido: 303 ms y una tarea
       larga con 180 eventos en la semana, en CADA agenda abierta, por cada
       UPDATE de Realtime—. Dentro de `batchRendering` el estado se muta igual,
       paso a paso; sólo el repintado, y con él un único `eventsSet`, espera al
       final. Los manejadores de `eventsSet` calculan sobre el estado FINAL, que
       es el mismo que veía el último de los 34.
       `instanceof` y no `as`: `getApi()` está tipado como `CalendarApi`, que no
       declara `batchRendering`. Si no fuera un `Calendar`, se muta sin agrupar,
       como antes. */
    const api = calendarRef.current?.getApi()
    if (api instanceof CalendarioFC) api.batchRendering(() => fusionarCitaEnEvento(appointment))
    else fusionarCitaEnEvento(appointment)
  }

  /** El cuerpo de `aplicarAppointmentAlEvento`, sin agrupar. Ver su nota. */
  function fusionarCitaEnEvento(appointment: Partial<Appointment> & { id?: string }) {
    if (!appointment?.id) return
    const existing = calendarRef.current?.getApi()?.getEventById(appointment.id)
    if (!existing) return

    const input = buildEventInput(appointment)
    /* ── LAS DOS PUNTAS Y EL TIPO, EN UNA SOLA MUTACIÓN ──────────────────────
       `setStart` + `setEnd` no valen desde el bloque 5B, y por dos motivos a la
       vez: aplicaban los INSTANTES tal cual —una fila de todo el día quiere
       fechas-solo en la zona de su consultorio— y ninguno de los dos toca
       `allDay`, así que un evento que pasara a ser de todo el día se quedaba
       como bloque de 24 h en la rejilla. `setDates` es el único de los tres que
       acepta las tres cosas juntas (`internal-common.d.ts:350-353`).

       Lo que le damos sale de `puntasParaLaRejilla`, el MISMO helper que
       alimenta a la fuente y a `buildEventInput`. No es una segunda conversión:
       es la misma, y por eso el evento repintado por Realtime cae en el mismo
       día que si se hubiera traído del servidor.

       ⚠️ SÍ FUNCIONA CUANDO CAMBIA EL TIPO, y lo comprobé antes de escribirlo
       porque parecía que no. `setDates` es aritmética de DELTAS sobre lo que ya
       está en pantalla, así que convertir una cita con hora en un evento de todo
       el día parecía comparar dos cosas incomparables. No lo son, porque la
       alineación se aplica DOS VECES y se cancela: `setDates` calcula el delta
       contra `computeAlignedDayRange(rango)` (`internal-common.js:3980-3986`) y
       `applyMutationToEventInstance` vuelve a alinear el MISMO rango antes de
       sumarlo (`:3810-3812`). Como `computeAlignedDayRange` es idempotente sobre
       un rango ya alineado (`:2730-2735`), el resultado aterriza EXACTAMENTE en
       los marcadores que pasamos. En el sentido contrario no hay alineación en
       ninguno de los dos lados y el delta es directo.

       ⚠️ Y POR ESO NO SE QUITA Y SE VUELVE A AÑADIR, que era la otra salida.
       `remove()` + `addEvent(buildEventInput(...))` es un REEMPLAZO EN BLOQUE, y
       eso destruiría justo lo que el aviso de aquí arriba protege: `appointment`
       llega PARCIAL —Realtime no manda las columnas TOAST que el UPDATE no tocó—
       así que una `notes` larga que nadie editó desaparecería de la tarjeta sin
       que fallara nada. La fusión clave por clave de abajo es obligatoria, y
       `setDates` es la única forma de mover las fechas sin romperla.

       Sin `start` no se llama: una fila sin puntas no tiene nada que mover, y
       `setDates` con `undefined` no haría nada bueno. */
    if (typeof input.start === 'string') {
      existing.setDates(input.start, input.end ?? null, { allDay: input.allDay === true })
    }
    existing.setProp('title', appointment.title ?? '')
    /* Ya no se sincroniza `textColor`: `buildEventInput` no lo pone —el color
       de estado lo pinta `eventContent` desde los tokens— así que esta línea
       había quedado en una guarda que nunca se cumplía. */

    for (const [clave, valor] of Object.entries(input.extendedProps ?? {})) {
      existing.setExtendedProp(clave, valor)
    }
  }

  /* ── Supabase Realtime — la agenda compartida ───────────
   *
   * La secretaria agenda desde su computadora y al médico le aparece en la
   * suya. Cada cambio se aplica al evento que le toca: NUNCA un refetch del
   * rango por un cambio individual (la única excepción es la reconexión, más
   * abajo). Dos peticiones completas por cada cita que agenda la secretaria
   * es justo lo que esto viene a evitar.
   *
   * AISLAMIENTO ENTRE CLÍNICAS — no lo hace este código, lo hace la RLS.
   * Realtime evalúa `appointments_select` fila por fila y suscriptor por
   * suscriptor (`realtime.apply_rls` relee la fila por su llave primaria con
   * el rol y los claims JWT de cada quien), así que los INSERT y UPDATE de
   * otra clínica no llegan aquí siquiera. Por eso el canal no lleva `filter`
   * de `clinica_id`: no añadiría seguridad y en los DELETE ni se aplica.
   *
   * LOS BORRADOS SON DISTINTOS. La RLS no puede evaluarse sobre una fila que
   * ya no existe, así que Supabase manda TODOS los DELETE a TODOS los
   * suscriptos de la tabla — y precisamente por eso poda el payload a la
   * llave primaria cuando la tabla tiene RLS. Llega un uuid y nada más: sin
   * título, sin paciente, sin clínica. No hay fuga y no hay nada que filtrar;
   * si ese uuid no está pintado aquí (porque era de otra clínica), quitarlo
   * es una operación vacía. Cambiar `REPLICA IDENTITY` a `full` no traería
   * más datos —la poda es por RLS, no por identidad de réplica—, sólo WAL.
   *
   * LÍMITE CONOCIDO, ACEPTADO, NO TAPAR CON UN REFETCH: a un médico invitado
   * (no admin) que pierde una cita porque se la reasignaron a otro médico no
   * le llega ningún evento. `appointments_select` sólo le deja ver
   * `medico_id = auth.uid()`, y la comprobación de Realtime corre sobre la
   * fila YA reasignada: da false y el UPDATE no se entrega. Es un no-evento,
   * no hay nada que escuchar. Su tarjeta se queda obsoleta hasta la siguiente
   * recarga o reconexión. Sondear la agenda para cubrir este caso costaría
   * más que el caso mismo.
   */

  /* UUID de cada escritura que sale de ESTA pestaña. El servidor lo guarda en
     `appointments.client_id` y Realtime lo devuelve dentro del payload: así el
     eco de lo que yo mismo escribí se reconoce y se descarta —mi actualización
     optimista ya lo pintó— sin depender de ningún temporizador. En el alta es
     además la clave de idempotencia del POST. */
  const escriturasPropias = useRef<Set<string>>(new Set())

  function firmarEscritura(): string {
    const firma = crypto.randomUUID()
    escriturasPropias.current.add(firma)
    // Cota de seguridad: con el canal vivo cada firma se borra al llegar su
    // eco, pero si el socket se cae justo después de escribir, ese eco no
    // llega nunca y la firma se quedaría aquí para siempre.
    if (escriturasPropias.current.size > 50) {
      const masVieja = escriturasPropias.current.values().next().value
      if (masVieja) escriturasPropias.current.delete(masVieja)
    }
    return firma
  }

  /** Una cita con su forma canónica (con paciente y médico), o null. */
  async function traerCita(id: string): Promise<Appointment | null> {
    try {
      const res = await fetch(`/api/appointments/${id}`)
      if (!res.ok) return null
      const json = await res.json()
      return (json?.appointment as Appointment) ?? null
    } catch {
      return null
    }
  }

  /** Aplica UN cambio llegado por el canal al evento que le corresponde. */
  async function aplicarCambioRealtime(payload: RealtimePostgresChangesPayload<FilaRealtime>) {
    const api = calendarRef.current?.getApi()
    if (!api) return

    // Un borrado trae sólo `{ id }` (ver el comentario de arriba). No hace
    // falta saber de quién era: si no está pintado, esto no hace nada. Los
    // borrados propios tampoco necesitan firma — la baja optimista ya quitó
    // el evento, así que su eco tampoco encuentra nada que quitar.
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id
      if (id) quitarConSalida(api, id)
      return
    }
    if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return

    const fila = payload.new
    if (!fila?.id || !fila.start_time) return

    // E8 · ANTES de consumir la firma y de fusionar: hace falta el estado que
    // estaba pintado. Sólo avisa al padre; quien decide si fue el paciente es él.
    if (onCanceladaAjena) {
      const pintado: unknown = api.getEventById(fila.id)?.extendedProps.status
      if (esCancelacionAjena({
        tipo: payload.eventType, statusNuevo: fila.status,
        statusPintado: typeof pintado === 'string' ? pintado : undefined,
        esEco: !!fila.client_id && escriturasPropias.current.has(fila.client_id),
      })) onCanceladaAjena(fila.id)
    }

    // ¿Es mía? La actualización optimista ya la reflejó. La firma se CONSUME
    // al usarse, no se guarda: si se quedara, cualquier cambio posterior de
    // otra persona sobre esa misma cita se descartaría para siempre —el
    // `client_id` de la fila no cambia hasta que alguien vuelve a escribirla—.
    //
    // Efecto de consumirla: el UPDATE de fondo que deja `gcal_sync_status`
    // (el `after()` de la ruta) llega con la firma ya gastada y sí se aplica.
    // No hay problema en ello y no se le pone lógica de orden encima: lo que
    // trae es el estado canónico de la fila, así que aplicarlo nunca deja la
    // tarjeta peor de como estaba.
    if (fila.client_id && escriturasPropias.current.delete(fila.client_id)) return

    // Lo que no se está viendo no se toca. `activeStart`/`activeEnd` son el
    // rango que el calendario tiene pintado, el mismo con que pide las citas.
    const { activeStart, activeEnd } = api.view
    const inicio = new Date(fila.start_time)
    const enRango = inicio >= activeStart && inicio < activeEnd
    /* Contra el filtro EFECTIVO, que es el que salió en la petición. Con
       `null` —perfil aún en vuelo— pasa todo, y da igual: lo que llegue por
       Realtime en esa rendija lo pisa la primera traída de verdad. */
    const pasaFiltroMedico = !filtroEfectivo || fila.medico_id === filtroEfectivo

    if (!enRango || !pasaFiltroMedico) {
      // Si estaba pintada y dejó de pertenecer a esta vista —la movieron a
      // otra semana, o se la reasignaron a un médico distinto del filtrado—,
      // se quita. Un evento que nunca estuvo aquí no genera nada.
      quitarConSalida(api, fila.id)
      return
    }

    // El payload no trae el paciente y la tarjeta lo necesita para el nombre.
    // Se pide esa cita concreta —una, no el rango— y sólo cuando el paciente
    // no se puede deducir de lo que ya está pintado: mover una cita de hora no
    // gasta ninguna petición. Si la petición falla, se aplica el resto del
    // cambio igual y la tarjeta cae a su título hasta la próxima recarga.
    const existente = api.getEventById(fila.id)
    const pacienteEnPantalla = existente?.extendedProps.pacientes as Appointment['pacientes'] | undefined
    const mismoPaciente = existente?.extendedProps.paciente_id === fila.paciente_id

    let cita: Partial<Appointment> & { id: string } = { ...fila }
    if (!fila.paciente_id) {
      cita.pacientes = null // desligaron al paciente (o nunca tuvo)
    } else if (mismoPaciente && pacienteEnPantalla) {
      cita.pacientes = pacienteEnPantalla
    } else {
      const hidratada = await traerCita(fila.id)
      // Si la petición falla, el resto del cambio se aplica igual pero con el
      // paciente en blanco (la tarjeta cae a su título). Conservar el nombre
      // anterior sobre una cita que YA es de otro paciente sería peor que no
      // enseñar ninguno.
      cita = hidratada ?? { ...cita, pacientes: null }
    }

    // Comprobar la existencia ANTES de agregar, y comprobarla de nuevo aquí:
    // entre el evento y la respuesta de `traerCita` pudo llegar el POST propio
    // o un refetch de reconexión, y dos eventos con el mismo id es el bug que
    // costó una rama entera cerrar.
    if (api.getEventById(fila.id)) {
      aplicarAppointmentAlEvento(cita)
    } else {
      /* F2.4: lo que llega de otra persona entra con el anillo (`remoto`).
         Antes de `addEvent`, que pinta en síncrono. Vale también para un
         UPDATE que trae a la vista una cita que no estaba pintada (la movieron
         aquí desde otra semana o se la asignaron a este médico): para quien
         mira, eso también acaba de llegar. */
      registrarNuevo(cita.id, { remoto: true })
      api.addEvent(buildEventInput(cita), FUENTE_APPOINTMENTS)
    }
  }

  /** F2.5: las dos bajas del canal salen animadas. Sin `Calendar`, de golpe. */
  function quitarConSalida(api: CalendarApi, id: string): void {
    if (api instanceof CalendarioFC) salirConAnimacion(api, id)
    else api.getEventById(id)?.remove()
  }

  /* El handler se recrea en cada render (lee `filtroEfectivo`), pero el canal se
     suscribe UNA vez: la ref es lo que los une sin re-suscribir. Mismo patrón
     que `appointmentSourceRef`. */
  const aplicarCambioRef = useRef(aplicarCambioRealtime)
  // eslint-disable-next-line react-hooks/refs -- patrón último valor: el canal se suscribe UNA vez (E12) y llama al manejador del último render por este ref; movido tal cual
  aplicarCambioRef.current = aplicarCambioRealtime

  useEffect(() => {
    const supabase = createClient()

    /* Ciclo de vida de la conexión. Un websocket se cae al dormir el equipo o
       al perder la red, y mientras estuvo caído los cambios no llegaron a
       ninguna parte: no hay eventos que aplicar, hay un hueco. Ése es el
       ÚNICO lugar donde un refetch del rango está justificado.
       El callback de `subscribe` vuelve a dispararse con SUBSCRIBED en cada
       reenganche automático (`rejoin()` reenvía el joinPush y sus hooks
       sobreviven al reset), así que sirve de aviso de "ya volví". La caída se
       detecta cuando falla el latido del socket, no al instante: tras
       despertar el equipo la puesta al día puede tardar unos segundos. */
    let huboCaida = false

    const channel = supabase
      .channel('appointments-realtime')
      // El tipo va en el parámetro y no como argumento de tipo de `.on()`:
      // `createClient()` no lleva el genérico `Database`, así que el cliente
      // llega sin tipar y `.on<T>()` no acepta argumentos de tipo.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload: RealtimePostgresChangesPayload<FilaRealtime>) => {
          // A1.5a: cualquier cambio, propio o ajeno, de cualquier semana.
          vaciarCacheCitas()
          void aplicarCambioRef.current(payload)
        },
      )
      .subscribe((estado: string) => {
        if (estado === 'SUBSCRIBED') {
          if (huboCaida) { huboCaida = false; refetch(true) }
          return
        }
        // CHANNEL_ERROR / TIMED_OUT / CLOSED: se perdió el hilo de los cambios.
        huboCaida = true
      })

    return () => { supabase.removeChannel(channel) }
  }, [refetch])

  /* ── Refetch al recuperar el foco la pestaña ────────────
   *
   * Cierra el hueco que el canal NO puede cubrir, el que está descrito arriba
   * como "límite conocido": cuando a un médico invitado le reasignan una cita
   * a otro médico, `appointments_select` deja de dejarle leer esa fila, y la
   * comprobación de Realtime corre sobre la fila YA reasignada, así que da
   * false y el UPDATE no se le entrega. No es un evento perdido, es un
   * no-evento: no hay nada que escuchar. Su tarjeta se queda pintada como si
   * la cita siguiera siendo suya, y nada en el canal lo va a desmentir nunca.
   *
   * ACOTADO A PROPÓSITO — volver de otra ventana NO es motivo para pedir
   * datos. Con la pestaña en segundo plano el websocket sigue abierto y los
   * eventos siguen llegando y aplicándose, así que una ausencia corta no
   * pierde nada. Y si el socket sí se cayó, el latido lo detecta en cosa de un
   * minuto (30 s de intervalo, y la conexión se descarta cuando el siguiente
   * sale sin respuesta del anterior) y el refetch de reconexión de arriba ya
   * trae el rango entero.
   *
   * De ahí el umbral de 2 minutos: el doble de esa ventana de detección. Por
   * debajo, o no se perdió nada, o lo cubre la reconexión, y disparar aquí
   * sería repetir trabajo que otro camino ya hizo — que es justo lo que la
   * agenda viene evitando. Por encima, lo único que queda por recuperar es el
   * no-evento de arriba, que lleva obsoleto un rato indeterminado y no tiene
   * ninguna prisa de segundos.
   *
   * Los dos escuchas son dos señales del sistema operativo para lo mismo, no
   * dos mecanismos: `visibilitychange` cubre el cambio de pestaña y minimizar;
   * `focus` cubre irse a otra aplicación con la ventana a la vista, donde la
   * pestaña nunca deja de estar "visible". Pasan por la misma guarda y por el
   * mismo `refetch`, y la marca se estampa al salir la petición, así que
   * cuando llegan juntos sólo uno pide.
   *
   * Sus dependencias, `[refetch, ultimaTraidaRef]`, son las dos estables
   * (`refetch` es un `useCallback` con `[calendarRef]` en `useFuentesAgenda` y
   * sólo lee refs), así que corre una vez, como cuando eran `[]`. Mismo
   * criterio que el efecto del canal.
   */
  useEffect(() => {
    function alVolverAlFrente() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultimaTraidaRef.current < UMBRAL_REFETCH_FOCO_MS) return
      refetch(true)
    }
    document.addEventListener('visibilitychange', alVolverAlFrente)
    window.addEventListener('focus', alVolverAlFrente)
    return () => {
      document.removeEventListener('visibilitychange', alVolverAlFrente)
      window.removeEventListener('focus', alVolverAlFrente)
    }
  }, [refetch, ultimaTraidaRef])

  return { firmarEscritura, aplicarAppointmentAlEvento }
}
