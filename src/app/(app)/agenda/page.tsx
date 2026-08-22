'use client'

import { useEffect, useRef, useState, useCallback, useMemo, memo, type CSSProperties } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import { EventClickArg, EventDropArg, DateSelectArg, EventInput, EventContentArg, DayHeaderContentArg } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { X, Calendar, User, Plus, Trash2, Settings, LayoutGrid, Columns3, Square, ChevronDown, FileText, Stethoscope, Loader2, Mail,
         CalendarPlus, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useToast } from '@/components/ui/Toast'
import { useProfile } from '@/hooks/useProfile'
import { canManageClinica, canVerAgendaCompleta } from '@/lib/permissions'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import ModalInvitacionCita from '@/components/agenda/ModalInvitacionCita'
import Portal from '@/components/ui/Portal'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultoriosDeMedico } from '@/hooks/useConsultoriosDeMedico'
import { componerNombreMedicoCompleto, componerInicialesMedico } from '@/lib/nombreMedico'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'
import { ICONOS_EVENTO, COLORES_EVENTO, type IconoEvento, type ColorEvento } from '@/lib/appointments'
import useSWR from 'swr'
import {
  CLAVE_CONFIG,
  CONFIG_DEDUPE_MS,
  fetcherConfig,
  type ConfigApp,
  type DiaSemana,
  type Horario,
  type MedicoConfig,
} from '@/lib/configApp'

/* ─── Tipos ────────────────────────────────────────────── */

/* `attended` (plan §12.13). Lo escribe el servidor al crear la nota clínica que
   salió de la cita, y también se puede poner a mano en el selector de abajo.

   ⚠️ AÑADIR UN ESTADO AQUÍ ROMPE `STATUS_CONFIG` en compilación —es un
   `Record<Status, …>`— pero NO rompe los tokens CSS, que se consumen por
   interpolación (`var(--ag-status-${status}-dot)`). Si faltan los cuatro tokens
   del estado nuevo en globals.css, la tarjeta sale transparente y sin borde, sin
   un solo error. Los de `attended` están puestos, en claro y en oscuro. */
type Status = 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'attended'

type Appointment = {
  id: string
  title: string
  start_time: string
  end_time: string
  status: Status
  notes: string | null
  paciente_id: string | null
  medico_id: string | null
  google_event_id: string | null
  gcal_sync_status: 'synced' | 'pending' | 'failed' | 'unbound'
  updated_at: string
  // F3-6: snapshots de consultorio (persistidos en POST/PUT, devueltos en GET).
  consultorio_id: string | null
  consultorio_nombre: string | null
  consultorio_nombre_corto: string | null
  consultorio_direccion: string | null
  consultorio_telefono: string | null
  consultorio_timezone: string | null
  /* La pinta del evento genérico sin paciente (§12.14). Una CITA no lleva
     ninguna de las dos y ahí NULL es lo corriente, no una carencia. */
  icono: IconoEvento | null
  color: ColorEvento | null
  /* `email` viaja desde `APPOINTMENT_SELECT` para un solo consumidor: el botón
     de invitación. Que esté aquí es lo que evita una petición por cita abierta
     sólo para saber si la ficha tiene correo.

     OPCIONAL, y no por comodidad: la actualización optimista de `handleSave`
     mete aquí el `PacienteBusqueda` que devuelve el buscador, que NO trae
     correo porque su endpoint no lo selecciona. Ese hueco dura lo que tarda la
     respuesta del PUT —que trae la fila canónica y la pisa vía
     `aplicarAppointmentAlEvento`— y encima ocurre con el modal ya cerrado. */
  pacientes?: { id: string; nombre: string; apellidos: string; telefono: string | null; email?: string | null } | null
  medico?: { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null } | null
}

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

type PacienteBusqueda = { id: string; nombre: string; apellidos: string; telefono: string | null }

type Medico = { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null; especialidad?: string | null }

/* Constante de módulo, no `[]` en línea: un array nuevo por render cambiaría
   la identidad de `inicialesDeCita` y con ella la de `eventContent`, que
   FullCalendar usa para decidir si repintar las tarjetas. */
const SIN_MEDICOS: MedicoConfig[] = []

/* `tipo` sólo existe al CREAR, y es deliberado (§12.14, decisión D5).
 *
 * ── POR QUÉ EL TIPO SE FIJA AL CREAR Y NO SE PUEDE CAMBIAR DESPUÉS ──────────
 * En edición no hay `tipo` que elegir: se deduce de si la fila tiene paciente.
 * Convertir una cita en evento sería QUITARLE EL PACIENTE, y esa puerta ya está
 * cerrada por §12.18 — quitar el paciente **es** borrar la cita, con su alerta
 * delante. Un selector mutable la reabriría por el lado, sin alerta y sin que
 * se pareciera a un borrado.
 *
 * Al revés tampoco: un evento nació sin paciente, y ligarle uno es rozar el
 * «camino de vuelta» que §12.2 deja fuera de alcance.
 */
type TipoFila = 'cita' | 'evento'

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; start: string; end: string; tipo: TipoFila }
  | { mode: 'edit';   appointment: Appointment }

/* ─── Colores por estado ───────────────────────────────── */

/* SÓLO EL NOMBRE VISIBLE DE CADA ESTADO. El color NO está aquí y no debe
   volver: este mapa llegó a tener `bg`/`text`/`dot` con clases de Tailwind que
   ya nadie leía —el color salía de los tokens— y lo único que hacían era estar
   a mano para que alguien los usara por error y estrenara una tercera paleta.
   Ver el aviso de arriba, donde estaba `STATUS_STYLE`. */
const STATUS_CONFIG: Record<Status, { label: string }> = {
  scheduled:  { label: 'Agendada'   },
  confirmed:  { label: 'Confirmada' },
  cancelled:  { label: 'Cancelada'  },
  no_show:    { label: 'No asistió' },
  attended:   { label: 'Atendida'   },
}

/* Los estados que el usuario puede elegir A MANO, por tipo de fila (§12.13, D5).
   Una CITA los enseña los cinco. Un EVENTO GENÉRICO sólo dos: «No asistió» o
   «Atendida» no significan nada sobre una junta de personal, y ofrecerlos sería
   fingir que sí. El orden es el de `STATUS_CONFIG`, que es el que el selector
   pintaba antes de que hubiera dos listas. */
const ESTADOS_CITA:   readonly Status[] = ['scheduled', 'confirmed', 'cancelled', 'no_show', 'attended']
const ESTADOS_EVENTO: readonly Status[] = ['scheduled', 'cancelled']

/* ⚠️ AQUÍ VIVÍA `STATUS_STYLE`, UNA SEGUNDA PALETA DE ESTADO. NO LA REPONGAS.
 *
 * Era un `Record<Status, {bg,text,border}>` de hexes a mano, y durante meses
 * convivió con los tokens `--ag-status-*` de globals.css sin que nadie notara
 * que habían DIVERGIDO en cuatro de los cinco estados. La peor: «no asistió»
 * era naranja (#f97316) aquí y gris (#64748b) en los tokens, así que la leyenda
 * de la agenda llevaba tiempo prometiendo un color que la tarjeta no pintaba.
 * `attended` era el único que coincidía, y sólo porque nació cuando las dos
 * paletas ya estaban puestas.
 *
 * El color de estado sale HOY de los tokens y de ningún otro sitio. Si te hace
 * falta un color de estado, interpola el token (`var(--ag-status-${s}-bg)`);
 * no escribas un hex.
 *
 * ⚠️ SI ALGÚN DÍA SE ROTA LA ASIGNACIÓN DE COLORES (p. ej. ámbar→agendada,
 * azul→confirmada), `src/components/agenda/ModalInvitacionCita.tsx` SE REPINTA
 * SIN QUERERLO: usa estos mismos tokens como paleta SEMÁNTICA —`no_show` como
 * gris de advertencia, `confirmed` como verde de acuse, `cancelled` como rojo
 * de error—, y ninguno de esos paneles habla del estado de una cita. Hay que
 * desengancharlo ANTES de rotar, no después.
 */

/* ─── La pinta del evento genérico ──────────────────────
 *
 * Los VALORES de las dos listas viven en `@/lib/appointments`, junto al
 * validador que usan las rutas: si la lista viviera aquí, el servidor no la
 * conocería y su validación sería decorativa. Lo que hay en este archivo es lo
 * que sólo la interfaz necesita — cómo se dibuja cada icono y cómo se llama.
 *
 * ⚠️⚠️ LEE ESTO ANTES DE AÑADIR UN ICONO: EL COMPILADOR YA NO TE CUBRE ENTERO.
 * Los iconos eran componentes de `lucide-react` y el mapa era un
 * `Record<IconoEvento, LucideIcon>`, así que olvidarse de uno era un error de
 * compilación. Ahora son ARCHIVOS SVG de `/public/icons/` y la ruta se deriva
 * del propio nombre (`/icons/${nombre}.svg`), que es lo mismo que guarda la
 * base. Eso quita la duplicación —no hay tabla nombre→ruta que se desincronice—
 * pero **TypeScript no puede comprobar que el archivo exista en disco**. Un
 * nombre mal escrito en `ICONOS_EVENTO`, o un SVG que no se subió, compila sin
 * una queja, pasa la validación del servidor, pasa el CHECK de la base y sale
 * como un HUECO EN BLANCO en la agenda que nadie reporta.
 *
 * Lo mismo valdría con un `Record<IconoEvento, string>` de rutas escritas a
 * mano: comprobaría que la ENTRADA está escrita, nunca que el archivo está.
 * Esa garantía no existe en el tipo y no hay forma de fingirla.
 *
 * Lo que sí sigue siendo error de compilación es olvidar la ETIQUETA de un
 * icono o de un color: `ICONO_ETIQUETA` y `COLOR_ETIQUETA` son
 * `Record<IconoEvento|ColorEvento, string>` a propósito, no objetos sueltos.
 *
 * ⚠️ Los colores NO están aquí sino en globals.css (`--ag-evento-*`), que es
 * donde viven los de los estados — o sea con quien no pueden chocar. Se
 * consumen por interpolación, así que valen el mismo aviso que los de estado:
 * un token que falte no da error, sólo deja el evento sin color.
 */

