'use client'

/* Hasta A1.4a este archivo era `agenda/page.tsx`; las referencias `page.tsx:NNNN`
   en comentarios y docs apuntan aquí. */

import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import type { DatesSetArg, EventClickArg, EventDropArg, DateSelectArg, EventApi, EventContentArg, DayHeaderContentArg } from '@fullcalendar/core'
import { Calendar as CalendarioFC } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useProfile } from '@/hooks/useProfile'
import { canManageClinica, canVerAgendaCompleta } from '@/lib/permissions'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { componerNombreMedicoCompleto, componerInicialesMedico } from '@/lib/nombreMedico'
import { useMenuMovil } from '@/contexts/MenuMovilContext'
import { CabeceraEscritorio } from '@/components/agenda/CabeceraEscritorio'
import { BarraAgendarMovil } from '@/components/agenda/BarraAgendarMovil'
import { LeyendaEstados } from '@/components/agenda/LeyendaEstados'
import { AvisosAgenda } from '@/components/agenda/AvisosAgenda'
import { PanelPorConfirmar } from '@/components/agenda/PanelPorConfirmar'
import { esRespuestaReciente, leerRespuesta, textoAvisoCancelacion } from '@/lib/agenda/avisoCancelacion'
import {
  VISTAS_FC, VISTAS_FC_MOVIL, VISTAS_FC_TABLETA, TOOLBAR_ESCRITORIO, PLUGINS_FC, TEXTO_BOTONES_FC, FORMATO_HORA_FC,
} from '@/components/agenda/opcionesCalendario'
/* ⚠️ A2.6: `AppointmentModal`, `HorarioModal` y `ModalInvitacionCita` se
   cargan en diferido más abajo, con `next/dynamic` — son los tres modales más
   pesados de la agenda y no hacen falta en el JS inicial de `/agenda`. Lo que
   SÍ se importa aquí arriba, a secas, son sólo TIPOS (`import type`, que se
   borra en compilación). `DEFAULT_DURATION` —que ya no vive en
   `AppointmentModal.tsx`, ver `src/lib/agenda/duracionCita.ts`— se fue de este
   archivo en A2.5.7, junto con `handleEventDrop`, que era quien lo usaba. */
