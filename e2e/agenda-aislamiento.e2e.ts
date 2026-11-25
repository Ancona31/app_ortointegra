import { test, expect } from '@playwright/test'
import { irAAgenda, SESION } from './ayudas'

test.use({ storageState: SESION.adminB })

test('admin.b (clínica B) no ve ninguna cita de la clínica A', async ({ page }) => {
  await irAAgenda(page)
  // Nombres exclusivos de la clínica A en la semilla: sus pacientes son
  // «Prueba 01»..«Prueba 25» (numéricos); los de B son «Prueba B1..B3», así
  // que "Paciente Prueba" a secas los confunde — se usa un número concreto
  // de A en vez del prefijo compartido.
  await expect(page.locator('.fc-event', { hasText: 'Paciente Prueba 05' })).toHaveCount(0)
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toHaveCount(0)
  await expect(page.locator('.fc-event', { hasText: 'Junta de servicio' })).toHaveCount(0)
  // Y sí ve lo suyo.
  await expect(page.locator('.fc-event').first()).toBeVisible()
})
