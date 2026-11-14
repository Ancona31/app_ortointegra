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
 * `alGuardar`), la invitación de Google y el `api.unselect()` al cerrar. La
 * burbuja sólo arma el alta (`datosDeAltaRapida`, con la forma del modal) y se
 * la da.
 *
 * T1 (pruebas a mano de Angel):
 *   · Punto 2: si el paciente no existe, «Registrar "…"» al final de la lista
 *     abre `QuickPatientModal`, EL MISMO del formulario completo (consentimiento
 *     de privacidad obligatorio, duplicados, médico para la secretaria, y la
 *     puerta de suscripción en el RPC del servidor). El creado queda elegido.
 *   · Punto 3: nunca se sale de la ventana (`posicionCapa`, `max-height` con
 *     desplazamiento interno) y se recoloca si cambia de alto o si el teclado
 *     encoge la parte visible (`seguirColocacion`).
 *   · Puntos 13 y 14: tras agendar, la burbuja NO se cierra: enseña «Cita
 *     agendada» (anunciado por `role="status"`) con una acción principal,
 *     «Listo», y las secundarias alineadas: «Enviar por WhatsApp» (con la
 *     regla del servidor, `motivoSinWhatsApp`) e «Invitar por correo» (la
 *     invitación de Google, si habrá evento y quien agenda puede invitar) a
 *     todo el ancho, y «Más opciones» (el modal de edición de la cita) junto a
 *     «Listo».
 *
 * Accesibilidad: `role="dialog"` con `aria-modal`, nombrada por su título
 * («Nueva cita · mié 11, 10:00–11:30»); foco en el buscador; Escape cierra
 * (`useDialogoModal`, que también atrapa el Tab y devuelve el foco); los
 * resultados son un `listbox` con `aria-activedescendant` y el foco no sale
 * del campo. Tras agendar, el foco va a «Listo».
 *
 * Movimiento: entra desde el punto pulsado y sale hacia él (`.ag-capa`, CSS de
 * F3). «Más opciones» e «Invitar por correo» NO animan la salida: lo que abren
 * la tapa al instante. Lo nuevo de T1 no añade ninguna animación.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { Check, Mail, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import type { AltaGuardada, Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
import { posicionCapa, ventanaVisible, type Caja, type Punto } from '@/lib/agenda/posicionCapa'
import { duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'
import { idDeOpcion, indiceTrasTecla } from '@/lib/agenda/opcionesLista'
import { buscarPacientes, limpiarTextoBusqueda } from '@/lib/agenda/buscarCitasPaciente'
import { motivoSinWhatsApp, telefonoParaWhatsApp } from '@/lib/agenda/whatsappCita'
import {
  consultorioPropuesto, datosDeAltaRapida, etiquetaBurbuja, finTrasMoverInicio, medicoPropuesto, motivoParaNoGuardar,
  necesitaElegirMedico, type ConsultorioAlta, type EntradaAltaRapida, type SalidaAltaRapida,
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
  /** Guarda (avisos y `handleSave`). T1: dice si se mandó y, si entró, la cita creada. */
  alGuardar: (datos: DatosGuardado, horas: { inicio: string; fin: string }) => Promise<SalidaAltaRapida>
  alMasOpciones: (valores: MasOpcionesBurbuja) => void
  /** T1 · Quien agenda puede invitar (`canVerAgendaCompleta`, la regla de `handleSave`). */
  puedeInvitar: boolean
  /** T1 · «Invitar por correo» tras agendar: el modal de invitación de la agenda. */
  alInvitar: (cita: Appointment) => void
  /** T1 · «Más opciones» tras agendar: el modal de edición de la cita creada. */
  alEditar: (cita: Appointment) => void
  alCerrar: () => void
}

/* ⚠️ `colocar` y `seguirColocacion` SON COPIA DELIBERADA en `TarjetaLectura.tsx`
   (y `colocar`, en `HerramientasV2.tsx`): un arreglo en una se aplica a las
   tres (CLAUDE.md, protocolo 4: sacarlas a un módulo compartido pide el visto
   bueno de Angel). */
/**
 * Coloca el panel junto al ancla, en el mismo commit en que se monta (sin un
 * fotograma fuera de sitio). T1: con el alto NATURAL (con `max-height` puesto,
 * `offsetHeight` ya llega recortado), en la parte VISIBLE de la ventana, y con
 * el `max-height` que no la deja salir.
 */
function colocar(nodo: HTMLElement, ancla: Caja, punto?: Punto): void {
  const alto = nodo.scrollHeight + (nodo.offsetHeight - nodo.clientHeight)
  const ventana = ventanaVisible(window.visualViewport, { width: window.innerWidth, height: window.innerHeight })
  const p = posicionCapa(ancla, { width: nodo.offsetWidth, height: alto }, ventana, punto)
  nodo.style.left = `${p.left}px`
  nodo.style.top = `${p.top}px`
  nodo.style.maxHeight = `${p.altoMaximo}px`
  nodo.style.transformOrigin = p.origen
}

/**
 * T1 · Vuelve a colocar la capa cuando cambia de alto (resultados, botones tras
 * agendar) o cuando cambia la parte visible de la ventana (el teclado). En un
 * `requestAnimationFrame`: recolocar cambia el `max-height`, y hacerlo dentro
 * del aviso del `ResizeObserver` dispararía su error de bucle. Devuelve cómo
 * dejar de seguir.
 */
function seguirColocacion(nodo: HTMLElement, recolocar: () => void): () => void {
  let marco = 0
  const pedir = (): void => { cancelAnimationFrame(marco); marco = requestAnimationFrame(recolocar) }
  const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(pedir)
  observador?.observe(nodo)
  const vv = window.visualViewport
  vv?.addEventListener('resize', pedir)
  vv?.addEventListener('scroll', pedir)
  return () => {
    cancelAnimationFrame(marco)
    observador?.disconnect()
    vv?.removeEventListener('resize', pedir)
    vv?.removeEventListener('scroll', pedir)
  }
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
 * T1 · `pausado`: con `QuickPatientModal` abierto encima (que no es un
 * `role="dialog"`), tocarlo no es tocar fuera.
 */
function useCerrarAlTocarFuera(panel: { current: HTMLElement | null }, salir: () => void, pausado: boolean): void {
  useEffect(() => {
    if (pausado) return
    function alTocar(e: PointerEvent): void {
      if (!panel.current || !(e.target instanceof Element) || panel.current.contains(e.target)) return
      if (hayOtroDialogoModal(panel.current)) return
      salir()
    }
    document.addEventListener('pointerdown', alTocar, true)
    return () => document.removeEventListener('pointerdown', alTocar, true)
  }, [panel, salir, pausado])
}

/**
 * Los pacientes que casan con el texto, con la espera de 300 ms del modal.
 * T1: `listo` dice si la lista ya es la de ESE texto (aunque venga vacía): sólo
 * entonces se ofrece «Registrar».
 */
function usePacientes(texto: string): { lista: PacienteBusqueda[]; listo: boolean } {
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
  const listo = q !== null && r.para === q
  return { lista: listo ? r.lista : [], listo }
}

interface PropsPaciente {
  paciente: PacienteBusqueda | null
  alElegir: (p: PacienteBusqueda | null) => void
  /** T1 · «Registrar "…"»: abre `QuickPatientModal` con lo escrito. */
  alRegistrar: (texto: string) => void
  campo: { current: HTMLInputElement | null }
}

function CampoPaciente({ paciente, alElegir, alRegistrar, campo }: PropsPaciente): ReactElement {
  const [texto, setTexto] = useState('')
  const [activa, setActiva] = useState(-1)
  const { lista, listo } = usePacientes(paciente ? '' : texto)
  const idLista = useId()
  /* La última opción, cuando la búsqueda ya contestó, es registrar lo escrito
     (como «Registrar "…"» del formulario completo). */
  const total = listo ? lista.length + 1 : 0
  function elegir(i: number): void {
    if (i === lista.length) alRegistrar(texto.trim())
    else if (lista[i]) alElegir(lista[i])
  }
  function alTeclear(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && activa >= 0 && activa < total) { e.preventDefault(); elegir(activa); return }
    const i = indiceTrasTecla(activa, total, e.key, 'vertical')
    if (i !== null) { e.preventDefault(); setActiva(i) }
  }
  return (
    <>
      <label className="ag-capa-campo">
        Paciente
        <input
          ref={campo} type="text" role="combobox" autoFocus autoComplete="off"
          value={paciente ? `${paciente.nombre} ${paciente.apellidos}` : texto}
          aria-expanded={total > 0} aria-controls={idLista} aria-autocomplete="list"
          aria-activedescendant={activa >= 0 && activa < total ? idDeOpcion(idLista, activa) : undefined}
          onChange={e => { alElegir(null); setTexto(e.target.value); setActiva(-1) }} onKeyDown={alTeclear}
        />
      </label>
      {total > 0 && (
        <ul id={idLista} role="listbox" aria-label="Pacientes" className="ag-opciones">
          {lista.map((p, i) => (
            <li key={p.id} id={idDeOpcion(idLista, i)} role="option" aria-selected={i === activa} className="ag-opcion"
              onMouseDown={e => e.preventDefault()} onClick={() => alElegir(p)}>
              <span>{p.nombre} {p.apellidos}</span>
              {p.telefono && <span className="ag-opcion-meta">{p.telefono}</span>}
            </li>
          ))}
          <li id={idDeOpcion(idLista, lista.length)} role="option" aria-selected={activa === lista.length}
            className="ag-opcion ag-opcion--registrar" onMouseDown={e => e.preventDefault()} onClick={() => elegir(lista.length)}>
            <span>Registrar «{texto.trim()}»</span>
            <span className="ag-opcion-meta">Crear paciente nuevo y continuar</span>
          </li>
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

interface PropsPie { guardando: boolean; alGuardar: () => void; alMasOpciones: () => void; boton: { current: HTMLButtonElement | null } }

function PieBurbuja({ guardando, alGuardar, alMasOpciones, boton }: PropsPie): ReactElement {
  return (
    <div className="ag-capa-acciones">
      <button ref={boton} type="button" className="ag-capa-boton ag-capa-boton--principal" disabled={guardando} onClick={alGuardar}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" className="ag-capa-boton" onClick={alMasOpciones}>Más opciones</button>
    </div>
  )
}

/** La cita recién creada y el instante en que se supo (para la regla del WhatsApp). */
interface Creada { alta: AltaGuardada; en: number }

interface PropsAgendada {
  creada: Creada
  puedeInvitar: boolean
  alInvitar: (cita: Appointment) => void
  alEditar: (cita: Appointment) => void
  alListo: () => void
}

/**
 * T1 · Lo que enseña la burbuja tras agendar (puntos 13 y 14). «Listo» es la
 * acción principal y se lleva el foco. Las dos de enviar, una debajo de otra a
 * todo el ancho (con 140 px de columna sus rótulos no caben en una línea); el
 * pie, «Listo» y «Más opciones» en dos columnas iguales, donde estaban
 * «Guardar» y «Más opciones».
 */
function PanelAgendada({ creada, puedeInvitar, alInvitar, alEditar, alListo }: PropsAgendada): ReactElement {
  const { cita, gcalSync } = creada.alta
  const listo = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { listo.current?.focus({ preventScroll: true }) }, [])
  const telefono = telefonoParaWhatsApp(cita.pacientes?.telefono, cita.reserva_telefono)
  const conWhatsApp = motivoSinWhatsApp(cita, telefono, creada.en) === null
  /* La invitación es un `patch` sobre el evento de Google: sólo si lo habrá
     (`pending`) y quien agenda puede invitar — la misma regla con la que
     `handleSave` la abría sola. */
  const conCorreo = puedeInvitar && gcalSync === 'pending'
  return (
    <>
      <p className="ag-capa-hecho"><Check size={16} aria-hidden="true" /> Cita agendada</p>
      {(conWhatsApp || conCorreo) && (
        <div className="ag-capa-pila">
          {conWhatsApp && <BotonWhatsAppCita citaId={cita.id} tipo="enlace" marcadoEn={cita.whatsapp_sent_at ?? null} enCapa />}
          {conCorreo && (
            <button type="button" className="ag-capa-boton w-full" onClick={() => alInvitar(cita)}>
              <Mail size={15} aria-hidden="true" /> Invitar por correo
            </button>
          )}
        </div>
      )}
      <div className="ag-capa-rejilla">
        <button ref={listo} type="button" className="ag-capa-boton ag-capa-boton--principal" onClick={alListo}>Listo</button>
        <button type="button" className="ag-capa-boton" onClick={() => alEditar(cita)}>Más opciones</button>
      </div>
    </>
  )
}

/** El panel: rol, foco, salida, colocación y su seguimiento (T1). */
function usePanelBurbuja(ancla: Caja, punto: Punto | undefined, alCerrar: () => void, pausado: boolean) {
  const { saliendo, salir, alTerminar } = useSalida(alCerrar)
  const { montarPanel, alPulsarTecla } = useDialogoModal(salir)
  const colocacion = useRef({ ancla, punto })
  useEffect(() => { colocacion.current = { ancla, punto } }, [ancla, punto])
  const panel = useRef<HTMLDivElement | null>(null)
  const dejarDeSeguir = useRef<(() => void) | null>(null)
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    montarPanel(nodo)
    panel.current = nodo
    dejarDeSeguir.current?.()
    dejarDeSeguir.current = null
    if (!nodo) return
    const recolocar = (): void => colocar(nodo, colocacion.current.ancla, colocacion.current.punto)
    recolocar()
    dejarDeSeguir.current = seguirColocacion(nodo, recolocar)
  }, [montarPanel])
  useCerrarAlTocarFuera(panel, salir, pausado)
  return { saliendo, salir, alTerminar, alPulsarTecla, montar }
}

/**
 * El guardado de la burbuja: arma el alta, pasa por `alGuardar` (avisos y
 * `handleSave`) y, si entró, guarda la cita creada para el panel de después
 * (T1). Sin alta de vuelta (falló, o sigue por el aviso de empalme del
 * servidor) se cierra, como antes de T1; de eso avisa `handleSave`.
 */
function useGuardadoBurbuja(alGuardar: Props['alGuardar'], salir: () => void) {
  const [estado, setEstado] = useState<{ guardando: boolean; error: string | null }>({ guardando: false, error: null })
  const [creada, setCreada] = useState<Creada | null>(null)
  async function guardar(entrada: EntradaAltaRapida): Promise<void> {
    const datos = datosDeAltaRapida(entrada)
    if (!datos) { setEstado({ guardando: false, error: motivoParaNoGuardar(entrada) }); return }
    setEstado({ guardando: true, error: null })
    const salida = await alGuardar(datos, { inicio: entrada.horaInicio, fin: entrada.horaFin })
    if (!salida.enviada) { setEstado({ guardando: false, error: null }); return }
    if (salida.alta) setCreada({ alta: salida.alta, en: Date.now() })
    else salir()
  }
  return { estado, creada, guardar }
}

/**
 * T1 · `role="status"` SIEMPRE en el DOM (vacío antes de agendar): una región
 * viva que aparece ya con texto no se anuncia en todos los lectores.
 * `QuickPatientModal` (punto 2) va HERMANO del diálogo y no hijo: así sus
 * teclas no suben por el árbol de React hasta el `onKeyDown` de la burbuja
 * (que cerraría con Escape y atraparía el Tab).
 */
export default function BurbujaAlta(props: Props): ReactElement {
  const { fecha, ancla, punto, medicos, filtroMedico, consultorioActivo, alMasOpciones, alCerrar } = props
  const [horas, setHoras] = useState({ inicio: props.horaInicio, fin: props.horaFin })
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(null)
  const [medicoId, setMedicoId] = useState(() => medicoPropuesto(filtroMedico, medicos))
  const [registrando, setRegistrando] = useState<string | null>(null)
  const { saliendo, salir, alTerminar, alPulsarTecla, montar } = usePanelBurbuja(ancla, punto, alCerrar, registrando !== null)
  const { estado, creada, guardar } = useGuardadoBurbuja(props.alGuardar, salir)
  const idTitulo = useId()
  const campo = useRef<HTMLInputElement | null>(null)
  const botonGuardar = useRef<HTMLButtonElement | null>(null)
  const entrada = { fecha, horaInicio: horas.inicio, horaFin: horas.fin, paciente, medicoId,
    consultorioId: consultorioPropuesto(consultorioActivo, medicoId) }
  const masOpciones = (): void => alMasOpciones({ fecha, hora: horas.inicio, horaFin: horas.fin, paciente: paciente ?? undefined, medicoId })
  const enfocar = (r: { current: HTMLElement | null }): void => { requestAnimationFrame(() => r.current?.focus({ preventScroll: true })) }
  const alCreado = (p: PacienteBusqueda): void => { setRegistrando(null); setPaciente(p); enfocar(botonGuardar) }

  return (
    <>
      <Portal>
        <div ref={montar} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
          onKeyDown={alPulsarTecla} onAnimationEnd={e => { if (e.target === e.currentTarget) alTerminar() }}
          className="ag-capa" data-estado={saliendo ? 'saliendo' : 'abierta'}>
          <div className="ag-capa-cab">
            <h2 id={idTitulo} className="ag-capa-titulo">{etiquetaBurbuja(fecha, horas.inicio, horas.fin)}</h2>
            <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={salir}><X size={16} aria-hidden="true" /></button>
          </div>
          <p role="status" className="sr-only">{creada ? `Cita agendada: ${etiquetaBurbuja(fecha, horas.inicio, horas.fin)}` : ''}</p>
          {creada ? (
            <PanelAgendada creada={creada} puedeInvitar={props.puedeInvitar} alListo={salir}
              alInvitar={props.alInvitar} alEditar={props.alEditar} />
          ) : (
            <>
              <CampoPaciente paciente={paciente} alElegir={setPaciente} alRegistrar={setRegistrando} campo={campo} />
              <CamposHorario inicio={horas.inicio} fin={horas.fin} alCambiar={(inicio, fin) => setHoras({ inicio, fin })} />
              {necesitaElegirMedico(filtroMedico, medicos) && <SelectorMedico medicos={medicos} valor={medicoId} alCambiar={setMedicoId} />}
              {estado.error && <p className="ag-capa-error" role="alert">{estado.error}</p>}
              <PieBurbuja guardando={estado.guardando} alGuardar={() => void guardar(entrada)} alMasOpciones={masOpciones} boton={botonGuardar} />
            </>
          )}
        </div>
      </Portal>
      {registrando !== null && (
        <QuickPatientModal nombreInicial={registrando} onCreated={alCreado}
          onClose={() => { setRegistrando(null); enfocar(campo) }} />
      )}
    </>
  )
}
