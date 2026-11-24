import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * B13 · VISTAS (rediseño de la agenda, AG2–AG4), con la v2 encendida:
 *   · AG2 · cuatro vistas en todos los formatos (CALMA §29.1): Mes, Semana,
 *     3 días y Día. En el teléfono Día y «3 días» son REJILLA (§28) y no tienen
 *     hueco para agendar; la Semana sigue en lista.
 *   · AG3 · la Semana del teléfono lleva la tira de fechas (versión A).
 *   · AG4 · el Mes de computadora tiene como mucho 3 líneas por día (el «+N»
 *     cuenta como línea).
 * Apagada, las tres vistas de siempre (también en `agenda-movil`,
 * `agenda-f-tableta` y `agenda-interruptor`).
 *
 * MUTACIONES: quitar la cuarta fila de `VIEWS_V2` → «3 días» no existe; volver
 * `FORMATOS_DE_VISTA` a `listDay` en el teléfono → la prueba de Día cae;
 * quitar `sinHuecoParaAgendar` → tocar la rejilla del teléfono abre el alta;
 * `dayMaxEventRows` a 4 → la prueba del Mes cae.
 */
test.use({ storageState: SESION.adminA })
test.afterEach(() => { interruptorAgenda('A', false) })

const pestana = (page: Page, nombre: string) => page.getByRole('tab', { name: nombre, exact: true })
const columnas = (page: Page) => page.locator('.fc-timegrid-col[data-date]')

test.describe('teléfono', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'telefono', 'del teléfono') })

  test('cuatro vistas: Semana en lista con su tira, 3 días y Día en rejilla', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await expect(page.getByRole('tablist', { name: 'Vista del calendario' }).getByRole('tab')).toHaveText(['Mes', 'Semana', '3 días', 'Día'])
    await expect(page.locator('.fc-listWeek-view')).toBeVisible()
    const tira = page.getByRole('group', { name: 'Días de la semana' })
    await expect(tira.getByRole('button')).toHaveCount(7)
    await expect(tira.locator('[aria-current="date"]')).toHaveCount(1)
    await expect(page.locator('.fc-listWeek-view .ag-listafila--v2').first()).toBeVisible()

    await pestana(page, '3 días').click()
    await expect(page.locator('.fc-timeGridTresDias-view')).toBeVisible()
    await expect(pestana(page, '3 días')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('group', { name: 'Días de la semana' })).toHaveCount(0)

    await pestana(page, 'Día').click()
    await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
    await expect(columnas(page)).toHaveCount(1)
    await expect(page.locator('.fc-list-table')).toHaveCount(0)
  })

  test('en la rejilla del teléfono tocar un hueco no abre el alta', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await pestana(page, 'Día').click()
    await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
    /* La última franja de la rejilla (la rejilla se recorta al horario): al
       final del día, fuera de las citas de la semilla. */
    const franja = page.locator('td.fc-timegrid-slot-lane').last()
    await franja.scrollIntoViewIfNeeded()
    /* B13 · la píldora «Agendar» flota al pie (PIEZAS §4): la rejilla se desplaza hasta el final para que la
       última franja quede por encima de ella, como haría el dedo. */
    await page.locator('.fc-timegrid-body').locator('xpath=ancestor::div[contains(@class,"fc-scroller")][1]')
      .evaluate(e => { e.scrollTop = e.scrollHeight })
    /* Con el dedo, en la columna del día a la altura de esa franja (la franja
       queda debajo de la capa de columnas: un `tap()` sobre ella no llega). */
    const caja = await franja.boundingBox()
    const col = await columnas(page).first().boundingBox()
    if (!caja || !col) throw new Error('sin franja o columna a la vista')
    await page.touchscreen.tap(col.x + col.width / 2, caja.y + caja.height / 2)
    await page.waitForTimeout(600)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.fc-highlight')).toHaveCount(0)
  })

  test('la tira lleva la lista al día que se toca', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    const tira = page.getByRole('group', { name: 'Días de la semana' })
    const ultimo = tira.getByRole('button').nth(6)
    await ultimo.click()
    await expect(ultimo).toHaveAttribute('aria-pressed', 'true')
    await expect(tira.locator('[aria-pressed="true"]')).toHaveCount(1)
  })

  test('apagada: las tres vistas de siempre, sin tira y con Día en lista', async ({ page }) => {
    await abrirAgendaApagada(page)
    await expect(page.getByRole('tablist', { name: 'Vista del calendario' }).getByRole('tab')).toHaveText(['Mes', 'Semana', 'Día'])
    await expect(page.getByRole('group', { name: 'Días de la semana' })).toHaveCount(0)
    await pestana(page, 'Día').click()
    await expect(page.locator('.fc-listDay-view')).toBeVisible()
  })
})

test.describe('computadora', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'escritorio', 'de computadora') })

  test('«3 días» es una vista aparte de tres columnas; Semana sigue con siete', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await expect(page.getByRole('tablist', { name: 'Vista del calendario' }).getByRole('tab')).toHaveText(['Mes', 'Semana', '3 días', 'Día'])
    await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible()
    await pestana(page, '3 días').click()
    await expect(page.locator('.fc-timeGridTresDias-view')).toBeVisible()
    await expect(columnas(page)).toHaveCount(3)
    await pestana(page, 'Semana').click()
    await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible()
  })

  test('Mes: como mucho tres líneas por día, contando el «+N»', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await pestana(page, 'Mes').click()
    await expect(page.locator('.fc-dayGridMonth-view .ag-mes').first()).toBeVisible()
    const lineas = await page.locator('.fc-dayGridMonth-view .fc-daygrid-day').evaluateAll(celdas => celdas.map(c => {
      const visibles = Array.from(c.querySelectorAll('.fc-daygrid-event-harness'))
        .filter(h => getComputedStyle(h).visibility !== 'hidden' && (h as HTMLElement).offsetHeight > 0).length
      return visibles + c.querySelectorAll('.fc-daygrid-more-link').length
    }))
    expect(Math.max(...lineas)).toBeLessThanOrEqual(3)
    await expect(page.locator('.fc-dayGridMonth-view .fc-daygrid-more-link').first()).toBeVisible()
  })
})
