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
 */
import { Fragment, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import type { Appointment } from '@/lib/agenda/tiposAgenda'
import { STATUS_CONFIG, marcaPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { posicionCapa, ventanaVisible, type Caja, type Punto } from '@/lib/agenda/posicionCapa'
import { duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'
import { indiceTrasTecla } from '@/lib/agenda/opcionesLista'
import {
  accionesDeTarjeta, ETIQUETA_ACCION, horarioDeTarjeta, nombreDeTarjeta, telefonoDeTarjeta, type AccionTarjeta,
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
  alAccion: (accion: AccionTarjeta) => void
  alCerrar: () => void
  extra?: ReactNode
}

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

function Datos({ cita, nombreMedico }: { cita: Appointment; nombreMedico?: string | null }): ReactElement | null {
  const filas: [string, string][] = []
  if (cita.tipo_cita_nombre) filas.push(['Tipo', cita.tipo_cita_nombre])
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
    <span className="ag-capa-acciones">
      <span className="ag-lectura-pildora" style={{
        color: `var(--ag-status-${s}-text)`, background: `var(--ag-status-${s}-bg)`, borderColor: `var(--ag-status-${s}-border)`,
      }}>{STATUS_CONFIG[s].label}</span>
      {marca && <span className="ag-lectura-pildora" title={marca.titulo}>{marca.texto}</span>}
    </span>
  )
}

interface PropsBarra { acciones: AccionTarjeta[]; alAccion: (a: AccionTarjeta) => void }

/** La barra de acciones: `role="toolbar"` con foco itinerante y flechas (APG). */
function BarraAcciones({ acciones, alAccion }: PropsBarra): ReactElement {
  const [activa, setActiva] = useState(0)
  const barra = useRef<HTMLDivElement>(null)
  function alTeclear(e: KeyboardEvent<HTMLDivElement>): void {
    const i = indiceTrasTecla(activa, acciones.length, e.key, 'horizontal')
    if (i === null) return
    e.preventDefault()
    setActiva(i)
    barra.current?.querySelectorAll<HTMLButtonElement>('button')[i]?.focus()
  }
  return (
    <div ref={barra} role="toolbar" aria-label="Acciones de la cita" className="ag-capa-acciones" onKeyDown={alTeclear}>
      {acciones.map((a, i) => (
        <button key={a} type="button" tabIndex={i === activa ? 0 : -1} autoFocus={i === 0}
          className={i === 0 ? 'ag-capa-boton ag-capa-boton--principal' : 'ag-capa-boton'}
          onFocus={() => setActiva(i)} onClick={() => alAccion(a)}>
          {ETIQUETA_ACCION[a]}
        </button>
      ))}
    </div>
  )
}

/** El panel: rol, foco, salida y su colocación (T1: seguida mientras está abierto). */
function usePanelTarjeta(ancla: Caja | null, punto: Punto | undefined, comoHoja: boolean, alCerrar: () => void) {
  const { saliendo, salir, alTerminar } = useSalida(alCerrar)
  const { montarPanel, alPulsarTecla } = useDialogoModal(salir)
  const colocacion = useRef({ ancla, punto, comoHoja })
  useEffect(() => { colocacion.current = { ancla, punto, comoHoja } }, [ancla, punto, comoHoja])
  const panel = useRef<HTMLDivElement | null>(null)
  const dejarDeSeguir = useRef<(() => void) | null>(null)
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    montarPanel(nodo)
    panel.current = nodo
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
  }, [montarPanel])
  useCerrarAlTocarFuera(panel, salir)
  return { saliendo, salir, alTerminar, alPulsarTecla, montar }
}

export default function TarjetaLectura(props: Props): ReactElement {
  const { cita, ancla, punto, comoHoja, zonaVisor, puedeIniciarConsulta, conConfirmar = true, nombreMedico, alAccion, alCerrar, extra } = props
  const { saliendo, salir, alTerminar, alPulsarTecla, montar } = usePanelTarjeta(ancla, punto, comoHoja, alCerrar)
  const idTitulo = useId()
  const horario = horarioDeTarjeta(cita, zonaVisor)
  /* Sin ancla en escritorio (se abrió desde el buscador): centrada, como la ayuda. */
  const clase = comoHoja ? 'ag-hoja' : ancla ? 'ag-capa' : 'ag-capa ag-capa--centro'

  return (
    <Portal>
      {/* Velo con la hoja y con la capa centrada (sin ancla), como la ayuda:
          atenúa el fondo y se queda el toque de cerrar, que así no cae además
          sobre la rejilla de detrás. */}
      {(comoHoja || !ancla) && <div className="ag-capa-velo" aria-hidden="true" />}
      <div ref={montar} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
        onKeyDown={alPulsarTecla} onAnimationEnd={e => { if (e.target === e.currentTarget) alTerminar() }}
        className={clase} data-estado={saliendo ? 'saliendo' : 'abierta'}>
        <div className="ag-capa-cab">
          <h2 id={idTitulo} className="ag-capa-titulo">{nombreDeTarjeta(cita)}</h2>
          <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={salir}><X size={16} aria-hidden="true" /></button>
        </div>
        <Pildora cita={cita} />
        <p className="ag-lectura-hora">
          {horario.tramo}
          {horario.enConsultorio && <small>{horario.enConsultorio}</small>}
        </p>
        <Datos cita={cita} nombreMedico={nombreMedico} />
        <BarraAcciones acciones={accionesDeTarjeta(cita, puedeIniciarConsulta, conConfirmar)} alAccion={alAccion} />
        {extra}
      </div>
    </Portal>
  )
}
