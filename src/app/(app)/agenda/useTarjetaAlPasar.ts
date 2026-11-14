'use client'

/**
 * src/app/(app)/agenda/useTarjetaAlPasar.ts
 *
 * T3 · El oyente del DOM de la tarjeta de lectura AL PASAR EL RATÓN (punto 15
 * de la tanda tras las pruebas a mano de Angel). Lo monta sólo
 * `InteraccionesV2` (chunk de la agenda v2): con el interruptor apagado no
 * existe. Las reglas de tiempos viven en `src/lib/agenda/tarjetaAlPasar.ts`
 * (el vigía, probado con Vitest); aquí sólo se traduce el DOM:
 *   · `pointermove` de RATÓN (`pointerType === 'mouse'`; un dedo o un lápiz no
 *     cuentan) dentro de la raíz de la agenda → la cita bajo el puntero, por el
 *     `data-cita-id` de su caja (contrato F1.4), y `buttons` para no armar
 *     durante un arrastre o un estiramiento;
 *   · `pointerdown` → el vigía no vuelve a armar esa cita hasta salir de ella;
 *   · el ratón sale de la ventana → como salir de la cita.
 * `puedeAbrir` se pregunta al disparar: ratón fino (`MEDIO_RATON`), la
 * preferencia del dispositivo, nada abierto encima.
 *
 * ⚠️ NO ABRE NADA POR SU CUENTA: entrega la cita y su caja a `abrir`, que pasa
 * por `abrirCita` (`altaCitas.ts`, la única puerta: regla de Google incluida).
 */
import { useEffect, useRef, type RefObject } from 'react'
import { crearVigiaAlPasar, leerTarjetaAlPasar, MEDIO_RATON, type VigiaAlPasar } from '@/lib/agenda/tarjetaAlPasar'
import type { Caja, Punto } from '@/lib/agenda/posicionCapa'

export interface OpcionesTarjetaAlPasar {
  raiz: RefObject<HTMLElement | null>
  /** En el teléfono (o ventana estrecha) la tarjeta es una hoja: al pasar, nada. */
  desactivada: boolean
  /** ¿Hay otra capa abierta que no sea la de pasar el ratón? */
  ocupada: () => boolean
  abrir: (citaId: string, ancla: Caja, punto: Punto) => void
  cerrar: () => void
}

function almacen(): Storage | null {
  try { return window.localStorage } catch { return null }
}

/** La cita bajo el puntero y la caja de su `.fc-event`, o `null`. */
function citaBajo(objetivo: EventTarget | null, raiz: HTMLElement | null): { id: string; evento: Element } | null {
  if (!raiz || !(objetivo instanceof Element) || !raiz.contains(objetivo)) return null
  const evento = objetivo.closest('.fc-event')
  const id = evento?.querySelector('[data-cita-id]')?.getAttribute('data-cita-id')
  return evento && id ? { id, evento } : null
}

function hayDialogoModal(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null
}

/** Devuelve el vigía (para que la tarjeta le cuente cuándo el ratón entra o sale de ella). */
export function useTarjetaAlPasar(o: OpcionesTarjetaAlPasar): RefObject<VigiaAlPasar | null> {
  const opciones = useRef(o)
  useEffect(() => { opciones.current = o })
  const vigia = useRef<VigiaAlPasar | null>(null)

  useEffect(() => {
    let ultimo: { evento: Element; punto: Punto } | null = null
    const v = crearVigiaAlPasar({
      puedeAbrir: () => !opciones.current.desactivada && window.matchMedia(MEDIO_RATON).matches
        && leerTarjetaAlPasar(almacen()) && !opciones.current.ocupada() && !hayDialogoModal()
        && document.visibilityState === 'visible',
      abrir: (id) => {
        if (!ultimo?.evento.isConnected) return
        const { left, top, width, height } = ultimo.evento.getBoundingClientRect()
        opciones.current.abrir(id, { left, top, width, height }, ultimo.punto)
      },
      cerrar: () => opciones.current.cerrar(),
    }, { poner: (f, ms) => window.setTimeout(f, ms), quitar: (t) => window.clearTimeout(t) })
    vigia.current = v

    const alMover = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return
      const bajo = citaBajo(e.target, opciones.current.raiz.current)
      if (bajo) ultimo = { evento: bajo.evento, punto: { x: e.clientX, y: e.clientY } }
      v.mover(bajo?.id ?? null, e.buttons)
    }
    const alPulsar = (e: PointerEvent): void => { if (e.pointerType === 'mouse') v.pulsar() }
    const alSalirVentana = (e: MouseEvent): void => { if (e.relatedTarget === null) v.mover(null, 0) }
    document.addEventListener('pointermove', alMover, { passive: true })
    document.addEventListener('pointerdown', alPulsar, true)
    document.addEventListener('mouseout', alSalirVentana)
    return () => {
      document.removeEventListener('pointermove', alMover)
      document.removeEventListener('pointerdown', alPulsar, true)
      document.removeEventListener('mouseout', alSalirVentana)
      v.destruir()
      vigia.current = null
    }
  }, [])

  return vigia
}
