import { test, expect, type Page } from '@playwright/test'
import { irAAgenda, SESION } from './ayudas'

/**
 * Bloque F · F1.2 · la barra lateral se pliega a iconos, sólo en /agenda y desde
 * `lg` (diseño en `e2e/resultados/plan_F.md` §1, decisión 11). Preferencia del
 * navegador en `localStorage` (`spinus.barra.plegada`).
 */

test.use({ storageState: SESION.adminA })

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'escritorio', 'la barra plegable es de escritorio (lg)')
})

const anchoBarra = (page: Page) => page.locator('aside#barra-lateral').evaluate(e => e.getBoundingClientRect().width)
const anchoRejilla = (page: Page) => page.locator('.fc-view-harness').evaluate(e => e.getBoundingClientRect().width)
const anchosColumnas = (page: Page) => page.locator('.fc-timegrid-col[data-date]').evaluateAll(els => els.map(e => e.getBoundingClientRect().width))

test('plegar en la agenda deja 64 px, la rejilla gana ~192 px y las columnas siguen iguales', async ({ page }) => {
  await irAAgenda(page)
  expect(await anchoBarra(page)).toBe(256)
  const antes = await anchoRejilla(page)
  const boton = page.getByRole('button', { name: 'Plegar menú' })
  await expect(boton).toHaveAttribute('aria-expanded', 'true')
  await expect(boton).toHaveAttribute('aria-controls', 'barra-lateral')
  await boton.click()
  await expect(page.getByRole('button', { name: 'Desplegar menú' })).toHaveAttribute('aria-expanded', 'false')
  expect(await anchoBarra(page)).toBe(64)
  await expect.poll(async () => (await anchoRejilla(page)) - antes).toBeGreaterThan(185)
  // `updateSize`: FullCalendar repartió el ancho nuevo entre las columnas.
  await expect.poll(async () => {
    const c = await anchosColumnas(page)
    return Math.max(...c) - Math.min(...c)
  }).toBeLessThanOrEqual(1)
  /* Lo que de verdad prueba `updateSize`: sin él FullCalendar conserva los anchos
     de columna que calculó (son explícitos en sus tablas) y el armazón crece
     solo. Las columnas tienen que llenar el armazón salvo la de horas. Medido
     sin el aviso: quedaban ~250 px sin usar. */
  await expect.poll(async () => {
    const suma = (await anchosColumnas(page)).reduce((a, b) => a + b, 0)
    return (await anchoRejilla(page)) - suma
  }).toBeLessThan(90)
})

test('recargar conserva el estado; fuera de la agenda la barra va desplegada', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('button', { name: 'Plegar menú' }).click()
  expect(await anchoBarra(page)).toBe(64)
  await page.reload()
  await page.locator('.fc-event').first().waitFor()
  expect(await anchoBarra(page)).toBe(64)
  await expect(page.getByRole('link', { name: 'Agenda' })).toBeVisible()
  await page.goto('/dashboard')
  expect(await anchoBarra(page)).toBe(256)
  await expect(page.getByRole('button', { name: /Plegar menú|Desplegar menú/ })).toHaveCount(0)
  await irAAgenda(page)
  await page.getByRole('button', { name: 'Desplegar menú' }).click()
  expect(await anchoBarra(page)).toBe(256)
})

test('teclado: Enter en el botón pliega, y pulsar un grupo plegado lo despliega abierto', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('button', { name: 'Plegar menú' }).focus()
  await page.keyboard.press('Enter')
  const desplegar = page.getByRole('button', { name: 'Desplegar menú' })
  await expect(desplegar).toHaveAttribute('aria-expanded', 'false')
  await expect(desplegar).toBeFocused()
  await page.getByRole('button', { name: 'Documentos' }).click()
  expect(await anchoBarra(page)).toBe(256)
  await expect(page.getByRole('button', { name: 'Receta médica' })).toBeVisible()
})
