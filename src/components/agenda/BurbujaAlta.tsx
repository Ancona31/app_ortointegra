'use client'

/**
 * src/components/agenda/BurbujaAlta.tsx
 *
 * La burbuja de creación rápida (bloque F, F3.1, detrás del interruptor;
 * decisión de §2 del plan: «clic en un hueco abre una burbuja con paciente,
 * hora y Guardar, con Más opciones hacia el modal completo, que se conserva»).
 * La monta `InteraccionesV2.tsx`; el enrutado (`abrirAlta` → burbuja si
 * `agendaV2` y el gesto es de una franja de la rejilla o de una celda del Mes)
 * vive en `altaCitas.ts`. Desde una celda del Mes abre con las horas en blanco.
 *
 * Lo que decide el llamador, y por eso no está aquí: el bloqueo por
 * suscripción y la confirmación de «fuera de horario» (ANTES de abrir), el
 * aviso de empalme de B7 y el 409 del servidor (al guardar, dentro de
 * `alGuardar`), la invitación de Google tras crear y el `api.unselect()` al
 * cerrar. La burbuja sólo arma el alta (`datosDeAltaRapida`, con la forma del
 * modal) y se la da.
 *
 * Accesibilidad: `role="dialog"` con `aria-modal`, nombrada por su título
 * («Nueva cita · mié 11, 10:00–11:30»); foco en el buscador; Escape cierra
 * (`useDialogoModal`, que también atrapa el Tab y devuelve el foco); los
 * resultados son un `listbox` con `aria-activedescendant` y el foco no sale
 * del campo.
 *
 * Movimiento: entra desde el punto pulsado y sale hacia él (`.ag-capa`, CSS de
 * F3). «Más opciones» NO anima la salida: el modal la tapa al instante.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import type { DatosGuardado } from '@/lib/agenda/tiposAgenda'
import { posicionCapa, type Caja, type Punto } from '@/lib/agenda/posicionCapa'
import { duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'
import { idDeOpcion, indiceTrasTecla } from '@/lib/agenda/opcionesLista'
import { buscarPacientes, limpiarTextoBusqueda } from '@/lib/agenda/buscarCitasPaciente'
import {
  consultorioPropuesto, datosDeAltaRapida, etiquetaBurbuja, finTrasMoverInicio, medicoPropuesto, motivoParaNoGuardar,
  necesitaElegirMedico, type ConsultorioAlta,
} from '@/lib/agenda/altaRapida'

export interface MedicoBurbuja { id: string; nombre: string }

export interface MasOpcionesBurbuja {
  fecha: string
  hora: string
  horaFin: string
  paciente?: PacienteBusqueda
  medicoId: string | null
}

interface Props {
  fecha: string
  horaInicio: string
  horaFin: string
  /** El rectángulo de la franja seleccionada, en coordenadas de ventana. */
  ancla: Caja
  punto?: Punto
  medicos: readonly MedicoBurbuja[]
  /** El filtro de médico de la agenda; `null` = «Todos». */
  filtroMedico: string | null
  consultorioActivo: ConsultorioAlta | null
  /** Guarda (avisos y `handleSave`); `true` si se mandó a guardar y la burbuja puede cerrarse. */
  alGuardar: (datos: DatosGuardado, horas: { inicio: string; fin: string }) => Promise<boolean>
  alMasOpciones: (valores: MasOpcionesBurbuja) => void
  alCerrar: () => void
}

/** Coloca el panel junto al ancla, en el mismo commit en que se monta (sin un fotograma fuera de sitio). */
function colocar(nodo: HTMLElement, ancla: Caja, punto?: Punto): void {
  const p = posicionCapa(ancla, { width: nodo.offsetWidth, height: nodo.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight }, punto)
  nodo.style.left = `${p.left}px`
  nodo.style.top = `${p.top}px`
  nodo.style.transformOrigin = p.origen
}

/** La salida animada, con su temporizador de seguridad por si `animationend` no llega. */
function useSalida(alCerrar: () => void): { saliendo: boolean; salir: () => void; alTerminar: () => void } {
  const [saliendo, setSaliendo] = useState(false)
  const alCerrarRef = useRef(alCerrar)
  useEffect(() => { alCerrarRef.current = alCerrar }, [alCerrar])
  useEffect(() => {
    if (!saliendo) return
    const t = setTimeout(() => alCerrarRef.current(), duracionToken('--ag-dur-micro') + 100)
    return () => clearTimeout(t)
  }, [saliendo])
  const salir = useCallback(() => {
    if (prefiereMenosMovimiento()) alCerrarRef.current()
    else setSaliendo(true)
  }, [])
  const alTerminar = useCallback(() => { if (saliendo) alCerrarRef.current() }, [saliendo])
  return { saliendo, salir, alTerminar }
}

