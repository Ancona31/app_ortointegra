import { test, expect, type Page } from '@playwright/test'
import { SESION } from './ayudas'

/**
 * Semilla de la primera pintura (A1.4c): `agenda/page.tsx` siembra desde el
 * servidor W-1, W y W+1, y `AgendaCliente` la guarda en la caché de rangos con
 * las claves que pedirá FullCalendar. Abrir y moverse una semana a cada lado no
 * pide `GET /api/appointments`.
 *
 * Señales de semana, de `scripts/agenda-semilla.ts` (todas de admin.a, que la
 * secretaria también ve): «Bloqueo de agenda» sólo en la anterior, «Cirugía
 * programada» sólo en la actual y «Sesión docente» sólo en la siguiente.
 */
const ANTERIOR = '.fc-prev-button:visible, [aria-label="Periodo anterior"]:visible'
const SIGUIENTE = '.fc-next-button:visible, [aria-label="Periodo siguiente"]:visible'

async function abrirYRecorrer(page: Page): Promise<string[]> {
  const pedidas: string[] = []
  page.on('request', r => { if (r.url().includes('/api/appointments?') && r.method() === 'GET') pedidas.push(r.url()) })
  await page.goto('/agenda')
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' }).first()).toBeVisible({ timeout: 15000 })
  await page.locator(ANTERIOR).first().click()
  await expect(page.locator('.fc-event', { hasText: 'Bloqueo de agenda' }).first()).toBeVisible({ timeout: 5000 })
  await page.locator(SIGUIENTE).first().click()
  await page.locator(SIGUIENTE).first().click()
  await expect(page.locator('.fc-event', { hasText: 'Sesión docente' }).first()).toBeVisible({ timeout: 5000 })
  // «No salió nada» no tiene evento: un respiro corto para lo que pudiera salir.
  await page.waitForTimeout(500)
  return pedidas
}

test.describe('admin (filtro: él mismo)', () => {
  test.use({ storageState: SESION.adminA })
  test('A1.4c: abrir no pide citas; la semana anterior y la siguiente se pintan sin petición', async ({ page }) => {
    expect(await abrirYRecorrer(page)).toEqual([])
  })
})

test.describe('secretaria (filtro: todos)', () => {
  test.use({ storageState: SESION.secretariaA })
  test('A1.4c: abrir no pide citas; la semana anterior y la siguiente se pintan sin petición', async ({ page }) => {
    expect(await abrirYRecorrer(page)).toEqual([])
  })
})
