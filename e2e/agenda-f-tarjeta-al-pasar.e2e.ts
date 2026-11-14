import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, interruptorAgenda } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'

/**
 * T3 · punto 15: la tarjeta de lectura se abre también al DEJAR EL RATÓN QUIETO
 * más de 1 s sobre una cita (detrás del interruptor de la agenda v2):
 *   · no es modal y no roba el foco; Escape la cierra;
 *   · se cierra al retirar el ratón, salvo que se cruce a la tarjeta o que un
 *     clic la haya fijado (entonces es la de siempre, modal);
 *   · nunca mientras se arrastra, ni encima de otra capa, ni con la
 *     preferencia «Abrir la tarjeta al pasar el ratón» apagada (configuración),
 *     ni en el teléfono (sigue el toque), ni con el interruptor apagado.
 *
 * MUTACIONES (comprobadas en rojo al escribirlas): quitar de `puedeAbrir` las
 * guardas de ratón fino y de la hoja (`MEDIO_RATON`, `desactivada`) → «el
 * teléfono…»; quitar `leerTarjetaAlPasar` → «preferencia apagada»;
 * `aria-modal` en la variante al pasar → «1 s de quietud…» (no modal).
 */
test.use({ storageState: SESION.adminA })

/** Las citas de la rejilla con caja propia. */
function citas(page: Page): Locator {
  return page.locator('.fc-timegrid-event:not(.fc-event-mirror)').filter({ has: page.locator('.ag-tarjeta') })
}

/** Lleva el ratón al centro (alto) de la cita y lo deja quieto. */
async function posarSobre(page: Page, cita: Locator): Promise<{ x: number; y: number }> {
  await cita.scrollIntoViewIfNeeded()
  const b = await cita.boundingBox()
  if (!b) throw new Error('la cita no tiene caja')
  const punto = { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 12) }
  await page.mouse.move(punto.x, punto.y, { steps: 5 })
  return punto
}

function soloEn(proyecto: string): void {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== proyecto, `sólo en ${proyecto}`) })
}

