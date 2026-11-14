'use client'

/**
 * src/components/agenda/HerramientasV2.tsx
 *
 * Las piezas de las interacciones v2 (bloque F, F3) que viven FUERA de la capa
 * principal: los botones de la barra —«Ir a una fecha» con el minicalendario
 * desplegable, «Buscar citas de un paciente» y «Atajos de teclado»— y el
 * minicalendario del panel de la vista Día.
 *
 * Como `InteraccionesV2.tsx`, sólo se carga con el interruptor encendido
 * (`next/dynamic` en `AgendaCliente`). Lo que abre la capa principal (el
 * buscador, la ayuda) se pide por `apiRef`, la misma referencia que usa
 * `altaCitas.ts`.
 *
 * ⚠️ CADA PIEZA VA EN SU RANURA (cierre de F). `CabeceraEscritorio` y
 * `BandaMovil` tienen dos: `selectorFecha` (la primera de la fila de controles,
 * pegada a la fecha de FullCalendar) y `buscar` (antes de «Por confirmar»). En
 * escritorio, `SelectorFechaV2` va en la primera y `BuscarV2` —la lupa y, a su
 * lado, «Atajos de teclado»— en la segunda. En el teléfono sólo la lupa, en
 * `buscar` (delante del filtro) y a 44 px: el minicalendario no va allí
 * (decisión 21) y el botón de la ayuda le quitaría al filtro el ancho que le
 * queda a 360 px. Hasta el cierre de F estuvieron juntas en el hueco
 * `porConfirmar`, provisionales.
 *
 * El desplegable sigue el patrón «Date Picker Dialog» de APG: botón con
 * `aria-haspopup="dialog"` y `aria-expanded`, diálogo modal con el foco en el
 * día activo, Escape cierra y el foco vuelve al botón.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { CalendarDays, Keyboard, Search } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import MiniMes from '@/components/agenda/MiniMes'
import BuscadorCitas from '@/components/agenda/BuscadorCitas'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import type { ApiInteraccionesV2 } from '@/lib/agenda/contratosV2'
import { posicionCapa, ventanaVisible, type Caja } from '@/lib/agenda/posicionCapa'
import { partirFechaHora } from '@/lib/agenda/fechasAgenda'
import { teclasDeAccion } from '@/lib/agenda/atajosAgenda'

/** `'YYYY-MM-DD/YYYY-MM-DD'`: el periodo que pinta el calendario, `[desde, hasta)`. Lo escribe `datesSet`. */
export type RangoVisibleV2 = string

function partirRango(rango: RangoVisibleV2): { desde: string; hasta: string } {
  const [desde = '', hasta = ''] = rango.split('/')
  return { desde, hasta }
}

const hoyLocal = (): string => partirFechaHora(new Date().toISOString()).fecha

