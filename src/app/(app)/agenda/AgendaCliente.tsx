'use client'

/* Hasta A1.4a este archivo era `agenda/page.tsx`; las referencias `page.tsx:NNNN`
   en comentarios y docs apuntan aquí. */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { Calendar as CalendarioFC, type DatesSetArg, type FormatterInput, type PluginDef, EventClickArg, EventDropArg, DateSelectArg, EventInput, EventApi, EventContentArg, DayCellContentArg, DayHeaderContentArg, ViewApi } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { Calendar, Plus, Settings, ChevronDown,
         ChevronsDownUp, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useToast } from '@/components/ui/Toast'
import { useProfile } from '@/hooks/useProfile'
import { canManageClinica, canVerAgendaCompleta } from '@/lib/permissions'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { componerNombreMedicoCompleto, componerInicialesMedico } from '@/lib/nombreMedico'
import { useMenuMovil } from '@/contexts/MenuMovilContext'
import { GoogleGIcon } from '@/components/agenda/GoogleGIcon'
/* ⚠️ A2.6: `AppointmentModal`, `HorarioModal` y `ModalInvitacionCita` se
   cargan en diferido más abajo, con `next/dynamic` — son los tres modales más
   pesados de la agenda y no hacen falta en el JS inicial de `/agenda`. Lo que
   SÍ se importa aquí arriba, a secas, son sólo TIPOS (`import type`, que se
   borra en compilación) más `DEFAULT_DURATION`, que ya no vive en
   `AppointmentModal.tsx` — ver `src/lib/agenda/duracionCita.ts`. */
