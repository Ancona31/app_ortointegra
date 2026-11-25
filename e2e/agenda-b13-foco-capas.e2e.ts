import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'

/**
 * Auditoría de B13 · hallazgo 5 · el Tab salía de la burbuja de la cita y de «Ir a una fecha»: las dos
 * llevan botones de foco itinerante (`tabIndex = -1`) y `focusablesDelPanel` los contaba, así que el
 * trapo de `useDialogoModal` nunca veía «el último» y el foco se iba al documento; con el foco fuera,
 * Escape ya no cerraba la burbuja. Anterior a B13. En computadora (`esc`, capas ancladas y sin velo).
 *
 * MUTACIÓN: quitar `el.tabIndex >= 0` de `focusablesDelPanel` → el Tab sale de las dos capas; quitar
 * `useEscapeEnDocumento(panel, salir, true)` de `usePanelTarjeta` → Escape con el foco fuera no la cierra.
 */
test.use({ storageState: SESION.adminA })
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'escritorio', 'de computadora') })
test.afterEach(() => { interruptorAgenda('A', false) })

/** Pulsa Tab `n` veces y cuenta cuántas el foco quedó fuera de `capa`. */
async function tabsFuera(page: Page, selector: string, n: number): Promise<number> {
  let fuera = 0
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    if (!await page.evaluate(sel => document.querySelector(sel)?.contains(document.activeElement) ?? false, selector)) fuera++
  }
  return fuera
}

test('la burbuja de la cita: el Tab no sale y Escape la cierra aunque el foco esté fuera', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  const cita = page.locator('.fc-timegrid-event', { hasText: 'Paciente' }).first()
  await cita.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await cita.click({ position: { x: 8, y: 8 } })
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  await page.evaluate(() => document.querySelector('[role="dialog"][aria-modal="true"]')?.setAttribute('data-prueba-foco', ''))
  expect(await tabsFuera(page, '[data-prueba-foco]', 12)).toBe(0)
  // El foco fuera de la capa (lo deja ahí un programa, no el Tab): Escape la sigue cerrando.
  await page.locator('[data-buscar-citas]').filter({ visible: true }).first().evaluate(el => (el as HTMLElement).focus())
  await page.keyboard.press('Escape')
  await expect(t).toHaveCount(0)
})

test('«Ir a una fecha»: el Tab no sale de la capa', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await page.locator('[data-selector-fecha]').filter({ visible: true }).first().click()
  const capa = page.getByRole('dialog', { name: 'Elegir fecha' })
  await expect(capa).toBeVisible()
  await page.evaluate(() => document.querySelector('[role="dialog"]')?.setAttribute('data-prueba-foco', ''))
  expect(await tabsFuera(page, '[data-prueba-foco]', 12)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(capa).toHaveCount(0)
})