/**
 * ¿Hay OTRO diálogo modal abierto encima? Entonces el toque es suyo, no
 * «fuera» de esta capa: el aviso de empalme o de horario (`ConfirmModal`) sale
 * encima de la capa abierta, y contestarle —también pulsando su velo, que es
 * HERMANO del diálogo y no su hijo— no puede cerrarla.
 */
function hayOtroDialogoModal(propio: HTMLElement): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).some(d => d !== propio)
}

/**
 * Tocar fuera cierra (con su salida), como en cualquier calendario. `pointerdown`
 * en captura: llega antes de que FullCalendar empiece una selección nueva.
 * ⚠️ COPIA DELIBERADA en `TarjetaLectura.tsx`: dos usos no justifican un gancho
 * compartido (CLAUDE.md, protocolo 4).
 */
function useCerrarAlTocarFuera(panel: { current: HTMLElement | null }, salir: () => void): void {
  useEffect(() => {
    function alTocar(e: PointerEvent): void {
      if (!panel.current || !(e.target instanceof Element) || panel.current.contains(e.target)) return
      if (hayOtroDialogoModal(panel.current)) return
      salir()
    }
    document.addEventListener('pointerdown', alTocar, true)
    return () => document.removeEventListener('pointerdown', alTocar, true)
  }, [panel, salir])
}