/**
 * El icono de un evento genérico, pintado con `mask-image` sobre un color.
 *
 * POR QUÉ MÁSCARA Y NO `<img>`: los SVG traen `fill="currentColor"`, y dentro
 * de un `<img>` no hay `currentColor` que heredar — saldrían todos negros y no
 * se podrían teñir del color del evento. La máscara usa el canal alfa del
 * archivo y el color lo pone el `background` de este `<span>`, así que un mismo
 * archivo sirve para los seis colores y para los dos temas.
 *
 * Sin `color` explícito hereda `currentColor`, que es como se comportaba el
 * icono de lucide al que sustituye.
 */
function IconoDelEvento({ nombre, size, color }: { nombre: IconoEvento; size: number; color?: string }) {
  const archivo = `url(/icons/${nombre}.svg)`
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: size, height: size, flex: '0 0 auto',
        background: color ?? 'currentColor',
        WebkitMaskImage: archivo, maskImage: archivo,
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
      }}
    />
  )
}

const ICONO_ETIQUETA: Record<IconoEvento, string> = {
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

/* Las dos posiciones del control del alta. `Record<TipoFila, …>` no sirve aquí
   —hace falta el ORDEN, y la cita va primera porque es lo que la agenda hace
   todo el día—, así que la exhaustividad la da el tipo de cada `id`. */
const TIPOS_ALTA: ReadonlyArray<{ id: TipoFila; label: string; icono: LucideIcon }> = [
  { id: 'cita',   label: 'Cita',   icono: Calendar },
  { id: 'evento', label: 'Evento', icono: CalendarPlus },
]

const COLOR_ETIQUETA: Record<ColorEvento, string> = {
  indigo:  'Índigo',
  magenta: 'Magenta',
  carmin:  'Carmín',
  oliva:   'Oliva',
  bronce:  'Bronce',
  grafito: 'Grafito',
}

/** True si la fila es un evento genérico y no una cita: lo decide el paciente. */
function esEventoGenerico(apt: { paciente_id?: string | null }): boolean {
  return !apt.paciente_id
}

/* ─── Horario de consulta ──────────────────────────────── */

/* `DiaSemana`, `HorarioDia` y `Horario` viven en src/lib/configApp.ts: es el
   tipo de `clinicas.horario_consulta` tal como lo devuelve el agregado. */

const DIAS: { key: DiaSemana; label: string; fc: number }[] = [
  { key: 'lunes',     label: 'Lunes',     fc: 1 },
  { key: 'martes',    label: 'Martes',    fc: 2 },
  { key: 'miercoles', label: 'Miércoles', fc: 3 },
  { key: 'jueves',    label: 'Jueves',    fc: 4 },
  { key: 'viernes',   label: 'Viernes',   fc: 5 },
  { key: 'sabado',    label: 'Sábado',    fc: 6 },
  { key: 'domingo',   label: 'Domingo',   fc: 0 },
]

const HORARIO_DEFAULT: Horario = {
  lunes:     { activo: true,  inicio: '09:00', fin: '19:00' },
  martes:    { activo: true,  inicio: '09:00', fin: '19:00' },
  miercoles: { activo: true,  inicio: '09:00', fin: '19:00' },
  jueves:    { activo: true,  inicio: '09:00', fin: '19:00' },
  viernes:   { activo: true,  inicio: '09:00', fin: '19:00' },
  sabado:    { activo: false, inicio: '09:00', fin: '14:00' },
  domingo:   { activo: false, inicio: '09:00', fin: '14:00' },
}

function horarioToBusinessHours(h: Horario) {
  return DIAS.filter(d => h[d.key]?.activo).map(d => ({
    daysOfWeek: [d.fc],
    startTime:  h[d.key].inicio,
    endTime:    h[d.key].fin,
  }))
}

function isWithinBusinessHours(date: Date, h: Horario): boolean {
  const dia = DIAS.find(d => d.fc === date.getDay())
  if (!dia) return false
  const horarioDia = h[dia.key]
  if (!horarioDia.activo) return false
  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return hhmm >= horarioDia.inicio && hhmm < horarioDia.fin
}

/* ─── Modal de configuración de horario ─────────────────── */

function HorarioModal({ onClose, onSave }: { onClose: () => void; onSave: (h: Horario) => Promise<void> }) {
  const [horario, setHorario] = useState<Horario | null>(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    fetch('/api/me/horario')
      .then(r => r.json())
      .then(d => setHorario(d.horario ?? HORARIO_DEFAULT))
  }, [])

  function toggle(dia: DiaSemana) {
    setHorario(prev => prev ? { ...prev, [dia]: { ...prev[dia], activo: !prev[dia].activo } } : prev)
  }

  function setHora(dia: DiaSemana, campo: 'inicio' | 'fin', val: string) {
    setHorario(prev => prev ? { ...prev, [dia]: { ...prev[dia], [campo]: val } } : prev)
  }

  async function handleSave() {
    if (!horario) return
    setSaving(true)
    await onSave(horario)
    setSaving(false)
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-modal-enter overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <Settings size={15} className="text-slate-600" />
            </div>
            <h2 className="font-semibold text-[15px] text-[#1d1d1f]">Horario de consulta</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {!horario ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {DIAS.map(({ key, label }) => {
                const dia = horario[key]
                return (
                  <div key={key} className={`rounded-xl px-3 py-2.5 transition-colors ${dia.activo ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    {/* Fila: toggle + nombre */}
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => toggle(key)}
                        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${dia.activo ? 'bg-[#1e5fa8]' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${dia.activo ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className={`text-sm font-medium flex-1 ${dia.activo ? 'text-[#1d1d1f]' : 'text-slate-400'}`}>
                        {label}
                      </span>
                      {!dia.activo && (
                        <span className="text-[11px] text-slate-400 italic">Sin consulta</span>
                      )}
                    </div>

                    {/* Fila: pickers de hora (solo si activo) */}
                    {dia.activo && (
                      <div className="flex items-center gap-2 mt-2 pl-[52px]">
                        <input
                          type="time"
                          value={dia.inicio}
                          onChange={e => setHora(key, 'inicio', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                        />
                        <span className="text-xs text-slate-400 flex-shrink-0">–</span>
                        <input
                          type="time"
                          value={dia.fin}
                          min={dia.inicio}
                          onChange={e => setHora(key, 'fin', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !horario}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar horario'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}

/* ─── Duraciones disponibles (minutos) ─────────────────── */

const DURATIONS = [
  { label: '15 min', value: 15  },
  { label: '30 min', value: 30  },
  { label: '45 min', value: 45  },
  { label: '1 hora', value: 60  },
  { label: '1:30 h', value: 90  },
  { label: '2 horas', value: 120 },
]

const DEFAULT_DURATION = 60

/** Id de la eventSource de citas; ver `eventSourcesStable`. */
const FUENTE_APPOINTMENTS = 'appointments'

/** Prefijo del id temporal que lleva una cita aun no confirmada por el servidor. */
const PREFIJO_OPTIMISTA = 'optimistic-'

/* Antigüedad a partir de la cual volver a la pestaña sí pide datos otra vez.
   Ver el efecto de `visibilitychange`, que es quien lo justifica. */
const UMBRAL_REFETCH_FOCO_MS = 120_000

function calcDuration(startIso: string, endIso: string) {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
}

function addMinutes(iso: string, mins: number) {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + mins); return d.toISOString()
}

/* ─── F3-6e: helper para badge de timezone ───
   `regionDeTimezone` estaba aquí y vive ahora en `@/lib/consultorios/zonas-mexico`:
   el ancla de hora local de la descripción del evento de Google la necesita
   desde el servidor, y este archivo es `'use client'`. */
function horaEnTZ(startTimeISO: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(startTimeISO))
  } catch {
    return ''
  }
}

/* ─── Helpers ──────────────────────────────────────────── */

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromDatetimeLocal(val: string) { return new Date(val).toISOString() }
function addHour(iso: string) {
  const d = new Date(iso); d.setHours(d.getHours() + 1); return d.toISOString()
}

/* ─── Hook: búsqueda de pacientes ─────────────────────── */

function usePacientes(query: string) {
  const [results, setResults] = useState<PacienteBusqueda[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const queryNorm = query.trim().replace(/\s+/g, ' ')
      const { data } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos, telefono')
        .neq('activo', false)
        .or(`nombre.ilike.%${queryNorm}%,apellidos.ilike.%${queryNorm}%`)
        .order('apellidos')
        .limit(8)
      setResults(data ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return { results, loading }
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

function AppointmentModal({
  modal, onClose, onSave, onDelete, medicos, defaultMedicoId,
  hideMedicoDropdown, medicoDropdownRequired, canVerExpediente, canInvitar, onInvitar,
  onCambiarTipo,
}: {
  modal: ModalState
  onClose: () => void
  onSave: (data: Partial<Appointment> & { id?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  medicos: Medico[]
  defaultMedicoId: string
  hideMedicoDropdown: boolean
  medicoDropdownRequired: boolean
  canVerExpediente: boolean
  /* `canVerAgendaCompleta`: administrador de clínica y secretaria. Esto sólo
     decide si el botón se PINTA — el permiso de verdad lo comprueba la ruta,
     porque ocultar un botón no impide llamar al endpoint. */
  canInvitar: boolean
  /* El modal de invitación NO se monta aquí: vive en la página. Tiene que poder
     abrirse solo al CREAR una cita, y para entonces este modal ya se cerró. */
  onInvitar: () => void
  /* Cambia entre cita y evento EN EL ALTA. Sube a la página en vez de resolverse
     con un `useState` de aquí dentro, y no es por gusto: el tipo vive en
     `modal`, y la página monta este componente con `key={modal.tipo}` para que
     cambiarlo REMONTE. Ese remonte es el que tira el paciente ya elegido, el
     título ya tecleado y un `status` que el otro tipo no ofrece — sin una sola
     línea de reseteo. Un estado local no remontaría nada y habría que limpiar a
     mano cinco campos, que es donde se olvida uno. */
  onCambiarTipo: (tipo: TipoFila) => void
}) {
  const isEdit = modal.mode === 'edit'
  const apt    = modal.mode === 'edit' ? modal.appointment : null

  /* CITA o EVENTO GENÉRICO. Al editar NO se elige: se deduce de la fila, porque
     el tipo es fijo tras crear (ver `TipoFila`). Al crear lo trae `modal`, y lo
     cambia el control de dos posiciones de más abajo — que NO escribe aquí, sino
     que llama a `onCambiarTipo` y deja que la página reemplace el `modal`.

     Sigue siendo una constante y no un `useState`, y eso no ha cambiado: desde
     dentro de este componente el tipo no se toca. Cambiarlo es remontarlo
     entero, que es justo la propiedad de la que depende no arrastrar el paciente
     de una cita a un evento. */
  const tipo: TipoFila = modal.mode === 'create'
    ? modal.tipo
    : (apt && esEventoGenerico(apt) ? 'evento' : 'cita')
  const esEvento = tipo === 'evento'

  const initialDuration = apt ? calcDuration(apt.start_time, apt.end_time) : DEFAULT_DURATION

  const [startTime,   setStartTime]   = useState(
    modal.mode === 'create' ? toDatetimeLocal(modal.start)
    : apt ? toDatetimeLocal(apt.start_time) : ''
  )
  const [duration,    setDuration]    = useState(initialDuration)
  const [notes,       setNotes]       = useState(apt?.notes ?? '')
  const [status,      setStatus]      = useState<Status>(apt?.status ?? 'scheduled')
  const [paciente,    setPaciente]    = useState<PacienteBusqueda | null>(
    apt?.pacientes
      ? { id: apt.pacientes.id, nombre: apt.pacientes.nombre, apellidos: apt.pacientes.apellidos, telefono: apt.pacientes.telefono ?? null }
      : null
  )
  /* El título libre del evento genérico (§12.14). Va a `appointments.title`, la
     columna que ya existía y ya era NOT NULL — para esto no hizo falta ninguna
     columna nueva. En una CITA este estado no se usa: allí el título se compone
     del paciente, como siempre.

     NO HAY TIPOS CERRADOS DE EVENTO: el usuario escribe lo que quiera. Lo único
     cerrado es la pinta (icono y color). */
  const [titulo,      setTitulo]      = useState(esEvento ? (apt?.title ?? '') : '')
  const [icono,       setIcono]       = useState<IconoEvento | null>(apt?.icono ?? null)
  const [color,       setColor]       = useState<ColorEvento | null>(apt?.color ?? null)
  const [search,      setSearch]      = useState('')
  const [showSearch,  setShowSearch]  = useState(false)
  const [quickCreate, setQuickCreate] = useState(false)
  const [medicoId,    setMedicoId]    = useState<string>(apt?.medico_id ?? defaultMedicoId)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  /* La alerta de la X del paciente. Ver el botón, más abajo. */
  const [quitarPaciente, setQuitarPaciente] = useState(false)

  // F3-6: hook de consultorio activo (siempre disponible bajo el Provider).
  const { consultorioActivo, cambiarActivo } = useConsultorioActivo()

  // F3-6: hooks de consultorios. Se llaman AMBOS incondicionalmente (reglas
  // de hooks). El discriminador hideMedicoDropdown decide cuál se usa.
  // - hideMedicoDropdown=true → médico operando para sí (owner-scope).
  // - hideMedicoDropdown=false → admin/secretaria operando para otro médico.
  const ownerConsultorios = useConsultorios()
  const operativoConsultorios = useConsultoriosDeMedico(hideMedicoDropdown ? null : medicoId)

  const consultoriosList = hideMedicoDropdown
    ? ownerConsultorios.consultorios
    : operativoConsultorios.consultorios
  const consultorioDefaultDelTarget = hideMedicoDropdown
    ? ownerConsultorios.consultorioDefault
    : operativoConsultorios.consultorioDefault

  // F3-7b: solo si la cita es del médico autenticado y su consultorio existe en la lista
  const citaConsultorio = apt?.consultorio_id
    ? consultoriosList.find(c => c.id === apt.consultorio_id)
    : undefined
  /* Un evento genérico no tiene de quién abrir expediente, así que este botón
     se apaga solo por el `paciente &&` que ya estaba. No hace falta añadir
     nada, y coincide con lo que §12.10 promete de los eventos de Google: desde
     ellos no se puede iniciar consulta. */
  const showIniciarConsulta =
    isEdit &&
    canVerExpediente &&
    paciente &&
    defaultMedicoId === apt?.medico_id &&
    citaConsultorio

  // State del consultorio seleccionado.
  // Pre-selección cascada: apt (edición) → activo del sidebar si está en lista
  // → default del target → vacío.
  const [consultorioId, setConsultorioId] = useState<string>(() => {
    if (apt?.consultorio_id) return apt.consultorio_id
    if (consultorioActivo && consultoriosList.some(c => c.id === consultorioActivo.id)) {
      return consultorioActivo.id
    }
    return consultorioDefaultDelTarget?.id ?? ''
  })

  // F3-6: reset al cambiar médico.
  // En edición sin cambio de médico: preservar snapshot.
  // En edición con cambio de médico, o creación: ajustar al default del nuevo target.
  useEffect(() => {
    if (apt && medicoId === apt.medico_id) return
    if (consultoriosList.some(c => c.id === consultorioId)) return
    const next = consultorioDefaultDelTarget?.id ?? ''
    setConsultorioId(next)
  }, [medicoId, consultoriosList, consultorioDefaultDelTarget?.id, apt, consultorioId])

  // Sincronizar default cuando profile carga después del mount inicial.
  // Solo aplica para creación de cita (no para edición de cita existente).
  useEffect(() => {
    if (!apt && defaultMedicoId && !medicoId) {
      setMedicoId(defaultMedicoId)
    }
  }, [defaultMedicoId, apt, medicoId])

  const { results, loading: searchLoading } = usePacientes(search)
  const showDropdown = showSearch && search.trim().length >= 2

  /* Lo mínimo para poder guardar, según el tipo. Una CITA necesita paciente; un
     EVENTO necesita título con algo escrito —`appointments.title` es NOT NULL y
     un título en blanco daría una tarjeta muda—. Se calcula aquí y no en dos
     sitios porque lo leen el botón (para apagarse) y `handleSave` (defensa en
     profundidad, por si el botón se saltara). */
  const tituloLimpio = titulo.trim()
  const faltaLoEsencial = esEvento ? tituloLimpio === '' : !paciente

  async function handleSave() {
    if (faltaLoEsencial || !startTime) return

    // Defensa en profundidad: secretaria debe seleccionar médico
    // (el `required` HTML5 ya bloquea el submit, pero validamos aquí también)
    if (medicoDropdownRequired && !medicoId) return
    if (!consultorioId) return  // F3-6: consultorio obligatorio

    setSaving(true)
    const start_time = fromDatetimeLocal(startTime)

    // F3-6: enviar consultorio_id en creación SIEMPRE; en edición SOLO si cambió.
    // Evita re-validación innecesaria del consultorio en el backend cuando se edita
    // hora/status sin tocar consultorio.
    const consultorioChanged = !apt || consultorioId !== apt.consultorio_id

    await onSave({
      id:          apt?.id,
      /* De dónde sale el título, que es la diferencia de fondo entre los dos
         tipos: la cita lo COMPONE del paciente (y por eso no tiene campo de
         título), el evento lo lleva escrito a mano. */
      title:       esEvento ? tituloLimpio : `${paciente!.nombre} ${paciente!.apellidos}`,
      start_time,
      end_time:    addMinutes(start_time, duration),
      notes:       notes.trim() || null,
      status,
      paciente_id: esEvento ? null : paciente!.id,
      // El bloque optimista de handleSave pinta la tarjeta antes de que
      // responda el servidor; sin esto escribiria el paciente anterior.
      pacientes:   esEvento ? null : paciente,
      // La pinta viaja SIEMPRE, también en una cita, y ahí va en null: si sólo
      // se mandara desde el evento, convertir el valor a null nunca llegaría al
      // servidor (el PUT sólo toca la columna si el campo viene).
      icono:       esEvento ? icono : null,
      color:       esEvento ? color : null,
      medico_id:   medicoId || null,
      ...(consultorioChanged ? { consultorio_id: consultorioId } : {}),
      updated_at:  apt?.updated_at,
    })
    setSaving(false)
  }

  async function handleDelete() {
    if (!apt?.id) return
    setDeleting(true)
    await onDelete(apt.id)
    setDeleting(false)
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--ag-modal-overlay)' }} onClick={onClose} />
      <div className="relative rounded-[22px] w-full max-w-[480px] max-h-[92vh] flex flex-col animate-modal-enter overflow-hidden"
        style={{ background: 'var(--ag-modal-bg)', boxShadow: '0 30px 80px rgba(16, 32, 64, .28)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-[22px] py-[18px] border-b" style={{ borderColor: 'var(--ag-hairline)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-modal-icon-bg)' }}>
            <Calendar size={20} style={{ color: 'var(--ag-brand-primary)' }} />
          </div>
          <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--ag-ink)' }}>
            {esEvento
              ? (isEdit ? 'Editar evento' : 'Nuevo evento')
              : (isEdit ? 'Editar cita'   : 'Nueva cita')}
          </h2>
          {canVerExpediente && paciente && (
            <Link
              href={`/expediente/${paciente.id}`}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
            >
              <FileText size={14} />
              Expediente
            </Link>
          )}
          <button onClick={onClose} className={`${canVerExpediente && paciente ? '' : 'ml-auto'} p-1 transition-opacity hover:opacity-70`} style={{ color: 'var(--ag-muted2)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] py-5 space-y-4 flex-1 min-h-0 overflow-y-auto">

          {/* ── QUÉ SE ESTÁ CREANDO — SÓLO EN EL ALTA ────────────────────────
              En `mode: 'edit'` este control NO EXISTE, y no es una omisión: el
              tipo de una fila guardada es fijo. Cambiarlo ahí sería quitarle el
              paciente a una cita por una puerta lateral, y esa puerta la cierra
              §12.18 —quitar el paciente ES borrar la cita, con su alerta—.

              En el ALTA ese argumento no aplica, porque todavía no hay fila a la
              que quitarle nada: no se convierte nada, se elige qué se va a
              crear. Las dos puertas del toolbar siguen siendo las de entrada con
              el tipo ya elegido; esto es para quien llegó pulsando un hueco del
              calendario, que entra en «cita» —lo que espera ese gesto— y hasta
              ahora no tenía forma de cambiar de idea sin cerrar y volver.

              ⚠️ VA ARRIBA DEL TODO, ANTES DE CUALQUIER CAMPO, A PROPÓSITO:
              cambiar de tipo REMONTA el modal y se pierde lo que hubiera
              escrito. Puesto abajo, invitaría a rellenar primero y a descubrir
              la pérdida después. */}
          {!isEdit && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                Qué vas a crear
              </label>
              <div
                role="tablist"
                aria-label="Tipo de lo que se va a crear"
                className="inline-flex w-full"
                style={{ background: 'var(--ag-segment-bg)', borderRadius: 12, padding: 3, gap: 2 }}
              >
                {TIPOS_ALTA.map(t => {
                  const activo = tipo === t.id
                  const Ico = t.icono
                  return (
                    <button
                      key={t.id} type="button"
                      role="tab"
                      aria-selected={activo}
                      onClick={() => { if (!activo) onCambiarTipo(t.id) }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 transition-all ${activo ? '' : 'hover:opacity-70'}`}
                      style={{
                        border: 'none', cursor: 'pointer', borderRadius: 9, padding: '7px 13px',
                        fontSize: 13, fontWeight: activo ? 700 : 600,
                        ...(activo
                          ? { background: 'var(--ag-segment-active-bg)', color: 'var(--ag-segment-active-text)', boxShadow: 'var(--ag-segment-active-shadow)' }
                          : { background: 'transparent', color: 'var(--ag-segment-text)' }),
                      }}
                    >
                      <Ico size={14} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                {esEvento
                  ? 'Un evento no lleva paciente ni expediente: cirugía, junta, bloqueo de horario.'
                  : 'Una cita va ligada a un paciente y a su expediente.'}
              </p>
            </div>
          )}

          {/* ── EVENTO GENÉRICO: título libre + pinta ────────────────────────
              Ocupa el sitio del campo de paciente, no se suma a él: los dos
              tipos comparten pantalla pero nunca los dos campos a la vez, que
              es lo que haría dudar de qué se está creando. */}
          {esEvento && (
            <>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus={!isEdit}
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Cirugía Sr. Pérez, Junta de personal, Bloqueo…"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
                />
                {/* ⚠️ ESTE TEXTO NO ES DE RELLENO. El título viaja TAL CUAL al
                    calendario de Google —sin filtro y sin forma de sanearlo, que
                    es texto libre— y ahí lo ve quien esté invitado al evento. La
                    descripción sí tiene formato fijo y nada clínico; el título,
                    desde ahora, es responsabilidad de quien escribe. Aceptado y
                    declarado en el aviso de privacidad (plan §9 y §12.5). */}
                <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                  Se verá tal cual en Google Calendar y en la invitación de quien asista.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                  Icono
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICONOS_EVENTO.map(key => {
                    const on = icono === key
                    return (
                      <button
                        key={key} type="button"
                        // Volver a pulsar el elegido lo quita: NULL es «sin
                        // icono» y no hay ningún valor de la lista que
                        // signifique eso (§12.14 proponía `punto` y se retiró).
                        onClick={() => setIcono(on ? null : key)}
                        title={ICONO_ETIQUETA[key]}
                        aria-label={ICONO_ETIQUETA[key]}
                        aria-pressed={on}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                        style={on
                          ? { background: 'var(--ag-modal-icon-bg)', color: 'var(--ag-brand-primary)', border: '1.5px solid var(--ag-brand-primary)' }
                          : { background: 'var(--ag-input-bg)', color: 'var(--ag-muted)', border: '1.5px solid var(--ag-input-border)' }}
                      >
                        <IconoDelEvento nombre={key} size={17} />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLORES_EVENTO.map(key => {
                    const on = color === key
                    return (
                      <button
                        key={key} type="button"
                        onClick={() => setColor(on ? null : key)}
                        title={COLOR_ETIQUETA[key]}
                        aria-label={COLOR_ETIQUETA[key]}
                        aria-pressed={on}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                        style={{
                          background: `color-mix(in srgb, var(--ag-evento-${key}) 14%, var(--ag-input-bg))`,
                          border: on
                            ? `2px solid var(--ag-evento-${key})`
                            : '1.5px solid var(--ag-input-border)',
                        }}
                      >
                        <span className="w-4 h-4 rounded-full" style={{ background: `var(--ag-evento-${key})` }} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Paciente — campo principal y obligatorio de una CITA.
              En un evento genérico no existe: no es que esté vacío, es que esa
              fila no lleva paciente. */}
          {!esEvento && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
              Paciente <span className="text-red-500">*</span>
            </label>
            {paciente ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                style={{ background: 'var(--ag-patient-card-bg)', borderColor: 'var(--ag-patient-card-border)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-brand-secondary)' }}>
                    <span className="text-[10px] font-bold text-white">{paciente.nombre[0]}{paciente.apellidos[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ag-ink)' }}>{paciente.nombre} {paciente.apellidos}</p>
                    {paciente.telefono && <p className="text-[11px]" style={{ color: 'var(--ag-brand-secondary)' }}>{paciente.telefono}</p>}
                  </div>
                </div>
                {/* ⚠️ EN EDICIÓN, ESTA X NO QUITA UN CAMPO: BORRA LA CITA.
                    Y hay que decirlo, porque quien la pulsa cree lo contrario.

                    Una cita sin paciente no existe en Spinus: el título del
                    evento SALE del paciente, Guardar está apagado sin él, y no
                    hay estado intermedio «cita sin paciente» que guardar. Así
                    que quitarlo es borrarla, y se resuelve por el camino que ya
                    existe —el mismo del botón de la papelera—, que además borra
                    el evento de Google avisando a los invitados.

                    En ALTA sigue limpiando el campo y ya está: no hay cita
                    todavía que borrar. */}
                <button
                  onClick={() => {
                    if (isEdit) setQuitarPaciente(true)
                    else { setPaciente(null); setSearch('') }
                  }}
                  aria-label={isEdit ? 'Quitar paciente y eliminar la cita' : 'Quitar paciente'}
                  className="transition-opacity hover:opacity-70"
                  style={{ color: 'var(--ag-muted)' }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  autoFocus
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowSearch(true) }}
                  onFocus={() => setShowSearch(true)}
                  placeholder="Buscar paciente por nombre o apellido..."
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
                />
                {showDropdown && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-xl border shadow-lg overflow-hidden"
                    style={{ background: 'var(--ag-modal-bg)', borderColor: 'var(--ag-input-border)' }}>
                    {searchLoading && <div className="px-3 py-2.5 text-xs" style={{ color: 'var(--ag-muted)' }}>Buscando...</div>}
                    {results.map(p => (
                      <button key={p.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b last:border-0 hover:bg-[var(--ag-btn-ghost-hover)]"
                        style={{ borderColor: 'var(--ag-hairline)' }}
                        onClick={() => { setPaciente(p); setSearch(''); setShowSearch(false) }}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-brand-secondary)' }}>
                          <span className="text-[10px] font-bold text-white">{p.nombre[0]}{p.apellidos[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ag-ink)' }}>{p.nombre} {p.apellidos}</p>
                          {p.telefono && <p className="text-[11px]" style={{ color: 'var(--ag-muted)' }}>{p.telefono}</p>}
                        </div>
                      </button>
                    ))}
                    {/* Opción de registro rápido */}
                    {!searchLoading && (
                      <button
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors border-t"
                        style={{ borderColor: 'var(--ag-hairline)' }}
                        onClick={() => { setShowSearch(false); setQuickCreate(true) }}
                      >
                        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <Plus size={13} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-700">Registrar "{search}"</p>
                          <p className="text-[11px] text-emerald-600">Crear nuevo paciente y continuar</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Fecha y hora de inicio */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
              Fecha y hora de inicio
            </label>
            <input
              type="datetime-local"
              value={startTime}
              step={900}
              onChange={e => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
            />
          </div>

          {/* Duración */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Duración</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button key={d.value} type="button" onClick={() => setDuration(d.value)}
                  className="px-4 py-2 rounded-full text-[13px] font-bold border transition-all"
                  style={duration === d.value
                    ? { background: 'var(--ag-brand-primary)', color: '#fff', borderColor: 'var(--ag-brand-primary)' }
                    : { background: 'var(--ag-input-bg)', color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {startTime && (
              <p className="text-[12.5px] mt-2.5" style={{ color: 'var(--ag-muted)' }}>
                Termina a las{' '}
                <span className="font-bold" style={{ color: 'var(--ag-text)' }}>
                  {toDatetimeLocal(addMinutes(fromDatetimeLocal(startTime), duration)).slice(11, 16)}
                </span>
              </p>
            )}
          </div>

          {/* Estado (solo edición) */}
          {isEdit && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Estado</label>
              {/* Los estados elegibles dependen del tipo (§12.13, D5): una cita
                  los enseña los cinco, un evento genérico sólo «Agendada» y
                  «Cancelada». Se recorre la lista del tipo y NO `STATUS_CONFIG`
                  entero, que es lo que hacía antes: así añadir un estado no le
                  aparece automáticamente a las juntas de personal. */}
              <div className="grid grid-cols-2 gap-2">
                {(esEvento ? ESTADOS_EVENTO : ESTADOS_CITA).map(key => {
                  const cfg = STATUS_CONFIG[key]
                  const on = status === key
                  return (
                    <button key={key} onClick={() => setStatus(key)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={on
                        ? { background: `var(--ag-status-${key}-bg)`, color: `var(--ag-status-${key}-text)`, border: `1.5px solid var(--ag-status-${key}-dot)` }
                        : { background: 'var(--ag-input-bg)', color: 'var(--ag-text)', border: '1.5px solid var(--ag-input-border)' }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `var(--ag-status-${key}-dot)` }} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Médico — ocultado para médicos sin admin y para clínicas single-doctor */}
          {!hideMedicoDropdown && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                Médico {medicoDropdownRequired && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <select
                  value={medicoId}
                  onChange={e => setMedicoId(e.target.value)}
                  required={medicoDropdownRequired}
                  className="w-full pl-3 pr-9 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all appearance-none cursor-pointer"
                >
                  {!medicoDropdownRequired && <option value="">Sin asignar</option>}
                  {medicos.map(m => (
                    <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ag-muted)' }} />
              </div>
            </div>
          )}

          {/* F3-6: Dropdown de consultorios. Siempre visible. */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
              Consultorio <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={consultorioId}
                onChange={e => setConsultorioId(e.target.value)}
                required
                disabled={consultoriosList.length === 0}
                className="w-full pl-3 pr-9 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {consultoriosList.length === 0 ? (
                  <option value="">Sin consultorios disponibles</option>
                ) : (
                  <>
                    <option value="">— Selecciona consultorio —</option>
                    {consultoriosList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.es_default ? ' (default)' : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ag-muted)' }} />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Instrucciones, observaciones..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all resize-none"
            />
          </div>

          {/* Invitación por correo — SÓLO EN EDICIÓN.
              En `mode: 'create'` no existe: invitar es un `patch` sobre el evento
              de Google, y una cita que aún no se ha guardado no tiene evento.

              Va en el cuerpo y no en el pie por sitio: el motivo del botón
              apagado es una frase, y en el pie no cabe sin apretujar «Iniciar
              consulta», «Cancelar» y «Guardar». */}
          {isEdit && canInvitar && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                Invitados
              </label>
              <button
                type="button"
                onClick={onInvitar}
                disabled={!apt?.google_event_id}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
              >
                <Mail size={15} /> Agregar invitados
              </button>
              {/* ⚠️ EL MOTIVO, SIEMPRE VISIBLE. Un botón apagado y mudo deja a
                  quien agenda buscando qué le falta, y este caso NO es raro: le
                  pasa a la secretaria en cuanto la clínica no tiene Google
                  conectado, y también con la primera cita de una clínica cuyo
                  calendario todavía no existe. */}
              {!apt?.google_event_id && (
                <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                  Esta cita todavía no tiene evento en Google, así que no hay a qué invitar.
                  Ocurre cuando la clínica no tiene Google Calendar conectado, o cuando su
                  calendario aún no existe — quien administra lo crea al abrir la agenda.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-[22px] py-3.5 border-t flex items-center gap-2" style={{ borderColor: 'var(--ag-hairline)' }}>
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={deleting ? 'Eliminando...' : 'Eliminar cita'}
              aria-label={deleting ? 'Eliminando cita' : 'Eliminar cita'}
              className="flex items-center justify-center p-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
          {showIniciarConsulta && (
            <Link
              href={`/expediente/${paciente.id}/nueva-nota${apt ? `?cita=${apt.id}` : ''}`}
              onClick={() => {
                cambiarActivo(citaConsultorio!)
                onClose()
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
            >
              <Stethoscope size={15} />
              Iniciar consulta
            </Link>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)]" style={{ color: 'var(--ag-muted)' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || faltaLoEsencial || !startTime || !consultorioId}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-95 shadow-sm bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* La alerta de la X del paciente. Reusa `ConfirmModal`, que ya vive en este
        archivo y se monta en su propio Portal por encima de este modal.

        El texto nombra el desenlace REAL en la primera frase —se elimina la
        cita completa— porque el gesto no lo sugiere: quien pulsa una X sobre un
        nombre espera vaciar un campo. */}
    {quitarPaciente && (
      <ConfirmModal
        message={
          'Quitar al paciente elimina la CITA COMPLETA, no sólo su nombre: '
          + 'desaparece de la agenda y también del calendario de Google de quien esté invitado, '
          + 'que recibirá el aviso de cancelación. No se puede deshacer — habría que agendarla '
          + 'de nuevo desde cero. ¿Deseas continuar?'
        }
        onConfirm={() => { setQuitarPaciente(false); void handleDelete() }}
        onCancel={() => setQuitarPaciente(false)}
      />
    )}

    {/* Modal de creación rápida — z-index superior al modal de cita */}
    {quickCreate && (
      <QuickPatientModal
        nombreInicial={search}
        onCreated={p => { setPaciente(p); setQuickCreate(false); setSearch('') }}
        onClose={() => setQuickCreate(false)}
      />
    )}

    </Portal>
  )
}

/* ─── Modal de confirmación genérico ───────────────────── */

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-modal-enter p-6">
        <p className="text-sm text-[#1d1d1f] leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}

/* ─── Renderer de eventos (estilo Google) — memoizado ──── */

/* Breakpoints de altura renderizada de la tarjeta (px). El tier se decide
   midiendo el alto real del contenedor con ResizeObserver (ver abajo): es
   lo más fiable con FullCalendar, cuyo alto de evento depende de la duración
   y del alto de hora del grid, no calculable con certeza solo desde datos.
   Calibrados al grid real: slot de 30min = 2.16rem ≈ 34.56px (globals.css),
   así una cita de 1h ≈ 69.12px → cae en 'full' y el layout (con line-heights
   ajustados abajo) cabe sin recortar el nombre. */
const CARD_TINY_MAX = 40
const CARD_COMPACT_MAX = 56

/* Estilo neutro del chip de médico (handoff). El contenido (2 iniciales,
   solo multi-doctor) lo decide el event source; aquí solo se estiliza. */
const CHIP_STYLE: CSSProperties = {
  fontSize: '9px', fontWeight: 800, letterSpacing: '.02em',
  borderRadius: '5px', padding: '1px 5px', lineHeight: 1.4, flexShrink: 0,
  background: 'var(--ag-chip-bg)', color: 'var(--ag-chip-text)',
}
const NAME_BASE: CSSProperties = {
  fontSize: '12px', fontWeight: 700, color: 'var(--ag-ink)', lineHeight: 1.25,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
  // flexShrink:0 → el nombre nunca se comprime; ante desborde se recorta la
  // fila de estado (última), nunca el nombre.
  flexShrink: 0,
}
const STATUS_DOT: CSSProperties = {
  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
}
const tzDiffStyle: CSSProperties = {
  fontSize: '9.5px',
  fontWeight: 500,
  lineHeight: 1.2,
  color: 'var(--ag-muted)',
  fontStyle: 'italic',
}

const MemoizedEventContent = memo(function MemoizedEventContent({
  timeText, title, pacNombre, status, doctorInitial, tzDiff, icono, color,
}: {
  timeText: string; title: string; pacNombre: string | null
  status: Status; doctorInitial?: string; tzDiff?: string
  /* La pinta del evento genérico (§12.14). Null en una cita, y null también en
     un evento al que no le eligieron ninguna: ahí la tarjeta cae al estilo por
     estado, que es lo que hacía antes de que esto existiera. */
  icono: IconoEvento | null; color: ColorEvento | null
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  // Mide el alto real asignado por FullCalendar (root con height:100%).
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => setHeight(el.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // height null = aún sin medir → 'full' hasta el primer ResizeObserver.
  const tier: 'tiny' | 'compact' | 'full' =
    height == null ? 'full'
      : height < CARD_TINY_MAX ? 'tiny'
        : height < CARD_COMPACT_MAX ? 'compact'
          : 'full'

  /* El color elegido MANDA sobre el del estado cuando lo hay, y sólo lo hay en
     un evento genérico. Motivo: en un evento el estado dice poco —está agendado
     o cancelado y ya— mientras que el color es lo que su autor eligió para
     distinguirlo de un vistazo. En una cita no hay color y esto no cambia nada.
     El fondo y el borde salen del mismo token con `color-mix`, así que basta un
     token por color y la paleta sigue siendo barata de sustituir. */
  const dot = color ? `var(--ag-evento-${color})` : `var(--ag-status-${status}-dot)`
  const txt = color ? `var(--ag-evento-${color})` : `var(--ag-status-${status}-text)`
  const fondo  = color
    ? `color-mix(in srgb, var(--ag-evento-${color}) 10%, var(--ag-surface))`
    : `var(--ag-status-${status}-bg)`
  const marco = color
    ? `color-mix(in srgb, var(--ag-evento-${color}) 32%, transparent)`
    : `var(--ag-status-${status}-border)`
  const isCancelled = status === 'cancelled'
  const name = pacNombre ?? title

  const root: CSSProperties = {
    height: '100%', boxSizing: 'border-box', overflow: 'hidden', cursor: 'pointer',
    background: fondo,
    border: `1px solid ${marco}`,
    borderLeft: `3.5px solid ${dot}`,
    borderRadius: '9px',
    boxShadow: 'var(--ag-shadow-card)',
    display: 'flex', flexDirection: 'column', gap: '1px',
    justifyContent: tier === 'tiny' ? 'center' : 'flex-start',
    padding: tier === 'tiny' ? '2px 8px' : '4px 9px',
    opacity: isCancelled ? 0.7 : 1,
  }
  const nameStyle: CSSProperties = isCancelled
    ? { ...NAME_BASE, textDecoration: 'line-through' }
    : NAME_BASE
  const chip = doctorInitial ? <span style={CHIP_STYLE}>{doctorInitial}</span> : null

  /* El icono del evento genérico SUSTITUYE al punto, no se suma: los dos ocupan
     el mismo sitio y dicen lo mismo —de qué va esta tarjeta— con distinto grado
     de detalle. Dos marcadores seguidos en una tarjeta de 34px no caben. */
  const marcador = icono
    ? <IconoDelEvento nombre={icono} size={11} color={dot} />
    : <span style={{ ...STATUS_DOT, background: dot }} />

  // tiny: marcador + nombre, una fila centrada. Sin hora ni chip.
  if (tier === 'tiny') {
    return (
      <div ref={rootRef} style={root}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          {marcador}
          <span style={nameStyle}>{name}</span>
        </div>
      </div>
    )
  }

  const timeRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
      <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.2, color: 'var(--ag-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {timeText}
      </span>
      {chip}
    </div>
  )

  // compact: fila hora + chip, luego nombre. Sin fila de estado.
  if (tier === 'compact') {
    return (
      <div ref={rootRef} style={root}>
        {timeRow}
        <span style={nameStyle}>{name}</span>
        {tzDiff && <span style={tzDiffStyle}>{tzDiff}</span>}
      </div>
    )
  }

  // full: fila hora + chip, nombre, fila (punto + estado corto).
  return (
    <div ref={rootRef} style={root}>
      {timeRow}
      <span style={nameStyle}>{name}</span>
      {tzDiff && <span style={tzDiffStyle}>{tzDiff}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {marcador}
        <span style={{ fontSize: '10.5px', fontWeight: 600, lineHeight: 1.2, color: txt }}>{STATUS_CONFIG[status].label}</span>
      </div>
    </div>
  )
})

/* Logo oficial "G" de Google (4 colores), SVG inline. Sin dependencias ni
   assets externos. Tamaño por prop (12px en la tarjeta). */
function GoogleGIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

/* Tarjeta de evento del calendario de Google (no arrastrable). Solo
   presentación: la lógica de fetch/resta de Google no se toca.

   UNA SOLA COSA, y antes eran dos. La prop `busy` separaba estos eventos de
   los bloques anónimos de "Ocupado" que venían del calendario PERSONAL del
   médico vía freebusy. Ese carril se eliminó entero —scope incluido—, así que
   aquí ya no llega nada anónimo: todo lo que pinta esta tarjeta viene del
   calendario de Spinus, tiene título real y no tiene cita ligada. De ahí que
   la etiqueta haya dejado de ser condicional.

   NO SE VUELVE A METER EL CANDADO. Pintarlo aquí producía cosas como
   "🔒 Cita médica: Pedro Gonzalo Hernández Mendoza": el título completo debajo
   de un icono que promete privacidad. */
const GoogleEventCard = memo(function GoogleEventCard({
  timeText, title,
}: { timeText: string; title: string }) {
  return (
    <div style={{
      height: '100%', boxSizing: 'border-box', overflow: 'hidden',
      color: 'var(--ag-gcal-text)',
      border: '1px solid var(--ag-gcal-accent)',
      borderLeft: '3px solid var(--ag-gcal-accent)',
      borderRadius: '9px', padding: '5px 9px',
      background: 'var(--ag-gcal-bg1)',
      display: 'flex', flexDirection: 'column', gap: '2px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
        <GoogleGIcon size={12} />
        <span style={{ fontSize: '10.5px', fontWeight: 600, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {timeText}
        </span>
        <span style={{
          flexShrink: 0, marginLeft: 'auto',
          fontSize: '9px', fontWeight: 700, letterSpacing: '.02em',
          textTransform: 'uppercase', opacity: 0.75,
          border: '1px solid currentColor', borderRadius: '999px',
          padding: '0 5px', lineHeight: 1.5,
        }}>
          {/* "Evento", y antes decía "Sin cita". Aquel texto venía del modelo
              viejo, cuando la etiqueta servía para separar estos eventos de los
              bloques de "Ocupado" de freebusy. Eliminado freebusy (§12.6) sólo
              queda un tipo de evento, y lo único que hacía ese texto era
              sugerir que a la cita le falta algo. "Evento" lo distingue de una
              cita sin insinuar carencia.

              NADA DE "GCal" NI DE ABREVIATURAS TÉCNICAS: el médico no tiene por
              qué saber qué es, y el icono de Google que ya lleva la tarjeta
              identifica el origen de sobra. */}
          Evento
        </span>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </span>
    </div>
  )
})

/* Chip plano de cita para la Vista Mes (dayGridMonth). Branch DEDICADO: NO
   comparte chrome con MemoizedEventContent (tarjetas de Semana/Día). Una sola
   fila: marcador (punto por estado o "G" de Google) + hora (700) + nombre
   (ellipsis). Sin border/sombra/fondo de tarjeta. */
const MonthChip = memo(function MonthChip({ arg }: { arg: EventContentArg }) {
  const ext = arg.event.extendedProps as Appointment & { isGcalBlock?: boolean }
  // Todo lo que llega marcado como bloque de Google es un evento del calendario
  // de Spinus sin cita ligada. La distinción con los bloques anónimos de
  // "Ocupado" murió con freebusy; mismo criterio que GoogleEventCard.
  const isGcal = !!ext?.isGcalBlock
  const status = ext?.status
  const isCancelled = status === 'cancelled'
  const name = arg.event.title

  /* Tres marcadores posibles y un solo hueco, en este orden de precedencia:
     la G de Google (el evento no es nuestro), el icono del evento genérico
     (§12.14), y el punto de estado de siempre. El color del evento manda sobre
     el del estado por el mismo motivo que en la tarjeta de Semana/Día. */
  const tinta = ext?.color
    ? `var(--ag-evento-${ext.color})`
    : (status ? `var(--ag-status-${status}-dot)` : 'var(--ag-muted)')
  const marker = isGcal
    ? <GoogleGIcon size={10} />
    : ext?.icono
      ? <IconoDelEvento nombre={ext.icono} size={10} color={tinta} />
      : <span style={{ width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', background: tinta }} />

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
      fontSize: 11, color: 'var(--ag-text)', cursor: 'pointer', overflow: 'hidden',
      opacity: isCancelled ? 0.62 : 1,
    }}>
      {marker}
      {arg.timeText && (
        <span style={{ fontWeight: 700, color: 'var(--ag-muted)', flex: '0 0 auto' }}>{arg.timeText}</span>
      )}
      <span style={{
        fontWeight: 600, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        textDecoration: isCancelled ? 'line-through' : 'none',
        color: isGcal ? 'var(--ag-gcal-text)' : undefined,
      }}>{name}</span>
      {isGcal && (
        <span style={{
          flex: '0 0 auto', fontSize: 9, fontWeight: 700, letterSpacing: '.02em',
          textTransform: 'uppercase', color: 'var(--ag-gcal-text)', opacity: 0.75,
          border: '1px solid currentColor', borderRadius: 999, padding: '0 4px', lineHeight: 1.5,
        }}>
          {/* Mismo texto y mismo motivo que en GoogleEventCard, donde está
              razonado entero: "Sin cita" era del modelo viejo —separaba estos
              eventos de los bloques de "Ocupado" de freebusy, ya eliminado
              (§12.6)— e insinuaba que a la cita le falta algo. Los dos sitios
              cambian a la vez o la agenda dice dos cosas distintas del mismo
              evento según la vista. */}
          Evento
        </span>
      )}
    </div>
  )
})

/** Resuelve las iniciales del chip de médico de una cita ya pintada. */
type InicialesDeCita = (ext: Appointment) => string | undefined

function renderEventContent(arg: EventContentArg, navegadorTZ: string, inicialesDeCita: InicialesDeCita) {
  // Vista Mes: chip plano dedicado. El camino de Semana/Día (abajo) queda intacto.
  if (arg.view.type === 'dayGridMonth') return <MonthChip arg={arg} />
  const ext = arg.event.extendedProps as Appointment & { isGcalBlock?: boolean }
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

  return (
    <MemoizedEventContent
      timeText={arg.timeText}
      title={ext.title}
      pacNombre={pac ? `${pac.nombre} ${pac.apellidos}` : null}
      status={ext.status}
      doctorInitial={inicialesDeCita(ext)}
      tzDiff={tzDiff}
      icono={ext.icono ?? null}
      color={ext.color ?? null}
    />
  )
}

/* ─── Página principal ─────────────────────────────────── */

// Segmentos del control de vistas. Íconos lucide representativos:
// LayoutGrid (rejilla = Mes), Columns3 (columnas = Semana), Square (Día).
const VIEWS = [
  { type: 'dayGridMonth', label: 'Mes',    icon: LayoutGrid },
  { type: 'timeGridWeek', label: 'Semana', icon: Columns3 },
  { type: 'timeGridDay',  label: 'Día',    icon: Square },
] as const

export default function AgendaPage() {
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)
  const [modal,        setModal]        = useState<ModalState>({ mode: 'closed' })
  const [isMobile,     setIsMobile]     = useState(false)
  const [currentView,  setCurrentView]  = useState<string>('timeGridWeek')
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
  const [filtroMedico, setFiltroMedico] = useState<string>('')

  /* Horario y médicos salen del agregado de configuración, no de dos fetch
     propios: la misma clave la piden ya el Sidebar y el provider de
     consultorios del layout, así que SWR la deduplica y abrir la agenda no
     añade ninguna petición por estos dos datos. */
  const { data: config, mutate: mutarConfig } = useSWR<ConfigApp>(
    CLAVE_CONFIG,
    fetcherConfig,
    { dedupingInterval: CONFIG_DEDUPE_MS },
  )
  const horario = config?.horario ?? HORARIO_DEFAULT
  const medicos = config?.medicos ?? SIN_MEDICOS
  const { profile, isDoctor } = useProfile()
  const toast = useToast()
  const { state: subState, openBloqueoModal } = useSubscriptionGate()

  const isMedicoSinAdmin = profile?.role === 'medico' && !profile?.es_admin_de_clinica
  const isMedicoConAdmin = profile?.role === 'medico' && profile?.es_admin_de_clinica === true
  const isSecretaria = profile?.role === 'secretaria'

  const canEditHorario  = canManageClinica(profile)
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

  /* ── Detectar mobile y actualizar vista del calendario ── */
  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      const api = calendarRef.current?.getApi()
      if (!api) return
      if (mobile && api.view.type !== 'timeGridDay') {
        api.changeView('timeGridDay')
      } else if (!mobile && api.view.type === 'timeGridDay') {
        api.changeView('timeGridWeek')
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function closeModal() { setModal({ mode: 'closed' }) }

  function refetch() {
    calendarRef.current?.getApi().refetchEvents()
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
     minimizada) dispararían si no dos peticiones idénticas. */
  const ultimaTraidaRef = useRef(0)

  /* ── Refetch al cambiar el filtro de médico ─────────────
     Se dispara DESPUÉS del commit del estado (no en el onChange síncrono),
     cuando appointmentSourceRef.current ya apunta al appointmentSource
     recreado con el filtroMedico nuevo → el fetch sale con el médico
     correcto. El guard de primer render evita el doble fetch en montaje
     (FullCalendar ya hace su fetch inicial por sí mismo). */
  const filtroFirstRender = useRef(true)
  useEffect(() => {
    if (filtroFirstRender.current) { filtroFirstRender.current = false; return }
    refetch()
  }, [filtroMedico])

  /* ── Event source: nuestras citas ───────────────────── */
  const appointmentSource = useCallback(async (
    info: { startStr: string; endStr: string },
    success: (events: EventInput[]) => void,
    failure: (err: Error) => void
  ) => {
    try {
      ultimaTraidaRef.current = Date.now()
      let url = `/api/appointments?from=${info.startStr}&to=${info.endStr}`
      if (filtroMedico) url += `&medico_id=${filtroMedico}`
      const res = await fetch(url)
      const data = await res.json()
      const apts: Appointment[] = data.appointments ?? []

      success(apts.map(apt => ({
        id:              apt.id,
        title:           apt.title,
        start:           apt.start_time,
        end:             apt.end_time,
        // Harness transparente: el color de la cita —que es el de su ESTADO— lo
        // pone `eventContent` leyendo los tokens al pintar. Aquí NO va
        // `textColor`: FullCalendar lo aplicaría como `color` en línea sobre
        // `.fc-event-main`, y las tres tarjetas fijan el suyo en cada texto, así
        // que no se heredaba nada. Lo que sí hacía era obligar a resolver un
        // color aquí, que es de donde salía la segunda paleta.
        backgroundColor: 'transparent',
        borderColor:     'transparent',
        extendedProps:   { ...apt },
      })))
    } catch (err: unknown) {
      failure(err instanceof Error ? err : new Error('Error cargando citas'))
    }
  }, [filtroMedico])

  /* ── Event source: Google Calendar ─────────────────────
   * Una sola cosa: `events`, los eventos del calendario de Spinus que NO son
   * cita de la app. El servidor ya los restó, así que aquí NO hace falta pedir
   * /api/appointments para deduplicar, y ya llegan acotados a los cuatro campos
   * que se usan abajo — el resto del evento de Google no viaja.
   *
   * El carril `ocupado` (huecos del calendario personal vía freebusy) se
   * eliminó entero, scope incluido. Si vuelve a aparecer una lectura de
   * `data.ocupado`, es que alguien lo revivió.
   */
  const gcalSource = useCallback(async (
    info: { startStr: string; endStr: string },
    success: (events: EventInput[]) => void,
    failure: (err: Error) => void
  ) => {
    try {
      const res = await fetch(`/api/google/events?from=${info.startStr}&to=${info.endStr}`)
      const data = await res.json()
      // 'sin_token' y 'error_google' se pintan igual aquí —sin eventos de
      // Google— porque la agenda no tiene botón de conectar: quien distingue
      // los dos casos de cara al médico es /perfil.
      if (data.estado !== 'conectado') { success([]); return }

      // Espeja la lista blanca del servidor (`EventoAgenda` en
      // /api/google/events). Las dos llaves de `start` y `end` son necesarias:
      // un evento de día completo trae `date` y no `dateTime`.
      type GCalEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }

      const eventos = ((data.events ?? []) as GCalEvent[])
        .map((e) => ({
          id:              `gcal-${e.id}`,
          // Sin 🔒: esto viene del calendario de Spinus, tiene título real y no
          // es privado.
          title:           e.summary || 'Evento sin título',
          start:           e.start?.dateTime ?? e.start?.date ?? '',
          end:             e.end?.dateTime ?? e.end?.date ?? undefined,
          allDay:          !e.start?.dateTime,
          // Harness transparente: la GoogleEventCard pinta su propio fondo/borde.
          backgroundColor: 'transparent',
          borderColor:     'transparent',
          textColor:       '#6d4ec0',
          editable:        false,
          extendedProps:   { isGcalBlock: true },
        }))

      success(eventos)
    } catch (err: unknown) {
      failure(err instanceof Error ? err : new Error('Error cargando eventos'))
    }
  }, [])

  /* ── Stable eventSources ref (evita re-registro en cada render) ── */
  const appointmentSourceRef = useRef(appointmentSource)
  appointmentSourceRef.current = appointmentSource
  const gcalSourceRef = useRef(gcalSource)
  gcalSourceRef.current = gcalSource

  const stableAppointmentSource = useCallback(
    (info: { startStr: string; endStr: string }, success: (events: EventInput[]) => void, failure: (err: Error) => void) =>
      appointmentSourceRef.current(info, success, failure),
    []
  )
  const stableGcalSource = useCallback(
    (info: { startStr: string; endStr: string }, success: (events: EventInput[]) => void, failure: (err: Error) => void) =>
      gcalSourceRef.current(info, success, failure),
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

  /* ── Helper: construir EventInput desde datos de cita ── */
  function buildEventInput(data: Partial<Appointment> & { id?: string }): EventInput {
    return {
      id:              data.id ?? `${PREFIJO_OPTIMISTA}${Date.now()}`,
      title:           data.title ?? '',
      start:           data.start_time,
      end:             data.end_time,
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
    if (!appointment?.id) return
    const existing = calendarRef.current?.getApi()?.getEventById(appointment.id)
    if (!existing) return

    const input = buildEventInput(appointment)
    if (appointment.start_time) existing.setStart(appointment.start_time)
    if (appointment.end_time)   existing.setEnd(appointment.end_time)
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
    const pasaFiltroMedico = !filtroMedico || fila.medico_id === filtroMedico

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

  /* El handler se recrea en cada render (lee `filtroMedico`), pero el canal se
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
          void aplicarCambioRef.current(payload)
        },
      )
      .subscribe((estado: string) => {
        if (estado === 'SUBSCRIBED') {
          if (huboCaida) { huboCaida = false; refetch() }
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
      refetch()
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
     salvo cerrar el modal y entrar por el botón «Nuevo evento». */
  function handleDateClick(arg: DateClickArg) {
    // Fase 8.2: bloqueo creación de citas si suscripción cancelada con >5 pacientes
    if (subState.isBlocked) { openBloqueoModal(); return }
    const start = arg.date.toISOString()
    if (!isWithinBusinessHours(arg.date, horario)) {
      setConfirm({
        message: '¿La consulta se agendará fuera del horario de consulta. ¿Desea continuar?',
        onConfirm: () => { setConfirm(null); setModal({ mode: 'create', start, end: addHour(start), tipo: 'cita' }) },
        onCancel:  () => setConfirm(null),
      })
      return
    }
    setModal({ mode: 'create', start, end: addHour(start), tipo: 'cita' })
  }

  function handleSelect(arg: DateSelectArg) {
    // Fase 8.2: idem handleDateClick
    if (subState.isBlocked) { openBloqueoModal(); return }
    if (!isWithinBusinessHours(arg.start, horario)) {
      setConfirm({
        message: 'La consulta se agendará fuera del horario de consulta. ¿Desea continuar?',
        onConfirm: () => { setConfirm(null); setModal({ mode: 'create', start: arg.startStr, end: arg.endStr, tipo: 'cita' }) },
        onCancel:  () => setConfirm(null),
      })
      return
    }
    setModal({ mode: 'create', start: arg.startStr, end: arg.endStr, tipo: 'cita' })
  }

  function handleEventClick(arg: EventClickArg) {
    if (arg.event.extendedProps.isGcalBlock) return
    setModal({ mode: 'edit', appointment: arg.event.extendedProps as Appointment })
  }

  async function handleEventDrop(arg: EventDropArg) {
    if (arg.event.extendedProps.isGcalBlock) { arg.revert(); return }
    const id         = arg.event.id
    const start_time = arg.event.start?.toISOString()
    const end_time   = arg.event.end?.toISOString()

    if (!start_time) { arg.revert(); return }

    if (!isWithinBusinessHours(arg.event.start!, horario)) {
      setConfirm({
        message: 'La consulta se movió fuera del horario de consulta. ¿Está seguro?',
        onConfirm: () => { setConfirm(null); ejecutarDrop(id, start_time, end_time, arg) },
        onCancel:  () => { setConfirm(null); arg.revert() },
      })
      return
    }

    // Sin updated_at — drag & drop no requiere chequeo de concurrencia
    // FullCalendar ya movió el evento visualmente — solo sincronizar con servidor
    ejecutarDrop(id, start_time, end_time, arg)
  }

  async function ejecutarDrop(id: string, start_time: string, end_time: string | undefined, arg: EventDropArg | EventResizeDoneArg) {
    // Guarda: un id temporal no existe en la base, el PUT devolveria un error
    // sin sentido. El evento optimista ya nace con `editable: false`, asi que
    // esto solo cubre cualquier camino futuro que se nos escape.
    if (id.startsWith(PREFIJO_OPTIMISTA)) { arg.revert(); return }

    const res = await fetch(`/api/appointments/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      // `client_id` firma la escritura para que el eco de Realtime se
      // reconozca como propio (ver `firmarEscritura`).
      body:    JSON.stringify({ start_time, end_time, client_id: firmarEscritura() }),
    })

    if (!res.ok) {
      arg.revert()
      const { error, message } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(message || error || 'Error de conexión — cita devuelta a su horario original')
      return
    }

    toast.success('Cita reagendada')

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
    const id         = arg.event.id
    const start_time = arg.event.start?.toISOString()
    const end_time   = arg.event.end?.toISOString()
    if (!start_time) { arg.revert(); return }
    ejecutarDrop(id, start_time, end_time, arg)
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

  async function handleSave(data: Partial<Appointment> & { id?: string }) {
    const isEdit = !!data.id
    const api = calendarRef.current?.getApi()

    // ── Optimistic update: inyectar/actualizar evento en FullCalendar al instante ──
    closeModal()
    toast.success(isEdit ? 'Cita actualizada' : 'Cita agendada correctamente')
    if (!isEdit) setCitaCreada(true)

    let optimisticEvent: ReturnType<NonNullable<typeof api>['addEvent']> | null = null

    if (api) {
      if (isEdit) {
        // Actualizar el evento existente in-place
        const existing = api.getEventById(data.id!)
        if (existing) {
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
    const res = await fetch(
      isEdit ? `/api/appointments/${data.id}` : '/api/appointments',
      {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, client_id: firmarEscritura() }),
      }
    )

    if (!res.ok) {
      // Rollback: remover evento optimista y refrescar desde servidor
      if (optimisticEvent) optimisticEvent.remove()
      refetch()
      const { error, message } = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(message || error || 'No se pudo guardar la cita')
      return
    }

    const json = await res.json()

    if (isEdit && json.appointment) {
      aplicarAppointmentAlEvento(json.appointment)
    }

    if (!isEdit && optimisticEvent && json.appointment?.id) {
      // Reemplazar evento optimista con el real (que tiene ID de DB). Si un
      // refetch corrio durante el POST, la cita ya llego del servidor: hay que
      // re-hidratarla, no agregarla de nuevo — serian dos con el mismo id.
      optimisticEvent.remove()
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
    toast.success('Cita eliminada')

    // Optimistic: remover evento del calendario al instante.
    // Sin firma de escritura, y no hace falta: el eco de un DELETE llega
    // podado a `{ id }` —la RLS no puede evaluarse sobre una fila que ya no
    // existe—, así que ni siquiera traería el `client_id`. Como esta baja ya
    // quitó el evento, su propio eco no encuentra nada que quitar.
    const api = calendarRef.current?.getApi()
    const existing = api?.getEventById(id)
    existing?.remove()

    const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      // Rollback: restaurar estado desde servidor
      refetch()
      toast.error('No se pudo eliminar la cita')
    }
  }

  // Header de día apilado para Semana/Día. Mes (sub-fase 7) conserva su
  // header por defecto devolviendo arg.text sin tocar. El estado "inhábil"
  // se deriva del MISMO objeto `horario` que alimenta businessHours (no se
  // inventa lógica de horario): un día es hábil si horario[dia].activo === true.
  function renderDayHeader(arg: DayHeaderContentArg) {
    if (arg.view.type === 'dayGridMonth') return arg.text

    const diaInfo = DIAS.find(d => d.fc === arg.date.getDay())
    const habil   = diaInfo ? (horario[diaInfo.key]?.activo ?? false) : false
    const abbr    = diaInfo ? diaInfo.label.slice(0, 3).toUpperCase() : arg.text

    // Color por estado: HOY (blanco) > inhábil (atenuado) > hábil normal.
    let dowColor: string, numColor: string
    if (arg.isToday)  { dowColor = 'rgba(255,255,255,.72)'; numColor = '#fff' }
    else if (!habil)  { dowColor = 'var(--ag-faint)';       numColor = 'var(--ag-muted2)' }
    else              { dowColor = 'var(--ag-muted)';       numColor = 'var(--ag-text)' }

    return (
      <span className="ag-dayhead">
        <span className="ag-dayhead-dow" style={{ color: dowColor }}>{abbr}</span>
        <span className="ag-dayhead-num" style={{ color: numColor }}>{arg.date.getDate()}</span>
      </span>
    )
  }

  return (
    <div className="flex flex-col">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Agenda</h1>
          <p className="text-sm text-[#86868b] mt-0.5">Gestión de citas clínicas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Segmented control de vistas — desktop only (móvil queda fijo en Día,
              igual que hoy). Sincronizado con la vista real vía datesSet. */}
          {!isMobile && (
            <div
              role="tablist"
              aria-label="Vista del calendario"
              className="inline-flex"
              style={{ background: 'var(--ag-segment-bg)', borderRadius: 10, padding: 3, gap: 2 }}
            >
              {VIEWS.map(v => {
                const active = currentView === v.type
                const Ico = v.icon
                return (
                  <button
                    key={v.type}
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      const api = calendarRef.current?.getApi()
                      if (!api) return
                      api.changeView(v.type)
                      setCurrentView(v.type)
                    }}
                    className={`inline-flex items-center gap-1.5 transition-all ${active ? '' : 'hover:opacity-70'}`}
                    style={{
                      border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 13px',
                      fontSize: 12.5, fontWeight: active ? 700 : 600,
                      ...(active
                        ? { background: 'var(--ag-segment-active-bg)', color: 'var(--ag-segment-active-text)', boxShadow: 'var(--ag-segment-active-shadow)' }
                        : { background: 'transparent', color: 'var(--ag-segment-text)' }),
                    }}
                  >
                    <Ico size={15} />
                    {v.label}
                  </button>
                )
              })}
            </div>
          )}
          {/* Filtro por médico — solo en modo multi-doctor */}
          {!isSingleDoctor && (
            <div className="relative">
              <select
                value={filtroMedico}
                onChange={e => setFiltroMedico(e.target.value)}
                className="appearance-none pl-3 pr-9 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
              >
                <option value="">Todos los médicos</option>
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
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
              title="Configurar horario de consulta"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Horario</span>
            </button>
          )}
          {/* ── DOS PUERTAS, NO UN SELECTOR ESCONDIDO ──────────────────────
              El tipo se elige al entrar y ya no se cambia (ver `TipoFila`), así
              que la puerta ES la elección. Un segmento dentro del modal haría
              lo mismo con un paso más y con la duda de qué se está creando
              mientras se rellena.

              Este botón es secundario a propósito: agendar es lo que la agenda
              hace todo el día; bloquear un hueco o apuntar una junta, no.

              Arrastrar sobre el calendario y pulsar en un hueco siguen abriendo
              CITA — es lo que espera quien hace ese gesto.

              ── ⚠️ ANOTACIÓN 2026-08-22 — «NI UN SELECTOR ESCONDIDO» YA NO ES
              EXACTO, Y LO QUE IMPORTA DE ESTE COMENTARIO SIGUE SIÉNDOLO ──────
              Todo lo de arriba se mantiene: estos dos botones siguen siendo las
              dos puertas, el hueco y el arrastre siguen abriendo CITA, y en
              EDICIÓN el tipo sigue sin poder cambiarse.

              Lo que dejó de ser cierto es que no haya ningún control: EN EL ALTA
              hay uno, de dos posiciones, arriba del todo del modal. Se añadió
              porque quien entra pulsando un hueco —que es la vía más usada— no
              tenía forma de cambiar de idea sin cerrar y volver por la otra
              puerta.

              Y no contradice el motivo de aquella decisión, que era que cambiar
              el tipo sería quitarle el paciente a una cita por una puerta
              lateral (§12.18). Ese motivo presupone UNA FILA QUE YA EXISTE; en
              el alta no la hay, así que no se convierte nada: se elige qué se va
              a crear. En edición, donde el motivo sí aplica, no hay control. */}
          <button
            onClick={() => {
              if (subState.isBlocked) { openBloqueoModal(); return }
              const now = new Date().toISOString()
              setModal({ mode: 'create', start: now, end: addHour(now), tipo: 'evento' })
            }}
            title="Cirugía, reunión, bloqueo de horario — sin paciente ligado"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors bg-[var(--ag-surface)] border border-[var(--ag-border-card)] text-[var(--ag-text)] hover:bg-[var(--ag-bg-app)]"
          >
            <CalendarPlus size={15} />
            <span className="hidden sm:inline">Nuevo evento</span>
          </button>
          <button
            onClick={() => {
              if (subState.isBlocked) { openBloqueoModal(); return }
              const now = new Date().toISOString()
              setModal({ mode: 'create', start: now, end: addHour(now), tipo: 'cita' })
            }}
            data-onboard="nueva-cita"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:brightness-95 bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))]"
          >
            <Plus size={15} />
            Nueva cita
          </button>
        </div>
      </div>

      {citaCreada && <div data-onboard="cita-creada" className="hidden" />}

      {/* ── Leyenda ─────────────────────────────────────── */}
      {/* Solo single-doctor: leyenda por estado. La leyenda multi-doctor
          (puntos de color por médico) se eliminó: las tarjetas ya no se
          colorean por médico, así que prometía un código de color inexistente. */}
      {isSingleDoctor && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                /* Los MISMOS tokens que pinta la tarjeta, y con el mismo
                   reparto: relleno de `-bg`, barra izquierda de `-dot` (que es
                   lo que la tarjeta usa en su `borderLeft`, no `-border`). Antes
                   salían de una paleta aparte de hexes, y por eso la leyenda
                   enseñaba «No asistió» en naranja mientras la tarjeta lo
                   pintaba gris. */
                style={{ backgroundColor: `var(--ag-status-${key}-bg)`, borderLeft: `3px solid var(--ag-status-${key}-dot)` }}
              />
              <span className="text-[11px] text-[#86868b] font-medium">{cfg.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Calendario ──────────────────────────────────── */}
      <div className="agenda-fc bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ minHeight: '70vh' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          locale={esLocale}
          headerToolbar={isMobile
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'prev,next today', center: 'title', right: '' }
          }
          datesSet={arg => setCurrentView(arg.view.type)}
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          dayMaxEvents={3}
          nowIndicator
          selectable
          selectMirror
          editable
          dragRevertDuration={200}
          eventResizableFromStart
          businessHours={horarioToBusinessHours(horario)}
          eventSources={eventSourcesStable}
          dayHeaderContent={renderDayHeader}
          eventContent={renderEC}
          dateClick={handleDateClick}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          height="auto"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }}
        />
      </div>

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
             también monta limpio, que es lo que ya se esperaba. */
          key={modal.mode === 'create' ? modal.tipo : modal.appointment.id}
          modal={modal}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
          medicos={medicos}
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
          onClose={() => setHorarioOpen(false)}
          onSave={async (h) => {
            const res = await fetch('/api/me/horario', {
              method:  'PUT',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ horario: h }),
            })
            if (res.ok) {
              // El horario vive ya en el agregado: se escribe su rebanada en
              // el cache en vez de en un estado local paralelo.
              mutarConfig(c => c ? { ...c, horario: h } : c, { revalidate: false })
              setHorarioOpen(false)
              toast.success('Horario actualizado')
            } else {
              toast.error('No se pudo guardar el horario')
            }
          }}
        />
      )}
    </div>
  )
}