import type { ModalState, TodoElDiaInicial, PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import type { FuenteHorario } from '@/components/agenda/HorarioModal'
import { DEFAULT_DURATION } from '@/lib/agenda/duracionCita'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import { renderEventContent, type InicialesDeCita } from '@/components/agenda/renderEventContent'
import { renderNowIndicator } from '@/components/agenda/renderNowIndicator'
import { CabeceraDiaLista } from '@/components/agenda/CabeceraDiaLista'
import { BandaMovil, VIEWS } from '@/components/agenda/BandaMovil'
import { OPCION_TODOS } from '@/components/agenda/FiltrosBandaMovil'
import { PanelDelDia } from '@/components/agenda/PanelDelDia'
import { PanelDia } from '@/components/agenda/PanelDia'
import { Banda } from '@/components/agenda/Banda'
import { renderSinEventos } from '@/components/agenda/renderSinEventos'
import { rangoQuePedir } from '@/lib/agenda/rangoQuePedir'
import {
  aEventosDeCalendario, claveGoogle, eventosProvisionales, leerGoogle, pedirEventosGoogle, traerGoogle,
  type EstadoGoogleAgenda, type ResultadoGoogle,
} from '@/lib/agenda/cacheEventosGoogle'
import { claveCitas, generacionCitas, guardarCitas, leerCitas, vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { esperarSemilla, sembrarCacheCitas, type SemillaCitas } from '@/lib/agenda/semillaCitas'
import { semanaAnterior, semanaSiguiente } from '@/lib/agenda/semanasVecinas'
import { logger } from '@/lib/logger'
import {
  avisoDeRecorte,
  calcularVentanaRejilla,
  diasOcultables,
  type EventoParaVentana,
  type VentanaRejilla,
} from '@/lib/agenda/ventanaRejilla'
import { differenceInCalendarDays } from 'date-fns'
import useSWR, { useSWRConfig } from 'swr'
import {
  CLAVE_CONFIG,
  CONFIG_DEDUPE_MS,
  fetcherConfig,
  revalidarConfigAlMontar,
  type ConfigApp,
  type MedicoConfig,
} from '@/lib/configApp'
import type { Status, Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
export type { Appointment }
import {
  DIAS, HORARIO_DEFAULT, horarioToBusinessHours,
  avisoFueraDeHorario, avisoFinFueraDeHorario, avisoDiaCerrado,
} from '@/lib/agenda/horarioAgenda'
import {
  type RangosDeVista, rangosDeLaVista, TOPE_GESTO_MS, hayGestoEnCurso,
  addMinutes, partirFechaHora,
  ultimoDiaIncluido, puntasParaLaRejilla,
} from '@/lib/agenda/fechasAgenda'
import {
  type Tramo,
  medianocheDe, type ResumenDia, resumenDelDia, firmaDelResumen,
} from '@/lib/agenda/huecosAgenda'
import {
  type FilaDelDia, filasDelDia, firmaDeFilas,
  type ConteoVisible,
  type EventoParaConteo, contarVisibles, frasearConteo, frasearConteoBreve,
} from '@/lib/agenda/conteoAgenda'
import {
  esVistaDeRejilla, vistaEnElOtroFormato, etiquetaCompactar, vistaAdmiteCompactar,
  masBreve, periodoDeLaVista,
} from '@/lib/agenda/vistasAgenda'
import { STATUS_CONFIG, clasesDelEvento } from '@/lib/agenda/tarjetasAgenda'

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

/* Constante de módulo, no `[]` en línea: un array nuevo por render cambiaría
   la identidad de `inicialesDeCita` y con ella la de `eventContent`, que
   FullCalendar usa para decidir si repintar las tarjetas. */
const SIN_MEDICOS: MedicoConfig[] = []

/** Id de la eventSource de citas; ver `eventSourcesStable`. */
const FUENTE_APPOINTMENTS = 'appointments'

/** Prefijo del id temporal que lleva una cita aun no confirmada por el servidor. */
const PREFIJO_OPTIMISTA = 'optimistic-'

/* Antigüedad a partir de la cual volver a la pestaña sí pide datos otra vez.
   Ver el efecto de `visibilitychange`, que es quien lo justifica. */
const UMBRAL_REFETCH_FOCO_MS = 120_000

/* Lo que tiene que tardar una traída para que se note que está tardando (§11:
   «Bajo 150 ms no se muestra nada. Evita el flash»).
   ⚠️ NO LO BAJES PENSANDO QUE ASÍ SE «RESPONDE ANTES». Lo que hay debajo de este
   umbral no es una espera, es un parpadeo: la rejilla se atenúa y vuelve antes
   de que el ojo lo lea como un estado, y encima le cae encima la rampa de
   opacidad de 180 ms de `--ag-dur-base` (CONTRASTE_Y_MOVIMIENTO §3). */
const UMBRAL_CARGA_MS = 150

/* ─── Helpers ──────────────────────────────────────────── */

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

/* ─── Modal de creación rápida de paciente ──────────────── */
// Ahora importado desde @/components/ui/QuickPatientModal
// Se mantiene el bloque comentado para referencia
/*
function QuickPatientModal({
  nombreInicial,
  onCreated,
  onClose,
}: {
  nombreInicial: string
  onCreated: (p: PacienteBusqueda) => void
  onClose: () => void
}) {
  const partes = nombreInicial.trim().split(' ')
  const [nombre,    setNombre]    = useState(partes[0] ?? '')
  const [apellidos, setApellidos] = useState(partes.slice(1).join(' '))
  const [edad,      setEdad]      = useState('')
  const [email,     setEmail]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function handleCreate() {
    if (!nombre.trim() || !apellidos.trim() || !edad) {
      setError('Nombre, apellidos y edad son requeridos.')
      return
    }
    setSaving(true)
    setError('')
    const edadNum = parseInt(edad, 10)
    const anio = new Date().getFullYear() - edadNum
    const fecha_nacimiento = `${anio}-06-15`

    const res = await fetch('/api/pacientes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre: nombre.trim(), apellidos: apellidos.trim(), fecha_nacimiento, email: email.trim() || null }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message ?? data.error ?? 'Error al crear paciente'); setSaving(false); return }
    onCreated({ id: data.id, nombre: nombre.trim(), apellidos: apellidos.trim(), telefono: null })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-modal-enter overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <User size={15} className="text-emerald-600" />
            </div>
            <h2 className="font-semibold text-[15px] text-[#1d1d1f]">Registrar paciente</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Apellidos</label>
              <input value={apellidos} onChange={e => setApellidos(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Edad</label>
              <input type="number" min={0} max={120} value={edad} onChange={e => setEdad(e.target.value)}
                placeholder="ej. 35"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Correo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="opcional"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
          </div>

          <p className="text-[11px] text-[#86868b]">El expediente completo se puede editar después desde Pacientes.</p>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {saving ? 'Registrando...' : 'Crear y continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}

*/

/* ─── Modal de cita ─────────────────────────────────────── */

/**
 * Una cita de `/api/appointments` → lo que pinta FullCalendar. La usan la
 * fuente de citas y la semilla del servidor (A1.4c): UNA sola traducción, para
 * que lo sembrado y lo traído sean el mismo evento.
 */
function citaAEvento(apt: Appointment): EventInput {
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

/** Lo que `traerYGuardarCitas` entrega tras pedir y cachear un rango. */
interface TraidaCitas { eventos: EventInput[]; incompleta: boolean }

/**
 * Pide UN rango a `/api/appointments` y lo guarda en `cacheRangosCitas`
 * (A1.5a). La usan `appointmentSource` (la traída real) y la precarga de
 * semanas vecinas (A1.5b, `ejecutarPrecarga`): MISMA petición, MISMA
 * traducción (`citaAEvento`) y MISMO `guardarCitas` — sacarla de la fuente es
 * lo que evita tener dos copias que se desincronicen.
 *
 * `profileId` puede ser `null` (sin perfil no hay de quién es la caché, como
 * en `appointmentSource`): se pide igual, sólo que no se guarda nada.
 *
 * NO toca estado de React ni refs del componente — eso le toca a cada
 * llamador según lo que le corresponda (`errorCitas`, `ultimaTraidaRef`…).
 *
 * ⚠️⚠️ LAS DOS GUARDAS DE ABAJO (`res.ok` y el `Array.isArray`) NO SON
 * DEFENSIVAS, son el Bloque 9 entero: sin ellas un fallo del servidor se
 * pinta como una agenda VACÍA en vez de como un error — ver la nota larga que
 * llevaban en `appointmentSource` antes de este reparto. Las dos LANZAN, así
 * que sólo hay un camino de fallo: el `catch` de quien llame a esto.
 */
async function traerYGuardarCitas(
  startStr: string, endStr: string, filtro: string, profileId: string | null,
): Promise<TraidaCitas> {
  const salio = Date.now()
  const gen = generacionCitas()
  let url = `/api/appointments?from=${startStr}&to=${endStr}`
  if (filtro) url += `&medico_id=${filtro}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
  const data: { appointments?: Appointment[]; incompleta?: boolean } = await res.json()
  if (!Array.isArray(data.appointments)) throw new Error('Respuesta de citas ilegible')
  const eventos = data.appointments.map(citaAEvento)
  const incompleta = data.incompleta === true
  if (profileId) guardarCitas(claveCitas(profileId, filtro, startStr, endStr), eventos, incompleta, salio, gen)
  return { eventos, incompleta }
}

/**
 * Lo que vive en el mapa de citas en vuelo: la promesa Y LA GENERACIÓN con la
 * que salió. Sin la generación, reutilizar la promesa es el bug grave de la
 * revisión: `vaciarCacheCitas()` NO toca este mapa (es independiente de
 * `cacheRangosCitas`), así que una petición que salió ANTES de un vaciado
 * podía devolverse a quien pide DESPUÉS — datos de antes de la cita que
 * acaba de llegar por tiempo real, servidos como si fueran los de ahora.
 */
interface TraidaEnVuelo { gen: number; promesa: Promise<TraidaCitas> }

/**
 * Evita que la traída real y la precarga pidan la MISMA clave a la vez: la
 * segunda que llegue reutiliza la promesa de la primera — PERO SÓLO SI salió
 * en la generación VIGENTE. Si hubo un vaciado de por medio, esa promesa es
 * de antes: se ignora (su propio `.finally` la retira sola cuando resuelva) y
 * se pide una nueva. `enVuelo` es `citasEnVueloRef.current`, compartido por
 * las dos — un `Map` de módulo sería memoria entre pestañas sin sentido, y
 * uno por componente ya es lo que hace falta para una sola agenda abierta.
 */
function traerCitasDeduplicado(
  startStr: string, endStr: string, filtro: string, profileId: string | null,
  enVuelo: Map<string, TraidaEnVuelo>,
): Promise<TraidaCitas> {
  if (!profileId) return traerYGuardarCitas(startStr, endStr, filtro, profileId)
  const clave = claveCitas(profileId, filtro, startStr, endStr)
  const gen = generacionCitas()
  const existente = enVuelo.get(clave)
  if (existente && existente.gen === gen) return existente.promesa
  const promesa = traerYGuardarCitas(startStr, endStr, filtro, profileId).finally(() => {
    if (enVuelo.get(clave)?.promesa === promesa) enVuelo.delete(clave)
  })
  enVuelo.set(clave, { gen, promesa })
  return promesa
}

/** Tiempo ocioso con respaldo: no todos los navegadores tienen `requestIdleCallback` (Safari, a la fecha). */
function enOcioso(fn: () => void): number {
  if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(fn)
  return window.setTimeout(fn, 1)
}
function cancelarOcioso(handle: number): void {
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle)
  else window.clearTimeout(handle)
}

/** Las dos vistas de 7 días donde se precarga (A1.5b). Mes y Día, no. */
const VISTAS_PRECARGABLES = new Set(['timeGridWeek', 'listWeek'])

/** Una secuencia de precarga en curso: su candado de cancelación y su
 *  temporizador ocioso, fundidos en un solo objeto — ver `ejecutarPrecarga`. */
interface PrecargaEnCurso { cancelado: boolean; idle: number }

/**
 * Engancha la semilla del servidor a `cacheRangosCitas` (A1.4c). La generación
 * y la hora se toman AQUÍ, al recibir la promesa: un vaciado (escritura propia,
 * tiempo real) mientras viaja la descarta. Resuelve con la marca de la semilla
 * si entró (ver `sembrarCacheCitas`) o `null`. Nunca rechaza: si la semilla
 * falla, la fuente de citas va a la red como siempre, sin aviso.
 */
function engancharSemilla(semilla: Promise<SemillaCitas<Appointment> | null> | undefined): Promise<number | null> | null {
  if (!semilla) return null
  const gen = generacionCitas()
  const recibida = Date.now()
  return Promise.resolve(semilla).then(
    (s) => (s ? sembrarCacheCitas(s, citaAEvento, gen, recibida) : null),
    (err: unknown) => {
      logger.warn('agenda', `semilla de citas perdida: ${err instanceof Error ? err.message : 'error'}`)
      return null
    },
  )
}

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

/* ── LAS TRES VISTAS, CADA UNA EN SUS DOS FORMATOS ─────────────────────────
   Lo que el médico elige es un PERIODO —mes, semana, día—, no una vista de
   FullCalendar. El formato en el que ese periodo se dibuja lo decide el ancho:
   rejilla cuando sobra y lista cuando no.

   ⚠️ MES APARECE A LOS DOS LADOS CON EL MISMO VALOR, Y NO ES UN HUECO SIN
   RELLENAR. El mes se dibuja igual de ancho que de estrecho —lo que cambia son
   sus celdas, que es otro bloque—, así que su pareja es él mismo. Ponerlo aquí y
   no tratarlo como caso aparte es lo que deja `vistaEnElOtroFormato` sin ninguna
   rama especial: la tabla contesta por las tres.

   ⚠️ ESTA TABLA NO REGISTRA NADA. Las vistas se registran por el PLUGIN, en la
   prop `plugins` del <FullCalendar>; esto sólo dice quién es pareja de quién. Si
   añades un par aquí sin que las dos vistas existan, `changeView` lanzará. */

/* Opciones POR VISTA. A nivel de módulo por la regla de identidad estable: un
   literal en el JSX sería un objeto nuevo en cada render y FullCalendar vuelve
   a refinar sus opciones cuando la referencia cambia.

   `dayHeaderFormat` va aquí dentro y NO como prop suelta del calendario: a
   nivel raíz se la comería también el time-grid, donde la cabecera la compone
   `renderDayHeader` con su abreviatura de tres letras y su número apilado.
   Sin esto, el fallback de FullCalendar para una vista de varias semanas es
   `weekday: 'short'` (core/internal-common.js:6143-6144), que con `esLocale` da
   «lun» — y el mockup del mes pide «LUNES». Las mayúsculas ya las pone
   `globals.css` en `.fc-col-header-cell-cushion`; aquí sólo se pide el nombre
   largo. */
/* ⚠️ `titleFormat` VA AQUÍ DENTRO, POR VISTA, y no como prop suelta: cada una
   quiere una forma distinta y a nivel raíz se la comerían las tres. El default
   de FullCalendar para Semana es `{month:'short', day:'numeric', year:'numeric'}`,
   que con `esLocale` daba «17 – 23 Ago 2026» — mes abreviado y sin preposición.

   Cómo compone el rango la de SEMANA, porque no es obvio: `NativeFormatter`
   detecta que la unidad que difiere es el DÍA, formatea los dos extremos
   enteros («17 de agosto de 2026» / «22 de agosto de 2026»), busca la parte
   común y la saca fuera. Resultado: «17 – 22 de agosto de 2026». Por eso basta
   con pedir el formato de UNA fecha; el rango sale solo. El guión largo lo pone
   `titleRangeSeparator` en el calendario — el default es « - », con guión
   corto.

   ⚠️ QUE EL TÍTULO LLEGUE HASTA EL 23 Y EL MOCKUP HASTA EL 22 NO ES UN FALLO DE
   FORMATO: el mockup tiene el domingo plegado y nosotros no. El título sigue al
   rango real de la vista, que es lo correcto. No lo «arregles».

   La de DÍA sale «miércoles, 19 de agosto de 2026»: con coma, que es la forma
   del locale, mientras que el mockup la dibujó sin ella. Se respeta el locale.
   La mayúscula inicial —que Intl no pone en español— la da un `::first-letter`
   en `globals.css`. Y NO el `text-transform: capitalize` de
   `.fc .fc-toolbar-title`, que la regla de la agenda anula a propósito: ese
   capitalize pone mayúscula en CADA palabra y con este formato largo daría
   «17 – 22 De Agosto De 2026». Con el formato corto de antes no se notaba
   porque no había preposiciones que estropear. */
const VISTAS_FC = {
  dayGridMonth: {
    dayHeaderFormat: { weekday: 'long' },
    titleFormat:     { month: 'long', year: 'numeric' },
  },
  /* ⚠️ `month: 'short'` Y NO `'long'`. En largo esto daba «24 – 28 de agosto de
     2026» y medía 282,77 px a 22 px de cuerpo — el elemento más ancho de la fila
     con diferencia, y lo que dejaba a la leyenda sin sitio para caber en una
     línea. En corto sale «24 – 28 ago 2026». El separador largo lo pone
     `titleRangeSeparator` en el <FullCalendar>, no esto.
     Mes y Día se quedan en largo A PROPÓSITO: Mes ya es sólo «agosto de 2026» y
     no aprieta, y en Día el día de la semana es información que ahí se quiere. */
  /* ⚠️ `dayMaxEvents: 2` VA AQUÍ Y NO EN EL <FullCalendar>, y la diferencia es
     visible. Es el tope de la BANDA DE TODO EL DÍA, y `dayMaxEvents` es una
     opción global que Mes también lee: bajarla en el componente dejaría las
     celdas del mes en dos chips, que es otro bloque y otra decisión. Puesta por
     vista, sólo alcanza a las dos de rejilla.

     QUE LA BANDA LA LEA ESTÁ COMPROBADO EN LA LIBRERÍA, no supuesto:
     `@fullcalendar/timegrid/internal.js:315-322` (`getAllDayMaxEventProps`) la
     saca de `this.context.options` y la reparte al `DayTable` de la banda en
     `:1130`; sólo convierte el valor cuando es `true` (el modo «auto»), así que
     un número pasa entero. Y `context.options` es POR VISTA —
     `@fullcalendar/core/internal-common.js:2338-2342`, `buildViewContext` recibe
     `viewOptions` y los publica como `options`—, que es lo que hace que ponerla
     aquí funcione. */
  timeGridWeek: { titleFormat: { day: 'numeric', month: 'short', year: 'numeric' }, dayMaxEvents: 2 },
  timeGridDay:  { titleFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, dayMaxEvents: 2 },
  /* ⚠️ LAS DOS DE LISTA SÓLO LLEVAN `titleFormat`, Y NO ES UN OLVIDO: sus
     `listDayFormat` / `listDaySideFormat` siguen SIN PONERSE a propósito, porque
     los textos de la cabecera de día los compone `CabeceraDiaLista` a mano —los
     defaults del plugin vienen invertidos, ver su nota—. Esto es otra cosa: es la
     etiqueta de FECHA de la banda móvil, que sale de `view.title`.
     Sin estas dos entradas caían al default de FullCalendar, que trae el año y el
     mes abreviado —«17 – 22 ago 2026»—; el mockup pide «17 – 22 de agosto», sin
     año, porque en una pantalla de 390 px el año es la parte que no aporta.
     El rango lo compone solo `NativeFormatter` a partir del formato de UNA fecha,
     igual que en `timeGridWeek`; el guión largo lo pone `titleRangeSeparator`. */
  listDay:  { titleFormat: { weekday: 'short', day: 'numeric', month: 'long' } },
  listWeek: { titleFormat: { day: 'numeric', month: 'long' } },
} as const

/* ── LAS OPCIONES DEL MES EN UN TELÉFONO ────────────────────────────────────
   La MISMA tabla que la de arriba con la entrada de Mes sustituida. A nivel de
   módulo por la regla de identidad estable, igual que su hermana, y como objeto
   COMPLETO y no como spread: es la lista que hay que leer para saber qué ve el
   teléfono, y un spread obliga a mirar dos sitios.

   ⚠️ LA CUADRÍCULA SIGUE SIENDO LA DE FULLCALENDAR. Aquí no hay ninguna rejilla
   propia: lo único que cambia son cuatro opciones y una hoja de estilos.

   · `dayHeaderFormat: { weekday: 'narrow' }` — «L M X J V S D». En `long` («LUNES»)
     las siete cabeceras se pisaban unas a otras a 51 px de columna. Es la
     abreviatura más corta que el locale ofrece, que es «lo que quepa».
   · `showNonCurrentDates: false` — los días de los meses vecinos se dejan en
     blanco. Con `fixedWeekCount` en su default (`true`, y NO se toca: de él
     depende el rango de `semanasPintadasDelMes`) las seis filas siguen ahí, así
     que la rejilla no cambia de alto al navegar; lo que se va es el número de un
     día que no es de este mes y que en modo punto no se distingue de los suyos.
   · `dayMaxEvents: 3` — tres puntos y el cuarto hueco como «+N». El global es 3
     también, pero el de aquí es POR VISTA y sobrevive a que alguien mueva aquél.
   · `moreLinkContent` — «+2» y no «+2 más». El texto del locale son 35 px en una
     celda de 51 que ya lleva tres puntos.
   · ⚠️ `eventDisplay: 'list-item'` — Y ESTA NO ES COSMÉTICA, ES LO QUE HACE QUE
     LA FILA DE PUNTOS FUNCIONE. Con el default (`'auto'`) `dayGridMonth` reparte
     los segmentos en DOS mecanismos: los de hora van EN FLUJO dentro de la celda
     y los de todo el día —y los de varios días— van a una capa de la FILA con
     `position: absolute`. Un hijo posicionado en absoluto NO es un ítem de flex,
     así que la fila centrada de la hoja no lo colocaría: la barra se quedaría en
     el `top` que se calculó para el apilado vertical, encima del número del día.
     Con `'list-item'` todos los segmentos van por el camino en flujo y por
     celda, que es el único que la fila de puntos sabe repartir. De paso, un
     evento de varios días deja un punto en CADA día que ocupa, que es justo lo
     que un resumen de «cuánto hay» tiene que decir.
   · `navLinks: false` — ⚠️ Y ESTO NO ES UN RECORTE, ES QUITAR UN CONFLICTO. El
     número del día es un enlace a `timeGridDay` (ver `navLinkDayClick`), o sea
     que en el teléfono llevaba a una REJILLA de horas, que es justo el formato
     que el móvil no usa. Y además competía con el toque de la celda, que ahora
     selecciona el día. La ruta a la vista Día en móvil es el «Ver día ›» del
     panel de abajo, y es una sola.

   ⚠️ `hiddenDays` NO SE TOCA AQUÍ: el mes arranca con las SIETE columnas. Que se
   plieguen las vacías es una decisión del médico —el botón «Compactar» de la
   banda— y es reversible desde la misma banda. El mockup dibuja seis columnas
   con el domingo fijo; eso se descartó. */

const VISTAS_FC_MOVIL = {
  dayGridMonth: {
    dayHeaderFormat:     { weekday: 'narrow' },
    titleFormat:         { month: 'long', year: 'numeric' },
    showNonCurrentDates: false,
    dayMaxEvents:        3,
    moreLinkContent:     masBreve,
    eventDisplay:        'list-item',
    navLinks:            false,
  },
  timeGridWeek: { titleFormat: { day: 'numeric', month: 'short', year: 'numeric' }, dayMaxEvents: 2 },
  timeGridDay:  { titleFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, dayMaxEvents: 2 },
  /* ⚠️ AQUÍ ESTUVO `stickyHeaderDates: false` PARA `listDay`, Y SE RETIRÓ. NO LO
     REPONGAS SIN LEER ESTO: el problema que venía a esquivar está resuelto por
     su causa, y volver a apagar el pegado sólo lo taparía otra vez.

     LA HISTORIA. En Día, al scrollear, la primera cita se metía debajo de la
     cabecera del día y se leía a medias. Se apagó el pegado con el argumento de
     que con UN solo grupo no hay relevo que hacer. Después se comprobó, mockup
     en mano, que el solape es inevitable con cualquier cabecera pegada —el
     propio mockup lo asume por escrito: «el fondo tiene que ser OPACO, o las
     filas se ven por debajo»— y que el defecto de verdad era otro: el fondo NO
     estaba tapando, porque vivía en el `<th>`, una caja de tabla cuyos adornos
     se pintan en la posición de flujo y no viajan con el desplazamiento
     pegajoso. Arreglado eso —fondo y líneas mudados al cushion, y orden de
     pintado explícito; todo en `globals.css`, junto a `.fc-list-day-cushion`—,
     el pegado ya no tapa nada legible y las dos vistas de lista se comportan
     igual, que es lo que se quería. */
  listDay:  { titleFormat: { weekday: 'short', day: 'numeric', month: 'long' } },
  listWeek: { titleFormat: { day: 'numeric', month: 'long' } },
} as const

/* Las dos configuraciones del toolbar nativo, A NIVEL DE MÓDULO por la regla de
   identidad estable: un literal en el JSX es un objeto nuevo en cada render y
   FullCalendar vuelve a refinar sus opciones cuando la referencia cambia.
   Estaban en línea y se subieron aquí al tocarlas en el bloque 4.

   ⚠️ EN ESCRITORIO LA FECHA VA EN EL CHUNK `left`, con los botones, y `center`
   queda vacío. Antes iba en `center`, o sea flotando en mitad de la tarjeta y
   lejos de las flechas que la mueven. En MÓVIL se queda centrada: ahí el chunk
   izquierdo sólo lleva las dos flechas y no hay ancho para poner la fecha al
   lado sin partirla. */
/* ⚠️ AQUÍ VIVÍA `TOOLBAR_MOVIL`, Y SE FUE EN EL PASO 8a. Era
   `{ left: 'prev,next', center: 'title', right: 'today' }`, la configuración del
   toolbar NATIVO en móvil. Ya no hay toolbar nativo en móvil: `headerToolbar` va
   en `false` y lo sustituye entero `BandaMovil`. Si algún día vuelve el toolbar
   nativo ahí, esa es la línea — pero entonces sobra la banda, no conviven. */
const TOOLBAR_ESCRITORIO  = { left: 'prev,next today title', center: '', right: '' } as const

/* ── A1-bis.2 · LAS PROPS LITERALES DE `<FullCalendar>`, A NIVEL DE MÓDULO ────
   `@fullcalendar/react` llama a `resetOptions` con TODAS las props en cada render
   del padre, y FullCalendar re-refina cada opción cuya identidad cambió —y con
   una sola que cambie, repinta el calendario entero—. Un array o un objeto
   escrito en el JSX es uno nuevo en cada render. Aquí son el mismo siempre.
   ⚠️ El orden de `PLUGINS_FC` es una decisión: ver la nota junto a la prop. */
const PLUGINS_FC: PluginDef[] = [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]
const TEXTO_BOTONES_FC = { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }
/** El de las horas de las tarjetas y el de la columna de horas: el mismo. */
const FORMATO_HORA_FC: FormatterInput = { hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }

const CONTEO_VACIO: ConteoVisible = { citas: 0, eventos: 0, google: 0 }

export interface AgendaClienteProps {
  /** Las citas de W-1, W y W+1 sembradas por `page.tsx` (A1.4c). Sin ella, o
   *  si resuelve `null`, la agenda pide a la red como antes. */
  semillaCitas?: Promise<SemillaCitas<Appointment> | null>
}

export default function AgendaCliente({ semillaCitas }: AgendaClienteProps) {
  /* A1.4c: se engancha en el PRIMER render, antes de que FullCalendar monte y
     haga su primera traída. La consume esa traída (ver `appointmentSource`). */
  const [semillaLista] = useState(() => engancharSemilla(semillaCitas))
  const semillaPendienteRef = useRef(semillaLista)
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)
  const [modal,        setModal]        = useState<ModalState>({ mode: 'closed' })
  const [isMobile,     setIsMobile]     = useState(false)
  const [currentView,  setCurrentView]  = useState<string>('timeGridWeek')
  /* La etiqueta de fecha de la banda móvil. Con `headerToolbar={false}` ya no
     hay toolbar nativo que la pinte, así que se guarda lo que compone
     FullCalendar (`view.title`, que sale del `titleFormat` de `VISTAS_FC`) y se
     escribe en `datesSet`, que es quien sabe cuándo cambia el rango. */
  const [tituloVista, setTituloVista] = useState('')
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
  /* ⚠️ ESTE ESTADO YA NO ES «EL FILTRO»: ES LO QUE EL USUARIO HA ELEGIDO A MANO,
     y `null` significa «todavía no ha elegido nada». El filtro que de verdad
     manda es `filtroEfectivo`, unas líneas más abajo.

     Por qué hizo falta partirlo en dos. La agenda abre ahora con el médico que
     le toca al rol, y el rol llega TARDE: `useProfile` arranca en null y
     resuelve en una promesa, mientras que la traída inicial de FullCalendar sale
     en su efecto de montaje —efecto de hijo, o sea ANTES que el del padre—. Con
     un solo estado sólo había dos salidas, y las dos malas: sembrar en un efecto
     y pagar una traída de «todos los médicos» antes de corregirla (la traída
     cara, justo la que este cambio viene a evitar, y un parpadeo de la agenda
     entera), o sembrar en el `useState` inicial, donde el perfil todavía no
     existe.

     Con dos piezas no hay siembra que hacer: la elección del usuario, cuando la
     hay, TAPA a la semilla; mientras no la haya, manda la semilla. Y `null` no
     es lo mismo que `''` — `''` es una elección legítima («Todos los médicos») y
     tiene que ganarle a la semilla, que es exactamente lo que hace `??`. Con un
     `||` en su lugar, elegir «Todos» rebotaría a la semilla y el desplegable no
     obedecería. */
  const [filtroMedico, setFiltroMedico] = useState<string | null>(null)

  /* ⚠️⚠️ EL ESPEJO SÍNCRONO DEL FILTRO, Y EXISTE POR UNA RAZÓN DE ORDEN QUE NO SE
     VE LEYENDO EL RENDER. `null` = nadie ha escrito todavía; manda `filtroEfectivo`.

     `cambiarVista` llama a `api.changeView(...)`, que es SÍNCRONO: FullCalendar
     pide las citas EN ESA MISMA LÍNEA, y lo hace a través de
     `appointmentSourceRef.current`, que todavía apunta al closure del render
     anterior. O sea que un `setFiltroMedico(x)` puesto justo antes NO llega a
     tiempo: la petición sale con el filtro VIEJO.

     Eso, en el paso a Mes, es exactamente la petición que este bloque viene a
     eliminar —seis semanas por TODOS los médicos, la que se come el techo de mil
     filas—, seguida de una segunda ya corregida. Dos peticiones y la cara igual
     pagada.

     Con el espejo, las dos fuentes leen ESTO antes que su closure, así que la
     traída síncrona sale ya con el médico correcto y no hay traída cara.

     ⚠️ `''` ES UN VALOR ESCRITO, NO «vacío». Significa «todos los médicos» y
     tiene que ganarle al closure igual que un id — es lo que hace que la vuelta a
     «Todos» al salir de Mes también sea síncrona. Por eso el centinela de «nadie
     ha escrito» es `null` y la lectura es `?? filtroEfectivo`, nunca `||`.

     ⚠️ NO TOCA LA IDENTIDAD DE NINGUNA FUENTE. Es un ref: no entra en las deps de
     `appointmentSource`/`gcalSource`, que siguen dependiendo de `filtroEfectivo`,
     ni en las de `stableAppointmentSource`, `stableGcalSource` o
     `eventSourcesStable`, que siguen como estaban. */
  const filtroSincronoRef = useRef<string | null>(null)

  /* El médico que PUSIMOS NOSOTROS al entrar en Mes, o `null` si el filtro de
     ahora lo eligió una persona. Es lo único que distingue una imposición del
     sistema de una decisión del usuario, y de esa distinción vive la vuelta a
     «Todos» al salir de Mes: se deshace lo que impusimos, nunca lo que se eligió.

     Un REF y no estado: no pinta nada. Quien pinta es `filtroMedico`. */
  const medicoForzadoRef = useRef<string | null>(null)

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
  const horario = config?.horario ?? HORARIO_DEFAULT

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

  /* ── CON QUÉ MÉDICO ABRE LA AGENDA ────────────────────────────────────────
     Médico y administrador abren en SU agenda; la secretaria, en todas. En los
     tres casos el desplegable sigue entero: esto decide con qué se abre, no qué
     se puede elegir después.

     ⚠️ REUTILIZA `defaultMedicoId` Y NO LO DUPLICA. Ese `useMemo` ya contestaba
     esta misma pregunta para el modal —«¿de quién es esto por defecto?»— y para
     un `role: 'medico'` devuelve `profile.id` sin depender de que `medicos` haya
     llegado, que es lo que hace que la semilla del caso principal esté lista en
     cuanto lo está el perfil. La ÚNICA excepción es la secretaria: allí
     `defaultMedicoId` vale `''` para obligar a elegir en el modal, salvo en una
     clínica de un solo médico, donde devuelve a ése — y para el FILTRO eso sería
     abrir con un filtro puesto a quien su trabajo pide ver todo. De ahí la rama.

     ⚠️ `null` MIENTRAS SE CARGA EL PERFIL, Y NO `''`. No es un tecnicismo: es lo
     que impide que salga una traída de «todos los médicos» antes de saber el
     rol. Quien lo aprovecha es el gate de las dos fuentes; ver
     `filtroDecididoRef`. Si alguien pone aquí `''` de arranque «para simplificar»,
     vuelve la traída cara en cada apertura y este bloque entero deja de servir.

     Por qué NO es un efecto que llame a `setFiltroMedico`: un efecto corre
     DESPUÉS del primer commit, o sea después de que FullCalendar ya haya pedido.
     Derivarlo en render es lo que deja la primera petición ya correcta. */
  const semillaFiltro = cargandoPerfil ? null : (isSecretaria ? '' : defaultMedicoId)

  /* El filtro que manda, y el que leen TODOS los consumidores: la elección del
     usuario si la hay, y si no la semilla. `null` = todavía no se sabe. */
  const filtroEfectivo = filtroMedico ?? semillaFiltro

  // F3-6e: TZ del navegador (estable) + wrapper para inyectarla a renderEventContent.
  const navegadorTZ = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  )

  /* Iniciales del chip de médico. Se calculan AL PINTAR, no al traer las citas.
     Al montar, `medicos` viene vacío, así que `isSingleDoctor` vale true y el
     event source no tenía con qué calcularlas; eso se corregía con un
     `refetchEvents()` en cuanto llegaban los médicos — una segunda vuelta
     entera a /api/appointments y /api/google/events por dos letras. Calculado
     aquí, el chip aparece solo en el siguiente render y la red no se toca. */
  const inicialesDeCita = useCallback<InicialesDeCita>((ext) => {
    if (isSingleDoctor || !ext.medico_id) return undefined
    // La lista manda sobre el join de la cita: al reasignar médico, el
    // `medico` de extendedProps sigue siendo el anterior hasta que responde
    // el servidor. La cita optimista tampoco trae join, solo `medico_id`.
    const m = medicos.find(x => x.id === ext.medico_id) ?? ext.medico
    return m ? componerInicialesMedico(m) : undefined
  }, [isSingleDoctor, medicos])

  const renderEC = useCallback(
    (arg: EventContentArg) => renderEventContent(arg, navegadorTZ, inicialesDeCita),
    [navegadorTZ, inicialesDeCita]
  )

  /* ── Ventana vertical de la rejilla ──────────────────────
     Antes `slotMinTime`/`slotMaxTime` eran dos cadenas clavadas en 07:00–21:00
     y una cita a las 23:00 —hay cinco en producción— existía sin poder verse.
     Ahora la ventana se deriva de horario ∪ eventos visibles ∪ el mismo suelo
     de antes; el cálculo entero vive en `@/lib/agenda/ventanaRejilla`.

     ⚠️  EL ESTADO GUARDA LA SALIDA, no los tramos ni los eventos de los que
     sale. No es una simplificación, es lo que hace FIABLE la guarda de
     igualdad. La alternativa —comparar el array que llega en `eventsSet`— no
     sirve: ese array se construye recorriendo un mapa (`buildEventApis` sobre
     `eventStore`), así que su ORDEN cambia con altas, bajas y refetches. Un
     reordenamiento sin ningún cambio real diría «cambió» y volvería a escribir
     estado. Dos cadenas no tienen esa trampa.

     ⚠️  Y POR LO MISMO EL RANGO VISIBLE NO SE GUARDA: se lee de la vista en el
     momento de calcular. Guardado, cada `datesSet` traería `Date` nuevos con
     las mismas fechas — y `datesSet` SE REEMITE en cada cambio de ventana,
     aunque el rango no se mueva (la cadena está en la cabecera de
     `ventanaRejilla.ts`). La comparación por identidad diría «cambió» y daría
     la vuelta de más: ventana → datesSet → estado → recálculo → misma ventana. */
  /* ── EL BOTÓN «COMPACTAR» ──────────────────────────────────────────────
     Colapsa lo que la clínica no usa, en los dos ejes: quita el suelo de
     07:00–21:00 del cálculo de la ventana (las FILAS caen al horario real) y
     esconde con `hiddenDays` los días cerrados y sin ningún evento (las
     COLUMNAS). La regla es la misma arriba y a los lados: hay evento, no se
     colapsa; no hay evento, se colapsa.

     NO SE PERSISTE, y es a propósito: es una lente para mirar la semana de hoy,
     no una preferencia de la clínica. Que se apague solo al recargar evita el
     peor final posible —abrir la agenda un lunes, encontrarla recortada por una
     decisión de hace tres semanas y no saber qué la recortó.

     ⚠️  DECLARADO ANTES QUE `ventana`: su inicializador lo lee en el render. */
  const [compactar, setCompactar] = useState(false)

  const [ventana, setVentana] = useState<VentanaRejilla>(
    () => calcularVentanaRejilla([], null, horario, { compacta: false }),
  )

  /* ── LA HORA A LA QUE ARRANCA LA REJILLA ────────────────────────────────
     `scrollTime` estuvo INERTE hasta el bloque 3C: con `height="auto"` no había
     scroller interno que posicionar. Con la altura acotada despierta, y sus dos
     defaults son hostiles — de ahí esto y el `scrollTimeReset={false}` de abajo.

     El default es `06:00:00`, una hora a la que no atiende ninguna clínica, así
     que la rejilla abría con una franja muerta arriba. Aquí se apunta a la
     APERTURA MÁS TEMPRANA de los días activos: en Semana se ven varios días a la
     vez, así que tomar la de uno concreto dejaría fuera la primera cita de otro.

     Sobre el orden: `inicio` es «HH:MM» con cero delante, así que el orden
     alfabético y el cronológico coinciden y basta con `sort()`.

     ⚠️ ESTE VALOR SÓLO SE LEE AL MONTAR. `ScrollResponder` lo captura en el
     `componentDidMount` de la vista (`core/internal-common.js:2359-2361`), y con
     `scrollTimeReset={false}` no vuelve a dispararse. Dos consecuencias que NO
     son defectos: que cambie después no mueve la rejilla, y como `horario` llega
     por SWR, el primer montaje puede usar `HORARIO_DEFAULT` (09:00) si la config
     aún no ha respondido. Afecta a la posición inicial del scroll y a nada más. */
  const scrollTime = useMemo(() => {
    const aperturas = DIAS.map(d => horario[d.key]).filter(h => h?.activo).map(h => h.inicio)
    return aperturas.length ? `${aperturas.sort()[0]}:00` : ventana.slotMinTime
  }, [horario, ventana.slotMinTime])

  /** Índices `fc` de los días plegados. Vacío = la semana entera a la vista. */
  const [diasOcultos, setDiasOcultos] = useState<number[]>([])

  /* `horario` se lee del ref, no de la clausura, para que `aplicarVentana`
     conserve identidad con deps `[]`: la llaman los dos handlers del calendario
     y el efecto de abajo, y recrearla no aporta nada. */
  const horarioRef = useRef(horario)
  horarioRef.current = horario

  /* Y `compactar` por el mismo camino y por el mismo motivo. Meterlo en las
     deps recrearía `aplicarVentana` en cada pulsación del botón, y con ella los
     handlers que la cierran. El ref se escribe en render, igual que el de
     arriba: cuando el efecto de más abajo llame, ya vale lo nuevo. */
  const compactarRef = useRef(compactar)
  compactarRef.current = compactar

  /* ⚠️  LOS DOS EJES USAN RANGOS DISTINTOS, Y ES DELIBERADO. NO LOS UNIFIQUES.

     · La ALTURA (`calcularVentanaRejilla`) va con el rango ACTIVO, el pintado.
       Tiene que reflejar sólo lo que se ve: contar los eventos de una columna
       oculta para estirar el alto daría una rejilla alta con franjas vacías y
       sin nada a la vista que las justifique — el médico vería hueco muerto de
       06:00 a 09:00 sin una sola cita dentro.

     · Las COLUMNAS (`diasOcultables`) van con el rango COMPLETO, sin recortar.
       Con el activo el día oculto no puede volver JAMÁS: `trimHiddenDays` lo
       saca del rango, así que sus eventos caen fuera del filtro, así que sigue
       vacío, así que sigue oculto. Un punto fijo del que sólo se sale
       recargando la página. Aquí hace falta preguntar por días que ahora mismo
       NO se están pintando, que es justo lo que el otro eje no debe hacer. */
  const aplicarVentana = useCallback((
    eventos: readonly EventoParaVentana[],
    rangos: RangosDeVista | null,
  ) => {
    const compacta = compactarRef.current
    /* ⚠️ LA MITAD DEL ALTO SE APAGA EN MES, Y NO ES UNA OPTIMIZACIÓN. `compacta`
       quita el suelo de 07:00-21:00 del cálculo de la ventana vertical, y esa
       ventana es `slotMinTime`/`slotMaxTime`: dos opciones que `dayGridMonth` NI
       SIQUIERA LEE —no tiene rejilla de horas—. Encendida ahí no cambia nada de
       lo que se ve… salvo `avisoDeRecorte`, que sí la mira: la frase diría
       «horas fuera de horario recortadas» sobre una vista sin ninguna hora a la
       vista. O sea que la línea que confiesa el recorte MENTIRÍA. En Mes
       compactar es sólo el eje de las COLUMNAS, y eso es lo que queda vivo dos
       líneas más abajo. */
    const compactaElAlto = compacta && !(rangos?.esMes ?? false)
    const nueva = calcularVentanaRejilla(eventos, rangos?.activo ?? null, horarioRef.current, { compacta: compactaElAlto })
    /* Forma funcional, y devolviendo `prev` tal cual cuando no cambia: React se
       salta el re-render por su propio camino (bail-out por identidad). Un `if`
       alrededor del `setState` haría lo mismo, pero habría que repetirlo en los
       tres llamadores y basta olvidarlo en uno para reabrir la vuelta extra.

       ⚠️⚠️ DESDE EL BLOQUE 3C ESTA GUARDA YA NO ES UNA OPTIMIZACIÓN: ES CARGA
       ESTRUCTURAL, Y RELAJARLA SE VE EN PANTALLA. Al acotar la altura del
       calendario despertó el scroller interno, y con él `scrollTime`. Escribir
       esta ventana mueve `slotMinTime`/`slotMaxTime` → FullCalendar reconstruye
       el `dateProfile` → `timegrid/internal.js:969` avisa al `ScrollResponder`
       de que las fechas son nuevas. Hoy eso no salta porque el `<FullCalendar>`
       lleva `scrollTimeReset={false}`, pero la cadena está viva: una escritura
       de más aquí es un candidato a SALTO DE SCROLL, no sólo un render de más.
       Quien piense «comparar dos cadenas es redundante, esto ya lo hace React»
       está mirando la mitad del coste. Las dos piezas —esta guarda y el
       `scrollTimeReset={false}`— se sostienen la una a la otra. */
    setVentana(prev =>
      prev.slotMinTime === nueva.slotMinTime && prev.slotMaxTime === nueva.slotMaxTime
        ? prev
        : nueva
    )

    /* ⚠️  LA MISMA DISCIPLINA PARA LAS COLUMNAS, Y AQUÍ HACE MÁS FALTA TODAVÍA.
       `diasOcultables` devuelve un array NUEVO cada vez, así que sin comparar
       elemento a elemento cada `eventsSet` escribiría estado, y cada escritura
       mueve `hiddenDays` → nuevo `dateProfileGenerator` → `datesSet` → otra
       vuelta. Con la comparación, la segunda vuelta muere en el bail-out.
       Y con el rango COMPLETO el ciclo sí converge de verdad: el conjunto no
       depende de qué se recortó, así que la segunda vuelta da lo mismo que la
       primera y muere ahí. */
    const ocultos = compacta
      ? diasOcultables(eventos, rangos?.completo ?? null, horarioRef.current, DIAS)
      : []
    setDiasOcultos(prev =>
      prev.length === ocultos.length && prev.every((d, i) => d === ocultos[i])
        ? prev
        : ocultos
    )
  }, [])

  /** Los dos rangos de la vista. `null` antes del primer `datesSet`. */
  const rangoDeVista = useCallback((): RangosDeVista | null => {
    const vista = calendarRef.current?.getApi().view
    return vista ? rangosDeLaVista(vista) : null
  }, [])

  /* El horario es la TERCERA entrada del cálculo y llega por SWR. Si la
     configuración resuelve DESPUÉS del último `eventsSet` —cache frío—, la
     rejilla se quedaría con una ventana calculada sin él. Esto no es un tercer
     disparador del calendario: es el que cubre a su propia entrada. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarVentana(api.getEvents(), rangoDeVista())
  }, [horario, aplicarVentana, rangoDeVista])

  /* Pulsar el botón no es navegación ni alta de eventos: no llega `datesSet` ni
     `eventsSet`, así que nadie recalcularía. Este efecto es el disparador del
     propio botón, calcado del de arriba —que cubre al horario— porque cubre a
     la CUARTA entrada del cálculo. `aplicarVentana` lee `compactarRef`, que ya
     vale lo nuevo: el ref se escribe en render y el efecto corre después. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarVentana(api.getEvents(), rangoDeVista())
  }, [compactar, aplicarVentana, rangoDeVista])

  /* ⚠️  EL ESTADO SE APAGA DONDE NO HAY BOTÓN, y esta guarda SE REESCRIBIÓ en el
     paso 9 en vez de relajarse. Decía `isMobile || !currentView.startsWith(
     'timeGrid')`, o sea que apagaba en Mes y apagaba en todo el móvil.
     Las dos mitades caducaron a la vez: Mes ahora pliega columnas —es el único
     eje que le sirve— y el botón existe también en la banda móvil, así que ya no
     hay ningún sitio donde el estado pueda quedarse encendido sin salida.
     LO QUE SIGUE EN PIE, y es todo el motivo de que la guarda exista: en móvil
     Semana y Día son LISTAS (`listWeek` / `listDay`), y una lista no tiene ni
     columnas que plegar ni rejilla que encoger. `vistaAdmiteCompactar` contesta
     `false` para las dos, así que el apagado automático sigue cubriéndolas — y
     ése era el caso de verdad, no «el móvil». */
  useEffect(() => {
    if (!compactar) return
    if (!vistaAdmiteCompactar(currentView)) setCompactar(false)
  }, [compactar, currentView])

  /* Sólo con el botón encendido: apagado no hay nada que confesar. El `!isMobile`
     que había aquí se fue con el botón de la banda — el aviso tiene que salir
     allí donde se pueda haber encendido, y ahora eso incluye el teléfono.
     En Mes la frase sólo puede hablar de columnas: la mitad del alto va gateada
     en `aplicarVentana`, así que `ventana` no se estrecha y `avisoDeRecorte` no
     tiene nada que decir de las horas. */
  const avisoRecorte = compactar ? avisoDeRecorte(ventana, diasOcultos, DIAS) : null

  /* En Mes el recorte es SÓLO de columnas, así que los rótulos cambian: hablar
     de «rejilla» y de «horario» ahí describe algo que no está en pantalla. */
  const compactaElMes = compactar && currentView === 'dayGridMonth'

  /* ── EL CONTEO DEL SUBTÍTULO ─────────────────────────────────────────
     Mismo patrón que la ventana de la rejilla, y por el mismo motivo: cuelga de
     `eventsSet`, que se emite en cada llegada de fetch —DOS por navegación, una
     por fuente—, en cada alta optimista, en cada baja, en cada re-hidratación
     tras un arrastre y en cada eco de Realtime.

     ⚠️  EL ESTADO GUARDA LA SALIDA —tres enteros—, NO LOS EVENTOS DE LOS QUE
     SALE. Es lo mismo que hace `ventana` con sus dos cadenas, y por la misma
     razón: el array que llega en `eventsSet` NO se puede comparar, porque se
     construye recorriendo un mapa (`buildEventApis` sobre `eventStore`) y su
     ORDEN cambia con altas, bajas y refetches. Un reordenamiento sin ningún
     cambio real diría «cambió». Tres números no tienen esa trampa.

     La diferencia con la ventana, que conviene saber: esto NO alimenta ninguna
     prop de FullCalendar, así que una escritura de más aquí es un render de más
     y no un candidato a salto de scroll. La guarda sigue haciendo falta —dos
     emisiones por navegación son dos renders del árbol entero— pero el precio de
     fallarla es menor que allí. No la quites; sí sepas que no es lo mismo. */
  const [conteo, setConteo] = useState<ConteoVisible>(CONTEO_VACIO)

  /* Por ref y no por deps, igual que `horarioRef` y `compactarRef`: mete
     `diasOcultos` en las deps y `aplicarConteo` se recrea con cada pliegue. */
  const diasOcultosRef = useRef(diasOcultos)
  diasOcultosRef.current = diasOcultos

  /* ⚠️ YA NO RECIBE LA VISTA, Y ESO ES DEL BLOQUE 5. Llevaba un `vista: string`
     con su propia nota —llegaba por parámetro y no del estado `currentView`
     porque en `datesSet` el `setCurrentView` de al lado todavía no ha llegado al
     render—, pero su ÚNICO consumidor era la reja `sinAllDay` de
     `contarVisibles`, que se retiró al encender la banda. Sin ella el parámetro
     quedaba muerto, y con él el `view.type` que los tres llamadores calculaban
     sólo para pasárselo. El conteo no depende de la vista.

     Si algún día vuelve a hacer falta la vista aquí, el motivo de arriba sigue
     en pie: sácala del `arg` del handler, nunca de `currentView`. */
  const aplicarConteo = useCallback((
    eventos: readonly EventoParaConteo[],
    rangos: RangosDeVista | null,
  ) => {
    const nuevo = contarVisibles(
      eventos,
      rangos?.activo ?? null,
      diasOcultosRef.current,
    )
    /* Forma funcional devolviendo `prev` tal cual cuando no cambia, para que
       React se salte el re-render por bail-out de identidad. Calcado de
       `setVentana` y `setDiasOcultos`. */
    setConteo(prev =>
      prev.citas === nuevo.citas && prev.eventos === nuevo.eventos && prev.google === nuevo.google
        ? prev
        : nuevo
    )
  }, [])

  /* `diasOcultos` es la TERCERA entrada del conteo y la escribe `aplicarVentana`
     DESPUÉS de que los handlers hayan contado: dentro del handler el ref todavía
     vale lo viejo. Este efecto es quien cubre esa entrada, igual que los dos de
     más arriba cubren al horario y al botón. Y de paso hace el conteo del
     montaje, antes del primer `eventsSet`. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarConteo(api.getEvents(), rangoDeVista())
  }, [diasOcultos, aplicarConteo, rangoDeVista])

  /* ── EL DÍA QUE ENSEÑA EL PANEL DEL MES ────────────────────────────────
     Sólo lo consume la vista Mes del teléfono. En cualquier otra queda inerte:
     ni se pinta el panel ni se marca ninguna celda. */
  const [diaSel, setDiaSel] = useState<Date | null>(null)
  const [filasDia, setFilasDia] = useState<readonly FilaDelDia[]>([])

  /* Por ref y no por deps, igual que `horarioRef` y `compactarRef`: con
     `diaSel` en las deps, `aplicarPanel` se recrearía en cada toque de celda. */
  const diaSelRef = useRef(diaSel)
  diaSelRef.current = diaSel

  const aplicarPanel = useCallback((eventos: readonly EventApi[]) => {
    const dia = diaSelRef.current
    const nuevas = dia ? filasDelDia(eventos, dia) : []
    setFilasDia(prev => (firmaDeFilas(prev) === firmaDeFilas(nuevas) ? prev : nuevas))
  }, [])

  /* El día seleccionado es la SEGUNDA entrada del panel y no llega por ningún
     handler del calendario: la escribe el toque en una celda y el cambio de mes.
     Este efecto es quien la cubre, igual que los de más arriba cubren al horario,
     al botón y a `diasOcultos`. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarPanel(api.getEvents())
  }, [diaSel, aplicarPanel])

  /* ── EL RESUMEN Y LOS HUECOS DE LA VISTA DÍA (bloque 8) ────────────────
     Mismo patrón que `conteo` y que el panel del mes, y por el mismo motivo:
     cuelga de los dos disparadores del calendario, guarda LA SALIDA y no los
     eventos de los que sale, y se protege con una firma para que las dos
     emisiones por navegación no sean dos renders del árbol entero.

     ⚠️ SE CALCULA EN EL CLIENTE Y SOBRE LO QUE YA ESTÁ CARGADO. Ni ruta nueva
     ni consulta al servidor: los eventos del día ya están en el `eventStore` y
     el horario ya llegó por SWR para `businessHours`. Un endpoint de
     disponibilidad sería una segunda fuente de verdad sobre las mismas filas.

     ⚠️ INERTE FUERA DE `timeGridDay`. Vale `null` en cualquier otra vista, así
     que en Semana, en Mes y en las listas esto no cuesta ni un recorrido: la
     guarda de vista está ANTES del cálculo, no después. */
  const [resumenDia, setResumenDia] = useState<ResumenDia | null>(null)

  const aplicarResumen = useCallback((
    eventos: readonly EventApi[],
    rangos: RangosDeVista | null,
    vista: string,
  ) => {
    /* El día es `activeStart` y no `new Date()`: el panel sigue al calendario,
       no compite con él (§8.3). En `timeGridDay` el rango activo es ese único
       día, así que «el primer día del rango» y «el día pintado» son lo mismo y
       no hace falta la rama de «hoy si cae dentro» que pide el spec para las
       vistas de varios días — aquí no hay ninguna. */
    const nuevo = vista === 'timeGridDay' && rangos
      ? resumenDelDia(eventos, rangos.activo.activeStart, horarioRef.current)
      : null
    setResumenDia(prev => (firmaDelResumen(prev) === firmaDelResumen(nuevo) ? prev : nuevo))
  }, [])

  /* El horario es la SEGUNDA entrada del resumen y llega por SWR, que puede
     resolver DESPUÉS del último `eventsSet`. Este efecto es quien cubre esa
     entrada —igual que el gemelo que cubre la ventana de la rejilla— y de paso
     hace el primer cálculo del montaje. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarResumen(api.getEvents(), rangoDeVista(), api.view.type)
  }, [horario, aplicarResumen, rangoDeVista])

  /* ⚠️ EL MES SE COMPARA CON UN REF, Y SIN ESO EL PANEL NO SE PODRÍA USAR.
     La regla es «al navegar de mes, el panel muestra el primer día del mes», y
     el sitio donde se sabe que el rango cambió es `datesSet`. Pero `datesSet` SE
     REEMITE en cada cambio de la ventana vertical aunque el rango no se mueva
     (la cadena está en la cabecera de `ventanaRejilla.ts`), así que escribir el
     día en cada emisión borraría la selección del médico un fotograma después de
     hacerla. Comparando la clave del mes, sólo escribe cuando el mes es otro. */
  const mesDelPanelRef = useRef('')
  const sincronizarDiaDelPanel = useCallback((vista: ViewApi) => {
    if (vista.type !== 'dayGridMonth') { mesDelPanelRef.current = ''; return }
    const clave = vista.currentStart.toISOString()
    if (mesDelPanelRef.current === clave) return
    mesDelPanelRef.current = clave
    setDiaSel(vista.currentStart)
  }, [])

  /* La marca del día seleccionado. CONTORNO, no relleno: el relleno es de HOY, y
     dos rellenos en la misma cuadrícula no se distinguen de un vistazo.
     ⚠️ ACOTADA A MÓVIL A PROPÓSITO. `sincronizarDiaDelPanel` corre también en el
     Mes de escritorio —es el mismo `datesSet`—, así que sin este `isMobile` el
     día 1 aparecería contorneado en un escritorio donde no hay panel al que
     corresponda ni forma de cambiar la selección. */
  const dayCellClassNames = useCallback((arg: DayCellContentArg): string[] => (
    isMobile && diaSel && differenceInCalendarDays(arg.date, diaSel) === 0 ? ['ag-mes-dia-sel'] : []
  ), [isMobile, diaSel])

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
      setIsMobile(movil)
      const api = calendarRef.current?.getApi()
      if (!api) return
      const destino = vistaEnElOtroFormato(api.view.type, movil)
      if (destino !== api.view.type) api.changeView(destino)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function closeModal() { setModal({ mode: 'closed' }) }

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
  }, [])
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
  function refetch(forzarGoogle = false) {
    if (forzarGoogle) vaciarCacheCitas()
    if (hayGestoEnCurso(gestoEnCursoRef)) return
    googleAplazadoRef.current = false
    if (forzarGoogle) forzarGoogleRef.current = true
    calendarRef.current?.getApi().refetchEvents()
  }

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
  /* Escribe el filtro POR LOS DOS CAMINOS a la vez, y todos los que lo cambian
     pasan por aquí: los dos desplegables y el paso a Mes.

       · el estado, que es quien manda en el render siguiente y quien pinta;
       · el espejo, que es lo único que puede leer un `changeView` síncrono;
       · la marca de forzado, que decide si esto se deshace al salir de Mes.

     ⚠️ `forzado` NO ES UN DETALLE: es la diferencia entre una imposición nuestra
     y una elección de la persona. Cualquier escritura hecha a mano lo pone en
     `false` y con eso el médico deja de ser reversible, que es justo lo que pide
     D3 —«si el usuario eligió a alguien, se respeta»—. */
  function aplicarFiltro(id: string, forzado: boolean) {
    setFiltroMedico(id)
    filtroSincronoRef.current = id
    medicoForzadoRef.current = forzado ? id : null
  }

  /* A quién se selecciona al entrar en Mes sin nadie puesto: al propio usuario si
     es médico, y si no al primero de la lista.

     ⚠️ NO REUTILIZA `defaultMedicoId`, y no por descuido: aquél devuelve `''` para
     la secretaria a propósito —para obligarla a elegir en el MODAL—, y `''` es
     precisamente el valor que aquí no puede salir. Son dos preguntas distintas
     con la misma forma.

     ⚠️ EL `find` NO SOBRA. Un médico cuyo id no esté en la lista de la clínica
     dejaría el desplegable enseñando un valor que no es ninguna de sus opciones,
     y el `<select>` caería a la primera. Ante la duda, el primero de la lista. */
  function medicoQueForzar(): string | null {
    if (profile?.role === 'medico' && profile.id && medicos.some(m => m.id === profile.id)) {
      return profile.id
    }
    return medicos[0]?.id ?? null
  }

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

  /* Mes con «Todos» no existe: mil filas entre seis semanas son 24 citas al día
     para la clínica entera, y un médico con jornada llena hace 16. Con dos
     médicos activos el mes ya llega al techo, y lo que se recorta son las últimas
     semanas, que se ven LIBRES. La protección contra el truncado sigue puesta —no
     se relaja—, pero contener no es lo mismo que evitar.

     ⚠️ `isSingleDoctor` APAGA LA REGLA ENTERA, y es la misma condición que decide
     si el desplegable existe: donde no hay desplegable no hay restricción. Ahí
     `''` no significa «todos», significa «el único», las filas son las de un solo
     médico y el techo no se acerca. De paso cubre la clínica sin médicos, donde
     forzar no tendría a quién y dejaría el mes en blanco. */
  function forzarMedicoParaElMes() {
    if (isSingleDoctor) return
    if (filtroEfectivo !== '') return
    const elegido = medicoQueForzar()
    if (elegido) aplicarFiltro(elegido, true)
  }

  /* La vuelta. Sólo deshace lo que impusimos: si el filtro de ahora ya no es el
     que forzamos —porque la persona eligió otro en el desplegable—, no se toca.
     `aplicarFiltro(..., false)` limpia la marca de camino. */
  function revertirMedicoForzado() {
    const forzado = medicoForzadoRef.current
    if (forzado === null) return
    if (filtroEfectivo !== forzado) { medicoForzadoRef.current = null; return }
    aplicarFiltro('', false)
  }

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
  }, [filtroEfectivo])

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
  }, [filtroEfectivo, profile])

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
  }, [filtroEfectivo, profile, refrescarGoogle])

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

  /* ── Helper: construir EventInput desde datos de cita ── */
  /* ⚠️ EL PARÁMETRO ES `DatosGuardado` Y NO `Partial<Appointment>`, Y ES LO QUE
     ARREGLA EL ALTA OPTIMISTA DE TODO EL DÍA. El camino optimista llama a esto
     con lo que el modal mandó a guardar, que en todo el día son
     `all_day_desde`/`all_day_hasta` y NO `start_time`. Con el tipo viejo esas
     dos claves ni se veían, así que salía un `EventInput` sin `start`,
     `addEvent` devolvía `null` y no se pintaba nada hasta que contestara el
     servidor. `DatosGuardado` es un superconjunto, así que los demás llamadores
     no se enteran. */
  function buildEventInput(data: DatosGuardado): EventInput {
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
      if (id) api.getEventById(id)?.remove()
      return
    }
    if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return

    const fila = payload.new
    if (!fila?.id || !fila.start_time) return

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
      api.getEventById(fila.id)?.remove()
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
      api.addEvent(buildEventInput(cita), FUENTE_APPOINTMENTS)
    }
  }

  /* El handler se recrea en cada render (lee `filtroEfectivo`), pero el canal se
     suscribe UNA vez: la ref es lo que los une sin re-suscribir. Mismo patrón
     que `appointmentSourceRef`. */
  const aplicarCambioRef = useRef(aplicarCambioRealtime)
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
  }, [])

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
   * El efecto no lleva dependencias: `refetch` y la guarda sólo leen refs, así
   * que la clausura no se queda vieja. Mismo criterio que el efecto del canal.
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
  }, [])

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
    abrirAlta(arg.date, fecha, arg.allDay ? null : hora, enLaBanda ? 'fijo' : 'no')
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
  function abrirAlta(
    instante: Date, fecha: string, hora: string | null,
    todoElDia: TodoElDiaInicial, finParaAvisar?: Date, ultimoDia?: string,
  ) {
    const aviso = hora === null
      ? avisoDiaCerrado(instante, horario)
      : (avisoFueraDeHorario(instante, horario, 'Vas a agendar a las')
         ?? (finParaAvisar ? avisoFinFueraDeHorario(finParaAvisar, horario) : null))
    const abrir = () => setModal({
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
      abrirAlta(arg.start, fecha, null, enLaBanda ? 'fijo' : 'no', undefined, ultimoDia)
      return
    }
    abrirAlta(arg.start, fecha, hora, 'no', arg.end)
  }

  /* ⚠️ LA ÚNICA PUERTA A LA EDICIÓN DE UNA CITA, Y POR ESO ESTÁ SUELTA. Nació
     dentro de `handleEventClick` y salió en el paso 9, cuando el panel del mes
     estrenó una SEGUNDA forma de abrir la misma cita. Que las dos pasen por aquí
     es lo que garantiza que la regla de Google —los bloques del calendario de
     Google no abren nada, porque no son filas de `appointments` y no hay qué
     editar— no pueda aplicarse en una y olvidarse en la otra.
     Y de paso deja UN solo sitio en el archivo donde `extendedProps` se estrecha
     a `Appointment`. Si algún día se abre una tercera puerta, entra por aquí. */
  function abrirCita(evento: EventApi) {
    if (evento.extendedProps.isGcalBlock) return
    setModal({ mode: 'edit', appointment: evento.extendedProps as Appointment })
  }

  function handleEventClick(arg: EventClickArg) {
    abrirCita(arg.event)
  }

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
    if (aviso) {
      setConfirm({
        message: aviso,
        onConfirm: () => { setConfirm(null); ejecutarDrop(id, puntas, arg) },
        onCancel:  () => { setConfirm(null); arg.revert() },
      })
      return
    }

    // Sin updated_at — drag & drop no requiere chequeo de concurrencia
    // FullCalendar ya movió el evento visualmente — solo sincronizar con servidor
    ejecutarDrop(id, puntas, arg)
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

  async function ejecutarDrop(id: string, puntas: PuntasDelMovimiento, arg: EventDropArg | EventResizeDoneArg) {
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
      body:    JSON.stringify({ ...puntas, client_id: firmarEscritura() }),
    })
    // A1.5a: arrastre y redimensionado, salga bien o se revierta.
    vaciarCacheCitas()

    if (!res.ok) {
      arg.revert()
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
    if (aviso) {
      setConfirm({
        message: aviso,
        onConfirm: () => { setConfirm(null); ejecutarDrop(id, { start_time, end_time }, arg) },
        onCancel:  () => { setConfirm(null); arg.revert() },
      })
      return
    }

    ejecutarDrop(id, { start_time, end_time }, arg)
  }

  /* El paciente tal como lo necesita el modal de invitación. Sale SIEMPRE de la
     cita guardada, nunca del formulario: invitar es un `patch` sobre el evento
     de Google, que refleja la cita tal como está en la base. */
  function pacienteParaInvitacion(cita: Partial<Appointment>) {
    return cita.pacientes
      ? {
          id: cita.pacientes.id,
          nombre: `${cita.pacientes.nombre} ${cita.pacientes.apellidos}`,
          correoFicha: cita.pacientes.email?.trim() || null,
        }
      : null
  }

  async function handleSave(data: DatosGuardado) {
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
    toast.success(isEdit ? 'Cambios guardados' : 'Se agendó correctamente')
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
        optimisticEvent = api.addEvent({ ...buildEventInput(data), editable: false }, FUENTE_APPOINTMENTS)
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
      const { error, message } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(message || error || 'No se pudo guardar')
      return
    }

    const json = await res.json()

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
      optimisticEvent?.remove()
      const yaPresente = api?.getEventById(json.appointment.id)
      if (yaPresente) {
        aplicarAppointmentAlEvento(json.appointment)
      } else {
        api?.addEvent(buildEventInput({ ...data, ...json.appointment }), FUENTE_APPOINTMENTS)
      }
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
    const api = calendarRef.current?.getApi()
    const existing = api?.getEventById(id)
    existing?.remove()

    vaciarCacheCitas() // A1.5a: también al salir; ver `ejecutarDrop`.
    const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    vaciarCacheCitas() // A1.5a: baja, y antes del `refetch()` de su rollback.
    if (!res.ok) {
      // Rollback: restaurar estado desde servidor
      refetch()
      toast.error('No se pudo eliminar')
    }
  }

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
    api.select(new Date(base + t.desde * 60_000), new Date(base + t.hasta * 60_000))
  }

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
  function alCambiarFechas(arg: DatesSetArg) {
    setCurrentView(arg.view.type)
    setTituloVista(arg.view.title)
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

  function alCambiarEventos(eventos: EventApi[]) {
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
    <div className="agenda-raiz flex flex-col h-[calc(100dvh-88px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-64px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]">

      {/* ── Header ──────────────────────────────────────── */}
      {/* ⚠️ EL ENCABEZADO DE ESCRITORIO SE ENVUELVE, NO SE TOCA POR DENTRO. Por
          debajo de `ANCHO_MOVIL` lo sustituye `BandaMovil`, que es otra cosa —
          navy, cuatro filas, controles de 44 px— y no una versión estrecha de
          esto. Las 260 líneas de aquí dentro quedan exactamente como estaban:
          sus peldaños `2xl`, su tope de 240 px del selector y sus notas siguen
          hablando de anchos de escritorio, que es lo único donde se ven. */}
      {!isMobile && (
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Agenda</h1>
          {/* El conteo es de LO QUE LA VISTA PINTA, así que sale solo del rango
              activo y no hace falta condicionarlo por vista: en Mes cuenta el
              mes, en Semana la semana y en Día el día. Ver `contarVisibles`. */}
          {/* ── ⚠️ ESTE SUBTÍTULO NO PUEDE ENVOLVER, Y POR ESO LA FRASE SE VA ──
              La barra lateral es fija y se lleva 256 px, así que en un portátil
              con la ventana maximizada (1280 px) a la agenda le quedan 1024. A
              ese ancho «Gestión de citas clínicas · 1 cita · 1 evento» caía a
              dos líneas él solo y empujaba la fila entera a tres.

              De las dos mitades, la que se va es la frase: es decorativa y dice
              lo que el `<h1>` de arriba y la propia rejilla ya dicen. El conteo
              no, que es dato y cambia al navegar. Por eso la frase sólo aparece
              de `2xl` (1536 px de viewport = 1280 útiles) en adelante.

              ⚠️ EL `2xl` ES DE VIEWPORT Y EL ANCHO QUE IMPORTA ES EL ÚTIL: hay
              256 px de diferencia entre los dos y Tailwind no sabe de la barra
              lateral. Mismo desfase que en «Compactar» y «Horario», y por eso
              los tres usan el mismo peldaño: si se toca uno, se tocan los tres.

              Sin conteo (rango vacío) la frase se queda pase lo que pase: es
              eso o un subtítulo en blanco, que además encogería el bloque y
              haría saltar el alto del header al navegar. */}
          <p className="text-sm text-[#86868b] mt-0.5 whitespace-nowrap">
            <span className={resumenConteo ? 'hidden 2xl:inline' : undefined}>Gestión de citas clínicas</span>
            {resumenConteo && (
              <>
                <span className="hidden 2xl:inline"> · </span>
                {resumenConteo}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Segmented control de vistas. Sincronizado con la vista real vía
              `datesSet`.

              ⚠️ YA NO LLEVA `!isMobile`, Y ERA LO QUE DEJABA AL TELÉFONO CON UNA
              SOLA VISTA. El control se escondía en móvil porque el efecto del
              ancho forzaba Día y no había nada que elegir; retirada esa
              imposición, esconderlo dejaba al médico encerrado en el periodo con
              el que hubiera entrado, sin ninguna puerta. Ahora las tres se
              alcanzan desde el teléfono.

              ⚠️ SE APRIETA EN ANCHOS DE MÓVIL, Y ES ESPERADO. Este control vive
              en el header de escritorio, que en móvil sustituye la banda azul de
              un bloque posterior. Hasta entonces comparte fila con el resto y la
              fila envuelve. No lo escondas otra vez «mientras tanto»: eso es
              volver a la vista única. */}
          <div
            role="tablist"
            aria-label="Vista del calendario"
            className="inline-flex"
            /* El radio de la pista SALE del de la pastilla: radio exterior =
               interior + padding es la regla geométrica que evita que las
               esquinas se vean pellizcadas. Derivado, no un número nuevo. */
            style={{ background: 'var(--ag-segment-bg)', borderRadius: 'calc(var(--ag-r-btn) + 3px)', padding: 3, gap: 2 }}
          >
            {VIEWS.map(v => {
              /* ⚠️ EL SEGMENTO NOMBRA UN PERIODO, NO UNA VISTA, Y POR ESO
                 TRADUCE. `VIEWS` guarda el tipo ANCHO de cada uno —es la lista
                 del segmentado desde el bloque 4 y no se toca—, así que en un
                 teléfono «Semana» tiene que apuntar a `listWeek` y no a
                 `timeGridWeek`. Sin esta línea pasaban las dos cosas a la vez:
                 ningún segmento se veía activo, porque `currentView` valía
                 `listWeek` y aquí se comparaba contra `timeGridWeek`; y pulsarlo
                 metía la rejilla de siete columnas en 390 px, que es justo lo
                 que las listas vienen a evitar.
                 Es el mismo `vistaEnElOtroFormato` del efecto del ancho, y tiene
                 que serlo: dos tablas de parejas divergen. */
              const tipo = vistaEnElOtroFormato(v.type, isMobile)
              const active = currentView === tipo
              return (
                <button
                  key={v.type}
                  role="tab"
                  aria-selected={active}
                  onClick={() => cambiarVista(tipo)}
                  className={`inline-flex items-center transition-all ${active ? '' : 'hover:opacity-70'}`}
                  style={{
                    border: 'none', cursor: 'pointer', borderRadius: 'var(--ag-r-btn)', padding: '6px 13px',
                    fontSize: 12.5, fontWeight: active ? 700 : 600,
                    ...(active
                      ? { background: 'var(--ag-segment-active-bg)', color: 'var(--ag-segment-active-text)', boxShadow: 'var(--ag-segment-active-shadow)' }
                      : { background: 'transparent', color: 'var(--ag-segment-text)' }),
                  }}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
          {/* ⚠️ EL RADIO DE ESTOS CINCO CONTROLES SALE DE `--ag-r-btn` (10 px) Y NO
              DE LA ESCALA DE TAILWIND. Eran `rounded-xl`, que son 12. El token
              lo fija el spec del rediseño (§1.3) y su familia está declarada en
              globals.css con lo que significa cada peldaño; si necesitas un
              radio aquí, elige el papel del elemento y no el número.
              Los que quedan en `rounded-xl` en este archivo son los del MODAL,
              que están fuera de este alcance. */}
          {/* ── COMPACTAR ─────────────────────────────────────────────────
              ⚠️ ESTA NOTA DECÍA «en móvil la vista es de un solo día», Y CADUCÓ
              CON EL BLOQUE 6. El teléfono ya no impone Día: conserva el periodo
              y cambia de formato, así que en móvil se puede estar en Mes. El
              control existe también allí — lo pinta la banda azul, no esta fila.
              Lo que decide hoy es la VISTA y sólo la vista: rejilla (los dos
              ejes) o Mes (sólo columnas). Ver `vistaAdmiteCompactar`. */}
          {!isMobile && vistaAdmiteCompactar(currentView) && (
            <button
              type="button"
              onClick={() => setCompactar(v => !v)}
              aria-pressed={compactar}
              /* ⚠️ EL RÓTULO DEPENDE DE LA VISTA. En Mes no hay rejilla ni
                 horario que nombrar: lo único que se pliega son las columnas de
                 los días sin nada dentro. Decirlo igual que en Semana prometería
                 un recorte de horas que esa vista no puede hacer. */
              aria-label={etiquetaCompactar(currentView)}
              title={etiquetaCompactar(currentView)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-medium transition-colors"
              /* ENCENDIDO SE MARCA CON EL BORDE, NO CON RELLENO. Compartía los
                 tokens del segmentado activo, o sea que se pintaba como un
                 segmento seleccionado: dos controles distintos con el mismo
                 tratamiento, y el ojo leía «Compactar» como una cuarta vista.
                 Ahora el relleno sólido es del segmentado y sólo de él; esto es
                 un interruptor, y un interruptor encendido se dice con el marco.
                 Sin sombra: la superficie no se levanta, se enmarca. */
              style={compactar
                ? {
                    background: 'var(--ag-surface)',
                    /* `--ag-brand-legible` y NO `--ag-brand-secondary`: la marca
                       cruda sobre la superficie oscura da 2.24:1. Ver su nota. */
                    color: 'var(--ag-brand-legible)',
                    border: '1px solid var(--ag-brand-legible)',
                  }
                : {
                    background: 'var(--ag-surface)',
                    color: 'var(--ag-text)',
                    border: '1px solid var(--ag-border-card)',
                  }}
            >
              <ChevronsDownUp size={15} />
              {/* ⚠️  `2xl`, NO `xl` NI `sm`. Y el peldaño NO se elige por cómo
                  se ve el botón suelto: se elige por si la FILA ENTERA cabe en
                  una línea, que es lo que se rompía.

                  El desfase que hay que tener en la cabeza: la barra lateral es
                  fija y se lleva 256 px, así que un portátil maximizado (1280 de
                  viewport, o sea `xl`) le deja a la agenda 1024 útiles. Con `xl`
                  la etiqueta aparecía justo ahí, que es el ancho donde no cabe.
                  `2xl` (1536 de viewport) son 1280 útiles, y ahí sí.

                  Por debajo manda el icono, que es lo que este botón tiene de
                  suyo: `aria-label` y `title` dicen lo mismo que la etiqueta y
                  no dependen del ancho. Hermanos de peldaño: la etiqueta de
                  «Horario» y la frase del subtítulo. Los tres se mueven a la
                  vez o el header vuelve a envolver. */}
              <span className="hidden 2xl:inline">Compactar</span>
            </button>
          )}
          {/* Filtro por médico — solo en modo multi-doctor */}
          {!isSingleDoctor && (
            <div className="relative">
              {/* ── ⚠️ EL TOPE DE 240 px ES LO QUE IMPIDE QUE ESTE CONTROL VUELVA A
                  TIRAR LA FILA A DOS LÍNEAS, Y EL NÚMERO ESTÁ MEDIDO ──────────
                  Un `<select>` se dimensiona por su OPCIÓN MÁS ANCHA, no por la
                  seleccionada. O sea que es el único control del header cuyo
                  ancho lo decide el contenido de la clínica y no el diseño: una
                  clínica con «Dra. María Guadalupe Hernández Villaseñor» en la
                  lista arrastra la fila entera aunque el filtro esté en «Todos
                  los médicos».

                  El caso peor NO es el ancho más estrecho, que es lo que
                  engaña: es `2xl` (1280 px útiles), donde las etiquetas de
                  «Compactar» y «Horario» vuelven y el subtítulo recupera su
                  frase. Medido ahí, con el subtítulo largo («128 citas · 34
                  eventos · 12 de Google»), la fila tenía 85 px de holgura sobre
                  un `<select>` de 226. Es decir: envuelve pasando de 311 px.
                  A 1024 útiles la holgura es de 135, así que ese ancho NO es el
                  que manda. Si vuelves a medir, mide a `2xl`.

                  240 se eligió por encima de los 226 de hoy —así que con los
                  datos actuales no recorta nada— y 71 px por debajo del punto de
                  ruptura, que es el margen que se le deja al día que cambie la
                  tipografía, el padding o el texto del subtítulo.

                  ⚠️ NO LO SUBAS PARA QUE «QUEPA UN NOMBRE LARGO». Ese es el
                  trabajo del desplegable: el `<option>` no está capado y enseña
                  el nombre completo, así que la elipsis no esconde información,
                  sólo la aplaza un clic. */}
              {/* ⚠️ `filtroEfectivo` Y NO `filtroMedico`: el desplegable tiene
                  que ENSEÑAR el filtro que salió en la petición, incluido el que
                  puso la semilla del rol. Con `filtroMedico` diría «Todos los
                  médicos» sobre una agenda filtrada — la mentira exacta que los
                  bloques anteriores persiguen, y aquí encima con el arreglo al
                  lado. El `?? ''` es porque un `<select>` con `value={null}`
                  deja de ser controlado. */}
              <select
                value={filtroEfectivo ?? ''}
                /* Por `aplicarFiltro` y no por `setFiltroMedico`: además del
                   estado hay que mover el espejo síncrono y, sobre todo, BORRAR
                   la marca de forzado — esto es una elección de una persona, y
                   desde aquí el médico deja de ser reversible. */
                onChange={e => aplicarFiltro(e.target.value, false)}
                className="appearance-none max-w-[240px] truncate pl-3 pr-9 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
              >
                <option value="" disabled={mesSinTodos}>{OPCION_TODOS(mesSinTodos)}</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ag-muted)]"
              />
            </div>
          )}
          {canEditHorario && (
            <button
              onClick={() => setHorarioOpen(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-medium transition-colors bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
              /* El `aria-label` se añadió AL ESCONDER LA ETIQUETA: por debajo de
                 `2xl` este botón es sólo un engranaje, y sin él su nombre
                 accesible dependía del `title`, que es el último recurso del
                 algoritmo de nombre y no todos los lectores lo anuncian igual. */
              aria-label="Configurar horario de consulta"
              title="Configurar horario de consulta"
            >
              <Settings size={15} />
              {/* `2xl` por lo mismo que «Compactar» —ver su nota—: `sm` mostraba
                  la etiqueta desde 640 px, o sea prácticamente siempre, y estos
                  ~60 px eran parte de lo que tiraba la fila a la línea de
                  abajo. El `title` de arriba es lo que queda diciéndolo. */}
              <span className="hidden 2xl:inline">Horario</span>
            </button>
          )}
          {/* ── UNA PUERTA, Y EL TIPO SE ELIGE DENTRO ──────────────────────
              Aquí hubo DOS botones —«Nuevo evento» y «Nueva cita»—, cada uno
              abriendo el modal con su tipo. El comentario que los defendía decía
              que «el tipo se elige al entrar y ya no se cambia, así que la
              puerta ES la elección». Eso era verdad mientras el alta no tuvo
              ningún control de tipo, y dejó de serlo el 2026-08-22, cuando se le
              puso arriba uno de dos posiciones (`TIPOS_ALTA`) porque quien entra
              pulsando un hueco —la vía más usada— no tenía forma de cambiar de
              idea sin cerrar y volver por la otra puerta.

              Desde entonces las dos puertas llevaban al mismo sitio y la de
              «Nuevo evento» sólo preseleccionaba lo que el conmutador ya hace en
              un clic. Se retira: costaba ~134 px de una fila que a 1024 px
              útiles envolvía a tres líneas y se comía un tercio del alto de la
              rejilla. Lo que se pierde es un atajo; lo que se gana es la agenda.

              ⚠️ NO LA REPONGAS «PARA QUE SE VEA QUE SE PUEDEN CREAR EVENTOS».
              Si eso no se ve, el sitio donde arreglarlo es el conmutador del
              modal, no el header.

              LO QUE DE AQUEL COMENTARIO SIGUE SIENDO CIERTO:

              · **En EDICIÓN el tipo no se puede cambiar, y no es un olvido.**
                Convertir una cita en evento sería quitarle el paciente por una
                puerta lateral, y eso se parece demasiado a un borrado (§12.18,
                y la nota larga de `TipoFila`). Ese motivo presupone UNA FILA QUE
                YA EXISTE; en el alta no la hay, así que el conmutador no
                convierte nada: elige qué se va a crear. Por eso hay control en
                el alta y no en la edición.

              · **Pulsar un hueco y arrastrar sobre el calendario siguen
                abriendo CITA**, que es lo que espera quien hace ese gesto. Este
                botón hace lo mismo, por lo mismo: agendar es lo que la agenda
                hace todo el día.

              ⚠️ EL TEXTO NO PUEDE DECIR «NUEVA CITA», que es lo que decía. Ya no
              describe lo que abre —un modal que también crea eventos— y sería la
              única pista de que el conmutador existe apuntando en la dirección
              contraria. «Agendar» es el verbo que cubre las dos cosas y de paso
              ocupa menos. El `title` dice el resto. */}
          <button
            onClick={() => {
              if (subState.isBlocked) { openBloqueoModal(); return }
              /* El botón sí aporta hora: la de ahora. Es una de las cuatro
                 rutas que NO cambian con la hora vacía de la vista Mes. */
              const { fecha, hora } = partirFechaHora(new Date().toISOString())
              setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no' })
            }}
            /* A2.6: red de seguridad de la precarga en ocioso — si el puntero
               pasa por aquí o el teclado llega por Tab antes de que el
               ocioso dispare, el chunk del modal ya va en camino al pulsar. */
            onMouseEnter={precargarModalesAgenda}
            onFocus={precargarModalesAgenda}
            data-onboard="nueva-cita"
            title="Nueva cita o evento — el tipo se elige arriba del modal"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--ag-r-btn)] text-sm font-semibold text-white transition-all shadow-sm hover:brightness-95 bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
          >
            <Plus size={15} />
            Agendar
          </button>
        </div>
      </div>
      )}

      {isMobile && (
        <BandaMovil
          conteo={resumenConteoBreve}
          vistaActual={currentView}
          onVista={tipo => cambiarVista(tipo)}
          titulo={tituloVista}
          onPrev={() => calendarRef.current?.getApi().prev()}
          onNext={() => calendarRef.current?.getApi().next()}
          onMenu={abrirMenu}
          medicos={medicos}
          filtroMedico={filtroEfectivo ?? ''}
          mesSinTodos={mesSinTodos}
          /* Misma puerta que el desplegable de escritorio: elección a mano, así
             que sin marca de forzado. Ver `aplicarFiltro`. */
          onFiltroMedico={id => aplicarFiltro(id, false)}
          /* `null` y no un booleano: es el manejador o no hay botón. Misma
             condición que el de escritorio (`canEditHorario`). */
          onHorario={canEditHorario ? () => setHorarioOpen(true) : null}
          /* Misma forma y misma pregunta que el de escritorio: en móvil las dos
             vistas que `vistaAdmiteCompactar` acepta se reducen a Mes, porque
             Semana y Día son listas aquí. */
          onCompactar={vistaAdmiteCompactar(currentView) ? () => setCompactar(v => !v) : null}
          compactado={compactar}
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
        {/* ── Leyenda ───────────────────────────────────────────────────
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
        {(!isMobile || currentView === 'listDay') && (
        <div className="ag-leyenda">
          {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                /* UN token y un solo color: `-dot`, que es exactamente el que la
                   tarjeta pinta en su `borderLeft`. Aquí hubo un cuadrado que
                   mezclaba relleno de `-bg` con barra de `-dot` —dos colores
                   para nombrar uno— y de lejos se leía el relleno pálido.
                   Nunca un hex: hubo una segunda paleta a mano y enseñaba «No
                   asistió» en naranja mientras la tarjeta lo pintaba gris. */
                style={{ backgroundColor: `var(--ag-status-${key}-dot)` }}
              />
              <span className="text-[11px] font-medium text-[var(--ag-muted)]">{cfg.label}</span>
            </div>
          ))}
          {/* ── GOOGLE VA APARTE, DETRÁS DE UNA BARRA ─────────────────────
              Y no como un sexto estado. `STATUS_CONFIG` es `Record<Status, …>`
              y ahí no cabe: un evento de Google no tiene estado de cita, viene
              de otro sitio y no se edita. Meterlo dentro obligaría a ensanchar
              `Status`, que es el tipo del que cuelgan el selector del modal, los
              tokens de color y la exhaustividad que garantiza el compilador. La
              barra dice justo eso: lo de la izquierda es una escala, esto no. */}
          <span aria-hidden className="text-[11px] text-[var(--ag-faint)]">|</span>
          <div className="flex items-center gap-1.5">
            <GoogleGIcon size={11} />
            {/* ── «GCal» Y NO «GOOGLE CALENDAR», POR ANCHO ─────────────────
                Medido el 2026-08-25 a 1280 px de ventana, con la tarjeta a 954
                px de interior: la leyenda pedía 542 px para caber en UNA línea y
                su celda le daba 453,46, así que envolvía a dos y subía el
                toolbar de 60,32 a 74 px. Acortar este rótulo se lleva 63 de esos
                px —de 542 a 479—, que es el recorte más grande que se puede
                hacer sin tocar los cinco rótulos de estado.

                ⚠️ SOLO NO BASTABA: con 479 contra 453,46 seguían faltando 25,54
                y la leyenda seguía en dos líneas. Lo que cerró el hueco fue
                encoger la ETIQUETA DE FECHA —formato corto y 15 px en vez de
                22—, que le devolvió 153,24 px a aquella celda.

                ⚠️ ESA CUENTA CADUCÓ EN EL BLOQUE 8, y lo que queda de ella es el
                orden de magnitud, no el margen. La leyenda ya no comparte fila con
                la fecha: tiene fila propia y dispone del ancho entero de la
                tarjeta menos los 36 px de su relleno, así que la etiqueta de fecha
                salió de esta ecuación y reponerla larga ya no la estrecha.
                Quien la estrecha ahora es el PANEL de la vista Día, que se lleva
                los 300 px del riel más 14 de `gap`: sobre los 954 px de interior
                medidos a 1280 de ventana quedan ~640, o ~604 para el contenido.
                Ahí los 479 de «GCal» entran con holgura; por debajo de ~1155 px
                de ventana, con el panel abierto, ya no —esa cuenta está en
                `globals.css`, en el bloque del reparto de la tarjeta—. El rótulo
                corto se queda porque no cuesta nada y porque es lo que empuja ese
                umbral hacia abajo. Si lo alargas, mide CON EL PANEL PUESTO, que es
                el caso estrecho.

                ⚠️ EL NOMBRE COMPLETO SIGUE ACCESIBLE en el `title`: la
                abreviatura es visual, no semántica, y un lector de pantalla no
                tiene por qué deletrear «GCal». */}
            <span
              className="text-[11px] font-medium text-[var(--ag-gcal-text)]"
              title="Google Calendar"
            >
              GCal
            </span>
          </div>
        </div>
        )}
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
        <div className="ag-avisos">
          {/* La barra de 2 px de §11. Cae justo ENCIMA de la rejilla y no pegada
              al toolbar, y es consecuencia de dónde vive el envoltorio: entre
              medias está la fila de la leyenda, que es cromo de la tarjeta desde
              el bloque 8. Marca el borde de lo que está cargando, que es lo que
              se quería decir.
              `aria-hidden` porque una raya no se lee; lo que declara el estado a
              las ayudas técnicas es el `aria-busy` de la tarjeta. */}
          {cargaVisible && <span className="ag-barra-carga" aria-hidden />}

          {/* 1 · Error de carga. «Reintentar» llama al MISMO `refetch()` que usan
              el cambio de filtro, la reconexión y la vuelta a la pestaña: una
              sola puerta de recarga, y con el candado de arrastre incluido. */}
          {errorCitas && (
            <Banda tono="error" urgente>
              <TriangleAlert size={14} className="ag-aviso-icono" aria-hidden />
              <p className="ag-aviso-texto">
                <strong>No se pudo cargar la agenda.</strong> Lo que se ve puede estar incompleto o desactualizado.
              </p>
              <button type="button" className="ag-aviso-accion" onClick={() => refetch(true)}>
                Reintentar
              </button>
            </Banda>
          )}

          {/* 1 bis · La traída llegó ENTERA de forma y RECORTADA de fondo.
              ⚠️ COMPARTE EL TONO ROJO CON LA DE ARRIBA Y NO ES PEREZA. Sólo hay
              tres tonos (`ag-aviso--error|gcal|vacio`) y estrenar un cuarto
              pediría un par de tokens nuevos en las DOS paletas de globals.css
              para una distinción que el ojo no necesita: las dos bandas dicen
              «lo que ves no es la agenda», y no pueden coincidir en pantalla
              —una se escribe en el éxito y la otra en el catch—, así que el rojo
              nunca significa dos cosas a la vez. Lo que las separa es el TEXTO,
              que es donde estaba la diferencia de verdad: aquélla dice que no se
              pudo cargar; ésta, que sí se cargó y aun así falta.
              `urgente` (role="alert") por la misma razón que la otra, y aquí
              todavía más literal: los huecos que faltan se ven LIBRES, y sobre
              un hueco libre se agenda encima de una cita que existe.
              SIN «Reintentar»: la misma consulta devolvería las mismas mil
              filas. La salida es pedir MENOS RANGO, y eso es lo que ofrece el
              botón — sólo desde Mes, que es de donde se sale; ya en Semana no
              hay a dónde acortar y la banda se queda sin acción, que es más
              honesto que un botón que no cambia nada. */}
          {citasIncompletas && (
            <Banda tono="error" urgente>
              <TriangleAlert size={14} className="ag-aviso-icono" aria-hidden />
              <p className="ag-aviso-texto">
                <strong>Faltan citas por mostrar.</strong> Este periodo tiene más citas de las que caben en una carga; lo que ves está incompleto.
              </p>
              {/* `dayGridMonth` a secas y sin helper: el Mes es la ÚNICA vista
                  que vale lo mismo ancha que estrecha (`FORMATOS_DE_VISTA`), así
                  que aquí no hay pareja que resolver. */}
              {currentView === 'dayGridMonth' && (
                <button
                  type="button"
                  className="ag-aviso-accion"
                  onClick={() => {
                    /* Por `vistaEnElOtroFormato` y no con la cadena a mano: en un
                       teléfono la Semana es `listWeek`, y `changeView` lanza con
                       una vista que no se ha registrado. Es el mismo camino que
                       usan el segmentado y la banda móvil.
                       Y por `cambiarVista` y no por `changeView` a pelo: es lo
                       que hace que este botón PIDA la semana en vez de heredar
                       el recorte del mes. Sin eso no recuperaba nada — ver su
                       cabecera. */
                    cambiarVista(vistaEnElOtroFormato('timeGridWeek', isMobile))
                  }}
                >
                  Ver por semana
                </button>
              )}
            </Banda>
          )}

          {/* 2 · Fallo de Google. SIN «Reintentar» a propósito: reintentar no
              arregla una credencial ni una cuota, y un botón que casi siempre
              falla enseña a ignorarlo. La salida es /perfil, que es donde se
              reconecta de verdad. */}
          {googleFallo && (
            <Banda tono="gcal">
              <GoogleGIcon size={14} />
              <p className="ag-aviso-texto">
                <strong>No se pudo sincronizar con Google Calendar.</strong> Tus citas se muestran normal; faltan los eventos del calendario.
              </p>
              <Link href="/perfil" className="ag-aviso-accion">Revisar conexión</Link>
            </Banda>
          )}

          {/* 3 · Vacío. Las dos frases salen del mismo cero; ver `vacioReal`. */}
          {vacioReal && (
            <Banda tono="vacio">
              <Calendar size={14} className="ag-aviso-icono" aria-hidden />
              <p className="ag-aviso-texto">
                {vacioFiltrado && medicoFiltrado
                  ? `Ningún evento de ${componerNombreMedicoCompleto(medicoFiltrado)} ${periodoVacio}`
                  : `Sin citas ${periodoVacio}`}
              </p>
              {/* «Ver todos» pasa por `aplicarFiltro`, como el desplegable: un
                  `setFiltroMedico('')` a secas dejaba `filtroSincronoRef` en el
                  médico anterior y la traída seguía filtrada (defecto hallado
                  por la red de A0). En Mes no hay «Todos» (`mesSinTodos`): ahí
                  la banda sólo informa. */}
              {vacioFiltrado ? (mesSinTodos ? null : (
                <button type="button" className="ag-aviso-accion" onClick={() => aplicarFiltro('', false)}>
                  Ver todos los médicos
                </button>
              )) : (
                /* ⚠️ DICE «AGENDAR» Y NO «NUEVA CITA», que es lo que pedía §11.
                   El botón del header se renombró a «Agendar» al montarle el
                   conmutador «Cita | Evento»: el modal ya no crea sólo citas.
                   Dos nombres para la misma puerta es peor que apartarse del
                   spec en una palabra. Y hace lo mismo que aquel botón, bloqueo
                   por suscripción incluido. */
                <button
                  type="button"
                  className="ag-aviso-accion"
                  onClick={() => {
                    if (subState.isBlocked) { openBloqueoModal(); return }
                    const { fecha, hora } = partirFechaHora(new Date().toISOString())
                    setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no' })
                  }}
                >
                  Agendar
                </button>
              )}
            </Banda>
          )}

          {/* 4 · Vista compacta. Se queda EXACTAMENTE como estaba, sólo que ahora
              dentro del envoltorio: no se migra a `Banda` porque su caja lleva su
              propia geometría y sus propias clases desde el bloque 6, y
              reescribirla para ganar tres líneas es arriesgar una que funciona. */}
          {avisoRecorte && (
            <div className="ag-banda-compacta" role="status">
              <ChevronsDownUp size={14} className="ag-banda-compacta-icono" aria-hidden />
              <p className="ag-banda-compacta-texto">
                <strong>Vista compacta:</strong> {avisoRecorte}
              </p>
              {/* SEGUNDA salida, no la única: el botón del header sigue siendo por
                  donde se enciende y también apaga. Existe porque el efecto que
                  apaga «Compactar» al salir de time-grid ya dice el principio —un
                  calendario que oculta información sin dar salida es peor que uno
                  que no la oculta— y hasta ahora la única salida estaba en la otra
                  punta de la pantalla, lejos de la frase que confiesa el recorte. */}
              <button
                type="button"
                className="ag-banda-compacta-salida"
                onClick={() => setCompactar(false)}
              >
                {compactaElMes ? 'Mostrar todos los días' : 'Mostrar rejilla completa'}
              </button>
            </div>
          )}
        </div>
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
          views={isMobile ? VISTAS_FC_MOVIL : VISTAS_FC}
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
          editable
          dragRevertDuration={200}
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
          onVerDia={() => cambiarVista(vistaEnElOtroFormato('timeGridDay', true), diaSel)}
        />
      )}

      {/* ═══ BARRA INFERIOR MÓVIL ═════════════════════════════════════════
          ⚠️ ES LA ÚNICA PUERTA PARA CREAR EN MÓVIL, y por eso es una barra fija
          y no un botón dentro del scroll. Las vistas de lista NO disparan
          `dateClick` ni `select` —`ListView` se registra como componente
          interactivo pero no implementa consulta de posición—, así que tocar una
          fila abre la cita que ya existe y tocar el hueco no hace nada. Sin esta
          barra, un teléfono no puede agendar.
          De ahí las dos propiedades que no se negocian: no depende de scroll y
          no la tapa nada. Si algún día se esconde al hacer scroll, hay que dar
          antes otra puerta.

          ⚠️ EL `onClick` ES EL MISMO QUE EL DE ESCRITORIO, LITERALMENTE. Mismo
          bloqueo por suscripción, misma hora de arranque —la de ahora— y mismo
          `tipo: 'cita'`. Dos puertas al mismo sitio tienen que hacer lo mismo;
          si una de las dos cambia, cambian las dos. */}
      {isMobile && (
        <div className="ag-barra-movil">
          <button
            type="button"
            className="ag-barra-movil-cta"
            data-onboard="nueva-cita-movil"
            onClick={() => {
              if (subState.isBlocked) { openBloqueoModal(); return }
              const { fecha, hora } = partirFechaHora(new Date().toISOString())
              setModal({ mode: 'create', fecha, hora, tipo: 'cita', todoElDia: 'no' })
            }}
            /* A2.6: misma red de seguridad que el botón de escritorio — ver
               su comentario. En táctil no hay `onMouseEnter`, pero no estorba
               dejarlo por si algún día se navega esta barra con teclado. */
            onMouseEnter={precargarModalesAgenda}
            onFocus={precargarModalesAgenda}
          >
            <Plus size={19} />
            Agendar
          </button>
        </div>
      )}

      {/* ── Modal cita ──────────────────────────────────── */}
      {modal.mode !== 'closed' && (
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
          key={modal.mode === 'create' ? modal.tipo : modal.appointment.id}
          modal={modal}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
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
      {confirm && <ConfirmModal {...confirm} />}

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
                toast.error('No se pudo guardar el horario')
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
