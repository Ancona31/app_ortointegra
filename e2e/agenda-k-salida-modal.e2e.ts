import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda, modalCita, soloEscritorio } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * Integración de la tanda K (defecto que destapó K4, punto 22) · La SALIDA ANIMADA del modal de la
 * cita (F2.7, `closeModal` de `AgendaCliente.tsx`) es de la agenda v2. Con la v2 APAGADA el modal se
 * desmonta al cerrarse, como antes del proyecto: ni un fotograma con `data-estado="saliendo"`. Con la
 * v2 encendida, sí pasa por él (control: sin él, la prueba de la apagada no probaría nada).
 *
 * MUTACIÓN (en rojo): en `closeModal`, `SALIDA_DEL_MODAL && modal.mode !== 'closed'` sin
 * `agendaV2 &&` → «v2 apagada» ve el panel saliendo.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

test.afterAll(() => { interruptorAgenda('A', false) })

/** Abre «Nueva cita», vigila el DOM y la cierra con Escape. Devuelve si algún nodo pasó por «saliendo». */
async function cerrarYVigilar(page: Page): Promise<boolean> {
  await page.locator('[data-onboard="nueva-cita"]').click()
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
  await page.evaluate(() => {
    const w = window as unknown as { __salio?: boolean }
    w.__salio = false
    const ver = () => { if (document.querySelector('[data-estado="saliendo"]')) w.__salio = true }
    new MutationObserver(ver).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-estado'] })
  })
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
  await expect(page.locator('[data-estado="saliendo"]')).toHaveCount(0)
  return page.evaluate(() => (window as unknown as { __salio?: boolean }).__salio === true)
}

test('v2 apagada: el modal se va sin salida animada (como antes del proyecto)', async ({ page }) => {
  interruptorAgenda('A', false)
  await abrirAgendaApagada(page)
  expect(await cerrarYVigilar(page)).toBe(false)
})

test('v2 encendida: el modal sale con su animación (control)', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  expect(await cerrarYVigilar(page)).toBe(true)
})
