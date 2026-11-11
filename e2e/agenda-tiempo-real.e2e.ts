import { test, expect, request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { irAAgenda, modalCita, soloEscritorio, SESION, DIA_LABORABLE_LIBRE, tituloUnico, toastConTexto, observarEcosRealtime } from './ayudas'

/**
 * GRAVE §8 de la revisión: ningún archivo probaba Realtime de verdad — que
 * una escritura AJENA (de otra pestaña, de otra persona) aparezca sola, sin
 * recargar. Sólo escritorio: usa el `<select>` de médico/consultorio del
 * modal de admin.a para averiguar los ids que la petición directa necesita.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test('con admin.a abierto, una cita que crea la secretaria por API aparece sola, sin recargar', async ({ page }) => {
  await irAAgenda(page)

  // Se averiguan `medico_id` (el propio admin.a, preseleccionado por
  // defecto) y `consultorio_id` (su consultorio por defecto) abriendo el
  // modal de alta y leyendo los `<select>`, sin guardar nada — es la única
  // forma de conseguir esos ids desde la UI, que no expone ningún otro sitio
  // con ellos.
  await page.locator('[data-onboard="nueva-cita"]').click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const medicoId = await dialogo.locator('select').nth(0).inputValue()
  const consultorioId = await dialogo.locator('select').nth(1).inputValue()
  if (!medicoId || !consultorioId) throw new Error('no se pudo leer medico_id/consultorio_id por defecto del modal')
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()

  const titulo = tituloUnico('Evento por API de secretaria E2E')
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(0)

  // La escritura AJENA: la hace la SECRETARIA, por una petición HTTP directa
  // con su propia sesión — no por la UI de admin.a, que es justo la pestaña
  // que debe enterarse sola. `client_id` aleatorio y DISTINTO al que firmaría
  // la pestaña de admin.a: si coincidiera por azar con una de sus propias
  // firmas pendientes, `aplicarCambioRealtime` lo trataría como un eco propio
  // y lo descartaría en vez de pintarlo — el caso que esta prueba existe
  // para cubrir es justo el contrario.
  const comoSecretaria = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  const inicio = new Date(`${DIA_LABORABLE_LIBRE}T16:00:00`)
  const fin = new Date(`${DIA_LABORABLE_LIBRE}T16:20:00`)
  const res = await comoSecretaria.post('/api/appointments', {
    data: {
      title: titulo,
      start_time: inicio.toISOString(),
      end_time: fin.toISOString(),
      all_day: false,
      medico_id: medicoId,
      consultorio_id: consultorioId,
      client_id: randomUUID(),
    },
  })
  expect(res.ok()).toBeTruthy()
  await comoSecretaria.dispose()

  // SIN recargar: la tarjeta debe aparecer sola, empujada por el websocket de
  // Realtime (`aplicarCambioRealtime`, `page.tsx`).
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 10000 })
})

test('edición propia: cambiar el estado no deja dos tarjetas por el eco de Realtime', async ({ page }) => {
  // Complementa la prueba de edición de `agenda-citas.e2e.ts` (que ya espera
  // el eco por `client_id` antes de dar por bueno el no-duplicado en el
  // ALTA): aquí se repite el mismo cuidado para una EDICIÓN, con su propio
  // `client_id` de escritura.
  const esperarEco = observarEcosRealtime(page)
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const titulo = tituloUnico('Evento para editar E2E')
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_LIBRE)
  // 15:10 y no más tarde: sin tocar la duración, el modal propone
  // `DEFAULT_DURATION` (60 min) y un inicio pasadas las 17:00 terminaría
  // después del cierre (18:00 en la semilla), disparando el aviso de
  // confirmación de fuera de horario en vez de guardar directo.
  await page.locator('input[type="time"]').first().fill('15:10')
  const respAlta = page.waitForResponse(r => r.url().includes('/api/appointments') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar' }).click()
  expect((await respAlta).ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  await page.locator('.fc-event', { hasText: titulo }).click()
  const modal = modalCita(page, 'Editar evento')
  await expect(modal).toBeVisible()
  await page.getByRole('button', { name: 'Cancelada' }).click()
  const respEdicion = page.waitForResponse(r => r.url().includes('/api/appointments/') && r.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const resEdicion = await respEdicion
  expect(resEdicion.ok()).toBeTruthy()
  const clientId = (resEdicion.request().postDataJSON() as { client_id?: string }).client_id
  if (!clientId) throw new Error('la petición de edición no llevó client_id')

  await esperarEco(clientId)
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(1)
})
