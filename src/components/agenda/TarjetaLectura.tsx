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
 * Tanda K, punto 21: lo de DENTRO es la burbuja de la maqueta (`BurbujaCita.tsx`);
 * aquí queda el diálogo, su sitio, la entrada y la salida, y las dos variantes.
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
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as EventoPuntero, type ReactElement } from 'react'
import Portal from '@/components/ui/Portal'
import BurbujaCita, { type PropsBurbuja } from '@/components/agenda/BurbujaCita'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { useArrastreHoja } from '@/components/ui/ModalShell'
import { posicionCapa, ventanaParaCapas, type Caja, type Punto } from '@/lib/agenda/posicionCapa'
import { duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'

/** Tanda K, punto 21 · Lo de la burbuja (`BurbujaCita`) más el sitio, la variante y el cierre. */
interface Props extends PropsBurbuja {
  /** El rectángulo de la cita pulsada; sólo en escritorio. */
  ancla: Caja | null
  punto?: Punto
  /** En el teléfono: hoja inferior en vez de capa. */
  comoHoja: boolean
  alCerrar: () => void
  /** T3 · Abierta al pasar el ratón: no modal, sin robar el foco. */
  alPasar?: boolean
  /** T3 · La de siempre que sustituye a una abierta al pasar: sin animación de entrada. */
  sinEntrada?: boolean
  /** T3 · Sólo con `alPasar`: el ratón entra o sale de la tarjeta (el vigía no la cierra mientras está dentro). */
  alEntrarPuntero?: () => void
  alSalirPuntero?: () => void
  /** T3 · Sólo con `alPasar`: un clic dentro (fuera de un control) la fija. */
  alFijar?: () => void
}

/* ⚠️ `colocar`, `seguirColocacion`, `useSalida` y `useCerrarAlTocarFuera` SON
   COPIA DELIBERADA de `BurbujaAlta.tsx`: dos usos no justifican un gancho
   compartido (CLAUDE.md, protocolo 4). Un arreglo en una se aplica a las dos.
   T1 (punto 3 de Angel): alto NATURAL, parte VISIBLE de la ventana y
   `max-height`, para que la tarjeta no se corte al fondo de la pantalla. */
/**
 * B13 · AG5/AG8 · Fuera de computadora la capa la centra (o la apoya abajo, en `tel`) el CSS; aquí sólo
 * se la sube a la parte VISIBLE cuando el teclado en pantalla encoge `visualViewport` (T1). Sin
 * teclado, nada en línea. COPIA DELIBERADA en las tres copias de `colocar` (AG-DT-38).
 */
function colocarSinAncla(nodo: HTMLElement, formato: string): void {
  const vv = window.visualViewport
  const abajo = vv ? Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height))) : 0
  nodo.style.left = ''
  nodo.style.transformOrigin = ''
  nodo.style.top = vv && abajo > 0 && formato !== 'tel' ? `${Math.round(vv.offsetTop) + 8}px` : ''
  nodo.style.bottom = vv && abajo > 0 ? `${abajo + (formato === 'tel' ? 0 : 8)}px` : ''
  nodo.style.maxHeight = vv && abajo > 0 ? `${Math.floor(vv.height) - 16}px` : ''
}

function colocar(nodo: HTMLElement, ancla: Caja, punto?: Punto): void {
  /* B13 · AG5/AG8 (CALMA §25–§28): sólo en computadora se ancla; en Duo va centrada y en teléfono
     es hoja, por CSS (`.ag-capa-barra`). Aquí se quita lo que se hubiera puesto (en las TRES copias). */
  const formato = document.documentElement.dataset.formato
  if (formato !== undefined && formato !== 'esc') { colocarSinAncla(nodo, formato); return }
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
 * T1 · La hoja del teléfono y la tableta se apoya en el borde de abajo de la
 * parte VISIBLE (con el teclado abierto, encima de él) y no pasa del 80 % de
 * ella; el CSS (`.ag-hoja`) da lo mismo sin `visualViewport`.
 */
function colocarHoja(nodo: HTMLElement): void {
  /* B13 · AG5 · Sólo el teléfono lleva hoja; en Duo (`ext`, `ih`, `iv`) la burbuja es una tarjeta
     centrada por CSS (`globals.css`, «LA BURBUJA DE LA CITA»): aquí no se coloca, y se quita lo que
     se hubiera puesto antes de cambiar de formato (abrir o cerrar el Duo). */
  if (!esTelefono()) { nodo.style.bottom = ''; nodo.style.maxHeight = ''; return }
  const vv = window.visualViewport
  if (!vv) return
  nodo.style.bottom = `${Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height)))}px`
  nodo.style.maxHeight = `${Math.floor(vv.height * 0.8)}px`
}

/** B13 · AG5 · ¿Hoja de teléfono? Lo dice la sonda de formato (`data-formato`); sin ella, como antes. */
function esTelefono(): boolean {
  const f = document.documentElement.dataset.formato
  return f === undefined || f === 'tel'
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
  /* B13 · AG5 · la hoja del teléfono se arrastra hacia abajo para cerrar (la del catálogo,
     `useArrastreHoja`), sólo desde el asa o la cabecera. */
  const velo = useRef<HTMLDivElement | null>(null)
  const arrastrar = useArrastreHoja(panel, velo, () => comoHoja && esTelefono(), salir)
  const alPulsarPuntero = useCallback((e: EventoPuntero<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('.ag-burbuja-asa, .ag-burbuja-fila') && !e.target.closest('button')) arrastrar(e)
  }, [arrastrar])
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    montarPanel(nodo)
    panel.current = nodo
    colocarSeguido(nodo)
  }, [montarPanel, colocarSeguido])
  useCerrarAlTocarFuera(panel, salir)
  useEscapeEnDocumento(panel, salir, true)
  return { saliendo, salir, alTerminar, alPulsarTecla, montar, velo, alPulsarPuntero }
}