test.describe('escritorio, con el interruptor encendido', () => {
  soloEn('escritorio')
  test.beforeEach(() => { interruptorAgenda('A', true) })
  test.afterEach(() => { interruptorAgenda('A', false) })

  test('1 s de quietud la abre, no modal y sin robar el foco; salir la cierra', async ({ page }) => {
    await abrirAgendaV2(page)
    const agendar = page.getByRole('button', { name: 'Agendar', exact: true })
    await agendar.focus()
    await posarSobre(page, citas(page).first())
    const tarjeta = tarjetaLectura(page)
    await page.waitForTimeout(300)
    await expect(tarjeta).toHaveCount(0)
    await expect(tarjeta).toBeVisible({ timeout: 3000 })
    await expect(tarjeta).not.toHaveAttribute('aria-modal', /.*/)
    await expect(agendar).toBeFocused()
    await page.mouse.move(5, 300, { steps: 5 })
    await expect(tarjeta).toHaveCount(0)
  })

  test('moverse dentro de la cita reinicia la cuenta', async ({ page }) => {
    await abrirAgendaV2(page)
    const p = await posarSobre(page, citas(page).first())
    for (let i = 0; i < 4; i += 1) {
      await page.waitForTimeout(400)
      await page.mouse.move(p.x + (i % 2 ? 2 : -2), p.y)
    }
    await expect(tarjetaLectura(page)).toHaveCount(0)
    await expect(tarjetaLectura(page)).toBeVisible({ timeout: 3000 })
  })

  test('cruzar de la cita a la tarjeta no la cierra; salir de la tarjeta sí', async ({ page }) => {
    await abrirAgendaV2(page)
    await posarSobre(page, citas(page).first())
    const tarjeta = tarjetaLectura(page)
    await expect(tarjeta).toBeVisible({ timeout: 3000 })
    const b = await tarjeta.boundingBox()
    if (!b) throw new Error('la tarjeta no tiene caja')
    await page.mouse.move(b.x + b.width / 2, b.y + 20, { steps: 10 })
    await page.waitForTimeout(800)
    await expect(tarjeta).toBeVisible()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height + 200, { steps: 5 })
    await expect(tarjeta).toHaveCount(0)
  })

  test('un clic en la cita la deja fija (la de siempre, modal); Escape la cierra', async ({ page }) => {
    await abrirAgendaV2(page)
    const cita = citas(page).first()
    const p = await posarSobre(page, cita)
    const tarjeta = tarjetaLectura(page)
    await expect(tarjeta).toBeVisible({ timeout: 3000 })
    await page.mouse.click(p.x, p.y)
    await expect(tarjeta).toHaveAttribute('aria-modal', 'true')
    await page.mouse.move(5, 300, { steps: 5 })
    await page.waitForTimeout(800)
    await expect(tarjeta).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tarjeta).toHaveCount(0)
  })

  test('Escape cierra la abierta al pasar', async ({ page }) => {
    await abrirAgendaV2(page)
    await posarSobre(page, citas(page).first())
    await expect(tarjetaLectura(page)).toBeVisible({ timeout: 3000 })
    await page.keyboard.press('Escape')
    await expect(tarjetaLectura(page)).toHaveCount(0)
  })

  test('arrastrar la cita cierra la abierta al pasar', async ({ page }) => {
    await abrirAgendaV2(page)
    const p = await posarSobre(page, citas(page).first())
    await expect(tarjetaLectura(page)).toBeVisible({ timeout: 3000 })
    await page.mouse.down()
    await page.mouse.move(p.x, p.y + 30, { steps: 6 })
    await expect(tarjetaLectura(page)).toHaveCount(0)
    await page.mouse.move(p.x, p.y, { steps: 6 })
    await page.mouse.up()
  })

  test('mientras se arrastra no se abre, ni al soltar sin salir de la cita', async ({ page }) => {
    await abrirAgendaV2(page)
    const p = await posarSobre(page, citas(page).first())
    await page.mouse.down()
    await page.mouse.move(p.x, p.y + 30, { steps: 6 })
    await page.waitForTimeout(1500)
    await expect(page.locator('.fc-event-mirror')).toHaveCount(1)
    await expect(tarjetaLectura(page)).toHaveCount(0)
    await page.mouse.move(p.x, p.y, { steps: 6 })
    await page.mouse.up()
    await page.waitForTimeout(1500)
    await expect(tarjetaLectura(page)).toHaveCount(0)
  })

  test('con una tarjeta fija abierta, pasar por otra cita no la cambia', async ({ page }) => {
    await abrirAgendaV2(page)
    const [a, b] = [citas(page).nth(0), citas(page).nth(1)]
    await a.click()
    const tarjeta = tarjetaLectura(page)
    await expect(tarjeta).toHaveAttribute('aria-modal', 'true')
    const nombre = await tarjeta.getByRole('heading').textContent()
    await posarSobre(page, b)
    await page.waitForTimeout(1500)
    await expect(tarjetaLectura(page)).toHaveCount(1)
    await expect(tarjeta.getByRole('heading')).toHaveText(nombre ?? '')
  })

  test('con la preferencia apagada en la configuración no se abre', async ({ page }) => {
    await page.goto('/agenda/configuracion')
    const casilla = page.getByRole('checkbox', { name: 'Abrir la tarjeta al pasar el ratón' })
    await expect(casilla).toBeChecked()
    await casilla.uncheck()
    await abrirAgendaV2(page)
    await posarSobre(page, citas(page).first())
    await page.waitForTimeout(1800)
    await expect(tarjetaLectura(page)).toHaveCount(0)
    // El clic sigue abriendo la de siempre.
    await citas(page).first().click()
    await expect(tarjetaLectura(page)).toHaveAttribute('aria-modal', 'true')
  })
})

test.describe('escritorio, con el interruptor apagado', () => {
  soloEn('escritorio')

  test('pasar el ratón no abre nada', async ({ page }) => {
    await abrirAgendaApagada(page)
    await posarSobre(page, citas(page).first())
    await page.waitForTimeout(1800)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('teléfono, con el interruptor encendido', () => {
  soloEn('telefono')
  test.beforeEach(() => { interruptorAgenda('A', true) })
  test.afterEach(() => { interruptorAgenda('A', false) })

  test('el ratón quieto no abre la tarjeta: en táctil sigue el toque', async ({ page }) => {
    await abrirAgendaV2(page)
    const fila = page.locator('.fc-list-event').filter({ has: page.locator('[data-cita-id]') }).first()
    await fila.scrollIntoViewIfNeeded()
    const b = await fila.boundingBox()
    if (!b) throw new Error('la fila no tiene caja')
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 })
    await page.waitForTimeout(1800)
    await expect(tarjetaLectura(page)).toHaveCount(0)
    await fila.tap()
    await expect(tarjetaLectura(page)).toBeVisible()
  })
})
