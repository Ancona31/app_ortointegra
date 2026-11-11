import { test, expect } from '@playwright/test'
import { irAAgenda, modalCita, SESION } from './ayudas'

test.use({ storageState: SESION.adminA })

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'telefono', 'específica del proyecto telefono (viewport móvil)')
})

test('teléfono: Semana y Día son listas (.fc-list-*), nunca rejilla', async ({ page }) => {
  await irAAgenda(page)
  await expect(page.locator('.fc-listWeek-view')).toBeVisible()
  await expect(page.locator('.fc-list-event, .fc-list-empty').first()).toBeVisible()
  await expect(page.locator('.fc-timegrid')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Día' }).click()
  // MEDIA «Día en teléfono»: no basta con ver una fila de lista — hay que
  // exigir que la vista sea realmente `listDay` y que no haya NINGUNA
  // rejilla de tiempo escondida detrás.
  await expect(page.locator('.fc-listDay-view')).toBeVisible()
  await expect(page.locator('.fc-list-event, .fc-list-empty').first()).toBeVisible()
  await expect(page.locator('.fc-timegrid')).toHaveCount(0)
})

test('teléfono: filtrar por médico deja sólo sus citas', async ({ page }) => {
  const select = page.getByLabel('Filtrar por médico')
  await irAAgenda(page)
  await expect(select).toBeVisible()

  await select.selectOption({ label: 'Dra. Invitada Semilla Dos' })
  await page.locator('.fc-list-event, .fc-list-empty').first().waitFor({ state: 'visible', timeout: 15000 })
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toHaveCount(0)

  await select.selectOption({ label: 'Dr. Admin Semilla Uno' })
  await page.locator('.fc-list-event, .fc-list-empty').first().waitFor({ state: 'visible', timeout: 15000 })
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' }).first()).toBeVisible()
})

test('teléfono: el Mes lleva el panel del día debajo', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('tab', { name: 'Mes' }).click()
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
  await expect(page.locator('section[aria-label="Citas del día seleccionado"]')).toBeVisible()
})

test('teléfono: alta desde la barra inferior', async ({ page }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita-movil"]').click()
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
})
