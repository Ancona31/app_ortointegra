import { test, expect } from '@playwright/test'
import { SESION, interruptorAgenda, soloEscritorio } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * F3.3 · El minicalendario de mes (bloque F, detrás del interruptor).
 *
 * Sale en dos sitios del ESCRITORIO (en el teléfono no, decisión 21): en el
 * hueco inferior del panel de la vista Día y en el desplegable «Ir a una
 * fecha» de la barra. Pulsar un día hace `gotoDate` y CONSERVA la vista.
 * Teclado del patrón de selector de fechas de APG: flechas, Re Pág / Av Pág,
 * Inicio / Fin, Enter; Escape cierra el desplegable y el foco vuelve al botón.
 *
 * APAGADO: ni el botón ni el calendario del panel existen.
 *
 * MUTACIONES: quitar el `agendaV2 &&` del hueco `miniMes` → «apagado» ve el
 * calendario; cambiar `gotoDate` por `changeView('timeGridDay', d)` → la
 * prueba de «conserva la vista» se pone en rojo.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test.afterEach(() => { interruptorAgenda('A', false) })

const FMT = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
/** El `aria-label` del botón de un día, como lo compone `MiniMes`. */
const etiqueta = (fecha: string): string => FMT.format(new Date(`${fecha}T12:00:00Z`))

/** Un día laborable (lunes a viernes) del mes que viene, del 15 en adelante: nunca «hoy» ni un día plegado. */
function laborableDelMesQueViene(): string {
  const hoy = new Date()
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() + 1, 15))
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** El lunes de la semana de `fecha` (el lunes nunca se pliega). */
function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

test('apagado: no hay desplegable de fecha ni calendario en el panel de Día', async ({ page }) => {
  await abrirAgendaApagada(page)
  await expect(page.getByRole('button', { name: 'Ir a una fecha' })).toHaveCount(0)
  await page.locator('.fc-col-header-cell a').first().click()
  await expect(page.locator('.ag-dia-aside')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Calendario del mes' })).toHaveCount(0)
})

test('encendido: en el panel de Día, pulsar un día lleva a ese día y se queda en Día', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await page.locator('.fc-col-header-cell a').first().click()
  const panel = page.getByRole('region', { name: 'Calendario del mes' })
  await expect(panel.getByRole('grid')).toBeVisible()
  await expect(panel.locator('[aria-current="date"]')).toHaveCount(1)
  await panel.getByRole('button', { name: 'Mes siguiente' }).click()
  const destino = laborableDelMesQueViene()
  await panel.getByRole('button', { name: etiqueta(destino) }).click()
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
  await expect(page.locator(`.fc-timegrid-col[data-date="${destino}"]`)).toBeVisible()
})

test('encendido: el desplegable de la barra, con teclado; conserva la vista Semana', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  const boton = page.getByRole('button', { name: 'Ir a una fecha' })
  await expect(boton).toHaveAttribute('aria-expanded', 'false')
  await boton.click()
  const dialogo = page.getByRole('dialog', { name: 'Elegir fecha' })
  await expect(dialogo).toBeVisible()
  await expect(boton).toHaveAttribute('aria-expanded', 'true')
  const enfocado = dialogo.locator('button[data-fecha]:focus')
  await expect(enfocado).toHaveCount(1)
  const antes = await enfocado.getAttribute('data-fecha')
  await page.keyboard.press('PageDown') // un mes adelante
  await page.keyboard.press('ArrowDown') // una semana más
  const despues = await dialogo.locator('button[data-fecha]:focus').getAttribute('data-fecha')
  expect(despues).not.toBe(antes)
  await page.keyboard.press('Enter')
  await expect(dialogo).toHaveCount(0)
  await expect(boton).toBeFocused()
  await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible()
  await expect(page.locator(`.fc-timegrid-col[data-date="${lunesDe(despues ?? '')}"]`)).toBeVisible()

  await boton.click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Elegir fecha' })).toHaveCount(0)
  await expect(boton).toBeFocused()
})
