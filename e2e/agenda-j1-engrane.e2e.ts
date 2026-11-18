import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, sinPendientesAgenda, soloEscritorio } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'

/**
 * Tanda J, rama J1 — la barra de la agenda v2:
 *   · punto 1 (AG-DT-136): la campana y el menú del engrane van en diferido
 *     (`dynamic()`), así que con la v2 APAGADA su JavaScript no se descarga;
 *     encendida, sí, y la barra no queda ni un fotograma sin ellos;
 *   · puntos 18 y 19: «Pop-up de eventos» (la tarjeta al pasar el ratón) sale
 *     de la configuración y vive en el engrane; lo que tiene dos estados
 *     (Compactar, Densidad compacta, Pop-up de eventos) lleva un interruptor a
 *     la derecha que dice cómo está; lo que abre algo es una fila normal.
 *
 * MUTACIONES (comprobadas en rojo): volver al `import` estático de
 * `CampanaAgenda`/`MenuEngraneAgenda` en `AgendaCliente.tsx` → «apagada, no se
 * descarga…»; quitar el `await` de la precarga en el interruptor (que la barra
 * v2 se pinte antes de que lleguen) → «encendida…, sin un fotograma…»; quitar
 * el interruptor de `Opcion` → «el menú: interruptores…»; que «Pop-up de
 * eventos» no guarde la preferencia → «Pop-up de eventos apagado…» de
 * `agenda-f-tarjeta-al-pasar`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

test.afterAll(() => { interruptorAgenda('A', false) })

/** Lo que solo existe en el código de cada pieza (comprobado con grep en `src/`). */
const MARCAS = { engrane: 'Opciones de la agenda', campana: 'Por confirmar y avisos' } as const

/** Registra el texto de cada JS que la página descarga; `todos()` espera a que se hayan leído TODOS los cuerpos. */
function recogerJs(page: Page): { todos: () => Promise<string[]> } {
  const pendientes: Promise<string>[] = []
  page.on('response', r => {
    if (r.request().resourceType() === 'script') pendientes.push(r.text().catch(() => ''))
  })
  return { todos: () => Promise.all(pendientes) }
}

/** Cuenta los fotogramas en que la barra v2 ya está y el engrane o la campana todavía no. */
async function vigilarBarra(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __huecos: number }
    w.__huecos = 0
    const paso = (): void => {
      const v2 = document.querySelector('.agenda-raiz[data-agenda-v2="encendida"]')
      if (v2 && !(document.querySelector('[data-engrane-agenda]') && document.querySelector('[data-campana]'))) w.__huecos += 1
      requestAnimationFrame(paso)
    }
    requestAnimationFrame(paso)
  })
}

test('punto 1 · apagada, no se descarga el JS de la campana ni del engrane', async ({ page }) => {
  interruptorAgenda('A', false)
  const js = recogerJs(page)
  await abrirAgendaApagada(page)
  await expect(page.locator('.fc-event').first()).toBeVisible()
  await page.waitForTimeout(2500) // lo que baja en ocioso tras pintar (precargas, F3) también cuenta
  const textos = await js.todos()
  expect(textos.length).toBeGreaterThan(0)
  for (const marca of Object.values(MARCAS)) expect(textos.some(t => t.includes(marca)), marca).toBe(false)
})

test('punto 1 · encendida, llegan y la barra v2 no se pinta ni un fotograma sin ellos', async ({ page }) => {
  interruptorAgenda('A', true)
  await vigilarBarra(page)
  const js = recogerJs(page)
  await abrirAgendaV2(page)
  await expect(page.locator('[data-engrane-agenda]')).toBeVisible()
  await expect(page.locator('[data-campana]')).toBeVisible()
  const textos = await js.todos()
  for (const marca of Object.values(MARCAS)) expect(textos.some(t => t.includes(marca)), marca).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { __huecos: number }).__huecos)).toBe(0)
})

test('puntos 18 y 19 · el menú: interruptores en lo de dos estados, filas normales en lo que abre algo', async ({ page }) => {
  interruptorAgenda('A', true)
  await page.setViewportSize({ width: 1280, height: 800 })
  await abrirAgendaV2(page)
  await page.getByRole('button', { name: 'Opciones de la agenda' }).click()
  const menu = page.getByRole('menu', { name: 'Opciones de la agenda' })
  await expect(menu.getByRole('menuitem')).toHaveText(['Configuración de la agenda', 'Atajos de teclado', 'Leyenda de estados'])
  await expect(menu.getByRole('menuitemcheckbox')).toHaveText(['Compactar la rejilla', 'Densidad compacta', 'Pop-up de eventos'])
  // Cada preferencia lleva su interruptor, que dice lo mismo que `aria-checked`; las filas que abren algo, ninguno.
  for (const op of await menu.getByRole('menuitemcheckbox').all()) {
    const marcada = await op.getAttribute('aria-checked')
    await expect(op.locator('[data-interruptor]')).toHaveAttribute('data-encendido', marcada ?? '')
    await op.click()
    await expect(op).toHaveAttribute('aria-checked', marcada === 'true' ? 'false' : 'true')
    await expect(op.locator('[data-interruptor]')).toHaveAttribute('data-encendido', marcada === 'true' ? 'false' : 'true')
    await op.click() // se deja como estaba
  }
  await expect(menu.getByRole('menuitem').locator('[data-interruptor]')).toHaveCount(0)
  // Teclado: Espacio cambia «Pop-up de eventos» sin cerrar el menú; Escape cierra y devuelve el foco.
  const popup = menu.getByRole('menuitemcheckbox', { name: 'Pop-up de eventos' })
  await popup.focus()
  await page.keyboard.press('Space')
  await expect(popup).toHaveAttribute('aria-checked', 'false')
  await page.keyboard.press('Space')
  await expect(popup).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Opciones de la agenda' })).toBeFocused()
  // Y ya no está en la configuración. Integración J: con la v2 la configuración es la de J5, que abre el
  // funnel de primera vez a quien le falta algo y las pestañas al que no; no está en ninguna de las dos.
  await page.goto('/agenda/configuracion')
  // K3: el administrador (esta prueba va como admin A) tiene un paso más, el horario de la clínica: «de 4».
  await expect(page.getByText(/^Paso [1-4] de 4/)).toBeVisible()
  await expect(page.getByText(/tarjeta al pasar el ratón/i)).toHaveCount(0)
  const deshacer = sinPendientesAgenda(CORREO.adminA)
  try {
    await page.goto('/agenda/configuracion')
    await expect(page.getByRole('tablist', { name: 'Secciones de la configuración' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^(Este dispositivo|Esta computadora)/ })).toHaveCount(0)
    await expect(page.getByText(/tarjeta al pasar el ratón/i)).toHaveCount(0)
  } finally {
    deshacer()
  }
})

test('puntos 18 y 19 · teléfono: «Pop-up de eventos» también está, con su interruptor', async ({ page }) => {
  interruptorAgenda('A', true)
  await page.setViewportSize({ width: 390, height: 844 })
  await abrirAgendaV2(page)
  await page.locator('.ag-banda-movil').getByRole('button', { name: 'Opciones de la agenda' }).click()
  const menu = page.getByRole('menu', { name: 'Opciones de la agenda' })
  await expect(menu.getByRole('menuitem')).toHaveText(['Configuración de la agenda', 'Leyenda de estados'])
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Pop-up de eventos' }).locator('[data-interruptor]')).toBeVisible()
})
