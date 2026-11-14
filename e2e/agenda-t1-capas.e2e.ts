import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, sqlLocal } from './ayudas'
import { abrirAgendaV2, burbuja, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * T1 · Punto 3 de Angel: «la burbuja se corta cuando el hueco está al fondo de
 * la pantalla. Debe abrirse hacia arriba o hacia el lado donde quepa, y nunca
 * quedar fuera de la ventana, en escritorio, tableta y teléfono. Lo mismo para
 * la tarjeta de lectura.»
 *
 * Corre en los TRES proyectos (la tableta lo recoge en `playwright.config.ts`):
 *   · escritorio (1440×900) y tableta (820×1180): un clic en la ÚLTIMA franja
 *     visible de la rejilla abre la burbuja; dentro de la ventana al abrir, y
 *     también después de que aparezcan los resultados de la búsqueda (la capa
 *     crece: el defecto era que crecía hacia abajo, fuera de la pantalla);
 *   · teléfono: la rejilla sólo existe en horizontal (844×390, formato tableta),
 *     así que la burbuja se prueba ahí; en vertical, la tarjeta de lectura (hoja
 *     inferior);
 *   · con el TECLADO abierto (simulado: `visualViewport` más bajo y su
 *     `resize`), la burbuja y la hoja suben a la parte que se ve;
 *   · escritorio (1280×560): la tarjeta de una cita al fondo sigue dentro
 *     cuando crece (el motivo del WhatsApp aparece debajo del botón).
 *
 * MUTACIÓN que lo pone en rojo: en `BurbujaAlta.tsx` (y `TarjetaLectura.tsx`),
 * volver al `colocar` de antes (sólo al montar, con `offsetHeight` y sin
 * `max-height`) y quitar `seguirColocacion`.
 */
declare global {
  /** El alto de la parte visible con el teclado simulado (`conTecladoSimulado`). */
  interface Window { __altoVisible?: number }
}

test.use({ storageState: SESION.adminA })
test.afterEach(() => { interruptorAgenda('A', false) })

/** Que la caja de la capa quede entera dentro de la ventana (con 1 px de tolerancia por redondeo). */
async function dentroDeLaVentana(page: Page, capa: Locator): Promise<void> {
  await expect.poll(async () => {
    const caja = await capa.boundingBox()
    const v = page.viewportSize()
    if (!caja || !v) return 'sin medir'
    const fuera = caja.y < -1 || caja.x < -1 || caja.y + caja.height > v.height + 1 || caja.x + caja.width > v.width + 1
    return fuera ? `fuera: ${JSON.stringify(caja)} en ${v.width}×${v.height}` : 'dentro'
  }, { timeout: 5000 }).toBe('dentro')
}

/**
 * El centro de la franja de media hora MÁS BAJA que se ve entera en la rejilla,
 * en un punto libre de citas y no tapado (la barra «Agendar» de la tableta
 * tapa el fondo del desplazable). Antes, adelante hasta pasar la semana +2 que
 * siembra la semilla (cuatro semanas en escritorio, ocho periodos de tres días
 * en la tableta): días futuros y casi vacíos.
 */
async function puntoAlFondo(page: Page): Promise<{ x: number; y: number }> {
  const siguiente = page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first()
  const tresDias = await page.locator('.fc-timeGridTresDias-view').count() > 0
  for (let i = 0; i < (tresDias ? 8 : 4); i++) await siguiente.click()
  await expect(page.locator('.fc-timegrid-col[data-date]').first()).toBeVisible()
  const p = await page.evaluate(() => {
    const filas = Array.from(document.querySelectorAll<HTMLElement>('td.fc-timegrid-slot-lane')).map(f => f.getBoundingClientRect())
    const cols = Array.from(document.querySelectorAll<HTMLElement>('.fc-timegrid-col[data-date]'))
    for (const fila of filas.reverse()) {
      if (fila.bottom > window.innerHeight || fila.height < 8) continue
      const y = fila.top + fila.height / 2
      for (const col of cols) {
        const c = col.getBoundingClientRect()
        const x = c.left + c.width / 2
        const arriba = document.elementFromPoint(x, fila.top + 2)
        const abajo = document.elementFromPoint(x, fila.bottom - 2)
        const libre = [arriba, abajo, document.elementFromPoint(x, y)]
          .every(el => el !== null && !el.closest('.fc-event') && el.closest('.fc-timegrid-body') !== null)
        if (libre) return { x, y }
      }
    }
    return null
  })
  if (!p) throw new Error('puntoAlFondo: no hay franja libre al fondo de la rejilla')
  return p
}

/** Clic en el punto; si sale el aviso de fuera de horario (la última franja suele estarlo), se acepta. */
async function abrirBurbujaAlFondo(page: Page): Promise<Locator> {
  const p = await puntoAlFondo(page)
  await page.mouse.click(p.x, p.y)
  const b = burbuja(page)
  const aviso = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Aceptar' }) })
  await expect(b.or(aviso).first()).toBeVisible()
  if (await aviso.count()) await aviso.getByRole('button', { name: 'Aceptar' }).click()
  await expect(b).toBeVisible()
  return b
}

async function burbujaAlFondoDentro(page: Page): Promise<void> {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  const b = await abrirBurbujaAlFondo(page)
  await dentroDeLaVentana(page, b)
  // Los resultados la hacen crecer: tiene que seguir dentro (y desplazarse por dentro si no cabe).
  await b.getByRole('combobox').fill('Prueba')
  await expect(b.getByRole('option').first()).toBeVisible()
  await dentroDeLaVentana(page, b)
  // Lo que no cabe se alcanza desplazando DENTRO de la burbuja.
  const guardar = b.getByRole('button', { name: 'Guardar', exact: true })
  await guardar.scrollIntoViewIfNeeded()
  await expect(guardar).toBeInViewport()
  await dentroDeLaVentana(page, b)
}

test('escritorio y tableta: la burbuja de la última franja visible no se sale de la ventana, ni al crecer', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'el teléfono vertical no tiene rejilla (abajo, en horizontal)')
  await burbujaAlFondoDentro(page)
})

