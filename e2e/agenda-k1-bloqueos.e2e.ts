import { test, expect, type Page } from '@playwright/test'
import { SESION, arrastrarEventoPorMinutos, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2, burbuja, clicEnFranja, elegirPaciente } from './interaccionesAyudas'

/**
 * K1 (tanda K, sección A) · El BLOQUEO DE HORARIO en la agenda, de punta a
 * punta en la UI (la base y el enlace de reserva los prueban
 * `supabase/pruebas-sql/k1_bloqueos.sql`, `scripts/reserva-carrera.sh` y
 * `reserva-seg1.e2e.ts`):
 *
 *   · 1: se crea desde «Agendar» (posición «Bloqueo») y desde la burbuja
 *     («Bloquear este horario»); se ve como una franja rayada con el motivo; se
 *     edita y se quita pulsando el rótulo.
 *   · 3: agendar desde la burbuja y mover una cita dentro de un bloqueo
 *     preguntan «Este horario está bloqueado. ¿Agendar de todos modos?»;
 *     «Cancelar» no guarda / devuelve la cita, «Aceptar» guarda.
 *   · 5: editar el bloqueo con una cita dentro no la toca y avisa cuántas hay.
 *   · Con la v2 apagada: ni la posición «Bloqueo» ni la franja.
 *
 * Todo en la SEMANA +3, jueves, de la clínica A (sin citas sembradas).
 *
 * MUTACIONES (cada una pone en rojo su prueba):
 *   · franja: en `bloqueoAEvento`, `display: 'auto'` (sale una tarjeta, no un fondo `.fc-bg-event`).
 *   · burbuja: en `useDependenciasGuardado`, quitar `bloqueado` (no pregunta).
 *   · arrastre: en `seguirSiNoSeEmpalma`, saltarse `tocaBloqueo` (no pregunta).
 *   · punto 5: en la ruta, `citas: 0` (no hay aviso).
 *   · v2 apagada: en `displayVivo`, devolver siempre `displayDeBloqueo` (se pinta).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

const JUEVES = diaDeLaSemana(3, 3)
const TEXTO = 'Este horario está bloqueado. ¿Agendar de todos modos?'
const MOTIVO = 'Congreso K1'

/* Integración K: sin `reserva_canal is null`, borraba también las reservas por enlace que `reserva-google`
   deja en ese día (no las limpia, a propósito) y la FK RESTRICT de `reserva_enlaces.usado_cita_id` lo
   abortaba. Este archivo no crea reservas: sólo borra lo suyo. */
function limpiar(): void {
  sqlLocal(`
    delete from public.agenda_bloqueos b using public.clinicas c
      where c.id = b.clinica_id and c.nombre = 'Clínica Semilla A' and (b.inicio at time zone 'America/Merida')::date = :'dia'::date;
    delete from public.appointments a using public.clinicas c
      where c.id = a.clinica_id and c.nombre = 'Clínica Semilla A' and (a.start_time at time zone 'America/Merida')::date = :'dia'::date
        and a.reserva_canal is null;`, { dia: JUEVES })
}

test.beforeAll(() => { limpiar(); interruptorAgenda('A', true) })
test.afterAll(() => { limpiar(); interruptorAgenda('A', false); interruptorAgenda('B', false) })

async function aLaSemanaMasTres(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${JUEVES}"]`)).toBeVisible()
}

function franja(page: Page) {
  return page.locator(`.fc-timegrid-col[data-date="${JUEVES}"] .fc-bg-event.ag-bloqueo`)
}

function filasBloqueo(): string {
  return sqlLocal(`select coalesce(motivo, '-') || '|' || case when todo_el_dia then 't' else 'f' end from public.agenda_bloqueos b join public.clinicas c on c.id = b.clinica_id
    where c.nombre = 'Clínica Semilla A' and (b.inicio at time zone 'America/Merida')::date = :'dia'::date order by inicio;`, { dia: JUEVES }).trim()
}

test('1 · desde «Agendar» → «Bloqueo»: franja rayada con el motivo, en la base y auditada', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await page.getByRole('button', { name: /Agendar/ }).first().click()
  await page.locator('[data-alta-bloqueo]').click()
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toBeVisible()
  await m.getByLabel('Fecha de inicio').fill(JUEVES)
  await m.getByLabel('Fecha de fin').fill(JUEVES)
  await m.getByLabel('Hora de inicio').fill('15:00')
  await m.getByLabel('Hora de fin').fill('17:00')
  await m.getByLabel('Motivo').fill(MOTIVO)
  await m.getByRole('button', { name: 'Guardar' }).click()
  await expect(m).toBeHidden()
  await expect(franja(page)).toHaveCount(1)
  await expect(franja(page)).toContainText(`Bloqueado · ${MOTIVO}`)
  const fondo = await franja(page).evaluate(e => getComputedStyle(e).backgroundImage)
  expect(fondo).toContain('repeating-linear-gradient')
  expect(filasBloqueo()).toBe(`${MOTIVO}|f`)
  expect(sqlLocal(`select count(*) from public.audit_log where tabla = 'agenda_bloqueos' and accion = 'INSERT' and created_at > now() - interval '2 minutes';`).trim()).not.toBe('0')
})

