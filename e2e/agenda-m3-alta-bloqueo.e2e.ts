import { test, expect, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, modalCita, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2, burbuja, clicEnFranja } from './interaccionesAyudas'

/**
 * Tanda M (M3, punto 5 de Angel) · «Bloqueo» vuelve como tercera posición del
 * formulario «Nueva cita», junto a Cita y Evento (la de K1, `b13cb40`, que L1
 * retiró en `ce5c32e`). Abre el MISMO modal que el candado, con el día y la
 * hora desde donde se abrió el formulario. El candado se queda; el enlace
 * «Bloquear este horario» de la burbuja NO vuelve. Con la v2 apagada, como hoy.
 *
 * Semana +7, jueves (la semilla siembra citas hasta la semana +4), clínica A.
 * Ninguna prueba guarda un bloqueo: sólo abre
 * el modal y lo cancela (el alta en sí la prueba `agenda-k1-bloqueos.e2e.ts`).
 *
 * MUTACIONES (comprobadas en rojo, notas_m3.md):
 *   · no pasar `onBloquear` a `AppointmentModal` en `AgendaCliente.tsx` → «sale
 *     la posición…» (no hay tercera posición);
 *   · en el `onClick` de la posición, pasar `hora: null` → «… con el día y la
 *     hora del hueco» (el modal abre en «Días completos»);
 *   · pasar `onBloquear` también con la v2 apagada → «apagada…».
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

const JUEVES = diaDeLaSemana(7, 3)

function bloqueosDelDia(): string {
  return sqlLocal(`select count(*) from public.agenda_bloqueos b join public.clinicas c on c.id = b.clinica_id
    where c.nombre = 'Clínica Semilla A' and (b.inicio at time zone 'America/Merida')::date = :'dia'::date;`, { dia: JUEVES }).trim()
}

test.beforeAll(() => { interruptorAgenda('A', true) })
test.afterAll(() => { interruptorAgenda('A', false) })

async function aLaSemanaMasSiete(page: Page): Promise<void> {
  for (let i = 0; i < 7; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${JUEVES}"]`)).toBeVisible()
}

test('sale la posición «Bloqueo», tercera tras Cita y Evento, y abre el modal del candado con el día y la hora del hueco', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasSiete(page)
  await clicEnFranja(page, JUEVES, '10:00')
  await expect(burbuja(page)).toBeVisible()
  // El enlace de la burbuja no vuelve.
  await expect(burbuja(page).getByText('Bloquear este horario')).toHaveCount(0)
  await burbuja(page).getByRole('button', { name: 'Más opciones' }).click()
  const alta = modalCita(page, 'Nueva cita')
  await expect(alta).toBeVisible()
  const tipos = alta.getByRole('tablist', { name: 'Tipo de lo que se va a crear' }).getByRole('tab')
  await expect(tipos).toHaveText(['Cita', 'Evento', 'Bloqueo'])
  await tipos.nth(2).click()

  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloquear horario')
  await expect(alta).toBeHidden()
  await expect(m.locator('[data-bloqueo-todo-el-dia]')).not.toBeChecked()
  await expect(m.getByLabel('Fecha de inicio')).toHaveValue(JUEVES)
  await expect(m.getByLabel('Hora de inicio')).toHaveValue('10:00')
  await m.getByRole('button', { name: 'Cancelar' }).click()
  await expect(m).toBeHidden()
  expect(bloqueosDelDia()).toBe('0')
  // El candado sigue junto a la campana.
  const candado = page.getByRole('button', { name: 'Bloquear horario', exact: true })
  await expect(candado).toHaveCount(1)
  expect(await candado.evaluate(b => b.previousElementSibling?.hasAttribute('data-campana') ?? false)).toBe(true)
})

test('desde «Agendar» abre el modal del bloqueo con el día del formulario', async ({ page }) => {
  await abrirAgendaV2(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  const alta = modalCita(page, 'Nueva cita')
  await expect(alta).toBeVisible()
  const fecha = await alta.locator('input[type="date"]').first().inputValue()
  await alta.getByRole('tab', { name: 'Bloqueo' }).click()
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloquear horario')
  await expect(m.getByLabel('Fecha de inicio')).toHaveValue(fecha)
  await m.getByRole('button', { name: 'Cancelar' }).click()
  await expect(m).toBeHidden()
})

test('apagada, el formulario sigue con Cita y Evento, sin «Bloqueo»', async ({ page }) => {
  interruptorAgenda('A', false)
  await abrirAgendaApagada(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  const alta = modalCita(page, 'Nueva cita')
  await expect(alta).toBeVisible()
  await expect(alta.getByRole('tablist', { name: 'Tipo de lo que se va a crear' }).getByRole('tab')).toHaveText(['Cita', 'Evento'])
  interruptorAgenda('A', true)
})
