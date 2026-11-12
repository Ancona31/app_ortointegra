import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * F3.7 · Deslizar el dedo para cambiar de día o de semana en las listas del
 * teléfono (bloque F, detrás del interruptor). Sólo en `listDay`/`listWeek`
 * (en el Mes tocar elige el día), sólo dedo o lápiz, y nunca desde los 20 px
 * del borde (gestos del sistema). Hacia la izquierda, periodo siguiente.
 *
 * El toque se manda por CDP (`Input.dispatchTouchEvent`): Chromium lo
 * convierte en `pointerdown/move/up` con `pointerType: 'touch'`, que es lo que
 * escucha `useDeslizarPeriodo`. Proyecto `telefono` (390 × 844, `hasTouch`).
 *
 * MUTACIONES: quitar el `agendaV2 &&` del montaje → «apagado» cambia de día;
 * quitar `BORDE_IGNORADO_PX` → el deslizamiento desde el borde pasa de periodo;
 * activar el gesto en `dayGridMonth` → la prueba del Mes se pone en rojo.
 */
test.use({ storageState: SESION.adminA })

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'telefono', 'el gesto es del teléfono')
})
test.afterEach(() => { interruptorAgenda('A', false) })

const fecha = (page: Page) => page.locator('.ag-banda-movil-fecha')

/** Un deslizamiento horizontal de `dx` px por la mitad de la lista, empezando en `x0`. */
async function deslizar(page: Page, x0: number, dx: number): Promise<void> {
  const caja = await page.locator('.fc-view-harness').boundingBox()
  if (!caja) throw new Error('deslizar: no se ve la lista')
  const y = caja.y + caja.height / 2
  const cdp = await page.context().newCDPSession(page)
  const punto = (x: number) => [{ x, y, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(x0) })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(x0 + (dx * i) / 10) })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

async function aDia(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Día' }).or(page.getByRole('button', { name: 'Día', exact: true })).first().click()
  await expect(page.locator('.fc-listDay-view')).toBeVisible()
}

test('apagado: deslizar no cambia de día', async ({ page }) => {
  await abrirAgendaApagada(page)
  await aDia(page)
  const antes = await fecha(page).textContent()
  await deslizar(page, 300, -200)
  await expect(fecha(page)).toHaveText(antes ?? '')
})

test('encendido: a la izquierda el día siguiente, a la derecha vuelve', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aDia(page)
  const antes = await fecha(page).textContent()
  await deslizar(page, 300, -200)
  await expect(fecha(page)).not.toHaveText(antes ?? '')
  await deslizar(page, 100, 200)
  await expect(fecha(page)).toHaveText(antes ?? '')
})

test('encendido: un deslizamiento corto vuelve a su sitio y uno desde el borde no cuenta', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aDia(page)
  const antes = await fecha(page).textContent()
  await deslizar(page, 300, -30)
  await expect(fecha(page)).toHaveText(antes ?? '')
  await expect(page.locator('.fc-view-harness > .fc-view')).toHaveCSS('transform', 'none')
  await deslizar(page, 380, -250)
  await expect(fecha(page)).toHaveText(antes ?? '')
})

test('encendido: en la lista de Semana pasa de semana; en el Mes, no', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await expect(page.locator('.fc-listWeek-view')).toBeVisible()
  const semana = await fecha(page).textContent()
  await deslizar(page, 300, -200)
  await expect(fecha(page)).not.toHaveText(semana ?? '')

  await page.getByRole('tab', { name: 'Mes' }).or(page.getByRole('button', { name: 'Mes', exact: true })).first().click()
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
  const mes = await fecha(page).textContent()
  await deslizar(page, 300, -200)
  await expect(fecha(page)).toHaveText(mes ?? '')
})