test('3 · la burbuja sobre el bloqueo pregunta; «Cancelar» no guarda, «Aceptar» sí', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, JUEVES, '15:30')
  const b = burbuja(page)
  await elegirPaciente(b, 'Prueba 11')
  await b.getByRole('button', { name: 'Guardar' }).click()
  const pregunta = page.getByRole('dialog', { name: TEXTO })
  await expect(pregunta).toBeVisible()
  await pregunta.getByRole('button', { name: 'Cancelar' }).click()
  await expect(b).toBeVisible()
  await b.getByRole('button', { name: 'Guardar' }).click()
  await page.getByRole('dialog', { name: TEXTO }).getByRole('button', { name: 'Aceptar' }).click()
  await expect.poll(() => sqlLocal(`select count(*) from public.appointments a join public.clinicas c on c.id = a.clinica_id
    where c.nombre = 'Clínica Semilla A' and (a.start_time at time zone 'America/Merida')::date = :'dia'::date and a.reserva_canal is null;`, { dia: JUEVES }).trim()).toBe('1')
})

test('3 · mover la cita dentro del bloqueo pregunta; «Cancelar» la devuelve', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  const cita = page.locator(`.fc-timegrid-col[data-date="${JUEVES}"] .fc-timegrid-event`).first()
  await expect(cita).toBeVisible()
  const inicio = (): string => sqlLocal(`select to_char(a.start_time at time zone 'America/Merida', 'HH24:MI') from public.appointments a
    join public.clinicas c on c.id = a.clinica_id
    where c.nombre = 'Clínica Semilla A' and (a.start_time at time zone 'America/Merida')::date = :'dia'::date and a.reserva_canal is null;`, { dia: JUEVES }).trim()
  expect(inicio()).toBe('15:30')
  await arrastrarEventoPorMinutos(page, cita, 30)
  const pregunta = page.getByRole('dialog', { name: TEXTO })
  await expect(pregunta).toBeVisible()
  await pregunta.getByRole('button', { name: 'Cancelar' }).click()
  await expect(pregunta).toBeHidden()
  await expect(cita).toContainText('15:30')
  expect(inicio()).toBe('15:30')
})

test('1 y 5 · editar desde el rótulo: la cita se queda y el aviso dice cuántas hay', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await franja(page).locator('[data-bloqueo-abrir]').click()
  const m = page.locator('[data-modal-bloqueo]')
  await expect(m).toContainText('Bloqueo de horario')
  await m.getByLabel('Motivo').fill('Junta K1')
  await m.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Hay 1 cita en este horario. Se queda como está.')).toBeVisible()
  await expect(franja(page)).toContainText('Bloqueado · Junta K1')
  expect(sqlLocal(`select string_agg(status, ',') from public.appointments a join public.clinicas c on c.id = a.clinica_id
    where c.nombre = 'Clínica Semilla A' and (a.start_time at time zone 'America/Merida')::date = :'dia'::date and a.reserva_canal is null;`, { dia: JUEVES }).trim()).toBe('scheduled')
})

test('1 · quitar desde el rótulo: la franja se va y la fila también', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await franja(page).locator('[data-bloqueo-abrir]').click()
  const m = page.locator('[data-modal-bloqueo]')
  await m.getByRole('button', { name: 'Quitar bloqueo' }).click()
  await m.getByRole('button', { name: 'Sí, quitar' }).click()
  await expect(franja(page)).toHaveCount(0)
  expect(filasBloqueo()).toBe('')
})

test('1 · desde la burbuja, días completos: franja en la banda y en la columna', async ({ page }) => {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, JUEVES, '09:00')
  await burbuja(page).locator('[data-burbuja-bloquear]').click()
  const m = page.locator('[data-modal-bloqueo]')
  await m.locator('[data-bloqueo-todo-el-dia]').check()
  await m.getByRole('button', { name: 'Guardar' }).click()
  await expect(m).toBeHidden()
  await expect(franja(page)).toHaveCount(1)
  await expect(page.locator(`.fc-daygrid-day[data-date="${JUEVES}"] .ag-bloqueo, .fc-timegrid-axis ~ td .ag-bloqueo`).first()).toBeVisible()
  expect(filasBloqueo()).toBe('-|t')
})

test('v2 apagada: ni la posición «Bloqueo» ni la franja', async ({ page }) => {
  interruptorAgenda('A', false)
  try {
    await abrirAgendaApagada(page)
    await aLaSemanaMasTres(page)
    await expect(page.locator('.fc-event.ag-bloqueo, .fc-bg-event.ag-bloqueo')).toHaveCount(0)
    await page.getByRole('button', { name: /Agendar|Nueva cita/ }).first().click()
    await expect(page.locator('[data-alta-bloqueo]')).toHaveCount(0)
  } finally {
    interruptorAgenda('A', true)
  }
})
