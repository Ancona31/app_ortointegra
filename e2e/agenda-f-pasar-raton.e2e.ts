import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, interruptorAgenda, soloEscritorio } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'
import { animacionesFueraDeRegla } from './movimientoAyudas'

/**
 * T3 · Lo que pasa al PASAR EL RATÓN por una cita (tanda tras las pruebas a
 * mano de Angel), detrás del interruptor de la agenda v2:
 *
 *   · punto 16: la caja de la cita sube, sólo con `transform`, con una
 *     transición dentro de la regla de movimiento; nada con movimiento
 *     reducido, nada con el interruptor apagado y nada mientras se arrastra.
 *   · G3 (punto 18 de la tanda de diseño): sube 3 px (no 1), con una sombra
 *     suave y el borde más marcado (`--ag-shadow-elevada`) que aparecen EN SECO:
 *     la transición sigue siendo sólo de `transform` (la regla prohíbe animar
 *     `box-shadow`). Sólo la cita bajo el cursor.
 *
 * MUTACIONES (comprobadas en rojo al escribirlas): quitar las tres exclusiones
 * del gesto (`fc-event-mirror`, `-dragging`, `-resizing`) → «mientras se
 * arrastra»; quitar `fc-event-mirror` y `-resizing` → «mientras se estira»;
 * quitar `prefers-reduced-motion: no-preference` del `@media` → con `reduce`
 * sube. G3: volver a `translateY(-1px)` → «sube 3 px»; añadir `box-shadow` a la
 * transición → «sube 3 px» (la regla lo caza y la propiedad aparece); quitar la
 * sombra del hover → «sube 3 px».
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

/** Una cita de la rejilla (con caja `.ag-tarjeta`), ya a la vista. */
async function unaCita(page: Page): Promise<{ evento: Locator; caja: Locator }> {
  const evento = page.locator('.fc-timegrid-event:not(.fc-event-mirror)').filter({ has: page.locator('.ag-tarjeta') }).first()
  await evento.scrollIntoViewIfNeeded()
  return { evento, caja: evento.locator('.ag-tarjeta') }
}

/** El `transform` calculado de la caja (`none` o una matriz). */
function transformDe(caja: Locator): Promise<string> {
  return caja.evaluate(el => getComputedStyle(el).transform)
}

/** La sombra calculada de la caja. */
function sombraDe(caja: Locator): Promise<string> {
  return caja.evaluate(el => getComputedStyle(el).boxShadow)
}

/** Las propiedades que la caja transiciona (G3: nunca `box-shadow`). */
function transicionDe(caja: Locator): Promise<string> {
  return caja.evaluate(el => getComputedStyle(el).transitionProperty)
}

/** Lleva el ratón al centro del evento, con pasos (así llegan `pointermove` reales). */
async function pasarSobre(page: Page, evento: Locator): Promise<{ x: number; y: number }> {
  const b = await evento.boundingBox()
  if (!b) throw new Error('la cita no tiene caja')
  const centro = { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 12) }
  await page.mouse.move(centro.x, centro.y, { steps: 4 })
  return centro
}

