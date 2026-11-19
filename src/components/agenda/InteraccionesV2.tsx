'use client'

/**
 * src/components/agenda/InteraccionesV2.tsx
 *
 * EL ENCHUFE de las interacciones nuevas del bloque F (F3), detrás del
 * interruptor `agendaV2`. Es un chunk aparte: `AgendaCliente` lo carga con
 * `next/dynamic` y SÓLO lo monta con el interruptor encendido, en tiempo
 * ocioso (patrón de A2.6). Con el interruptor apagado no se descarga ni un
 * byte de aquí, ni de las capas que importa.
 *
 * Qué hace:
 *   · expone `ApiInteraccionesV2` por `apiRef` (`contratosV2.ts`), que es lo
 *     que llaman `altaCitas.ts` (burbuja, tarjeta) y la agenda;
 *   · pinta la capa abierta (una sola a la vez) y decide qué hace cada acción,
 *     siempre con las funciones de guardado de la agenda (`handleSave`…): aquí
 *     no hay ninguna escritura propia de citas.
 *
 * Mientras no está montado (interruptor apagado, o el chunk aún en camino),
 * `apiRef.current` es `null` y cada gesto hace lo de siempre: el modal.
 *
 * ⚠️ UNA CAPA CON `id`: cerrar cierra ESA capa y no la que haya abierto otro
 * gesto entretanto (tocar otra franja con la burbuja abierta la cierra con su
 * salida y abre otra; la vieja, al terminar de salir, no puede cerrar la nueva).
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Dispatch, type ReactElement, type Ref, type RefObject, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type FullCalendar from '@fullcalendar/react'
import type { EventApi } from '@fullcalendar/core'
import type { ModalState } from '@/components/agenda/AppointmentModal'
import BurbujaAlta, { type MasOpcionesBurbuja, type MedicoBurbuja } from '@/components/agenda/BurbujaAlta'
import TarjetaLectura from '@/components/agenda/TarjetaLectura'
import AyudaAtajos from '@/components/agenda/AyudaAtajos'
import ConvertirEnCita, { type EleccionConversion } from '@/components/agenda/ConvertirEnCita'
import { useAtajosAgenda } from '@/app/(app)/agenda/useAtajosAgenda'
import { useDeslizarPeriodo } from '@/app/(app)/agenda/useDeslizarPeriodo'
import { useTarjetaAlPasar } from '@/app/(app)/agenda/useTarjetaAlPasar'
import type { VigiaAlPasar } from '@/lib/agenda/tarjetaAlPasar'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'
import { BotonCorreoCita } from '@/components/agenda/BotonCorreoCita'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useEscudoTrasRegistro } from '@/hooks/useEscudoTrasRegistro'
import { useToast } from '@/components/ui/Toast'
import { useConsultorios } from '@/hooks/useConsultorios'
import type { Consultorio } from '@/types'
import type { MedicoConfig } from '@/lib/configApp'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { AltaGuardada, Appointment, DatosGuardado, OpcionesGuardado } from '@/lib/agenda/tiposAgenda'
import type { ApiInteraccionesV2, AperturaAltaV2, AperturaEdicionV2, CambiarEstadoCita, GestoAlta, SitioCita } from '@/lib/agenda/contratosV2'
import type { Caja, Punto } from '@/lib/agenda/posicionCapa'
import { guardarAltaRapida, horasDelGesto, type DependenciasGuardado } from '@/lib/agenda/altaRapida'
import { tocaBloqueo, type AperturaBloqueo } from '@/lib/agenda/bloqueosAgenda'
import type { AvisosHorario } from '@/lib/agenda/horarioRejilla'
import { empalmesPintados, mensajeEmpalme } from '@/lib/agenda/empalmesCita'
import { esEventoGenerico, esPorAsignar } from '@/lib/agenda/tarjetasAgenda'
import { marcarNoEsCita } from '@/lib/agenda/noEsCita'
import { partirFechaHora } from '@/lib/agenda/fechasAgenda'
import { vistaEnElOtroFormato } from '@/lib/agenda/vistasAgenda'
import { guardarAtajosEncendidos, leerAtajosEncendidos, type AccionAtajo, type AlmacenPreferencia } from '@/lib/agenda/atajosAgenda'
import type { CitaEncontrada } from '@/lib/agenda/buscarCitasPaciente'
import {
  pideConfirmacion, puedeIniciarConsulta, textoDeConfirmacion, type AccionTarjeta, type QuienMira,
} from '@/lib/agenda/accionesTarjeta'
import { correoParaConfirmacion, motivoSinCorreo, motivoSinWhatsApp, telefonoParaWhatsApp } from '@/lib/agenda/whatsappCita'

/* Tanda J (punto 7) · La ventana de «Ligar e iniciar consulta», en su propio
   chunk: sólo se descarga al pulsar el botón (no suma nada a este chunk). */
const VentanaLigarCita = dynamic(() => import('@/components/agenda/VentanaLigarCita'), { ssr: false })

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>
export type CalendarApiV2 = ReturnType<InstanceType<typeof FullCalendar>['getApi']>
/* Lo que se espera a que llegue la cita elegida en el buscador tras navegar a
   su día (la traída de una semana no vista). Pasado esto, se avisa. */
const ESPERA_CITA_MS = 6000
/* Misma forma que el `useState` de `AgendaCliente.tsx`, duplicada a propósito
   como en `guardadoCitas.ts` y `altaCitas.ts`. */
