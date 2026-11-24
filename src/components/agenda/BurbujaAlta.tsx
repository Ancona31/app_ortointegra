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
import { Check, Mail, Plus, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import { BotonWhatsAppCita } from '@/components/agenda/BotonWhatsAppCita'
import { BotonCorreoCita } from '@/components/agenda/BotonCorreoCita'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { useEscudoTrasRegistro } from '@/hooks/useEscudoTrasRegistro'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import type { AltaGuardada, Appointment, DatosGuardado } from '@/lib/agenda/tiposAgenda'
import { posicionCapa, ventanaParaCapas, type Caja, type Punto } from '@/lib/agenda/posicionCapa'
import { duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'
import { idDeOpcion, indiceTrasTecla } from '@/lib/agenda/opcionesLista'
import { buscarPacientes, limpiarTextoBusqueda } from '@/lib/agenda/buscarCitasPaciente'
import { correoParaConfirmacion, motivoSinCorreo, motivoSinWhatsApp, telefonoParaWhatsApp } from '@/lib/agenda/whatsappCita'
import { cuandoDeTarjeta, horarioDeTarjeta, nombreDeTarjeta } from '@/lib/agenda/accionesTarjeta'
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
  /** H3 (punto 14) · Lo escrito en «Observaciones», para que «Más opciones» no lo pierda. */
  notas?: string
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
  /** G3 · La zona de quien mira, para el resumen de la cita creada y su etiqueta de huso (punto 19). */
  zonaVisor?: string
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
  /* B13 · AG5/AG8 (CALMA §25–§28): sólo en computadora se ancla; en Duo va centrada y en teléfono
     es hoja, por CSS (`.ag-capa-barra`). Aquí se quita lo que se hubiera puesto (en las TRES copias). */
  const formato = document.documentElement.dataset.formato
  if (formato !== undefined && formato !== 'esc') {
    for (const k of ['left', 'top', 'maxHeight', 'transformOrigin'] as const) nodo.style[k] = ''
    return
  }
  const alto = nodo.scrollHeight + (nodo.offsetHeight - nodo.clientHeight)
  /* B13 · AG8: sin el cromo (riel o barra), en las TRES copias (AG-DT-38). */
  const ventana = ventanaParaCapas()
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

/* H3 (punto 12) · El escudo tras cerrar `QuickPatientModal` vive en
   `src/hooks/useEscudoTrasRegistro.ts` desde I3 (punto 22), que lo usa además
   el formulario completo y «Convertir en cita». Cierre de la tanda M: también
   aquí con `dentroDeDialogos`. La regla de H3 dejaba pasar los clics dentro de
   un diálogo, y el modal se pinta centrado ENCIMA de la burbuja: cuando su
   botón cae sobre ella (en escritorio, la burbuja de un miércoles), el segundo
   clic del doble clic entraba en la burbuja y se llevaba el foco de «Guardar»
   al panel (o pulsaba lo que hubiera debajo). Sólo se traga el clic a menos de
   24 px y 600 ms del último del modal: el segundo del mismo gesto. */

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

/* T3 · Exportado: lo reutiliza `ConvertirEnCita` (convertir en cita un evento de Google),
   con su «Registrar «…»» (T1) cableado a su propio `QuickPatientModal`. */
export function CampoPaciente({ paciente, alElegir, alRegistrar, campo }: PropsPaciente): ReactElement {
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

interface PropsObservaciones { valor: string; alCambiar: (v: string) => void }

/**
 * H3 (punto 14) · Las observaciones de la cita, discretas y opcionales: plegadas
 * tras «Añadir observaciones» y, abiertas, un área que crece con el texto. Van
 * al mismo `notes` que las «Notas» del formulario completo, y como ellas NO
 * viajan a Google (S1: la descripción del evento es fija, `eventoParaGoogle`).
 */
function CampoObservaciones({ valor, alCambiar }: PropsObservaciones): ReactElement {
  const [abierto, setAbierto] = useState(valor !== '')
  if (!abierto) {
    return (
      <button type="button" className="ag-capa-enlace ag-capa-enlace--discreto" aria-expanded={false} onClick={() => setAbierto(true)}>
        <Plus size={14} aria-hidden="true" /> Añadir observaciones
      </button>
    )
  }
  return (
    <label className="ag-capa-campo">
      Observaciones
      <textarea rows={2} autoFocus value={valor} onChange={e => alCambiar(e.target.value)} placeholder="Opcional" />
    </label>
  )
}

interface PropsPie { guardando: boolean; alGuardar: () => void; alMasOpciones: () => void; boton: { current: HTMLButtonElement | null } }

/* G3 (punto 17, «Alta rápida» de la maqueta): «Más opciones» y «Guardar» en dos
   columnas iguales y del mismo alto, la principal a la derecha. */
function PieBurbuja({ guardando, alGuardar, alMasOpciones, boton }: PropsPie): ReactElement {
  return (
    <div className="ag-lectura-acciones">
      <button type="button" className="ag-capa-boton" onClick={alMasOpciones}>Más opciones</button>
      <button ref={boton} type="button" className="ag-capa-boton ag-capa-boton--principal" disabled={guardando} onClick={alGuardar}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}

/** La cita recién creada y el instante en que se supo (para la regla del WhatsApp). */
interface Creada { alta: AltaGuardada; en: number }

interface PropsAgendada {
  creada: Creada
  puedeInvitar: boolean
  zonaVisor: string
  alInvitar: (cita: Appointment) => void
  alEditar: (cita: Appointment) => void
  alListo: () => void
}

type Mensaje = { texto: string; alerta: boolean } | null

/** G3 · El acuse: ✓ «Cita agendada» y debajo quién y cuándo, con la hora del consultorio si difiere (punto 19). */
export function AcuseAgendada({ cita, zonaVisor }: { cita: Appointment; zonaVisor: string }): ReactElement {
  const { enConsultorio } = horarioDeTarjeta(cita, zonaVisor)
  return (
    <div className="ag-capa-acuse">
      <span className="ag-capa-acuse-icono" aria-hidden="true"><Check size={18} /></span>
      <p className="ag-lectura-cuando">
        <span>Cita agendada</span>
        <small>{nombreDeTarjeta(cita)} · {cuandoDeTarjeta(cita, zonaVisor).fechaHora}</small>
        {enConsultorio && <small className="ag-lectura-huso">{enConsultorio}</small>}
      </p>
    </div>
  )
}

/**
 * T1 · Lo que enseña la burbuja tras agendar (puntos 13 y 14). G3 (puntos 14,
 * 15 y 17, «Después de agendar» de la maqueta): «Listo» es la acción principal,
 * a todo el ancho, y se lleva el foco; debajo, en dos columnas iguales, «Enviar
 * confirmación» (WhatsApp, en dos líneas) y «Por correo» (el correo de Spinus,
 * con o sin Google); la invitación de Google («Invitar por correo») sólo si
 * habrá evento y quien agenda puede invitar — si queda impar, la última va a
 * todo el ancho. «Más opciones» (el modal de edición) al pie, como enlace.
 */
function PanelAgendada({ creada, puedeInvitar, zonaVisor, alInvitar, alEditar, alListo }: PropsAgendada): ReactElement {
  const { cita, gcalSync } = creada.alta
  const listo = useRef<HTMLButtonElement | null>(null)
  /* Un mensaje por aviso: mandar los dos no borra el del primero. */
  const [mensajeWa, setMensajeWa] = useState<Mensaje>(null)
  const [mensajeCorreo, setMensajeCorreo] = useState<Mensaje>(null)
  useEffect(() => { listo.current?.focus({ preventScroll: true }) }, [])
  const conWhatsApp = motivoSinWhatsApp(cita, telefonoParaWhatsApp(cita.pacientes?.telefono, cita.reserva_telefono), creada.en) === null
  const conCorreo = motivoSinCorreo(cita, correoParaConfirmacion(cita.pacientes?.email, cita.reserva_correo), creada.en) === null
  /* La invitación es un `patch` sobre el evento de Google: sólo si lo habrá
     (`pending`) y quien agenda puede invitar — la misma regla con la que
     `handleSave` la abría sola. */
  const conInvitacion = puedeInvitar && gcalSync === 'pending'
  const piezas = [conWhatsApp && 'whatsapp', conCorreo && 'correo', conInvitacion && 'invitar'].filter(Boolean)
  const celda = (p: string): string => (piezas.length % 2 === 1 && piezas[piezas.length - 1] === p ? 'ag-lectura-ancho' : '')
  return (
    <>
      <AcuseAgendada cita={cita} zonaVisor={zonaVisor} />
      <div className="ag-lectura-acciones">
        <button ref={listo} type="button" className="ag-capa-boton ag-capa-boton--principal ag-lectura-ancho" onClick={alListo}>Listo</button>
        {conWhatsApp && (
          <BotonWhatsAppCita citaId={cita.id} tipo="enlace" marcadoEn={cita.whatsapp_sent_at ?? null} enCapa
            confirmada={cita.status === 'confirmed'} dosLineas={!celda('whatsapp')} claseCelda={celda('whatsapp')} alMensaje={setMensajeWa} />
        )}
        {conCorreo && (
          <BotonCorreoCita citaId={cita.id} confirmada={cita.status === 'confirmed'} enCapa claseCelda={celda('correo')} alMensaje={setMensajeCorreo} />
        )}
        {conInvitacion && (
          <button type="button" className={`ag-capa-boton ${celda('invitar')}`} onClick={() => alInvitar(cita)}>
            <Mail size={15} aria-hidden="true" /> Invitar por correo
          </button>
        )}
      </div>
      {[mensajeWa, mensajeCorreo].map((m, i) => m && (
        <p key={i} className="ag-lectura-mensaje" role={m.alerta ? 'alert' : undefined}>{m.texto}</p>
      ))}
      <button type="button" className="ag-capa-enlace" onClick={() => alEditar(cita)}>Más opciones</button>
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
    if (!salida.enviada) { setEstado({ guardando: false, error: salida.error ?? null }); return }
    if (salida.alta) setCreada({ alta: salida.alta, en: Date.now() })
    else salir()
  }
  return { estado, creada, guardar }
}

type RefFoco = { current: HTMLElement | null }
const enfocar = (r: RefFoco): void => { requestAnimationFrame(() => r.current?.focus({ preventScroll: true })) }

/**
 * T1 (punto 2) · «Registrar «…»»: el `QuickPatientModal` abierto con lo escrito
 * (`nombre`; `null` = cerrado). Creado, el paciente queda elegido y el foco en
 * «Guardar»; cancelado, el foco vuelve al buscador. H3 (punto 12): los dos
 * cierres activan el escudo del doble clic, y mientras el modal o el escudo
 * están, tocar fuera no cierra la burbuja.
 */
function useRegistroEnBurbuja(elegir: (p: PacienteBusqueda) => void, campo: RefFoco, botonGuardar: RefFoco) {
  const [nombre, setNombre] = useState<string | null>(null)
  const escudo = useEscudoTrasRegistro(nombre !== null, { dentroDeDialogos: true })
  return {
    nombre,
    abrir: setNombre,
    pausaTocarFuera: nombre !== null || escudo.activo,
    alCreado: (p: PacienteBusqueda): void => { setNombre(null); escudo.activar(); elegir(p); enfocar(botonGuardar) },
    alCancelar: (): void => { setNombre(null); escudo.activar(); enfocar(campo) },
  }
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
  const [notas, setNotas] = useState('')
  const campo = useRef<HTMLInputElement | null>(null)
  const botonGuardar = useRef<HTMLButtonElement | null>(null)
  const registro = useRegistroEnBurbuja(setPaciente, campo, botonGuardar)
  const { saliendo, salir, alTerminar, alPulsarTecla, montar } = usePanelBurbuja(ancla, punto, alCerrar, registro.pausaTocarFuera)
  const { estado, creada, guardar } = useGuardadoBurbuja(props.alGuardar, salir)
  const idTitulo = useId()
  const entrada = { fecha, horaInicio: horas.inicio, horaFin: horas.fin, paciente, medicoId,
    consultorioId: consultorioPropuesto(consultorioActivo, medicoId), notas }
  const masOpciones = (): void => alMasOpciones({ fecha, hora: horas.inicio, horaFin: horas.fin, paciente: paciente ?? undefined, medicoId, notas })

  return (
    <>
      <Portal>
        {/* B13 · AG5 · el velo del catálogo fuera de computadora (en `esc` no se pinta: CSS). */}
        <div className="ag-capa-velo ag-capa-barra-velo" aria-hidden="true" />
        <div ref={montar} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
          onKeyDown={alPulsarTecla} onAnimationEnd={e => { if (e.target === e.currentTarget) alTerminar() }}
          className="ag-capa ag-capa--tarjeta ag-capa-barra" data-estado={saliendo ? 'saliendo' : 'abierta'}>
          <div className="ag-capa-cab">
            <h2 id={idTitulo} className="ag-capa-titulo">{etiquetaBurbuja(fecha, horas.inicio, horas.fin)}</h2>
            <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={salir}><X size={16} aria-hidden="true" /></button>
          </div>
          <p role="status" className="sr-only">{creada ? `Cita agendada: ${etiquetaBurbuja(fecha, horas.inicio, horas.fin)}` : ''}</p>
          {creada ? (
            <PanelAgendada creada={creada} puedeInvitar={props.puedeInvitar} alListo={salir}
              zonaVisor={props.zonaVisor ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
              alInvitar={props.alInvitar} alEditar={props.alEditar} />
          ) : (
            <>
              <CampoPaciente paciente={paciente} alElegir={setPaciente} alRegistrar={registro.abrir} campo={campo} />
              <CamposHorario inicio={horas.inicio} fin={horas.fin} alCambiar={(inicio, fin) => setHoras({ inicio, fin })} />
              {necesitaElegirMedico(filtroMedico, medicos) && <SelectorMedico medicos={medicos} valor={medicoId} alCambiar={setMedicoId} />}
              <CampoObservaciones valor={notas} alCambiar={setNotas} />
              {estado.error && <p className="ag-capa-error" role="alert">{estado.error}</p>}
              <PieBurbuja guardando={estado.guardando} alGuardar={() => void guardar(entrada)} alMasOpciones={masOpciones} boton={botonGuardar} />
            </>
          )}
        </div>
      </Portal>
      {registro.nombre !== null && (
        <QuickPatientModal nombreInicial={registro.nombre} conTelefono onCreated={registro.alCreado} onClose={registro.alCancelar} />
      )}
    </>
  )
}
