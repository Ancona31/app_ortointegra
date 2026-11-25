import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, irAAgenda, modalCita } from './ayudas'
import { abrirAgendaV2, burbuja, clicEnFranja } from './interaccionesAyudas'

/**
 * T1 · Punto 1 de Angel: la búsqueda de paciente con más de una palabra.
 * Antes el texto ENTERO se comparaba contra el nombre o contra los apellidos
 * por separado, así que «Hugo Interián» no encontraba a nadie, y sin mirar
 * acentos «interian» tampoco. Ahora cada palabra (sin acentos ni mayúsculas)
 * tiene que estar en el nombre o en los apellidos, en cualquier orden.
 *
 * Con el paciente de la semilla «Hugo Interián Canché» (de admin.a, sin citas).
 * El formulario completo sale SIN interruptor (escritorio y teléfono); la
 * burbuja, con v2.
 *
 * MUTACIÓN que lo pone en rojo: en `buscarPacientes`
 * (`src/lib/agenda/buscarCitasPaciente.ts`) volver al `.or()` único con el
 * texto entero (`nombre.ilike.%q%,apellidos.ilike.%q%`).
 */
test.use({ storageState: SESION.adminA })

const BUSQUEDAS = ['Hugo Interián', 'interian hugo', 'HUGO', 'canche'] as const
const NOMBRE = 'Hugo Interián Canché'

/** Escribe en el buscador y espera la opción del paciente. */
async function buscaYEncuentra(campo: Locator, lista: Locator, texto: string): Promise<void> {
  await campo.fill(texto)
  await expect(lista.getByText(NOMBRE, { exact: true })).toBeVisible()
}

/** El modal «Nueva cita» de siempre: el botón «Agendar» en escritorio, la barra en el teléfono. */
async function abrirNuevaCita(page: Page, telefono: boolean): Promise<Locator> {
  await irAAgenda(page)
  await page.locator(telefono ? '[data-onboard="nueva-cita-movil"]' : '[data-onboard="nueva-cita"]').click()
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()
  return modal
}

test.afterEach(() => { interruptorAgenda('A', false) })

for (const texto of BUSQUEDAS) {
  test(`formulario completo (sin interruptor): «${texto}» encuentra a ${NOMBRE}`, async ({ page }, info) => {
    test.skip(info.project.name === 'tableta', 'el formulario completo ya se cubre en escritorio y teléfono')
    const modal = await abrirNuevaCita(page, info.project.name === 'telefono')
    await buscaYEncuentra(modal.getByPlaceholder('Buscar paciente por nombre o apellido...'), modal, texto)
  })
}

test('formulario completo: palabras que no están juntas en nadie no encuentran nada', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'basta en escritorio')
  const modal = await abrirNuevaCita(page, false)
  await modal.getByPlaceholder('Buscar paciente por nombre o apellido...').fill('Hugo Prueba')
  await expect(modal.getByText('Registrar "Hugo Prueba"')).toBeVisible()
  await expect(modal.getByText(NOMBRE, { exact: true })).toHaveCount(0)
})

test('burbuja (v2): «interian hugo» y «Hugo Interián» encuentran a Hugo Interián Canché', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'la burbuja es de la rejilla de escritorio')
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-next-button').click()
  await clicEnFranja(page, diaDeLaSemana(2, 2), '14:30')
  const b = burbuja(page)
  for (const texto of ['interian hugo', 'Hugo Interián']) {
    await buscaYEncuentra(b.getByRole('combobox'), b.getByRole('listbox'), texto)
  }
  await b.getByRole('option', { name: new RegExp(NOMBRE) }).click()
  await expect(b.getByRole('combobox')).toHaveValue(NOMBRE)
})
