import { test, expect, type Page } from '@playwright/test'
import { irAAgenda, SESION } from './ayudas'

/**
 * Bloque F · F1.16 · la tableta (768–1023 px) dibuja Semana como rejilla de tres
 * días, Día como rejilla y Mes como el teléfono (diseño `plan_F.md` §1, fila 16,
 * decisión 15). Sólo corre en el proyecto `tableta` (820×1180, táctil).
 */

test.use({ storageState: SESION.adminA })

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'tableta', 'sólo en el proyecto tableta')
})

/** «Compactar» abre encendido (F1.5) y en tres días puede plegar el domingo: se apaga para contar columnas. */
async function sinCompactar(page: Page): Promise<void> {
  const boton = page.getByRole('button', { name: 'Ocultar los días de la semana sin actividad' })
  if (await boton.count() && await boton.getAttribute('aria-pressed') === 'true') await boton.click()
}

const fechas = (page: Page) => page.locator('.fc-timegrid-col[data-date]').evaluateAll(els => els.map(e => e.getAttribute('data-date') ?? ''))

function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

test('Semana es una rejilla de tres días, con el chip «3 días», y la navegación avanza tres', async ({ page }) => {
  await irAAgenda(page)
  await expect(page.locator('.fc-timeGridTresDias-view')).toBeVisible()
  await expect(page.getByRole('tab', { name: '3 días' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.ag-banda-movil')).toBeVisible()
  await sinCompactar(page)
  await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(3)
  const antes = await fechas(page)
  await page.getByRole('button', { name: 'Periodo siguiente' }).click()
  await expect.poll(async () => (await fechas(page))[0]).toBe(sumarDias(antes[0], 3))
})

test('Día es la rejilla de un día y Mes es el del teléfono', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('tab', { name: 'Día', exact: true }).click()
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
  await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(1)
  await page.getByRole('tab', { name: 'Mes', exact: true }).click()
  await expect(page.locator('.agenda-fc.ag-cal-mes-movil')).toBeVisible()
  await expect(page.locator('section[aria-label="Citas del día seleccionado"]')).toBeVisible()
})

test('el arrastre con pulsación larga mueve una cita (PUT)', async ({ page, context }) => {
  await irAAgenda(page)
  await sinCompactar(page)
  /* La primera cita FUTURA de arriba a abajo (una pasada no se arrastra lejos
     de la vista) y se baja una hora. */
  const objetivo = await page.locator('.fc-timegrid-event:not(.fc-event-past)', { hasText: 'Paciente' }).evaluateAll(els => {
    const visibles = els.map(e => e.getBoundingClientRect()).filter(r => r.top > 180 && r.bottom < 900)
    visibles.sort((a, b) => a.top - b.top)
    const r = visibles[0]
    return r ? { x: r.left + r.width / 2, y: r.top + Math.min(12, r.height / 2) } : null
  })
  if (!objetivo) throw new Error('sin cita futura a la vista que arrastrar')
  const franja = await page.locator('td.fc-timegrid-slot-lane').first().evaluate(e => e.getBoundingClientRect().height)
  const { x, y } = objetivo
  const cdp = await context.newCDPSession(page)
  const put = page.waitForRequest(r => r.url().includes('/api/appointments/') && r.method() === 'PUT', { timeout: 15000 })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await page.waitForTimeout(1200) // `eventLongPressDelay` de FullCalendar: 1000 ms
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (franja * 2 * i) / 12 }] })
    await page.waitForTimeout(40)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  // Si cae fuera de horario sale el aviso de confirmación: se acepta.
  const confirmar = page.getByRole('dialog').getByRole('button', { name: /^(Mover|Sí|Confirmar|Continuar|Aceptar)/ })
  if (await confirmar.isVisible({ timeout: 1500 }).catch(() => false)) await confirmar.click()
  await put
})
