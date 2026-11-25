import { test, expect } from '@playwright/test'
import { irAAgenda, SESION } from './ayudas'

test.use({ storageState: SESION.adminA })

test('«Iniciar consulta» existe en la edición de una cita propia del admin y apunta a nueva-nota', async ({ page }) => {
  await irAAgenda(page)
  const cita = page.locator('.fc-event', { hasText: 'Paciente Prueba 01' }).first()
  await cita.click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const enlace = page.getByRole('link', { name: 'Iniciar consulta' })
  await expect(enlace).toBeVisible()
  const href = await enlace.getAttribute('href')
  expect(href).toMatch(/^\/expediente\/[0-9a-f-]+\/nueva-nota\?cita=[0-9a-f-]+$/)
})
