import { test, expect, request, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  irAAgenda, soloEscritorio, SESION, diaDeLaSemana, tituloUnico, toastConTexto,
  observarEcosRealtime,
} from './ayudas'

/**
 * Caché de rangos de citas (A1.5a, `src/lib/agenda/cacheRangosCitas.ts`).
 * Volver a lo ya visto no pregunta; cualquier escritura propia o evento de
 * tiempo real lo vacía, así que después de un cambio SÍ pregunta.
 *
 * Señales de semana, de la semilla (`scripts/agenda-semilla.ts`): «Cirugía
 * programada» sólo existe en la actual y «Sesión docente» sólo en la siguiente.
 * Sólo escritorio: usa `.fc-next-button`/`.fc-prev-button`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const EVENTO_ACTUAL = 'Cirugía programada'
const EVENTO_SIGUIENTE = 'Sesión docente'

const esGetCitas = (r: { url(): string; method(): string }): boolean =>
  r.url().includes('/api/appointments?') && r.method() === 'GET'

/** Cuenta los `GET /api/appointments` desde ahora; `parar()` deja de contar. */
function contarGetCitas(page: Page): { veces: () => number; parar: () => void } {
  let n = 0
  const ver = (r: { url(): string; method(): string }): void => { if (esGetCitas(r)) n++ }
  page.on('request', ver)
  return { veces: () => n, parar: () => page.off('request', ver) }
}

async function irASemana(page: Page, boton: 'next' | 'prev', senal: string): Promise<void> {
  await page.locator(boton === 'next' ? '.fc-next-button' : '.fc-prev-button').click()
  await expect(page.locator('.fc-event', { hasText: senal }).first()).toBeVisible({ timeout: 10000 })
}

/** El médico y el consultorio por defecto del modal de alta de admin.a. */
async function idsPorDefecto(page: Page): Promise<{ medicoId: string; consultorioId: string }> {
  await page.locator('[data-onboard="nueva-cita"]').click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const medicoId = await dialogo.locator('select').nth(0).inputValue()
  const consultorioId = await dialogo.locator('select').nth(1).inputValue()
  if (!medicoId || !consultorioId) throw new Error('no se pudo leer medico_id/consultorio_id por defecto del modal')
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
  return { medicoId, consultorioId }
}

test('volver a una semana ya vista no pide /api/appointments y las citas están', async ({ page }) => {
  await irAAgenda(page)
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible()
  await irASemana(page, 'next', EVENTO_SIGUIENTE)

  const peticiones = contarGetCitas(page)
  await irASemana(page, 'prev', EVENTO_ACTUAL)
  // «No ocurrió nada» no tiene evento: un respiro corto para lo que pudiera salir.
  await page.waitForTimeout(500)
  peticiones.parar()
  expect(peticiones.veces()).toBe(0)
})

test('una cita propia vacía la caché: al volver a su semana se pregunta y la cita sigue', async ({ page }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const titulo = tituloUnico('Evento caché de rangos E2E')
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  // El LUNES y no `DIA_LABORABLE_LIBRE`: el jueves ya lo reparten otros
  // archivos, y una tarjeta más a esa hora tapaba el clic de
  // `agenda-tiempo-real.e2e.ts` (ver la nota de `DIA_LABORABLE_LIBRE`).
  await page.locator('input[type="date"]').first().fill(diaDeLaSemana(0, 0))
  await page.locator('input[type="time"]').first().fill('16:00')
  const respAlta = page.waitForResponse(r => r.url().includes('/api/appointments') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar' }).click()
  expect((await respAlta).ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  await irASemana(page, 'next', EVENTO_SIGUIENTE)
  const vuelta = page.waitForRequest(esGetCitas, { timeout: 5000 })
  await irASemana(page, 'prev', EVENTO_ACTUAL)
  // Primero la cita: con una caché que no invalida, la semana sale de lo
  // guardado ANTES del alta y la cita desaparece. Después, que sí se preguntó.
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(1)
  await vuelta
})

test('una cita ajena en otra semana vacía la caché por tiempo real: al ir a esa semana aparece', async ({ page }) => {
  const esperarEco = observarEcosRealtime(page)
  await irAAgenda(page)
  const { medicoId, consultorioId } = await idsPorDefecto(page)
  // La semana siguiente queda guardada en la caché, y se vuelve a la actual.
  await irASemana(page, 'next', EVENTO_SIGUIENTE)
  await irASemana(page, 'prev', EVENTO_ACTUAL)

  const titulo = tituloUnico('Evento ajeno caché de rangos E2E')
  const dia = diaDeLaSemana(1, 3)
  const clientId = randomUUID()
  const comoSecretaria = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  const res = await comoSecretaria.post('/api/appointments', {
    data: {
      title: titulo,
      start_time: new Date(`${dia}T16:40:00`).toISOString(),
      end_time: new Date(`${dia}T17:00:00`).toISOString(),
      all_day: false,
      medico_id: medicoId,
      consultorio_id: consultorioId,
      client_id: clientId,
    },
  })
  expect(res.ok()).toBeTruthy()
  await comoSecretaria.dispose()
  // El evento de tiempo real tiene que haber llegado ANTES de navegar: es lo
  // que vacía la caché, y lo que esta prueba quiere ver.
  await esperarEco(clientId)

  await irASemana(page, 'next', EVENTO_SIGUIENTE)
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 10000 })
})

test('agenda → dashboard → agenda pinta sin petición bloqueante', async ({ page }) => {
  await irAAgenda(page)
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await page.waitForURL('**/dashboard')
  await page.waitForLoadState('networkidle')

  const peticiones = contarGetCitas(page)
  await page.getByRole('link', { name: 'Agenda', exact: true }).click()
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
  peticiones.parar()
  expect(peticiones.veces()).toBe(0)
})
