'use client'

/**
 * src/components/agenda/HerramientasV2.tsx
 *
 * Las piezas de las interacciones v2 (bloque F, F3) que viven FUERA de la capa
 * principal: los tres botones de la barra de escritorio —«Ir a una fecha» con
 * el minicalendario desplegable, «Buscar citas de un paciente» y «Atajos de
 * teclado»— y el minicalendario del panel de la vista Día.
 *
 * Como `InteraccionesV2.tsx`, sólo se carga con el interruptor encendido
 * (`next/dynamic` en `AgendaCliente`). Lo que abre la capa principal (el
 * buscador, la ayuda) se pide por `apiRef`, la misma referencia que usa
 * `altaCitas.ts`.
 *
 * ⚠️ HOY VAN EN EL HUECO `porConfirmar` DE `CabeceraEscritorio`, junto a
 * «Agendar», porque es la única ranura de nodos que esa barra tiene y la barra
 * es de la superficie. Su sitio del diseño es junto a la fecha (el
 * desplegable) y en la barra (la lupa): pedido a la superficie como dos
 * ranuras, `selectorFecha` y `buscar`, en su barra única (F1.1) y en la banda
 * del teléfono. Mientras tanto se ven y se prueban aquí.
 *
 * El desplegable sigue el patrón «Date Picker Dialog» de APG: botón con
 * `aria-haspopup="dialog"` y `aria-expanded`, diálogo modal con el foco en el
 * día activo, Escape cierra y el foco vuelve al botón.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { CalendarDays, Search } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import MiniMes from '@/components/agenda/MiniMes'
import BuscadorCitas from '@/components/agenda/BuscadorCitas'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import type { ApiInteraccionesV2 } from '@/lib/agenda/contratosV2'
import { posicionCapa, type Caja } from '@/lib/agenda/posicionCapa'
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
  const p = posicionCapa(ancla, { width: nodo.offsetWidth, height: nodo.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight })
  nodo.style.left = `${p.left}px`
  nodo.style.top = `${p.top}px`
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
function BotonBuscar({ apiRef }: { apiRef: RefObject<ApiInteraccionesV2 | null> }): ReactElement {
  const [ancla, setAncla] = useState<Caja | null>(null)
  const cerrar = useCallback(() => setAncla(null), [])
  return (
    <>
      <button type="button" className="ag-herramienta" data-buscar-citas=""
        aria-label="Buscar citas de un paciente" title="Buscar citas de un paciente (/)"
        aria-keyshortcuts={teclasDeAccion('buscar')} aria-haspopup="dialog" aria-expanded={ancla !== null}
        onClick={e => setAncla(a => (a ? null : cajaDe(e.currentTarget)))}>
        <Search size={16} aria-hidden="true" />
      </button>
      {ancla && (
        <Desplegable ancla={ancla} etiqueta="Buscar citas" disparador="[data-buscar-citas]" alCerrar={cerrar}>
          <BuscadorCitas agendaV2 alCerrar={cerrar} alElegirCita={c => { cerrar(); apiRef.current?.irACita(c) }} />
        </Desplegable>
      )}
    </>
  )
}

export interface PropsHerramientasV2 {
  /** La capa principal: el buscador y la ayuda se piden por aquí. */
  apiRef: RefObject<ApiInteraccionesV2 | null>
  rango: RangoVisibleV2
  /** `api.gotoDate(fecha)`: conserva la vista. */
  alIrAFecha: (fecha: string) => void
}

/** Los tres botones de la barra de escritorio. */
export default function HerramientasV2({ apiRef, rango, alIrAFecha }: PropsHerramientasV2): ReactElement {
  return (
    <div className="ag-herramientas" role="group" aria-label="Herramientas de la agenda">
      <SelectorFecha rango={rango} alIrAFecha={alIrAFecha} />
      <BotonBuscar apiRef={apiRef} />
    </div>
  )
}

/** El minicalendario del hueco inferior del panel de Día (`PanelDia`, ranura `miniMes`). */
export function MiniMesPanelV2({ rango, alIrAFecha }: { rango: RangoVisibleV2; alIrAFecha: (fecha: string) => void }): ReactElement {
  const { desde, hasta } = partirRango(rango)
  const hoy = hoyLocal()
  return <MiniMes fechaInicial={desde || hoy} hoy={hoy} visibleDesde={desde} visibleHasta={hasta} alElegir={alIrAFecha} />
}
