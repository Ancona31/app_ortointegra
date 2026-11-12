import { test, expect, type Page } from '@playwright/test'
import { hoyEnTZ } from '../src/lib/dates'
import { irAAgenda, eventoConTexto, SESION } from './ayudas'

/**
 * Bloque F §1 · pulido visual que sale directo, sin interruptor (diseño en
 * `e2e/resultados/plan_F.md`). Cada prueba nombra su punto de la auditoría.
 * La semilla (`scripts/agenda-semilla.ts`) tiene el domingo cerrado y los
 * pacientes con teléfono `99900…`; la cita de consulta de las 10:00 de admin.a
 * está todos los días laborables de la semana visible.
 */

test.use({ storageState: SESION.adminA })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function soloEn(proyecto: 'escritorio' | 'telefono'): void {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== proyecto, `sólo en ${proyecto}`) })
}

/** Semanas (lunes primero) que toca el mes de `iso` (AAAA-MM-DD). Aritmética UTC pura. */
function semanasDelMes(iso: string): number {
  const [a, m] = iso.split('-').map(Number)
  const primero = new Date(Date.UTC(a, m - 1, 1))
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const desfase = (primero.getUTCDay() + 6) % 7
  return Math.ceil((desfase + dias) / 7)
}

test.describe('escritorio', () => {
  soloEn('escritorio')

  test('F1.4 · Día enseña teléfono y consultorio; Semana no', async ({ page }) => {
    await irAAgenda(page)
    const cita = eventoConTexto(page, 'Paciente')
    await expect(cita.locator('.ag-tarjeta-telefono')).toBeHidden()
    await expect(cita.locator('.ag-tarjeta-consultorio')).toBeHidden()
    await page.getByRole('tab', { name: 'Día' }).click()
    const enDia = page.locator('.fc-timeGridDay-view .fc-event', { hasText: 'Paciente' }).first()
    await expect(enDia.locator('.ag-tarjeta-telefono')).toBeVisible()
    await expect(enDia.locator('.ag-tarjeta-telefono')).toHaveText(/^99900\d{5}$/)
    await expect(enDia.locator('.ag-tarjeta-consultorio')).toBeVisible()
  })

  test('F1.4 · cada tarjeta de Semana y cada chip de Mes llevan data-cita-id con el id del evento', async ({ page }) => {
    await irAAgenda(page)
    const ids = await page.locator('.fc-timegrid-event .ag-tarjeta').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id ?? '').toMatch(UUID)
    await page.getByRole('tab', { name: 'Mes' }).click()
    const mes = await page.locator('.fc-daygrid-event .ag-mes:not(.ag-mes--gcal)').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    expect(mes.length).toBeGreaterThan(0)
    for (const id of mes) expect(id ?? '').toMatch(UUID)
  })

  test('F1.8 · en Semana no se escribe el estado; queda el glifo, distinto para agendada y confirmada', async ({ page }) => {
    await irAAgenda(page)
    await expect(page.locator('.fc-timeGridWeek-view .ag-tarjeta-desc-estado:visible')).toHaveCount(0)
    /* `innerText` y no `hasText`: éste lee también lo que está en `display: none`. */
    const textos = await page.locator('.fc-timeGridWeek-view .ag-tarjeta').evaluateAll(els => els.map(e => (e as HTMLElement).innerText))
    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) expect(t).not.toMatch(/agendada|confirmada|atendida|no asistió|cancelada/i)
    const glifo = (estado: string) => page.locator(`.fc-timeGridWeek-view .ag-ev-status--${estado} .ag-tarjeta-glifo`)
    await expect(glifo('scheduled').first()).toHaveText('○')
    await expect(glifo('scheduled').first()).toBeVisible()
    await expect(glifo('confirmed').first()).toHaveText('●')
    const titulo = await eventoConTexto(page, 'Paciente').locator('.ag-tarjeta').getAttribute('title')
    expect(titulo).toMatch(/· (Agendada|Confirmada|Atendida|No asistió|Cancelada)$/)
    await page.getByRole('tab', { name: 'Día' }).click()
    await expect(page.locator('.fc-timeGridDay-view .ag-tarjeta-pildora').first()).toBeVisible()
  })

  test('F1.5 · con el domingo cerrado, «Compactar» abre encendido y la banda lo dice', async ({ page }) => {
    await irAAgenda(page)
    const boton = page.getByRole('button', { name: /Compactar la rejilla al horario de la clínica/ })
    await expect(boton).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.fc-timegrid-col.fc-day-sun')).toHaveCount(0)
    await expect(page.locator('.ag-banda-compacta')).toContainText(/domingo/i)
    await boton.click()
    await expect(page.locator('.fc-timegrid-col.fc-day-sun')).toHaveCount(1)
  })

  test('F1.6 · el Mes de escritorio pinta sus semanas reales', async ({ page }) => {
    await irAAgenda(page)
    await page.getByRole('tab', { name: 'Mes' }).click()
    await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
    /* Con «Compactar» encendido (F1.5) FullCalendar recorta los días plegados de
       los bordes del mes antes de encajar a semanas: se apaga para contar. */
    const compactar = page.getByRole('button', { name: 'Ocultar los días de la semana sin actividad' })
    if (await compactar.getAttribute('aria-pressed') === 'true') await compactar.click()
    await expect(compactar).toHaveAttribute('aria-pressed', 'false')
    const filas = page.locator('.fc-daygrid-body tbody > tr')
    const hoy = hoyEnTZ('America/Merida')
    await expect(filas).toHaveCount(semanasDelMes(hoy))
    /* Y el mes siguiente: si los dos tuvieran seis semanas, la prueba no vería
       la diferencia con `fixedWeekCount` puesto. Entre dos meses seguidos al
       menos uno tiene cinco o menos. */
    await page.locator('.fc-next-button').click()
    const [a, m] = hoy.split('-').map(Number)
    const siguiente = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
    await expect(filas).toHaveCount(semanasDelMes(siguiente))
  })

  test('F1.10 · «Hoy» de escritorio deshabilitado no se atenúa', async ({ page }) => {
    await irAAgenda(page)
    const hoy = page.locator('.fc-today-button')
    await expect(hoy).toBeDisabled()
    expect(await hoy.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
    await page.locator('.fc-next-button').click()
    await expect(hoy).toBeEnabled()
    await hoy.click()
    await expect(hoy).toBeDisabled()
  })
})