function cajaDe(el: Element): Caja {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/* ⚠️ COPIA DELIBERADA (tercera) de `colocar`, `hayOtroDialogoModal` y
   `useCerrarAlTocarFuera` de `BurbujaAlta.tsx` / `TarjetaLectura.tsx`, con una
   diferencia: aquí se ignora el botón que abre, para que pulsarlo con el
   desplegable abierto lo cierre y no lo cierre y lo vuelva a abrir. Un arreglo
   en una se aplica a las tres (CLAUDE.md, protocolo 4: sacarlas a un gancho
   compartido pide el visto bueno de Angel). */
function colocar(nodo: HTMLElement, ancla: Caja): void {
  /* T1: el arreglo de las otras dos copias (alto natural, parte visible de la
     ventana, `max-height`). El desplegable no cambia de alto: no se sigue. */
  const alto = nodo.scrollHeight + (nodo.offsetHeight - nodo.clientHeight)
  const ventana = ventanaVisible(window.visualViewport, { width: window.innerWidth, height: window.innerHeight })
  const p = posicionCapa(ancla, { width: nodo.offsetWidth, height: alto }, ventana)
  nodo.style.left = `${p.left}px`
  nodo.style.top = `${p.top}px`
  nodo.style.maxHeight = `${p.altoMaximo}px`
  nodo.style.transformOrigin = p.origen
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

function useCerrarAlTocarFuera(panel: { current: HTMLElement | null }, cerrar: () => void, ignorar: string): void {
  useEffect(() => {
    function alTocar(e: PointerEvent): void {
      if (!panel.current || !(e.target instanceof Element) || panel.current.contains(e.target)) return
      if (e.target.closest(ignorar) || hayOtroDialogoModal(panel.current)) return
      cerrar()
    }
    document.addEventListener('pointerdown', alTocar, true)
    return () => document.removeEventListener('pointerdown', alTocar, true)
  }, [panel, cerrar, ignorar])
}

interface PropsDesplegable {
  ancla: Caja
  etiqueta: string
  /** El selector del botón que lo abre: pulsarlo con el desplegable abierto lo cierra (no lo reabre). */
  disparador: string
  /** Lo que se enfoca al abrir, si no lo hace ya un `autoFocus` de dentro. */
  enfocar?: string
  clase?: string
  alCerrar: () => void
  children: ReactNode
}

/**
 * Un diálogo modal junto a su botón (el minicalendario, el buscador): rol,
 * foco atrapado, Escape y devolución del foco al botón (`useDialogoModal`),
 * tocar fuera cierra. Dos usos en este archivo; no se exporta.
 */
function Desplegable({ ancla, etiqueta, disparador, enfocar, clase, alCerrar, children }: PropsDesplegable): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  const panel = useRef<HTMLDivElement | null>(null)
  const inicial = useRef({ ancla, enfocar })
  const montar = useCallback((nodo: HTMLDivElement | null) => {
    panel.current = nodo
    if (nodo) {
      colocar(nodo, inicial.current.ancla)
      if (inicial.current.enfocar) nodo.querySelector<HTMLElement>(inicial.current.enfocar)?.focus({ preventScroll: true })
    }
    montarPanel(nodo)
  }, [montarPanel])
  useCerrarAlTocarFuera(panel, alCerrar, disparador)
  return (
    <Portal>
      <div ref={montar} role="dialog" aria-modal="true" aria-label={etiqueta} tabIndex={-1}
        onKeyDown={alPulsarTecla} className={clase ? `ag-capa ${clase}` : 'ag-capa'} data-estado="abierta">
        {children}
      </div>
    </Portal>
  )
}

/** El botón «Ir a una fecha» y su minicalendario (APG: el foco va al día activo al abrir). */
function SelectorFecha({ rango, alIrAFecha }: { rango: RangoVisibleV2; alIrAFecha: (fecha: string) => void }): ReactElement {
  const [ancla, setAncla] = useState<Caja | null>(null)
  const cerrar = useCallback(() => setAncla(null), [])
  const { desde, hasta } = partirRango(rango)
  const hoy = hoyLocal()
  return (
    <>
      <button type="button" className="ag-herramienta" data-selector-fecha=""
        aria-label="Ir a una fecha" title="Ir a una fecha" aria-haspopup="dialog" aria-expanded={ancla !== null}
        onClick={e => setAncla(a => (a ? null : cajaDe(e.currentTarget)))}>
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      {ancla && (
        <Desplegable ancla={ancla} etiqueta="Elegir fecha" disparador="[data-selector-fecha]" clase="ag-capa--fecha"
          enfocar={'button[data-fecha][tabindex="0"]'} alCerrar={cerrar}>
          <MiniMes fechaInicial={desde || hoy} hoy={hoy} visibleDesde={desde} visibleHasta={hasta}
            alElegir={f => { cerrar(); alIrAFecha(f) }} />
        </Desplegable>
      )}
    </>
  )
}

/**
 * La lupa y su buscador (F3.6). Elegir una cita la delega en la capa principal
 * (`irACita`: su día en la vista Día y su tarjeta). `/` lo abre pulsando este
 * botón (`InteraccionesV2`), así el foco vuelve aquí al cerrar.
 */
function BotonBuscar({ apiRef, clase, icono, atajos }: {
  apiRef: RefObject<ApiInteraccionesV2 | null>; clase: string; icono: number; atajos: boolean
}): ReactElement {
  const [ancla, setAncla] = useState<Caja | null>(null)
  const cerrar = useCallback(() => setAncla(null), [])
  return (
    <>
      <button type="button" className={clase} data-buscar-citas=""
        aria-label="Buscar citas de un paciente" title={atajos ? 'Buscar citas de un paciente (/)' : 'Buscar citas de un paciente'}
        aria-keyshortcuts={atajos ? teclasDeAccion('buscar') : undefined} aria-haspopup="dialog" aria-expanded={ancla !== null}
        onClick={e => setAncla(a => (a ? null : cajaDe(e.currentTarget)))}>
        <Search size={icono} aria-hidden="true" />
      </button>
      {ancla && (
        <Desplegable ancla={ancla} etiqueta="Buscar citas" disparador="[data-buscar-citas]" alCerrar={cerrar}>
          <BuscadorCitas agendaV2 alCerrar={cerrar} alElegirCita={c => { cerrar(); apiRef.current?.irACita(c) }} />
        </Desplegable>
      )}
    </>
  )
}

/** Ranura `selectorFecha` de la barra de escritorio: «Ir a una fecha» y su minicalendario. */
export function SelectorFechaV2({ rango, alIrAFecha }: {
  rango: RangoVisibleV2
  /** `api.gotoDate(fecha)`: conserva la vista. */
  alIrAFecha: (fecha: string) => void
}): ReactElement {
  return <SelectorFecha rango={rango} alIrAFecha={alIrAFecha} />
}

export interface PropsBuscarV2 {
  /** La capa principal: el buscador y la ayuda se piden por aquí. */
  apiRef: RefObject<ApiInteraccionesV2 | null>
  /** Con los atajos de una tecla activos: `aria-keyshortcuts` y la tecla en el `title`. */
  atajos: boolean
  /** En la banda del teléfono: la lupa sola, a 44 px y con la pinta de la banda. */
  enBanda?: boolean
}

/** Ranura `buscar`: la lupa y, en escritorio, el botón de la ayuda de atajos. */
export function BuscarV2({ apiRef, atajos, enBanda = false }: PropsBuscarV2): ReactElement {
  if (enBanda) {
    return <BotonBuscar apiRef={apiRef} atajos={atajos} icono={18} clase="ag-banda-movil-ctrl ag-banda-movil-ctrl--marco" />
  }
  return (
    <div className="ag-herramientas" role="group" aria-label="Herramientas de la agenda">
      <BotonBuscar apiRef={apiRef} atajos={atajos} icono={16} clase="ag-herramienta" />
      {/* WCAG 2.1.4: la ayuda tiene que poder abrirse SIN el atajo, porque es
          donde se vuelven a encender cuando alguien los apagó. */}
      <button type="button" className="ag-herramienta"
        aria-label="Atajos de teclado" title={atajos ? 'Atajos de teclado (?)' : 'Atajos de teclado'}
        aria-keyshortcuts={atajos ? teclasDeAccion('ayuda') : undefined} onClick={() => apiRef.current?.abrirAyuda()}>
        <Keyboard size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

/** El minicalendario del hueco inferior del panel de Día (`PanelDia`, ranura `miniMes`). */
export function MiniMesPanelV2({ rango, alIrAFecha }: { rango: RangoVisibleV2; alIrAFecha: (fecha: string) => void }): ReactElement {
  const { desde, hasta } = partirRango(rango)
  const hoy = hoyLocal()
  return <MiniMes fechaInicial={desde || hoy} hoy={hoy} visibleDesde={desde} visibleHasta={hasta} alElegir={alIrAFecha} />
}
