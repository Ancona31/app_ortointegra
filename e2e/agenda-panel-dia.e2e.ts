import { test, expect, type Page } from '@playwright/test'
import { irAAgenda, modalCita, soloEscritorio, SESION, DIA_LABORABLE_FIJO } from './ayudas'

// El aside de Día ("panelDelDia") sólo se monta `!isMobile && timeGridDay`
// (ver la nota junto a esa constante en `page.tsx`) — no existe en `telefono`.
soloEscritorio()
test.use({ storageState: SESION.adminA })

/** La fecha (`YYYY-MM-DD`) que la vista Día tiene pintada ahora mismo. */
async function fechaDeLaVistaDia(page: Page): Promise<string> {
  const atributo = await page.locator('.fc-timegrid-col[data-date]').first().getAttribute('data-date')
  if (!atributo) throw new Error('fechaDeLaVistaDia: no se encontró ninguna columna con data-date en la vista Día')
  return atributo
}

/**
 * Navega la vista Día, con ‹ › del toolbar, hasta `destino` (`YYYY-MM-DD`).
 * MEDIA de la revisión: la prueba anterior se quedaba en el día de HOY —un
 * sábado o domingo (cerrado) no tiene el mismo resumen que un laborable, y
 * `test.skip` encubría la diferencia en vez de forzar un día conocido—. La
 * comparación de cadenas `YYYY-MM-DD` ya ordena cronológicamente, así que no
 * hace falta aritmética de fechas ni husos: sólo seguir pulsando hacia el
 * lado correcto hasta llegar.
 */
async function irADiaFijo(page: Page, destino: string): Promise<void> {
  for (let intentos = 0; intentos < 14; intentos++) {
    const actual = await fechaDeLaVistaDia(page)
    if (actual === destino) return
    await page.locator(actual < destino ? '.fc-next-button' : '.fc-prev-button').click()
    await page.locator('.fc-timegrid-col[data-date]').first().waitFor({ state: 'visible' })
  }
  throw new Error(`irADiaFijo: no se alcanzó ${destino} en 14 pasos`)
}

test('panel lateral de Día, en un laborable fijo de la semilla: resumen y huecos; pulsar un hueco abre «Nueva cita»', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('tab', { name: 'Día' }).click()
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
  await irADiaFijo(page, DIA_LABORABLE_FIJO)

  // admin.a abre la agenda ya filtrada a sí mismo (es médico): el panel de
  // huecos existe con un único médico, sin tocar el filtro. Este miércoles
  // tiene siempre, por semilla, «Cirugía programada» (07:00–10:00) y la cita
  // de consulta de las 10:00 (`agenda-semilla.ts`, `citasDeConsultaA`): el
  // resumen nunca puede salir en cero.
  const resumen = page.locator('section[aria-label="Resumen del día"], section[aria-label^="Resumen · "]')
  await expect(resumen).toBeVisible()
  await expect(resumen.getByText(/cita|citas/)).toBeVisible()

  // Huecos garantizados: aun si la semilla elige TODOS los candidatos de
  // `HUECOS_ADMIN` ese día (08:00–09:00, 09:00–09:30, 11:30–11:50,
  // 12:00–13:00, 13:00–13:15, 16:00–17:00, 17:00–17:30), queda sin tocar
  // 13:15–16:00 dentro del horario de la clínica (08:00–18:00) — sin
  // `test.skip` condicional.
  const huecos = page.locator('section[aria-label="Huecos disponibles"]')
  await expect(huecos).toBeVisible()
  const primerHueco = huecos.locator('.ag-hueco').first()
  await expect(primerHueco).toBeVisible()
  await primerHueco.click()

  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
})
