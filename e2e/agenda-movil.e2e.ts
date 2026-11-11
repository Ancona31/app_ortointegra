import { test, expect } from '@playwright/test'
import { irAAgenda, modalCita, SESION, DIA_LABORABLE_FIJO, DIA_LABORABLE_LIBRE } from './ayudas'

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

/* F13(a) — mejora_agendaV2.md §5 Bloque F, punto 13. Antes de este fix
   `sincronizarDiaDelPanel` (useResumenVisible.ts) escribía siempre
   `vista.currentStart` —el día 1 del mes— nunca «hoy», ni siquiera al montar
   en el mes de hoy: `mesDelPanelRef.current` empieza en `''`, y la primera
   emisión de `datesSet` siempre cuenta como «mes distinto».

   El reloj se fija a `DIA_LABORABLE_FIJO` (el miércoles de ESTA semana, el
   mismo cálculo que ya usa `e2e/resultados/F/capturar.ts` para sus capturas)
   con una guarda por si esta corrida cae justo el día 1 del mes: en ese caso
   no se demuestra nada (ya sería el día 1), así que se usa el jueves
   (`DIA_LABORABLE_LIBRE`) en su lugar. Los dos caen dentro de la semana que
   la semilla llena de citas, así que `irAAgenda` no se queda esperando un
   `.fc-event` que no va a llegar. */
test('teléfono: el panel del Mes abre en HOY, no en el día 1; «siguiente» avanza al día 1 del mes nuevo', async ({ page }) => {
  const diaFijo = DIA_LABORABLE_FIJO.endsWith('-01') ? DIA_LABORABLE_LIBRE : DIA_LABORABLE_FIJO
  const [anio, mes] = diaFijo.split('-').map(Number)
  const mesSiguiente = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`

  // Mismo formateador que `FMT_DIA_PANEL` de `PanelDelDia.tsx`, con `timeZone`
  // explícito: sin él, el formateo correría en el huso del propio Node que
  // ejecuta la prueba, no en el `timezoneId` ('America/Merida') que
  // `playwright.config.ts` fija para el navegador.
  const FMT = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Merida' })
  const textoHoy = `${FMT.format(new Date(`${diaFijo}T12:00:00-06:00`))} · hoy`
  const textoDia1DelMesNuevo = FMT.format(new Date(`${mesSiguiente}T12:00:00-06:00`))

  await page.clock.setFixedTime(new Date(`${diaFijo}T09:00:00-06:00`))
  await irAAgenda(page)
  await page.getByRole('tab', { name: 'Mes' }).click()
  const titulo = page.locator('section[aria-label="Citas del día seleccionado"] h2')
  await expect(titulo).toHaveText(textoHoy)

  await page.getByRole('button', { name: 'Periodo siguiente' }).click()
  await expect(titulo).toHaveText(textoDia1DelMesNuevo)

  // «Con Hoy, vuelve a hoy»: el toolbar móvil NO tiene botón «Hoy» —
  // `headerToolbar={false}` en móvil (AgendaCliente.tsx); el nativo de
  // FullCalendar sólo vive en `TOOLBAR_ESCRITORIO`, que no se monta aquí.
  // La ruta móvil equivalente es reabrir la agenda: `mesDelPanelRef` se
  // reinicia a `''` al montar y `sincronizarDiaDelPanel` vuelve a decidir
  // con la regla de HOY en la primera emisión de `datesSet`.
  await irAAgenda(page)
  await page.getByRole('tab', { name: 'Mes' }).click()
  await expect(titulo).toHaveText(textoHoy)
})

test('teléfono: alta desde la barra inferior', async ({ page }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita-movil"]').click()
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
})
