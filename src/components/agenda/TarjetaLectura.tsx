'use client'

/**
 * src/components/agenda/TarjetaLectura.tsx
 *
 * La tarjeta de lectura de una cita (bloque F, F3.2, detrás del interruptor;
 * decisión de §2 del plan: «clic en una cita abre una tarjeta de lectura con
 * acciones, en vez de ir directo a la edición»). En escritorio es una capa
 * junto a la cita; en el teléfono, una hoja inferior. Archivo nuevo de F3, sin
 * enchufar todavía: `abrirCita` (`altaCitas.ts`, la única puerta) la abrirá con
 * `agendaV2` en la ronda de después de E.
 *
 * Qué acciones ofrece lo decide `accionesTarjeta.ts`; qué HACE cada una lo
 * decide el llamador por `alAccion` (Confirmar → `cambiarEstadoCita`, Cancelar
 * y Eliminar → `ConfirmModal` antes, Reagendar → modal con el foco en la
 * fecha, Iniciar consulta → navegar, o el modal si está por ligar). Así la
 * tarjeta no repite ninguna regla de guardado. Lo enchufa `InteraccionesV2.tsx`.
 * `extra` es el hueco del botón de WhatsApp de E7 (`BotonWhatsAppCita`).
 *
 * Accesibilidad: `role="dialog"` con `aria-modal`, nombrado por el paciente;
 * foco en la primera acción; las acciones en un `role="toolbar"` con flechas
 * (foco itinerante); Escape cierra y `useDialogoModal` devuelve el foco a la
 * cita (que es enfocable con `eventInteractive`).
 * El estado se nombra con palabra en la píldora, no sólo con color (spec §12).
 *
 * T3 · ABIERTA AL PASAR EL RATÓN (`alPasar`, punto 15 de la tanda tras las
 * pruebas a mano de Angel) es OTRA tarjeta en lo que importa a la
 * accesibilidad: NO es modal (sin `aria-modal`, sin trapo de foco), NO roba el
 * foco (ni el del panel ni el `autoFocus` de la primera acción) y no lo
 * devuelve al cerrar —eso lo hace `useDialogoModal`, y por eso esa variante no
 * lo usa—. Escape la cierra desde cualquier sitio. Un clic dentro, fuera de un
 * botón, la fija (`alFijar`: el llamador la cambia por la de siempre, en su
 * sitio y sin volver a entrar, `sinEntrada`).
 */
