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
import type FullCalendar from '@fullcalendar/react'
import type { ModalState } from '@/components/agenda/AppointmentModal'
import BurbujaAlta, { type MasOpcionesBurbuja, type MedicoBurbuja } from '@/components/agenda/BurbujaAlta'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import type { Horario, MedicoConfig } from '@/lib/configApp'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
import type { ApiInteraccionesV2, AperturaAltaV2, GestoAlta } from '@/lib/agenda/contratosV2'
import type { Caja, Punto } from '@/lib/agenda/posicionCapa'
import { guardarAltaRapida, horasDelGesto, type DependenciasGuardado } from '@/lib/agenda/altaRapida'
import { avisoFueraDeHorario, avisoFinFueraDeHorario } from '@/lib/agenda/horarioAgenda'
import { empalmesPintados, mensajeEmpalme } from '@/lib/agenda/empalmesCita'

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>
/* Misma forma que el `useState` de `AgendaCliente.tsx`, duplicada a propósito
   como en `guardadoCitas.ts` y `altaCitas.ts`. */
type ConfirmState = { message: string; onConfirm: () => void; onCancel: () => void } | null

/** Lo que la agenda le presta para guardar: sus mismas funciones. */
export interface GuardadoV2 {
  handleSave: (datos: DatosGuardado) => Promise<void>
}

export interface PropsInteraccionesV2 {
  apiRef: Ref<ApiInteraccionesV2>
  /** `true` al montar, `false` al desmontar: la raíz lo publica para las pruebas. */
  alCambiarListas: (listas: boolean) => void
  calendarRef: CalRef
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
  | { id: number; tipo: 'tarjeta'; cita: Appointment; ancla: Caja | null; punto?: Punto }

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

export default function InteraccionesV2(p: PropsInteraccionesV2): ReactElement | null {
  const { apiRef, alCambiarListas, calendarRef, medicos, setModal } = p
  const { capa, capaRef, abrir, cerrar: cerrarCapa } = useCapa()

  /* Cerrar la burbuja suelta también el tramo marcado en la rejilla, que
     `unselectCancel=".ag-capa"` mantenía mientras estaba abierta. */
  const cerrar = useCallback((id: number) => {
    if (capaRef.current?.id === id && capaRef.current.tipo === 'burbuja') calendarRef.current?.getApi().unselect()
    cerrarCapa(id)
  }, [capaRef, calendarRef, cerrarCapa])

  useImperativeHandle(apiRef, () => ({
    abrirBurbuja: (gesto) => {
      const horas = horasDelGesto(gesto)
      /* Un clic dispara `dateClick` Y `select` (los dos idempotentes): el
         segundo encuentra la misma burbuja abierta y no la vuelve a montar. */
      const c = capaRef.current
      if (c?.tipo === 'burbuja' && c.gesto.fecha === gesto.fecha && c.horas.inicio === horas.inicio && c.horas.fin === horas.fin) return
      abrir({ tipo: 'burbuja', gesto, horas })
    },
    /* Provisional hasta la tarjeta de lectura: la edición de hoy. */
    abrirTarjeta: (cita) => setModal({ mode: 'edit', appointment: cita }),
  }), [abrir, capaRef, setModal])

  useEffect(() => {
    alCambiarListas(true)
    return () => alCambiarListas(false)
  }, [alCambiarListas])

  const medicosBurbuja = useMemo(
    () => medicos.map(m => ({ id: m.id, nombre: componerNombreMedicoCompleto(m) })),
    [medicos],
  )

  if (capa?.tipo === 'burbuja') return <CapaBurbuja key={capa.id} capa={capa} medicos={medicosBurbuja} p={p} cerrar={cerrar} />
  return null
}