type ConfirmState = { message: string; onConfirm: () => void; onCancel: () => void } | null

/** Lo que la agenda le presta para guardar: sus mismas funciones. */
export interface GuardadoV2 {
  /** T1: devuelve el alta que entró (la burbuja ofrece ahí mismo WhatsApp e invitación). */
  handleSave: (datos: DatosGuardado, reintentoEmpalme?: boolean, opciones?: OpcionesGuardado) => Promise<AltaGuardada | null>
  handleCancelar: (id: string) => Promise<void>
  handleDelete: (id: string) => Promise<void>
  /** De `guardadoCitas.ts` (Movimiento) cuando exista; sin ella, la tarjeta no ofrece «Confirmar». */
  cambiarEstadoCita?: CambiarEstadoCita
}

export interface PropsInteraccionesV2 {
  apiRef: Ref<ApiInteraccionesV2>
  /** `true` al montar, `false` al desmontar: la raíz lo publica para las pruebas. */
  alCambiarListas: (listas: boolean) => void
  /** Si los atajos de una tecla están encendidos (la preferencia de la ayuda);
      `false` al desmontar. La agenda lo pasa a la barra y a la banda como
      `atajos` (`aria-keyshortcuts`): sólo anuncian teclas que funcionan. */
  alCambiarAtajos: (encendidos: boolean) => void
  calendarRef: CalRef
  /** En el teléfono la tarjeta es una hoja inferior. */
  isMobile: boolean
  /** La zona de quien mira (la del navegador), para la hora de la tarjeta. */
  zonaVisor: string
  /** Quien mira, para «Iniciar consulta»: médico y su id. */
  quien: Omit<QuienMira, 'consultorioExiste'>
  /** Con un solo médico el nombre del médico no se enseña en la tarjeta. */
  isSingleDoctor: boolean
  /** `cambiarVista` de la agenda (filtro forzado del Mes incluido). */
  onVista: (tipo: string, fecha?: Date) => void
  /** El filtro tal cual (`''` = «Todos», `null` = aún sin perfil) y cómo cambiarlo. */
  filtroActivo: string | null
  alFiltrarMedico: (id: string) => void
  /** La raíz de la agenda, donde cuelga el gesto de deslizar (F3.7). */
  raizRef: RefObject<HTMLDivElement | null>
  /** La vista de FullCalendar (`datesSet`): el gesto sólo vale en las listas del teléfono. */
  currentView: string
  /** El botón «Agendar» (atajo `c`): el modal de alta, con el bloqueo de suscripción delante. */
  onAgendar: () => void
  /** T3 · La puerta de suscripción del alta, para «Convertir en cita»: `false` y
      enseña el aviso de bloqueo si la clínica no puede agendar. */
  puedeAgendar: () => boolean
  /** `abrirCita` de `altaCitas.ts`, la única puerta a una cita (T3: también al pasar el ratón). */
  abrirCita: (evento: EventApi, sitio?: SitioCita) => void
  medicos: readonly MedicoConfig[]
  /** El médico de la burbuja: el del filtro, o el único; `null` = «Todos». */
  filtroMedico: string | null
  /** Los avisos de fuera de horario: con la v2, en la hora del consultorio de la cita (`horarioRejilla.ts`). */
  avisosHorario: AvisosHorario
  guardado: GuardadoV2
  /** T1 · Quien mira puede invitar a una cita (`canVerAgendaCompleta`, la regla de `handleSave`). */
  puedeInvitar: boolean
  /** T1 · Abre el modal de invitación de la agenda para esa cita (el de «Agregar invitados»). */
  invitar: (cita: Appointment) => void
  setModal: Dispatch<SetStateAction<ModalState>>
  setConfirm: Dispatch<SetStateAction<ConfirmState>>
  /** K1 · Abre el modal del bloqueo de horario (crear) con ese tramo. */
  onBloquear?: (desde: AperturaBloqueo) => void
}

type Capa =
  /* Tanda I (punto 12) · `sustituyeA`: la burbuja de «Reasignar», en el hueco
     de una cancelada; al guardar, el servidor la cierra (`sustituye_a`). */
  | { id: number; tipo: 'burbuja'; gesto: GestoAlta; horas: { inicio: string; fin: string }; sustituyeA?: string }
  /* `cita` es la fila tal como la tiene el evento (la que recibe el modal, como
     hoy); `vista`, la misma con las puntas VIVAS del evento, que es lo que se
     lee en la tarjeta justo después de un arrastre. */
  | { id: number; tipo: 'tarjeta'; cita: Appointment; vista: Appointment; ancla: Caja | null; punto?: Punto; abiertaEn: number
      /* T3 · `alPasar`: abierta al dejar el ratón quieto (no modal); `sinEntrada`:
         la de siempre que la sustituye al fijarla con un clic, sin volver a entrar. */
      alPasar?: boolean; sinEntrada?: boolean
      /* Tanda J, punto 10 · abierta desde un aviso: esta acción de principal. */
      destacar?: 'reagendar' }
  | { id: number; tipo: 'ayuda' }
  /* T3 · «Convertir en cita» de un evento nacido en Google (§2, AG-DT-29). */
  | { id: number; tipo: 'convertir'; cita: Appointment }
  /* Tanda J (punto 7) · «Ligar e iniciar consulta» de una por ligar. */
  | { id: number; tipo: 'ligar'; cita: Appointment }

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never