test.describe('con el interruptor encendido', () => {
  test.beforeEach(() => { interruptorAgenda('A', true) })
  test.afterEach(() => { interruptorAgenda('A', false) })

  test('la caja sube 3 px sólo con transform, con sombra en seco, dentro de la regla, y baja al salir', async ({ page }) => {
    await abrirAgendaV2(page)
    const { evento, caja } = await unaCita(page)
    const otra = page.locator('.fc-timegrid-event:not(.fc-event-mirror) .ag-tarjeta').nth(1)
    expect(await transformDe(caja)).toBe('none')
    const sombraEnReposo = await sombraDe(caja)
    expect(await transicionDe(caja), 'sólo `transform` se transiciona').toBe('transform')
    await pasarSobre(page, evento)
    expect(await animacionesFueraDeRegla(page)).toEqual([])
    await expect.poll(() => transformDe(caja)).toBe('matrix(1, 0, 0, 1, 0, -3)')
    const sombra = await sombraDe(caja)
    expect(sombra, 'con el ratón encima lleva la sombra suave').not.toBe(sombraEnReposo)
    expect(sombra).toMatch(/0px 6px 14px/)
    // Sólo la cita bajo el cursor.
    expect(await transformDe(otra)).toBe('none')
    // La caja que FullCalendar posiciona (el `.fc-event`) no se toca: es la del FLIP.
    expect(await evento.evaluate(el => getComputedStyle(el).transform)).toBe('none')
    await page.mouse.move(5, 5)
    await expect.poll(() => transformDe(caja)).toBe('none')
    expect(await sombraDe(caja)).toBe(sombraEnReposo)
  })

  /* G3 (punto 16): sin el aviso negro del navegador (`title`) en ninguna cita,
     y con la etiqueta accesible («Nombre · Estado») en su lugar. Mutación: no
     pasar el interruptor a `renderEventContent` (`sinAvisoFlotante` siempre
     `false`) → rojo. FullCalendar no pone `title` propio en los eventos (sólo
     en el «+N» del Mes y en los enlaces de día, que no son citas). */
  test('punto 16: ninguna cita lleva title; sí su etiqueta accesible', async ({ page }) => {
    await abrirAgendaV2(page)
    const { caja } = await unaCita(page)
    await expect(caja).toHaveAttribute('aria-label', /· (Agendada|Confirmada|Atendida|No asistió|Cancelada)/)
    await expect(caja).toHaveAttribute('role', 'group')
    expect(await page.locator('.fc-event[title], .fc-event [title]').count(), 'Semana').toBe(0)
    await page.getByRole('tab', { name: 'Mes' }).click()
    await expect(page.locator('.fc-dayGridMonth-view .ag-mes').first()).toBeVisible()
    expect(await page.locator('.fc-event[title], .fc-event [title]').count(), 'Mes').toBe(0)
    await expect(page.locator('.fc-daygrid-event .ag-mes:not(.ag-mes--gcal)').first()).toHaveAttribute('aria-label', /· /)
  })

  test('mientras se arrastra no sube nada', async ({ page }) => {
    await abrirAgendaV2(page)
    const { evento } = await unaCita(page)
    const inicio = await pasarSobre(page, evento)
    await page.mouse.down()
    await page.mouse.move(inicio.x, inicio.y + 40, { steps: 8 })
    const espejo = page.locator('.fc-event-mirror .ag-tarjeta')
    await expect(espejo).toHaveCount(1)
    expect(await transformDe(espejo)).toBe('none')
    // De vuelta a su sitio antes de soltar: la cita no cambia.
    await page.mouse.move(inicio.x, inicio.y, { steps: 8 })
    await page.mouse.up()
  })

  /* Al estirar FullCalendar también pinta un espejo (`fc-event-mirror` +
     `fc-event-resizing`) con el ratón encima todo el gesto. */
  test('mientras se estira no sube nada', async ({ page }) => {
    await abrirAgendaV2(page)
    const { evento, caja } = await unaCita(page)
    await pasarSobre(page, evento)
    const asa = evento.locator('.fc-event-resizer-end')
    await expect(asa).toBeVisible()
    const b = await asa.boundingBox()
    if (!b) throw new Error('sin asa de estirar')
    const inicio = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    await page.mouse.move(inicio.x, inicio.y, { steps: 2 })
    await page.mouse.down()
    await page.mouse.move(inicio.x, inicio.y + 30, { steps: 8 })
    await expect(page.locator('.fc-event-resizing')).not.toHaveCount(0)
    expect(await transformDe(page.locator('.fc-event-resizing .ag-tarjeta').first())).toBe('none')
    // La original (escondida) termina de bajar de su hover previo y no vuelve a subir.
    await expect.poll(() => transformDe(caja)).toBe('none')
    await page.mouse.move(inicio.x, inicio.y, { steps: 8 })
    await page.mouse.up()
  })

  test.describe('con movimiento reducido', () => {
    test.use({ reducedMotion: 'reduce' })

    test('no se mueve nada', async ({ page }) => {
      await abrirAgendaV2(page)
      const { evento, caja } = await unaCita(page)
      await pasarSobre(page, evento)
      await page.waitForTimeout(300)
      expect(await transformDe(caja)).toBe('none')
    })
  })
})

test('con el interruptor apagado la cita conserva su title (como hoy)', async ({ page }) => {
  await abrirAgendaApagada(page)
  const { caja } = await unaCita(page)
  await expect(caja).toHaveAttribute('title', /· (Agendada|Confirmada|Atendida|No asistió|Cancelada)$/)
})

test('con el interruptor apagado no sube nada', async ({ page }) => {
  await abrirAgendaApagada(page)
  const { evento, caja } = await unaCita(page)
  await pasarSobre(page, evento)
  await page.waitForTimeout(300)
  expect(await transformDe(caja)).toBe('none')
})
