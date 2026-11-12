'use client'

/**
 * src/components/agenda/AppointmentModal.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.3, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 *
 * `ModalState`, `TodoElDiaInicial`, `PacienteBusqueda` y `Medico` se exportan
 * desde aquí porque, además del modal, `AgendaCliente.tsx` y la banda móvil
 * los siguen usando directamente (el `useState<ModalState>` de la página, los
 * tres componentes que reciben `medicos: readonly Medico[]`). Son sólo TIPOS
 * y un `import type` se borra en compilación, así que no pesan en ningún
 * bundle.
 *
 * ⚠️ `DEFAULT_DURATION` YA NO VIVE AQUÍ (A2.6): se movió a
 * `src/lib/agenda/duracionCita.ts` porque `AgendaCliente.tsx` la usa como
 * VALOR, no como tipo, y este módulo ahora se carga con `next/dynamic` — un
 * `import` de valor desde aquí habría obligado a cargarlo entero de forma
 * estática. Ver el comentario de ese archivo.
 */

import { useEffect, useId, useState } from 'react'
import {
  X, Calendar, Plus, Trash2, ChevronDown, FileText, Stethoscope, Loader2, Mail, CalendarPlus, CalendarX,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Portal from '@/components/ui/Portal'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultoriosDeMedico } from '@/hooks/useConsultoriosDeMedico'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { ICONOS_EVENTO, COLORES_EVENTO, type IconoEvento, type ColorEvento } from '@/lib/appointments'