/** La capa abierta, con su `id`, y un espejo en ref para leerla desde manejadores estables. */
function useCapa(): { capa: Capa | null; capaRef: RefObject<Capa | null>; abrir: (c: SinId<Capa>) => void; cerrar: (id: number) => void } {
  const [capa, setCapa] = useState<Capa | null>(null)
  const capaRef = useRef<Capa | null>(null)
  const siguiente = useRef(0)
  useEffect(() => { capaRef.current = capa }, [capa])
  const abrir = useCallback((c: SinId<Capa>) => {
    siguiente.current += 1
    const nueva: Capa = { ...c, id: siguiente.current }
    capaRef.current = nueva
    setCapa(nueva)
  }, [])
  const cerrar = useCallback((id: number) => {
    if (capaRef.current?.id === id) capaRef.current = null
    setCapa(c => (c?.id === id ? null : c))
  }, [])
  return { capa, capaRef, abrir, cerrar }
}

/** «Más opciones»: el modal completo con lo que ya se escribió en la burbuja. */
function aperturaDesdeBurbuja(v: MasOpcionesBurbuja): AperturaAltaV2 {
  return {
    mode: 'create', fecha: v.fecha, hora: v.hora || null, tipo: 'cita', todoElDia: 'no',
    ...(v.paciente ? { paciente: v.paciente } : {}),
    ...(v.horaFin ? { horaFin: v.horaFin } : {}),
    ...(v.medicoId ? { medicoId: v.medicoId } : {}),
    /* H3 (punto 14): las observaciones escritas en la burbuja pasan al modal. */
    ...(v.notas?.trim() ? { notas: v.notas } : {}),
  }
}

/** Los avisos y el guardado de la burbuja, con las piezas de la agenda (B7c, P3). */
function useDependenciasGuardado(p: PropsInteraccionesV2): DependenciasGuardado {
  const { calendarRef, avisosHorario, guardado, setConfirm } = p
  return {
    avisoHorario: (inicio, fin, datos) => avisosHorario.hora(inicio, fin, 'Vas a agendar a las',
      { consultorioId: datos.consultorio_id ?? null, medicoId: datos.medico_id ?? null }),
    buscarEmpalmes: (tramo) => {
      const api = calendarRef.current?.getApi()
      return api ? empalmesPintados(tramo, api.getEvents()) : []
    },
    mensajeEmpalme,
    confirmar: (message) => new Promise<boolean>(resolver => setConfirm({
      message,
      onConfirm: () => { setConfirm(null); resolver(true) },
      onCancel: () => { setConfirm(null); resolver(false) },
    })),
    /* T1: sin la invitación automática; la burbuja la ofrece como botón. */
    guardar: (datos) => guardado.handleSave(datos, false, { sinInvitacion: true }),
    /* K1 · el alta rápida siempre es una cita: pregunta si cae en un bloqueo pintado. */
    bloqueado: (inicio, fin, medicoId) => {
      const api = calendarRef.current?.getApi()
      return api ? tocaBloqueo(api.getEvents(), medicoId, inicio, fin) : false
    },
  }
}

interface PropsCapaBurbuja {
  capa: Extract<Capa, { tipo: 'burbuja' }>
  medicos: readonly MedicoBurbuja[]
  p: PropsInteraccionesV2
  cerrar: (id: number) => void
}

function CapaBurbuja({ capa, medicos, p, cerrar }: PropsCapaBurbuja): ReactElement {
  const deps = useDependenciasGuardado(p)
  const { consultorioActivo } = useConsultorioActivo()
  return (
    <BurbujaAlta
      fecha={capa.gesto.fecha} horaInicio={capa.horas.inicio} horaFin={capa.horas.fin}
      ancla={capa.gesto.ancla} punto={capa.gesto.punto}
      medicos={medicos} filtroMedico={p.filtroMedico} consultorioActivo={consultorioActivo}
      alGuardar={(datos, horas) => guardarAltaRapida(capa.sustituyeA && datos.paciente_id ? { ...datos, sustituye_a: capa.sustituyeA } : datos, capa.horas, horas, deps)}
      alMasOpciones={(v) => {
        cerrar(capa.id)
        p.setModal({ ...aperturaDesdeBurbuja(v), ...(capa.sustituyeA ? { sustituyeA: capa.sustituyeA } : {}) })
      }}
      /* T1 · Tras agendar. Las dos cierran la burbuja SIN salida animada (lo
         que abren la tapa): la invitación no se ofrece dos veces seguidas
         (`ModalInvitacionCita` explica por qué) y el modal es el de editar. */
      puedeInvitar={p.puedeInvitar}
      alInvitar={(cita) => { cerrar(capa.id); p.invitar(cita) }}
      alEditar={(cita) => { cerrar(capa.id); p.setModal({ mode: 'edit', appointment: cita }) }}
      zonaVisor={p.zonaVisor}
      alCerrar={() => cerrar(capa.id)}
      alBloquear={p.onBloquear && !capa.sustituyeA ? (v) => { cerrar(capa.id); p.onBloquear?.(v) } : undefined}
    />
  )
}

/**
 * G3 · «Reagendar cita»: el alta de una cita nueva con el mismo paciente,
 * médico, consultorio y duración. Fecha: la de la original si aún no pasó; si
 * pasó, hoy, a la misma hora (en la hora de quien mira, como el formulario).
 */
