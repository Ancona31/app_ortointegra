import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda, DIA_FUTURO_FIJO } from './ayudas'
import { abrirAgendaV2, contarPeticiones, tarjetaLectura } from './interaccionesAyudas'

/**
 * Auditoría de B13 · hallazgo 1 · en la rejilla táctil, la pulsación larga
 * SELECCIONA la cita (FullCalendar) y, sobre una seleccionada, un toque ya es un
 * arrastre: el clic caía en `.fc-event-mirror` y la burbuja no abría. Con la v2,
 * `alSoltarArrastre` (`AgendaCliente`) trata ese toque como el clic.
 *
 * Teléfono y tableta, en Día, sobre la consulta de la semilla del miércoles de
 * la semana SIGUIENTE (AG-DT-256): pulsación larga sin mover → soltar → tocar →
 * la burbuja de la cita abre, y ningún PUT sale.
 *
 * MUTACIÓN: quitar la llamada a `alSoltarArrastre` en `eventDragStopFc` → la
 * burbuja no abre tras la pulsación larga.
 */
test.use({ storageState: SESION.adminA })
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'telefono' && info.project.name !== 'tableta', 'sólo táctil')
})
test.afterEach(() => { interruptorAgenda('A', false) })

async function irAlDiaFuturo(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Día', exact: true }).click()
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
  const columna = page.locator(`.fc-timegrid-col[data-date="${DIA_FUTURO_FIJO}"]`)
  for (let i = 0; i < 14 && await columna.count() === 0; i++) {
    await page.getByRole('button', { name: 'Periodo siguiente' }).first().click()
    await page.waitForTimeout(150)
  }
  await expect(columna).toHaveCount(1)
}

test('tras una pulsación larga sin mover, tocar la cita abre su burbuja', async ({ page, context }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await irAlDiaFuturo(page)
  const evento = page.locator(`.fc-timegrid-col[data-date="${DIA_FUTURO_FIJO}"] .fc-timegrid-event:not(.fc-event-mirror)`, { hasText: 'Paciente' }).first()
  await expect(evento).toBeVisible()
  await evento.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
  const caja = await evento.boundingBox()
  if (!caja) throw new Error('sin cita a la vista')
  const x = caja.x + Math.min(30, caja.width / 2)
  const y = caja.y + Math.min(10, caja.height / 2)
  const puts = contarPeticiones(page, 'PUT')

  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await page.waitForTimeout(1300) // `longPressDelay` de FullCalendar: 1000 ms
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  // La condición del defecto: la cita queda seleccionada y la pulsación larga no abre nada.
  await expect(evento).toHaveClass(/fc-event-selected/)
  await page.waitForTimeout(500)
  await expect(tarjetaLectura(page)).toHaveCount(0)

  await page.touchscreen.tap(x, y)
  await expect(tarjetaLectura(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tarjetaLectura(page)).toHaveCount(0)
  expect(puts.cuantas()).toBe(0)
})
