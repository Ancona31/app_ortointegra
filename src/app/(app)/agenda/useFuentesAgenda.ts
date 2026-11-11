'use client'

/**
 * src/app/(app)/agenda/useFuentesAgenda.ts
 *
 * Las dos fuentes de eventos de la agenda (citas y Google) con todo lo que
 * las rodea: la semilla del servidor, los cuatro estados de aviso de la
 * traída, el candado del arrastre con `refetch`, la marca de la última
 * traída, el refetch por cambio de filtro, los envoltorios estables que ve
 * FullCalendar y la precarga de semanas vecinas. Movido tal cual desde
 * `AgendaCliente.tsx` (A2.5.5, movimiento puro, con sus comentarios); sólo
 * cambiaron los parámetros, el retorno, que `refetch` pasó a `useCallback`
 * con `[calendarRef]` (su cuerpo sólo lee refs, así que su identidad es
 * estable y los efectos del canal y del foco pueden declararla) y las
 * dependencias que exhaustive-deps pide ahora que `calendarRef` llega por
 * parámetro.
 *
 * ⚠️ `programarPrecarga` SIGUE SIENDO UNA FUNCIÓN DEL RENDER, SIN MEMOIZAR:
 * lee `profile`, `filtroEfectivo` y `citasIncompletas` frescos, y quien la
 * llama (`alCambiarFechas`/`alCambiarEventos`) llega a ella por
 * `manejadoresFcRef`, escrito en cada render.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type FullCalendar from '@fullcalendar/react'
import type { EventInput, ViewApi } from '@fullcalendar/core'
import type { Profile } from '@/hooks/useProfile'
import { canVerAgendaCompleta } from '@/lib/permissions'
import { rangoQuePedir } from '@/lib/agenda/rangoQuePedir'
import {
  aEventosDeCalendario, claveGoogle, eventosProvisionales, leerGoogle, pedirEventosGoogle, traerGoogle,
  type EstadoGoogleAgenda, type ResultadoGoogle,
} from '@/lib/agenda/cacheEventosGoogle'
import { claveCitas, leerCitas, vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { esperarSemilla, type SemillaCitas } from '@/lib/agenda/semillaCitas'
import { semanaAnterior, semanaSiguiente } from '@/lib/agenda/semanasVecinas'
import { FUENTE_APPOINTMENTS } from '@/lib/agenda/eventosDeCita'
import { traerCitasDeduplicado, engancharSemilla, type TraidaEnVuelo } from '@/lib/agenda/traidaCitas'
import { enOcioso, cancelarOcioso } from '@/lib/agenda/ocioso'
import { TOPE_GESTO_MS, hayGestoEnCurso } from '@/lib/agenda/fechasAgenda'
import type { Appointment } from '@/lib/agenda/tiposAgenda'

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>

/** Las dos vistas de 7 días donde se precarga (A1.5b). Mes y Día, no. */
const VISTAS_PRECARGABLES = new Set(['timeGridWeek', 'listWeek'])

/** Una secuencia de precarga en curso: su candado de cancelación y su
 *  temporizador ocioso, fundidos en un solo objeto — ver `ejecutarPrecarga`. */
interface PrecargaEnCurso { cancelado: boolean; idle: number }

interface Params {
  semillaCitas: Promise<SemillaCitas<Appointment> | null> | undefined
  calendarRef: CalRef
  profile: Profile | null
  filtroEfectivo: string | null
  filtroSincronoRef: RefObject<string | null>
}

