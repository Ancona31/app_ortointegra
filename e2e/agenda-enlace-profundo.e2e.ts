import { test, expect } from '@playwright/test'
import { irAAgenda, modalCita, SESION } from './ayudas'

test.use({ storageState: SESION.adminA })

test('enlace profundo /agenda?cita=nueva&paciente=<uuid> abre «Nueva cita» con el paciente', async ({ page }) => {
  await irAAgenda(page)
  // No hay otra forma de leer el uuid de un paciente desde la UI de la
  // agenda: se toma del enlace «Expediente» de una cita suya ya existente.
  await page.locator('.fc-event', { hasText: 'Paciente Prueba 01' }).first().click()
  const enlaceExpediente = page.getByRole('link', { name: 'Expediente' })
  await expect(enlaceExpediente).toBeVisible()
  const href = await enlaceExpediente.getAttribute('href')
  const uuid = href?.split('/expediente/')[1]
  if (!uuid) throw new Error('no se pudo leer el uuid del paciente desde el enlace de Expediente')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.goto(`/agenda?cita=nueva&paciente=${uuid}`)
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
  // Acotado al modal: la tarjeta de la cita de fondo también dice «Paciente
  // Prueba 01», y sin acotar el texto resuelve a dos elementos.
  await expect(modal.getByText('Paciente Prueba 01')).toBeVisible()
})

test('enlace profundo con un paciente que no existe: toast de aviso', async ({ page }) => {
  await irAAgenda(page)
  await page.goto('/agenda?cita=nueva&paciente=00000000-0000-0000-0000-000000000000')
  await expect(page.getByText('No se encontró ese paciente. Abre la cita y elígelo a mano.')).toBeVisible({ timeout: 10000 })
})