test('teléfono en horizontal (formato tableta): la burbuja de la última franja no se sale de la ventana', async ({ page }, info) => {
  test.skip(info.project.name !== 'telefono', 'sólo en el proyecto teléfono')
  await page.setViewportSize({ width: 844, height: 390 })
  await burbujaAlFondoDentro(page)
})

/**
 * El teclado en pantalla, simulado: Playwright no lo abre, así que se cambia
 * `window.visualViewport` por uno cuyo alto manda la prueba (`__altoVisible`)
 * y que avisa `resize`, como el de verdad al abrirse el teclado. Lo demás de la
 * página (el viewport de layout) no cambia: es lo que hace Chrome en Android.
 */
async function conTecladoSimulado(page: Page): Promise<(alto: number) => Promise<void>> {
  await page.addInitScript(() => {
    const vv = new EventTarget()
    const medidas: Record<string, () => number> = {
      width: () => window.innerWidth, height: () => window.__altoVisible ?? window.innerHeight,
      offsetLeft: () => 0, offsetTop: () => 0, pageLeft: () => window.scrollX, pageTop: () => window.scrollY, scale: () => 1,
    }
    for (const [k, f] of Object.entries(medidas)) Object.defineProperty(vv, k, { get: f })
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  })
  return async (alto: number) => {
    await page.evaluate(a => {
      window.__altoVisible = a
      window.visualViewport?.dispatchEvent(new Event('resize'))
    }, alto)
  }
}

/** Que la capa quede en la parte de arriba que deja el teclado (`alto` px). */
async function encimaDelTeclado(capa: Locator, alto: number): Promise<void> {
  await expect.poll(async () => {
    const c = await capa.boundingBox()
    return c ? Math.round(c.y + c.height) <= alto + 1 && c.y >= -1 : false
  }, { timeout: 5000 }).toBe(true)
}

test('tableta y teléfono en horizontal: al abrirse el teclado, la burbuja sube a la parte que se ve', async ({ page }, info) => {
  test.skip(info.project.name === 'escritorio', 'en escritorio no hay teclado en pantalla')
  if (info.project.name === 'telefono') await page.setViewportSize({ width: 844, height: 390 })
  const teclado = await conTecladoSimulado(page)
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  const b = await abrirBurbujaAlFondo(page)
  const alto = Math.round((page.viewportSize()?.height ?? 0) * 0.55)
  await teclado(alto)
  await encimaDelTeclado(b, alto)
})

test('teléfono: la tarjeta (hoja inferior) se apoya encima del teclado y no se sale de lo que se ve', async ({ page }, info) => {
  test.skip(info.project.name !== 'telefono', 'sólo en el proyecto teléfono')
  const teclado = await conTecladoSimulado(page)
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await page.locator('.fc-list-event').last().click()
  const t = tarjetaLectura(page)
  await expect(t).toHaveClass(/ag-hoja/)
  await dentroDeLaVentana(page, t)
  await teclado(450)
  await encimaDelTeclado(t, 450)
})

test('escritorio: la tarjeta de una cita al fondo sigue dentro cuando crece (el motivo del WhatsApp)', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'escritorio', 'sólo en el proyecto escritorio')
  await page.setViewportSize({ width: 1280, height: 560 })
  interruptorAgenda('A', true)
  const ids = sqlLocal(`
    select p.id || '|' || co.id || '|' || pa.id from auth.users u join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Hospital Norte (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = 'Prueba 03'
     where u.email = 'admin.a@semilla.spinus.test'`).split('|')
  const inicio = fechaHoraLocalAInstante(diaDeLaSemana(3, 3), '17:30', 'America/Merida')
  const cuerpo = {
    title: 'Paciente Prueba 03', start_time: inicio, end_time: new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString(),
    medico_id: ids[0], consultorio_id: ids[1], paciente_id: ids[2], notes: 'Nota de prueba T1', status: 'scheduled',
  }
  let res = await page.request.post('/api/appointments', { data: cuerpo })
  if (res.status() === 409) {
    const { empalmes } = await res.json() as { empalmes: { id: string }[] }
    res = await page.request.post('/api/appointments', { data: { ...cuerpo, empalmes_aceptados: empalmes.map(e => e.id) } })
  }
  expect(res.ok(), await res.text()).toBeTruthy()
  const id = ((await res.json()) as { appointment: { id: string } }).appointment.id
  try {
    await abrirAgendaV2(page)
    for (let i = 0; i < 3; i++) await page.locator('.fc-next-button').click()
    const evento = page.locator('.fc-timegrid-event', { hasText: 'Nota de prueba T1' }).first()
    await evento.evaluate(e => e.scrollIntoView({ block: 'end' }))
    await evento.click()
    const t = tarjetaLectura(page)
    await dentroDeLaVentana(page, t)
    // Crece con el motivo del error (la cita se canceló con la tarjeta abierta): sigue dentro.
    sqlLocal(`update public.appointments set status = 'cancelled' where id = :'id'`, { id })
    const pestana = context.waitForEvent('page')
    await t.getByRole('button', { name: 'Enviar por WhatsApp' }).click()
    await (await pestana).waitForEvent('close')
    await expect(t.getByRole('alert')).toBeVisible()
    await dentroDeLaVentana(page, t)
  } finally {
    sqlLocal(`delete from public.cita_confirmaciones where appointment_id = :'id'; delete from public.appointments where id = :'id';`, { id })
  }
})
