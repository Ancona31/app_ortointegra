import { test, expect } from '@playwright/test'
import { SESION } from './ayudas'

test.use({ storageState: SESION.adminA })

test('si falla /api/appointments: «No se pudo cargar la agenda.» + «Reintentar»; reintentar recupera las citas', async ({ page }) => {
  await page.route('**/api/appointments**', route => route.fulfill({ status: 500, body: '{"error":"fallo simulado"}' }))
  await page.goto('/agenda')
  await expect(page.getByText('No se pudo cargar la agenda.')).toBeVisible({ timeout: 15000 })
  const reintentar = page.getByRole('button', { name: 'Reintentar' })
  await expect(reintentar).toBeVisible()

  // MEDIA «Reintentar»: unroute, pulsar, ver citas — la prueba anterior se
  // quedaba en comprobar que el botón existe, nunca en pulsarlo.
  await page.unroute('**/api/appointments**')
  const respuesta = page.waitForResponse(r => r.url().includes('/api/appointments') && r.request().method() === 'GET')
  await reintentar.click()
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('No se pudo cargar la agenda.')).toHaveCount(0)
})

test('si falla /api/google/events: las citas propias se siguen viendo', async ({ page }) => {
  await page.route('**/api/google/events**', route => route.fulfill({ status: 500, body: '{"error":"fallo simulado"}' }))
  await page.goto('/agenda')
  await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('No se pudo cargar la agenda.')).toHaveCount(0)
  await expect(page.getByText('No se pudo sincronizar con Google Calendar.')).toBeVisible({ timeout: 15000 })
})

test('objetivo A1: Google lento (8 s) no debería retrasar las citas propias más de 2 s', async ({ page }) => {
  // objetivo A1: comprobado contra el servidor real — con `/api/google/events`
  // retrasado 8 s, NINGÚN `.fc-event` aparece antes de esos 8 s, aunque
  // `appointments` y `google` son dos `eventSources` independientes de
  // FullCalendar (page.tsx, `eventSourcesStable`) y cada uno debería pintar
  // en cuanto SU `success()` llega. El gancho `loading` que alimenta
  // `ag-cargando` es el AGREGADO de las dos fuentes (comentario de
  // `page.tsx` junto a `loading={...}`, citando
  // `computeEventSourcesLoading` de FullCalendar) y sólo dimensiona
  // (`opacity: .55`, `globals.css:1762`) — no debería ocultar nada—, pero el
  // navegador tiene un límite de conexiones simultáneas por origen: con la
  // petición a Google ya "en vuelo" (interceptada, pero ya contada contra
  // ese límite) de un lado, la petición a `appointments` puede quedar en cola
  // detrás de ella. Esto es tráfico real, no un mock que haga trampa: en
  // producción, con Google de verdad lento, pasaría lo mismo.
  test.fail()

  await page.route('**/api/google/events**', async route => {
    // No hay otra señal que esperar: la mutación ES el retraso. 8 s fijos,
    // como pide el encargo.
    await new Promise(resolve => setTimeout(resolve, 8000))
    await route.continue()
  })

  const t0 = Date.now()
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 10000 })
  const ms = Date.now() - t0
  expect(ms).toBeLessThan(2000)
})

test('aviso de carga incompleta aparece en cualquier vista; «Ver por semana» sólo en Mes', async ({ page }) => {
  // GRAVE §8: `route.fulfill` de `/api/appointments` con `incompleta: true`.
  await page.route('**/api/appointments**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ appointments: [], incompleta: true }),
  }))
  await page.goto('/agenda')
  const aviso = page.getByText('Faltan citas por mostrar.')
  await expect(aviso).toBeVisible({ timeout: 15000 })
  // En Semana (vista por defecto) no hay botón de acción: no hay a dónde
  // acortar (page.tsx: `currentView === 'dayGridMonth' && (...)`).
  await expect(page.getByRole('button', { name: 'Ver por semana' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Mes' }).click()
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
  await expect(aviso).toBeVisible()
  const verPorSemana = page.getByRole('button', { name: 'Ver por semana' })
  await expect(verPorSemana).toBeVisible()

  // Y el botón funciona: deja la vista en Semana. `.fc-timeGridWeek-view` en
  // escritorio, `.fc-listWeek-view` en teléfono (`vistaEnElOtroFormato`,
  // page.tsx) — se comprueba por la pestaña, que es el mismo control en los
  // dos formatos.
  await verPorSemana.click()
  await expect(page.getByRole('tab', { name: 'Semana' })).toHaveAttribute('aria-selected', 'true')
})
