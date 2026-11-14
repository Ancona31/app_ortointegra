import { test, expect, type Locator, type Page } from '@playwright/test'
import { interruptorAgenda, irAAgenda, modalCita, SESION } from './ayudas'

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

/* ── F1.19 · barrido de simetría ─────────────────────────────────────────
   (La barra —mismos altos y centros— la prueba `agenda-f-pulido`, F1.1.) */

test('F1.19 · Semana: columnas de día iguales y cada cabecera centrada sobre su columna', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'escritorio')
  await irAAgenda(page)
  const r = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.fc-timegrid-col[data-date]')).map(e => e.getBoundingClientRect())
    const cabs = Array.from(document.querySelectorAll('.fc-col-header-cell[data-date] .ag-dayhead')).map(e => e.getBoundingClientRect())
    return {
      anchos: cols.map(c => c.width),
      desvios: cabs.map((c, i) => Math.abs((c.left + c.width / 2) - (cols[i].left + cols[i].width / 2))),
    }
  })
  expect(r.anchos.length).toBeGreaterThan(1)
  expect(Math.max(...r.anchos) - Math.min(...r.anchos)).toBeLessThanOrEqual(1)
  for (const d of r.desvios) expect(d).toBeLessThanOrEqual(1)
})

test('F1.19 · cada etiqueta de hora está a la altura de su línea', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'escritorio')
  await irAAgenda(page)
  // Sólo las celdas con hora escrita: las de media hora van vacías.
  const desvios = await page.evaluate(() => Array.from(document.querySelectorAll('td.fc-timegrid-slot-label[data-time]:has(.fc-timegrid-slot-label-cushion)'))
    .map(etq => {
      const linea = document.querySelector(`td.fc-timegrid-slot-lane[data-time="${etq.getAttribute('data-time')}"]`)
      const texto = etq.querySelector('.fc-timegrid-slot-label-cushion') ?? etq
      return linea ? Math.abs(texto.getBoundingClientRect().top - linea.getBoundingClientRect().top) : 0
    }))
  expect(desvios.length).toBeGreaterThan(4)
  // La caja del texto arranca en la línea de su hora (± 2 px), no a media franja.
  for (const d of desvios) expect(d).toBeLessThanOrEqual(2)
})

test('F1.19 · los iconos van centrados en su botón', async ({ page }, info) => {
  await irAAgenda(page)
  const sel = info.project.name === 'escritorio'
    ? '.agenda-fc .ag-controles button:not([role="tab"])'
    : '.ag-banda-movil button.ag-banda-movil-ctrl:not(.ag-banda-movil-hoy)'
  const desvios = await page.locator(sel).evaluateAll(btns => btns
    .filter(b => (b as HTMLElement).offsetParent !== null && b.querySelector('svg') && !(b as HTMLElement).innerText.trim())
    .map(b => {
      const r = b.getBoundingClientRect()
      const i = (b.querySelector('svg') as SVGElement).getBoundingClientRect()
      return Math.max(Math.abs((i.left + i.width / 2) - (r.left + r.width / 2)), Math.abs((i.top + i.height / 2) - (r.top + r.height / 2)))
    }))
  expect(desvios.length).toBeGreaterThan(0)
  for (const d of desvios) expect(d).toBeLessThanOrEqual(1)
})

/* ── Tanda T2 · punto 12: la configuración de la agenda en la misma retícula ──
   Con la v2 encendida (la pantalla sólo existe así). Las tarjetas de sección
   comparten borde izquierdo y ancho; su título, la misma sangría (`--ag-5`);
   y cada botón mide uno de los dos altos de la retícula (`h-8` en las filas,
   `h-9` en el resto: `clasesConfig.ts`). */
test('T2 · configuración: tarjetas alineadas, títulos a la misma sangría y botones en dos altos', async ({ page }) => {
  interruptorAgenda('A', true)
  try {
    await page.goto('/agenda/configuracion')
    await expect(page.getByRole('heading', { name: 'Enlaces de reserva' })).toBeVisible()
    await expect(page.getByText('Cargando', { exact: false })).toHaveCount(0)
    const m = await page.evaluate(() => {
      const tarjetas = Array.from(document.querySelectorAll<HTMLElement>('.ag-config-tarjeta'))
      return {
        cajas: tarjetas.map(t => { const r = t.getBoundingClientRect(); return { left: r.left, width: r.width } }),
        sangrias: tarjetas.map(t => (t.querySelector('h3')?.getBoundingClientRect().left ?? 0) - t.getBoundingClientRect().left),
        altos: tarjetas.flatMap(t => Array.from(t.querySelectorAll('button')))
          .filter(b => b.offsetParent !== null).map(b => Math.round(b.getBoundingClientRect().height)),
      }
    })
    expect(m.cajas.length).toBeGreaterThanOrEqual(6)
    for (const c of m.cajas) {
      expect(Math.abs(c.left - m.cajas[0].left)).toBeLessThanOrEqual(1)
      expect(Math.abs(c.width - m.cajas[0].width)).toBeLessThanOrEqual(1)
    }
    // 20 px de relleno (`--ag-5`) más el borde de 1 px.
    for (const s of m.sangrias) expect(Math.abs(s - 21)).toBeLessThanOrEqual(1)
    expect(m.altos.length).toBeGreaterThan(3)
    for (const a of m.altos) expect([32, 36]).toContain(a)
  } finally {
    interruptorAgenda('A', false)
  }
})