/** Los pacientes que casan con el texto, con la espera de 300 ms del modal. */
function usePacientes(texto: string): PacienteBusqueda[] {
  const [r, setR] = useState<{ para: string; lista: PacienteBusqueda[] }>({ para: '', lista: [] })
  const q = limpiarTextoBusqueda(texto)
  useEffect(() => {
    if (!q) return
    let vigente = true
    const t = setTimeout(async () => {
      const lista = await buscarPacientes(q)
      if (vigente) setR({ para: q, lista })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [q])
  return q && r.para === q ? r.lista : []
}

interface PropsPaciente { paciente: PacienteBusqueda | null; alElegir: (p: PacienteBusqueda | null) => void }

function CampoPaciente({ paciente, alElegir }: PropsPaciente): ReactElement {
  const [texto, setTexto] = useState('')
  const [activa, setActiva] = useState(-1)
  const lista = usePacientes(paciente ? '' : texto)
  const idLista = useId()
  function alTeclear(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && lista[activa]) { e.preventDefault(); alElegir(lista[activa]); return }
    const i = indiceTrasTecla(activa, lista.length, e.key, 'vertical')
    if (i !== null) { e.preventDefault(); setActiva(i) }
  }
  return (
    <>
      <label className="ag-capa-campo">
        Paciente
        <input
          type="text" role="combobox" autoFocus autoComplete="off"
          value={paciente ? `${paciente.nombre} ${paciente.apellidos}` : texto}
          aria-expanded={lista.length > 0} aria-controls={idLista} aria-autocomplete="list"
          aria-activedescendant={activa >= 0 && lista[activa] ? idDeOpcion(idLista, activa) : undefined}
          onChange={e => { alElegir(null); setTexto(e.target.value); setActiva(-1) }} onKeyDown={alTeclear}
        />
      </label>
      {lista.length > 0 && (
        <ul id={idLista} role="listbox" aria-label="Pacientes" className="ag-opciones">
          {lista.map((p, i) => (
            <li key={p.id} id={idDeOpcion(idLista, i)} role="option" aria-selected={i === activa} className="ag-opcion"
              onMouseDown={e => e.preventDefault()} onClick={() => alElegir(p)}>
              <span>{p.nombre} {p.apellidos}</span>
              {p.telefono && <span className="ag-opcion-meta">{p.telefono}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

interface PropsHorario { inicio: string; fin: string; alCambiar: (inicio: string, fin: string) => void }

function CamposHorario({ inicio, fin, alCambiar }: PropsHorario): ReactElement {
  return (
    <div className="ag-capa-fila">
      <label className="ag-capa-campo">
        Inicio
        {/* Mover el inicio arrastra el fin con la misma duración, como el modal. */}
        <input type="time" step={300} value={inicio} onChange={e => alCambiar(e.target.value, finTrasMoverInicio(inicio, fin, e.target.value))} />
      </label>
      <label className="ag-capa-campo">
        Fin
        <input type="time" step={300} value={fin} onChange={e => alCambiar(inicio, e.target.value)} />
      </label>
    </div>
  )
}

interface PropsMedico { medicos: readonly MedicoBurbuja[]; valor: string | null; alCambiar: (id: string | null) => void }

function SelectorMedico({ medicos, valor, alCambiar }: PropsMedico): ReactElement {
  return (
    <label className="ag-capa-campo">
      Médico
      <select value={valor ?? ''} onChange={e => alCambiar(e.target.value || null)}>
        <option value="">Elige el médico…</option>
        {medicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
    </label>
  )
}

interface PropsPie { guardando: boolean; alGuardar: () => void; alMasOpciones: () => void }

function PieBurbuja({ guardando, alGuardar, alMasOpciones }: PropsPie): ReactElement {
  return (
    <div className="ag-capa-acciones">
      <button type="button" className="ag-capa-boton ag-capa-boton--principal" disabled={guardando} onClick={alGuardar}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" className="ag-capa-boton" onClick={alMasOpciones}>Más opciones</button>
    </div>
  )
}

export default function BurbujaAlta(props: Props): ReactElement {
  const { fecha, ancla, punto, medicos, filtroMedico, consultorioActivo, alGuardar, alMasOpciones, alCerrar } = props
  const [horas, setHoras] = useState({ inicio: props.horaInicio, fin: props.horaFin })
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(null)
  const [medicoId, setMedicoId] = useState(() => medicoPropuesto(filtroMedico, medicos))
  const [estado, setEstado] = useState<{ guardando: boolean; error: string | null }>({ guardando: false, error: null })
  const { saliendo, salir, alTerminar } = useSalida(alCerrar)
  const { montarPanel, alPulsarTecla } = useDialogoModal(salir)
  const idTitulo = useId()
  const colocacion = useRef({ ancla, punto })
  useEffect(() => { colocacion.current = { ancla, punto } }, [ancla, punto])
  const panel = useRef<HTMLDivElement | null>(null)
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    montarPanel(nodo)
    panel.current = nodo
    if (nodo) colocar(nodo, colocacion.current.ancla, colocacion.current.punto)
  }, [montarPanel])
  useCerrarAlTocarFuera(panel, salir)
  const entrada = { fecha, horaInicio: horas.inicio, horaFin: horas.fin, paciente, medicoId,
    consultorioId: consultorioPropuesto(consultorioActivo, medicoId) }

  async function guardar(): Promise<void> {
    const datos = datosDeAltaRapida(entrada)
    if (!datos) { setEstado({ guardando: false, error: motivoParaNoGuardar(entrada) }); return }
    setEstado({ guardando: true, error: null })
    if (await alGuardar(datos, horas)) salir()
    else setEstado({ guardando: false, error: null })
  }
  const masOpciones = (): void => alMasOpciones({ fecha, hora: horas.inicio, horaFin: horas.fin, paciente: paciente ?? undefined, medicoId })

  return (
    <Portal>
      <div ref={montar} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
        onKeyDown={alPulsarTecla} onAnimationEnd={e => { if (e.target === e.currentTarget) alTerminar() }}
        className="ag-capa" data-estado={saliendo ? 'saliendo' : 'abierta'}>
        <div className="ag-capa-cab">
          <h2 id={idTitulo} className="ag-capa-titulo">{etiquetaBurbuja(fecha, horas.inicio, horas.fin)}</h2>
          <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={salir}><X size={16} aria-hidden="true" /></button>
        </div>
        <CampoPaciente paciente={paciente} alElegir={setPaciente} />
        <CamposHorario inicio={horas.inicio} fin={horas.fin} alCambiar={(inicio, fin) => setHoras({ inicio, fin })} />
        {necesitaElegirMedico(filtroMedico, medicos) && <SelectorMedico medicos={medicos} valor={medicoId} alCambiar={setMedicoId} />}
        {estado.error && <p className="ag-capa-error" role="alert">{estado.error}</p>}
        <PieBurbuja guardando={estado.guardando} alGuardar={() => void guardar()} alMasOpciones={masOpciones} />
      </div>
    </Portal>
  )
}