import type { ModalState, PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import type { FuenteHorario } from '@/components/agenda/HorarioModal'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import { renderEventContent, type InicialesDeCita } from '@/components/agenda/renderEventContent'
import { renderNowIndicator } from '@/components/agenda/renderNowIndicator'
import { CabeceraDiaLista } from '@/components/agenda/CabeceraDiaLista'
import { BandaMovil } from '@/components/agenda/BandaMovil'
import { PanelDelDia } from '@/components/agenda/PanelDelDia'
import { PanelDia } from '@/components/agenda/PanelDia'
import { renderSinEventos } from '@/components/agenda/renderSinEventos'
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { vaciarCacheGoogle } from '@/lib/agenda/cacheEventosGoogle'
import type { SemillaCitas } from '@/lib/agenda/semillaCitas'
import { enOcioso, cancelarOcioso } from '@/lib/agenda/ocioso'
import { useFiltroMedico } from '@/app/(app)/agenda/useFiltroMedico'
import { useFuentesAgenda } from '@/app/(app)/agenda/useFuentesAgenda'
import { useTiempoRealAgenda } from '@/app/(app)/agenda/useTiempoRealAgenda'
import { useVentanaRejilla } from '@/app/(app)/agenda/useVentanaRejilla'
import { useConteoVisible, usePanelDelMes, useResumenDelDia } from '@/app/(app)/agenda/useResumenVisible'
import { crearGuardadoCitas, pacienteParaInvitacion } from '@/app/(app)/agenda/guardadoCitas'
import { empalmesPintados } from '@/lib/agenda/empalmesCita'
import { crearAltaCitas } from '@/app/(app)/agenda/altaCitas'
import type { ApiInteraccionesV2, SeleccionDesdeHueco } from '@/lib/agenda/contratosV2'
import useSWR, { useSWRConfig } from 'swr'
import {
  CLAVE_CONFIG,
  CONFIG_DEDUPE_MS,
  fetcherConfig,
  revalidarConfigAlMontar,
  type ConfigApp,
  type MedicoConfig,
} from '@/lib/configApp'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
export type { Appointment }
import { DIAS, horarioToBusinessHours } from '@/lib/agenda/horarioAgenda'
import { horarioDeLaRejilla } from '@/lib/agenda/horarioRejilla'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { rangosDeLaVista, partirFechaHora } from '@/lib/agenda/fechasAgenda'
import { frasearConteo, frasearConteoBreve } from '@/lib/agenda/conteoAgenda'
import {
  esVistaDeRejilla, vistaEnElOtroFormato, vistaAdmiteCompactar,
  periodoDeLaVista, ANCHO_TABLETA,
} from '@/lib/agenda/vistasAgenda'
import { clasesDelEvento } from '@/lib/agenda/tarjetasAgenda'
import { desplazarListaAHoy, diaLocalISO } from '@/lib/agenda/listaHoy'
import { podarMarcas } from '@/lib/agenda/marcasMovimiento'
import { duracionMovimiento, esCambioDeFecha, fundirNavegacion, type MarcaDeVista } from '@/lib/agenda/movimientoAgenda'

/* ═══ A2.6 · LOS TRES MODALES EN DIFERIDO ═════════════════════════════════
   `AppointmentModal` (el más grande: iconos, `Portal`, `QuickPatientModal`,
   los hooks de consultorios…), `HorarioModal` y `ModalInvitacionCita` no
   hacen falta en el JS inicial de `/agenda` — sólo se montan cuando algo los
   abre. `dynamic()` va A NIVEL DE MÓDULO y no dentro del componente ni de un
   render: es el propio aviso de la documentación de Next ("similar to
   `React.lazy`") y es lo que permite que `precargarModalesAgenda` (más abajo)
   dispare el mismo `import()` por su cuenta y los dos apunten al mismo chunk.

   `ssr: false` porque viven dentro de un árbol de cliente que los monta sólo
   tras una interacción (`modal.mode !== 'closed'`, `horarioOpen`,
   `invitacion`) — nunca en el primer render — y porque, igual que el ejemplo
   de la propia guía de Next, dependen de APIs de navegador (`Portal` lee
   `document.body`).

   `loading: () => null`: mientras el chunk no ha llegado no hay hueco visible
   que dejar — no hay spinner ni placeholder, el modal simplemente aparece
   cuando su JS está listo. Como el nombre del componente es el MISMO que el
   que ya usaba el JSX de abajo, no hace falta tocar ni una línea del render. */
const AppointmentModal = dynamic(() => import('@/components/agenda/AppointmentModal'), {
  ssr: false, loading: () => null,
})
const HorarioModal = dynamic(() => import('@/components/agenda/HorarioModal'), {
  ssr: false, loading: () => null,
})
const ModalInvitacionCita = dynamic(() => import('@/components/agenda/ModalInvitacionCita'), {
  ssr: false, loading: () => null,
})
/* F3 · LAS INTERACCIONES V2 (burbuja, tarjeta, minicalendario, buscador,
   atajos, deslizar) en UN chunk aparte, montado sólo con el interruptor
   encendido y en ocioso (ver `montarV2`). Apagado no se descarga nada: de su
   contrato aquí sólo entran tipos (`contratosV2.ts`). */
const InteraccionesV2 = dynamic(() => import('@/components/agenda/InteraccionesV2'), {
  ssr: false, loading: () => null,
})
/* Las piezas que van fuera de la capa: el desplegable de fecha (ranura
   `selectorFecha`), la lupa con la ayuda de atajos (ranura `buscar`) y el
   minicalendario del panel de Día. Mismo módulo, mismo chunk. */
const SelectorFechaV2 = dynamic(() => import('@/components/agenda/HerramientasV2').then(m => m.SelectorFechaV2), {
  ssr: false, loading: () => null,
})
const BuscarV2 = dynamic(() => import('@/components/agenda/HerramientasV2').then(m => m.BuscarV2), {
  ssr: false, loading: () => null,
})
const MiniMesPanelV2 = dynamic(() => import('@/components/agenda/HerramientasV2').then(m => m.MiniMesPanelV2), {
  ssr: false, loading: () => null,
})

/**
 * Descarga los chunks de los tres modales SIN montarlos. Misma ruta exacta de
 * `import()` que el `dynamic()` de arriba de cada uno — para `webpack` es el
 * mismo módulo, así que cuando el modal de verdad vaya a montarse el chunk ya
 * está en caché y la espera no se nota.
 *
 * Llamarla más de una vez no pide la red otra vez: el `import()` de un módulo
 * ya resuelto (o en vuelo) devuelve la misma promesa cacheada — por eso no
 * hace falta un candado ni acordarse de si ya se llamó. La llaman dos sitios
 * (ver `AgendaCliente`): el ocioso tras montar la agenda, y el `onMouseEnter`/
 * `onFocus` del botón «Agendar» como red de seguridad si el ocioso todavía no
 * disparó.
 */
function precargarModalesAgenda(): void {
  void import('@/components/agenda/AppointmentModal')
  void import('@/components/agenda/HorarioModal')
  void import('@/components/agenda/ModalInvitacionCita')
}

/* ─── Tipos ────────────────────────────────────────────── */

/* Constante de módulo, no `[]` en línea: un array nuevo por render cambiaría
   la identidad de `inicialesDeCita` y con ella la de `eventContent`, que
   FullCalendar usa para decidir si repintar las tarjetas. */
const SIN_MEDICOS: MedicoConfig[] = []

/* Lo que tiene que tardar una traída para que se note que está tardando (§11:
   «Bajo 150 ms no se muestra nada. Evita el flash»).
   ⚠️ NO LO BAJES PENSANDO QUE ASÍ SE «RESPONDE ANTES». Lo que hay debajo de este
   umbral no es una espera, es un parpadeo: la rejilla se atenúa y vuelve antes
   de que el ojo lo lea como un estado, y encima le cae encima la rampa de
   opacidad de 180 ms de `--ag-dur-base` (CONTRASTE_Y_MOVIMIENTO §3). */
const UMBRAL_CARGA_MS = 150
/* C6: volver a sondear Google al volver a la pestaña. El mismo valor que
   `UMBRAL_REFETCH_FOCO_MS` de `useTiempoRealAgenda.ts`, repetido a propósito
   (es local a ese gancho). */
const UMBRAL_SONDEO_FOCO_MS = 120_000

/* F2.7: la salida animada del modal de la cita (ver la nota junto a
   `closeModal`). `AppointmentModal` ya recibe `saliendo`: `data-estado` en
   velo y panel, e `inert` en su raíz. */
const SALIDA_DEL_MODAL: boolean = true

/* ─── Página principal ─────────────────────────────────── */

/* ── EL UMBRAL, Y NO VIAJA SOLO ────────────────────────────────────────────
   ⚠️ SUBIÓ DE 768 A 1024 EN EL BLOQUE 6. Los otros miembros son las media
   queries `max-width: 1023px` de `globals.css` —el relleno de la página, el
   cromo de la tarjeta y el mes del teléfono—. Todas dicen lo MISMO —«a partir de
   aquí la agenda es estrecha»— y si divergen aparece la franja de anchos en la
   que el calendario ya es una lista pero el cromo sigue creyéndose de
   escritorio, o al revés. El aviso está escrito en los dos sitios: si mueves
   uno, muévelos todos.
   ⚠️ LA DE LA LEYENDA ERA DE ESTA LISTA Y SE RETIRÓ EN EL BLOQUE 8: la leyenda
   pasó a tener fila propia también en escritorio, así que ya no hay nada que
   redeclarar por debajo del umbral. */
const ANCHO_MOVIL = 1024

/* ═══ F1.3 · DENSIDAD, PREFERENCIA DEL NAVEGADOR ════════════════════════════
   Mismo patrón que la barra plegada de `Sidebar` (copiado a propósito, dos usos):
   `useSyncExternalStore` con `false` en el servidor, así que no hay desajuste de
   hidratación. Sin datos de nadie: sólo «compacta» o no. */
const CLAVE_DENSIDAD = 'spinus.agenda.densidad'
const EVENTO_DENSIDAD = 'spinus:agenda-densidad'
function leerDensidadCompacta(): boolean {
  try { return localStorage.getItem(CLAVE_DENSIDAD) === 'compacta' } catch { return false }
}
function suscribirDensidad(aviso: () => void): () => void {
  window.addEventListener('storage', aviso)
  window.addEventListener(EVENTO_DENSIDAD, aviso)
  return () => { window.removeEventListener('storage', aviso); window.removeEventListener(EVENTO_DENSIDAD, aviso) }
}
function guardarDensidad(compacta: boolean): void {
  try { localStorage.setItem(CLAVE_DENSIDAD, compacta ? 'compacta' : 'normal') } catch { /* modo privado */ }
  window.dispatchEvent(new Event(EVENTO_DENSIDAD))
}

export interface AgendaClienteProps {
  /** Las citas de W-1, W y W+1 sembradas por `page.tsx` (A1.4c). Sin ella, o
   *  si resuelve `null`, la agenda pide a la red como antes. */
  semillaCitas?: Promise<SemillaCitas<Appointment> | null>
  /** El interruptor de la agenda v2 de la clínica, leído en el servidor por
   *  `page.tsx` (plan del bloque B §1). Sin él, o si rechaza: apagado. */
  interruptor?: Promise<boolean>
}

export default function AgendaCliente({ semillaCitas, interruptor }: AgendaClienteProps) {
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)
  /* ⚠️ `agendaV2` ES `false` HASTA QUE LA PROMESA DEL SERVIDOR DIGA `true`:
     falla cerrado, como `agendaV2Encendida`. Se lee con `.then()` y no con
     `use()`, igual que la semilla, para no suspender la agenda entera por un
     booleano. `null` = todavía sin respuesta (cuenta como apagado); se
     distingue sólo para que `data-agenda-v2` de la raíz diga «pendiente» y
     una prueba pueda esperar a la respuesta de verdad. Lo leerán los pasos
     del bloque B que van detrás del interruptor. */
  const [interruptorLeido, setInterruptorLeido] = useState<boolean | null>(null)
  const agendaV2 = interruptorLeido === true
  useEffect(() => {
    if (!interruptor) return
    let vigente = true
    interruptor.then(
      (v) => { if (vigente) setInterruptorLeido(v === true) },
      () => { if (vigente) setInterruptorLeido(false) },
    )
    return () => { vigente = false }
  }, [interruptor])
  const [modal,        setModal]        = useState<ModalState>({ mode: 'closed' })
  /* F3: el chunk de interacciones se monta en ocioso y sólo con v2; mientras
     no está, `interaccionesRef` es null y los gestos abren el modal de hoy. */
  const [montarV2, setMontarV2] = useState(false)
  const [interaccionesListas, setInteraccionesListas] = useState(false)
  /* F3.5 · La preferencia de los atajos de una tecla vive en el chunk
     (`InteraccionesV2`, que la publica con `alCambiarAtajos`). `atajos` es lo
     que reciben la barra y la banda: `aria-keyshortcuts` sólo cuando las teclas
     funcionan de verdad (v2, el chunk montado y los atajos sin apagar). */
  const [atajosEncendidos, setAtajosEncendidos] = useState(false)
  const atajos = agendaV2 && interaccionesListas && atajosEncendidos
  const interaccionesRef = useRef<ApiInteraccionesV2 | null>(null)
  const seleccionDesdeHueco = useRef<SeleccionDesdeHueco['current']>(null)
  /* F3: el periodo que pinta el calendario (`'desde/hasta'`), para el
     minicalendario. Cadena y no fechas, como `tituloVista`: no repinta si no
     cambió. */
  const [rangoVisible, setRangoVisible] = useState('')
  useEffect(() => {
    if (!agendaV2) return
    const idle = enOcioso(() => setMontarV2(true))
    return () => cancelarOcioso(idle)
  }, [agendaV2])
  const [isMobile,     setIsMobile]     = useState(false)
  /* F1.16 · El tramo de tableta (768–1023): banda azul como el teléfono, pero
     Semana y Día en rejilla (Semana de tres días). */
  const [esTableta,    setEsTableta]    = useState(false)
  const [currentView,  setCurrentView]  = useState<string>('timeGridWeek')
  /* La etiqueta de fecha de la banda móvil. Con `headerToolbar={false}` ya no
     hay toolbar nativo que la pinte, así que se guarda lo que compone
     FullCalendar (`view.title`, que sale del `titleFormat` de `VISTAS_FC`) y se
     escribe en `datesSet`, que es quien sabe cuándo cambia el rango. */
  const [tituloVista, setTituloVista] = useState('')
  /* F1.10 · ¿El periodo pintado contiene hoy? Apaga el «Hoy» de la banda móvil,
     igual que FullCalendar apaga el suyo en escritorio. Booleano: bail-out. */
  const [hoyEnRango, setHoyEnRango] = useState(true)
  /* F1.3 · Densidad compacta. Al cambiar, FullCalendar tiene que volver a medir
     las franjas (sus coordenadas no siguen a una variable CSS): `updateSize`. */
  const densidadCompacta = useSyncExternalStore(suscribirDensidad, leerDensidadCompacta, () => false)
  useEffect(() => {
    const id = requestAnimationFrame(() => calendarRef.current?.getApi().updateSize())
    return () => cancelAnimationFrame(id)
  }, [densidadCompacta])
  /* F1.2 · FullCalendar 6 no observa su contenedor (cero `ResizeObserver` en el
     núcleo): sólo reacciona al `resize` de la ventana. Al plegar la barra lateral
     la página gana 192 px sin `resize`, así que aquí se le avisa, en el cuadro
     siguiente y sólo si cambió el ANCHO. La misma raíz es donde el gesto de
     deslizar (F3.7) cuelga sus oyentes de puntero. */
  const raizRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const raiz = raizRef.current
    if (!raiz || typeof ResizeObserver === 'undefined') return
    let ancho = raiz.getBoundingClientRect().width
    let cuadro = 0
    const ro = new ResizeObserver(([e]) => {
      if (!e || Math.abs(e.contentRect.width - ancho) < 0.5) return
      ancho = e.contentRect.width
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => calendarRef.current?.getApi().updateSize())
    })
    ro.observe(raiz)
    return () => { ro.disconnect(); cancelAnimationFrame(cuadro) }
  }, [])
  /* F1.12 · La lista de Semana del teléfono abre en HOY: la primera vez que se
     pinta un rango con hoy, y otra vez tras pulsar «Hoy». Queda PENDIENTE hasta
     que haya filas que medir (llegan con `eventsSet` si no estaban en caché). */
  const listaHoyVistaRef = useRef(false)
  const listaHoyPendienteRef = useRef(false)
  const irAHoyRef = useRef(false)
  const intentarListaHoy = (): void => {
    if (!listaHoyPendienteRef.current) return
    requestAnimationFrame(() => {
      const raiz = raizRef.current
      if (raiz && desplazarListaAHoy(raiz, diaLocalISO(new Date()))) listaHoyPendienteRef.current = false
    })
  }
  /* El periodo que nombra la banda de vacío —«esta semana», «en agosto»—, ya
     formateado. Se escribe en `datesSet` junto al título, que es el único sitio
     donde se sabe qué rango pinta la vista.
     ⚠️ SE GUARDA LA CADENA Y NO LA FECHA, igual que `tituloVista`, `ventana` y
     `conteo`: una `Date` es un objeto nuevo en cada `datesSet` y no se puede
     comparar, así que reescribiría el estado —y re-renderizaría el árbol— en
     cada navegación aunque el mes fuera el mismo. Una cadena se compara sola en
     el bail-out de React. */
  const [periodoVacio, setPeriodoVacio] = useState('')
  const [horarioOpen,  setHorarioOpen]  = useState(false)
  const [confirm,      setConfirm]      = useState<{ message: string; onConfirm: () => void; onCancel: () => void } | null>(null)
  const [citaCreada,   setCitaCreada]   = useState(false)
  /* La invitación vive AQUÍ y no dentro del modal de la cita, porque tiene que
     poder abrirse sola al crear una cita — y para entonces aquel modal ya se
     cerró (`closeModal()` corre antes del `fetch` en `handleSave`).
     `esperandoEvento` distingue las dos puertas: recién creada (hay que esperar
     a que Google conteste) o abierta a mano desde una cita que ya tiene evento. */
  const [invitacion, setInvitacion] = useState<
    { citaId: string; paciente: { id: string; nombre: string; correoFicha: string | null } | null; esperandoEvento: boolean } | null
  >(null)
  /* ═══ BLOQUE 9 · LO QUE SE SABE DE LA ÚLTIMA TRAÍDA ═══════════════════════
     Cuatro estados y ninguno derivado de otro, porque describen cosas distintas:
     si hay algo en vuelo, si ya llegó algo alguna vez, si las CITAS fallaron y
     qué contestó Google. Los pintan las cuatro bandas de `.ag-avisos`, cuyo
     orden de prioridad está escrito junto al componente `Banda`.

     ⚠️ `cargando` NO es «la primera carga»: FullCalendar emite su hook `loading`
     con el AGREGADO de las dos fuentes (`computeEventSourcesLoading`,
     @fullcalendar/core/index.js:549-556), así que vale también para cada cambio
     de fecha, de vista y de filtro. Eso es justo lo que se quiere: la atenuación
     de §11 es para la NAVEGACIÓN, no para el montaje. */
  const [cargando, setCargando] = useState(false)
  /* La misma señal, retrasada 150 ms. §11: «Bajo 150 ms no se muestra nada.
     Evita el flash», y CONTRASTE_Y_MOVIMIENTO §3 lo remacha —con la rampa de
     180 ms encima, atenuar una carga de 80 ms parpadea peor que no atenuar—.
     Es lo que consumen la clase y la barra; `cargando` a secas no se pinta. */
  const [cargaVisible, setCargaVisible] = useState(false)
  /* Falso hasta que la primera traída TERMINA, con datos o con error. Es el
     seguro del estado vacío: `conteo` arranca en `CONTEO_VACIO`, así que sin
     esto la banda «Sin citas esta semana» saldría durante toda la primera
     carga, que es exactamente la mentira que este bloque viene a matar. */
  const [huboTraida, setHuboTraida] = useState(false)

  /* El retraso de 150 ms de `cargaVisible`. Efecto y no `setTimeout` suelto para
     que el temporizador se cancele solo al desmontar y en cada cambio de
     `cargando`: sin la limpieza, una traída de 80 ms dejaría el temporizador
     vivo y la rejilla se atenuaría 70 ms DESPUÉS de haber terminado, que es el
     parpadeo al revés y el más difícil de diagnosticar.
     El apagado es INMEDIATO y no simétrico a propósito: hacer esperar a que la
     rejilla vuelva a plena opacidad no compra nada. */
  useEffect(() => {
    if (!cargando) { setCargaVisible(false); return }
    const t = window.setTimeout(() => setCargaVisible(true), UMBRAL_CARGA_MS)
    return () => window.clearTimeout(t)
  }, [cargando])

  /* Horario y médicos salen del agregado de configuración, no de dos fetch
     propios: la misma clave la piden ya el Sidebar y el provider de
     consultorios del layout, así que SWR la deduplica y abrir la agenda no
     añade ninguna petición por estos dos datos. */
  const swr = useSWRConfig()
  const { data: config, error: errorConfig, mutate: mutarConfig } = useSWR<ConfigApp>(
    CLAVE_CONFIG,
    fetcherConfig,
    // La semilla del layout no se vuelve a pedir al montar (A1.6).
    { dedupingInterval: CONFIG_DEDUPE_MS, revalidateOnMount: revalidarConfigAlMontar(swr) },
  )

  /* ── LO QUE VE EL MODAL DE HORARIO, QUE NO ES LO DE ARRIBA ────────────────
     `horario` lleva `HORARIO_DEFAULT` aplicado para la rejilla y ahí es
     deliberado (ver la nota de `scrollTime`). Enmascara dos cosas muy
     distintas: que el agregado falló y que la clínica aún no tiene horario. La
     rejilla puede vivir con eso —pinta una jornada de 09:00 y ya—, pero el
     modal ESCRIBE, y ofrecer un horario inventado como si fuera el de la
     clínica es cómo se machaca el verdadero. Por eso recibe el valor crudo.

     El orden de las ramas importa: `config` primero, así que un dato en cache
     con una revalidación fallida encima sigue siendo un dato bueno y se pinta.
     Sólo se declara `error` cuando NO hay nada que enseñar. */
  const fuenteHorario = useMemo<FuenteHorario>(() => {
    if (config) return { estado: 'listo', horario: config.horario }
    if (errorConfig) return { estado: 'error' }
    return { estado: 'cargando' }
  }, [config, errorConfig])
  const medicos = config?.medicos ?? SIN_MEDICOS
  const { profile, isDoctor, loading: cargandoPerfil } = useProfile()
  const toast = useToast()
  const { state: subState, openBloqueoModal } = useSubscriptionGate()

  /* ── ENLACE PROFUNDO: `/agenda?cita=nueva&paciente=<uuid>` ──────────────────
     La ÚNICA cosa que esta pantalla aprende de fuera. Abre el modal de alta que
     ya existe, con el paciente puesto; no rediseña nada ni añade estado nuevo
     más allá del campo opcional de `ModalState`.

     ⚠️ CORRE UNA SOLA VEZ POR CARGA, Y DE AHÍ EL REF. El efecto declara sus
     dependencias de verdad —`toast`, `subState`, `openBloqueoModal`—, así que
     React puede volver a llamarlo cuando el gate de suscripción resuelva; sin
     el ref eso dispararía una segunda consulta y, peor, podría reabrir el modal
     que el usuario acaba de cerrar. La bandera se levanta ANTES de la consulta,
     no en su respuesta.

     ⚠️ SE LEE DE `window.location` Y NO DE `useSearchParams()`. Ese hook ata la
     página al renderizado dinámico y obliga a un `<Suspense>`; aquí el
     parámetro se consume UNA vez al montar, que es justo lo que un efecto de
     cliente hace sin coste. La misma razón para retirarlo con
     `history.replaceState` en vez de `router.replace`: éste pediría el árbol
     RSC de la ruta entera, y esta pantalla lleva media docena de comentarios
     sobre no pagar viajes de red que no hacen falta.

     ⚠️ EL PARÁMETRO SE RETIRA EN TODOS LOS CAMINOS, también cuando el paciente
     no aparece. Si sólo se limpiara al abrir, cerrar el modal y refrescar lo
     reabriría —que es lo que el bloque pide evitar—, y en el camino de fallo
     repetiría el aviso en cada recarga.

     La FECHA Y LA HORA son las de ahora, exactamente como el botón «+ Nueva
     cita» de la banda: el enlace trae el paciente, no un momento, y esta ruta
     es el atajo de «pulsar el botón y elegir a ese paciente». */
  const enlaceProfundoRef = useRef(false)
  useEffect(() => {
    if (enlaceProfundoRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('cita') !== 'nueva') return
    enlaceProfundoRef.current = true

    const limpiarUrl = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('cita')
      url.searchParams.delete('paciente')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }

    const pacienteId = params.get('paciente')
    if (!pacienteId) { limpiarUrl(); return }

    /* Mismo patrón de consulta por id que `useCalculadoraContextual.ts`: `.single()`
       devuelve `data: null` cuando no hay fila, así que el uuid inventado y el
       recortado por RLS caen los dos en la misma rama y no hay estado ambiguo. */
    const supabase = createClient()
    supabase
      .from('pacientes')
      .select('id, nombre, apellidos, telefono')
      .eq('id', pacienteId)
      .single()
      .then((res: { data: PacienteBusqueda | null }) => {
        limpiarUrl()
        if (!res.data) {
          toast.info('No se encontró ese paciente. Abre la cita y elígelo a mano.')
          return
        }
        /* El mismo portero que el botón «+ Nueva cita»: sin esto, una clínica
           bloqueada abriría el modal por url y se estrellaría al guardar contra
           la RLS, con el error crudo de BILL-DT-3 en vez del aviso bueno. */
        if (subState.isBlocked) { openBloqueoModal(); return }
        const { fecha, hora } = partirFechaHora(new Date().toISOString())
        setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no', paciente: res.data })
      })
      .catch(() => {
        limpiarUrl()
        toast.info('No se pudo cargar ese paciente. Abre la cita y elígelo a mano.')
      })
  }, [toast, subState, openBloqueoModal])

  const isMedicoSinAdmin = profile?.role === 'medico' && !profile?.es_admin_de_clinica
  const isMedicoConAdmin = profile?.role === 'medico' && profile?.es_admin_de_clinica === true
  const isSecretaria = profile?.role === 'secretaria'

  const canEditHorario  = canManageClinica(profile)
  /* B4: con la agenda v2 encendida, el engrane lleva a la pantalla de
     configuración del calendario en vez de abrir el modal de horario, y lo ve
     también quien no administra: allí ve en solo lectura y cada médico edita
     la disponibilidad de sus consultorios (P7). Apagada, todo sigue como hoy:
     sólo el administrador ve el engrane y abre el modal. La ruta es
     `(app)/agenda/configuracion`, que con el interruptor apagado da 404. */
  const router = useRouter()
  const verEngrane = canEditHorario || agendaV2
  const abrirConfiguracion = useCallback(() => {
    if (agendaV2) router.push('/agenda/configuracion')
    else setHorarioOpen(true)
  }, [agendaV2, router])
  /* Sólo `abrir`, no `alternar`: el hamburguesa de la banda no cierra el menú,
     porque cuando el menú está abierto lo tapa entero. Quien cierra es el propio
     menú —su botón de arriba y su velo—, igual que en el resto de la app. */
  const { abrir: abrirMenu } = useMenuMovil()
  const isSingleDoctor  = medicos.length <= 1
  const defaultMedicoId = useMemo(() => {
    // Médico (admin o no): default es él mismo
    if (profile?.role === 'medico' && profile?.id) return profile.id
    // Clínica single-doctor: el único médico
    if (isSingleDoctor && medicos[0]?.id) return medicos[0].id
    // Secretaria u otros: sin default (obligar elección)
    return ''
  }, [profile, isSingleDoctor, medicos])

  // F3-6e: TZ del navegador (estable) + wrapper para inyectarla a renderEventContent.
  const navegadorTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  )

  const {
    filtroEfectivo, filtroSincronoRef, aplicarFiltro, forzarMedicoParaElMes, revertirMedicoForzado,
  } = useFiltroMedico({ profile, cargandoPerfil, isSecretaria, defaultMedicoId, medicos, isSingleDoctor })

  /* ── EL HORARIO DE LA REJILLA (tanda T2, punto 10) ─────────────────────
     Con la v2, el del consultorio activo cuando tiene horario propio; si no,
     el de la clínica (la plantilla). Lo usan la rejilla (`businessHours`,
     «Compactar», la banda de fuera de horario, el resumen) y los avisos de
     fuera de horario del alta, el arrastre y el modal: TODOS leen esta
     variable, así que no pueden contradecirse. Apagada, es
     `config?.horario ?? HORARIO_DEFAULT`, el MISMO objeto de antes
     (`horarioDeLaRejilla`), y la memo conserva su identidad entre renders
     (invariante A1-bis: `horasHabilesFc` y la ventana dependen de ella).
     `horario` lleva `HORARIO_DEFAULT` aplicado: ver la nota de `fuenteHorario`. */
  const { consultorioActivo } = useConsultorioActivo()
  const medicoMostrado = filtroEfectivo || (isSingleDoctor ? medicos[0]?.id ?? null : null)
  const consultoriosConfig = config?.consultorios
  const horarioClinicaConfig = config?.horario
  const horario = useMemo(() => horarioDeLaRejilla({
    agendaV2, horarioClinica: horarioClinicaConfig, consultorios: consultoriosConfig ?? [],
    consultorioActivo, medicoMostrado,
  }), [agendaV2, horarioClinicaConfig, consultoriosConfig, consultorioActivo, medicoMostrado])

  /* Iniciales del chip de médico. Se calculan AL PINTAR, no al traer las citas.
     Al montar, `medicos` viene vacío, así que `isSingleDoctor` vale true y el
     event source no tenía con qué calcularlas; eso se corregía con un
     `refetchEvents()` en cuanto llegaban los médicos — una segunda vuelta
     entera a /api/appointments y /api/google/events por dos letras. Calculado
     aquí, el chip aparece solo en el siguiente render y la red no se toca. */
  /* F1.9 · Y SÓLO CON «TODOS»: filtrado a un médico, todas las tarjetas son
     suyas y el chip no distingue nada (decisión del diseño, punto 9). Cambiar
     el filtro ya provoca una traída, así que la dependencia nueva no añade
     repintados. Por eso va DEBAJO de `useFiltroMedico`, que da el filtro. */
  const inicialesDeCita = useCallback<InicialesDeCita>((ext) => {
    if (isSingleDoctor || !ext.medico_id || filtroEfectivo) return undefined
    // La lista manda sobre el join de la cita: al reasignar médico, el
    // `medico` de extendedProps sigue siendo el anterior hasta que responde
    // el servidor. La cita optimista tampoco trae join, solo `medico_id`.
    const m = medicos.find(x => x.id === ext.medico_id) ?? ext.medico
    return m ? componerInicialesMedico(m) : undefined
  }, [isSingleDoctor, medicos, filtroEfectivo])

  const renderEC = useCallback(
    (arg: EventContentArg) => renderEventContent(arg, navegadorTZ, inicialesDeCita),
    [navegadorTZ, inicialesDeCita]
  )

  const {
    compactar, setCompactar, ventana, diasOcultos, scrollTime, horarioRef,
    aplicarVentana, rangoDeVista, avisoRecorte, compactaElMes,
  } = useVentanaRejilla({ calendarRef, horario, currentView })

  const { conteo, aplicarConteo } = useConteoVisible({ calendarRef, diasOcultos, rangoDeVista })

  const {
    diaSel, setDiaSel, filasDia, aplicarPanel, sincronizarDiaDelPanel, dayCellClassNames,
  } = usePanelDelMes({ calendarRef, isMobile })

  const { resumenDia, aplicarResumen } = useResumenDelDia({ calendarRef, horario, horarioRef, rangoDeVista })

  /* ── Detectar ancho y cambiar de FORMATO, no de vista ──────────────────
     ⚠️ ESTO ERA OTRA COSA HASTA EL BLOQUE 6, Y LA DIFERENCIA IMPORTA. Antes
     comparaba contra dos nombres de vista literales y FORZABA: al estrechar
     mandaba a `timeGridDay` viniera de donde viniera, y al ensanchar devolvía a
     `timeGridWeek` sólo si estaba en Día. O sea que el teléfono se comía la
     elección del médico —quien estuviera en Mes acababa en Día— y al volver a
     escritorio no recuperaba lo que tenía.

     Ahora se conserva el PERIODO y sólo cambia el formato, vía
     `vistaEnElOtroFormato`. Semana en rejilla ↔ Semana en lista, Día ↔ Día, Mes
     se queda donde está.

     ⚠️ Y LA COMPARACIÓN ANTES DEL `changeView` NO ES UNA OPTIMIZACIÓN. `resize`
     dispara en cada píxel mientras se arrastra el borde de la ventana; sin ella
     habría un `changeView` por evento, y cada uno reconstruye el `dateProfile`,
     reemite `datesSet` y arrastra detrás la ventana vertical y el conteo. Con
     ella, mover la ventana dentro del mismo lado del umbral no cuesta nada.
     La idempotencia de `vistaEnElOtroFormato` es lo que la hace fiable.

     `changeView` va SIN fecha a propósito: así conserva la que se está mirando.
     Con fecha saltaría a hoy en cada cruce del umbral.

     `setCurrentView` no se toca aquí: lo escribe `datesSet`, que `changeView`
     reemite. Escribirlo también aquí serían dos fuentes para el mismo dato. */
  useEffect(() => {
    function check() {
      const movil = window.innerWidth < ANCHO_MOVIL
      const tableta = movil && window.innerWidth >= ANCHO_TABLETA
      setIsMobile(movil)
      setEsTableta(tableta)
      const api = calendarRef.current?.getApi()
      if (!api) return
      const destino = vistaEnElOtroFormato(api.view.type, movil, tableta)
      if (destino !== api.view.type) api.changeView(destino)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── F2.7 · LA SALIDA DEL MODAL DE LA CITA ─────────────────────────────
     `modal` sigue siendo la ÚNICA verdad de si está abierto: se cierra al
     instante, como siempre, y todo lo que mira `modal.mode` no se entera.
     Lo que dura `--ag-dur-base` es sólo el PINTADO: `modalSaliente` guarda el
     que se va para que siga montado, con `saliendo`, mientras se desvanece
     (CSS `.ag-modal-panel[data-estado="saliendo"]`). Si se abre otro antes de
     que acabe, manda el nuevo y el temporizador no toca nada que no sea suyo.
     Con movimiento reducido la espera es 0 y se desmonta como antes.

     ⚠️ `saliendo={modal.mode === 'closed'}` EN EL JSX NO SE QUITA: el modal
     pone `data-estado` en el panel y en el velo, e `inert` en su raíz. Sin
     eso seguiría montado 180 ms SIN animar y, peor, pulsable: un segundo
     «Guardar» crearía otra cita. */
  const [modalSaliente, setModalSaliente] = useState<ModalState | null>(null)

  function closeModal() {
    const espera = SALIDA_DEL_MODAL && modal.mode !== 'closed' ? duracionMovimiento('--ag-dur-base') : 0
    if (espera > 0) {
      const saliente = modal
      setModalSaliente(saliente)
      setTimeout(() => setModalSaliente(m => (m === saliente ? null : m)), espera)
    }
    setModal({ mode: 'closed' })
  }
  /** Lo que se pinta: el abierto, o el que está saliendo. */
  const modalPintado: ModalState = modal.mode !== 'closed' ? modal : (modalSaliente ?? modal)

  const {
    eventSourcesStable, refetch, alEmpezarGesto, alTerminarGesto, programarPrecarga, ultimaTraidaRef,
    errorCitas, citasIncompletas, estadoGoogle, googlePendiente,
  } = useFuentesAgenda({ semillaCitas, calendarRef, profile, filtroEfectivo, filtroSincronoRef })

  /* ⚠️⚠️ CAMBIAR DE VISTA NO VUELVE A PEDIR NADA, Y CON LA TRAÍDA RECORTADA ESO
     DEJABA A LA BANDA ROJA OFRECIENDO UNA SALIDA QUE NO LO ERA.

     FullCalendar sirve desde su caché cualquier rango CONTENIDO en otro que ya
     trajo, así que pasar de Mes a Semana dentro del mes ya cargado cuesta CERO
     peticiones. Está comprobado instrumentando `fetch` (2026-08-30): al pulsar
     «Ver por semana» no salía ninguna, ni en ese sentido ni en el contrario.

     Con la traída ENTERA eso es lo correcto y no se toca: refrescar en cada
     cambio de vista pagaría dos peticiones por navegación a cambio de nada.

     Con la traída RECORTADA es justo al revés, porque la vista nueva HEREDA el
     recorte de la vieja: lo que hay en caché son las primeras filas del rango
     ANCHO, ordenadas por fecha, y una semana del final del mes cae entera fuera
     de ellas. En la prueba, la semana que la banda ofrecía —nueve citas reales—
     salía con CERO. Recargando la página aparecían. O sea que el único botón que
     la banda ofrece como remedio dejaba la agenda más vacía que antes.

     ⚠️ POR QUÉ EL REFETCH VA CONDICIONADO Y NO SIEMPRE. `citasIncompletas` es
     exactamente la línea que separa el caso raro del camino normal, y el camino
     normal es el que no puede pagar peticiones de más. Sin la condición, cada
     cambio de vista de cada día costaría dos traídas para arreglar un caso que
     casi nunca ocurre.

     ⚠️ NO TOCA `eventSourcesStable` NI LAS DOS FUENTES MEMOIZADAS, y no puede:
     `refetchEvents()` es una llamada imperativa sobre la API del calendario, no
     una dependencia de nada. La identidad de las tres se queda donde estaba, y
     con ella el silencio de `handleEventSources`.

     ⚠️ Y NO PASA POR `refetch()`, EL DE LA RECONEXIÓN, aunque se parezcan.
     Aquél se calla si hay un gesto de arrastre en curso —tiene que hacerlo, o
     purga los eventos a mitad del arrastre—, y aquí esa guarda convertiría el
     botón en uno que a veces no hace nada. Un cambio de vista no ocurre a mitad
     de un arrastre.

     ⚠️ EL `changeView` VA SIN FECHA SALVO QUE SE LE DÉ UNA, y la rama importa:
     sin fecha conserva la que se está mirando, que es lo que quieren el
     segmentado y la banda. La única que sí manda fecha es la salida «Ver día»
     del panel del mes en el teléfono. */
  /* ⚠️⚠️ CAMBIAR DE VISTA NO VUELVE A PEDIR NADA, Y CON LA TRAÍDA RECORTADA ESO
     DEJABA A LA BANDA ROJA OFRECIENDO UNA SALIDA QUE NO LO ERA.

     FullCalendar sirve desde su caché cualquier rango CONTENIDO en otro que ya
     trajo, así que pasar de Mes a Semana dentro del mes ya cargado cuesta CERO
     peticiones. Está comprobado instrumentando `fetch` (2026-08-30): al pulsar
     «Ver por semana» no salía ninguna, ni en ese sentido ni en el contrario.

     Con la traída ENTERA eso es lo correcto y no se toca: refrescar en cada
     cambio de vista pagaría dos peticiones por navegación a cambio de nada.

     Con la traída RECORTADA es justo al revés, porque la vista nueva HEREDA el
     recorte de la vieja: lo que hay en caché son las primeras filas del rango
     ANCHO, ordenadas por fecha, y una semana del final del mes cae entera fuera
     de ellas. En la prueba, la semana que la banda ofrecía —nueve citas reales—
     salía con CERO. Recargando la página aparecían. O sea que el único botón que
     la banda ofrece como remedio dejaba la agenda más vacía que antes.

     ⚠️ POR QUÉ EL REFETCH VA CONDICIONADO Y NO SIEMPRE. `citasIncompletas` es
     exactamente la línea que separa el caso raro del camino normal, y el camino
     normal es el que no puede pagar peticiones de más. Sin la condición, cada
     cambio de vista de cada día costaría dos traídas para arreglar un caso que
     casi nunca ocurre.

     ⚠️ NO TOCA `eventSourcesStable` NI LAS DOS FUENTES MEMOIZADAS, y no puede:
     `refetchEvents()` es una llamada imperativa sobre la API del calendario, no
     una dependencia de nada. La identidad de las tres se queda donde estaba, y
     con ella el silencio de `handleEventSources`.

     ⚠️ Y NO PASA POR `refetch()`, EL DE LA RECONEXIÓN, aunque se parezcan.
     Aquél se calla si hay un gesto de arrastre en curso —tiene que hacerlo, o
     purga los eventos a mitad del arrastre—, y aquí esa guarda convertiría el
     botón en uno que a veces no hace nada. Un cambio de vista no ocurre a mitad
     de un arrastre.

     ⚠️ EL `changeView` VA SIN FECHA SALVO QUE SE LE DÉ UNA, y la rama importa:
     sin fecha conserva la que se está mirando, que es lo que quieren el
     segmentado y la banda. La única que sí manda fecha es la salida «Ver día»
     del panel del mes en el teléfono.

     ── Y ADEMÁS ES LA PUERTA DEL MES ────────────────────────────────────────
     ⚠️ LAS DOS ESCRITURAS DEL FILTRO VAN ANTES DEL `changeView`, Y EL ORDEN ES
     TODO EL ARREGLO. `changeView` pide de forma síncrona; si el filtro se
     escribiera después, la petición saldría con el valor viejo. Ver
     `filtroSincronoRef`.

     ⚠️ VA AQUÍ Y NO EN `datesSet`: aquél se reemite en cada `prev/next`, en cada
     cambio de `hiddenDays` y en cada cruce del umbral de ancho, y esto tiene que
     correr UNA vez por cambio de vista. Comprobado que toda entrada a Mes pasa
     por aquí: no hay persistencia de la vista, `initialView` es Semana, el
     toolbar de escritorio no lleva botones de vista y el efecto del ancho empareja
     Mes consigo mismo. */
  function cambiarVista(tipo: string, fecha?: Date) {
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (tipo === 'dayGridMonth') forzarMedicoParaElMes()
    else revertirMedicoForzado()
    if (fecha) api.changeView(tipo, fecha)
    else api.changeView(tipo)
    setCurrentView(tipo)
    // Vaciar: la vista nueva podría estar guardada de antes y no se sirve aquí.
    if (citasIncompletas) { vaciarCacheCitas(); api.refetchEvents() }
  }

  /* A2.6: tras montar la agenda, en tiempo ocioso, se dispara la descarga de
     los chunks de los tres modales (`precargarModalesAgenda`, a nivel de
     módulo). Así la PRIMERA apertura de «Agendar» no espera a la red: para
     cuando el médico pulsa, el chunk casi siempre ya llegó. Mismo candado
     ocioso que la precarga de semanas vecinas (`enOcioso`/`cancelarOcioso`),
     y se cancela igual al desmontar. */
  useEffect(() => {
    const idle = enOcioso(precargarModalesAgenda)
    return () => cancelarOcioso(idle)
  }, [])

  /* ── C6 · SONDEO DE GOOGLE AL ABRIR LA AGENDA (mejora_agendaV2.md, C-g) ──
     Sólo con el interruptor v2 encendido y sólo administrador o secretaria
     (`canVerAgendaCompleta`): en tiempo ocioso tras la primera pintura, y otra
     vez al volver a la pestaña pasados 2 min (el mismo umbral que el refresco
     por foco). No bloquea nada y un fallo no se ve: es un sondeo. El mínimo
     de 60 s entre sondeos por clínica lo impone la base para todas las
     pestañas. Si cambió algo en Spinus, se vacían las dos cachés y se vuelve
     a pedir: así lo importado sale de la vista de solo lectura (la ruta de
     Google lo resta) y aparece como fila. Apagado, este efecto no hace nada
     y no sale ninguna petición. */
  const ultimoSondeoRef = useRef(0)
  /* E8 y D11: sube para que el panel «Por confirmar» se recargue (cancelación
     del paciente, o un sondeo que trajo cambios y puede traer un empalme con
     una reserva por enlace). */
  const [recargaPanel, setRecargaPanel] = useState(0)
  const puedeSondear = agendaV2 && profile !== null && canVerAgendaCompleta(profile)
  useEffect(() => {
    if (!puedeSondear) return
    let vigente = true
    const sondear = (): void => {
      ultimoSondeoRef.current = Date.now()
      fetch('/api/google/sync', { method: 'POST' })
        .then(async (res): Promise<number> => {
          if (!res.ok) return 0
          const datos: unknown = await res.json()
          return typeof datos === 'object' && datos !== null && 'cambios' in datos && typeof datos.cambios === 'number' ? datos.cambios : 0
        })
        .then((cambios) => {
          if (!vigente || cambios <= 0) return
          vaciarCacheGoogle()
          refetch(true)
          setRecargaPanel((n) => n + 1)
        })
        .catch(() => undefined)
    }
    const idle = enOcioso(sondear)
    const alVolver = (): void => {
      if (document.visibilityState === 'visible' && Date.now() - ultimoSondeoRef.current >= UMBRAL_SONDEO_FOCO_MS) sondear()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vigente = false
      cancelarOcioso(idle)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [puedeSondear, refetch])

  /* ── E8 · «AVISA A LA CLÍNICA» (§2, plan_E lista A 12) ─────────────────
     Sólo con la v2 encendida. Cuando el canal trae una cancelación AJENA de
     una cita pintada (no eco propio), se pregunta UNA vez a
     `/api/agenda/respuestas` si fue el paciente por el enlace hace menos de
     2 min; si sí, un aviso sin el nombre del paciente y el panel se recarga.
     Apagada, el gancho no recibe el callback y no sale ninguna petición. */
  const avisarCancelacionPaciente = agendaV2 ? (id: string): void => {
    const ev = calendarRef.current?.getApi().getEventById(id)
    const inicio = ev?.start?.toISOString() ?? null
    const zona: unknown = ev?.extendedProps.consultorio_timezone
    fetch(`/api/agenda/respuestas?cita=${encodeURIComponent(id)}`)
      .then(async (res) => (res.ok ? leerRespuesta(await res.json()) : null))
      .then((r) => {
        if (!r || !esRespuestaReciente(r.respuesta, r.respondidoEn, Date.now())) return
        setRecargaPanel((n) => n + 1)
        toast.info(textoAvisoCancelacion(inicio, typeof zona === 'string' ? zona : null))
      })
      .catch(() => undefined)
  } : undefined

  const { firmarEscritura, aplicarAppointmentAlEvento } = useTiempoRealAgenda({
    calendarRef, filtroEfectivo, refetch, ultimaTraidaRef, onCanceladaAjena: avisarCancelacionPaciente,
  })

  /* A2.5.7: no es un hook — ver la nota de cabecera de `guardadoCitas.ts`—, así
     que se vuelve a invocar en cada render, «fresca», igual que leer cualquier
     otra función de este componente. */
  /* F3: el objeto entero viaja también a las interacciones v2, que leen de él
     `cambiarEstadoCita` cuando Movimiento lo añada (ver `contratosV2.ts`). */
  const guardado = crearGuardadoCitas({
    calendarRef, horario, profile, toast, setConfirm, setCitaCreada, setInvitacion, closeModal,
    refetch, firmarEscritura, aplicarAppointmentAlEvento, agendaV2,
  })
  const { handleEventDrop, handleEventResize, handleSave, handleDelete, handleCancelar } = guardado

  const { handleDateClick, handleSelect, handleEventClick, abrirCita, abrirHueco } = crearAltaCitas({
    calendarRef, isMobile, setDiaSel, subState, openBloqueoModal, horario, setModal, setConfirm,
    resumenDia, citasIncompletas, agendaV2, interacciones: interaccionesRef, seleccionDesdeHueco,
  })

  /* Header de día apilado para Semana/Día. Mes conserva su header por defecto
     devolviendo `arg.text` sin tocar. El estado "inhábil" se deriva del MISMO
     objeto `horario` que alimenta businessHours (no se inventa lógica de
     horario): un día es hábil si horario[dia].activo === true.

     ⚠️ MEMOIZADO, y hasta el bloque 4 no lo estaba: era la única prop de
     FullCalendar de esta página declarada dentro del componente sin
     `useCallback`, o sea identidad nueva en cada render. Deps `[horario]`, que es
     lo único que lee de fuera — igual que `renderEC` con las suyas.

     ⚠️ HOY YA NO PINTA BLANCO SOBRE UN BLOQUE DE MARCA. Su cabecera es clara como
     las otras seis y quien lo señala es el número dentro de su círculo, más el
     «· HOY» y la línea inferior de la columna, que pone la hoja. Aquí sólo queda
     la marca semántica: la clase y el rótulo. El porqué del cambio, y qué NO
     reponer, está en globals.css junto a `.fc-col-header-cell.fc-day-today`. */
  const renderDayHeader = useCallback((arg: DayHeaderContentArg) => {
    if (arg.view.type === 'dayGridMonth') return arg.text
    /* ⚠️ LAS VISTAS DE LISTA TAMBIÉN PASAN POR AQUÍ, Y HASTA EL BLOQUE 6 ESO ERA
       UN FALLO ESPERANDO. No es una suposición: `ListViewHeaderRow` monta su
       `<tr>` con `generatorName: 'dayHeaderContent', customGenerator:
       options.dayHeaderContent` (`@fullcalendar/list/internal.js:29`), o sea que
       esta misma función compone la cabecera de día de una lista. Sin esta rama
       devolvía la de la rejilla —abreviatura de tres letras, cifra de 18 px y
       «· HOY»— dentro de un `<th>` de lista, y ADEMÁS sin estilos, porque todo
       lo de `.ag-dayhead` cuelga de `.fc-timegrid` en globals.css.

       ⚠️ EL ORDEN DE LAS DOS PRIMERAS LÍNEAS ES LO QUE HACE QUE ESTO FUNCIONE, y
       es el mismo de `renderEventContent`: Mes NO es vista de rejilla, así que
       puesto detrás caería por esta rama y estrenaría la cabecera de lista en el
       mes. Devolviendo Mes primero, llegar aquí sólo puede ser una lista.

       ⚠️ Y CONTRADICE LO QUE AFIRMAN EL SPEC Y EL MOCKUP: los dos dicen que las
       cabeceras de lista «no tienen hook de contenido, sólo `listDayFormat` y
       `listDaySideFormat`» (`SPEC_AGENDA.md` §12 y el comentario de `.dayhead`
       en `docs/spec/export-movil/agenda-movil-dia.html`). Es falso, y de ahí
       deducían que la marca de «hoy» no era alcanzable. Sí lo es: sale de
       `arg.isToday`, que el plugin mete en los renderProps vía `getDateMeta`
       (`list/internal.js:15` y `:22`). */
    if (!esVistaDeRejilla(arg.view.type)) {
      return (
        <CabeceraDiaLista
          date={arg.date}
          esHoy={arg.isToday}
          /* El año sólo en la lista de UN día: ahí esta cabecera es la única
             fecha completa de la pantalla. En la de una semana son siete
             cabeceras y el año ya lo dice la barra de arriba una vez. */
          conAnio={arg.view.type === 'listDay'}
        />
      )
    }

    const diaInfo = DIAS.find(d => d.fc === arg.date.getDay())
    const habil   = diaInfo ? (horario[diaInfo.key]?.activo ?? false) : false
    const abbr    = diaInfo ? diaInfo.label.slice(0, 3).toUpperCase() : arg.text

    // Dos estados, no tres: inhábil (atenuado) y hábil normal.
    const dowColor = habil ? 'var(--ag-muted)' : 'var(--ag-faint)'
    const numColor = habil ? 'var(--ag-text)'  : 'var(--ag-muted2)'

    return (
      <span className="ag-dayhead">
        <span className="ag-dayhead-dow" style={{ color: dowColor }}>
          {abbr}
          {/* El separador va DENTRO del span, no como texto suelto entre los
              dos, para que el color de marca alcance también al punto medio. */}
          {arg.isToday && <span className="ag-dayhead-hoy">{' · HOY'}</span>}
        </span>
        {/* Sin `color` en línea cuando es hoy: el blanco de la cifra sale de la
            regla del círculo, que es la que sabe de qué color es el disco. */}
        <span
          className={arg.isToday ? 'ag-dayhead-num ag-dayhead-num--hoy' : 'ag-dayhead-num'}
          style={arg.isToday ? undefined : { color: numColor }}
        >
          {arg.date.getDate()}
        </span>
      </span>
    )
  }, [horario])

  /* Fuera del JSX porque el subtítulo lo consulta DOS veces: para decidir si la
     frase descriptiva se esconde y para pintar la frase misma. */
  /* ⚠️ UNA SOLA CONDICIÓN PARA LAS TRES COSAS QUE DEPENDEN DE ELLA: la clase de
     la tarjeta, el panel del día y el apagado de `selectable`. Estaba escrita a
     mano en dos sitios y el tercero la habría hecho tres. Si divergen, se puede
     acabar con el panel pintado y la selección de rango encendida, que es la
     combinación que se lleva por delante el toque en una celda. */
  const esMesMovil = isMobile && currentView === 'dayGridMonth'

  /* ── EL PANEL LATERAL DE LA VISTA DÍA (bloque 8) ───────────────────────
     ⚠️ POR EL TIPO DE VISTA Y POR `isMobile`, NUNCA POR UN MEDIA QUERY. El
     montaje lo decide la vista que reporta FullCalendar (§8.2), e `isMobile`
     cuelga de `ANCHO_MOVIL`, que ya es el umbral de 1024 del spec: entre 768 y
     1024 va el layout de escritorio SIN panel, y eso es exactamente lo que esta
     condición deja fuera. Por debajo del umbral el panel NO SE RENDERIZA — no
     es que se esconda con CSS. */
  const panelDelDia = !isMobile && currentView === 'timeGridDay'

  /* En Mes no se puede estar en «Todos»: la opción se apaga en los DOS
     desplegables. `!isSingleDoctor` por lo mismo que en `forzarMedicoParaElMes`
     —donde no hay desplegable no hay nada que apagar—, y así las dos mitades de
     la regla salen de la misma condición y no pueden separarse. */
  const mesSinTodos = currentView === 'dayGridMonth' && !isSingleDoctor

  /* Con un médico se puede hablar de horas y de huecos; con «Todos los
     médicos» no. Cubre los dos caminos por los que hay uno solo: la clínica que
     sólo tiene uno —donde el desplegable ni se pinta— y el filtro puesto. El
     porqué está en la nota de `PanelDia`. */
  /* ⚠️ EL `!= null` NO SOBRA: `filtroEfectivo` es `null` mientras se carga el
     perfil, y `null !== ''` es TRUE. Sin él, el panel prometería horas y huecos
     de un médico que todavía no se sabe cuál es, y encima sobre una agenda que
     no se ha traído.
     Lo que se ve en esa rendija lo decide `isSingleDoctor`, exactamente igual
     que antes de este cambio: `medicos` llega vacío, así que vale `true`. Para
     el MÉDICO el parpadeo que había desaparece —la semilla llega con el perfil,
     casi siempre antes que `medicos`, y a partir de ahí `unMedico` ya no se
     mueve—; para la secretaria se comporta como siempre. */
  const unMedico = isSingleDoctor || (filtroEfectivo !== null && filtroEfectivo !== '')

  /* «Resumen · Dra. X» sólo cuando hay filtro: en una clínica de un solo médico
     el nombre no distingue nada de nada y ocuparía la línea del título. */
  const medicoFiltrado = filtroEfectivo ? medicos.find(m => m.id === filtroEfectivo) : undefined
  const tituloResumen = medicoFiltrado
    ? `Resumen · ${componerNombreMedicoCompleto(medicoFiltrado)}`
    : 'Resumen del día'

  /* ⚠️ EL SUBTÍTULO CUENTA LO QUE HAY EN PANTALLA, así que cuando la traída vino
     recortada su número deja de ser el de la agenda y pasa a ser un SUELO: hay
     esas y hay más. «al menos» es lo único que cabe decir con verdad — el total
     exacto de la VENTANA VISIBLE no lo sabe nadie: el servidor sólo pudo contar
     las del rango que se le pidió, que `rangoQuePedir` ensancha a semanas
     completas, y encima el conteo de aquí descuenta los días plegados.

     Va aquí y no dentro de `frasearConteo`: aquellas dos funciones son puras y
     cuentan CATEGORÍAS; quién sabe si el conjunto está entero es esta pantalla.

     ⚠️ EL PREFIJO CUBRE LA FRASE ENTERA, INCLUIDO «· 3 de Google», y ese número
     sí es exacto (su ruta ya no puede truncarse en silencio desde el punto 1).
     Es una imprecisión a sabiendas, y en la dirección buena: partir la frase en
     dos mitades con distinto grado de certeza —«al menos 1000 citas · 3 de
     Google, éstas sí exactas»— no cabe en un subtítulo de una línea y nadie la
     leería. Sobra cautela, no falta.

     Sin frase no hay prefijo: «al menos» a secas no dice nada. */
  const frasePlana = frasearConteo(conteo)
  const resumenConteo = frasePlana && citasIncompletas ? `al menos ${frasePlana}` : frasePlana
  /* La banda del teléfono lleva la forma abreviada; el header de escritorio, la
     larga. Ver `frasearConteoBreve`. */
  /* ⚠️ «≥» Y NO «al menos», y es la misma decisión que ya justifica que exista
     `frasearConteoBreve`: en 390 px el subtítulo comparte fila con el
     hamburguesa y el título, y ocho caracteres más parten la última palabra.
     Un carácter dice lo mismo. La banda roja de debajo lo explica con palabras
     para quien no lea el símbolo, y sale también en móvil. */
  const fraseBreve = frasearConteoBreve(conteo)
  const resumenConteoBreve = fraseBreve && citasIncompletas ? `≥ ${fraseBreve}` : fraseBreve

  /* ── BLOQUE 9 · LAS TRES CONDICIONES DE LAS BANDAS ────────────────────────
     Se resuelven aquí y no en el JSX porque cada una es una frase con motivo, y
     una condición con motivo dentro de un `&&` deja de leerse.

     `googleFallo` — sólo `error_google`. El porqué de que `sin_token` no cuente
     está entero en `gcalSource`, donde se escribe el estado. */
  const googleFallo = estadoGoogle === 'error_google'

  /* `vacioReal` — el cero de `conteo` es un cero de verdad. TRES condiciones y
     ninguna sobra:
       · `huboTraida`  — si no ha terminado ninguna traída, el cero es que aún no
                         ha llegado nada. Sin esto la banda saldría en cada
                         primera carga, que es la mentira que este bloque mata.
       · `!errorCitas` — con la carga rota no se sabe cuántas citas hay. Decir
                         «sin citas» sobre un error es la misma mentira otra vez,
                         y encima con la banda roja al lado contradiciéndola.
       · `!googleFallo`— con Google caído faltan eventos que sí existen. El cero
                         de la agenda propia puede ser cierto, pero la frase
                         «Sin citas esta semana» no lo sería.
       · `!googlePendiente` — lo mismo que `huboTraida`, pero para Google: desde
                         A1.3 su fuente contesta provisional al instante y ya no
                         retiene el `loading`, así que `huboTraida` llega antes
                         que sus eventos. Sin esto la banda salía y se iba al
                         llegar Google; con esto sale cuando salía antes.
       · `!citasIncompletas` — el mismo principio que las dos de arriba: sobre un
                         conjunto que se sabe incompleto no se afirma un cero.
                         HONESTAMENTE, hoy cuesta alcanzarla: un mes truncado
                         llega con mil tarjetas puestas, así que el conteo
                         visible no es cero, y navegar a una semana suelta vuelve
                         a pedir un rango que no trunca y apaga la bandera. Se
                         queda porque la condición que la haría alcanzable —una
                         reja de conteo más estrecha que el rango pedido, como ya
                         lo son los días plegados— es un cambio de una línea en
                         otro sitio, y entonces nadie se acordaría de venir aquí.
     `periodoVacio` vacío apaga la banda en Día y en las dos listas; ver
     `periodoDeLaVista`. */
  const vacioReal =
    huboTraida && !errorCitas && !googleFallo && !googlePendiente && !citasIncompletas &&
    conteo.citas === 0 && conteo.eventos === 0 && conteo.google === 0 &&
    periodoVacio !== ''

  /* Con filtro puesto, un vacío no dice «no hay nada»: dice «no hay nada DE
     ESTE MÉDICO», y la salida no es agendar sino quitar el filtro. Es el sexto
     estado vacío de §11 y el mismo cero que el de arriba, contado distinto. */
  const vacioFiltrado = vacioReal && medicoFiltrado !== undefined

  /* ── A1-bis.2 · LOS MANEJADORES DE `<FullCalendar>`, CON IDENTIDAD ESTABLE ──
     Antes iban en línea o como funciones del render: identidad nueva en cada
     render del padre, y `@fullcalendar/react` hacía que FullCalendar re-refinara
     las nueve opciones y repintara el calendario entero, también cuando lo único
     que cambiaba era el modal o el conteo.

     Ahora FullCalendar recibe nueve envoltorios con deps `[]` que llaman a la
     versión del ÚLTIMO render a través de `manejadoresFcRef`, escrito en el
     render —mismo patrón que `appointmentSourceRef` y `aplicarCambioRef`—.

     ⚠️ ASÍ SIGUEN LEYENDO ESTADO FRESCO, y es lo que hay que conservar: varios
     cierran sobre estado del render (`programarPrecarga` lee `profile`,
     `filtroEfectivo` y `citasIncompletas`; `revertirMedicoForzado`, el filtro;
     los `handle*`, `horario`, `subState`, `isMobile`…). Nunca guardes uno de
     éstos en un `useCallback` con deps: el ref es lo que los mantiene al día.

     Los cuerpos de los cuatro que iban en línea están tal cual, sólo con nombre;
     sus notas siguen junto a cada prop en el JSX. */
  /* F2.3: lo último que se pintó, para saber si este `datesSet` es un cambio de
     FECHA (fundido) o el primero / un cambio de vista (lo hace `ag-vista`). */
  const vistaPreviaRef = useRef<MarcaDeVista | null>(null)

  function alCambiarFechas(arg: DatesSetArg) {
    /* F2.3 · el fundido de navegación: el armazón de .7 a 1 en micro, SIN
       traslación (CONTRASTE §2.3). Va primero porque `datesSet` llega con el
       rango nuevo ya pintado. Ver `fundirNavegacion`. */
    const marca = { tipo: arg.view.type, inicio: arg.view.currentStart.getTime() }
    if (esCambioDeFecha(vistaPreviaRef.current, marca)) {
      const api = calendarRef.current?.getApi()
      fundirNavegacion(api instanceof CalendarioFC ? api.el.querySelector('.fc-view-harness') : null)
    }
    vistaPreviaRef.current = marca
    setCurrentView(arg.view.type)
    setTituloVista(arg.view.title)
    const ahora = Date.now()
    const conHoy = arg.view.currentStart.getTime() <= ahora && ahora < arg.view.currentEnd.getTime()
    setHoyEnRango(conHoy)
    listaHoyPendienteRef.current = arg.view.type === 'listWeek' && conHoy && (!listaHoyVistaRef.current || irAHoyRef.current)
    if (listaHoyPendienteRef.current) listaHoyVistaRef.current = true
    irAHoyRef.current = false
    intentarListaHoy()
    /* F3: siempre, aunque sólo lo lea el minicalendario v2: el interruptor se
       resuelve DESPUÉS del primer `datesSet`. Una cadena más no repinta nada. */
    setRangoVisible(`${partirFechaHora(arg.view.currentStart.toISOString()).fecha}/${partirFechaHora(arg.view.currentEnd.toISOString()).fecha}`)
    setPeriodoVacio(periodoDeLaVista(arg.view))
    const eventos = calendarRef.current?.getApi().getEvents() ?? []
    const rangos = rangosDeLaVista(arg.view)
    aplicarVentana(eventos, rangos)
    aplicarConteo(eventos, rangos)
    /* El panel del mes va DETRÁS de los otros dos y de la misma llamada,
       por lo mismo: los eventos ya están resueltos aquí. Primero se
       sincroniza el día —que sólo escribe si el mes cambió— y luego se
       recalculan las filas del que ya estaba; si el día acaba de cambiar,
       quien recalcula es su propio efecto, un render después. */
    sincronizarDiaDelPanel(arg.view)
    aplicarPanel(eventos)
    /* El resumen del bloque 8 va el último y de la misma llamada, por
       lo mismo que los tres de arriba: los eventos y los rangos ya
       están resueltos aquí. La VISTA sale del `arg` y NUNCA de
       `currentView`: el `setCurrentView` de la primera línea de este
       handler todavía no ha llegado al render. */
    aplicarResumen(eventos, rangos, arg.view.type)
    // A1.5b: última llamada, por lo mismo que las de arriba — sólo
    // que ésta no pinta nada, programa la precarga en ocioso.
    programarPrecarga(arg.view)
  }

  /* F2.4: los ids del `eventsSet` anterior. SÓLO PODAN las marcas de
     entrada y hacen de candado (ver `podarMarcas`): quién entra animado lo
     decide el registro explícito, nunca esta diferencia. */
  const idsPreviosRef = useRef<ReadonlySet<string>>(new Set())

  function alCambiarEventos(eventos: EventApi[]) {
    const ids = new Set(eventos.map(e => e.id))
    podarMarcas(ids, idsPreviosRef.current)
    idsPreviosRef.current = ids
    const rangos = rangoDeVista()
    aplicarVentana(eventos, rangos)
    aplicarConteo(eventos, rangos)
    aplicarPanel(eventos)
    aplicarResumen(eventos, rangos, calendarRef.current?.getApi().view.type ?? '')
    // A1.5b: `eventsSet` cubre lo que `datesSet` no — ver su nota
    // larga, junto al `<FullCalendar>`—, y la vista sale de la API
    // porque aquí no llega `arg.view`.
    const vista = calendarRef.current?.getApi().view
    if (vista) programarPrecarga(vista)
    intentarListaHoy()
  }

  /* F3: el minicalendario va a un día CONSERVANDO la vista (no es `changeView`). */
  function irAFecha(fecha: string) {
    calendarRef.current?.getApi().gotoDate(fecha)
  }

  function alPulsarNumeroDeDia(fecha: Date) {
    revertirMedicoForzado()
    calendarRef.current?.getApi().changeView('timeGridDay', fecha)
  }

  function alCambiarCarga(estaCargando: boolean) {
    setCargando(estaCargando)
    if (!estaCargando) setHuboTraida(true)
  }

  const manejadoresFcRef = useRef({
    alCambiarFechas, alCambiarEventos, alPulsarNumeroDeDia, alCambiarCarga,
    handleDateClick, handleSelect, handleEventClick, handleEventDrop, handleEventResize,
  })
  manejadoresFcRef.current = {
    alCambiarFechas, alCambiarEventos, alPulsarNumeroDeDia, alCambiarCarga,
    handleDateClick, handleSelect, handleEventClick, handleEventDrop, handleEventResize,
  }
  const datesSetFc = useCallback((arg: DatesSetArg) => manejadoresFcRef.current.alCambiarFechas(arg), [])
  const eventsSetFc = useCallback((eventos: EventApi[]) => manejadoresFcRef.current.alCambiarEventos(eventos), [])
  const navLinkDayClickFc = useCallback((fecha: Date) => manejadoresFcRef.current.alPulsarNumeroDeDia(fecha), [])
  const loadingFc = useCallback((estaCargando: boolean) => manejadoresFcRef.current.alCambiarCarga(estaCargando), [])
  const dateClickFc = useCallback((arg: DateClickArg) => manejadoresFcRef.current.handleDateClick(arg), [])
  const selectFc = useCallback((arg: DateSelectArg) => manejadoresFcRef.current.handleSelect(arg), [])
  const eventClickFc = useCallback((arg: EventClickArg) => manejadoresFcRef.current.handleEventClick(arg), [])
  const eventDropFc = useCallback((arg: EventDropArg) => { void manejadoresFcRef.current.handleEventDrop(arg) }, [])
  const eventResizeFc = useCallback((arg: EventResizeDoneArg) => { void manejadoresFcRef.current.handleEventResize(arg) }, [])

  /* `businessHours` era `horarioToBusinessHours(horario)` en el JSX: un array
     nuevo en cada render. Sólo cambia cuando cambia el horario. */
  const horasHabilesFc = useMemo(() => horarioToBusinessHours(horario), [horario])

  return (
    /* ⚠️⚠️ LA ALTURA DE ESTE `<div>` ES LO QUE PARTE LA PÁGINA EN DOS ZONAS: la
       de arriba fija (título, controles, barra de navegación y cabecera de
       días) y la rejilla de horas, que es la única que scrollea. Sin altura
       definida aquí, `.agenda-fc` no puede ser `flex-1`, el calendario vuelve a
       crecer con su contenido y quien scrollea es `<main>` otra vez.
       Las dos zonas NO se construyen a mano: son el modo nativo de
       FullCalendar. `.fc` ya es `flex-direction: column` y `.fc-view-harness`
       ya es `flex-grow: 1`, así que con altura acotada el toolbar queda arriba
       y la rejilla se lleva el resto. Y la cabecera de días NO necesita
       `sticky`: es una sección del scrollgrid, hermana y anterior a la del
       cuerpo, y sólo el cuerpo monta `Scroller`.

       ⚠️ `dvh` Y NO `h-full`, Y NO ES INTERCAMBIABLE. `h-full` es `height:100%`,
       que exige altura DEFINIDA en el padre; el nodo de arriba
       (`(app)/layout.tsx:60`) es `min-h-full`, y un `min-height` no establece
       altura definida para el porcentaje de un hijo. Con `h-full` esto
       resolvería a `auto` y no acotaría nada. Arreglarlo por ahí obligaría a
       tocar el layout de TODA la app, que está fuera de este alcance.

       ⚠️⚠️ LOS DOS NÚMEROS SON EL PADDING VERTICAL DEL NODO PADRE, REPLICADO A
       MANO, Y ES EL PRECIO DE NO TOCAR EL LAYOUT COMPARTIDO. Salen de
       `(app)/layout.tsx:60`, que hoy es `pt-16 px-4 pb-6 lg:pt-8 lg:px-8
       lg:pb-8`:
         · por debajo de `lg`: pt-16 (64px) + pb-6 (24px) = 88px
         · de `lg` en adelante: pt-8 (32px) + pb-8 (32px) = 64px
       SI ALGUIEN CAMBIA ESE PADDING, ESTO SE DESAJUSTA EN SILENCIO: no rompe
       nada visible de golpe, sólo deja la rejilla unos píxeles más alta o más
       baja que el hueco, y reaparece el scroll de `<main>` bajo la zona fija.
       Hay una nota recíproca en `(app)/layout.tsx` junto al padding. Si cambias
       uno, cambia el otro.

       ⚠️⚠️ PERO DE `lg` EN ADELANTE ESTOS 64 YA NO SON LO QUE MANDA, Y LA CLASE
       `agenda-raiz` DE AQUÍ ARRIBA ES POR QUÉ. En `globals.css`, junto a
       `.agenda-fc`, hay una regla `main > div:has(.agenda-fc)` que recorta el
       padding del layout A 16 px SÓLO en esta página y, EN LA MISMA REGLA, le
       da a `.agenda-raiz` el `calc(100dvh - 16px)` que le corresponde. Los dos
       números viven ahí en líneas contiguas y ya no pueden divergir.
       LO QUE SIGUE VIVO DE ESTE `lg:h-[calc(100dvh-64px)]`: es el RESPALDO. Si
       `:has()` no está soportado (Firefox < 121), aquella regla no casa, el
       padding se queda en 64 y este calc de 64 vuelve a ser el correcto. Por eso
       el número de aquí NO se cambia a 16: emparejado con el padding que habría
       en ese caso, es exacto. Cambiarlo rompería precisamente el respaldo.

       ⚠️ Y POR ESO RESTAN TAMBIÉN LOS DOS `env()` (bloque 6 · paso 10). Aquel
       padding pasó a llevar el área segura sumada, así que el respaldo tiene que
       restar lo mismo o volvería a divergir en el único caso para el que existe.
       Los 88 y los 64 no se tocan: el área segura se AÑADE a la resta, igual que
       se añadió allí a la suma. En escritorio y en una pestaña normal los dos
       `env()` valen 0 y esto es el calc de siempre.
       ⚠️ ESTO NO ES LO QUE SE VE EN UN TELÉFONO CON `:has()`: allí manda la regla
       de `globals.css`, que pone la página a `padding: 0` y esta raíz a `100dvh`
       ENTERO —sin restar nada—, que es lo que deja a la banda meterse bajo el
       reloj y a la barra de «Agendar» bajo la de gestos. Si te preguntas por qué
       aquí no hay duplicación: porque en esa rama este calc no se aplica. */
    <div ref={raizRef} data-densidad={densidadCompacta ? 'compacta' : 'normal'} data-agenda-v2={interruptorLeido === null ? 'pendiente' : agendaV2 ? 'encendida' : 'apagada'}
      data-interacciones-v2={interaccionesListas ? 'listas' : undefined} className="agenda-raiz flex flex-col h-[calc(100dvh-88px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-64px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]">

      {isMobile && (
        <BandaMovil
          conteo={resumenConteoBreve}
          vistaActual={currentView}
          onVista={tipo => cambiarVista(tipo)}
          titulo={tituloVista}
          onPrev={() => calendarRef.current?.getApi().prev()}
          onNext={() => calendarRef.current?.getApi().next()}
          onHoy={() => { irAHoyRef.current = true; calendarRef.current?.getApi().today() }}
          tableta={esTableta}
          hoyDeshabilitado={hoyEnRango}
          onMenu={abrirMenu}
          medicos={medicos}
          filtroMedico={filtroEfectivo ?? ''}
          mesSinTodos={mesSinTodos}
          /* Misma puerta que el desplegable de escritorio: elección a mano, así
             que sin marca de forzado. Ver `aplicarFiltro`. */
          onFiltroMedico={id => aplicarFiltro(id, false)}
          /* `null` y no un booleano: es el manejador o no hay botón. Misma
             condición que el de escritorio (`verEngrane`). */
          onHorario={verEngrane ? abrirConfiguracion : null}
          engraneConfiguracion={agendaV2}
          /* Misma forma y misma pregunta que el de escritorio: en móvil las dos
             vistas que `vistaAdmiteCompactar` acepta se reducen a Mes, porque
             Semana y Día son listas aquí. */
          onCompactar={vistaAdmiteCompactar(currentView) ? () => setCompactar(v => !v) : null}
          compactado={compactar}
          /* F3 · Sólo la lupa (sin minicalendario, decisión 21; sin el botón de
             la ayuda, que no cabe con el filtro a 360 px). */
          buscar={agendaV2 && montarV2 ? <BuscarV2 apiRef={interaccionesRef} atajos={atajos} enBanda /> : undefined}
          atajos={atajos}
        />
      )}

      {citaCreada && <div data-onboard="cita-creada" className="hidden" />}

      {/* ── Calendario ──────────────────────────────────── */}
      {/* ⚠️ `overflow-clip` Y NO `overflow-hidden`. Recorta igual —es lo que
          mantiene las esquinas del `rounded-2xl` sobre el `<table>` cuadrado del
          calendario, y para eso está— pero SIN crear un contenedor de scroll.
          `overflow: visible` arreglaría el scroll y dejaría asomar las cuatro
          esquinas, así que no vale.

          ⚠️ POR QUÉ IMPORTA QUE NO CREE SCROLLPORT, hoy: con la altura acotada
          quien scrollea es el `Scroller` que FullCalendar monta DENTRO de la
          sección del cuerpo del scrollgrid. Un `overflow: hidden` aquí añadiría
          un segundo contenedor de scroll por encima de ése, entre la tarjeta y
          `<main>`, y la rejilla podría quedar recortada sin poder alcanzarse.

          ⚠️ ESTE COMENTARIO DECÍA OTRA COSA HASTA EL BLOQUE 3C, Y LA VERSIÓN
          VIEJA YA NO ES CIERTA. Explicaba que `clip` era lo que desbloqueaba la
          cabecera de días PEGAJOSA (`stickyHeaderDates` + `position: sticky`).
          Eso valía con `height="auto"`: la opción se resuelve a `true`
          precisamente cuando el calendario NO tiene scroller propio
          (`core/internal-common.js:6913-6918`). Ahora el calendario va con
          `height="100%"`, así que `stickyHeaderDates` queda APAGADA y no hay
          ningún sticky que salvar: la cabecera se queda arriba porque es una
          sección hermana y anterior a la del cuerpo, y sólo el cuerpo scrollea.
          No repongas aquel razonamiento ni lo cites: la cabecera ya no depende
          de esto. Lo único que sigue dependiendo de `clip` son las esquinas.

          ⚠️ SOPORTE: `overflow: clip` pide Chrome 90+, Firefox 81+, Safari 16+.
          Por debajo degrada a `visible` — esquinas asomando — nunca a roto.

          ⚠️ DEUDA CONOCIDA, NO SE ARREGLA AQUÍ: `SuscripcionBanner`
          (`(app)/layout.tsx:56`) es `sticky top-0` y se monta FUERA del
          `div.h-screen`. Con la suscripción BLOQUEADA ocupa su alto en flujo y
          empuja todo hacia abajo, pero el `100dvh` de la raíz de esta página no
          lo descuenta: la zona fija —título, controles y cabecera de días— se
          va parcialmente fuera del viewport y hay que scrollear `<main>` para
          alcanzarla, con lo que deja de estar fija. Esta vía lo deja PEOR que
          antes, cuando el calendario simplemente crecía. El arreglo vive en
          `(app)/layout.tsx` (meter el banner dentro del `div.h-screen`, o
          descontar su alto), que es de toda la app y va en otra ventana. */}
      {/* ⚠️ EL `min-height` EXPLÍCITO NO ES DECORATIVO Y NO SE QUITA. Un ítem de
          flex trae `min-height: auto`, que le impide encoger por debajo de su
          contenido; sin un valor explícito, `flex-1` no acota nada, la tarjeta
          crece hasta lo que mida la rejilla y el calendario desborda su zona.
          Aquí estuvo `min-h-0` haciendo ese trabajo. Ya no hace falta: CUALQUIER
          valor explícito desactiva el `auto`, así que el `min-h-[250px]` de
          abajo cumple las dos funciones a la vez. No los pongas juntos — serían
          dos `min-height` compitiendo, y quién gana dependería del orden en que
          Tailwind los emita.
          Y el `minHeight: '70vh'` que había aquí en línea SE RETIRÓ a propósito:
          con `flex-1` actuaba de suelo, así que en una ventana baja el
          calendario volvía a desbordar `<main>` y reaparecía el segundo scroll.
          No lo repongas «para que no quede pequeño en pantallas grandes»: en
          pantallas grandes `flex-1` ya le da todo el hueco sobrante.

          ⚠️ Y EL PISO VA EN PÍXELES — `min-h-[250px]`, en la clase de abajo.
          Con `min-h-0` la tarjeta encogía hasta CERO y aparecía un caso
          degradado real: a zoom extremo (~270 px de viewport CSS) la zona
          fija se come casi todo, `flex-1` deja la rejilla en una decena de
          píxeles, los hermanos ya no pueden encoger más y el sobrante se va al
          área scrollable de `<main>` — o sea, vuelven los dos scrollers, que es
          lo que todo esto vino a quitar.
          EN PÍXELES Y NO EN `vh`: el `minHeight: '70vh'` de antes fallaba
          justamente por ser relativo — crecía con la ventana y volvía a
          desbordar. Un suelo fijo no puede perseguir al contenedor.
          DE DÓNDE SALE EL 250. El criterio con el que se eligió —el mismo desde
          el 280, el 295 y el 220— es cromo constante más CINCO FRANJAS de cuerpo
          —dos horas y media de rejilla, apretado pero utilizable, con scroll
          interno para el resto del día—. El cromo se midió el 2026-08-25 en la
          rejilla real a 1280 × 617 con la barra lateral puesta:

            · fila del toolbar 60,32 px  MEDIDO, ya sin envolver — ver abajo.
            · banda de vista compacta 33 px, SÓLO con «Compactar» encendido
            · cabecera de días 35 px, y ya sin vaivén — ver abajo.

          Cromo del peor caso (con banda, con hoy): 60,32 + 33 + 35 = 128,32.

          ⚠️ Y EL 250 SE QUEDÓ CORTO RESPECTO A SU PROPIO CRITERIO — LÉELO ANTES
          DE APOYARTE EN ÉL. Se fijó con el tramo bajo de `--ag-slot-h` en 24:
          cinco franjas eran 120 y el total 248,32 → 250. Ese tramo subió a 36
          (ver la nota junto a `.fc .fc-timegrid-slot`), así que cinco franjas
          son hoy 180 y el mismo criterio pediría 128,32 + 180 = 308,32 → 310.
          Con 250, al cuerpo le quedan 121,68 px = 3,38 FRANJAS: hora y media
          larga de rejilla, no dos y media.
          SE DEJA EN 250 A PROPÓSITO, no por descuido. Subirlo a 310 adelanta el
          punto en el que el piso muerde de ~344 a ~404 px de viewport (ver
          «CUÁNDO ENTRA EN JUEGO», abajo), o sea que devuelve el segundo scroller
          a una banda de 60 px de alturas de ventana donde hoy no está — y ese
          segundo scroller es exactamente lo que todo este bloque vino a quitar.
          A cambio, en el caso degradado se ven 3,38 franjas en vez de 5. Si
          alguien decide que no bastan, el número al que hay que ir es 310 y el
          coste es ése; no lo subas a ojo.

          ⚠️ POR QUÉ BAJÓ DE 295 A 250, pieza a pieza, para que nadie lo lea como
          un número aflojado: la cabecera de día pasó de apilada a una línea
          (−30) y el toolbar dejó de envolver al acortarse la fecha (−13,68). El
          piso de franja NO participa en esa bajada: cuando se fijó el 250 valía
          24 —había pasado por 22 y se devolvió a 24— y las cinco franjas eran
          120. Que después subiera a 36 es lo que abrió el hueco de arriba, y es
          posterior a esta bajada. Los dos cambios están anotados donde viven.

          ⚠️ F1.1 · LA CUENTA BAJÓ OTRA VEZ CON LA BARRA ÚNICA: el encabezado de
          encima de la tarjeta (54 + 24 de margen) entra en la fila del toolbar
          (60) y la leyenda pasa al pie a 28. Peor caso hoy, con banda compacta:
          60 + 33 + 35 + 28 = 156, y la página gana los 78 px del encabezado.
          Lo de abajo es la historia de antes de F1.1.

          ⚠️ LA LEYENDA YA NO COMPARTE FILA CON EL TOOLBAR, Y ESTA CUENTA SUBIÓ
          45 EN EL BLOQUE 8. Compartiéndola no gastaba alto propio: cabía en la
          celda de al lado de la fecha —479 px en una línea con «GCal» contra los
          606,7 que le daba su celda— y durante un tiempo ni eso, que es lo que
          se arregló encogiendo la etiqueta de fecha (de «24 – 28 de agosto de
          2026» a 22 px, 282,77, a «24 – 28 ago 2026» a 15 px, 129,53).
          Ese equilibrio se rompió con el panel lateral de la vista Día: la
          tarjeta pierde el ancho del riel y la leyenda vuelve a apilarse en dos o
          tres renglones. Ahora va en FILA PROPIA, como en móvil, y cuesta sus
          ~45 px en las tres vistas de escritorio.
          ⚠️ LO QUE ESTO LE HACE AL PEOR CASO: 60 (toolbar) + 45 (leyenda) + 33
          (banda compacta) + 35 (cabecera) = 173, así que de los 250 quedan 77 =
          2,14 franjas a 36 px, contra las 3,38 de antes. SIGUE SIENDO EL CASO
          DEGRADADO —sólo muerde por debajo de ~344 px de viewport, ver abajo— y
          por eso el 250 no se toca; pero si alguien vuelve a añadir cromo fijo a
          la tarjeta, ésta es la cuenta que hay que rehacer.
          ⚠️ LA FECHA CORTA SE QUEDA IGUAL. Ya no la sostiene la leyenda —que no
          comparte fila con ella—, pero sí el alto del toolbar: los dos números
          viven en `globals.css` (`.agenda-fc .fc-toolbar-title`) y en
          `VISTAS_FC`, y los dos llevan nota.

          ⚠️ Y LA CABECERA YA NO VAIVENEA. Apilada medía 65 px con hoy a la vista
          y 54 sin él —el disco de 28×28 mandaba sobre la fila—, así que la
          rejilla cambiaba de alto al navegar a una semana sin hoy (medido: 299 →
          310). En una línea no hay disco, las siete columnas miden 35 y el salto
          desapareció. Ya no hay «peor caso» de cabecera que cubrir.

          ⚠️ EL 280 ANTERIOR NO SUBIÓ POR EL TÍTULO, y la cuenta de entonces ya no
          aplica porque el título volvió a 15 px. Se deja dicho lo que sigue
          siendo cierto: la fila la manda el BOTÓN, con 30 px, no el título —a 15
          × 1.2 son 18—. Su `line-height: 1.2` explícito es lo que sostiene esa
          cuenta y está anotado también en globals.css.

          EN MÓVIL EL CROMO ES MENOR: por debajo de 1024 la leyenda va en fila
          propia (45) —igual que ahora en escritorio— y «Compactar» se apaga solo,
          así que no hay banda: 60 + 45 + 35 = 140, y 250 deja 110 px = 3,06
          franjas. ⚠️ ESA COMPARACIÓN CON ESCRITORIO SE DIO LA VUELTA EN EL BLOQUE
          8. Decía que el móvil quedaba «algo por debajo de las 3,38 del peor caso
          de escritorio porque la fila propia de la leyenda cuesta más que la
          banda que se ahorra»; hoy escritorio TAMBIÉN paga esa fila y encima
          conserva la banda, así que el peor caso de escritorio son 2,14 franjas y
          el móvil va por encima.
          LO QUE NO CUBRE, dicho para que no sorprenda: a
          anchos muy pequeños la leyenda envuelve a tres o cuatro filas y se come
          el margen. El piso es un amortiguador del caso degradado, no una
          garantía; ahí preferimos una rejilla usable con un segundo scroll a una
          rejilla de diez píxeles sin él.

          CUÁNDO ENTRA EN JUEGO: cuando `100dvh − 16 − (zona fija de página)`
          baja de 250. La zona fija son 78 px —54 del header en una línea más los
          24 del `mb-6`—, así que actúa por debajo de ~344 px de viewport. Con
          295 y el padding de 64 era ~437, y con 315 era ~455. Cada recorte de
          cromo empuja este umbral hacia abajo, que es justo lo que se quiere:
          el piso sólo debe morder en el caso degradado de verdad. */}
      {/* ⚠️ ESTA TARJETA NO LLEVA CLASE DE LAYOUT, Y NO ES UN OLVIDO. Tuvo un
          `flex flex-col` y se retiró: el reparto entero lo hace un
          `grid-template-areas` en `globals.css`, sobre `.agenda-fc`. Si repones
          el flex, el grid se apaga y la leyenda y la banda se van al final, por
          debajo de la rejilla, que es el orden en que están en el DOM.

          Tiene TRES hijos —la leyenda, la banda de vista compacta y el
          `<FullCalendar>`— y hay que colocar las dos primeras ENTRE el toolbar y
          la rejilla, en ese orden. Ninguna de las dos cosas se puede
          hacer desde React: el componente no acepta children, y el toolbar y la
          rejilla son hijos de `.fc`, no nuestros. Lo resuelve la hoja
          promocionando los hijos de `.fc` a ítems de esta rejilla con
          `display: contents` y colocando las cuatro piezas con `grid-area`.
          El razonamiento completo, qué se comprobó y qué NO se rompe está allí,
          junto a `.ag-banda-compacta`. Antes de tocar esta línea, léelo. */}
      {/* ⚠️ LA CLASE DE MÓVIL-MES NO ES COSMÉTICA: es lo que cambia el reparto
          vertical. Fuera de ella la tarjeta es `flex-1` y se lleva TODO el hueco
          sobrante, que es lo correcto cuando el calendario es lo único que hay
          debajo de la banda. En el mes del teléfono no lo es —debajo va el panel
          del día—, así que la cuadrícula pasa a medir lo suyo (seis semanas) y
          el sobrante se lo lleva el panel. El alto exacto y el porqué de que sea
          calculable están en `globals.css`, junto a `.ag-cal-mes-movil`. */}
      {/* ═══ EL REPARTO EN DOS COLUMNAS DE LA VISTA DÍA (bloque 8) ═════════
          ⚠️ ESTE ENVOLTORIO ESTÁ SIEMPRE EN EL DOM, Y ESO ES LO QUE PROTEGE AL
          CALENDARIO. Montarlo sólo en Día cambiaría el PADRE de `.agenda-fc` al
          entrar y al salir de la vista, y React no reconcilia eso: desmonta el
          subárbol entero y vuelve a montarlo, o sea que `<FullCalendar>` se
          reconstruye —pierde el scroll, rehace las fuentes— en cada cambio de
          vista. Con el nodo fijo, lo único que cambia es una clase.

          ⚠️ Y POR ESO LA CLASE BASE ES `display: contents`. Sin panel, el
          envoltorio DESAPARECE del layout y `.agenda-fc` sigue siendo hijo flex
          directo de `.agenda-raiz` con su `flex-1 min-h-[250px]` intacto: el
          reparto vertical de las otras cuatro vistas no se entera de que este
          nodo existe. Sólo `--con-panel` lo enciende como fila flex, y ahí el
          `flex-1 min-h-[250px]` pasa a vivir en el envoltorio. Los dos estados
          están en `globals.css`, en líneas contiguas.

          ⚠️ LA TARJETA CONSERVA SU SANGRÍA A PROPÓSITO. Re-indentarla serían
          ~320 líneas de diff que taparían el cambio de verdad, que son estas
          dos etiquetas. */}
      <div className={`ag-dia${panelDelDia ? ' ag-dia--con-panel' : ''}`}>
      {/* ⚠️ LAS DOS CLASES DE ESTADO DEL BLOQUE 9 SON DISTINTAS Y NO SE FUNDEN EN
          UNA. Las dos atenúan la rejilla al mismo .55 (CONTRASTE_Y_MOVIMIENTO §3:
          «.55 y no .5 — la rejilla atenuada tiene que seguir siendo legible: es
          contexto, no un velo»), pero sólo `ag-cargando` apaga los punteros.
          Por qué el error NO los apaga: la agenda se sigue pudiendo usar con la
          lectura rota —pulsar una hora y crear una cita escribe por otra ruta— y
          §11 pide justo eso, «una rejilla vacía sigue siendo una rejilla». Un
          error de carga que además deja el calendario muerto al tacto convierte
          un fallo de lectura en un fallo total.
          Mientras carga sí se apagan: lo que hay en pantalla es de otro rango y
          pulsarlo abriría el alta sobre datos que están a punto de irse.
          ⚠️ `cargaVisible` Y NO `cargando`: el umbral de 150 ms va en medio, ver
          `UMBRAL_CARGA_MS`. */}
      <div
        aria-busy={cargaVisible}
        className={`agenda-fc bg-white rounded-2xl border border-slate-100 shadow-sm overflow-clip flex-1 min-h-[250px]${
        esMesMovil ? ' ag-cal-mes-movil' : ''}${cargaVisible ? ' ag-cargando' : ''}${
        errorCitas ? ' ag-desactualizada' : ''}`}>
        {/* ── Controles de escritorio (F1.1: DENTRO de la tarjeta) ────────
            Por debajo de `ANCHO_MOVIL` los sustituye `BandaMovil`. Son un ítem
            más de la rejilla de `.agenda-fc` (`grid-area: controles`), en la
            fila de la barra nativa; el reparto, en globals.css. */}
        {!isMobile && (
          <CabeceraEscritorio
            resumenConteo={resumenConteo}
            currentView={currentView}
            isMobile={isMobile}
            onVista={tipo => cambiarVista(tipo)}
            compactar={compactar}
            onCompactar={() => setCompactar(v => !v)}
            densidadCompacta={densidadCompacta}
            onDensidad={() => guardarDensidad(!densidadCompacta)}
            isSingleDoctor={isSingleDoctor}
            filtroEfectivo={filtroEfectivo}
            mesSinTodos={mesSinTodos}
            medicos={medicos}
            onFiltroMedico={id => aplicarFiltro(id, false)}
            canEditHorario={verEngrane}
            onHorario={abrirConfiguracion}
            /* T3 · Con la v2 abre la configuración: sólo icono, «Configuración de la agenda». */
            engraneConfiguracion={agendaV2}
            /* ⚠️ NO FUNDIR con el `onAgendar` de `BarraAgendarMovil` ni con el
               de la banda vacía, aunque el cuerpo sea idéntico: el plan A2.5
               los deja como tres cierres separados a propósito (§invariantes,
               «los 3 onClick de Agendar — no fundir»). */
            onAgendar={() => {
              if (subState.isBlocked) { openBloqueoModal(); return }
              /* El botón sí aporta hora: la de ahora. Es una de las cuatro
                 rutas que NO cambian con la hora vacía de la vista Mes. */
              const { fecha, hora } = partirFechaHora(new Date().toISOString())
              setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no' })
            }}
            onIntencionAgendar={precargarModalesAgenda}
            /* E7: la lista de mañana por confirmar (WhatsApp manual). Sólo con
               la v2 encendida: apagada no se monta y no sale ninguna petición. */
            porConfirmar={agendaV2 ? <PanelPorConfirmar recarga={recargaPanel} /> : undefined}
            /* F3 · Las herramientas v2 en sus ranuras; apagado, ni se descargan. */
            selectorFecha={agendaV2 && montarV2 ? <SelectorFechaV2 rango={rangoVisible} alIrAFecha={irAFecha} /> : undefined}
            buscar={agendaV2 && montarV2 ? <BuscarV2 apiRef={interaccionesRef} atajos={atajos} /> : undefined}
            atajos={atajos}
          />
        )}
        {/* ── Leyenda ───────────────────────────────────────────────────
            ⚠️ F1.1 · DESDE EL BLOQUE F VA AL PIE de la tarjeta, en una fila de
            28 px (`grid-area: pie`, decisión 8): la fila de arriba la ocupa la
            barra única. Lo de abajo es su historia; el DOM no cambia de sitio
            (el lector de pantalla la sigue oyendo antes que la rejilla).
            ⚠️ VIVE DENTRO DE LA TARJETA Y EN FILA PROPIA, entre la fila de
            navegación y la cabecera del día. Quien la coloca es el
            `grid-template-areas` de `.agenda-fc` en globals.css, y allí está el
            porqué de esa vía y no de `customButtons`.

            ⚠️ COMPARTIÓ FILA CON EL TOOLBAR HASTA EL BLOQUE 8, que es donde la
            pone el mockup, y bajó por ANCHO: con el panel lateral de la vista Día
            la tarjeta pierde el ancho del riel y la leyenda se apilaba en dos o
            tres renglones a la derecha de la fecha. Antes de eso estuvo en una
            banda propia ENCIMA del calendario, y el argumento para dejarla fuera
            —que la fila de controles envuelve a ~1170 px— medía la fila
            EQUIVOCADA. La fila propia de hoy NO es aquella banda: va dentro de la
            tarjeta y dentro del grid, cosida al toolbar.
            ⚠️ EL MOCKUP DEL BLOQUE 8 LA ELIMINA ENTERA. No se le hace caso: es lo
            único que dice qué significa cada color.

            ⚠️ SE PINTA SIEMPRE, también en multi-doctor. Llevaba un
            `isSingleDoctor` heredado de cuando existía OTRA leyenda —puntos por
            médico— que ocupaba este sitio en ese modo; aquélla se eliminó y la
            condición se quedó huérfana, dejando sin descifrar unas tarjetas que
            SÍ están coloreadas por estado.

            Es una LEYENDA, no un resumen: los cinco estados salen siempre, esté
            o no presente cada uno. Quien cuenta lo que hay es el subtítulo.

            ⚠️ EN MÓVIL SÓLO SALE EN DÍA, y la condición está aquí y no en CSS a
            propósito: la leyenda es HERMANA del calendario dentro del grid de
            `.agenda-fc`, así que desde la hoja no hay forma de preguntarle a la
            VISTA —su clase `.fc-listDay-view` cuelga del harness, que es la otra
            celda del grid, y no hay selector de hermano anterior.
            Por qué sólo en Día: ahí la fila lleva su píldora de estado con el
            nombre escrito, así que la leyenda explica algo que se está viendo. En
            Semana la fila sólo tiene el punto de color y la leyenda ocuparía una
            fila entera de las pocas que caben; en Mes no hay ni punto de estado.
            En escritorio no cambia nada: sale en las tres. */}
        {/* F1.16 · En la tableta, Día es la rejilla (`timeGridDay`) con su
            píldora de estado, igual que la lista de Día del teléfono. */}
        {(!isMobile || currentView === 'listDay' || currentView === 'timeGridDay') && <LeyendaEstados />}
        {/* Va PRIMERA en el DOM aunque se pinte segunda, y es a propósito: el
            `order` de la hoja la coloca bajo el toolbar, y así el lector de
            pantalla oye el aviso antes que los controles y la rejilla que
            describe, en vez de después de todo.

            ⚠️ ESTO SE PROBÓ COMO CHIP EN LA FILA DEL TOOLBAR Y SE REVIRTIÓ.
            Cabía —143,91 px, y la leyenda aguantaba el recorte sin pasar a tres
            líneas—, así que la cuenta salía: 33 px de rejilla por nada. Lo que
            no salía era lo otro: el rótulo tenía que encogerse a «Vista
            compacta» y la frase que dice QUÉ se recortó —«sábado y domingo
            ocultos · horas fuera de horario recortadas»— se iba a un `title` y a
            un `sr-only`, o sea fuera de la vista. Un aviso que hay que
            descubrir con el ratón no es un aviso. NO LO VUELVAS A PLEGAR sin
            resolver antes dónde se lee esa frase. */}
        {/* ⚠️ EL ENVOLTORIO ES QUIEN OCUPA EL ÁREA `banda` DESDE EL BLOQUE 9, y
            antes la ocupaba directamente `.ag-banda-compacta`. Se hizo así para
            no tocar el par `grid-template-rows` ↔ `grid-template-areas` de
            `.agenda-fc`: el razonamiento entero está junto al componente
            `Banda`, y merece leerse antes de mover nada de aquí.
            SE MONTA SIEMPRE, también sin ninguna banda: entonces mide cero y le
            sirve de ancla a la barra de carga, que se posiciona sobre él sin
            empujar la rejilla. El ORDEN de los hijos es la prioridad. */}
        <AvisosAgenda
          cargaVisible={cargaVisible}
          errorCitas={errorCitas}
          onReintentar={() => refetch(true)}
          citasIncompletas={citasIncompletas}
          currentView={currentView}
          /* Por `vistaEnElOtroFormato` y no con la cadena a mano: en un
             teléfono la Semana es `listWeek`, y `changeView` lanza con
             una vista que no se ha registrado. Es el mismo camino que
             usan el segmentado y la banda móvil.
             Y por `cambiarVista` y no por `changeView` a pelo: es lo
             que hace que este botón PIDA la semana en vez de heredar
             el recorte del mes. Sin eso no recuperaba nada — ver su
             cabecera. */
          onVerPorSemana={() => cambiarVista(vistaEnElOtroFormato('timeGridWeek', isMobile, esTableta))}
          googleFallo={googleFallo}
          vacioReal={vacioReal}
          vacioFiltrado={vacioFiltrado}
          medicoFiltrado={medicoFiltrado}
          periodoVacio={periodoVacio}
          mesSinTodos={mesSinTodos}
          onVerTodos={() => aplicarFiltro('', false)}
          /* ⚠️ NO FUNDIR con el `onAgendar` de `CabeceraEscritorio` ni con el
             de `BarraAgendarMovil`, aunque el cuerpo sea idéntico: el plan
             A2.5 deja los 3 onClick de «Agendar» como cierres separados a
             propósito (§invariantes, «los 3 onClick de Agendar — no fundir»). */
          onAgendar={() => {
            if (subState.isBlocked) { openBloqueoModal(); return }
            const { fecha, hora } = partirFechaHora(new Date().toISOString())
            setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no' })
          }}
          avisoRecorte={avisoRecorte}
          compactaElMes={compactaElMes}
          onSalirCompacta={() => setCompactar(false)}
        />
        <FullCalendar
          ref={calendarRef}
          /* ⚠️ `listPlugin` VA EL ÚLTIMO, Y LA POSICIÓN ES UNA DECISIÓN. Este
             array es el ORDEN EN QUE `getUnitViewSpec` recorre las vistas
             registradas (`core/internal-common.js:4955`) para resolver un
             destino genérico como el 'day' de un enlace de día: gana la primera
             vista de esa unidad. Hoy ese destino no se deja al azar —lo clava
             `navLinkDayClick="timeGridDay"`, cuatro líneas más abajo—, pero si
             `listPlugin` fuera el primero, el día que alguien retire ese clavo
             el ganador pasaría de `dayGridDay` a `listDay`, o sea que montar las
             listas habría CAMBIADO un comportamiento que no tenían que tocar.
             Puesto el último, añadirlo no mueve a nadie de sitio: el orden de
             desempate sigue siendo exactamente el de antes. */
          plugins={PLUGINS_FC}
          /* ⚠️ LITERAL, Y ANTES ERA `isMobile ? 'timeGridDay' : …`. Aquel
             ternario no decidía nada: `isMobile` arranca en `false` y sólo lo
             escribe un efecto, que corre DESPUÉS del montaje, así que
             FullCalendar —que lee esta opción una única vez— recibía
             `timeGridWeek` siempre. Quien ponía la vista del teléfono era el
             efecto del ancho, y sigue siéndolo. Dejarlo escrito daba a entender
             que el móvil arranca en Día, que es justo la imposición que el
             bloque 6 retira. */
          initialView="timeGridWeek"
          locale={esLocale}
          /* ⚠️ `false` EN MÓVIL, Y CON ÉL SE FUE `TOOLBAR_MOVIL`. El toolbar
             nativo lo sustituye entero la banda azul: sus flechas llaman a
             `prev()`/`next()` y su etiqueta sale de `view.title`, que es la
             MISMA cadena que pintaba el toolbar. De paso desaparece el título
             con formato de escritorio que quedaba colgando desde el paso 5.
             ⚠️ `false` Y NO UN OBJETO VACÍO: con `{}` FullCalendar sigue montando
             la fila del toolbar —vacía, pero con su `margin-bottom: 1.5em`— y
             además seguiría ocupando su `grid-area: toolbar`. */
          headerToolbar={isMobile ? false : TOOLBAR_ESCRITORIO}
          /* Guión largo. El default de FullCalendar es « - », con guión corto. */
          titleRangeSeparator=" – "
          /* ── LOS DOS DISPARADORES DE LA VENTANA, Y NO POR REDUNDANCIA ──
             `datesSet` cubre la navegación que NO reemite `eventsSet` —volver a
             un rango que ya está cacheado, donde el `eventStore` no se toca—;
             `eventsSet` cubre todo lo que no es navegación: la llegada del
             fetch, el alta optimista, el borrado y la re-hidratación tras un
             arrastre. Ninguno es superconjunto del otro, y quitar cualquiera de
             los dos deja un camino por el que la rejilla se queda corta.
             Durante el ARRASTRE no llega ninguno: el gesto vive en la rebanada
             `eventDrag` y el `eventStore` no se toca hasta el drop. */
          /* El conteo del subtítulo va detrás de la ventana en los DOS
             disparadores, y de la misma llamada: los eventos y los rangos ya
             están resueltos aquí, así que no cuesta una segunda lectura del
             `eventStore`. Su tercera entrada —`diasOcultos`, que `aplicarVentana`
             escribe justo encima y que aquí todavía no ha llegado al ref— la
             cubre un efecto propio, arriba. */
          datesSet={datesSetFc}
          eventsSet={eventsSetFc}
          buttonText={TEXTO_BOTONES_FC}
          slotMinTime={ventana.slotMinTime}
          slotMaxTime={ventana.slotMaxTime}
          /* Vacío mientras «Compactar» esté apagado. Nunca los siete: lo
             garantiza `diasOcultables`, y `initHiddenDays` lanza si no queda
             ningún día visible. */
          hiddenDays={diasOcultos}
          /* ENCENDIDA EN EL BLOQUE 5. Estuvo en `false` desde el principio y eso
             no escondía la banda: hacía que FullCalendar NO LA MONTARA, así que
             los eventos de todo el día de Google —que la fuente ya traía con
             `allDay: true`— se quedaban en el `eventStore` sin dibujarse en
             ninguna parte de Semana ni de Día. Ver la nota retirada de
             `contarVisibles`. */
          allDaySlot
          /* SIGUE EN 3 PARA MES, Y NO SE BAJA AQUÍ. La banda de todo el día lleva
             su propio tope de 2 desde `VISTAS_FC`, que es opción POR VISTA: este
             valor global sólo alcanza ya a `dayGridMonth`. Bajarlo aquí cambiaría
             las celdas del mes, que están fuera de este bloque. */
          dayMaxEvents={3}
          /* ⚠️ DOS TABLAS Y NO UNA CON RAMAS: las dos son literales de módulo,
             así que la identidad sigue siendo estable en los dos lados y
             FullCalendar no vuelve a refinar opciones por culpa de esto. Lo
             único que cambia entre ellas es la entrada de Mes. */
          views={!isMobile ? VISTAS_FC : esTableta ? VISTAS_FC_TABLETA : VISTAS_FC_MOVIL}
          /* Marca la celda del día que enseña el panel. Sólo pinta en móvil. */
          dayCellClassNames={dayCellClassNames}
          /* El número de día del mes lleva a la vista Día de ESE día. Antes no
             había forma de llegar ahí: la celda abre el alta, el «+N más» abre
             un popover, y el segmentado llama a `changeView` SIN fecha, así que
             saltaba a hoy.

             ⚠️ EL DESTINO SE FIJA A MANO Y NO ES PARANOIA. Sin `navLinkDayClick`
             FullCalendar resuelve el genérico 'day' con `getUnitViewSpec`
             (core/internal-common.js:4955), que recorre las vistas registradas
             EN EL ORDEN DE LOS PLUGINS y devuelve la primera de un solo día.
             `dayGridPlugin` va antes que `timeGridPlugin` en `plugins`, así que
             la ganadora sería `dayGridDay` — una vista que no está en el
             segmentado y que nadie ha diseñado. Si algún día se reordenan los
             plugins, esta línea es lo que impide que el destino cambie solo. */
          navLinks
          /* ⚠️ ERA LA CADENA `"timeGridDay"` Y AHORA ES UNA FUNCIÓN, POR UNA SOLA
             RAZÓN: ES LA ÚNICA SALIDA DE MES QUE NO PASA POR `cambiarVista`. Si
             el médico del mes lo pusimos nosotros, pulsar el número de un día se
             llevaba esa imposición a la vista Día y allí se quedaba, con la
             secretaria filtrada sin haber elegido a nadie. Revertir aquí es lo
             que cierra el círculo.

             ⚠️ EL DESTINO SIGUE SIENDO EL MISMO Y SIGUE ESCRITO A MANO — la nota
             de arriba explica por qué no se deja resolver por orden de plugins—.
             Esto no cambia a dónde se va; sólo añade la vuelta del filtro antes
             de ir. El `changeView` con fecha es exactamente lo que hacía la
             cadena. */
          navLinkDayClick={navLinkDayClickFc}
          nowIndicator
          nowIndicatorContent={renderNowIndicator}
          /* ⚠️ APAGADO EN EL MES DEL TELÉFONO, Y NO ES UN RECORTE DE FUNCIONES.
             Arrastrar sobre las celdas del mes crea un rango de días y abre el
             alta; en un teléfono ese gesto no existe a propósito —la única
             puerta para crear en móvil es la barra de abajo, ver su nota— y lo
             que sí existe es el TOQUE, que selecciona el día para el panel.
             Los dos gestos se pisan: un toque real trae uno o dos píxeles de
             deriva, y con `selectMinDistance` en su default de 0 eso basta para
             que `DateSelecting` dispare `select` además del `dateClick`. O sea
             que tocar una celda podía seleccionar el día Y abrir el alta encima.
             Apagado, en Mes móvil sólo queda el toque, y de paso desaparece el
             resaltado azul de selección, que competía con el contorno del día
             elegido. En cualquier otra vista y en escritorio no cambia nada. */
          selectable={!esMesMovil}
          selectMirror
          /* F3: tocar dentro de una capa (la burbuja) no suelta el tramo
             marcado. Primitivo; sin capas en pantalla no casa con nada, así que
             con el interruptor apagado se comporta como hoy. */
          unselectCancel=".ag-capa"
          editable
          /* F2.3: 180 = `--ag-dur-base` (decisión 5 del bloque F). Literal y
             primitivo a propósito: es una prop de `<FullCalendar>` y no puede
             cambiar de identidad (A1-bis.2). Si cambia el token, cambia esto.
             El regreso lo anima FullCalendar con `top`/`left` en línea sobre
             el espejo; con movimiento reducido lo corta el bloque CSS. */
          dragRevertDuration={180}
          eventResizableFromStart
          businessHours={horasHabilesFc}
          eventSources={eventSourcesStable}
          /* ── LOS DOS GANCHOS DE ESTADO DE CARGA (bloque 9) ────────────────
             `loading` es el AGREGADO de las dos fuentes: FullCalendar lo emite
             en `true` cuando la primera empieza a traer y en `false` cuando la
             última termina (`computeEventSourcesLoading`,
             @fullcalendar/core/index.js:549-556 y :1427-1430). No hay forma de
             saber por aquí CUÁL de las dos sigue en vuelo, y no hace falta: lo
             que atenúa la rejilla es que haya algo pendiente, sea lo que sea.

             ⚠️ `huboTraida` SE ENCIENDE EN EL FLANCO DE BAJADA Y NUNCA SE APAGA.
             Es lo que separa «todavía no ha llegado nada» de «llegó y no había
             nada», que es la distinción de la que vive la banda de vacío. En una
             navegación posterior vuelve a haber carga, pero ya no vuelve a haber
             ignorancia: los datos viejos siguen en la rejilla. */
          loading={loadingFc}
          /* ⚠️ AQUÍ NO VA `eventSourceFailure`, Y SE PROBÓ. Es el gancho GLOBAL
             de fallo y su firma sólo trae el `Error`: no dice QUÉ fuente falló.
             Cableado, un fallo de red de la fuente de Google levantaba la banda
             ROJA de «No se pudo cargar la agenda» — justo lo contrario de lo que
             este bloque persigue, que es que un fallo de Google no se lea como
             una agenda caída. Quien anota el fallo es el `catch` de CADA fuente,
             que sí sabe cuál es, y entre los dos cubren todo lo que puede fallar:
             el cuerpo entero de las dos va dentro de su `try`.
             Si algún día hace falta el suelo global, la vía NO es esta prop sino
             la clave `failure` de cada entrada de `eventSourcesStable` — pero eso
             cambia la lista de fuentes, con todo lo que su aviso dice. */
          dayHeaderContent={renderDayHeader}
          /* Sólo lo leen las vistas de lista; en rejilla y en Mes no hay nada
             que reemplazar y esta prop no llega a consultarse. */
          noEventsContent={renderSinEventos}
          eventContent={renderEC}
          /* Los marcadores semánticos de la fila. A nivel de módulo, o sea
             identidad estable. Volvió en el bloque 6 y su nota larga —incluida
             la condición con la que se fue— está junto a la función. */
          eventClassNames={clasesDelEvento}
          dateClick={dateClickFc}
          select={selectFc}
          eventClick={eventClickFc}
          eventDrop={eventDropFc}
          eventResize={eventResizeFc}
          /* Las cuatro puntas del candado de `refetch()`. Mientras haya un gesto
             en curso NO se traen citas: una traída a mitad de arrastre duplica
             la cita en pantalla, con el mismo id público y distintos ids
             internos. El porqué entero está junto a `hayGestoEnCurso`, y ahí
             está también por qué la marca caduca sola en vez de ser un booleano.
             Arrastre y redimensionado comparten el mismo par de manejadores
             porque comparten el defecto. */
          eventDragStart={alEmpezarGesto}
          eventDragStop={alTerminarGesto}
          eventResizeStart={alEmpezarGesto}
          eventResizeStop={alTerminarGesto}
          /* ⚠️ `100%` Y NO `auto`, y de aquí cuelga todo lo demás. Con `auto` el
             calendario crece hasta su altura completa y scrollea `<main>`: no
             hay zona fija posible. Con `100%` se acota a la tarjeta —que es
             `flex-1 min-h-[250px]` dentro de una raíz en `dvh`— y reparte
             solo: toolbar y cabecera de días arriba, `Scroller` en el cuerpo. */
          height="100%"
          /* ⚠️⚠️ LOS DOS VAN JUNTOS Y `scrollTimeReset={false}` NO ES OPCIONAL.
             El default es `true`, y su disparador es peor de lo que parece:
             `timegrid/internal.js:969` re-lanza el scroll inicial cuando cambia
             el `dateProfile`, y el `dateProfile` SE RECONSTRUYE EN CADA CAMBIO DE
             VENTANA de la rejilla. Caso concreto: arrastras una cita a una hora
             fuera de la ventana, la ventana se estira para que quepa, y la
             rejilla salta a `scrollTime` justo después del drop — el usuario
             pierde de vista la cita que acaba de mover. Con `false` sólo queda
             el scroll de montaje (`core/internal-common.js:2317-2323`). */
          scrollTime={scrollTime}
          scrollTimeReset={false}
          /* Las franjas se estiran para llenar el alto en vez de dejar hueco
             debajo. Se nota con «Compactar»: una ventana de cuatro horas sobre
             ~600 px pasa cada franja de ~34 a ~75 px. Es deliberado — un hueco
             blanco dentro de una tarjeta con borde se lee como un fallo de
             render, y una rejilla estirada se lee como una rejilla.
             El `height: 2.16rem !important` de `.fc .fc-timegrid-slot` no lo
             impide: en layout de tabla ese `height` es un MÍNIMO, así que sigue
             siendo el suelo y las filas crecen por encima. Coherente con la nota
             de esa regla: reducirla es peligroso, aumentarla es seguro. */
          expandRows
          /* F1.7 · Simultáneas en partes iguales, sin encimarse (spec §7.1).
             Primitivo: identidad estable, no re-refina opciones. */
          slotEventOverlap={false}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          eventTimeFormat={FORMATO_HORA_FC}
          slotLabelFormat={FORMATO_HORA_FC}
        />
      </div>

      {/* El panel va DENTRO del envoltorio y detrás de la tarjeta: es la
          segunda columna de la fila, no un hermano de la raíz. */}
      {panelDelDia && (
        <PanelDia
          titulo={tituloResumen}
          citas={conteo.citas}
          /* ⚠️ LOS DOS SUMANDOS, Y NO SÓLO `conteo.eventos`. Para el subtítulo
             de la página los eventos propios y los de Google son categorías
             distintas —«2 eventos · 1 de Google»—; para este tile son la misma
             cosa: lo que hay en la agenda que no es una cita. El mockup lo
             fija en «3 eventos» con un evento propio y dos de Google. */
          eventos={conteo.eventos + conteo.google}
          resumen={resumenDia}
          unMedico={unMedico}
          onHueco={abrirHueco}
          miniMes={agendaV2 && montarV2 ? <MiniMesPanelV2 rango={rangoVisible} alIrAFecha={irAFecha} /> : undefined}
          /* La MISMA bandera que levanta la banda roja de arriba. Sin esto el
             panel afirmaba horas y ofrecía huecos sobre un día recortado. */
          incompleto={citasIncompletas}
        />
      )}
      </div>

      {/* ═══ PANEL DEL DÍA (sólo el mes del teléfono) ═════════════════════
          Hermano de la tarjeta dentro de `.agenda-raiz`, no hijo suyo: así no
          entra en el `grid-template-areas` de `.agenda-fc` y el reparto de filas
          de esa rejilla —que es delicado y está avisado en globals.css— se queda
          exactamente como estaba. Aquí sólo hay un ítem más del flex de la raíz.

          ⚠️ EL ENLACE DE SALIDA VA A `listDay` Y NO A `timeGridDay`, y lo decide
          `vistaEnElOtroFormato`, no una cadena escrita a mano: en móvil el
          periodo «Día» se dibuja como lista. Escribir el nombre de la vista aquí
          sería la cuarta copia de esa tabla y la primera que se olvidaría. */}
      {esMesMovil && diaSel && (
        <PanelDelDia
          dia={diaSel}
          filas={filasDia}
          /* LA MISMA PUERTA que el clic sobre la rejilla, literalmente: la fila
             sólo lleva el `id` y quien resuelve la cita es `abrirCita`, que es
             también quien deja fuera a los bloques de Google. */
          onAbrir={id => {
            const evento = calendarRef.current?.getApi().getEventById(id)
            if (evento) abrirCita(evento)
          }}
          onVerDia={() => cambiarVista(vistaEnElOtroFormato('timeGridDay', true, esTableta), diaSel)}
        />
      )}

      {/* ═══ BARRA INFERIOR MÓVIL ═════════════════════════════════════════
          ⚠️ ES LA ÚNICA PUERTA PARA CREAR EN MÓVIL — ver la nota de cabecera de
          `BarraAgendarMovil.tsx` (A2.5.9). El `onAgendar` de aquí abajo es el
          MISMO cuerpo que el de `CabeceraEscritorio`, escrito otra vez a
          propósito: el plan A2.5 deja los 3 onClick de «Agendar» como cierres
          separados — no se funden en una función compartida. */}
      {isMobile && (
        <BarraAgendarMovil
          onAgendar={() => {
            if (subState.isBlocked) { openBloqueoModal(); return }
            const { fecha, hora } = partirFechaHora(new Date().toISOString())
            setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no' })
          }}
          onIntencionAgendar={precargarModalesAgenda}
        />
      )}

      {/* ── F3 · Interacciones v2 (chunk diferido, sólo con el interruptor) ── */}
      {agendaV2 && montarV2 && (
        <InteraccionesV2
          apiRef={interaccionesRef}
          alCambiarListas={setInteraccionesListas}
          alCambiarAtajos={setAtajosEncendidos}
          calendarRef={calendarRef}
          raizRef={raizRef}
          currentView={currentView}
          isMobile={isMobile}
          zonaVisor={navegadorTZ}
          quien={{ esMedico: isDoctor, perfilId: profile?.id ?? null }}
          isSingleDoctor={isSingleDoctor}
          onVista={cambiarVista}
          filtroActivo={filtroEfectivo}
          alFiltrarMedico={id => aplicarFiltro(id, false)}
          abrirCita={abrirCita}
          /* El atajo `c`: el mismo cuerpo que los tres «Agendar», en un cuarto
             cierre propio (la regla de no fundirlos, plan A2.5). */
          onAgendar={() => {
            if (subState.isBlocked) { openBloqueoModal(); return }
            const { fecha, hora } = partirFechaHora(new Date().toISOString())
            setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no' })
          }}
          /* T3 · «Convertir en cita» pasa la misma puerta de suscripción que «Agendar». */
          puedeAgendar={() => { if (subState.isBlocked) { openBloqueoModal(); return false } return true }}
          medicos={medicos}
          filtroMedico={filtroEfectivo || ((isSingleDoctor || isMedicoSinAdmin) && defaultMedicoId ? defaultMedicoId : null)}
          horario={horario}
          guardado={guardado}
          /* T1 · La invitación tras agendar desde la burbuja: el mismo modal
             que «Agregar invitados»; espera al evento de Google si aún no hay. */
          puedeInvitar={canVerAgendaCompleta(profile)}
          invitar={cita => setInvitacion({
            citaId: cita.id, paciente: pacienteParaInvitacion(cita), esperandoEvento: !cita.google_event_id,
          })}
          setModal={setModal}
          setConfirm={setConfirm}
        />
      )}

      {/* ── Modal cita ──────────────────────────────────── */}
      {modalPintado.mode !== 'closed' && (
        <AppointmentModal
          /* ⚠️ LA `key` NO ES DECORATIVA: ES EL MECANISMO DE RESETEO.
             Cambiar de cita a evento en el alta cambia esta clave, React tira el
             componente y monta uno nuevo, y con él vuelven a correr TODOS los
             `useState` de dentro. Eso es lo que impide que el paciente ya
             elegido viaje a un evento, que el título tecleado viaje a una cita, o
             que un `status` quede fuera de la lista que su tipo ofrece
             (`ESTADOS_EVENTO` no tiene «no asistió»).
             Sin ella el modal NO remonta —React reconcilia por posición— y harían
             falta cinco reseteos a mano, que es donde se olvida uno.
             En edición la clave es el id de la fila: abrir otra cita distinta
             también monta limpio, que es lo que ya se esperaba.

             ⚠️ EFECTO CONOCIDO Y ACEPTADO, ANOTADO EN EL BLOQUE 3C: CAMBIAR DE
             CITA A EVENTO BORRA LA HORA YA TECLEADA. El remonte vuelve a sembrar
             los `useState` desde `modal`, y en el alta desde la vista MES
             `modal.hora` es `null`, así que la hora que el médico acababa de
             escribir se pierde y el campo queda otra vez en blanco.
             NO ES UNA REGRESIÓN de la hora vacía: la pérdida ya existía —antes
             el campo revertía a la hora inventada de la ruta, que era igual de
             falsa— y el remonte es justo la propiedad de la que dependen los
             cinco reseteos de arriba. Se anota, no se arregla: conservarla
             obligaría a sacar la hora fuera del componente o a levantar el
             estado, y eso desarma el mecanismo entero por un caso de borde
             —teclear la hora ANTES de cambiar de tipo— que además avisa solo,
             porque el campo se ve vacío. */
          key={modalPintado.mode === 'create' ? modalPintado.tipo : modalPintado.appointment.id}
          modal={modalPintado}
          saliendo={modal.mode === 'closed'}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
          agendaV2={agendaV2}
          onCancelarCita={handleCancelar}
          /* B7c: sólo con el interruptor encendido; lee lo pintado en el
             momento de guardar, sin traer nada. */
          buscarEmpalmes={agendaV2 ? (cita) => {
            const api = calendarRef.current?.getApi()
            return api ? empalmesPintados(cita, api.getEvents()) : []
          } : undefined}
          medicos={medicos}
          horario={horario}
          defaultMedicoId={defaultMedicoId}
          hideMedicoDropdown={isSingleDoctor || isMedicoSinAdmin}
          medicoDropdownRequired={isSecretaria || isMedicoConAdmin}
          canVerExpediente={isDoctor}
          canInvitar={canVerAgendaCompleta(profile)}
          /* Sólo lo llama el control del alta, y sólo puede llegar en
             `mode: 'create'`: en edición ese control no se pinta. La guarda de
             aquí no es desconfianza del componente, es lo que hace que el
             `setModal` no pueda inventarse un estado de creación desde una
             edición si alguien cablea mal esto mañana. */
          onCambiarTipo={tipo => setModal(m => (m.mode === 'create' ? { ...m, tipo } : m))}
          onInvitar={() => {
            if (modal.mode !== 'edit') return
            setInvitacion({
              citaId: modal.appointment.id,
              paciente: pacienteParaInvitacion(modal.appointment),
              /* Ya tiene evento —el botón está apagado si no— así que no hay
                 nada que esperar: se entra directo a elegir. */
              esperandoEvento: false,
            })
          }}
        />
      )}

      {/* ── Invitar a la cita ────────────────────────────
          Dos puertas al mismo modal: la automática de después de crear una cita
          y el botón «Agregar invitados» del modal de edición. */}
      {invitacion && (
        <ModalInvitacionCita
          citaId={invitacion.citaId}
          paciente={invitacion.paciente}
          esperandoEvento={invitacion.esperandoEvento}
          onClose={() => setInvitacion(null)}
        />
      )}

      {/* ── Confirm ─────────────────────────────────────── */}
      {/* La `key` es el mensaje: dos avisos seguidos (fuera de horario y
          empalme, B7) son dos diálogos, y el segundo se monta de nuevo con su
          foco en vez de heredar el del primero. */}
      {confirm && <ConfirmModal key={confirm.message} {...confirm} />}

      {/* ── Modal horario ────────────────────────────────── */}
      {horarioOpen && (
        <HorarioModal
          fuente={fuenteHorario}
          onClose={() => setHorarioOpen(false)}
          onSave={async (h) => {
            try {
              const res = await fetch('/api/me/horario', {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ horario: h }),
              })
              if (res.ok) {
                // El horario vive ya en el agregado: se escribe su rebanada en
                // el cache en vez de en un estado local paralelo.
                // ⚠️ `c ?? config` (A1.6): con la semilla del layout la caché
                // está vacía y `c` llega `undefined`; sin esto el horario
                // nuevo no se pintaba hasta recargar.
                mutarConfig(c => {
                  const base = c ?? config
                  return base ? { ...base, horario: h } : base
                }, { revalidate: false })
                setHorarioOpen(false)
                toast.success('Horario actualizado')
              } else {
                /* P8: el 400 dice qué día no cuadra («Jueves: la hora de
                   cierre…»); se enseña tal cual. Sin cuerpo legible, el aviso
                   de siempre. */
                const cuerpo: unknown = await res.json().catch(() => null)
                const motivo = res.status === 400 && cuerpo && typeof cuerpo === 'object' && 'error' in cuerpo
                  && typeof cuerpo.error === 'string' ? cuerpo.error : null
                toast.error(motivo ?? 'No se pudo guardar el horario')
              }
            } catch {
              /* El `fetch` ni siquiera llegó a responder (red caída). Para el
                 médico es el MISMO suceso que un `!res.ok` —«no se guardó»—, así
                 que reutiliza ese aviso en vez de estrenar uno.

                 ⚠️ Y NO SE CIERRA EL MODAL, igual que en la rama de `!res.ok`:
                 cerrarlo tiraría lo editado, que sólo vive en el estado local
                 del modal. Dejándolo abierto puede reintentar sin volver a
                 teclear nada. */
              toast.error('No se pudo guardar el horario')
            }
          }}
        />
      )}
    </div>
  )
}
