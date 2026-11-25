import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { CORREO, SESION, diaDeLaSemana, enContextoNuevo, interruptorAgenda, selectFiltroMedico, soloEscritorio, sqlLocal, arrastrarEventoPorMinutos } from './ayudas'
import { abrirAgendaV2, arrastrarFranjas, burbuja, clicEnFranja } from './interaccionesAyudas'
import { limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { api, cerrarEscenario, emitirEnlace, personaNueva, prepararEscenario, type Escenario, type Turno } from './reservaPublicaAyudas'
import { desplazarFecha, fechaHoraLocalAInstante, hoyEnTZ } from '../src/lib/dates'

/**
 * G2 · punto 9 de Angel: TURNOS EN REJILLA FIJA.
 *
 *   · El enlace ofrece los turnos desde la hora de apertura del consultorio,
 *     con paso igual a la duración: con 45 min desde las 9:00, 9:00, 9:45,
 *     10:30… Si algo ocupa PARTE de un turno, ese turno no se ofrece (P9, que
 *     contaba desde el inicio de cada hueco, ofrecía 10:20 tras una cita de
 *     10:00 a 10:20; ya no).
 *   · La comprobación al reservar usa la misma regla que la lista: fuera de la
 *     rejilla, 400; en la rejilla pero ocupado, 409 (la RPC); libre, 201.
 *   · En la agenda, el clic en un hueco, la selección (burbuja) y el arrastre
 *     de una cita caen en el turno más cercano de la rejilla del médico en ese
 *     consultorio; la hora escrita a mano se respeta.
 *
 * MUTACIONES que ponen esto en rojo: `tocaAlgo` de `turnosAgenda.ts` siempre
 * `false` (la lista ofrece 9:45 con la cita de 10:00 encima); `ajustar` de
 * `altaCitas.ts` devolviendo la hora tal cual (la burbuja abre a las 10:00);
 * `ajustarArrastre` de `guardadoCitas.ts` vacío (la cita se queda a las 14:00).
 */
soloEscritorio()

const TZ = 'America/Merida'
const REHAB = 'Rehabilitación (ficticio)'
const NUEVE_A_UNA = (inicio: string, fin: string) => `'{${['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  .map(d => `"${d}":{"activo":true,"inicio":"${inicio}","fin":"${fin}"}`).join(',')},"domingo":{"activo":false,"inicio":"${inicio}","fin":"${fin}"}}'::jsonb`

let desde = ''
const respaldos: { id: string; propio: string; horario: string }[] = []

function guardarHorario(where: string, v: Record<string, string>): void {
  for (const fila of sqlLocal(`select id || '|' || horario_propio || '|' || horario::text from public.consultorios where ${where}`, v).split('\n').filter(Boolean)) {
    const [id = '', propio = '', ...h] = fila.split('|')
    // Sólo la primera vez: la segunda ya vería el horario que puso la prueba.
    if (!respaldos.some(r => r.id === id)) respaldos.push({ id, propio, horario: h.join('|') })
  }
}

test.beforeAll(() => { desde = marcaE2e() })
test.afterAll(() => {
  try { limpiarReservasE2e(desde) } finally {
    sqlLocal(`delete from public.appointments where title like 'G2 e2e %' and created_at >= :'d'::timestamptz`, { d: desde })
    sqlLocal(`delete from public.tipos_cita where created_at >= :'d'::timestamptz
               and clinica_id = (select id from public.clinicas where nombre = 'Clínica Semilla A')`, { d: desde })
    for (const r of respaldos) {
      sqlLocal(`update public.consultorios set horario_propio = :'p'::boolean, horario = :'h'::jsonb where id = :'id'`, { id: r.id, p: r.propio, h: r.horario })
    }
    cerrarEscenario()
  }
})

/** La hora de pared (`HH:MM`) de un instante en Mérida. */
const hora = (iso: string) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))