/** Lo de dentro, igual en las dos variantes: la burbuja de la maqueta (tanda K, punto 21). */
function Contenido({ props, idTitulo, salir, autoFoco }: { props: Props; idTitulo: string; salir: () => void; autoFoco: boolean }): ReactElement {
  return <BurbujaCita props={props} idTitulo={idTitulo} salir={salir} autoFoco={autoFoco} />
}

/** T3 · Escape cierra la tarjeta abierta al pasar aunque el foco esté fuera de
    ella; no si hay un diálogo modal encima (el Escape es suyo). Auditoría B13 · 5:
    también la de siempre (`TarjetaModal`), y ahí sólo con el foco FUERA: dentro
    ya la cierra `useDialogoModal` (o el desplegable de «Confirmar», que para la
    tecla antes). */
function useEscapeEnDocumento(panel: { current: HTMLElement | null }, salir: () => void, soloFuera = false): void {
  useEffect(() => {
    function alTeclear(e: globalThis.KeyboardEvent): void {
      if (e.key !== 'Escape' || (panel.current && hayOtroDialogoModal(panel.current))) return
      if (soloFuera && panel.current?.contains(document.activeElement)) return
      salir()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [panel, salir, soloFuera])
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
        className="ag-capa ag-capa--tarjeta ag-burbuja" data-estado={saliendo ? 'saliendo' : 'abierta'}>
        <Contenido props={props} idTitulo={idTitulo} salir={salir} autoFoco={false} />
      </div>
    </Portal>
  )
}

/** La de siempre (clic, Enter, buscador): diálogo modal con foco atrapado. */
function TarjetaModal(props: Props): ReactElement {
  const { ancla, punto, comoHoja, alCerrar, sinEntrada = false } = props
  const { saliendo, salir, alTerminar, alPulsarTecla, montar, velo, alPulsarPuntero } = usePanelTarjeta(ancla, punto, comoHoja, alCerrar)
  const idTitulo = useId()
  /* Sin ancla en escritorio (se abrió desde el buscador): centrada, como la ayuda. */
  const clase = (comoHoja ? 'ag-hoja' : ancla ? 'ag-capa ag-capa--tarjeta' : 'ag-capa ag-capa--centro') + ' ag-burbuja' + (sinEntrada ? ' ag-capa--sin-entrada' : '')

  return (
    <Portal>
      {/* Velo con la hoja y con la capa centrada (sin ancla), como la ayuda:
          atenúa el fondo y se queda el toque de cerrar, que así no cae además
          sobre la rejilla de detrás. */}
      {(comoHoja || !ancla) && <div ref={velo} className="ag-capa-velo" aria-hidden="true" />}
      <div ref={montar} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
        onKeyDown={alPulsarTecla} onPointerDown={alPulsarPuntero} onAnimationEnd={e => { if (e.target === e.currentTarget) alTerminar() }}
        className={clase} data-estado={saliendo ? 'saliendo' : 'abierta'}>
        <Contenido props={props} idTitulo={idTitulo} salir={salir} autoFoco />
      </div>
    </Portal>
  )
}

export default function TarjetaLectura(props: Props): ReactElement {
  return props.alPasar ? <TarjetaAlPasar {...props} /> : <TarjetaModal {...props} />
}