import { IconoDelEvento } from '@/components/agenda/IconoDelEvento'
import { desplazarFecha } from '@/lib/dates'
import type { Horario } from '@/lib/configApp'
import type { Status, Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
import { avisoFueraDeHorario, avisoFinFueraDeHorario, avisoDiaCerrado } from '@/lib/agenda/horarioAgenda'
import {
  addMinutes, partirFechaHora, componerIso, diasEntreFechas, duracionEscrita, fechasDeTodoElDia,
} from '@/lib/agenda/fechasAgenda'
import { ESTADOS_CITA, ICONO_ETIQUETA, COLOR_ETIQUETA, STATUS_CONFIG, esEventoGenerico, esPorLigar } from '@/lib/agenda/tarjetasAgenda'
import BloqueReservaPorLigar from '@/components/agenda/BloqueReservaPorLigar'
import PanelLigarCita from '@/components/agenda/PanelLigarCita'
import { ligarCitaAPaciente, type PacienteParaLigar } from '@/lib/agenda/ligarCita'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import { DEFAULT_DURATION } from '@/lib/agenda/duracionCita'
import { ESTADOS_SIN_EMPALME, mensajeEmpalme, type Empalme, type TramoCita } from '@/lib/agenda/empalmesCita'
/* B6c: SÓLO EL TIPO. `tiposCita.ts` trae Zod en valor, y este modal se carga
   en diferido (A2.6): un import de valor de ahí lo metería en este chunk. */
import type { TipoCita } from '@/lib/agenda/tiposCita'

export type PacienteBusqueda = { id: string; nombre: string; apellidos: string; telefono: string | null }

export type Medico = { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null; especialidad?: string | null }

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

export type ModalState =
  | { mode: 'closed' }
  /* ⚠️ LA FECHA Y LA HORA VIAJAN SEPARADAS, Y `hora: null` ES UN VALOR CON
     SIGNIFICADO: «el usuario eligió un DÍA, no un momento». Lo produce la vista
     Mes, donde pulsar una celda sólo aporta el día; el modal abre entonces con
     la fecha puesta y la hora en blanco, para que se escriba sin borrar nada.
     Antes esto era un único `start: string` y había que inventarse una hora
     para rellenarlo — la apertura de la clínica, o las 00:00 —, que es
     exactamente el dato que el usuario no dio. Un `string | null` lo dice sin
     inventar nada, y el compilador obliga a decidir qué hacer con el null.

     El formato es el de los dos controles del modal, no ISO: `fecha` es
     `YYYY-MM-DD` y `hora` es `HH:MM`. Así el modal no parsea nada al abrir, y
     quien trae un instante lo parte una vez con `partirFechaHora`.

     ⚠️ EL FIN VOLVIÓ, PERO NO AQUÍ. Aquí vivió un `end: string` que no leía
     nadie —el fin salía siempre de `start_time + duration` en `guardar()`— y se
     retiró por eso. El bloque 5B lo repone COMO CAMPO DEL FORMULARIO, no como
     campo de este estado, y la distinción es la que hace que el aviso siga
     valiendo: este tipo describe CON QUÉ SE ABRE el modal, y ninguna de las
     rutas de apertura aporta un fin.
     Lo consumen hoy los `useState` `fechaFin` y `horaFin` de
     `AppointmentModal`, que siembra `valoresInicialesDelModal` por tres vías, y
     son la ÚNICA verdad del fin: los chips de duración escriben en ellos y
     `guardar()` compone `end_time` a partir de ellos. Las tres vías, porque no
     hacen lo mismo: en EDICIÓN el fin sale de `apt.end_time`; en el alta CON
     hora, de `hora`+`DEFAULT_DURATION`; y en el alta SIN hora —vista Mes y banda
     de todo el día— NO se propone ningún fin: se siembra `fechaFin` con el mismo
     día y `horaFin` en `''`, y el `DEFAULT_DURATION` lo aporta después
     `moverInicio`, cuando ya hay un inicio del que colgarlo. Reponer un `end`
     aquí volvería a crear un dato que nadie lee, porque el fin ya no se hereda
     de la apertura.
     Lo que sigue perdido, y conviene saberlo antes de "arreglarlo": ARRASTRAR
     DE 10:00 A 12:00 NO ABRE UNA CITA DE DOS HORAS. El `endStr` del arrastre SÍ
     llega hasta `abrirAlta` —`handleSelect` se lo pasa como `finParaAvisar`—,
     pero ahí muere: se usa sólo para el aviso de fuera de horario y NO entra en
     el `setModal`, así que el modal abre con `DEFAULT_DURATION` (60 min), como
     todas. Es anterior a esto y sigue igual; para respetar la duración
     arrastrada hace falta que `abrirAlta` convierta ese fin en una DURACIÓN, que
     la meta en el `setModal`, y que `valoresInicialesDelModal` la use en vez de
     la constante.

     `todoElDia` es CON QUÉ INTERRUPTOR SE ABRE. Ver `TodoElDiaInicial`.

     ⚠️ `fechaFin` ES LA ÚNICA EXCEPCIÓN AL AVISO DE ARRIBA, Y NO LO CONTRADICE.
     Aquel aviso dice que el fin NO viaja en este estado porque ninguna ruta de
     apertura aporta uno, y sigue siendo cierto de LAS CITAS: su fin se deriva
     de `hora + DEFAULT_DURATION`, así que heredarlo sería inventar un dato.
     El ÚLTIMO DÍA de un evento de todo el día no se deriva de nada — arrastrar
     del 19 al 22 sobre la banda es la única forma de decirlo, y sin este campo
     esa información se perdía entre `handleSelect` y el modal, que abría con
     los dos días iguales.
     Es fecha-sola (`YYYY-MM-DD`) y es el ÚLTIMO DÍA INCLUIDO, no el fin
     exclusivo: el mismo formato y el mismo significado que el campo del modal
     donde acaba. Sólo lo pone el gesto sobre la BANDA.

     ⚠️ `paciente` LO PONE UNA SOLA RUTA DE APERTURA: el enlace profundo
     `/agenda?cita=nueva&paciente=<uuid>`, que llega desde fuera con el paciente
     ya decidido. Ninguno de los gestos sobre la rejilla lo aporta —ahí se elige
     dentro del modal— y por eso es opcional. No lo conviertas en obligatorio ni
     lo siembres con `null` desde los demás `setModal`: `undefined` significa
     «esta ruta no trae paciente», que no es lo mismo que «se eligió ninguno». */
  | { mode: 'create'; fecha: string; hora: string | null; tipo: TipoFila; todoElDia: TodoElDiaInicial; fechaFin?: string; paciente?: PacienteBusqueda }
  | { mode: 'edit';   appointment: Appointment }

/**
 * Con qué interruptor de «todo el día» abre el alta, y si se puede tocar.
 *
 * · `'no'`   — apagado y suelto. Es lo normal: el botón «Agendar», el clic en
 *              una celda de la vista MES y el clic o el arrastre sobre la
 *              rejilla horaria. Desde ahí se puede encender a mano.
 * · `'fijo'` — encendido Y BLOQUEADO, con la posición «Cita» del conmutador
 *              deshabilitada. Sólo lo produce el gesto sobre la BANDA de todo
 *              el día de Semana o Día, y el bloqueo es lo que significa esa
 *              banda: ahí no se crea nada con hora.
 *
 * ⚠️ NO ES UN BOOLEANO, Y NO LO CONVIERTAS EN DOS. «Encendido» y «bloqueado»
 * son hoy la misma cosa —sólo la banda enciende, y la banda bloquea—, así que
 * dos booleanos admitirían el estado imposible «apagado pero bloqueado». No hay
 * un tercer valor «encendido pero suelto» porque no hay quien lo produzca; el
 * día que lo haya se añade aquí y `todoElDiaFijo` deja de ser `=== 'fijo'`.
 */
export type TodoElDiaInicial = 'no' | 'fijo'

/* ─── Colores por estado ───────────────────────────────── */


/* Los estados que el usuario puede elegir A MANO, por tipo de fila (§12.13, D5).
   Una CITA los enseña los cinco. Un EVENTO GENÉRICO sólo dos: «No asistió» o
   «Atendida» no significan nada sobre una junta de personal, y ofrecerlos sería
   fingir que sí. El orden es el de `STATUS_CONFIG`, que es el que el selector
   pintaba antes de que hubiera dos listas. */
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
 * ⚠️ LA ROTACIÓN QUE ESTE AVISO ANUNCIABA YA OCURRIÓ (bloque 2B): ámbar es
 * «agendada», azul «confirmada» y verde «atendida». El aviso hizo su trabajo —el
 * verde de acuse de `ModalInvitacionCita.tsx` se desenganchó a `--ag-success-*`
 * antes de rotar, y por eso no amaneció azul—.
 *
 * ⚠️ LO QUE QUEDA VIVO DE AQUEL AVISO, como deuda declarada: ese mismo modal
 * sigue usando `--ag-status-no_show-*` como gris de advertencia y
 * `--ag-status-cancelled-*` como rojo de error, y ninguno de esos dos paneles
 * habla del estado de una cita. Sobrevivieron a esta rotación por suerte —esos
 * dos estados no cambiaron de color—, no por estar bien. Si algún día se toca el
 * gris o el rojo, hay que desengancharlos primero, a `--ag-warning-*` y
 * `--ag-danger-*`, igual que se hizo con el verde.
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

/* Las dos posiciones del control del alta. `Record<TipoFila, …>` no sirve aquí
   —hace falta el ORDEN, y la cita va primera porque es lo que la agenda hace
   todo el día—, así que la exhaustividad la da el tipo de cada `id`. */
const TIPOS_ALTA: ReadonlyArray<{ id: TipoFila; label: string; icono: LucideIcon }> = [
  { id: 'cita',   label: 'Cita',   icono: Calendar },
  { id: 'evento', label: 'Evento', icono: CalendarPlus },
]

/* ─── Duraciones disponibles (minutos) ─────────────────── */

const DURATIONS = [
  { label: '15 min', value: 15  },
  { label: '30 min', value: 30  },
  { label: '45 min', value: 45  },
  { label: '1 hora', value: 60  },
  { label: '1:30 h', value: 90  },
  { label: '2 horas', value: 120 },
]

type ValoresIniciales = { fecha: string; hora: string; fechaFin: string; horaFin: string }

/**
 * Lo que llevan los CUATRO campos de fecha y hora al abrir el modal.
 *
 * Vive fuera del componente porque no lee nada suyo, y junta en un solo sitio
 * las tres siembras que antes estaban repartidas: la fila en edición, el alta
 * con hora y el alta sin ella. El fin no viaja en `ModalState` (ver su aviso),
 * así que en el alta se PROPONE, nunca se hereda.
 */
function valoresInicialesDelModal(modal: ModalState, todoElDia: boolean): ValoresIniciales {
  if (modal.mode === 'edit') {
    const apt = modal.appointment
    if (todoElDia) {
      const { fecha, fechaFin } = fechasDeTodoElDia(apt)
      return { fecha, hora: '', fechaFin, horaFin: '' }
    }
    const ini = partirFechaHora(apt.start_time)
    const fin = partirFechaHora(apt.end_time)
    return { fecha: ini.fecha, hora: ini.hora, fechaFin: fin.fecha, horaFin: fin.hora }
  }
  if (modal.mode !== 'create') return { fecha: '', hora: '', fechaFin: '', horaFin: '' }
  /* Sin hora —vista Mes y banda de todo el día— no hay fin que proponer: el
     `DEFAULT_DURATION` necesita un inicio del que colgar, y aquí no lo hay. Lo
     rellena `moverInicio` en cuanto se teclee la hora. */
  const hora = todoElDia ? '' : (modal.hora ?? '')
  /* `modal.fechaFin` sólo llega desde el arrastre sobre la banda; el clic suelto
     y la vista Mes no lo traen y el fin se propone igual al inicio, como siempre. */
  if (!hora) return { fecha: modal.fecha, hora: '', fechaFin: modal.fechaFin ?? modal.fecha, horaFin: '' }
  const fin = partirFechaHora(addMinutes(componerIso(modal.fecha, hora), DEFAULT_DURATION))
  return { fecha: modal.fecha, hora, fechaFin: fin.fecha, horaFin: fin.hora }
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

/* ─── B6c: los tipos de cita del médico ───────────────────
   `GET /api/agenda/tipos-cita?medico_id=` devuelve los activos de la clínica y
   los personales de ese médico (la RLS quita los que no se ven). `medicoId`
   vacío = no se pide nada (interruptor apagado, o un evento). `null` = aún sin
   lista para ESE médico; si la petición falla, lista vacía: el tipo es
   opcional y la cita se guarda sin él. El estado recuerda para qué médico es,
   así un cambio de médico no enseña la lista del anterior. */
function useTiposCita(medicoId: string): TipoCita[] | null {
  const [cargados, setCargados] = useState<{ medicoId: string; tipos: TipoCita[] } | null>(null)

  useEffect(() => {
    if (!medicoId) return
    const control = new AbortController()
    fetch(`/api/agenda/tipos-cita?medico_id=${encodeURIComponent(medicoId)}`, { signal: control.signal })
      .then(r => (r.ok ? r.json() : { tipos: [] }))
      .then((j: { tipos?: TipoCita[] }) => setCargados({ medicoId, tipos: j.tipos ?? [] }))
      .catch(() => { if (!control.signal.aborted) setCargados({ medicoId, tipos: [] }) })
    return () => control.abort()
  }, [medicoId])

  return medicoId && cargados?.medicoId === medicoId ? cargados.tipos : null
}

export default function AppointmentModal({
  modal, onClose, onSave, onDelete, medicos, defaultMedicoId,
  hideMedicoDropdown, medicoDropdownRequired, canVerExpediente, canInvitar, onInvitar,
  onCambiarTipo, horario, agendaV2 = false, onCancelarCita, buscarEmpalmes,
}: {
  modal: ModalState
  onClose: () => void
  onSave: (data: DatosGuardado) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /* B3: el interruptor de la agenda v2 y la cancelación que sustituye al
     borrado de una cita con paciente. Sin ellos —o con el interruptor
     apagado— la papelera y la X borran como siempre. */
  agendaV2?: boolean
  onCancelarCita?: (id: string) => Promise<void>
  /* B7c: los empalmes de una cita contra lo PINTADO en la rejilla. Sólo llega
     con el interruptor encendido; sin él no se pregunta nada. Lo que no está
     pintado lo dice el servidor con un 409 (ver `handleSave` de la página). */
  buscarEmpalmes?: (cita: TramoCita) => Empalme[]
  medicos: Medico[]
  defaultMedicoId: string
  /* El horario de consulta, para el aviso de fuera de horario. Hasta ahora ese
     aviso sólo existía en el GESTO sobre la rejilla (pulsar un hueco,
     arrastrar), donde la hora la pone el sitio donde caes; por el formulario se
     tecleaba cualquier hora y nadie decía nada. Ver `avisoFueraDeHorario`. */
  horario: Horario
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
  /* D6 · Una cita POR LIGAR (reserva por enlace sin paciente) es una CITA
     (`tipo` ya vale 'cita' por `esEventoGenerico`) a la que todavía le falta
     el paciente. Se edita sin él: conserva su título (el nombre de quien
     reservó) y no manda `paciente_id`. Se liga al iniciar la consulta (D7). */
  const reserva = apt && esPorLigar(apt) ? apt : null

  /* EL INTERRUPTOR DE TODO EL DÍA, y la guarda que impide que exista fuera de un
     evento. `esEvento &&` no es defensa de más: al cambiar de rama el modal
     REMONTA leyendo `modal.todoElDia`, que sigue en `true` si se abrió desde la
     banda, y sin esta conjunción la rama de cita arrancaría con un interruptor
     encendido que ni siquiera se pinta. Con ella, cambiar a cita lo apaga solo.
     (Hoy no existe ninguna fila con `all_day` y paciente, y el segmento no deja
     crearla; si algún día llegara una, se abriría como cita con hora.) */
  const todoElDiaInicial = esEvento && (
    modal.mode === 'create' ? modal.todoElDia === 'fijo' : (apt?.all_day ?? false)
  )

  /* EL INTERRUPTOR NO SE PUEDE APAGAR, y con él la posición «Cita» queda
     deshabilitada durante todo el modal. Es lo que significa haber entrado por
     la BANDA de todo el día: ahí no se crea nada con hora, así que ofrecer el
     camino de vuelta sería ofrecer salir de la banda sin haberla dejado.
     Por las demás vías esto es `false` y el interruptor se toca con normalidad
     —incluida la de encenderlo a mano desde el mes—. */
  const todoElDiaFijo = esEvento && modal.mode === 'create' && modal.todoElDia === 'fijo'

  /* LA FECHA Y LA HORA SON DOS ESTADOS, no uno. El campo era un único
     `datetime-local` y se partió porque ese control NO PUEDE sostener una fecha
     sin hora: asignarle «2026-08-19» lo deja en cadena vacía y se lleva la fecha
     por delante (medido en navegador). La vista Mes necesita justo eso —día sí,
     hora no—, así que el control se partió en dos y el estado con él.
     `hora` en `''` es el estado nuevo y legítimo: hay día elegido y falta la
     hora. Lo cubren la guarda de `handleSave` y el `disabled` del botón.

     Y AHORA SON CUATRO, porque el FIN volvió a ser un campo: `fechaFin` y
     `horaFin` son la verdad del fin, y los chips de duración sólo escriben en
     ellos (ver `escribirFinConChip`). En todo el día las dos horas se quedan en
     `''` y no se pintan; `fechaFin` enseña el ÚLTIMO DÍA INCLUIDO. */
  const inicial = valoresInicialesDelModal(modal, todoElDiaInicial)
  const [fecha,     setFecha]     = useState(inicial.fecha)
  const [hora,      setHora]      = useState(inicial.hora)
  const [fechaFin,  setFechaFin]  = useState(inicial.fechaFin)
  const [horaFin,   setHoraFin]   = useState(inicial.horaFin)
  const [todoElDia, setTodoElDia] = useState(todoElDiaInicial)
  const [notes,       setNotes]       = useState(apt?.notes ?? '')
  const [status,      setStatus]      = useState<Status>(apt?.status ?? 'scheduled')
  /* Dos siembras, una por modo. En EDICIÓN sale de la fila; en ALTA sale de
     `modal.paciente`, que sólo trae el enlace profundo y en los demás casos es
     `undefined` → `null`, o sea el buscador en blanco de siempre.
     Va en el valor inicial del `useState` y no en un efecto a propósito: el
     modal se remonta por `key` al cambiar de tipo (ver la nota de la `key` en
     `AgendaPage`), y sembrar aquí es lo que hace que ese remonte vuelva a poner
     el paciente en vez de perderlo. */
  const [paciente,    setPaciente]    = useState<PacienteBusqueda | null>(
    apt?.pacientes
      ? { id: apt.pacientes.id, nombre: apt.pacientes.nombre, apellidos: apt.pacientes.apellidos, telefono: apt.pacientes.telefono ?? null }
      : (modal.mode === 'create' ? modal.paciente ?? null : null)
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
  /* B6c: el tipo ELEGIDO. Lo que se guarda es `tipoEfectivo`, de más abajo. */
  const [tipoCitaId,  setTipoCitaId]  = useState<string | null>(apt?.tipo_cita_id ?? null)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  /* La alerta de la X del paciente. Ver el botón, más abajo. */
  const [quitarPaciente, setQuitarPaciente] = useState(false)
  /* B3: con el interruptor encendido, una CITA ya guardada no se borra: la
     papelera y la X la cancelan. `yaCancelada` mira la FILA, no el selector
     de estado del formulario: lo que no se puede es borrar lo guardado. Una
     cita ya cancelada no ofrece ni lo uno ni lo otro (P4: con paciente no se
     borra nunca, y cancelarla otra vez no cambia nada). */
  const cancelaEnVezDeBorrar = agendaV2 && isEdit && !esEvento && onCancelarCita !== undefined
  const yaCancelada = apt?.status === 'cancelled'
  /* El aviso de fuera de horario ya redactado, o `null`. Guardar la FRASE y no
     un booleano es lo que deja que el mismo estado sirva para el inicio y para
     el fin sin tener que volver a decidir cuál de los dos falló. */
  const [avisoHorario, setAvisoHorario] = useState<string | null>(null)
  /* B7c: el aviso de empalme ya redactado y los ids que se aceptan con él. */
  const [avisoEmpalme, setAvisoEmpalme] = useState<{ mensaje: string; ids: string[] } | null>(null)

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
  /* D7: en una cita POR LIGAR, «Iniciar consulta» sale con las mismas
     condiciones sin exigir paciente (sólo con v2: el ligado se audita y se
     valida en el servidor con el interruptor), y en vez de navegar pide
     primero ligarla (`ligar`, abajo). */
  const showLigarYConsultar = Boolean(
    isEdit && canVerExpediente && reserva && !paciente && agendaV2 &&
    defaultMedicoId === apt?.medico_id && citaConsultorio,
  )
  const router = useRouter()
  /* `null` = el bloque de la reserva; con valor, el panel «Ligar a un paciente». */
  const [ligar, setLigar] = useState<{ enviando: boolean; error: string | null } | null>(null)
  function abrirLigar(): void {
    setLigar({ enviando: false, error: null })
    // El buscador compara nombre O apellidos: con el nombre completo no saldría nada.
    setSearch((reserva?.reserva_nombre ?? reserva?.title ?? '').trim().split(/\s+/)[0] ?? '')
  }
  /* Liga y, con 200, abre la nota con `?cita=` (así `/api/consultas` la pasa
     a atendida). Si falla, el panel lo dice y la cita sigue por ligar. */
  async function ligarYConsultar(p: PacienteParaLigar): Promise<void> {
    if (!apt || !citaConsultorio) return
    setLigar({ enviando: true, error: null })
    const r = await ligarCitaAPaciente({ citaId: apt.id, updatedAt: apt.updated_at, paciente: p })
    if (!r.ok) { setLigar({ enviando: false, error: r.motivo }); return }
    cambiarActivo(citaConsultorio)
    onClose()
    router.push(`/expediente/${p.id}/nueva-nota?cita=${apt.id}`)
  }

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

  /* ── B6c: TIPO DE CITA (P5), SÓLO CON EL INTERRUPTOR Y EN UNA CITA ─────────
     Apagado no se pide la lista ni viaja `tipo_cita_id`: el modal es el de
     siempre. `tipoEfectivo` es lo que se guarda, y se DERIVA en vez de
     limpiarse con un efecto: sin paciente no hay tipo (P5: sólo citas con
     paciente), y al cambiar de médico un tipo que no está en su lista cae a
     «sin tipo» (era de otro médico; el servidor daría 400). El que la cita YA
     tenía se conserva mientras el médico sea el mismo, aunque esté archivado:
     el servidor sólo exige `activo` a un tipo recién asignado. */
  const conTipos = agendaV2 && !esEvento
  const tiposCita = useTiposCita(conTipos ? medicoId : '')
  const tipoConservable = apt && medicoId === apt.medico_id ? (apt.tipo_cita_id ?? null) : null
  const tipoEfectivo: string | null = conTipos && (paciente || reserva) && tipoCitaId
    && (tipoCitaId === tipoConservable || tiposCita?.some(t => t.id === tipoCitaId)) ? tipoCitaId : null
  /* Las opciones del selector: «Sin tipo», el que la cita ya tenía si no viene
     en la lista (archivado, u oculto por la RLS), y la lista. Elegir uno de la
     lista escribe el fin como los botones de duración; los otros dos no tocan
     las horas. Con una sola opción («Sin tipo») el selector no se pinta. */
  const opcionesTipo: { id: string | null; nombre: string; color: ColorEvento | null; duracion: number | null; elegir: () => void }[] = [
    { id: null, nombre: 'Sin tipo', color: null, duracion: null, elegir: () => setTipoCitaId(null) },
    ...(tipoConservable && tiposCita && !tiposCita.some(t => t.id === tipoConservable)
      ? [{ id: tipoConservable, nombre: apt?.tipo_cita_nombre ?? 'Tipo actual', color: null, duracion: null,
           elegir: () => setTipoCitaId(tipoConservable) }]
      : []),
    ...(tiposCita ?? []).map(t => ({
      id: t.id, nombre: t.nombre, color: t.color, duracion: t.duracion_min,
      elegir: () => { setTipoCitaId(t.id); escribirFinConChip(t.duracion_min) },
    })),
  ]

  /* Lo mínimo para poder guardar, según el tipo. Una CITA necesita paciente; un
     EVENTO necesita título con algo escrito —`appointments.title` es NOT NULL y
     un título en blanco daría una tarjeta muda—. Se calcula aquí y no en dos
     sitios porque lo leen el botón (para apagarse) y `handleSave` (defensa en
     profundidad, por si el botón se saltara). */
  const tituloLimpio = titulo.trim()
  const faltaLoEsencial = esEvento ? tituloLimpio === '' : !paciente && !reserva

  /* Las puntas que el formulario exige, que dependen del interruptor: con todo
     el día encendido no hay horas que pedir, sólo los dos días. Apagado sigue
     exigiendo lo de siempre —`fecha` y `hora`— más el fin, que antes no podía
     faltar porque no era un campo y ahora sí puede: se puede vaciar a mano. */
  const faltanPuntas = todoElDia
    ? (!fecha || !fechaFin)
    : (!fecha || !hora || !fechaFin || !horaFin)

  /* El fin ANTES del inicio, que hasta ahora no podía ocurrir —el fin era
     `inicio + chip`— y con dos fechas tecleadas a mano sí. El `!faltanPuntas`
     va delante y CORTOCIRCUITA a propósito: `componerIso('', '')` da un `Date`
     inválido y `toISOString()` lanza.
     En todo el día el mismo día es válido —un evento de una jornada—, así que
     se compara `<` y no `<=`. */
  const finAntesDelInicio = todoElDia
    ? Boolean(fecha && fechaFin && fechaFin < fecha)
    : Boolean(!faltanPuntas && componerIso(fechaFin, horaFin) <= componerIso(fecha, hora))

  /* El chip marcado, o `null` si la hora tecleada no cuadra con ninguno. NO se
     redondea al más cercano: el campo es la verdad y un chip marcado de más
     diría que la duración es otra. */
  const duracionElegida = todoElDia ? null : duracionEscrita(fecha, hora, fechaFin, horaFin)

  /* Mover el INICIO arrastra el fin y CONSERVA LA DURACIÓN, que es como se
     comportaba este formulario cuando el fin salía de `inicio + duration`:
     cambiar la hora de una cita de 30 min la dejaba de 30 min. Sin esto,
     reagendar de 10:00 a 11:00 dejaría el fin en las 10:30 y el guardado
     bloqueado por `finAntesDelInicio`.
     Sin fin escrito —el alta desde la vista Mes— se propone `DEFAULT_DURATION`,
     que es lo que `valoresInicialesDelModal` no pudo hacer por no haber hora. */
  function moverInicio(nuevaFecha: string, nuevaHora: string) {
    setFecha(nuevaFecha)
    setHora(nuevaHora)
    if (!nuevaFecha || !nuevaHora) return
    const mins = duracionEscrita(fecha, hora, fechaFin, horaFin)
    const fin  = partirFechaHora(addMinutes(componerIso(nuevaFecha, nuevaHora), mins && mins > 0 ? mins : DEFAULT_DURATION))
    setFechaFin(fin.fecha)
    setHoraFin(fin.hora)
  }

  /* Lo mismo en todo el día, pero en DÍAS: mover el primer día corre el último
     con él y conserva cuántos dura. */
  function moverFechaDeTodoElDia(nueva: string) {
    setFecha(nueva)
    if (!nueva) return
    const dias = fecha && fechaFin ? diasEntreFechas(fecha, fechaFin) : 0
    setFechaFin(desplazarFecha(nueva, { dias: Math.max(dias, 0) }))
  }

  /* EL CHIP ES UN ATAJO QUE ESCRIBE EL FIN Y NO GUARDA NADA. Antes era al revés
     —el chip era el estado y el fin se derivaba de él—, y por eso no se podía
     teclear una duración que no estuviera en la lista.
     Escribe la fecha TAMBIÉN, y no es de más: dos horas sobre las 23:00 cruzan
     la medianoche. Poner sólo la hora dejaría el fin antes del inicio. */
  function escribirFinConChip(minutos: number) {
    if (!fecha || !hora) return
    const fin = partirFechaHora(addMinutes(componerIso(fecha, hora), minutos))
    setFechaFin(fin.fecha)
    setHoraFin(fin.hora)
  }

  /* El interruptor. Al ENCENDER, el último día se propone igual al primero. Al
     APAGAR vuelven las horas con lo que tuvieran escrito, y si no había nada
     —el clic en la banda abre sin hora— se propone la de AHORA más
     `DEFAULT_DURATION`: el mismo criterio del botón «Agendar» del toolbar, que
     también aporta la hora de ahora. Nunca `00:00`, que es la hora que nadie
     eligió y justo la que este formulario dejó de inventarse. */
  function alternarTodoElDia(siguiente: boolean) {
    /* Abierto desde la banda no hay nada que alternar. La guarda está aquí y no
       sólo en el `disabled` del botón porque este cuerpo es el que define el
       comportamiento; el atributo sólo lo enseña. */
    if (todoElDiaFijo) return
    setTodoElDia(siguiente)
    if (siguiente) { setFechaFin(fecha); return }
    const ahora  = partirFechaHora(new Date().toISOString())
    const inicio = hora || ahora.hora
    setHora(inicio)
    if (horaFin) return
    const fin = partirFechaHora(addMinutes(componerIso(fecha || ahora.fecha, inicio), DEFAULT_DURATION))
    setFechaFin(fin.fecha)
    setHoraFin(fin.hora)
  }

  async function handleSave() {
    /* `faltanPuntas` es el caso NUEVO: la vista Mes abre con fecha y sin hora, y
       la banda de todo el día abre sin ninguna de las dos, así que este
       formulario ya no arranca siempre completo. `fecha` no debería faltar nunca
       —todas las rutas traen día— pero entra en la misma frase: el día que
       alguien abra el modal de otra forma, esto aguanta. */
    if (faltaLoEsencial || faltanPuntas || finAntesDelInicio) return

    // Defensa en profundidad: secretaria debe seleccionar médico
    // (el `required` HTML5 ya bloquea el submit, pero validamos aquí también)
    if (medicoDropdownRequired && !medicoId) return
    if (!consultorioId) return  // F3-6: consultorio obligatorio

    /* El aviso de fuera de horario, que hasta ahora este formulario no daba.
       Se comprueba el INICIO y también el FIN: teclear 18:00 y terminar a las
       21:00 es exactamente el mismo error que arrastrar el borde de abajo hasta
       ahí.

       ⚠️ EN TODO EL DÍA NO SE PREGUNTA POR LA HORA, Y NO ES UN OLVIDO. Las dos
       puntas de un evento de todo el día son medianoche, así que
       `avisoFueraDeHorario` soltaría «vas a agendar a las 00:00» y
       `avisoFinFueraDeHorario` saltaría SIEMPRE —`00:00` no cae dentro del
       tramo de ninguna clínica—: dos frases sobre una hora que el usuario no
       eligió. Lo que sí tiene sentido preguntar es por el DÍA, y de eso se
       ocupa `avisoDiaCerrado`, que no menciona ninguna hora. Es el mismo reparto
       que ya hace `abrirAlta` en la ruta sin hora. */
    const aviso = todoElDia
      ? avisoDiaCerrado(new Date(componerIso(fecha, '12:00')), horario)
      : (avisoFueraDeHorario(new Date(componerIso(fecha, hora)), horario, 'Vas a agendar a las')
         ?? avisoFinFueraDeHorario(new Date(componerIso(fechaFin, horaFin)), horario))
    if (aviso) { setAvisoHorario(aviso); return }

    await seguirTrasHorario()
  }

  /* B7c: los empalmes de lo que está en el formulario, con las reglas de P3 y
     del PUT: en una EDICIÓN sólo si cambian el inicio, el fin o el médico, o
     la cita vuelve a ocupar su hueco (editar las notas de una cita que ya
     estaba empalmada no avisa). Todo el día y los estados que no ocupan, no. */
  function empalmesDelFormulario(): Empalme[] {
    if (!buscarEmpalmes || todoElDia || ESTADOS_SIN_EMPALME.includes(status) || !medicoId) return []
    const inicio = new Date(componerIso(fecha, hora))
    const fin    = new Date(componerIso(fechaFin, horaFin))
    if (apt) {
      const igual = inicio.getTime() === new Date(apt.start_time).getTime()
        && fin.getTime() === new Date(apt.end_time).getTime()
        && medicoId === apt.medico_id
        && !ESTADOS_SIN_EMPALME.includes(apt.status) && !apt.all_day
      if (igual) return []
    }
    return buscarEmpalmes({
      id: apt?.id ?? '', medicoId, inicio, fin, todoElDia: false, noOcupa: false, deGoogle: false, titulo: '',
    })
  }

  /* Después del aviso de horario, el de empalme: si aplican los dos salen
     seguidos (P3). El modal sigue abierto detrás; «Cancelar» vuelve a él. */
  async function seguirTrasHorario() {
    const lista = empalmesDelFormulario()
    if (lista.length) { setAvisoEmpalme({ mensaje: mensajeEmpalme(lista), ids: lista.map(e => e.id) }); return }
    await guardar()
  }

  async function guardar(empalmesAceptados: string[] = []) {
    setSaving(true)

    // F3-6: enviar consultorio_id en creación SIEMPRE; en edición SOLO si cambió.
    // Evita re-validación innecesaria del consultorio en el backend cuando se edita
    // hora/status sin tocar consultorio.
    const consultorioChanged = !apt || consultorioId !== apt.consultorio_id

    /* El interruptor sólo cuenta en un evento. Va por separado del estado para
       que una cita mande siempre `false` explícito: el PUT sólo toca la columna
       si el campo VIENE, así que apagar el todo-el-día de un evento no llegaría
       nunca si esto se omitiera. Mismo criterio que `icono` y `color`. */
    const esTodoElDia = esEvento && todoElDia

    await onSave({
      id:          apt?.id,
      /* De dónde sale el título, que es la diferencia de fondo entre los dos
         tipos: la cita lo COMPONE del paciente (y por eso no tiene campo de
         título), el evento lo lleva escrito a mano. */
      title:       esEvento ? tituloLimpio
        : paciente ? `${paciente.nombre} ${paciente.apellidos}`
        // D6: una cita por ligar conserva su título (el nombre de quien reservó).
        : (reserva?.title ?? ''),
      all_day:     esTodoElDia,
      /* LAS DOS PUNTAS, Y NUNCA LAS CUATRO A LA VEZ. Un evento de todo el día
         manda FECHAS y deja que el servidor componga la medianoche en la zona
         del consultorio; `componerIso` no sirve ahí porque usa el reloj del
         navegador. `all_day_hasta` es el ÚLTIMO DÍA INCLUIDO, tal como se ve en
         el campo: el paso a fin exclusivo lo da el servidor. Ver
         `DatosGuardado`. */
      ...(esTodoElDia
        ? { all_day_desde: fecha, all_day_hasta: fechaFin }
        : { start_time: componerIso(fecha, hora), end_time: componerIso(fechaFin, horaFin) }),
      notes:       notes.trim() || null,
      status,
      /* El bloque optimista de handleSave pinta la tarjeta antes de que
         responda el servidor; sin `pacientes` escribiría el paciente anterior.
         D6: una cita por ligar sin paciente NO manda `paciente_id` (el PUT no
         lo toca) y su `pacientes` sigue en null. */
      ...(esEvento ? { paciente_id: null, pacientes: null }
        : paciente ? { paciente_id: paciente.id, pacientes: paciente }
        : { pacientes: null }),
      // La pinta viaja SIEMPRE, también en una cita, y ahí va en null: si sólo
      // se mandara desde el evento, convertir el valor a null nunca llegaría al
      // servidor (el PUT sólo toca la columna si el campo viene).
      icono:       esEvento ? icono : null,
      color:       esEvento ? color : null,
      medico_id:   medicoId || null,
      ...(consultorioChanged ? { consultorio_id: consultorioId } : {}),
      updated_at:  apt?.updated_at,
      // B7c: sólo si se aceptó alguno; sin interruptor nunca viaja.
      ...(empalmesAceptados.length ? { empalmes_aceptados: empalmesAceptados } : {}),
      /* B6c: sólo con el interruptor y sólo si cambia respecto a la fila (en un
         alta, si hay tipo). Un evento sin paciente que arrastre un tipo viejo
         manda `null` y lo limpia. */
      ...(agendaV2 && tipoEfectivo !== (apt?.tipo_cita_id ?? null) ? { tipo_cita_id: tipoEfectivo } : {}),
    })
    setSaving(false)
  }

  async function handleDelete() {
    if (!apt?.id) return
    setDeleting(true)
    await onDelete(apt.id)
    setDeleting(false)
  }

  async function handleCancelarCita() {
    if (!apt?.id || !onCancelarCita) return
    setDeleting(true)
    await onCancelarCita(apt.id)
    setDeleting(false)
  }

  /* ── EL ÁREA QUE DE VERDAD SE VE ────────────────────────────────────────
     ⚠️⚠️ ESTO ES LO QUE SACA AL PIE DE DEBAJO DEL TECLADO. NO LO QUITES SIN
     LEER LOS DOS PÁRRAFOS.

     El proyecto NO declara `viewport` en `src/app/layout.tsx`, así que Next
     emite el meta por defecto y NO va `interactive-widget`. El default de Chrome
     en Android es `resizes-visual`: al abrir el teclado, el viewport de LAYOUT
     no encoge. Un `position: fixed; inset: 0` conserva entonces todo su alto y
     el teclado se limita a taparle la parte de abajo — que es justo donde está
     el pie con «Guardar». Y el teclado se abre SOLO al crear una cita (ver el
     `autoFocus` del buscador de paciente), así que el pie nacía tapado.

     `visualViewport` sí describe el área visible de verdad: encoge con el
     teclado y se desplaza con el zoom de pellizco. Fijando el envoltorio a ese
     rectángulo, el modal vive siempre dentro de lo que se ve, y con el pie
     anclado abajo (`h-full` en móvil) «Guardar» queda por encima del teclado.
     La alternativa era `interactive-widget=resizes-content` en el meta, que es
     un archivo global y otra decisión; ésta se resuelve aquí dentro.

     ⚠️ EN ESCRITORIO ES UN NO-OP: allí `visualViewport.height` vale lo mismo que
     `innerHeight` y `offsetTop` es 0, así que el envoltorio queda como estaba.

     ⚠️ EL VALOR INICIAL VA EN EL INICIALIZADOR PEREZOSO Y NO EN EL EFECTO, y no
     es estilo: `setState` síncrono dentro del cuerpo de un efecto es un error de
     `react-hooks/set-state-in-effect`. Aquí el efecto sólo SUSCRIBE; quien
     escribe estado es el manejador del evento, que sí está permitido.
     El `typeof window` es por el render de servidor: este componente se evalúa
     allí aunque su `Portal` no pinte nada hasta montar. */
  const [areaVisible, setAreaVisible] = useState<{ alto: number; desde: number } | null>(
    () => {
      const vv = typeof window === 'undefined' ? null : window.visualViewport
      return vv ? { alto: vv.height, desde: vv.offsetTop } : null
    },
  )

  /* ⚠️ EL FOCO INICIAL DE ESTE MODAL ES EL PANEL, Y NO PISA AL `autoFocus` DEL
     BUSCADOR DE PACIENTE. Los dos ocurren al montar y gana el ÚLTIMO en correr:
     `autoFocus` lo aplica React durante el commit, y el `focus()` de
     `useDialogoModal` va en un efecto, que corre después. O sea que en el alta
     el foco acaba en el panel y no en el campo de búsqueda.
     Es lo que se quiere: al abrir, un lector de pantalla anuncia el diálogo y su
     nombre en vez de soltar al usuario dentro de un campo sin contexto, y el
     primer Tab ya entra en el formulario. Si algún día se prefiere lo contrario,
     el sitio es el `focus()` del hook, no un `autoFocus` más. */
  const { montarPanel, alPulsarTecla } = useDialogoModal(onClose)
  const tituloId = useId()
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    /* Guarda de igualdad, como el resto de esta página: `scroll` de
       `visualViewport` se emite en ráfaga al arrastrar y sin esto serían decenas
       de renders del formulario entero por gesto. */
    const medir = () => setAreaVisible(prev => (
      prev && prev.alto === vv.height && prev.desde === vv.offsetTop
        ? prev
        : { alto: vv.height, desde: vv.offsetTop }
    ))
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    return () => {
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
    }
  }, [])

  /* ── ¿EL PIE TERMINA EN EL BORDE DE LA PANTALLA? ────────────────────────
     Desde el paso 10 el viewport es `viewport-fit=cover`, así que en móvil este
     modal es de verdad de borde a borde y el pie con «Guardar» cae sobre la
     barra de gestos. Se le suma `env(safe-area-inset-bottom)` — PERO NO SIEMPRE,
     y aquí está el detalle que hace falta pensar:

     con el teclado abierto el envoltorio ya NO llega al borde de la pantalla,
     porque sigue al `visualViewport` y ése termina en el borde SUPERIOR DEL
     TECLADO. La barra de gestos queda por debajo del teclado, o sea tapada por
     él y a cargo del sistema. Sumar el área segura ahí serían ~34 px de vacío
     entre «Guardar» y el teclado: el hueco duplicado, justo lo que se quiere
     evitar. Y el teclado se abre SOLO al crear una cita, así que sería el caso
     normal, no el raro.

     `desde + alto` es dónde acaba el rectángulo visible; si no llega a
     `innerHeight` —el viewport de LAYOUT, que con `cover` sí mide la pantalla
     entera y no encoge con el teclado— es que hay teclado. El píxel de tolerancia
     es por el redondeo de las medidas fraccionarias.

     ⚠️ SIN `visualViewport` (y en el render de servidor) SE DA POR CIERTO. Es la
     rama segura: sin teclado detectable, el pie está en el borde y el área segura
     hace falta. Y en escritorio el `env()` vale 0, así que esto es un no-op. */
  const pieAlBorde = typeof window === 'undefined' || !areaVisible
    || areaVisible.desde + areaVisible.alto >= window.innerHeight - 1

  return (
    <Portal>
    {/* ⚠️ `top` Y `height` EN LÍNEA GANAN AL `inset-0`, y el `bottom: 0` que
        queda sobra sin estorbar: con alto definido, la posición vertical queda
        sobre-restringida y `bottom` es la declaración que se ignora. */}
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 max-md:p-0"
      style={areaVisible ? { top: areaVisible.desde, height: areaVisible.alto } : undefined}
    >
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--ag-modal-overlay)' }} onClick={onClose} />
      {/* ── PANTALLA COMPLETA POR DEBAJO DE `md`, VENTANA DE AHÍ PARA ARRIBA ──
          Es el mismo trato que `ModalShell` da a sus modales con
          `fullscreenMobile` (`ModalShell.tsx:117`), o sea el patrón de la casa y
          no uno nuevo. Compra las dos cosas que aquí escaseaban: ANCHO —los 48 px
          del relleno del envoltorio vuelven a la fila del pie— y ALTO, que es lo
          que el teclado se come.

          ⚠️ `md:max-h-[92dvh]` Y NO `92vh`. `vh` es el viewport GRANDE, el de la
          barra de URL escondida, así que con la barra a la vista un panel de 92vh
          se sale por abajo y lo que se sale es el pie. Es el mismo fallo que ya
          se corrigió en la raíz de la agenda —ver la nota del `dvh` junto a
          `.agenda-raiz`— y del que este modal se había quedado fuera.
          ⚠️ Y EN MÓVIL NO ES `h-dvh` SINO `h-full`: el alto lo manda el
          envoltorio, que sigue al `visualViewport`. `dvh` no encoge con el
          teclado; el envoltorio sí. */}
      {/* ⚠️ LOS CINCO ATRIBUTOS DEL BLOQUE 9 SE AÑADEN SIN TOCAR UNA SOLA CLASE
          DE ESTE PANEL. La geometría de aquí —pantalla completa por debajo de
          `md`, `h-full` atado al `visualViewport` del envoltorio, `92dvh` en
          escritorio, áreas seguras en la cabecera y en el pie— costó una ronda
          entera y no se roza: lo único nuevo es el `ref`, el rol, el nombre, el
          `tabIndex` y un `focus:outline-none`. Ver `useDialogoModal`. */}
      <div
        ref={montarPanel}
        onKeyDown={alPulsarTecla}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className="relative focus:outline-none rounded-[22px] max-md:rounded-none w-full max-w-[480px] max-md:max-w-full md:max-h-[92dvh] max-md:h-full flex flex-col animate-modal-enter overflow-hidden"
        style={{ background: 'var(--ag-modal-bg)', boxShadow: '0 30px 80px rgba(16, 32, 64, .28)' }}>

        {/* Header

            ⚠️ EL RELLENO DE ARRIBA LLEVA EL ÁREA SEGURA SUMADA EN MÓVIL (paso
            10). Por debajo de `md` este panel es pantalla completa y su borde
            superior es el borde FÍSICO, así que sin esto el icono y el «Nueva
            cita» se meten bajo el reloj. Los 18 px de diseño no se tocan: se
            suman.
            ⚠️ VA CON `max-md:` AUNQUE EN ESCRITORIO EL `env()` VALGA 0. Ahí el
            modal es una tarjeta centrada y no toca ningún borde de pantalla: si
            algún día un navegador de escritorio reporta insets, esto no debe
            heredarlos.
            ⚠️ Y NO LO CUBRE LA FRANJA NAVY de `globals.css`: ésa va a z-index 45
            y este modal a 50, o sea que se pinta ENCIMA de ella. Los modales a
            pantalla completa se pagan su propio hueco; éste es el suyo. */}
        <div className="flex items-center gap-3 px-[22px] py-[18px] max-md:pt-[calc(18px+env(safe-area-inset-top,0px))] border-b" style={{ borderColor: 'var(--ag-hairline)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ag-modal-icon-bg)' }}>
            <Calendar size={20} style={{ color: 'var(--ag-brand-primary)' }} />
          </div>
          <h2 id={tituloId} className="text-[18px] font-extrabold" style={{ color: 'var(--ag-ink)' }}>
            {esEvento
              ? (isEdit ? 'Editar evento' : 'Nuevo evento')
              : (isEdit ? 'Editar cita'   : 'Nueva cita')}
          </h2>
          {canVerExpediente && paciente && (
            <Link
              href={`/expediente/${paciente.id}`}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 max-md:py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)]"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
            >
              <FileText size={14} />
              Expediente
            </Link>
          )}
          {/* ⚠️ `p-3` EN MÓVIL: con `p-1` la caja medía 28 px, la más pequeña del
              modal, y encima está en la esquina superior derecha, que es la peor
              alcanzable con el pulgar. 12 + 20 + 12 = 44. No se mueve de sitio
              —eso es rediseño y no toca hoy—, pero al menos se puede acertar.
              `flex-none` para que la fila del encabezado no se la coma cuando el
              título envuelve. */}
          <button onClick={onClose} aria-label="Cerrar"
            className={`${canVerExpediente && paciente ? '' : 'ml-auto'} p-1 transition-opacity hover:opacity-70 max-md:p-3 max-md:flex-none`}
            style={{ color: 'var(--ag-muted2)' }}>
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
                  /* «Todo el día» sólo existe para EVENTOS: una cita siempre
                     lleva hora. Mientras el interruptor esté encendido, la
                     posición «Cita» no se puede elegir —se libera al apagarlo—.
                     No se oculta, se deshabilita: quitarla dejaría un segmento
                     de una sola posición, que no parece un control.
                     `|| todoElDiaFijo` es redundante HOY —abierto desde la banda
                     el interruptor no se puede apagar, así que `todoElDia` ya no
                     baja nunca— y se escribe igual porque la regla no es «está
                     encendido» sino «se abrió desde la banda»: si algún día el
                     interruptor se soltara, esta línea seguiría diciendo la
                     verdad. */
                  const bloqueado = t.id === 'cita' && (todoElDia || todoElDiaFijo)
                  return (
                    <button
                      key={t.id} type="button"
                      role="tab"
                      aria-selected={activo}
                      disabled={bloqueado}
                      title={bloqueado ? 'Un evento de todo el día no puede ser una cita.' : undefined}
                      onClick={() => { if (!activo && !bloqueado) onCambiarTipo(t.id) }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 transition-all ${activo || bloqueado ? '' : 'hover:opacity-70'}`}
                      style={{
                        border: 'none', cursor: bloqueado ? 'not-allowed' : 'pointer', borderRadius: 9, padding: '7px 13px',
                        fontSize: 13, fontWeight: activo ? 700 : 600,
                        ...(activo
                          ? { background: 'var(--ag-segment-active-bg)', color: 'var(--ag-segment-active-text)', boxShadow: 'var(--ag-segment-active-shadow)' }
                          : { background: 'transparent', color: 'var(--ag-segment-text)' }),
                        ...(bloqueado ? { opacity: .45 } : {}),
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
                  className="w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
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
                        className="w-10 h-10 max-md:w-11 max-md:h-11 rounded-xl flex items-center justify-center transition-all"
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
                        className="w-10 h-10 max-md:w-11 max-md:h-11 rounded-xl flex items-center justify-center transition-all"
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
                {/* B3: con el interruptor encendido la X CANCELA (ver la
                    alerta, abajo); sobre una cita ya cancelada no queda nada
                    que hacer con ella y no se pinta. */}
                {!(cancelaEnVezDeBorrar && yaCancelada) && (
                <button
                  onClick={() => {
                    if (isEdit) setQuitarPaciente(true)
                    else { setPaciente(null); setSearch('') }
                  }}
                  aria-label={cancelaEnVezDeBorrar
                    ? 'Quitar paciente y cancelar la cita'
                    : (isEdit ? 'Quitar paciente y eliminar la cita' : 'Quitar paciente')}
                  /* ⚠️ ERA EL CONTROL MÁS PEQUEÑO DEL MODAL Y EL MÁS PELIGROSO:
                     14 × 14 px sin relleno, y en EDICIÓN no vacía un campo sino
                     que abre la confirmación que borra la cita entera. Un
                     objetivo de 14 px para eso, en un teléfono y pegado a la
                     tarjeta del paciente, es donde se falla el dedo. Caja fija
                     de 44 en móvil; el aspa sigue midiendo 14. */
                  className="transition-opacity hover:opacity-70 max-md:w-11 max-md:h-11 max-md:flex-none max-md:flex max-md:items-center max-md:justify-center"
                  style={{ color: 'var(--ag-muted)' }}
                >
                  <X size={14} />
                </button>
                )}
              </div>
            ) : reserva && ligar ? (
              <PanelLigarCita
                nombreReserva={reserva.reserva_nombre ?? reserva.title}
                telefono={reserva.reserva_telefono ?? null}
                correo={reserva.reserva_correo ?? null}
                search={search}
                onSearch={setSearch}
                resultados={search.trim().length >= 2 ? results : []}
                buscando={searchLoading}
                enviando={ligar.enviando}
                error={ligar.error}
                onElegir={p => void ligarYConsultar(p)}
                onNuevo={() => setQuickCreate(true)}
                onVolver={() => setLigar(null)}
              />
            ) : reserva ? (
              <BloqueReservaPorLigar
                citaId={reserva.id}
                nombre={reserva.reserva_nombre ?? reserva.title}
                telefono={reserva.reserva_telefono ?? null}
                correo={reserva.reserva_correo ?? null}
                historialPrevio={reserva.reserva_historial_previo ?? 0}
                enVivo={agendaV2}
                puedeGestionar={canInvitar || (canVerExpediente && defaultMedicoId === reserva.medico_id)}
              />
            ) : (
              <div className="relative">
                <input
                  autoFocus
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowSearch(true) }}
                  onFocus={() => setShowSearch(true)}
                  placeholder="Buscar paciente por nombre o apellido..."
                  className="w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
                />
                {/* ⚠️ ALTO MÁXIMO Y SCROLL PROPIO. Esta lista es `absolute` DENTRO
                    del cuerpo del modal, que es `overflow-y: auto`: todo lo que
                    sobresalga se recorta, y la consulta trae hasta OCHO
                    resultados de ~56 px más la fila de «Registrar…», o sea unos
                    500 px de desplegable. En un teléfono eso se cortaba por
                    abajo y no había forma de llegar a los últimos.
                    Los 280 son cinco filas: el corte se ve —la quinta queda a
                    medias— así que se lee como «hay más» y no como el final.
                    `overscroll-contain` para que al llegar al tope no se
                    arrastre el formulario de detrás.
                    `overflow-y-auto` sustituye al `overflow-hidden` que había y
                    sigue recortando en las esquinas: basta un eje no visible
                    para que el redondeo recorte. */}
                {showDropdown && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-xl border shadow-lg overflow-y-auto overscroll-contain max-h-[280px]"
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

          {/* ── TODO EL DÍA — SÓLO EN LA RAMA DE EVENTO ──────────────────────
              En una CITA este interruptor NO SE PINTA, ni apagado ni
              deshabilitado, y eso es la decisión: una cita siempre lleva hora, y
              un control apagado que nunca se puede encender es una promesa que
              el formulario no piensa cumplir.
              Va ENCIMA de los campos porque los cambia: encenderlo retira las
              dos horas y los chips. Debajo, el médico ya habría tecleado. */}
          {esEvento && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={todoElDia}
                /* El botón sólo contiene la perilla, que no es texto: sin esto
                   el lector de pantalla anuncia un interruptor sin nombre. */
                aria-label="Todo el día"
                disabled={todoElDiaFijo}
                title={todoElDiaFijo ? 'Se abrió desde la banda de todo el día, donde sólo se crean eventos de todo el día.' : undefined}
                onClick={() => alternarTodoElDia(!todoElDia)}
                /* ⚠️ EL ÁREA TÁCTIL SE AGRANDA CON UN `::after`, NO CON LA PISTA.
                   La pista mide 40 × 24 y es lo que el diseño dibuja; subirla a
                   44 la convertiría en otra cosa. El pseudo-elemento estira la
                   zona sensible a 48 × 44 sin mover un píxel de lo que se ve, y
                   sin empujar la fila: va posicionado dentro del botón, que ya
                   es `relative`. Era el control más pequeño del modal —24 px de
                   alto— y el único que ni siquiera llegaba a la mitad del
                   mínimo. */
                className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0 max-md:after:absolute max-md:after:-inset-y-2.5 max-md:after:-inset-x-1 max-md:after:content-['']"
                style={{
                  background: todoElDia ? 'var(--ag-brand-primary)' : 'var(--ag-input-border)',
                  ...(todoElDiaFijo ? { opacity: .55, cursor: 'not-allowed' } : {}),
                }}
              >
                {/* `bg-white` y no un `#fff` a mano, igual que la perilla del
                    interruptor de `HorarioModal`: en este archivo el blanco se
                    escribe con la utilidad, no con un hex. */}
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${todoElDia ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
              <span className="text-sm font-semibold" style={{ color: 'var(--ag-text)' }}>Todo el día</span>
              {/* Por qué no se puede tocar, dicho donde se mira. El `title` del
                  botón sólo aparece al pasar el cursor, y en táctil no aparece
                  nunca. */}
              {todoElDiaFijo && (
                <span className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>
                  · la banda sólo crea eventos de todo el día
                </span>
              )}
            </div>
          )}

          {/* ⚠️ DOS CONTROLES POR PUNTA Y NO UN `datetime-local`, Y NO LOS
              VUELVAS A JUNTAR. Aquí había uno solo, y se partió porque ese
              control NO ADMITE una fecha sin hora: su algoritmo de saneamiento
              descarta cualquier valor que no sea fecha-y-hora completa, así que
              «2026-08-19» se convierte en cadena vacía Y LA FECHA SE PIERDE con
              ella. Medido en navegador, no deducido.
              Eso bloqueaba lo que pide la vista Mes: abrir con el día puesto y la
              hora en blanco, para que el médico la escriba sin borrar nada. Con
              dos controles la fecha se queda y la hora puede estar vacía. En todo
              el día hace falta lo mismo llevado al extremo: fecha y NINGUNA hora.
              El `step={900}` viaja con la HORA, que es de quien era.

              ⚠️ EL CAMPO DE FIN ENSEÑA EL ÚLTIMO DÍA INCLUIDO, no el fin
              exclusivo que guarda la columna. Un evento de un solo día tiene las
              dos fechas IGUALES aquí y `19T00:00 .. 20T00:00` en la base. El
              salto entre las dos lecturas lo da el servidor al guardar, y no se
              ve desde aquí a propósito: «hasta el 20» para un evento que termina
              el 19 es la clase de dato que nadie corrige porque nadie se lo
              cree. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                {todoElDia ? 'Primer día' : 'Fecha de inicio'}
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => todoElDia ? moverFechaDeTodoElDia(e.target.value) : moverInicio(e.target.value, hora)}
                className="w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
              />
            </div>
            {!todoElDia && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                  Hora de inicio
                </label>
                <input
                  type="time"
                  value={hora}
                  step={900}
                  onChange={e => moverInicio(fecha, e.target.value)}
                  className="w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                {todoElDia ? 'Último día' : 'Fecha de fin'}
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
              />
            </div>
            {!todoElDia && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>
                  Hora de fin
                </label>
                <input
                  type="time"
                  value={horaFin}
                  step={900}
                  onChange={e => setHoraFin(e.target.value)}
                  className="w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all"
                />
              </div>
            )}
          </div>

          {/* El fin antes del inicio, DICHO AQUÍ Y NO DESPUÉS DE ENVIAR. La base
              lo rechazaría con un 23514 que sube al cliente como «no se pudo
              guardar la cita», que no dice qué corregir. */}
          {finAntesDelInicio && (
            <p className="text-[12.5px] font-semibold text-red-500">
              {todoElDia
                ? 'El último día no puede ir antes del primero.'
                : 'La hora de fin tiene que ir después de la de inicio.'}
            </p>
          )}

          {/* B6c · Tipo de cita (P5). Sólo con el interruptor, en una cita con
              paciente y si hay algún tipo que ofrecer. Opcional: «Sin tipo»
              siempre está. El color es SÓLO la marca de la lista; la tarjeta
              sigue con el color del estado y sin el nombre del tipo. */}
          {conTipos && (paciente || reserva) && opcionesTipo.length > 1 && (
            <div>
              <label id={`${tituloId}-tipo`} className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Tipo de cita</label>
              <div role="radiogroup" aria-labelledby={`${tituloId}-tipo`} className="flex flex-wrap gap-2">
                {opcionesTipo.map(o => {
                  const marcado = tipoEfectivo === o.id
                  return (
                    <button key={o.id ?? 'sin-tipo'} type="button" role="radio" aria-checked={marcado} onClick={o.elegir}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 max-md:py-3 rounded-full text-[13px] font-semibold border transition-all ${marcado ? 'text-white' : ''}`}
                      style={marcado
                        ? { background: 'var(--ag-brand-primary)', borderColor: 'var(--ag-brand-primary)' }
                        : { background: 'var(--ag-input-bg)', color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
                    >
                      {o.color && <span aria-hidden className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: `var(--ag-evento-${o.color})` }} />}
                      {o.nombre}
                      {o.duracion !== null && <span className="font-normal opacity-80">· {o.duracion} min</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Duración — un ATAJO para escribir el fin, no un dato aparte. En todo
              el día no se pinta: no hay horas que abreviar. */}
          {!todoElDia && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: 'var(--ag-muted2)' }}>Duración</label>
              {/* El blanco del chip marcado sale de `text-white` y no de un
                  `#fff` en el `style`, por lo mismo que la perilla de arriba. El
                  fondo y el borde sí van en línea: son tokens. */}
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map(d => (
                  <button key={d.value} type="button" onClick={() => escribirFinConChip(d.value)}
                    className={`px-4 py-2 max-md:py-3 rounded-full text-[13px] font-bold border transition-all ${duracionElegida === d.value ? 'text-white' : ''}`}
                    style={duracionElegida === d.value
                      ? { background: 'var(--ag-brand-primary)', borderColor: 'var(--ag-brand-primary)' }
                      : { background: 'var(--ag-input-bg)', color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {/* AQUÍ VIVÍA «Termina a las …», Y NO LO REPONGAS: era la única
                  forma de ver el fin cuando el fin no era un campo. Ahora lo
                  enseña el campo de al lado, y repetirlo sería un segundo sitio
                  donde leer el mismo dato —el que se queda viejo—. */}
            </div>
          )}

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
                  className="w-full pl-3 pr-9 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all appearance-none cursor-pointer"
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
                className="w-full pl-3 pr-9 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="w-full px-3 py-2.5 max-md:py-3 text-sm rounded-xl border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] text-[var(--ag-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] focus:border-[var(--ag-input-focus-border)] transition-all resize-none"
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

        {/* Footer

            ⚠️ EL RELLENO DE ABAJO SE CALCULA, Y EL PORQUÉ ESTÁ EN LA NOTA DE
            `pieAlBorde`, ARRIBA. Resumen: con el pie contra el borde de la
            pantalla se le suma la barra de gestos; con el teclado abierto NO,
            porque entonces el pie termina donde empieza el teclado y esos 34 px
            serían un hueco de más.
            ⚠️ EL `14px` ES EL `py-3.5` DE LA CLASE, escrito otra vez porque un
            estilo en línea sustituye, no suma. Si cambias uno, cambia el otro o
            el pie deja de ser simétrico. */}
        <div className="px-[22px] py-3.5 border-t flex items-center gap-2"
          style={{
            borderColor: 'var(--ag-hairline)',
            ...(pieAlBorde ? { paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' } : {}),
          }}>
          {/* El sustantivo de las dos etiquetas sale de `esEvento`, que aquí ya
              está resuelto por el DATO de la fila (`esEventoGenerico`, o sea el
              paciente) y nunca por el título, que en un evento lo escribe el
              médico y puede decir «Cita: Pancho» sin serlo.
              Aquí se ramifica en vez de buscar una frase neutra: es un control
              con etiqueta y merece el nombre exacto de lo que borra. */}
          {/* B3: con el interruptor encendido una cita con paciente se
              CANCELA en vez de borrarse, y una ya cancelada no ofrece botón. */}
          {cancelaEnVezDeBorrar && !yaCancelada && (
            <button
              onClick={handleCancelarCita}
              disabled={deleting}
              title={deleting ? 'Cancelando...' : 'Cancelar cita'}
              aria-label={deleting ? 'Cancelando cita' : 'Cancelar cita'}
              className="flex items-center justify-center p-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 max-md:w-11 max-md:h-11 max-md:p-0 max-md:flex-none"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <CalendarX size={16} />}
            </button>
          )}
          {isEdit && !cancelaEnVezDeBorrar && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={deleting ? 'Eliminando...' : (esEvento ? 'Eliminar evento' : 'Eliminar cita')}
              aria-label={deleting
                ? (esEvento ? 'Eliminando evento' : 'Eliminando cita')
                : (esEvento ? 'Eliminar evento'   : 'Eliminar cita')}
              className="flex items-center justify-center p-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 max-md:w-11 max-md:h-11 max-md:p-0 max-md:flex-none"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
          {showLigarYConsultar && !ligar && (
            <button type="button" onClick={abrirLigar}
              aria-label="Iniciar consulta" title="Iniciar consulta: primero se liga a un paciente"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)] max-md:w-11 max-md:h-11 max-md:px-0 max-md:py-0 max-md:flex-none"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}>
              <Stethoscope size={15} />
              <span className="max-md:hidden">Iniciar consulta</span>
            </button>
          )}
          {showIniciarConsulta && (
            <Link
              href={`/expediente/${paciente.id}/nueva-nota${apt ? `?cita=${apt.id}` : ''}`}
              onClick={() => {
                cambiarActivo(citaConsultorio!)
                onClose()
              }}
              /* ⚠️ EN MÓVIL SE QUEDA EN EL ICONO, y las dos etiquetas que CIERRAN
                 el modal no. Es la única de las cuatro que puede ceder su
                 rótulo: lleva al expediente, o sea navegación, y ni guarda ni
                 descarta nada. Un icono sin etiqueta en «Cancelar» o «Guardar»
                 invita al error sobre datos clínicos; aquí, a un paseo de más.
                 El nombre no se pierde para quien no ve el icono: va en
                 `aria-label` y en `title`, los dos en las dos anchuras. */
              aria-label="Iniciar consulta"
              title="Iniciar consulta"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-colors hover:bg-[var(--ag-btn-ghost-hover)] max-md:w-11 max-md:h-11 max-md:px-0 max-md:py-0 max-md:flex-none"
              style={{ color: 'var(--ag-text)', borderColor: 'var(--ag-input-border)' }}
            >
              <Stethoscope size={15} />
              <span className="max-md:hidden">Iniciar consulta</span>
            </Link>
          )}
          {/* ── LAS DOS QUE CIERRAN EL MODAL ────────────────────────────────
              En móvil se reparten TODO el ancho que dejan los dos iconos
              (`flex-1`), que es lo que las saca de los ~36-40 px de alto y las
              pone al alcance del pulgar. En escritorio siguen alineadas a la
              derecha con su tamaño de siempre: el `ml-auto` sólo se apaga por
              debajo de `md`. */}
          <div className="flex items-center gap-2 ml-auto max-md:ml-0 max-md:flex-1 max-md:min-w-0">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--ag-btn-ghost-hover)] max-md:flex-1 max-md:min-w-0 max-md:h-11 max-md:px-2" style={{ color: 'var(--ag-muted)' }}>
              Cancelar
            </button>
            {/* ⚠️ GUARDANDO ES UN GIRADOR Y YA NO «Guardando...», Y NO ES UN
                CAPRICHO. Ese texto mide ~30 px más que «Guardar», así que al
                pulsar ensanchaba el botón — y con `flex-1` y `min-width: auto`
                un ítem de flex no encoge por debajo de su contenido mínimo, o
                sea que el reparto del pie se rompía justo al guardar, que es el
                peor momento. Con el girador el ancho mínimo del botón es
                siempre el de «Guardar».
                Es además lo que ya hace su vecina la papelera cuatro líneas más
                arriba, así que el pie no estrena dos formas de decir «estoy
                trabajando». El estado lo dicen también el `disabled` y el
                `aria-label`. */}
            <button onClick={handleSave} disabled={saving || faltaLoEsencial || faltanPuntas || finAntesDelInicio || !consultorioId}
              aria-label={saving ? 'Guardando' : undefined}
              className="flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:brightness-95 shadow-sm bg-[linear-gradient(135deg,var(--ag-brand-primary),var(--ag-brand-secondary))] max-md:flex-1 max-md:min-w-0 max-md:h-11 max-md:px-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
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
    {quitarPaciente && cancelaEnVezDeBorrar && (
      <ConfirmModal
        message={
          'Una cita con paciente no se elimina: quitar al paciente CANCELA la cita. '
          + 'Seguirá en la agenda como cancelada, y en el calendario de Google de quien esté invitado '
          + 'quedará marcada como cancelada. ¿Deseas cancelarla?'
        }
        onConfirm={() => { setQuitarPaciente(false); void handleCancelarCita() }}
        onCancel={() => setQuitarPaciente(false)}
      />
    )}
    {quitarPaciente && !cancelaEnVezDeBorrar && (
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

    {/* El aviso de fuera de horario. Mismo patrón que la alerta de la X del
        paciente: `ConfirmModal` se monta en su propio Portal, por encima de
        este modal, que se queda tal cual detrás — cancelar devuelve al
        formulario con la hora puesta, lista para corregirla. */}
    {avisoHorario && (
      <ConfirmModal
        message={avisoHorario}
        onConfirm={() => { setAvisoHorario(null); void seguirTrasHorario() }}
        onCancel={() => setAvisoHorario(null)}
      />
    )}

    {/* B7c: el aviso de empalme. Mismo patrón que el de horario: el modal se
        queda detrás, y «Cancelar» vuelve al formulario para cambiar la hora. */}
    {avisoEmpalme && (
      <ConfirmModal
        message={avisoEmpalme.mensaje}
        onConfirm={() => { const ids = avisoEmpalme.ids; setAvisoEmpalme(null); void guardar(ids) }}
        onCancel={() => setAvisoEmpalme(null)}
      />
    )}

    {/* Modal de creación rápida — z-index superior al modal de cita */}
    {quickCreate && (
      <QuickPatientModal
        /* D7: al ligar una cita por ligar, con el nombre y el correo de quien
           reservó; el consentimiento lo sigue exigiendo el modal. */
        nombreInicial={reserva && ligar ? (reserva.reserva_nombre ?? reserva.title) : search}
        emailInicial={reserva && ligar ? (reserva.reserva_correo ?? '') : ''}
        onCreated={p => {
          setQuickCreate(false)
          if (reserva && ligar) { void ligarYConsultar(p); return }
          setPaciente(p); setSearch('')
        }}
        onClose={() => setQuickCreate(false)}
      />
    )}

    </Portal>
  )
}