export function useFuentesAgenda({
  semillaCitas, calendarRef, profile, filtroEfectivo, filtroSincronoRef,
}: Params) {
  /* A1.4c: se engancha en el PRIMER render, antes de que FullCalendar monte y
     haga su primera traída. La consume esa traída (ver `appointmentSource`). */
  const [semillaLista] = useState(() => engancharSemilla(semillaCitas))
  const semillaPendienteRef = useRef(semillaLista)
  /* La fuente de CITAS falló. Sólo ella: un fallo de Google no entra aquí y por
     eso la agenda propia no se cae con él. Ver `estadoGoogle`. */
  const [errorCitas, setErrorCitas] = useState(false)
  /* La traída de CITAS fue BIEN y aun así vino RECORTADA: el servidor contó más
     filas de las que le cupieron en la respuesta (`incompleta`, en
     /api/appointments).

     ⚠️ ES OTRA COSA QUE `errorCitas` Y NO SE PUEDE FUNDIR CON ÉL, aunque las dos
     bandas salgan del mismo tono. `errorCitas` significa «lo que ves puede estar
     viejo»: no llegó nada y se sigue pintando lo anterior, y por eso enciende
     `ag-desactualizada` y ofrece «Reintentar». Esto significa lo contrario: lo
     que ves es NUEVO y CORRECTO, sólo que hay MÁS. Atenuar la rejilla mentiría, y
     reintentar traería exactamente las mismas mil filas.

     Se excluyen por construcción: ésta sólo se escribe en el camino de éxito y
     aquélla sólo en el `catch`, así que nunca hay dos bandas rojas a la vez. */
  const [citasIncompletas, setCitasIncompletas] = useState(false)

  /* Qué contestó lo último que se le preguntó a `/api/google/events`.
     ⚠️ ARRANCA EN 'conectado' Y NO EN NULL, y no es optimismo: el único valor
     que pinta banda es 'error_google', así que el estado inicial tiene que ser
     cualquiera de los otros dos. */
  const [estadoGoogle, setEstadoGoogle] = useState<EstadoGoogleAgenda>('conectado')
  /* Google todavía por contestar para lo que se está viendo (A1.3): la fuente
     `gcal` ya respondió provisional y la de verdad vuela. Sólo lo lee
     `vacioReal`. Ver `gcalSource`. */
  const [googlePendiente, setGooglePendiente] = useState(false)

  /* ══════════════════════════════════════════════════════════════════════
     EL CANDADO DEL ARRASTRE — NO LO QUITES SIN LEER ESTO
     ══════════════════════════════════════════════════════════════════════
     Una traída que caiga ENTRE el `mousedown` y el `mouseup` de un arrastre
     DUPLICA la cita en pantalla. Comprobado en banco con la librería real, no
     deducido; el gesto sin traída a mitad no duplica nunca.

     POR QUÉ, que es lo que hay que entender antes de tocar nada:

       · Al empezar el gesto, `@fullcalendar/interaction` se guarda una copia de
         la cita —`relevantEvents`, indexada por su `defId` INTERNO— y no la
         vuelve a mirar hasta que sueltas.
       · Nuestras dos fuentes son de FUNCIÓN, así que cada traída vuelve a
         PARSEAR la cita y le asigna un `defId` NUEVO. El viejo desaparece del
         store.
       · Al soltar, `handleDragEnd` mergea la copia vieja ya movida
         (`interaction/index.js:1381-1384`). El merge es un `Object.assign` por
         clave (`core/internal-common.js:3342-3347`), y como ese `defId` ya no
         existe, NO SUSTITUYE A NADIE: se añade. Dos entradas.

     ⚠️ Y NO SE DETECTA CON `getEventById`. Las dos copias comparten el id
     PÚBLICO —el uuid de la cita— y difieren sólo en los ids internos. Medido:
     `defId 78/instanceId 79` a la hora nueva y `defId 138/instanceId 139` a la
     vieja, las dos con el mismo `id`. `getEventById` devuelve la primera y se
     queda tan tranquilo, así que las guardas de `aplicarCambioRealtime` y de
     `handleSave` —que sí comprueban por id— no ven nada raro. Recargar la
     limpia, y por eso parecía un fantasma.

     ⚠️ NO LO CAUSA `revert()`, y esa pista se siguió y se descartó midiendo: el
     duplicado sale IGUAL con el handler reviertiendo y sin revertir. `revert()`
     mergea por las mismas claves y es inocuo.

     LA TRAÍDA SE DESCARTA, NO SE APLAZA. Guardar la respuesta para aplicarla
     después sería aplicar datos viejos contra un estado ya cambiado, que es
     otra carrera. Lo que se pierde es una traída; la cubre el siguiente
     disparador (cambio de filtro, foco o reconexión).

     ⚠️ EL REDIMENSIONADO VA EN EL MISMO CANDADO. Tiene exactamente la misma
     exposición: también captura `relevantEvents` al empezar. */
  /* Instante en que empezó el gesto, o 0 si no hay ninguno. Un ref y no estado:
     no debe provocar render, y `refetch()` lo lee de forma síncrona. Quien lo
     interpreta —y quien lo suelta si se quedó atascado— es `hayGestoEnCurso`,
     a nivel de módulo, con la explicación de la válvula al lado. */
  const gestoEnCursoRef = useRef(0)

  /* Identidad estable: sólo tocan un ref, así que `[]` y no se re-registran en
     FullCalendar. Misma regla que `renderEC` y las fuentes. */
  const alEmpezarGesto = useCallback(() => { gestoEnCursoRef.current = Date.now() }, [])

  /* Lo que avisa de que llegó Google (A1.3): vuelve a pedirle a la fuente `gcal`
     SOLA, que esta vez se sirve de `cacheEventosGoogle` sin red. Ver la cabecera
     de ese módulo para el porqué de que Google conteste en dos tiempos.
     ⚠️ ESTE AVISO NO SE DESCARTA COMO UNA TRAÍDA, SE APLAZA: los datos ya están
     en la caché y no hay otro disparador que los vaya a pintar. Con un gesto en
     curso se anota y lo suelta `alTerminarGesto`.
     ⚠️ Y TAMBIÉN LA VÁLVULA. Si `eventDragStop` no llega nunca (el camino que
     describe `hayGestoEnCurso`), el aplazado se quedaría en `true` y los datos
     sin pintar. Por eso, al aplazar, se arma un reintento para cuando venza el
     tope: entonces `hayGestoEnCurso` suelta el candado y la traída sale. Si el
     gesto ya cerró por su camino, el aplazado vale `false` y el reintento no hace
     nada. Cualquier traída que pase el candado lo apaga: ya pinta `gcal`. */
  const googleAplazadoRef = useRef(false)
  const refrescarGoogle = useCallback(function refrescar() {
    if (hayGestoEnCurso(gestoEnCursoRef)) {
      googleAplazadoRef.current = true
      window.setTimeout(() => { if (googleAplazadoRef.current) refrescar() }, TOPE_GESTO_MS + 1)
      return
    }
    googleAplazadoRef.current = false
    calendarRef.current?.getApi().getEventSourceById('gcal')?.refetch()
  }, [calendarRef])
  /* El aplazado sale en un `setTimeout(0)`: `eventDragStop` se emite ANTES del
     `MERGE_EVENTS` del soltar (`@fullcalendar/interaction/index.js:1371-1384`),
     y así la traída cae con el gesto ya cerrado del todo. */
  const alTerminarGesto = useCallback(() => {
    gestoEnCursoRef.current = 0
    if (!googleAplazadoRef.current) return
    googleAplazadoRef.current = false
    window.setTimeout(refrescarGoogle, 0)
  }, [refrescarGoogle])

  /* Si la siguiente traída de `gcal` sale por la red aunque haya caché vigente.
     La escribe `refetch(true)` y la consume `gcalSource`. */
  const forzarGoogleRef = useRef(false)

  /* `forzarGoogle`: lo piden los caminos que HOY obligan a volver a preguntar
     —«Reintentar», la reconexión del canal y el foco tras 2 min—. El resto
     (filtro, deshacer un guardado) se sirve de la caché de Google si está viva. */
  /* A1.5a: los mismos caminos fuerzan también las citas, vaciando su caché. Va
     ANTES del candado: vaciar no trae nada, y si el gesto se come esta traída,
     la siguiente no puede servir lo de antes de la reconexión. */
  const refetch = useCallback((forzarGoogle = false) => {
    if (forzarGoogle) vaciarCacheCitas()
    if (hayGestoEnCurso(gestoEnCursoRef)) return
    googleAplazadoRef.current = false
    if (forzarGoogle) forzarGoogleRef.current = true
    calendarRef.current?.getApi().refetchEvents()
  }, [calendarRef])

  /* Cuándo se pidieron las citas al servidor por última vez. La estampa
     `appointmentSource`, que es por donde pasan TODAS las traídas: el montaje,
     el cambio de semana, el cambio de filtro, el refetch de reconexión y el de
     foco. Una sola marca para todos los caminos, que es lo que evita tener dos
     guardas de tiempo que se contradigan: la reconexión no consulta el umbral
     —una caída del socket es prueba de que hubo hueco y ahí siempre se trae—
     pero sí actualiza la marca, así que volver a la pestaña justo después de
     reconectar ya no vuelve a pedir nada.

     Se estampa al SALIR la petición, no al volver: dos señales seguidas
     (`visibilitychange` y `focus` llegan juntas al restaurar una ventana
     minimizada) dispararían si no dos peticiones idénticas.
     Lo servido de la caché de rangos (A1.5a) NO la estampa: sólo cuenta la red. */
  const ultimaTraidaRef = useRef(0)

  /* ═══ A1.5b · PRECARGA DE SEMANAS VECINAS — refs ══════════════════════════
     `citasEnVueloRef`: compartido por la traída real (`appointmentSource`) y
     la precarga (`ejecutarPrecarga`), ver `traerCitasDeduplicado` y
     `TraidaEnVuelo`.
     `citasIncompletasRef`: espejo de estado para `ejecutarPrecarga`, que
     corre DESPUÉS de un `requestIdleCallback` — puede haber renders de por
     medio y un closure se quedaría con la bandera de incompleta de cuando se
     PROGRAMÓ, no de cuando de verdad pide. Se escribe en cada render, igual
     que `appointmentSourceRef.current = appointmentSource` más abajo.
     `precargaRef`/`ultimaClavePrecargadaRef`: la secuencia en curso (ver
     `PrecargaEnCurso`) y la clave de la última vista para la que ya se
     programó —lo que evita la ráfaga: un vaciado por tiempo real reemite
     `eventsSet` sin mover la vista, así que la clave sale igual y no hay
     nada que programar otra vez. */
  const citasEnVueloRef = useRef(new Map<string, TraidaEnVuelo>())
  const citasIncompletasRef = useRef(citasIncompletas)
  citasIncompletasRef.current = citasIncompletas
  const precargaRef = useRef<PrecargaEnCurso | null>(null)
  const ultimaClavePrecargadaRef = useRef<string | null>(null)

  /* ── Refetch al cambiar el filtro de médico ─────────────
     Se dispara DESPUÉS del commit del estado (no en el onChange síncrono),
     cuando appointmentSourceRef.current y gcalSourceRef.current ya apuntan a
     las fuentes recreadas con el `filtroEfectivo` nuevo → los dos fetches salen
     con el médico correcto. `refetch()` retrae LAS DOS fuentes, así que un
     cambio de filtro dispara exactamente dos peticiones: citas y eventos de
     Google. El guard de primer render evita el doble fetch en montaje
     (FullCalendar ya hace su fetch inicial por sí mismo).

     ⚠️ AHORA TAMBIÉN ES QUIEN DISPARA LA PRIMERA TRAÍDA DE VERDAD, y por eso
     `refetch()` NO puede condicionarse a que el filtro sea distinto de vacío. En
     el montaje `filtroEfectivo` vale `null` y las fuentes no piden nada (ver
     `filtroDecididoRef`); cuando llega el perfil pasa a `''` o a un id, este
     efecto ve el cambio y pide. Para la SECRETARIA ese cambio es `null → ''`,
     que no toca el desplegable pero sí es un cambio: sin él su agenda se
     quedaría cargando para siempre. */
  const filtroFirstRender = useRef(true)
  useEffect(() => {
    if (filtroFirstRender.current) { filtroFirstRender.current = false; return }
    refetch()
  }, [filtroEfectivo, refetch])

  /* ── Event source: nuestras citas ───────────────────── */
  const appointmentSource = useCallback(async (
    info: { startStr: string; endStr: string },
    success: (events: EventInput[]) => void,
    failure: (err: Error) => void
  ) => {
    try {
      /* El espejo primero: en una traída disparada por `changeView` este closure
         puede ser el del render anterior. Ver `filtroSincronoRef`. */
      const filtro = filtroSincronoRef.current ?? filtroEfectivo
      /* A1.5a: sin perfil no hay de quién es la caché, como en Google. Servir de
         aquí NO estampa `ultimaTraidaRef`: el refresco por foco cuenta la red. */
      const clave = profile ? claveCitas(profile.id, filtro ?? '', info.startStr, info.endStr) : null
      let guardadas = clave ? leerCitas(clave) : null
      /* A1.4c: mientras la semilla del servidor siga en camino, una traída que
         no encuentra su clave la espera hasta `TOPE_SEMILLA_MS` y vuelve a
         mirar; al acabar esa espera se suelta y ya nadie más espera.
         ⚠️ NO SE SUELTA AL EMPEZAR A ESPERAR: en el teléfono el `changeView` del
         montaje pide otra vez mientras la primera espera, y esa segunda iba a
         la red. Y si la semilla entró, su marca cuenta como la última traída
         para el refresco por foco: es una traída, sólo que la hizo el servidor. */
      const semilla = semillaPendienteRef.current
      if (!guardadas && clave && semilla) {
        const marca = await esperarSemilla(semilla)
        semillaPendienteRef.current = null
        guardadas = leerCitas(clave)
        if (guardadas && marca !== null) ultimaTraidaRef.current = Math.max(ultimaTraidaRef.current, marca)
      }
      if (guardadas) { setErrorCitas(false); setCitasIncompletas(false); success(guardadas); return }
      ultimaTraidaRef.current = Date.now()
      /* A1.5b: si la precarga ya está pidiendo esta MISMA clave, su promesa
         es la que contesta — no una segunda petición. La traída y el guardado
         en caché, con sus dos guardas no-defensivas (Bloque 9: separar un 500
         o un cuerpo roto de "no hay citas"), viven en `traerYGuardarCitas`;
         ver su cabecera. */
      const { eventos, incompleta } = await traerCitasDeduplicado(
        info.startStr, info.endStr, filtro ?? '', profile?.id ?? null, citasEnVueloRef.current,
      )
      setErrorCitas(false)
      /* ⚠️ `incompleta` viene de `data.incompleta === true` dentro de
         `traerYGuardarCitas`, y no `!!`: ausencia de campo (despliegue a
         medias, respuesta vieja) significa «no me consta que falte nada», no
         «falta algo». No levanta la banda sola. */
      setCitasIncompletas(incompleta)
      success(eventos)
    } catch (err: unknown) {
      /* El estado va ANTES del `failure()`, aunque el orden no se note: quien
         pinta la banda es esto, y `failure()` sólo cierra la traída dentro de
         FullCalendar. Ver `eventSourceFailure` en el <FullCalendar>, que es la
         otra mitad —la que cubre a un fallo que no pase por aquí. */
      setErrorCitas(true)
      /* Se apaga: sin traída no hay recorte del que hablar, y dejarla encendida
         de la vez anterior pondría las DOS bandas rojas juntas diciendo cosas
         distintas sobre la misma pantalla. Manda `errorCitas`, que es la peor. */
      setCitasIncompletas(false)
      failure(err instanceof Error ? err : new Error('Error cargando citas'))
    }
  }, [filtroEfectivo, filtroSincronoRef, profile])

  /* ── Event source: Google Calendar ─────────────────────
   * Una sola cosa: `events`, los eventos del calendario de Spinus que NO son
   * cita de la app. El servidor ya los restó, así que aquí NO hace falta pedir
   * /api/appointments para deduplicar, y ya llegan acotados a los cuatro campos
   * que se usan abajo — el resto del evento de Google no viaja.
   *
   * El carril `ocupado` (huecos del calendario personal vía freebusy) se
   * eliminó entero, scope incluido. Si vuelve a aparecer una lectura de
   * `data.ocupado`, es que alguien lo revivió.
   *
   * ── EL FILTRO DE MÉDICO VIAJA, PERO NO SE APLICA AQUÍ ──────────────────
   * Estos eventos pertenecen a quien conectó Google, y con el filtro puesto en
   * otro médico no se pintan. Quien decide eso es el SERVIDOR: aquí sólo se le
   * manda el `medico_id` elegido y se pinta lo que conteste. El motivo está
   * escrito en /api/google/events, junto a la comparación; el que decide es que
   * cortando allá se ahorra la llamada a Google entera, y que así no baja al
   * navegador el `user_id` de nadie con quien comparar.
   *
   * Filtrar aquí exigiría justo eso último. NO lo traigas.
   *
   * ── POR QUÉ DEPENDER DE `filtroEfectivo` NO DUPLICA PETICIONES ─────────
   * Esta función cambia de identidad en cada cambio de filtro, pero FullCalendar
   * NUNCA la ve: lo que registra es `stableGcalSource`, un envoltorio con deps
   * `[]` que lee `gcalSourceRef.current` al llamar. La lista `eventSourcesStable`
   * no cambia, así que la fuente no se re-registra y no hay traída extra por
   * cambio de identidad.
   *
   * La única traída por cambio de filtro sigue siendo el `refetch()` del efecto
   * de arriba, que retrae LAS DOS fuentes: dos peticiones por cambio de filtro
   * —citas y eventos—, las mismas que antes de este cambio.
   *
   * ⚠️ QUÉ CUESTA ROMPER ESA MEMOIZACIÓN. Si alguien le añade una dependencia a
   * `stableGcalSource`, a `stableAppointmentSource` o a `eventSourcesStable`, el
   * array llega distinto y `handleEventSources` de FullCalendar sí corre: no
   * reconoce los `_raw` por identidad, hace `REMOVE_EVENT_SOURCE` de las dos
   * fuentes y `addEventSource` de las dos, que trae de inmediato. Son CUATRO
   * peticiones por cambio de filtro en vez de dos, más un parpadeo con el
   * calendario vacío entre el remove y el add. Los datos que hagan falta aquí se
   * leen del ref, como este; la lista de fuentes no se toca.
   */
  /* ── A1.3 · GOOGLE CONTESTA EN DOS TIEMPOS ──────────────────────────────
   * 1. AL INSTANTE: lo vigente de la caché, o lo último conocido para esa clave
   *    (o nada) mientras se pregunta. Así la fuente `gcal` no retiene el
   *    `loading` agregado, que es lo que dejaba la rejilla SIN NINGUNA cita
   *    hasta que Google contestaba. Ver la cabecera de `cacheEventosGoogle`.
   * 2. AL LLEGAR: `traerGoogle` guarda la respuesta y llama a
   *    `refrescarGoogle`, que repite la traída de esta fuente sola; esa vez
   *    `leerGoogle` la entrega de la caché y es entonces cuando se escribe el
   *    estado. La banda de Google sale en los mismos casos que antes, sólo que
   *    cuando de verdad se sabe.
   * `googlePendiente` mientras tanto: el «Sin citas…» no puede afirmar un cero
   * con Google todavía por contestar. */
  const gcalSource = useCallback((
    info: { startStr: string; endStr: string },
    success: (events: EventInput[]) => void,
    failure: (err: Error) => void
  ) => {
    // El espejo primero, por lo mismo que en la fuente de citas.
    const filtro = filtroSincronoRef.current ?? filtroEfectivo ?? ''
    const forzar = forzarGoogleRef.current
    forzarGoogleRef.current = false

    /* El médico invitado: lo mismo que contesta la ruta (`events/route.ts`, el
       corte de `canVerAgendaCompleta`) sin pedírselo — ahorra la petición y un
       `getUser`. Sólo con el perfil YA leído: con `profile` nulo no se sabe el
       rol y se pregunta, que es lo que decide el servidor. */
    if (profile && !canVerAgendaCompleta(profile)) {
      setEstadoGoogle('conectado'); setGooglePendiente(false); success([]); return
    }

    function entregar(r: ResultadoGoogle) {
      setGooglePendiente(false)
      /* Caída de red o cuerpo ilegible: fallo de Google y `failure()`, como
         siempre — que la fuente de Google fracase NO purga los eventos de la de
         citas: `RECEIVE_EVENT_ERROR` va por `sourceId`
         (@fullcalendar/core/index.js:634-639). */
      if (r.tipo === 'caida') { setEstadoGoogle('error_google'); failure(r.error); return }
      /* ⚠️ AQUÍ EL ESTADO YA NO SE TIRA, Y ES EL BLOQUE 9. Hasta ahora
         'sin_token' y 'error_google' se pintaban igual —sin eventos y sin una
         palabra—, con este argumento: la agenda no tiene botón de conectar, así
         que quien distingue los dos casos de cara al médico es /perfil. El
         argumento explica por qué no hay BOTÓN; no explicaba por qué no hay
         AVISO, y sin aviso «Google falló» es indistinguible de «hoy no tengo
         eventos».

         ⚠️ SÓLO 'error_google' PINTA BANDA, y esa asimetría es deliberada.
         `estadoDeFallo` (api/google/events/route.ts:56-61) mete en 'sin_token'
         DOS situaciones que desde aquí no se pueden separar: la clínica que
         nunca conectó Google y la que tenía credencial y se le murió. Levantar
         banda con 'sin_token' le pondría un aviso permanente a toda clínica que
         sencillamente no usa Google, que son la mayoría. Se paga el precio
         contrario: la credencial muerta sigue siendo silenciosa aquí y se
         descubre en /perfil, igual que antes.
         Si algún día la ruta distingue los dos casos, ESTE es el sitio. */
      setEstadoGoogle(r.datos.estado)
      /* Sin eventos: `success([])` y no `failure()`. Es lo que aísla el fallo de
         Google de las citas propias, y no depende de la banda para nada. */
      success(r.datos.estado === 'conectado' ? aEventosDeCalendario(r.datos.events) : [])
    }

    /* Sin perfil (el tope de 3 s de `useProfile` ganó sin caché) no hay de
       quién es la caché: no se lee ni se escribe. Se pregunta y se entrega en
       UN tiempo, como antes de A1.3 —Google vuelve al camino crítico sólo en
       este camino degradado—. Los dos tiempos necesitan un sitio donde dejar la
       respuesta para el `refetch`, y ese sitio es justo la caché. */
    if (!profile) {
      pedirEventosGoogle(info.startStr, info.endStr, filtro).then(
        datos => entregar({ tipo: 'respuesta', datos }),
        (err: unknown) => entregar({ tipo: 'caida', error: err instanceof Error ? err : new Error('Error cargando eventos') }),
      )
      return
    }

    const clave = claveGoogle(profile.id, filtro, info.startStr, info.endStr)
    const listo = forzar ? null : leerGoogle(clave)
    if (listo) { entregar(listo); return }
    setGooglePendiente(true)
    success(aEventosDeCalendario(eventosProvisionales(clave)))
    traerGoogle(clave, () => pedirEventosGoogle(info.startStr, info.endStr, filtro), refrescarGoogle)
  }, [filtroEfectivo, filtroSincronoRef, profile, refrescarGoogle])

  /* ── Stable eventSources ref (evita re-registro en cada render) ── */
  const appointmentSourceRef = useRef(appointmentSource)
  appointmentSourceRef.current = appointmentSource
  const gcalSourceRef = useRef(gcalSource)
  gcalSourceRef.current = gcalSource

  /* El rango pedido se fija AQUÍ, en los envoltorios, y no dentro de cada
     fuente: es una sola regla y vale para las dos. Por qué se ensancha a
     semanas completas, y por qué se construye desde `info` y no leyendo la
     vista, en `rangoQuePedir`.

     Sigue siendo el CUERPO de estas funciones: sus deps siguen siendo `[]` y su
     identidad no se mueve — `rangoQuePedir` es pura y de módulo, así que no las
     ata a nada. Eso es lo que mantiene `eventSourcesStable` estable y, con
     ella, callado el `handleEventSources` de FullCalendar
     (`@fullcalendar/core/index.js:1065`), que reconoce las fuentes por
     identidad del `_raw`. Ver el aviso largo de `gcalSource`. */
  /* ⚠️⚠️ EL GATE DE LAS DOS FUENTES: SIN ROL NO SE PIDE NADA. `false` hasta que
     `filtroEfectivo` deja de ser `null`, o sea hasta que se sabe si esta agenda
     abre en un médico o en todos.

     Va en un REF y se escribe en render —igual que los dos refs de arriba, y por
     el mismo motivo— porque los envoltorios tienen deps `[]` a propósito: una
     dependencia aquí cambiaría la identidad de `eventSourcesStable`, y el aviso
     largo de `gcalSource` explica lo que eso cuesta (cuatro peticiones por
     cambio de filtro y un parpadeo con el calendario vacío).

     ⚠️ SE VUELVE SIN LLAMAR NI A `success` NI A `failure`, Y ESO ES CORRECTO, NO
     UN CABO SUELTO. La traída de montaje se queda sin contestar y la sustituye
     el `refetch()` del efecto de arriba en cuanto llega el perfil: FullCalendar
     empareja respuestas por `fetchId` contra `latestFetchId`
     (`@fullcalendar/core/index.js:641-647`), así que la petición vieja no podría
     entrar aunque contestara. Y el indicador de carga no se queda colgado:
     `computeEventSourcesLoading` (:549) mira el booleano `isFetching` de cada
     fuente, no un contador de pendientes, y el refetch lo baja al recibir.
     Mientras tanto la agenda enseña su estado de carga, que es la verdad.

     Contestar `success([])` aquí sería lo tentador y sería justo el defecto de
     los bloques anteriores: pintar una agenda vacía que no se ha preguntado. */
  const filtroDecididoRef = useRef(false)
  filtroDecididoRef.current = filtroEfectivo !== null

  const stableAppointmentSource = useCallback(
    (info: { startStr: string; endStr: string }, success: (events: EventInput[]) => void, failure: (err: Error) => void) => {
      if (!filtroDecididoRef.current) return
      appointmentSourceRef.current(rangoQuePedir(info), success, failure)
    },
    []
  )
  const stableGcalSource = useCallback(
    (info: { startStr: string; endStr: string }, success: (events: EventInput[]) => void, failure: (err: Error) => void) => {
      if (!filtroDecididoRef.current) return
      gcalSourceRef.current(rangoQuePedir(info), success, failure)
    },
    []
  )
  /**
   * Las fuentes llevan `id` explicito porque `api.addEvent(input, sourceId)`
   * resuelve la fuente por ese id (si no la encuentra devuelve null y avisa
   * por consola). Un evento añadido sin sourceId no pertenece a ninguna
   * fuente y `refetchEvents()` no lo purga: sobrevive junto al evento
   * recargado del servidor y quedan dos con el mismo ID (E5-DT-8).
   */
  const eventSourcesStable = useMemo(() => [
    { id: FUENTE_APPOINTMENTS, events: stableAppointmentSource },
    { id: 'gcal',              events: stableGcalSource },
  ], [stableAppointmentSource, stableGcalSource])

  /* ═══ A1.5b · PRECARGA DE SEMANAS VECINAS ═════════════════════════════════
     Apaga lo que esté en vuelo o programado: lo llama `programarPrecarga` al
     cambiar de vista o de rango, y el efecto de desmontaje de abajo.
     `cancelarOcioso` sobre un candado que ya disparó es inofensivo (como
     `clearTimeout` sobre uno ya vencido), así que no hace falta recordar si
     ya corrió. */
  function cancelarPrecargaEnCurso(): void {
    if (precargaRef.current) { precargaRef.current.cancelado = true; cancelarOcioso(precargaRef.current.idle) }
    precargaRef.current = null
    ultimaClavePrecargadaRef.current = null
  }

  /*
   * Tras pintar Semana o Día-lista, programa EN OCIOSO la traída de W+1 y
   * W-1 de la vista que se está mirando. La llaman `datesSet` y `eventsSet`
   * —entre los dos cubren toda navegación, igual que ya hacen para la
   * ventana y el conteo—, con la vista que entrega cada uno.
   *
   * ⚠️ LA CLAVE DEL RANGO, NO UN BOOLEANO, ES LO QUE EVITA LA RÁFAGA. Un
   * vaciado por tiempo real reemite `eventsSet` SIN mover la vista (ver la
   * nota junto al `<FullCalendar>`): el rango sale igual,
   * `ultimaClavePrecargadaRef` ya lo tiene, y no se programa nada otra vez.
   *
   * ⚠️ Y ESO ES A PROPÓSITO, NO UN HUECO: tras un vaciado, las vecinas de LA
   * VISTA ACTUAL no se vuelven a precargar hasta que el usuario de verdad
   * navegue a una vista distinta. Lo que sí llega al día es la vista misma
   * —`appointmentSource` → `traerCitasDeduplicado` ya descartan la promesa
   * vieja por generación, es el punto 1 de esta ronda—; sus vecinas esperan
   * a la próxima navegación, que es cuando de verdad hacen falta.
   *
   * Sólo se marca la clave como programada cuando los guardas de abajo SÍ
   * dejan seguir — así una clínica sin perfil todavía, con un gesto en
   * curso, con la semilla aún en camino (`semillaPendienteRef`) o con una
   * traída real en vuelo (`citasEnVueloRef`, que la propia traída real
   * también usa) reintenta en el próximo `eventsSet` —el que deja esa traída
   * al resolver— en vez de quedarse marcada sin haber precargado nunca.
   * Tampoco se programa con el filtro todavía sin decidir (`null`): no hay
   * clave estable con la que no repetirse.
   */
  function programarPrecarga(vista: ViewApi): void {
    if (!VISTAS_PRECARGABLES.has(vista.type)) { cancelarPrecargaEnCurso(); return }
    if (!profile || hayGestoEnCurso(gestoEnCursoRef) || citasIncompletas) return
    if (citasEnVueloRef.current.size > 0 || semillaPendienteRef.current) return
    const filtroActual = filtroSincronoRef.current ?? filtroEfectivo
    if (filtroActual === null) return
    const rango = rangoQuePedir({ startStr: vista.currentStart.toISOString(), endStr: vista.currentEnd.toISOString() })
    const clave = `${rango.startStr}|${rango.endStr}|${filtroActual}`
    if (clave === ultimaClavePrecargadaRef.current) return
    cancelarPrecargaEnCurso()
    ultimaClavePrecargadaRef.current = clave
    const profileId = profile.id
    const token: PrecargaEnCurso = { cancelado: false, idle: 0 }
    token.idle = enOcioso(() => void ejecutarPrecarga(rango, filtroActual, profileId, token))
    precargaRef.current = token
  }

  /*
   * W+1 y W-1 EN SERIE —nunca en paralelo, para no competir con la traída
   * real si el usuario navega mientras tanto—. Antes de CADA paso se vuelve
   * a mirar el candado, el gesto y `incompleta` (espejo `citasIncompletasRef`,
   * porque esto corre DESPUÉS de un `requestIdleCallback` y un closure se
   * quedaría con la bandera de cuando se PROGRAMÓ).
   *
   * `filtro` y `profileId` NO se vuelven a mirar: llegan ya CAPTURADOS de
   * `programarPrecarga`. Si el filtro cambia mientras esto corre, lo peor es
   * que se acabe de rellenar la caché del filtro ABANDONADO —trabajo de más,
   * nunca un dato mal puesto bajo la clave de otro filtro—, y la próxima
   * navegación lo sustituye. Si el perfil se fuera (cierre de sesión), el
   * efecto de desmontaje de abajo ya suelta el candado.
   *
   * No toca NINGÚN estado de React ni `ultimaTraidaRef`: sólo cachea, vía
   * `traerCitasDeduplicado` → `guardarCitas`, que ya descarta sola por
   * generación (ver `cacheRangosCitas.ts`). Un fallo de red se traga: una
   * precarga que no llegó no es un error que el usuario deba ver, la traída
   * real irá a la red como si nunca hubiera habido precarga.
   */
  async function ejecutarPrecarga(
    rango: { startStr: string; endStr: string }, filtro: string, profileId: string, token: PrecargaEnCurso,
  ): Promise<void> {
    for (const paso of [semanaSiguiente(rango), semanaAnterior(rango)]) {
      if (token.cancelado || hayGestoEnCurso(gestoEnCursoRef) || citasIncompletasRef.current) return
      if (leerCitas(claveCitas(profileId, filtro, paso.startStr, paso.endStr))) continue
      try {
        await traerCitasDeduplicado(paso.startStr, paso.endStr, filtro, profileId, citasEnVueloRef.current)
      } catch {
        return
      }
    }
  }

  /* Candado y temporizador no sobreviven al desmontaje — una precarga que
     resuelve tarde sobre un componente ya ido no debe tocar nada (aunque no
     tocaría estado de React de todos modos, el `fetch` en vuelo se queda
     sin para qué seguir). */
  useEffect(() => cancelarPrecargaEnCurso, [])

  return {
    eventSourcesStable,
    refetch,
    alEmpezarGesto,
    alTerminarGesto,
    programarPrecarga,
    ultimaTraidaRef,
    errorCitas,
    citasIncompletas,
    estadoGoogle,
    googlePendiente,
  }
}