async function diasDeTurnos(e: Escenario, codigo: string, tipoId: string, desdeFecha: string): Promise<{ fecha: string; turnos: Turno[] }[]> {
  const ctx = await api()
  try {
    const r = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioId}&tipo=${tipoId}&desde=${desdeFecha}`)
    expect(r.status()).toBe(200)
    return (await r.json()).dias
  } finally { await ctx.dispose() }
}

async function postReserva(e: Escenario, codigo: string, tipoId: string, inicio: string): Promise<{ status: number; error: unknown }> {
  const ctx = await api()
  try {
    const p = personaNueva()
    const r = await ctx.post(`/api/reservar/${codigo}`, { data: {
      consultorio_id: e.consultorioId, tipo_cita_id: tipoId, inicio, nombre: p.nombre, telefono: p.telefono, correo: p.correo,
      acepta_aviso: true, client_id: randomUUID() } })
    return { status: r.status(), error: (await r.json().catch(() => ({}))).error }
  } finally { await ctx.dispose() }
}

test('reserva: rejilla fija de 45 min desde las 9:00; lo ocupado en parte no se ofrece; la lista y el POST dicen lo mismo', async () => {
  const e = prepararEscenario()
  guardarHorario(`id = :'k'`, { k: e.consultorioId })
  sqlLocal(`update public.consultorios set horario_propio = true, horario = ${NUEVE_A_UNA('09:00', '13:00')} where id = :'k'`, { k: e.consultorioId })
  const tipo45 = sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal)
                           values (:'c', :'m', 'Consulta', 45, true) returning id`, { c: e.clinicaId, m: e.medicoId })
  const { codigo } = emitirEnlace(e, 'unico')

  /* Un día sin nada del médico (las 5 de la rejilla libres), cinco semanas adelante (más allá de la semilla). */
  const dias = await diasDeTurnos(e, codigo, tipo45, desplazarFecha(hoyEnTZ(TZ), { dias: 35 }))
  const REJILLA = ['09:00', '09:45', '10:30', '11:15', '12:00']
  const libre = dias.find(d => d.turnos.map(t => hora(t.inicio)).join() === REJILLA.join())
  expect(libre, 'ningún día libre en la semana +5').toBeTruthy()
  for (const d of dias) for (const t of d.turnos) expect(REJILLA).toContain(hora(t.inicio))
  const D = libre!.fecha

  /* Una cita de 10:00 a 10:20 tapa EN PARTE el turno de 9:45. */
  sqlLocal(`insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, all_day, consultorio_timezone)
            values (:'c', :'m', 'G2 e2e ocupa', :'i'::timestamptz, :'f'::timestamptz, 'scheduled', false, :'tz')`,
  { c: e.clinicaId, m: e.medicoId, i: fechaHoraLocalAInstante(D, '10:00', TZ), f: fechaHoraLocalAInstante(D, '10:20', TZ), tz: TZ })
  const [conCita] = await diasDeTurnos(e, codigo, tipo45, D)
  expect(conCita?.turnos.map(t => hora(t.inicio))).toEqual(['09:00', '10:30', '11:15', '12:00'])

  /* La misma regla al reservar: 10:20 (el turno de P9) no es de la rejilla → 400;
     9:45 sí lo es pero está ocupado → 409 de la RPC; 10:30 → 201. */
  expect(await postReserva(e, codigo, tipo45, fechaHoraLocalAInstante(D, '10:20', TZ))).toEqual({ status: 400, error: 'turno_invalido' })
  expect(await postReserva(e, codigo, tipo45, fechaHoraLocalAInstante(D, '09:45', TZ))).toEqual({ status: 409, error: 'turno_ocupado' })
  expect((await postReserva(e, codigo, tipo45, fechaHoraLocalAInstante(D, '10:30', TZ))).status).toBe(201)
  expect(sqlLocal(`select to_char(end_time at time zone :'tz', 'HH24:MI') from public.appointments
                    where reserva_enlace_id is not null and medico_id = :'m' and start_time = :'i'::timestamptz`,
  { tz: TZ, m: e.medicoId, i: fechaHoraLocalAInstante(D, '10:30', TZ) })).toBe('11:15')
})

/* ── La agenda: el ajuste al turno (la invitada, su único consultorio, 45 min desde las 9:00) ── */

/** Un día laborable (semanas +2 a +7) en que la invitada no tiene nada de 9:00 a 17:00, y su semana. */
function diaLibreDeLaInvitada(): { dia: string; semana: number } {
  for (let semana = 2; semana <= 7; semana++) {
    for (let d = 0; d < 5; d++) {
      const f = diaDeLaSemana(semana, d)
      const n = sqlLocal(`select count(*) from public.appointments a join auth.users u on u.id = a.medico_id
        where u.email = :'c' and a.start_time < :'h'::timestamptz and a.end_time > :'i'::timestamptz`,
      { c: CORREO.medicoA, i: fechaHoraLocalAInstante(f, '09:00', TZ), h: fechaHoraLocalAInstante(f, '17:00', TZ) })
      if (n === '0') return { dia: f, semana }
    }
  }
  throw new Error('la invitada no tiene ningún día libre en seis semanas')
}