test.describe('teléfono', () => {
  soloEn('telefono')

  async function controlesDeLaBanda(page: Page): Promise<{ w: number; h: number }[]> {
    return page.locator('.ag-banda-movil button, .ag-banda-movil select').evaluateAll(els =>
      els.filter(e => (e as HTMLElement).offsetParent !== null)
        .map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height } }))
  }

  test('F1.15 · la banda en dos filas: 130 px o menos, controles de 44 y nada envuelve a 360', async ({ page }) => {
    for (const ancho of [390, 360]) {
      await page.setViewportSize({ width: ancho, height: 844 })
      await irAAgenda(page)
      const banda = await page.locator('.ag-banda-movil').boundingBox()
      expect(banda?.height ?? 999).toBeLessThanOrEqual(130)
      for (const c of await controlesDeLaBanda(page)) {
        expect(c.h).toBeGreaterThanOrEqual(43.9) // subpíxel
        expect(c.w).toBeGreaterThanOrEqual(43.9)
      }
      for (const fila of ['.ag-banda-movil-fila', '.ag-banda-movil-filtros']) {
        expect((await page.locator(fila).boundingBox())?.height ?? 999).toBeLessThanOrEqual(46)
      }
      await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeAttached()
    }
  })

  test('F1.10 · «Hoy» del teléfono: deshabilitado en el rango de hoy y vuelve a él', async ({ page }) => {
    await irAAgenda(page)
    const hoy = page.locator('.ag-banda-movil').getByRole('button', { name: 'Hoy' })
    const fecha = page.locator('.ag-banda-movil-fecha')
    const inicial = await fecha.textContent()
    await expect(hoy).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: 'Periodo siguiente' }).click()
    await expect(fecha).not.toHaveText(inicial ?? '')
    await expect(hoy).toHaveAttribute('aria-disabled', 'false')
    await hoy.click()
    await expect(fecha).toHaveText(inicial ?? '')
    await expect(hoy).toHaveAttribute('aria-disabled', 'true')
  })

  test('F1.14 · la lista de Día en dos líneas: cada fila con paciente mide 72 px o menos', async ({ page }) => {
    await irAAgenda(page)
    await page.getByRole('tab', { name: 'Día' }).click()
    const filas = page.locator('.fc-listDay-view .fc-list-event', { hasText: 'Paciente' })
    await expect(filas.first()).toBeVisible()
    const altos = await filas.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
    for (const h of altos) expect(h).toBeLessThanOrEqual(72)
    const ids = await page.locator('.fc-listDay-view .fc-list-event:not(.ag-ev-gcal) .ag-listadia').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    for (const id of ids) expect(id ?? '').toMatch(UUID)
  })

  test('F1.4 · las filas de la lista de Semana llevan data-cita-id', async ({ page }) => {
    await irAAgenda(page)
    const ids = await page.locator('.fc-listWeek-view .fc-list-event:not(.ag-ev-gcal) .ag-listafila').evaluateAll(els => els.map(e => e.getAttribute('data-cita-id')))
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id ?? '').toMatch(UUID)
  })
})
