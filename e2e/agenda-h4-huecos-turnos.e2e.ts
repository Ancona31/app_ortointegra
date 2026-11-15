import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaV2, burbuja } from './interaccionesAyudas'
import { marcaE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * H4 · punto 20 de Angel: en «Huecos disponibles» de la vista Día, cada hueco
 * se parte en turnos de la duración de la consulta del médico en ese
 * consultorio, con la MISMA rejilla fija del enlace de reserva (G2). Cada
 * turno es un botón que abre el alta a esa hora exacta.
 *
 * La invitada (un solo consultorio, Rehabilitación, 9:00–13:00 en la prueba)
 * con su consulta de 45 min: la rejilla es 9:00, 9:45, 10:30, 11:15, 12:00.
 * Una cita de 10:00 a 10:20 deja dos huecos (9:00–10:00 y 10:20–13:00): el
 * 9:45 la toca en parte y no sale.
 *
 * MUTACIONES que lo ponen en rojo (comprobadas): `turnosDelHueco` devolviendo
 * `null` (el panel enseña los tramos de hoy); `turnosEnTramo` sin el filtro de
 * «cabe entero» (sale el 9:45); el botón del turno pasando el hueco entero a
 * `onHueco` (la burbuja abre a las 10:20).
 *
 * Integración de la tanda H (dos ajustes): el turno abre la burbuja con la
 * DURACIÓN DE LA CONSULTA (11:15–12:00), no con 60 min; y con la duración
 * conocida un tramo libre de 55 min (10:20–11:15) ya es hueco y ofrece su
 * turno de 10:30. MUTACIONES (comprobadas en rojo sobre el build): `abrirHueco`
 * sin `duracionTurno` (la burbuja dice 11:15–12:15); `CardHuecos` llamando a
 * `huecosDelPanel` sin la duración (el tramo de 55 min no sale: 1 grupo, no 2).
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.medicoA })

const TZ = 'America/Merida'
const REHAB = 'Rehabilitación (ficticio)'
const NUEVE_A_UNA = `'{${['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  .map(d => `"${d}":{"activo":true,"inicio":"09:00","fin":"13:00"}`).join(',')},"domingo":{"activo":false,"inicio":"09:00","fin":"13:00"}}'::jsonb`

let desde = ''
let respaldo = ''
let dia = ''
let semana = 0

/** Un día laborable (semanas +2 a +7, fuera de la semilla) sin nada de la invitada de 9:00 a 13:00. */
function diaLibreDeLaInvitada(): { dia: string; semana: number } {
  for (let s = 2; s <= 7; s++) {
    for (let d = 0; d < 5; d++) {
      const f = diaDeLaSemana(s, d)
      const n = sqlLocal(`select count(*) from public.appointments a join auth.users u on u.id = a.medico_id
        where u.email = :'c' and a.start_time < :'h'::timestamptz and a.end_time > :'i'::timestamptz`,
      { c: CORREO.medicoA, i: fechaHoraLocalAInstante(f, '09:00', TZ), h: fechaHoraLocalAInstante(f, '13:00', TZ) })
      if (n === '0') return { dia: f, semana: s }
    }
  }
  throw new Error('la invitada no tiene ningún día libre en seis semanas')
}

test.beforeAll(() => {
  desde = marcaE2e()
  interruptorAgenda('A', true)
  respaldo = sqlLocal(`select horario_propio || '|' || horario::text from public.consultorios where nombre = :'n'`, { n: REHAB })
  sqlLocal(`update public.consultorios set horario_propio = true, horario = ${NUEVE_A_UNA} where nombre = :'n'`, { n: REHAB })
  ;({ dia, semana } = diaLibreDeLaInvitada())
  sqlLocal(`
    insert into public.appointments (clinica_id, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone, title,
                                     start_time, end_time, status, all_day, origen)
    select p.clinica_id, p.id, c.id, c.nombre, c.timezone, 'H4 e2e ocupa', :'i'::timestamptz, :'f'::timestamptz, 'scheduled', false, 'spinus'
      from public.profiles p join auth.users u on u.id = p.id join public.consultorios c on c.medico_id = p.id and c.nombre = :'n'
     where u.email = :'c'`,
  { c: CORREO.medicoA, n: REHAB, i: fechaHoraLocalAInstante(dia, '10:00', TZ), f: fechaHoraLocalAInstante(dia, '10:20', TZ) })
})