import { Fragment, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as EventoPuntero, type ReactElement, type ReactNode } from 'react'
import { Settings, X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { STATUS_CONFIG, marcaPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { posicionCapa, ventanaVisible, type Caja, type Punto } from '@/lib/agenda/posicionCapa'
import { duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'
import { indiceTrasTecla } from '@/lib/agenda/opcionesLista'
import {
  cuandoDeTarjeta, disposicionDeTarjeta, ETIQUETA_ACCION, horarioDeTarjeta, nombreDeTarjeta, telefonoDeTarjeta,
  type AccionTarjeta, type PiezaTarjeta,
} from '@/lib/agenda/accionesTarjeta'

interface Props {
  cita: Appointment
  /** El rectángulo de la cita pulsada; sólo en escritorio. */
  ancla: Caja | null
  punto?: Punto
  /** En el teléfono: hoja inferior en vez de capa. */
  comoHoja: boolean
  /** La zona de quien mira (`tzDispositivo()`). */
  zonaVisor: string
  /** Las condiciones de hoy del modal: puede ver expedientes, es su cita y el consultorio existe. */
  puedeIniciarConsulta: boolean
  /** `false` mientras no haya con qué confirmar (ver `accionesDeTarjeta`). */
  conConfirmar?: boolean
  nombreMedico?: string | null
  /** G3 · Quien mira puede abrir el expediente (médico): «Ver expediente» de una atendida. */
  puedeVerExpediente?: boolean
  alAccion: (accion: AccionTarjeta) => void
  alCerrar: () => void
  /**
   * G3 · El aviso por WhatsApp de E7 (`BotonWhatsAppCita`), como una pieza más
   * de la rejilla: la tarjeta le dice su `tabIndex` (foco itinerante), si va en
   * dos líneas (comparte fila) y dónde dejar su mensaje («Abierto en WhatsApp
   * hh:mm» o el motivo de un error), que se pinta debajo de las acciones para
   * que la rejilla no tenga nada suelto. Sin él (no aplica), no hay hueco.
   */
  whatsapp?: (o: PiezaWhatsApp) => ReactNode
  /** T3 · Abierta al pasar el ratón: no modal, sin robar el foco. */
  alPasar?: boolean
  /** T3 · La de siempre que sustituye a una abierta al pasar: sin animación de entrada. */
  sinEntrada?: boolean
  /** T3 · Sólo con `alPasar`: el ratón entra o sale de la tarjeta (el vigía no la cierra mientras está dentro). */
  alEntrarPuntero?: () => void
  alSalirPuntero?: () => void
  /** T3 · Sólo con `alPasar`: un clic dentro (fuera de un control) la fija. */
  alFijar?: () => void
  /** Tanda J, punto 10 · Abierta desde un aviso: esta acción de principal (`disposicionDeTarjeta`). */
  destacar?: 'reagendar'
}

/** G3 · Lo que la tarjeta le pasa a la pieza del WhatsApp. */
export interface PiezaWhatsApp {
  tabIndex: number
  onFocus: () => void
  /** Comparte fila con otra acción: «Enviar» arriba y la palabra abajo. */
  dosLineas: boolean
  /** La clase de su celda (a todo el ancho si va sola). */
  claseCelda: string
  alMensaje: (m: MensajeAccion | null) => void
}

/** G3 · Un mensaje de una acción (aviso enviado, o el motivo de un error). */
export interface MensajeAccion { texto: string; alerta: boolean }

/* ⚠️ `colocar`, `seguirColocacion`, `useSalida` y `useCerrarAlTocarFuera` SON
   COPIA DELIBERADA de `BurbujaAlta.tsx`: dos usos no justifican un gancho
   compartido (CLAUDE.md, protocolo 4). Un arreglo en una se aplica a las dos.
   T1 (punto 3 de Angel): alto NATURAL, parte VISIBLE de la ventana y
   `max-height`, para que la tarjeta no se corte al fondo de la pantalla. */
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
 * T1 · La hoja del teléfono y la tableta se apoya en el borde de abajo de la
 * parte VISIBLE (con el teclado abierto, encima de él) y no pasa del 80 % de
 * ella; el CSS (`.ag-hoja`) da lo mismo sin `visualViewport`.
 */
function colocarHoja(nodo: HTMLElement): void {
  const vv = window.visualViewport
  if (!vv) return
  nodo.style.bottom = `${Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height)))}px`
  nodo.style.maxHeight = `${Math.floor(vv.height * 0.8)}px`
}

/** T1 · Recoloca al cambiar de alto o la parte visible de la ventana (ver `BurbujaAlta.tsx`). */
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

/** T3 · ¿El toque cae en la cita `id` (su `.fc-event`, con la caja `data-cita-id`)? */
function tocaLaCita(objetivo: Element, id: string): boolean {
  return objetivo.closest('.fc-event')?.querySelector(`[data-cita-id=${JSON.stringify(id)}]`) != null
}

/* T3 · `citaPropia`: sólo la tarjeta abierta al pasar. Pulsar SU cita no la
   cierra: el clic que sigue la fija (`abrirTarjeta` con la misma cita) sin que
   la vieja empiece a salir y la nueva vuelva a entrar; un arrastre la cierra
   desde el vigía (`mover` con botón pulsado). */
function useCerrarAlTocarFuera(panel: { current: HTMLElement | null }, salir: () => void, citaPropia: string | null = null): void {
  useEffect(() => {
    function alTocar(e: PointerEvent): void {
      if (!panel.current || !(e.target instanceof Element) || panel.current.contains(e.target)) return
      if (hayOtroDialogoModal(panel.current)) return
      if (citaPropia !== null && tocaLaCita(e.target, citaPropia)) return
      salir()
    }
    document.addEventListener('pointerdown', alTocar, true)
    return () => document.removeEventListener('pointerdown', alTocar, true)
  }, [panel, salir, citaPropia])
}

/* G3 (punto 17) · Médico y consultorio en dos renglones con etiqueta discreta,
   en dos columnas alineadas; detrás, lo que la tarjeta ya enseñaba (teléfono y
   nota), en la misma rejilla. El tipo de cita va junto a la duración. */
function Datos({ cita, nombreMedico }: { cita: Appointment; nombreMedico?: string | null }): ReactElement | null {
  const filas: [string, string][] = []
  if (nombreMedico) filas.push(['Médico', nombreMedico])
  if (cita.consultorio_nombre) filas.push(['Consultorio', cita.consultorio_nombre])
  const tel = telefonoDeTarjeta(cita)
  if (tel) filas.push(['Teléfono', tel])
  if (cita.notes) filas.push(['Nota', cita.notes])
  if (filas.length === 0) return null
  return (
    <dl className="ag-lectura-datos">
      {filas.map(([k, v]) => (
        <Fragment key={k}>
          <dt>{k}</dt>
          <dd className={k === 'Nota' ? 'ag-lectura-nota' : undefined}>{v}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

function Pildora({ cita }: { cita: Appointment }): ReactElement {
  const s = cita.status
  const marca = marcaPorLigar(cita)
  return (
    <span className="ag-lectura-pildoras">
      <span className="ag-lectura-pildora" style={{
        color: `var(--ag-status-${s}-text)`, background: `var(--ag-status-${s}-bg)`, borderColor: `var(--ag-status-${s}-border)`,
      }}>{STATUS_CONFIG[s].label}</span>
      {marca && <span className="ag-lectura-pildora" title={marca.titulo}>{marca.texto}</span>}
    </span>
  )
}

/** G3 · La fecha y la hora juntas (dato principal), la duración y, si difiere, la hora del consultorio (punto 19). */
function Cuando({ cita, zonaVisor }: { cita: Appointment; zonaVisor: string }): ReactElement {
  const { fechaHora, duracion } = cuandoDeTarjeta(cita, zonaVisor)
  const { enConsultorio } = horarioDeTarjeta(cita, zonaVisor)
  const detalle = [duracion, cita.tipo_cita_nombre].filter(Boolean).join(' · ')
  return (
    <p className="ag-lectura-cuando">
      {fechaHora}
      {detalle && <small>{detalle}</small>}
      {enConsultorio && <small className="ag-lectura-huso">{enConsultorio}</small>}
    </p>
  )
}

interface PropsBarra {
  disposicion: ReturnType<typeof disposicionDeTarjeta>
  alAccion: (a: AccionTarjeta) => void
  autoFoco: boolean
  whatsapp?: (o: PiezaWhatsApp) => ReactNode
  alMensaje: (m: MensajeAccion | null) => void
}

/** Las piezas en el orden en que se recorren: principal, secundarias, peligro. */
function piezasEnOrden(d: PropsBarra['disposicion']): PiezaTarjeta[] {
  return [...(d.principal ? [d.principal] : []), ...d.secundarias, ...(d.peligro ? [d.peligro] : [])]
}

/** La clase de cada pieza: la principal y la secundaria que queda sola, a todo el ancho. */
function claseDePieza(p: PiezaTarjeta, d: PropsBarra['disposicion']): string {
  if (p === d.principal) return 'ag-capa-boton ag-capa-boton--principal ag-lectura-ancho'
  if (p === d.peligro) return 'ag-lectura-peligro'
  const i = d.secundarias.indexOf(p)
  const sola = d.secundarias.length % 2 === 1 && i === d.secundarias.length - 1
  return sola ? 'ag-capa-boton ag-lectura-ancho' : 'ag-capa-boton'
}

/**
 * La barra de acciones: `role="toolbar"` con foco itinerante y flechas (APG),
 * pintada como rejilla pareja (G3, punto 17): la principal a todo el ancho, las
 * secundarias en dos columnas iguales y la de peligro aparte, al final.
 */
function BarraAcciones({ disposicion, alAccion, autoFoco, whatsapp, alMensaje }: PropsBarra): ReactElement | null {
  const [activa, setActiva] = useState(0)
  const barra = useRef<HTMLDivElement>(null)
  const piezas = piezasEnOrden(disposicion)
  function alTeclear(e: KeyboardEvent<HTMLDivElement>): void {
    const i = indiceTrasTecla(activa, piezas.length, e.key, 'horizontal')
    if (i === null) return
    e.preventDefault()
    setActiva(i)
    barra.current?.querySelectorAll<HTMLElement>('button, a[href]')[i]?.focus()
  }
  if (piezas.length === 0) return null
  return (
    <div ref={barra} role="toolbar" aria-label="Acciones de la cita" className="ag-lectura-acciones" onKeyDown={alTeclear}>
      {piezas.map((p, i) => {
        if (p === 'whatsapp') {
          const ancho = claseDePieza(p, disposicion).includes('ag-lectura-ancho')
          return <Fragment key={p}>{whatsapp?.({ tabIndex: i === activa ? 0 : -1, onFocus: () => setActiva(i),
            dosLineas: !ancho, claseCelda: ancho ? 'ag-lectura-ancho' : '', alMensaje })}</Fragment>
        }
        return (
          <Fragment key={p}>
            {p === disposicion.peligro && i > 0 && <span className="ag-lectura-sep" aria-hidden="true" />}
            <button type="button" tabIndex={i === activa ? 0 : -1} autoFocus={autoFoco && i === 0}
              className={claseDePieza(p, disposicion)} onFocus={() => setActiva(i)} onClick={() => alAccion(p)}>
              {ETIQUETA_ACCION[p]}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

/** T1 · Coloca el panel y lo sigue mientras está montado: al crecer o al cambiar
    la parte visible de la ventana. Lo usan las dos variantes (T3). */
function useColocacionSeguida(ancla: Caja | null, punto: Punto | undefined, comoHoja: boolean): (nodo: HTMLDivElement | null) => void {
  const colocacion = useRef({ ancla, punto, comoHoja })
  useEffect(() => { colocacion.current = { ancla, punto, comoHoja } }, [ancla, punto, comoHoja])
  const dejarDeSeguir = useRef<(() => void) | null>(null)
  return useCallback((nodo: HTMLDivElement | null) => {
    dejarDeSeguir.current?.()
    dejarDeSeguir.current = null
    const c = colocacion.current
    /* Sin ancla en escritorio va centrada por CSS, con su `max-height`. */
    if (!nodo || (!c.comoHoja && !c.ancla)) return
    const recolocar = (): void => {
      const a = colocacion.current
      if (a.comoHoja) colocarHoja(nodo)
      else if (a.ancla) colocar(nodo, a.ancla, a.punto)
    }
    recolocar()
    dejarDeSeguir.current = seguirColocacion(nodo, recolocar)
  }, [])
}

/** El panel modal: rol, foco, salida y su colocación (T1: seguida mientras está abierto). */
function usePanelTarjeta(ancla: Caja | null, punto: Punto | undefined, comoHoja: boolean, alCerrar: () => void) {
  const { saliendo, salir, alTerminar } = useSalida(alCerrar)
  const { montarPanel, alPulsarTecla } = useDialogoModal(salir)
  const colocarSeguido = useColocacionSeguida(ancla, punto, comoHoja)
  const panel = useRef<HTMLDivElement | null>(null)
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    montarPanel(nodo)
    panel.current = nodo
    colocarSeguido(nodo)
  }, [montarPanel, colocarSeguido])
  useCerrarAlTocarFuera(panel, salir)
  return { saliendo, salir, alTerminar, alPulsarTecla, montar }
}

/** Lo de dentro, igual en las dos variantes. */
function Contenido({ props, idTitulo, salir, autoFoco }: { props: Props; idTitulo: string; salir: () => void; autoFoco: boolean }): ReactElement {
  const { cita, zonaVisor, puedeIniciarConsulta, conConfirmar = true, nombreMedico, alAccion, whatsapp, puedeVerExpediente = false, destacar } = props
  const [mensaje, setMensaje] = useState<MensajeAccion | null>(null)
  const disposicion = disposicionDeTarjeta(cita, puedeIniciarConsulta, { conConfirmar, conWhatsApp: Boolean(whatsapp), puedeVerExpediente, destacar })
  return (
    <>
      {/* G3 (punto 17): nombre y, en la misma línea, la píldora del estado; el
          engrane (el formulario completo, que sustituye a «Editar») y la ✕
          arriba a la derecha. */}
      <div className="ag-capa-cab ag-lectura-cab">
        <h2 id={idTitulo} className="ag-capa-titulo">{nombreDeTarjeta(cita)}</h2>
        <Pildora cita={cita} />
        <button type="button" className="ag-capa-cerrar" aria-label="Configuración de la cita" title="Configuración de la cita"
          onClick={() => alAccion('editar')}><Settings size={16} aria-hidden="true" /></button>
        <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={salir}><X size={16} aria-hidden="true" /></button>
      </div>
      <Cuando cita={cita} zonaVisor={zonaVisor} />
      <Datos cita={cita} nombreMedico={nombreMedico} />
      <BarraAcciones disposicion={disposicion} alAccion={alAccion} autoFoco={autoFoco} whatsapp={whatsapp} alMensaje={setMensaje} />
      {mensaje && (
        <p className="ag-lectura-mensaje" role={mensaje.alerta ? 'alert' : undefined}>{mensaje.texto}</p>
      )}
    </>
  )
}

/** T3 · Escape cierra la tarjeta abierta al pasar aunque el foco esté fuera de
    ella; no si hay un diálogo modal encima (el Escape es suyo). */
function useEscapeEnDocumento(panel: { current: HTMLElement | null }, salir: () => void): void {
  useEffect(() => {
    function alTeclear(e: globalThis.KeyboardEvent): void {
      if (e.key !== 'Escape' || (panel.current && hayOtroDialogoModal(panel.current))) return
      salir()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [panel, salir])
}

/** T3 · La abierta al pasar el ratón: capa NO modal, sin tocar el foco. */
function TarjetaAlPasar(props: Props): ReactElement {
  const { ancla, punto, alCerrar, alEntrarPuntero, alSalirPuntero, alFijar } = props
  const { saliendo, salir, alTerminar } = useSalida(alCerrar)
  const idTitulo = useId()
  /* Integración T1+T3: también seguida mientras está abierta (crece, teclado). */
  const colocarSeguido = useColocacionSeguida(ancla, punto, false)
  const panel = useRef<HTMLDivElement | null>(null)
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    panel.current = nodo
    colocarSeguido(nodo)
  }, [colocarSeguido])
  useCerrarAlTocarFuera(panel, salir, props.cita.id)
  useEscapeEnDocumento(panel, salir)
  /* Un clic dentro la fija; sobre un control, no: el botón hace lo suyo. */
  const alPulsar = (e: EventoPuntero<HTMLDivElement>): void => {
    if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) return
    alFijar?.()
  }
  return (
    <Portal>
      <div ref={montar} role="dialog" aria-labelledby={idTitulo} data-al-pasar=""
        onPointerEnter={alEntrarPuntero} onPointerLeave={alSalirPuntero} onPointerDown={alPulsar}
        onAnimationEnd={e => { if (e.target === e.currentTarget) alTerminar() }}
        className="ag-capa ag-capa--tarjeta" data-estado={saliendo ? 'saliendo' : 'abierta'}>
        <Contenido props={props} idTitulo={idTitulo} salir={salir} autoFoco={false} />
      </div>
    </Portal>
  )
}

/** La de siempre (clic, Enter, buscador): diálogo modal con foco atrapado. */
function TarjetaModal(props: Props): ReactElement {
  const { ancla, punto, comoHoja, alCerrar, sinEntrada = false } = props
  const { saliendo, salir, alTerminar, alPulsarTecla, montar } = usePanelTarjeta(ancla, punto, comoHoja, alCerrar)
  const idTitulo = useId()
  /* Sin ancla en escritorio (se abrió desde el buscador): centrada, como la ayuda. */
  const clase = (comoHoja ? 'ag-hoja' : ancla ? 'ag-capa ag-capa--tarjeta' : 'ag-capa ag-capa--centro') + (sinEntrada ? ' ag-capa--sin-entrada' : '')

  return (
    <Portal>
      {/* Velo con la hoja y con la capa centrada (sin ancla), como la ayuda:
          atenúa el fondo y se queda el toque de cerrar, que así no cae además
          sobre la rejilla de detrás. */}
      {(comoHoja || !ancla) && <div className="ag-capa-velo" aria-hidden="true" />}
      <div ref={montar} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
        onKeyDown={alPulsarTecla} onAnimationEnd={e => { if (e.target === e.currentTarget) alTerminar() }}
        className={clase} data-estado={saliendo ? 'saliendo' : 'abierta'}>
        <Contenido props={props} idTitulo={idTitulo} salir={salir} autoFoco />
      </div>
    </Portal>
  )
}

export default function TarjetaLectura(props: Props): ReactElement {
  return props.alPasar ? <TarjetaAlPasar {...props} /> : <TarjetaModal {...props} />
}