export function altaParaReagendar(cita: Appointment, ahora: number): AperturaAltaV2 {
  const inicio = partirFechaHora(cita.start_time)
  const fin = partirFechaHora(cita.end_time)
  const pasada = new Date(cita.start_time).getTime() <= ahora
  const fecha = pasada ? partirFechaHora(new Date(ahora).toISOString()).fecha : inicio.fecha
  return {
    mode: 'create', fecha, hora: inicio.hora, horaFin: fin.hora, tipo: 'cita', todoElDia: 'no', enfocar: 'fecha',
    ...(cita.pacientes ? { paciente: cita.pacientes } : {}),
    ...(cita.medico_id ? { medicoId: cita.medico_id } : {}),
    ...(cita.consultorio_id ? { consultorioId: cita.consultorio_id } : {}),
    /* Tanda I (punto 12): de una CANCELADA con paciente, al guardar se cierra
       (deja de pintarse; se conserva). La no asistida se queda como está. */
    ...(cita.status === 'cancelled' && cita.paciente_id ? { sustituyeA: cita.id } : {}),
  }
}

/**
 * Tanda I (punto 12) · «Reasignar»: la burbuja de alta en ESE horario, sin
 * paciente, como el clic sobre el hueco. Sin ancla (tarjeta centrada u hoja),
 * en el centro de la ventana. Al guardar, el servidor cierra la cancelada.
 */
export function burbujaParaReasignar(
  cita: Pick<Appointment, 'id' | 'start_time' | 'end_time'>, ancla: Caja | null, punto?: Punto,
): { gesto: GestoAlta; horas: { inicio: string; fin: string }; sustituyeA: string } {
  const inicio = partirFechaHora(cita.start_time)
  const fin = partirFechaHora(cita.end_time)
  const centro: Caja = typeof window === 'undefined' ? { left: 0, top: 0, width: 0, height: 0 }
    : { left: window.innerWidth / 2, top: window.innerHeight / 3, width: 0, height: 0 }
  return {
    gesto: {
      fecha: inicio.fecha, hora: inicio.hora, inicio: new Date(cita.start_time), fin: new Date(cita.end_time),
      desdeHueco: false, ancla: ancla ?? centro, ...(punto ? { punto } : {}),
    },
    horas: { inicio: inicio.hora, fin: fin.hora },
    sustituyeA: cita.id,
  }
}

/** Lo que una acción de la tarjeta necesita además de la cita. */
interface ContextoAccion {
  p: PropsInteraccionesV2
  consultorio: Consultorio | null
  cambiarActivo: (c: Consultorio) => void
  navegar: (url: string) => void
  /** T3 · Abre el diálogo de convertir en cita. */
  convertir: () => void
  /** I3 · «¿No es una cita?» de un evento de Google por asignar. */
  noEsCita: () => void
  /** Tanda J (punto 7) · Abre la ventana de ligar e iniciar la consulta. */
  ligar: () => void
  /** Tanda I (punto 12) · Abre la burbuja de «Reasignar» en el hueco de la cancelada. */
  reasignar: () => void
}

/**
 * Lo que HACE cada acción, siempre por las puertas de siempre (decisión 20):
 * el modal de hoy, `handleCancelar` (B3) y `handleDelete`, y
 * `cambiarEstadoCita` para confirmar. Cancelar, eliminar y «No asistió» preguntan antes.
 */
function ejecutarAccion(a: AccionTarjeta, cita: Appointment, x: ContextoAccion): void {
  const { setModal, setConfirm, guardado } = x.p
  const editar = (enfocar?: 'fecha'): void => {
    const apertura: AperturaEdicionV2 = { mode: 'edit', appointment: cita, ...(enfocar ? { enfocar } : {}) }
    setModal(apertura)
  }
  const hacer = (): void => {
    switch (a) {
      case 'editar': editar(); return
      case 'convertir': x.convertir(); return
      case 'no-es-cita': x.noEsCita(); return
      case 'ligar': x.ligar(); return
      case 'reagendar': editar('fecha'); return
      /* G3 · Cancelada o no asistió (decisión de Angel): el alta de una cita
         NUEVA con el mismo paciente, médico y consultorio; la original se queda
         como estaba. Con la puerta de suscripción de «Agendar». */
      case 'reagendar-cita': if (x.p.puedeAgendar()) x.p.setModal(altaParaReagendar(cita, Date.now())); return
      /* Tanda I (punto 12) · Cancelada: el hueco a otro paciente, con la misma puerta. */
      case 'reasignar': if (x.p.puedeAgendar()) x.reasignar(); return
      /* G3 · Atendida: sólo ver el expediente (la atención concluyó). */
      case 'ver-expediente':
        if (cita.pacientes) x.navegar(`/expediente/${cita.pacientes.id}`)
        else editar()
        return
      case 'confirmar': void guardado.cambiarEstadoCita?.(cita.id, 'confirmed'); return
      /* Tanda K, punto 21 · «No asistió» de la burbuja: el mismo cambio de estado. Tanda L, punto 2
         (AG-DT-192): pregunta antes, como «Cancelar cita» (`pideConfirmacion`). */
      case 'no-asistio': void guardado.cambiarEstadoCita?.(cita.id, 'no_show'); return
      case 'cancelar': void guardado.handleCancelar(cita.id); return
      /* B3: borrar sólo un evento sin paciente, aunque la tarjeta ya no ofrezca
         otra cosa: dos puertas al mismo daño (el servidor contesta 409 igual). */
      case 'eliminar': if (esEventoGenerico(cita)) void guardado.handleDelete(cita.id); return
      case 'iniciar-consulta':
        /* Sin paciente o sin consultorio: el modal. (Tanda J: una por ligar ya
           no llega aquí, su principal es `ligar`.) */
        if (!cita.pacientes || !x.consultorio) { editar(); return }
        x.cambiarActivo(x.consultorio)
        x.navegar(`/expediente/${cita.pacientes.id}/nueva-nota?cita=${cita.id}`)
        return
      default: { const nunca: never = a; return nunca }
    }
  }
  if (!pideConfirmacion(a)) { hacer(); return }
  setConfirm({
    message: textoDeConfirmacion(a, cita),
    onConfirm: () => { setConfirm(null); hacer() },
    onCancel: () => setConfirm(null),
  })
}

