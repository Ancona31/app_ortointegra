import { test, expect, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, sqlLocal } from './ayudas'
import { abrirAgendaV2 } from './interaccionesAyudas'

/**
 * Tanda L (L1, puntos 7 y 8) · El bloqueo de horario en el TELÉFONO, donde
 * Semana y Día son listas (el bloqueo es una fila, no un fondo):
 *   · 8: el candado va junto a la campana en la banda, y abre el modal de bloqueo;
 *   · 7: pulsar la fila del bloqueo (en cualquier parte, no sólo el texto) abre
 *     su edición con los datos cargados.
 * La rejilla de escritorio la prueba `agenda-k1-bloqueos.e2e.ts`.
 *
 * MUTACIONES: no pintar `BotonBloquearHorario` en `campanaV2` (sin candado);
 * en `alPulsarEvento`, llamar a `handleEventClick` también con un bloqueo (no
 * abre el modal).
 */
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'telefono', 'sólo en el teléfono') })
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

const JUEVES = diaDeLaSemana(3, 3)
const MOTIVO = 'Quirófano L1'

function limpiar(): void {
  sqlLocal(`delete from public.agenda_bloqueos b using public.clinicas c
    where c.id = b.clinica_id and c.nombre = 'Clínica Semilla A' and (b.inicio at time zone 'America/Merida')::date = :'dia'::date;`, { dia: JUEVES })
}

test.beforeAll(() => {
  limpiar()
  interruptorAgenda('A', true)
  sqlLocal(`insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo)
    select c.id, p.id, (:'dia' || ' 15:00')::timestamp at time zone 'America/Merida', (:'dia' || ' 17:00')::timestamp at time zone 'America/Merida',
           false, 'America/Merida', :'m'
      from public.clinicas c join public.profiles p on p.clinica_id = c.id join auth.users u on u.id = p.id
     where c.nombre = 'Clínica Semilla A' and u.email = 'admin.a@semilla.spinus.test';`, { dia: JUEVES, m: MOTIVO })
})
test.afterAll(() => { limpiar(); interruptorAgenda('A', false); interruptorAgenda('B', false) })

async function aLaSemanaMasTres(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Periodo siguiente' }).click()
}

test('8 · el candado va junto a la campana en la banda y abre el modal de bloqueo', async ({ page }) => {
  await abrirAgendaV2(page)
  const banda = page.locator('.ag-banda-movil')
  const candado = banda.getByRole('button', { name: 'Bloquear horario', exact: true })
  await expect(candado).toBeVisible()
  expect(await candado.evaluate(b => b.previousElementSibling?.hasAttribute('data-campana') ?? false)).toBe(true)
  await candado.click()
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloquear horario')
  await m.getByRole('button', { name: 'Cancelar' }).click()
  await expect(m).toBeHidden()
})

test('7 · pulsar la fila del bloqueo, lejos del texto, abre su edición con los datos', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  const fila = page.locator('.fc-list-event.ag-bloqueo', { hasText: MOTIVO })
  await fila.scrollIntoViewIfNeeded()
  const caja = await fila.boundingBox()
  if (!caja) throw new Error('la fila del bloqueo no se ve')
  await page.mouse.click(caja.x + caja.width - 12, caja.y + caja.height / 2)
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloqueo de horario')
  await expect(m.getByLabel('Hora de inicio')).toHaveValue('15:00')
  await expect(m.getByLabel('Hora de fin')).toHaveValue('17:00')
  await expect(m.getByLabel('Motivo')).toHaveValue(MOTIVO)
  await expect(m.getByRole('button', { name: 'Quitar bloqueo' })).toBeVisible()
  await m.getByRole('button', { name: 'Cancelar' }).click()
})
