import type { Page } from '@playwright/test'
import {
  incumplimientosDeMovimiento, REGLA_AGENDA, type AnimacionObservada, type ReglaMovimiento,
} from '../src/lib/agenda/movimientoAgenda'

/**
 * Ayuda e2e del bloque F (F0): la regla de movimiento de la agenda, comprobada
 * en el navegador. Recorre `document.getAnimations()` —CSS, transiciones y
 * WAAPI por igual— y devuelve las que animan algo distinto de `opacity` y
 * `transform` (y de los colores de hover y foco) o duran más de 240 ms. Sólo
 * mira lo de la agenda: lo de toda la app (avisos de la barra lateral, los
 * toasts) queda fuera de esta regla. Vacío = se cumple.
 *
 * La REGLA vive en `src/lib/agenda/movimientoAgenda.ts` y se prueba con Vitest;
 * aquí sólo se extrae lo que el navegador está animando EN ESTE INSTANTE, así
 * que hay que llamarla mientras el momento animado está en curso (justo después
 * del gesto, sin esperar a que termine). Una animación ya acabada no aparece en
 * `getAnimations()` y no cuenta, ni para bien ni para mal.
 *
 * ⚠️ NO SIRVE CON MOVIMIENTO REDUCIDO PARA CAZAR PROPIEDADES: con `reduce` las
 * duraciones caen a `.01ms` y la animación termina antes de poder observarla.
 * Con `reduce` lo que se comprueba es que todo aparece y desaparece igual.
 *
 * ⚠️ SIN FUNCIONES CON NOMBRE DENTRO DEL `evaluate`: el transpilador puede
 * inyectar un ayudante `__name` que no existe en la página (lo cuenta
 * `e2e/resultados/F/capturar.ts`). Sólo flechas anónimas en línea.
 *
 * Mutación de F0 (diseño, «Pruebas por paso»): sembrar `transition: width` en
 * un nodo de la agenda y comprobar que esto lo devuelve. El caso equivalente en
 * datos está en `src/lib/tests/movimientoAgenda.test.ts`.
 */
export async function animacionesFueraDeRegla(
  page: Page,
  regla: ReglaMovimiento = REGLA_AGENDA,
): Promise<string[]> {
  const observadas: AnimacionObservada[] = await page.evaluate(() => {
    const NO_SON_PROPIEDADES = new Set(['offset', 'computedOffset', 'easing', 'composite'])
    return document.getAnimations().map(anim => {
      const efecto = anim.effect instanceof KeyframeEffect ? anim.effect : null
      const props = new Set<string>()
      for (const k of efecto?.getKeyframes() ?? []) {
        for (const p of Object.keys(k)) if (!NO_SON_PROPIEDADES.has(p)) props.add(p.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`))
      }
      const nombre = anim instanceof CSSAnimation ? anim.animationName
        : anim instanceof CSSTransition ? anim.transitionProperty
        : anim.id || 'waapi'
      const duracion = efecto?.getTiming().duration
      const destino = efecto?.target
      const elemento = destino instanceof Element
        ? `${destino.tagName.toLowerCase()}${destino.classList.length ? '.' + [...destino.classList].join('.') : ''}`
        : '(sin elemento)'
      /* De la agenda: dentro de su raíz, o en uno de sus portales a `body`
         (capas, hoja, modales y su velo, el espejo del arrastre).
         ⚠️ QUEDAN FUERA `HorarioModal` y `ModalInvitacionCita`: siguen con la
         entrada de toda la app (`animate-modal-enter`) y sin clase propia que
         los nombre; ninguna e2e de movimiento los abre. Pendiente anotado en
         §6-bis («integración y cierre de F»). */
      const deLaAgenda = destino instanceof Element
        && destino.closest('.agenda-raiz, .ag-capa, .ag-capa-velo, .ag-hoja, .ag-modal-panel, .ag-modal-velo, .fc-event') !== null
      return { nombre, propiedades: [...props], duracionMs: typeof duracion === 'number' ? duracion : Number.NaN, elemento, deLaAgenda }
    })
  })
  return incumplimientosDeMovimiento(observadas, regla)
}