interface PropsCapaTarjeta {
  capa: Extract<Capa, { tipo: 'tarjeta' }>; p: PropsInteraccionesV2; cerrar: (id: number) => void
  /** T3 · El vigía de la tarjeta al pasar y cómo fijarla. */
  vigia: RefObject<VigiaAlPasar | null>
  fijar: () => void
  /** T3 · «Convertir en cita»: la capa del diálogo (tras la puerta de suscripción). */
  abrirConvertir: (cita: Appointment) => void
  /** Tanda I (punto 12) · «Reasignar»: la burbuja en el hueco de la cancelada. */
  abrirReasignar: (cita: Appointment, ancla: Caja | null, punto?: Punto) => void
  /** Tanda J (punto 7) · «Ligar e iniciar consulta»: la ventana de ligar. */
  abrirLigar: (cita: Appointment) => void
}

/**
 * I3 · «¿No es una cita?» desde la tarjeta: la ruta y, con 200, la marca en el
 * evento pintado (sin esperar al eco del tiempo real, que llega igual y pisa
 * con la fila entera). Un fallo se dice en un aviso.
 */
async function noEsCitaDesdeTarjeta(cita: Appointment, p: PropsInteraccionesV2, avisar: (m: string) => void): Promise<void> {
  const r = await marcarNoEsCita(cita.id)
  if (!r.ok) { avisar(r.motivo); return }
  p.calendarRef.current?.getApi().getEventById(cita.id)?.setExtendedProp('google_asignacion', 'evento')
}

function CapaTarjeta({ capa, p, cerrar, vigia, fijar, abrirConvertir, abrirReasignar, abrirLigar }: PropsCapaTarjeta): ReactElement {
  const { consultorios } = useConsultorios()
  const { consultorioActivo, cambiarActivo } = useConsultorioActivo()
  const toast = useToast()
  const router = useRouter()
  const { cita } = capa
  /* I3 · Un evento de Google por asignar no trae consultorio: para «Iniciar
     consulta» cuenta el activo de quien mira (el modal deja elegir otro). */
  const consultorio = consultorios.find(c => c.id === cita.consultorio_id)
    ?? (esPorAsignar(cita) && consultorioActivo && consultorios.some(c => c.id === consultorioActivo.id) ? consultorioActivo : null)
  const medico = !p.isSingleDoctor && cita.medico_id ? p.medicos.find(m => m.id === cita.medico_id) : undefined
  /* T1 · La regla del servidor (`motivoSinWhatsApp`), con la hora VIVA de la
     tarjeta y el instante en que se abrió: ni pasada, ni atendida, ni
     cancelada, ni de todo el día, ni sin teléfono. */
  const conWhatsApp = motivoSinWhatsApp(capa.vista, telefonoParaWhatsApp(cita.pacientes?.telefono, cita.reserva_telefono), capa.abiertaEn) === null
  const conCorreo = motivoSinCorreo(capa.vista, correoParaConfirmacion(cita.pacientes?.email, cita.reserva_correo), capa.abiertaEn) === null
  /* La acción cierra la tarjeta SIN salida animada: lo que abre (el modal, el
     aviso) la tapa, y el foco vuelve a la cita antes de que lo tome lo nuevo. */
  const alAccion = (a: AccionTarjeta): void => {
    cerrar(capa.id)
    ejecutarAccion(a, cita, {
      p, consultorio, cambiarActivo, navegar: url => router.push(url), convertir: () => abrirConvertir(cita),
      noEsCita: () => void noEsCitaDesdeTarjeta(cita, p, m => toast.error(m)),
      reasignar: () => abrirReasignar(cita, capa.ancla, capa.punto),
      ligar: () => abrirLigar(cita),
    })
  }
  return (
    <TarjetaLectura
      cita={capa.vista} ancla={capa.ancla} punto={capa.punto} comoHoja={p.isMobile} zonaVisor={p.zonaVisor}
      puedeIniciarConsulta={puedeIniciarConsulta(cita, { ...p.quien, consultorioExiste: consultorio !== null })}
      conConfirmar={p.guardado.cambiarEstadoCita !== undefined}
      nombreMedico={medico ? componerNombreMedicoCompleto(medico) : null}
      alAccion={alAccion} alCerrar={() => cerrar(capa.id)}
      alPasar={capa.alPasar} sinEntrada={capa.sinEntrada} alFijar={fijar} destacar={capa.destacar}
      alEntrarPuntero={() => vigia.current?.entrarTarjeta()} alSalirPuntero={() => vigia.current?.salirTarjeta()}
      puedeVerExpediente={p.quien.esMedico && Boolean(cita.pacientes)}
      /* E7 · el WhatsApp manual, con la regla del modal y del servidor (T1).
         Montarlo no emite nada: sólo al pulsar. G3: una pieza más de la
         rejilla de la tarjeta («Enviar confirmación» / «Enviar recordatorio»). */
      whatsapp={conWhatsApp
        ? (o) => <BotonWhatsAppCita citaId={cita.id} tipo="enlace" marcadoEn={cita.whatsapp_sent_at ?? null} enCapa
            confirmada={capa.vista.status === 'confirmed'} etiqueta={o.etiqueta}
            tabIndex={o.tabIndex} onFocus={o.onFocus} alMensaje={o.alMensaje} />
        : undefined}
      /* Tanda K, punto 21 · el correo, con la regla del formulario y del servidor (`motivoSinCorreo`). */
      correo={conCorreo
        ? (o) => <BotonCorreoCita citaId={cita.id} confirmada={capa.vista.status === 'confirmed'} enCapa etiqueta={o.etiqueta}
            tabIndex={o.tabIndex} onFocus={o.onFocus} alMensaje={o.alMensaje} />
        : undefined}
      enlacePropio={Boolean(cita.medico_id) && cita.medico_id === p.quien.perfilId}
    />
  )
}

