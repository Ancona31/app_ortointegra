import { test, expect } from '@playwright/test'
import { irAAgenda, soloEscritorio, SESION, DIA_LABORABLE_LIBRE, tituloUnico, toastConTexto, selectFiltroMedico } from './ayudas'

/**
 * GRAVE §8 de la revisión: «Secretaria: su filtro inicial (qué ve al abrir) y
 * que el alta exija médico (verifica cómo es hoy en page.tsx y prueba eso)».
 * Sólo escritorio: usa `[data-onboard="nueva-cita"]` y los `<select>` del
 * modal — en `telefono` el alta es por la barra inferior y el filtro por
 * `getByLabel('Filtrar por médico')`, ninguno exclusivo de la secretaria.
 */
soloEscritorio()
test.use({ storageState: SESION.secretariaA })

test('la secretaria abre la agenda con el filtro en «Todos los médicos»', async ({ page }) => {
  await irAAgenda(page)
  // `semillaFiltro` vale `''` para la secretaria (page.tsx: `isSecretaria ?
  // '' : defaultMedicoId`) — a diferencia de un médico, que abre en la suya.
  const select = selectFiltroMedico(page)
  await expect(select).toHaveValue('')
  // Ve citas de los DOS médicos de la clínica, sin tocar el filtro.
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toBeVisible()
  await expect(page.locator('.fc-event', { hasText: 'Comida' })).toBeVisible()
})

test('el alta exige médico: «Guardar» queda deshabilitado hasta elegir uno', async ({ page }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await page.getByRole('tab', { name: 'Evento' }).click()

  const titulo = tituloUnico('Evento de secretaria E2E')
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_LIBRE)
  await page.locator('input[type="time"]').first().fill('16:05')

  const guardar = page.getByRole('button', { name: 'Guardar' })
  // Comprobado contra el servidor real: el botón no se deshabilita por el
  // `medicoDropdownRequired && !medicoId` en sí (ese `if` sólo corta un
  // `handleSave` que ni siquiera llega a dispararse) sino porque, SIN
  // médico, el desplegable de consultorio no tiene ninguno que ofrecer
  // (`consultoriosList` sale vacío) y `disabled={... || !consultorioId}`
  // (page.tsx ~2636) atrapa el mismo caso por otro lado.
  await expect(guardar).toBeDisabled()

  const selectMedico = dialogo.locator('select').nth(0)
  await selectMedico.selectOption({ label: 'Dr. Admin Semilla Uno' })
  const selectConsultorio = dialogo.locator('select').nth(1)
  await expect(selectConsultorio).not.toHaveValue('')
  await expect(guardar).toBeEnabled()

  const respuesta = page.waitForResponse(r => r.url().includes('/api/appointments') && r.request().method() === 'POST')
  await guardar.click()
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible()
})
