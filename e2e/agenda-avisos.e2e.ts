/**
 * Avisos de la agenda: fallo de citas, fallo y lentitud de Google, carga
 * incompleta.
 *
 * ⚠️ EL FALLO DE LA SEMILLA DEL SERVIDOR (A1.4c) NO SE PUEDE SIMULAR DESDE
 * PLAYWRIGHT. La semilla no es una petición del navegador que `page.route`
 * pueda interceptar: es una promesa que viaja dentro del propio documento (el
 * flujo RSC de `/agenda`), y no hay —ni debe haber— ningún gancho de pruebas en
 * el código de producción para romperla. Lo que pasa cuando falla —rechaza,
 * nunca llega (se suelta a los 3 s) o llega `null`— lo cubre la prueba unitaria
 * de `esperarSemilla` en `src/lib/tests/semillaCitas.test.ts`: en los tres
 * casos la fuente sigue a la red. Aquí se cubre la otra mitad: con la semilla
 * PRESENTE, un fallo de `/api/appointments` al llegar a la primera semana no
 * sembrada (W+2) saca la banda y «Reintentar».
 */
import { test, expect, type Page } from '@playwright/test'
import { DIA_LABORABLE_LIBRE, SESION } from './ayudas'

test.use({ storageState: SESION.adminA })

/**
 * Lleva la vista a la primera semana que NO viene sembrada (A1.4c): la página
 * siembra W-1, W y W+1 desde el servidor, así que abrir y moverse una semana ya
 * no pide `GET /api/appointments`, y un fallo de esa ruta no se ve hasta W+2.
 * Escritorio: `.fc-next-button`; teléfono: «Periodo siguiente» (en Semana, que
 * es la vista con la que abre, avanza una semana en los dos formatos).
 */
async function irASemanaNoSembrada(page: Page): Promise<void> {
  const siguiente = page.locator('.fc-next-button:visible, [aria-label="Periodo siguiente"]:visible').first()
  await siguiente.click()
  await siguiente.click()
}

test('si falla /api/appointments tras navegar: «No se pudo cargar la agenda.» + «Reintentar»; reintentar recupera las citas', async ({ page }) => {
  await page.route('**/api/appointments**', route => route.fulfill({ status: 500, body: '{"error":"fallo simulado"}' }))
  // La apertura sale de la semilla del servidor: con la ruta caída, abre bien y
  // sin preguntarle. Ese cero es lo que dice que la semilla estaba PRESENTE.
  let alAbrir = 0
  const contar = (r: { url(): string; method(): string }): void => { if (r.url().includes('/api/appointments?') && r.method() === 'GET') alAbrir++ }
  page.on('request', contar)
  await page.goto('/agenda')
  await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('No se pudo cargar la agenda.')).toHaveCount(0)
  page.off('request', contar)
  expect(alAbrir).toBe(0)
  await irASemanaNoSembrada(page)
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

test('A1.3: Google lento (8 s) no retrasa las citas propias más de 2 s', async ({ page }) => {
  // Era `test.fail()` («objetivo A1»). La causa, comprobada contra el
  // servidor real y en el código de FullCalendar 6.1.20: NO era la cola de
  // conexiones del navegador —`/api/appointments` contestaba a los ~220 ms con
  // Google todavía en vuelo— sino que FullCalendar no pinta los eventos de
  // NINGUNA fuente mientras quede una trayendo (`renderableEventStore`,
  // `@fullcalendar/core/index.js:1396-1399`, con `progressiveEventRendering`
  // en false). Desde A1.3 la fuente de Google contesta al instante desde
  // `src/lib/agenda/cacheEventosGoogle.ts` y trae en segundo plano.
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

test('A1.3: Google lento CON eventos: las citas primero, sus eventos al llegar, sin segunda petición', async ({ page }) => {
  // La segunda mitad del diseño: la fuente de Google contesta vacío al
  // instante y, cuando llega la respuesta, se vuelve a pedir a sí misma y se
  // sirve de la caché (`refrescarGoogle` en page.tsx). Si ese `refetch` no se
  // sirviera de la caché saldría otra petición; si no se hiciera, el evento de
  // Google no se pintaría nunca.
  let pedidas = 0
  await page.route('**/api/google/events**', async route => {
    pedidas += 1
    await new Promise(resolve => setTimeout(resolve, 3000))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        estado: 'conectado',
        events: [{
          id: 'e2e-a13',
          summary: 'Evento de Google A13',
          start: { dateTime: `${DIA_LABORABLE_LIBRE}T12:00:00-06:00` },
          end: { dateTime: `${DIA_LABORABLE_LIBRE}T12:30:00-06:00` },
        }],
      }),
    })
  })
  const t0 = Date.now()
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 2500 })
  expect(Date.now() - t0).toBeLessThan(2500)
  const deGoogle = page.locator('.fc-event', { hasText: 'Evento de Google A13' })
  await expect(deGoogle).toHaveCount(0)
  await expect(deGoogle.first()).toBeVisible({ timeout: 15000 })
  expect(pedidas).toBe(1)
})

test('A1.3: Google lento y caído, la banda de Google sale cuando contesta', async ({ page }) => {
  // El aviso no cambia de casos, sólo de momento: sale cuando llega la
  // respuesta, no antes, y las citas ya estaban pintadas.
  await page.route('**/api/google/events**', async route => {
    await new Promise(resolve => setTimeout(resolve, 3000))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ estado: 'error_google', events: [] }) })
  })
  await page.goto('/agenda')
  await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 2500 })
  await expect(page.getByText('No se pudo sincronizar con Google Calendar.')).toHaveCount(0)
  await expect(page.getByText('No se pudo sincronizar con Google Calendar.')).toBeVisible({ timeout: 15000 })
})

test('aviso de carga incompleta aparece en cualquier vista; «Ver por semana» sólo en Mes', async ({ page }) => {
  // GRAVE §8: `route.fulfill` de `/api/appointments` con `incompleta: true`.
  await page.route('**/api/appointments**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ appointments: [], incompleta: true }),
  }))
  await page.goto('/agenda')
  // La semilla del servidor no es `incompleta`: el aviso sale en la primera
  // semana que pregunta a la red.
  await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 15000 })
  await irASemanaNoSembrada(page)
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

test.describe('médico invitado', () => {
  test.use({ storageState: SESION.medicoA })

  test('A1.3: no pide /api/google/events — el servidor le contestaría vacío', async ({ page }) => {
    // `events/route.ts` corta con `{ estado: 'conectado', events: [] }` cuando
    // `!canVerAgendaCompleta`; la agenda contesta eso mismo sin preguntar.
    const pedidas: string[] = []
    page.on('request', r => { if (r.url().includes('/api/google/events')) pedidas.push(r.url()) })
    await page.goto('/agenda')
    await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 15000 })
    // Y tampoco al navegar a otra semana, que es otra traída de las dos fuentes.
    // A W+2: W+1 viene sembrada y no pide citas a la red, así que no habría
    // respuesta que esperar (A1.4c).
    const otra = page.waitForResponse(r => r.url().includes('/api/appointments') && r.request().method() === 'GET')
    await irASemanaNoSembrada(page)
    await otra
    expect(pedidas).toEqual([])
  })
})
