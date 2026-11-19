import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda, soloEscritorio } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * Tanda M (M3, punto 3 de Angel) · La barra de la agenda v2 ya no se parte a
 * trozos. Antes, de 1024 a 1279 px el candado, el engrane y «Agendar» caían a
 * otra línea, y de 1280 en adelante la fila única apretaba el filtro hasta
 * cortar el nombre del médico. Ahora (globals.css, bloque «M3 (punto 3…»):
 *   · desde 1360 px, UNA fila: ‹ › Hoy, la fecha, las vistas, el filtro, los
 *     iconos y «Agendar», todos a la misma altura; de 1360 a 1439, «Agendar»
 *     se ve como «+» y sigue llamándose «Agendar»;
 *   · de 1024 (el corte del diseño de teléfono) a 1359, DOS filas limpias:
 *     ‹ › Hoy, fecha y vistas arriba; filtro … «Agendar» abajo, ninguno suelto.
 * A todos esos anchos el nombre más largo de la semilla se lee entero en el
 * filtro, y la fecha de la semana, también. Nada se quita: todos los controles
 * están y conservan su nombre accesible. La fila única literal a 1024 no
 * cabe (tarjeta de 704 px, la fila pide ≥ 894 aun compactada): notas_m3.md.
 *
 * Con la v2 apagada la barra no envolvía más allá de sus dos filas de diseño
 * (medido en `cb0e290`), así que no se toca: su prueba está abajo.
 *
 * MUTACIONES (comprobadas en rojo, en el CSS compilado; notas_m3.md):
 *   · `.ag-filtro-medida` con `display: none` (el filtro sin ancho) → «nombre entero»;
 *   · el corte de la fila única de 1360 a 1280 → «… 1280: dos filas …»;
 *   · sin la banda del «+» (1360–1439) → «fecha entera» a 1366 (no cabe).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

test.beforeAll(() => { interruptorAgenda('A', true) })
test.afterAll(() => { interruptorAgenda('A', false) })

/** Los controles de la barra, por lo que son (no por dónde viven en el DOM). */
const ARRIBA = ['.fc-prev-button', '.fc-next-button', '.fc-today-button', '[data-selector-fecha]', '.agenda-fc [aria-label="Vista del calendario"]']
const ABAJO = ['.agenda-fc select', '[data-buscar-citas]', '[data-campana]', '[data-bloquear-horario]',
  '[data-engrane-agenda]', '[data-onboard="nueva-cita"]']

async function centros(page: Page, selectores: readonly string[]): Promise<number[]> {
  return Promise.all(selectores.map(async s => {
    const caja = await page.locator(s).first().boundingBox()
    expect(caja, `falta ${s}`).not.toBeNull()
    return caja ? Math.round(caja.y + caja.height / 2) : -1
  }))
}

function mismaFila(cs: readonly number[]): boolean {
  return cs.every(c => Math.abs(c - cs[0]) < 4)
}

/** ¿Se lee entero el texto elegido del filtro? (lo que mide el texto contra lo que deja el `<select>`). */
async function nombreEntero(page: Page): Promise<{ texto: string; cabe: boolean }> {
  return page.locator('.agenda-fc select').first().evaluate((s: HTMLSelectElement) => {
    const cs = getComputedStyle(s)
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return { texto: '', cabe: false }
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const texto = s.options[s.selectedIndex]?.text ?? ''
    const pide = ctx.measureText(texto).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    return { texto, cabe: pide <= s.clientWidth + 0.5 }
  })
}

async function elegirNombreMasLargo(page: Page): Promise<string> {
  const s = page.locator('.agenda-fc select').first()
  const valor = await s.evaluate((el: HTMLSelectElement) =>
    [...el.options].filter(o => o.value).sort((a, b) => b.text.length - a.text.length)[0].value)
  if ((await s.inputValue()) !== valor) await s.selectOption(valor)
  return valor
}

for (const ancho of [1024, 1030, 1280, 1366, 1440, 1480]) {
  test(`${ancho} px: ${ancho >= 1360 ? 'una fila' : 'dos filas limpias'}, nombre del médico y fecha enteros, nada quitado`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 })
    await abrirAgendaV2(page)
    await elegirNombreMasLargo(page)
    await expect(page.locator('.fc-event').first()).toBeVisible()

    const arriba = await centros(page, ARRIBA)
    const abajo = await centros(page, ABAJO)
    expect(mismaFila(arriba), `arriba ${arriba}`).toBe(true)
    expect(mismaFila(abajo), `abajo ${abajo}`).toBe(true)
    if (ancho >= 1360) expect(Math.abs(arriba[0] - abajo[0]), 'una sola fila').toBeLessThan(4)
    else expect(abajo[0] - arriba[0], `${ancho}: dos filas, la de abajo debajo`).toBeGreaterThan(30)

    const filtro = await nombreEntero(page)
    expect(filtro.texto).toMatch(/Semilla/)
    expect(filtro.cabe, `nombre entero: ${filtro.texto}`).toBe(true)
    const fecha = page.locator('.ag-fecha-boton-texto')
    expect(await fecha.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'fecha entera').toBe(true)

    // Nada se quitó, y cada control conserva su nombre.
    const agendar = page.getByRole('button', { name: 'Agendar', exact: true })
    await expect(agendar).toBeVisible()
    for (const nombre of ['Bloquear horario', 'Opciones de la agenda']) await expect(page.getByRole('button', { name: nombre, exact: true })).toBeVisible()
    const anchoAgendar = (await agendar.boundingBox())?.width ?? 0
    if (ancho >= 1360 && ancho < 1440) expect(anchoAgendar, '«Agendar» es «+»').toBeLessThan(40)
    else expect(anchoAgendar, '«Agendar» con su texto').toBeGreaterThan(90)
    // La capa de la fecha se abre encima de todo, también de la fila de abajo (va fuera de `.ag-controles`).
    await page.locator('[data-selector-fecha]').click()
    const capa = page.getByRole('dialog', { name: 'Elegir fecha' })
    await expect(capa).toBeVisible()
    const tapada = await capa.evaluate(d => {
      const r = d.getBoundingClientRect()
      const puntos: [number, number][] = []
      for (let x = r.left + 8; x < r.right - 8; x += 24) for (let y = r.top + 8; y < r.bottom - 8; y += 24) puntos.push([x, y])
      return puntos.filter(([x, y]) => !d.contains(document.elementFromPoint(x, y))).length
    })
    expect(tapada, 'puntos de la capa de la fecha tapados').toBe(0)
    await page.keyboard.press('Escape')
    // Nadie se sale de la tarjeta.
    const tarjeta = await page.locator('.agenda-fc').boundingBox()
    const ultimo = await page.locator('[data-onboard="nueva-cita"]').boundingBox()
    expect((ultimo?.x ?? 0) + (ultimo?.width ?? 0)).toBeLessThanOrEqual((tarjeta?.x ?? 0) + (tarjeta?.width ?? 0))
  })
}

for (const ancho of [1360, 1440, 1480]) {
  test(`Mes a ${ancho} px: una fila, con la fecha y el nombre enteros`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 })
    await abrirAgendaV2(page)
    await elegirNombreMasLargo(page)
    await page.getByRole('tab', { name: 'Mes' }).click()
    await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
    const todos = await centros(page, [...ARRIBA, ...ABAJO])
    expect(mismaFila(todos), `una fila ${todos}`).toBe(true)
    expect((await nombreEntero(page)).cabe).toBe(true)
    expect(await page.locator('.ag-fecha-boton-texto').evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'fecha entera').toBe(true)
  })
}

test('apagada, la barra de siempre: un solo bloque de controles, sin «+»', async ({ page }) => {
  interruptorAgenda('A', false)
  await page.setViewportSize({ width: 1366, height: 800 })
  await abrirAgendaApagada(page)
  await expect(page.locator('.ag-controles')).toHaveCount(1)
  await expect(page.locator('.ag-controles-nav, .ag-controles-acciones, .ag-agendar-texto')).toHaveCount(0)
  await expect(page.locator('[data-onboard="nueva-cita"]')).toHaveText('Agendar')
  interruptorAgenda('A', true)
})
