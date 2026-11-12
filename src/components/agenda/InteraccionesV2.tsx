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
import type FullCalendar from '@fullcalendar/react'
import type { EventApi } from '@fullcalendar/core'
import type { ModalState } from '@/components/agenda/AppointmentModal'
import BurbujaAlta, { type MasOpcionesBurbuja, type MedicoBurbuja } from '@/components/agenda/BurbujaAlta'
import TarjetaLectura from '@/components/agenda/TarjetaLectura'
import AyudaAtajos from '@/components/agenda/AyudaAtajos'
import { useAtajosAgenda } from '@/app/(app)/agenda/useAtajosAgenda'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useToast } from '@/components/ui/Toast'
import { useConsultorios } from '@/hooks/useConsultorios'
import type { Consultorio } from '@/types'
import type { Horario, MedicoConfig } from '@/lib/configApp'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
import type { ApiInteraccionesV2, AperturaAltaV2, AperturaEdicionV2, CambiarEstadoCita, GestoAlta } from '@/lib/agenda/contratosV2'
import type { Caja, Punto } from '@/lib/agenda/posicionCapa'
import { guardarAltaRapida, horasDelGesto, type DependenciasGuardado } from '@/lib/agenda/altaRapida'
import { avisoFueraDeHorario, avisoFinFueraDeHorario } from '@/lib/agenda/horarioAgenda'
import { empalmesPintados, mensajeEmpalme } from '@/lib/agenda/empalmesCita'
import { esEventoGenerico } from '@/lib/agenda/tarjetasAgenda'
import { vistaEnElOtroFormato } from '@/lib/agenda/vistasAgenda'
import { guardarAtajosEncendidos, leerAtajosEncendidos, type AccionAtajo, type AlmacenPreferencia } from '@/lib/agenda/atajosAgenda'
import type { CitaEncontrada } from '@/lib/agenda/buscarCitasPaciente'
import {
  pideConfirmacion, puedeIniciarConsulta, textoDeConfirmacion, type AccionTarjeta, type QuienMira,
} from '@/lib/agenda/accionesTarjeta'

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
  handleSave: (datos: DatosGuardado) => Promise<void>
  handleCancelar: (id: string) => Promise<void>
  handleDelete: (id: string) => Promise<void>
  /** De `guardadoCitas.ts` (Movimiento) cuando exista; sin ella, la tarjeta no ofrece «Confirmar». */
  cambiarEstadoCita?: CambiarEstadoCita
}

export interface PropsInteraccionesV2 {
  apiRef: Ref<ApiInteraccionesV2>
  /** `true` al montar, `false` al desmontar: la raíz lo publica para las pruebas. */
  alCambiarListas: (listas: boolean) => void
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
  /** El botón «Agendar» (atajo `c`): el modal de alta, con el bloqueo de suscripción delante. */
  onAgendar: () => void
  /** `abrirCita` de `altaCitas.ts`, la única puerta a una cita. */
  abrirCita: (evento: EventApi) => void
  medicos: readonly MedicoConfig[]
  /** El médico de la burbuja: el del filtro, o el único; `null` = «Todos». */
  filtroMedico: string | null
  horario: Horario
  guardado: GuardadoV2
  setModal: Dispatch<SetStateAction<ModalState>>
  setConfirm: Dispatch<SetStateAction<ConfirmState>>
}

type Capa =
  | { id: number; tipo: 'burbuja'; gesto: GestoAlta; horas: { inicio: string; fin: string } }
  /* `cita` es la fila tal como la tiene el evento (la que recibe el modal, como
     hoy); `vista`, la misma con las puntas VIVAS del evento, que es lo que se
     lee en la tarjeta justo después de un arrastre. */
  | { id: number; tipo: 'tarjeta'; cita: Appointment; vista: Appointment; ancla: Caja | null; punto?: Punto }
  | { id: number; tipo: 'ayuda' }

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
  }
}

/** Los avisos y el guardado de la burbuja, con las piezas de la agenda (B7c, P3). */
function useDependenciasGuardado(p: PropsInteraccionesV2): DependenciasGuardado {
  const { calendarRef, horario, guardado, setConfirm } = p
  return {
    avisoHorario: (inicio, fin) => avisoFueraDeHorario(inicio, horario, 'Vas a agendar a las') ?? avisoFinFueraDeHorario(fin, horario),
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
    guardar: (datos) => { void guardado.handleSave(datos) },
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
      alGuardar={(datos, horas) => guardarAltaRapida(datos, capa.horas, horas, deps)}
      alMasOpciones={(v) => { cerrar(capa.id); p.setModal(aperturaDesdeBurbuja(v)) }}
      alCerrar={() => cerrar(capa.id)}
    />
  )
}

/** Lo que una acción de la tarjeta necesita además de la cita. */
interface ContextoAccion {
  p: PropsInteraccionesV2
  consultorio: Consultorio | null
  cambiarActivo: (c: Consultorio) => void
  navegar: (url: string) => void
}

/**
 * Lo que HACE cada acción, siempre por las puertas de siempre (decisión 20):
 * el modal de hoy, `handleCancelar` (B3) y `handleDelete`, y
 * `cambiarEstadoCita` para confirmar. Cancelar y eliminar preguntan antes.
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
      case 'reagendar': editar('fecha'); return
      case 'confirmar': void guardado.cambiarEstadoCita?.(cita.id, 'confirmed'); return
      case 'cancelar': void guardado.handleCancelar(cita.id); return
      /* B3: borrar sólo un evento sin paciente, aunque la tarjeta ya no ofrezca
         otra cosa: dos puertas al mismo daño (el servidor contesta 409 igual). */
      case 'eliminar': if (esEventoGenerico(cita)) void guardado.handleDelete(cita.id); return
      case 'iniciar-consulta':
        /* Por ligar (o sin consultorio): el modal, donde vive el ligado (D7). */
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