/**
 * T3 · Lo que guarda «Convertir en cita»: el PUT de siempre por `handleSave`
 * (optimista, empalmes y errores incluidos), con lo que una cita lleva y un
 * evento no: paciente (y el título que se compone de él, como el modal),
 * consultorio y tipo. La pinta del evento se vacía, como en una cita.
 */
export function datosDeConversion(cita: Appointment, e: EleccionConversion): DatosGuardado {
  return {
    id: cita.id,
    title: `${e.paciente.nombre} ${e.paciente.apellidos}`,
    paciente_id: e.paciente.id,
    pacientes: e.paciente,
    medico_id: cita.medico_id,
    consultorio_id: e.consultorioId,
    icono: null,
    color: null,
    updated_at: cita.updated_at,
    ...(e.tipoCitaId ? { tipo_cita_id: e.tipoCitaId } : {}),
  }
}

interface PropsCapaConvertir { capa: Extract<Capa, { tipo: 'convertir' }>; p: PropsInteraccionesV2; cerrar: (id: number) => void }

function CapaConvertir({ capa, p, cerrar }: PropsCapaConvertir): ReactElement {
  return (
    <ConvertirEnCita cita={capa.cita} perfilId={p.quien.perfilId} zonaVisor={p.zonaVisor}
      alCerrar={() => cerrar(capa.id)}
      alConvertir={(e) => { cerrar(capa.id); void p.guardado.handleSave(datosDeConversion(capa.cita, e)) }} />
  )
}

/** Espera a que el evento `id` esté pintado (tras navegar) y lo entrega; `null` si no llega. */
export function esperarEvento(api: CalendarApiV2, id: string, alLlegar: (ev: EventApi | null) => void): () => void {
  const ya = api.getEventById(id)
  if (ya) { alLlegar(ya); return () => undefined }
  const alCambiar = (): void => {
    const ev = api.getEventById(id)
    if (ev) { limpiar(); alLlegar(ev) }
  }
  const t = window.setTimeout(() => { limpiar(); alLlegar(null) }, ESPERA_CITA_MS)
  function limpiar(): void { api.off('eventsSet', alCambiar); window.clearTimeout(t) }
  api.on('eventsSet', alCambiar)
  return limpiar
}

/** `localStorage`, o `null` si el navegador lo bloquea (modo privado, datos del sitio bloqueados). */
function almacenLocal(): AlmacenPreferencia | null {
  try { return window.localStorage } catch { return null }
}

/**
 * Lo que hace cada atajo (F3.5): lo mismo que su botón. Las vistas pasan por
 * `cambiarVista` (con el formato del ancho, como el segmentado) y `/` pulsa la
 * lupa de la barra, para que el foco vuelva a ella al cerrar el buscador.
 */
export function ejecutarAtajo(a: AccionAtajo, p: PropsInteraccionesV2, abrirAyuda: () => void): void {
  const api = p.calendarRef.current?.getApi()
  if (a === 'hoy') api?.today()
  else if (a === 'siguiente') api?.next()
  else if (a === 'anterior') api?.prev()
  else if (a === 'vista-dia') p.onVista(vistaEnElOtroFormato('timeGridDay', p.isMobile))
  else if (a === 'vista-semana') p.onVista(vistaEnElOtroFormato('timeGridWeek', p.isMobile))
  else if (a === 'vista-mes') p.onVista('dayGridMonth')
  else if (a === 'agendar') p.onAgendar()
  else if (a === 'buscar') document.querySelector<HTMLButtonElement>('[data-buscar-citas]')?.click()
  else abrirAyuda()
}

/**
 * Los atajos con su preferencia (WCAG 2.1.4: se pueden apagar desde la ayuda y
 * se recuerda en el navegador). No actúan con una capa abierta.
 */
function useAtajosV2(p: PropsInteraccionesV2, capaAbierta: boolean, abrirAyuda: () => void): {
  encendidos: boolean; cambiarEncendidos: (v: boolean) => void
} {
  const [encendidos, setEncendidos] = useState(() => leerAtajosEncendidos(almacenLocal()))
  const cambiarEncendidos = useCallback((v: boolean) => {
    setEncendidos(v)
    guardarAtajosEncendidos(almacenLocal(), v)
  }, [])
  useAtajosAgenda({ activo: true, encendidos, capaAbierta, alAccion: a => ejecutarAtajo(a, p, abrirAyuda) })
  return { encendidos, cambiarEncendidos }
}