test.afterAll(() => {
  try {
    sqlLocal(`delete from public.appointments where title = 'H4 e2e ocupa' and created_at >= :'d'::timestamptz`, { d: desde })
    sqlLocal(`delete from public.tipos_cita where created_at >= :'d'::timestamptz
               and clinica_id = (select id from public.clinicas where nombre = 'Clínica Semilla A')`, { d: desde })
  } finally {
    const [propio = 'false', ...h] = respaldo.split('|')
    sqlLocal(`update public.consultorios set horario_propio = :'p'::boolean, horario = :'h'::jsonb where nombre = :'n'`,
      { n: REHAB, p: propio, h: h.join('|') })
    interruptorAgenda('A', false) // como el resto de las e2e: quien lo enciende, lo apaga (global-setup)
  }
})

/** La consulta de 45 min de la invitada (un tipo principal suyo). */
function consultaDe45(): void {
  sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal)
            select p.clinica_id, p.id, 'Consulta', 45, true from public.profiles p join auth.users u on u.id = p.id where u.email = :'c'`,
  { c: CORREO.medicoA })
}

/** La vista Día en `dia`: Semana, `semana` veces «›», Día y «›» hasta la fecha. */
async function abrirDia(page: Page): Promise<void> {
  await abrirAgendaV2(page)
  for (let i = 0; i < semana; i++) await page.locator('.fc-next-button').click()
  await page.getByRole('tab', { name: 'Día' }).click()
  for (let i = 0; i < 14; i++) {
    const actual = await page.locator('.fc-timegrid-col[data-date]').first().getAttribute('data-date')
    if (actual === dia) break
    await page.locator(actual && actual < dia ? '.fc-next-button' : '.fc-prev-button').click()
    await expect(page.locator('.fc-timegrid-col[data-date]').first()).not.toHaveAttribute('data-date', actual ?? '')
  }
  await expect(page.locator(`.fc-timegrid-col[data-date="${dia}"]`)).toBeVisible()
}

const huecos = (page: Page) => page.locator('section[aria-label="Huecos disponibles"]')

test('sin una duración clara (sin consulta principal y dos tipos), los huecos son los de hoy: un botón por tramo', async ({ page }) => {
  await abrirDia(page)
  await expect(huecos(page).locator('.ag-hueco').first()).toBeVisible()
  await expect(huecos(page).locator('[data-hueco-turnos]')).toHaveCount(0)
})

test('con la consulta de 45 min: cada hueco en turnos de la rejilla desde las 9:00; el 9:45, tocado en parte, no sale; el turno abre el alta a esa hora', async ({ page }) => {
  consultaDe45()
  await abrirDia(page)
  const grupos = huecos(page).locator('[data-hueco-turnos]')
  await expect(grupos).toHaveCount(2)
  await expect(grupos.nth(0).locator('.ag-hueco-rango')).toHaveText('09:00 – 10:00')
  await expect(grupos.nth(0).locator('[data-turno]')).toHaveText(['09:00'])
  await expect(grupos.nth(1).locator('.ag-hueco-rango')).toHaveText('10:20 – 13:00')
  await expect(grupos.nth(1).locator('[data-turno]')).toHaveText(['10:30', '11:15', '12:00'])
  await expect(huecos(page).locator('[data-turno="09:45"]')).toHaveCount(0)
  await expect(huecos(page).getByRole('button', { name: 'Agendar a las 11:15 (45 min)' })).toBeVisible()

  await huecos(page).locator('[data-turno="11:15"]').click()
  await expect(burbuja(page)).toHaveAccessibleName(/, 11:15–12:00$/)
})

test('con la consulta de 45 min, un tramo libre de 55 min (menos de 60) es hueco y su turno abre 10:30–11:15', async ({ page }) => {
  sqlLocal(`
    insert into public.appointments (clinica_id, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone, title,
                                     start_time, end_time, status, all_day, origen)
    select p.clinica_id, p.id, c.id, c.nombre, c.timezone, 'H4 e2e ocupa', :'i'::timestamptz, :'f'::timestamptz, 'scheduled', false, 'spinus'
      from public.profiles p join auth.users u on u.id = p.id join public.consultorios c on c.medico_id = p.id and c.nombre = :'n'
     where u.email = :'c'`,
  { c: CORREO.medicoA, n: REHAB, i: fechaHoraLocalAInstante(dia, '11:15', TZ), f: fechaHoraLocalAInstante(dia, '13:00', TZ) })
  await abrirDia(page)
  const grupos = huecos(page).locator('[data-hueco-turnos]')
  await expect(grupos).toHaveCount(2)
  await expect(grupos.nth(1).locator('.ag-hueco-rango')).toHaveText('10:20 – 11:15')
  await expect(grupos.nth(1).locator('[data-turno]')).toHaveText(['10:30'])
  await grupos.nth(1).locator('[data-turno="10:30"]').click()
  await expect(burbuja(page)).toHaveAccessibleName(/, 10:30–11:15$/)
})
