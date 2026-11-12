'use client'

/**
 * src/app/(app)/agenda/useDeslizarPeriodo.ts
 *
 * Deslizar el dedo para cambiar de día o de semana en las listas del teléfono
 * (bloque F, F3.7, detrás del interruptor). La decisión es de
 * `src/lib/agenda/gestoDeslizar.ts`; aquí van los eventos de puntero, el
 * `transform` que sigue al dedo y la vuelta a su sitio.
 * Archivo nuevo de F3: se enchufa a `AgendaCliente` después de integrar E.
 *
 * Cómo se comporta:
 *   · Sólo con `activo` (el llamador lo da en `listDay`/`listWeek` del
 *     teléfono y con `agendaV2`). En el Mes no: ahí tocar elige el día.
 *   · Sólo dedo o lápiz; el ratón no desliza.
 *   · El oyente cuelga de la RAÍZ y filtra por `.fc-view-harness`, en vez de
 *     colgar del harness: así da igual que FullCalendar rehaga sus nodos.
 *   · La clase `ag-deslizable` en la raíz pone `touch-action: pan-y` en el
 *     harness (CSS de la sección de F): el desplazamiento vertical sigue siendo
 *     nativo y el horizontal llega como `pointermove`.
 *   · Se mueve `.fc-view`, el CONTENEDOR, nunca las filas: son `<tr>` y un
 *     `transform` sobre ellas las despega de la tabla.
 *   · Pasado el umbral: `alSiguiente`/`alAnterior` y el desplazamiento se pone
 *     a cero al instante (el fundido de navegación, F2.3, hace el resto). Sin
 *     pasarlo: vuelve en `--ag-dur-base` con `--ag-ease`, o al instante con
 *     movimiento reducido.
 *
 * WCAG 2.5.1: el gesto no es la única vía, las flechas ‹ › siguen ahí.
 *
 * Los manejadores salen de `crearDeslizador`, exportado para probarlos sin DOM.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { iniciarGesto, moverGesto, resistencia, terminarGesto, type EstadoGesto } from '@/lib/agenda/gestoDeslizar'
import { curvaToken, duracionToken, prefiereMenosMovimiento } from '@/lib/agenda/movimientoAgenda'

export interface SalidasDeslizar { alSiguiente: () => void; alAnterior: () => void }

/** Lo que se toca de `.fc-view`; un `HTMLElement` lo cumple. */
export interface VistaDeslizable {
  style: { transform: string }
  animate(fotogramas: Keyframe[], opciones: KeyframeAnimationOptions): unknown
}

/** Lo que se lee de un `PointerEvent`; el real lo cumple. */
export interface EventoPuntero {
  type: string
  pointerType: string
  clientX: number
  clientY: number
  timeStamp: number
  target: EventTarget | null
}

export interface Deslizador {
  alApoyar: (e: EventoPuntero) => void
  alMover: (e: EventoPuntero) => void
  alSoltar: (e: EventoPuntero) => void
}

function enHarness(objetivo: EventTarget | null): boolean {
  return typeof Element !== 'undefined' && objetivo instanceof Element && objetivo.closest('.fc-view-harness') !== null
}

/** Devuelve la vista a su sitio: animando, o de golpe con movimiento reducido. */
function devolver(vista: VistaDeslizable, desde: number): void {
  vista.style.transform = ''
  if (desde === 0 || prefiereMenosMovimiento()) return
  vista.animate(
    [{ transform: `translateX(${desde}px)` }, { transform: 'none' }],
    { duration: duracionToken('--ag-dur-base'), easing: curvaToken('--ag-ease') },
  )
}

/** Los tres manejadores de un gesto, con su estado. `ancho` y `vista` se leen en cada gesto. */
export function crearDeslizador(ancho: () => number, vista: () => VistaDeslizable | null, salidas: () => SalidasDeslizar): Deslizador {
  let gesto: EstadoGesto | null = null
  let movido = 0
  return {
    alApoyar(e) {
      if (e.pointerType === 'mouse' || !enHarness(e.target)) return
      gesto = iniciarGesto(e.clientX, e.clientY, e.timeStamp, ancho())
      movido = 0
    },
    alMover(e) {
      if (!gesto) return
      gesto = moverGesto(gesto, e.clientX, e.clientY)
      const v = vista()
      if (gesto.eje !== 'horizontal' || !v) return
      movido = resistencia(gesto.dx)
      v.style.transform = `translateX(${movido}px)`
    },
    alSoltar(e) {
      if (!gesto) return
      const desenlace = e.type === 'pointercancel' ? null : terminarGesto(gesto, e.timeStamp)
      const v = vista()
      gesto = null
      if (v && desenlace) v.style.transform = ''
      else if (v) devolver(v, movido)
      if (desenlace === 'siguiente') salidas().alSiguiente()
      else if (desenlace === 'anterior') salidas().alAnterior()
    },
  }
}

const EVENTOS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const

export function useDeslizarPeriodo({ raiz, activo, alSiguiente, alAnterior }: {
  raiz: RefObject<HTMLElement | null>
  activo: boolean
  alSiguiente: () => void
  alAnterior: () => void
}): void {
  const salidas = useRef<SalidasDeslizar>({ alSiguiente, alAnterior })
  useEffect(() => { salidas.current = { alSiguiente, alAnterior } }, [alSiguiente, alAnterior])

  useEffect(() => {
    const el = raiz.current
    if (!activo || !el) return
    const vista = (): HTMLElement | null => el.querySelector<HTMLElement>('.fc-view-harness > .fc-view')
    const d = crearDeslizador(() => el.clientWidth, vista, () => salidas.current)
    const manejadores = [d.alApoyar, d.alMover, d.alSoltar, d.alSoltar]
    el.classList.add('ag-deslizable')
    EVENTOS.forEach((tipo, i) => el.addEventListener(tipo, manejadores[i]))
    return () => {
      el.classList.remove('ag-deslizable')
      EVENTOS.forEach((tipo, i) => el.removeEventListener(tipo, manejadores[i]))
      const v = vista()
      if (v) v.style.transform = ''
    }
  }, [raiz, activo])
}