/** La fila con las puntas vivas del evento pintado (tras un arrastre aún sin respuesta). */
function conPuntasVivas(cita: Appointment, calendarRef: CalRef): Appointment {
  const ev = calendarRef.current?.getApi().getEventById(cita.id)
  if (!ev?.start || !ev.end || ev.allDay) return cita
  return { ...cita, start_time: ev.start.toISOString(), end_time: ev.end.toISOString() }
}

/**
 * Del buscador a la cita (F3.6): si el filtro de médico la esconde se cambia al
 * suyo, se va a su día en la vista Día y, cuando la cita está pintada, se abre
 * su tarjeta (sin ancla: centrada, u hoja en el teléfono).
 */
function useIrACita(p: PropsInteraccionesV2): ApiInteraccionesV2['irACita'] {
  const toast = useToast()
  const pRef = useRef(p)
  useEffect(() => { pRef.current = p })
  const espera = useRef<(() => void) | null>(null)
  useEffect(() => () => espera.current?.(), [])
  return useCallback((c: CitaEncontrada, destacar?: 'reagendar') => {
    const { calendarRef, filtroActivo, alFiltrarMedico, onVista, isMobile } = pRef.current
    const api = calendarRef.current?.getApi()
    if (!api) return
    espera.current?.()
    if (filtroActivo && c.medico_id && c.medico_id !== filtroActivo) alFiltrarMedico(c.medico_id)
    onVista(vistaEnElOtroFormato('timeGridDay', isMobile), new Date(c.start_time))
    /* Si ya estaba pintada, `esperarEvento` contesta antes de volver: entonces
       no queda nada que limpiar y `espera` se queda en null. */
    let resuelta = false
    const limpiar = esperarEvento(api, c.id, (ev) => {
      resuelta = true
      espera.current = null
      /* Por `abrirCita`, la única puerta (`altaCitas.ts`): la misma regla de
         Google y el mismo estrechamiento de `extendedProps` que un clic. */
      if (ev) pRef.current.abrirCita(ev, destacar ? { ancla: null, destacar } : undefined)
      else toast.info('No se pudo mostrar esa cita en la agenda.')
    })
    if (!resuelta) espera.current = limpiar
  }, [toast])
}

/**
 * F3.7: deslizar en las listas de Día y Semana del teléfono; en el Mes, no
 * (ahí tocar elige el día). Las flechas ‹ › siguen ahí (WCAG 2.5.1).
 */
export function deslizarActivo(isMobile: boolean, vista: string): boolean {
  return isMobile && (vista === 'listDay' || vista === 'listWeek')
}

function useDeslizarV2(p: PropsInteraccionesV2): void {
  const { calendarRef } = p
  useDeslizarPeriodo({
    raiz: p.raizRef,
    activo: deslizarActivo(p.isMobile, p.currentView),
    alSiguiente: () => calendarRef.current?.getApi().next(),
    alAnterior: () => calendarRef.current?.getApi().prev(),
  })
}

/** T3 · ¿Es la tarjeta abierta al pasar el ratón? */
function esAlPasar(c: Capa | null): c is Extract<Capa, { tipo: 'tarjeta' }> {
  return c?.tipo === 'tarjeta' && c.alPasar === true
}

/**
 * T3 · La tarjeta al pasar el ratón (punto 15): el oyente y el vigía
 * (`useTarjetaAlPasar`), y `fijar`, que cambia la tarjeta al pasar por la de
 * siempre (un clic dentro de ella). Abre por `abrirCita`, la única puerta.
 */
function useAlPasarV2(
  p: PropsInteraccionesV2, capaRef: RefObject<Capa | null>,
  cerrar: (id: number) => void, abrirTarjeta: ApiInteraccionesV2['abrirTarjeta'],
): { vigia: RefObject<VigiaAlPasar | null>; fijar: () => void } {
  const vigia = useTarjetaAlPasar({
    raiz: p.raizRef,
    desactivada: p.isMobile,
    ocupada: () => capaRef.current !== null && !esAlPasar(capaRef.current),
    abrir: (id, ancla, punto) => {
      const ev = p.calendarRef.current?.getApi().getEventById(id)
      if (ev) p.abrirCita(ev, { ancla, punto, alPasar: true })
    },
    cerrar: () => { const c = capaRef.current; if (esAlPasar(c)) cerrar(c.id) },
  })
  const fijar = useCallback(() => {
    const c = capaRef.current
    if (esAlPasar(c)) abrirTarjeta(c.cita, c.ancla, c.punto)
  }, [capaRef, abrirTarjeta])
  return { vigia, fijar }
}

