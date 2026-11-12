import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda, soloEscritorio } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * F3.5 · Los atajos de teclado (bloque F, detrás del interruptor) y su ayuda.
 *
 * `t` hoy · `j`/`n` siguiente · `k`/`p` anterior · `d`/`s`/`m` vistas ·
 * `c` agendar · `/` buscar · `?` ayuda. No actúan con modificadores, durante
 * una composición, con el foco en un campo editable ni con una capa abierta.
 * WCAG 2.1.4: la ayuda trae «Usar atajos de una tecla», que los apaga y se
 * recuerda en el navegador (`spinus.agenda.atajos`).
 *
 * APAGADO: ninguna tecla hace nada.
 *
 * MUTACIONES: quitar `esObjetivoEditable` de `accionDeTecla` → la `m` tecleada
 * en el buscador cambia la vista; ignorar `encendidos` en `useAtajosAgenda` →
 * apagados desde la ayuda siguen actuando; quitar `agendaV2 &&` del montaje →
 * «apagado» responde a `m`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test.afterEach(() => { interruptorAgenda('A', false) })

const vista = (page: Page, tipo: string) => page.locator(`.fc-${tipo}-view`)

test('apagado: `m`, `j` y `?` no hacen nada', async ({ page }) => {
  await abrirAgendaApagada(page)
  const titulo = await page.locator('.fc-toolbar-title').textContent()
  await page.keyboard.press('m')
  await page.keyboard.press('j')
  await page.keyboard.press('?')
  await expect(vista(page, 'timeGridWeek')).toBeVisible()
  await expect(page.locator('.fc-toolbar-title')).toHaveText(titulo ?? '')
  await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toHaveCount(0)
})

test('encendido: vistas, navegación, hoy y agendar', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  const titulo = page.locator('.fc-toolbar-title')
  const deHoy = await titulo.textContent()
  await page.keyboard.press('m')
  await expect(vista(page, 'dayGridMonth')).toBeVisible()
  await page.keyboard.press('d')
  await expect(vista(page, 'timeGridDay')).toBeVisible()
  await page.keyboard.press('s')
  await expect(vista(page, 'timeGridWeek')).toBeVisible()
  await page.keyboard.press('j')
  await expect(titulo).not.toHaveText(deHoy ?? '')
  await page.keyboard.press('t')
  await expect(titulo).toHaveText(deHoy ?? '')
  await page.keyboard.press('n')
  await page.keyboard.press('k')
  await expect(titulo).toHaveText(deHoy ?? '')
  await page.keyboard.press('c')
  await expect(page.getByRole('dialog', { name: 'Nueva cita', exact: true })).toBeVisible()
  // Con una capa abierta, las teclas son suyas: `m` no cambia la vista de detrás.
  await page.keyboard.press('m')
  await expect(vista(page, 'timeGridWeek')).toBeVisible()
})

test('encendido: no actúan con el foco en un campo ni con modificadores', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await page.keyboard.press('/')
  const campo = page.getByRole('dialog', { name: 'Buscar citas' }).getByRole('combobox')
  await campo.pressSequentially('mjd')
  await expect(campo).toHaveValue('mjd')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+m')
  await expect(vista(page, 'timeGridWeek')).toBeVisible()
})

test('encendido: `?` abre la ayuda; apagar los atajos se recuerda al recargar (WCAG 2.1.4)', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await page.keyboard.press('?')
  const ayuda = page.getByRole('dialog', { name: 'Atajos de teclado' })
  await expect(ayuda).toBeVisible()
  const interruptor = ayuda.getByRole('switch', { name: 'Usar atajos de una tecla' })
  await expect(interruptor).toBeFocused()
  await expect(interruptor).toBeChecked()
  await interruptor.uncheck()
  await page.keyboard.press('Escape')
  await expect(ayuda).toHaveCount(0)
  await page.keyboard.press('m')
  await expect(vista(page, 'timeGridWeek')).toBeVisible()

  await page.reload()
  await abrirAgendaV2(page)
  await page.keyboard.press('m')
  await expect(vista(page, 'timeGridWeek')).toBeVisible()
  // La ayuda sigue a mano con su botón, para volver a encenderlos.
  await page.getByRole('button', { name: 'Atajos de teclado' }).click()
  await page.getByRole('dialog', { name: 'Atajos de teclado' }).getByRole('switch').check()
  await page.keyboard.press('Escape')
  await page.keyboard.press('m')
  await expect(vista(page, 'dayGridMonth')).toBeVisible()
})

/* Cierre de F · la barra anuncia las teclas (`aria-keyshortcuts`) sólo cuando
   funcionan: v2, el chunk montado y los atajos sin apagar. MUTACIÓN: pasar
   `atajos={agendaV2}` (sin mirar la preferencia) → la segunda mitad se pone en rojo. */
test('`aria-keyshortcuts` en Hoy, las vistas y la lupa sólo con los atajos encendidos', async ({ page }) => {
  await abrirAgendaApagada(page)
  await expect(page.locator('.fc-today-button')).not.toHaveAttribute('aria-keyshortcuts', /.*/)
  await expect(page.getByRole('tab', { name: 'Semana' })).not.toHaveAttribute('aria-keyshortcuts', /.*/)

  interruptorAgenda('A', true)
  await page.reload()
  await abrirAgendaV2(page)
  await expect(page.locator('.fc-today-button')).toHaveAttribute('aria-keyshortcuts', 'T')
  await expect(page.locator('.fc-next-button')).toHaveAttribute('aria-keyshortcuts', 'J N')
  await expect(page.getByRole('tab', { name: 'Semana' })).toHaveAttribute('aria-keyshortcuts', 'S')
  await expect(page.getByRole('button', { name: 'Buscar citas de un paciente' })).toHaveAttribute('aria-keyshortcuts', '/')

  await page.getByRole('button', { name: 'Atajos de teclado' }).click()
  await page.getByRole('dialog', { name: 'Atajos de teclado' }).getByRole('switch').uncheck()
  await page.keyboard.press('Escape')
  await expect(page.locator('.fc-today-button')).not.toHaveAttribute('aria-keyshortcuts', /.*/)
  await expect(page.getByRole('tab', { name: 'Semana' })).not.toHaveAttribute('aria-keyshortcuts', /.*/)
  await expect(page.getByRole('button', { name: 'Buscar citas de un paciente' })).not.toHaveAttribute('aria-keyshortcuts', /.*/)
})
