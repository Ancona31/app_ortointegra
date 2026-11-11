import { test, expect } from '@playwright/test'
import { irAAgenda, soloEscritorio, SESION, DIA_LABORABLE_FIJO, tituloUnico, selectFiltroMedico, enContextoNuevo, toastConTexto } from './ayudas'

// Usa el botón de alta y el <select> de médico del toolbar de escritorio.
soloEscritorio()
test.use({ storageState: SESION.adminA })

test('crear un evento de todo el día: se ve en la banda del día correcto y persiste en contexto nuevo', async ({ page, browser }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const titulo = tituloUnico('Todo el día E2E')
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  await page.getByRole('switch', { name: 'Todo el día' }).click()
  // GRAVE §1: fecha laborable FIJA, no la de HOY (el "Primer día" del
  // interruptor de todo el día también precarga HOY — mismo defecto, mismo
  // arreglo que en el alta con hora).
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_FIJO)

  const respuesta = page.waitForResponse(r => r.url().includes('/api/appointments') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  // MEDIA «Todo el día»: no basta con "se ve la banda" — tiene que ser la
  // banda DEL DÍA CORRECTO. `td[data-date]` es la celda de la rejilla de ese
  // día (compartida entre Mes y la fila de todo el día de Semana/Día).
  const celdaDelDia = page.locator(`td.fc-daygrid-day[data-date="${DIA_LABORABLE_FIJO}"]`)
  await expect(celdaDelDia.locator('.ag-ev-allday', { hasText: titulo })).toBeVisible()

  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    const celda = pagina.locator(`td.fc-daygrid-day[data-date="${DIA_LABORABLE_FIJO}"]`)
    await expect(celda.locator('.ag-ev-allday', { hasText: titulo })).toBeVisible()
  })
})

test('se ve el evento de varios días sembrado («Congreso de rehabilitación»)', async ({ page }) => {
  await irAAgenda(page)
  // Es de la médica invitada; hace falta «Todos los médicos» para verlo con
  // la sesión de admin.a (que abre filtrada a sí mismo).
  await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
  // GRAVE §7: sin el `if` de repliegue a la semana siguiente — el evento va
  // de `dia(0,3)` (jueves de ESTA semana) a `dia(1,1)` (martes de la que
  // viene), así que siempre solapa con la semana visible por defecto
  // (`scripts/agenda-semilla.ts:335`). El `if` era código muerto: nunca se
  // disparaba, y si algún día se disparara estaría ocultando que el evento
  // dejó de sembrarse donde se espera.
  await expect(page.locator('.fc-event', { hasText: 'Congreso de rehabilitación' }).first()).toBeVisible()
})
