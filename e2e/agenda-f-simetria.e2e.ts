import { test, expect, type Locator, type Page } from '@playwright/test'
import { irAAgenda, modalCita, SESION } from './ayudas'

/**
 * Bloque F · orden y simetría (diseño en `e2e/resultados/plan_F.md` §1, filas
 * 17, 18 y «Orden y simetría»). Rejillas de botones sin huérfanos: filas
 * completas o una sola fila.
 */

test.use({ storageState: SESION.adminA })

/** Las filas (por `top` redondeado) de un grupo de botones, con cuántos lleva cada una. */
async function filas(botones: Locator): Promise<number[]> {
  const tops = await botones.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)))
  const cuenta = new Map<number, number>()
  for (const t of tops) cuenta.set(t, (cuenta.get(t) ?? 0) + 1)
  return [...cuenta.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)
}

async function abrirAlta(page: Page, movil: boolean): Promise<Locator> {
  await page.locator(movil ? '[data-onboard="nueva-cita-movil"]' : '[data-onboard="nueva-cita"]').click()
  const dialogo = modalCita(page, 'Nueva cita')
  await expect(dialogo).toBeVisible()
  return dialogo
}

const duraciones = (d: Locator) => d.getByRole('button', { name: /^(15 min|30 min|45 min|1 hora|1:30 h|2 horas)$/ })

test('F1.17 · alta: 560 px, las seis duraciones en una fila y «Guardar» a la vista a 1280×720', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'escritorio')
  await page.setViewportSize({ width: 1280, height: 720 })
  await irAAgenda(page)
  const dialogo = await abrirAlta(page, false)
  /* `poll`: el panel entra con una animación de escala; se mide ya asentado. */
  await expect.poll(async () => Math.round((await dialogo.boundingBox())?.width ?? 0)).toBe(560)
  expect(await filas(duraciones(dialogo))).toEqual([6])
  const guardar = dialogo.getByRole('button', { name: 'Guardar' })
  await expect(guardar).toBeInViewport({ ratio: 1 })
  await expect(dialogo.getByPlaceholder('Instrucciones, observaciones...')).toHaveAttribute('rows', '2')
})

test('F1.17 · alta en el teléfono: las duraciones en dos filas de tres', async ({ page }, info) => {
  test.skip(info.project.name !== 'telefono', 'teléfono')
  await irAAgenda(page)
  const dialogo = await abrirAlta(page, true)
  expect(await filas(duraciones(dialogo))).toEqual([3, 3])
  await expect(dialogo.getByRole('button', { name: 'Guardar' })).toBeInViewport({ ratio: 1 })
})

test('F1.18 · edición: los cinco estados en una fila, mismo centro; «Iniciar consulta» mide lo que «Guardar»', async ({ page }, info) => {
  const movil = info.project.name === 'telefono'
  await irAAgenda(page)
  const cita = movil
    ? page.locator('.fc-list-event', { hasText: 'Paciente' }).first()
    : page.locator('.fc-timegrid-event', { hasText: 'Paciente' }).first()
  await cita.click()
  const dialogo = modalCita(page, 'Editar cita')
  await expect(dialogo).toBeVisible()
  const estados = dialogo.getByRole('button', { name: /^(Agendada|Confirmada|Atendida|No asistió|Cancelada)$/ })
  await expect(estados).toHaveCount(5)
  expect(await filas(estados)).toEqual([5])
  const cajas = await estados.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { c: r.top + r.height / 2, w: r.width, h: r.height } }))
  for (const k of cajas) {
    expect(Math.abs(k.c - cajas[0].c)).toBeLessThanOrEqual(1)
    expect(Math.abs(k.w - cajas[0].w)).toBeLessThanOrEqual(1)
    expect(Math.abs(k.h - cajas[0].h)).toBeLessThanOrEqual(1)
  }
  // La cita es de admin.a (filtro por omisión) y tiene paciente: el enlace sale.
  const iniciar = dialogo.getByRole('link', { name: 'Iniciar consulta' })
  await expect(iniciar).toBeVisible()
  const hi = (await iniciar.boundingBox())?.height ?? 0
  const hg = (await dialogo.getByRole('button', { name: 'Guardar' }).boundingBox())?.height ?? 0
  expect(Math.abs(hi - hg)).toBeLessThanOrEqual(1)
})