export default function InteraccionesV2(p: PropsInteraccionesV2): ReactElement | null {
  const { apiRef, alCambiarListas, alCambiarAtajos, calendarRef, medicos } = p
  const { capa, capaRef, abrir, cerrar: cerrarCapa } = useCapa()

  /* Cerrar la burbuja suelta también el tramo marcado en la rejilla, que
     `unselectCancel=".ag-capa"` mantenía mientras estaba abierta. */
  const cerrar = useCallback((id: number) => {
    if (capaRef.current?.id === id && capaRef.current.tipo === 'burbuja') calendarRef.current?.getApi().unselect()
    cerrarCapa(id)
  }, [capaRef, calendarRef, cerrarCapa])

  const abrirTarjeta = useCallback<ApiInteraccionesV2['abrirTarjeta']>((cita, ancla, punto, alPasar = false, destacar) => {
    const c = capaRef.current
    /* T3 · Al pasar el ratón nunca encima de otra capa (burbuja, tarjeta fija, ayuda). */
    if (alPasar && c !== null && !esAlPasar(c)) return
    const base = { tipo: 'tarjeta' as const, cita, vista: conPuntasVivas(cita, calendarRef), abiertaEn: Date.now() }
    /* T3 · El clic sobre la cita cuya tarjeta se abrió al pasar la FIJA: la de
       siempre, en el mismo sitio y sin volver a entrar. */
    if (!alPasar && esAlPasar(c) && c.cita.id === cita.id) {
      abrir({ ...base, ancla: c.ancla, ...(c.punto ? { punto: c.punto } : {}), sinEntrada: true })
      return
    }
    abrir({ ...base, ancla, ...(punto ? { punto } : {}), ...(alPasar ? { alPasar } : {}), ...(destacar ? { destacar } : {}) })
  }, [abrir, calendarRef, capaRef])
  const irACita = useIrACita(p)
  const abrirAyuda = useCallback(() => abrir({ tipo: 'ayuda' }), [abrir])
  const abrirConvertir = useCallback((cita: Appointment) => {
    if (p.puedeAgendar()) abrir({ tipo: 'convertir', cita })
  }, [abrir, p])
  const abrirReasignar = useCallback((cita: Appointment, ancla: Caja | null, punto?: Punto) => {
    abrir({ tipo: 'burbuja', ...burbujaParaReasignar(cita, ancla, punto) })
  }, [abrir])
  /* Tanda J · El escudo de siempre: el segundo clic de un doble clic sobre
     «Ligar e iniciar consulta» de la tarjeta no cae en la ventana que se abre. */
  const escudoLigar = useEscudoTrasRegistro(capa?.tipo !== 'ligar', { dentroDeDialogos: true })
  const activarEscudo = escudoLigar.activar
  const abrirLigar = useCallback((cita: Appointment) => { activarEscudo(); abrir({ tipo: 'ligar', cita }) }, [abrir, activarEscudo])
  const atajos = useAtajosV2(p, capa !== null && !esAlPasar(capa), abrirAyuda)
  const { vigia, fijar } = useAlPasarV2(p, capaRef, cerrar, abrirTarjeta)
  /* La tarjeta al pasar dejó de serlo (se fijó, se cerró o la tapó otra capa): el vigía la suelta. */
  useEffect(() => { if (!esAlPasar(capa)) vigia.current?.soltar() }, [capa, vigia])
  useDeslizarV2(p)

  useImperativeHandle(apiRef, () => ({
    abrirBurbuja: (gesto) => {
      const horas = horasDelGesto(gesto)
      /* Un clic dispara `dateClick` Y `select` (los dos idempotentes): el
         segundo encuentra la misma burbuja abierta y no la vuelve a montar. */
      const c = capaRef.current
      if (c?.tipo === 'burbuja' && c.gesto.fecha === gesto.fecha && c.horas.inicio === horas.inicio && c.horas.fin === horas.fin) return
      abrir({ tipo: 'burbuja', gesto, horas })
    },
    abrirTarjeta,
    irACita,
    abrirAyuda,
  }), [abrir, capaRef, abrirTarjeta, irACita, abrirAyuda])

  useEffect(() => {
    alCambiarListas(true)
    return () => alCambiarListas(false)
  }, [alCambiarListas])
  useEffect(() => {
    alCambiarAtajos(atajos.encendidos)
  }, [alCambiarAtajos, atajos.encendidos])
  useEffect(() => () => alCambiarAtajos(false), [alCambiarAtajos])
  const medicosBurbuja = useMemo(() => medicos.map(m => ({ id: m.id, nombre: componerNombreMedicoCompleto(m) })), [medicos])

  if (capa?.tipo === 'burbuja') return <CapaBurbuja key={capa.id} capa={capa} medicos={medicosBurbuja} p={p} cerrar={cerrar} />
  if (capa?.tipo === 'tarjeta') {
    return (
      <CapaTarjeta key={capa.id} capa={capa} p={p} cerrar={cerrar} vigia={vigia} fijar={fijar}
        abrirConvertir={abrirConvertir} abrirReasignar={abrirReasignar} abrirLigar={abrirLigar} />
    )
  }
  if (capa?.tipo === 'convertir') return <CapaConvertir key={capa.id} capa={capa} p={p} cerrar={cerrar} />
  if (capa?.tipo === 'ligar') {
    /* «¿No es una cita?» desde la ventana: la marca en el evento pintado, como desde la tarjeta. */
    const marcarEvento = (): void => { p.calendarRef.current?.getApi().getEventById(capa.cita.id)?.setExtendedProp('google_asignacion', 'evento') }
    return <VentanaLigarCita key={capa.id} citaId={capa.cita.id} alCerrar={() => cerrar(capa.id)} alNoEsCita={marcarEvento} />
  }
  if (capa?.tipo === 'ayuda') {
    return <AyudaAtajos key={capa.id} encendidos={atajos.encendidos} alCambiarEncendidos={atajos.cambiarEncendidos} alCerrar={() => cerrar(capa.id)} />
  }
  return null
}