async function aLaSemana(page: Page, semana: number, fecha: string): Promise<void> {
  for (let i = 0; i < semana; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${fecha}"]`)).toBeVisible()
}

function prepararInvitada(): void {
  interruptorAgenda('A', true)
  guardarHorario(`nombre = :'n'`, { n: REHAB })
  sqlLocal(`update public.consultorios set horario_propio = true, horario = ${NUEVE_A_UNA('09:00', '17:00')} where nombre = :'n'`, { n: REHAB })
  sqlLocal(`delete from public.tipos_cita where created_at >= :'d'::timestamptz and principal
              and medico_id = (select id from auth.users where email = :'c')`, { d: desde, c: CORREO.medicoA })
  sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal)
            select p.clinica_id, p.id, 'Consulta', 45, true from public.profiles p join auth.users u on u.id = p.id where u.email = :'c'`,
  { c: CORREO.medicoA })
}

test('agenda: el clic y la selección caen en el turno más cercano; la hora escrita a mano se respeta', async ({ browser }) => {
  prepararInvitada()
  const { dia, semana } = diaLibreDeLaInvitada()
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await abrirAgendaV2(p)
    await aLaSemana(p, semana, dia)
    /* 10:00 → 9:45 (a 15 min) y no 10:30 (a 30). */
    await clicEnFranja(p, dia, '10:00')
    const b = burbuja(p)
    await expect(b).toHaveAccessibleName(/ 09:45–/)
    /* No es regla dura: lo escrito a mano se queda como está. */
    await b.getByLabel('Inicio').fill('10:00')
    await expect(b.getByLabel('Inicio')).toHaveValue('10:00')
    await expect(b).toHaveAccessibleName(/ 10:00–/)
    await p.keyboard.press('Escape')
    await expect(b).toHaveCount(0)
    /* Seleccionar 11:00–12:00 se corre entero al turno de 11:15. */
    await arrastrarFranjas(p, dia, '11:00', '11:30')
    await expect(burbuja(p)).toHaveAccessibleName(/ 11:15–12:15$/)
  })
})

test('agenda: arrastrar una cita la deja en el turno más cercano de su consultorio', async ({ browser }) => {
  prepararInvitada()
  const { dia, semana } = diaLibreDeLaInvitada()
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone, title,
                                     start_time, end_time, status, all_day, origen)
    select p.clinica_id, p.id, c.id, c.nombre, c.timezone, 'G2 e2e arrastre', :'i'::timestamptz, :'f'::timestamptz, 'scheduled', false, 'spinus'
      from public.profiles p join auth.users u on u.id = p.id join public.consultorios c on c.medico_id = p.id and c.nombre = :'n'
     where u.email = :'c' returning id`,
  { c: CORREO.medicoA, n: REHAB, i: fechaHoraLocalAInstante(dia, '13:00', TZ), f: fechaHoraLocalAInstante(dia, '13:45', TZ) })
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await abrirAgendaV2(p)
    await aLaSemana(p, semana, dia)
    const evento = p.locator(`.fc-timegrid-col[data-date="${dia}"] .fc-timegrid-event`, { hasText: 'G2 e2e arrastre' })
    const put = p.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
    /* 13:00 + 60 = 14:00 → 14:15 (a 15 min; 13:30 queda a 30). */
    await arrastrarEventoPorMinutos(p, evento, 60)
    expect((await put).status()).toBe(200)
  })
  expect(sqlLocal(`select to_char(start_time at time zone :'tz', 'HH24:MI') || '-' || to_char(end_time at time zone :'tz', 'HH24:MI')
                     from public.appointments where id = :'id'`, { id, tz: TZ })).toBe('14:15-15:00')
})

/* Integración G1–G4 · el ajuste al turno lee los MISMOS consultorios que la
   rejilla de G4 (los del servidor): el administrador, con «Todos los médicos»,
   también ve el consultorio de la invitada y su arrastre cae en la rejilla de
   ELLA (antes no se ajustaba: la RLS de `consultorios` no le enseñaba los de
   otros médicos). MUTACIÓN: `useAjusteTurno` con los consultorios de la sesión
   (`config.consultorios`) en vez de `consultoriosV2` → la cita queda a las
   14:00. */
test('agenda: el administrador arrastra la cita de la invitada y cae en el turno de SU rejilla', async ({ browser }) => {
  prepararInvitada()
  const { dia, semana } = diaLibreDeLaInvitada()
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone, title,
                                     start_time, end_time, status, all_day, origen)
    select p.clinica_id, p.id, c.id, c.nombre, c.timezone, 'G2 e2e arrastre admin', :'i'::timestamptz, :'f'::timestamptz, 'scheduled', false, 'spinus'
      from public.profiles p join auth.users u on u.id = p.id join public.consultorios c on c.medico_id = p.id and c.nombre = :'n'
     where u.email = :'c' returning id`,
  { c: CORREO.medicoA, n: REHAB, i: fechaHoraLocalAInstante(dia, '13:00', TZ), f: fechaHoraLocalAInstante(dia, '13:45', TZ) })
  await enContextoNuevo(browser, SESION.adminA, async (p) => {
    await abrirAgendaV2(p)
    await selectFiltroMedico(p).selectOption('')
    await aLaSemana(p, semana, dia)
    const evento = p.locator(`.fc-timegrid-col[data-date="${dia}"] .fc-timegrid-event`, { hasText: 'G2 e2e arrastre admin' })
    const put = p.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
    await arrastrarEventoPorMinutos(p, evento, 60)
    expect((await put).status()).toBe(200)
  })
  expect(sqlLocal(`select to_char(start_time at time zone :'tz', 'HH24:MI') || '-' || to_char(end_time at time zone :'tz', 'HH24:MI')
                     from public.appointments where id = :'id'`, { id, tz: TZ })).toBe('14:15-15:00')
})
