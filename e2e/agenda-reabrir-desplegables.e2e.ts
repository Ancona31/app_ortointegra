import { test, expect, type Page } from '@playwright/test'
import { SESION, interruptorAgenda } from './ayudas'
import { abrirAgendaV2 } from './interaccionesAyudas'

/**
 * I1 · punto 7 de Angel: «Ir a una fecha» tumbaba la pantalla entera («Algo
 * salió mal») al abrirlo por SEGUNDA vez. La lupa de «Buscar citas» —la de la
 * barra de escritorio y la de la banda del teléfono— tenía el mismo defecto.
 *
 * Causa: el `onClick` leía `e.currentTarget` DENTRO del actualizador de
 * `setAncla`. React pone `currentTarget` a `null` al terminar el despacho del
 * evento, y el actualizador no siempre corre en el clic: cuando la fibra ya
 * tiene trabajo pendiente (el `setAncla(null)` de Escape o del clic fuera), se
 * encola y corre después, en el render, con `currentTarget` ya en `null`.
 * `cajaDe(null)` → `TypeError … reading 'getBoundingClientRect'` → límite de
 * error. Abrir la primera vez no fallaba porque ahí el actualizador corre en
 * el acto (estado «ansioso»).
 *
 * MUTACIÓN (comprobada en rojo): volver a leer `e.currentTarget` dentro del
 * actualizador en `SelectorFecha` → «Ir a una fecha»; en `BotonBuscar` →
 * «la lupa» (escritorio y teléfono).
 */
test.use({ storageState: SESION.adminA })
test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterAll(() => {
  // Integración I: cada archivo deja la v2 APAGADA al terminar (la convención de la batería: el
  // global-setup la apaga y sólo la prueba que la necesita la enciende). Encendida, las e2e que
  // la suponen apagada (agenda-secretaria, agenda-tipos-cita) caían en el aviso de empalme B7.
  interruptorAgenda('A', false)
})

/** Abre, cierra con Escape y vuelve a abrir: el diálogo está y la pantalla no se cayó. */
async function abrirCerrarAbrir(page: Page, boton: string, dialogo: string): Promise<void> {
  const disparador = page.locator(boton).filter({ visible: true }).first()
  await disparador.click()
  await expect(page.getByRole('dialog', { name: dialogo })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: dialogo })).toHaveCount(0)
  await disparador.click()
  await expect(page.getByRole('dialog', { name: dialogo })).toBeVisible()
  await expect(page.getByText('Algo salió mal')).toHaveCount(0)
  // Y el botón sigue alternando: un tercer clic lo cierra. Sólo corre en computadora (`esc`): la capa va anclada
  // y sin velo, así que el clic es uno normal, con sus comprobaciones de accionabilidad (auditoría B13 · 6).
  // Fuera de computadora el velo taparía el botón (B13 · AG8); allí la lupa se prueba por el menú, abajo.
  await disparador.click()
  await expect(page.getByRole('dialog', { name: dialogo })).toHaveCount(0)
  await expect(page.getByText('Algo salió mal')).toHaveCount(0)
}

test('«Ir a una fecha» se vuelve a abrir tras cerrarlo con Escape, sin «Algo salió mal»', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'el botón está en la barra de escritorio')
  await abrirAgendaV2(page)
  await abrirCerrarAbrir(page, '[data-selector-fecha]', 'Elegir fecha')
})

test('la lupa «Buscar citas» se vuelve a abrir tras cerrarla con Escape, sin «Algo salió mal»', async ({ page }) => {
  await abrirAgendaV2(page)
  if (test.info().project.name !== 'telefono') {
    await abrirCerrarAbrir(page, '[data-buscar-citas]', 'Buscar citas')
    return
  }
  /* B13 · barra por formato (PIEZAS §4): en el teléfono la lupa es una opción de «Opciones de la agenda»;
     se abre por ahí dos veces (la segunda, tras cerrar con Escape) y la pantalla no se cae. */
  for (let vez = 0; vez < 2; vez++) {
    await page.locator('.ag-banda-movil').getByRole('button', { name: 'Opciones de la agenda' }).click()
    await page.getByRole('menu', { name: 'Opciones de la agenda' }).getByRole('menuitem', { name: 'Buscar citas de un paciente' }).click()
    await expect(page.getByRole('dialog', { name: 'Buscar citas' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Buscar citas' })).toHaveCount(0)
  }
  await expect(page.getByText('Algo salió mal')).toHaveCount(0)
})