interface PropsCapaTarjeta { capa: Extract<Capa, { tipo: 'tarjeta' }>; p: PropsInteraccionesV2; cerrar: (id: number) => void }

function CapaTarjeta({ capa, p, cerrar }: PropsCapaTarjeta): ReactElement {
  const { consultorios } = useConsultorios()
  const { cambiarActivo } = useConsultorioActivo()
  const router = useRouter()
  const { cita } = capa
  const consultorio = consultorios.find(c => c.id === cita.consultorio_id) ?? null
  const medico = !p.isSingleDoctor && cita.medico_id ? p.medicos.find(m => m.id === cita.medico_id) : undefined
  const viva = cita.status === 'scheduled' || cita.status === 'confirmed'
  /* La acción cierra la tarjeta SIN salida animada: lo que abre (el modal, el
     aviso) la tapa, y el foco vuelve a la cita antes de que lo tome lo nuevo. */
  const alAccion = (a: AccionTarjeta): void => {
    cerrar(capa.id)
    ejecutarAccion(a, cita, { p, consultorio, cambiarActivo, navegar: url => router.push(url) })
  }
  return (
    <TarjetaLectura
      cita={capa.vista} ancla={capa.ancla} punto={capa.punto} comoHoja={p.isMobile} zonaVisor={p.zonaVisor}
      puedeIniciarConsulta={puedeIniciarConsulta(cita, { ...p.quien, consultorioExiste: consultorio !== null })}
      conConfirmar={p.guardado.cambiarEstadoCita !== undefined}
      nombreMedico={medico ? componerNombreMedicoCompleto(medico) : null}
      alAccion={alAccion} alCerrar={() => cerrar(capa.id)}
      /* E7 · el WhatsApp manual, con las condiciones del modal (cita viva, con
         paciente o por ligar). Montarlo no emite nada: sólo al pulsar. */
      extra={viva && !esEventoGenerico(cita)
        ? <BotonWhatsAppCita citaId={cita.id} tipo="enlace" marcadoEn={cita.whatsapp_sent_at ?? null} compacto />
        : undefined}
    />
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
function useIrACita(p: PropsInteraccionesV2): (c: CitaEncontrada) => void {
  const toast = useToast()
  const pRef = useRef(p)
  useEffect(() => { pRef.current = p })
  const espera = useRef<(() => void) | null>(null)
  useEffect(() => () => espera.current?.(), [])
  return useCallback((c: CitaEncontrada) => {
    const { calendarRef, filtroActivo, alFiltrarMedico, onVista, isMobile } = pRef.current
    const api = calendarRef.current?.getApi()
    if (!api) return
    espera.current?.()
    if (filtroActivo && c.medico_id && c.medico_id !== filtroActivo) alFiltrarMedico(c.medico_id)
    onVista(vistaEnElOtroFormato('timeGridDay', isMobile), new Date(c.start_time))
    espera.current = esperarEvento(api, c.id, (ev) => {
      espera.current = null
      /* Por `abrirCita`, la única puerta (`altaCitas.ts`): la misma regla de
         Google y el mismo estrechamiento de `extendedProps` que un clic. */
      if (ev) pRef.current.abrirCita(ev)
      else toast.info('No se pudo mostrar esa cita en la agenda.')
    })
  }, [toast])
}

export default function InteraccionesV2(p: PropsInteraccionesV2): ReactElement | null {
  const { apiRef, alCambiarListas, calendarRef, medicos } = p
  const { capa, capaRef, abrir, cerrar: cerrarCapa } = useCapa()

  /* Cerrar la burbuja suelta también el tramo marcado en la rejilla, que
     `unselectCancel=".ag-capa"` mantenía mientras estaba abierta. */
  const cerrar = useCallback((id: number) => {
    if (capaRef.current?.id === id && capaRef.current.tipo === 'burbuja') calendarRef.current?.getApi().unselect()
    cerrarCapa(id)
  }, [capaRef, calendarRef, cerrarCapa])

  const abrirTarjeta = useCallback<ApiInteraccionesV2['abrirTarjeta']>((cita, ancla, punto) => {
    abrir({ tipo: 'tarjeta', cita, vista: conPuntasVivas(cita, calendarRef), ancla, ...(punto ? { punto } : {}) })
  }, [abrir, calendarRef])
  const irACita = useIrACita(p)
  const abrirAyuda = useCallback(() => abrir({ tipo: 'ayuda' }), [abrir])
  const atajos = useAtajosV2(p, capa !== null, abrirAyuda)

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

  const medicosBurbuja = useMemo(
    () => medicos.map(m => ({ id: m.id, nombre: componerNombreMedicoCompleto(m) })),
    [medicos],
  )

  if (capa?.tipo === 'burbuja') return <CapaBurbuja key={capa.id} capa={capa} medicos={medicosBurbuja} p={p} cerrar={cerrar} />
  if (capa?.tipo === 'tarjeta') return <CapaTarjeta key={capa.id} capa={capa} p={p} cerrar={cerrar} />
  if (capa?.tipo === 'ayuda') {
    return <AyudaAtajos key={capa.id} encendidos={atajos.encendidos} alCambiarEncendidos={atajos.cambiarEncendidos} alCerrar={() => cerrar(capa.id)} />
  }
  return null
}
