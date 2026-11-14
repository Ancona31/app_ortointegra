import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { interruptorAgenda, irAAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { contarCorreos, esperarCorreo } from './mailpit'
import { limpiarReservasE2e } from './reservaAyudas'
import { aprobarAviso, emitirEnlace, personaNueva, reservar, type Escenario, type Turno, api } from './reservaPublicaAyudas'
import { hoyEnTZ, desplazarFecha } from '../src/lib/dates'

/**
 * Tanda T2 · punto 11: un médico (Dr. Admin, dispositivo en Mérida) con un
 * segundo consultorio en Tijuana (UTC-8 en noviembre; Mérida es UTC-6). Su
 * horario propio abre todos los días de 09:00 a 11:00, hora de Tijuana.
 *
 *   · turnos del enlace: el primero es a las 09:00 de Tijuana;
 *   · comprobante y recordatorio (Mailpit): «09:00», con la zona;
 *   · página de confirmación: «09:00 h» con la etiqueta del Pacífico;
 *   · la agenda: FullCalendar dibuja en la hora del dispositivo, así que la
 *     tarjeta sale a las 11:00 con la etiqueta «09:00 hora Baja California».
 *     NO se cambia (decisión del punto 11); queda documentado en las notas.
 *
 * Requiere CRON_SECRET (sólo de prueba) y RESERVA_SECRETO en `.env.local`.
 * Lo que crea se borra al terminar como `postgres` (citas, enlaces y el
 * consultorio de Tijuana, con sus filas de auditoría).
 */
config({ path: resolve(process.cwd(), '.env.local'), quiet: true })
const CRON = process.env.CRON_SECRET ?? ''

soloEscritorio()
test.describe.configure({ mode: 'serial' })
test.skip(CRON === '', 'Falta CRON_SECRET (sólo de prueba) en .env.local')

const TIJUANA = 'America/Tijuana'
const NOMBRE = 'Consultorio Tijuana (e2e)'
const DIA = { activo: true, inicio: '09:00', fin: '11:00' }
const HORARIO = JSON.stringify(Object.fromEntries(
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(d => [d, DIA])))

let e: Escenario
/** Un paciente del médico; su correo se cambia para la prueba y se devuelve al terminar. */
const paciente = { id: '', email: '' }
let codigo = ''
let ajustesAntes = ''
const persona = personaNueva()
const horaEn = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso))

test.use({ storageState: 'e2e/.auth/admin-a.json', timezoneId: 'America/Merida' })

test.beforeAll(() => {
  limpiarReservasE2e()
  interruptorAgenda('A', true)
  aprobarAviso(true)
  ajustesAntes = sqlLocal(`select recordatorio_horas from public.agenda_ajustes where clinica_id = (select id from public.clinicas where nombre = 'Clínica Semilla A')`)
  const fila = sqlLocal(`
    with c as (select id from public.clinicas where nombre = 'Clínica Semilla A'),
         m as (select p.id from public.profiles p join auth.users u on u.id = p.id where u.email = 'admin.a@semilla.spinus.test'),
         k as (insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, timezone, horario, horario_propio)
               select c.id, m.id, :'n', 'Tijuana', 'Av. Revolución 1, Tijuana', :'tz', :'h'::jsonb, true from c, m returning id),
         t as (insert into public.tipos_cita (clinica_id, nombre, duracion_min, activo) select c.id, 'Consulta T2 husos', 30, true from c returning id)
    select (select id from c), (select id from m), (select id from k), (select id from t);`, { n: NOMBRE, tz: TIJUANA, h: HORARIO })
  const [clinicaId = '', medicoId = '', consultorioId = '', tipoId = ''] = fila.split('|')
  sqlLocal(`update public.agenda_ajustes set recordatorio_horas = 72 where clinica_id = :'c'`, { c: clinicaId })
  e = { clinicaId, medicoId, consultorioId, consultorioTelefono: null, consultorioOtraClinica: '', tipoId, tipoNombre: 'Consulta T2 husos' }
  codigo = emitirEnlace(e, 'unico').codigo
  /* Uno sin citas en los próximos 4 días: así el único recordatorio que recibe es el de esta prueba. */
  const p = sqlLocal(`select id || '|' || coalesce(email, '') from public.pacientes x where clinica_id = :'c' and medico_id = :'m' and activo
                        and not exists (select 1 from public.appointments a where a.paciente_id = x.id
                                          and a.start_time between now() and now() + interval '4 days')
                       order by created_at limit 1`, { c: clinicaId, m: medicoId })
  ;[paciente.id = '', paciente.email = ''] = p.split('|')
})

test.afterAll(() => {
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    create temp table _a on commit drop as select id from public.appointments where consultorio_id = :'k';
    delete from public.audit_log where registro_id in (select id from _a) or registro_id = :'k'::uuid or registro_id = :'t'::uuid;
    delete from public.audit_log where registro_id in (select id from public.cita_confirmaciones where appointment_id in (select id from _a));
    delete from public.cita_correos where appointment_id in (select id from _a);
    delete from public.cita_confirmaciones where appointment_id in (select id from _a);
    delete from public.reserva_incidencias where appointment_id in (select id from _a);
    update public.reserva_enlaces set usado_en = null, usado_cita_id = null where usado_cita_id in (select id from _a);
    delete from public.appointments where id in (select id from _a);
    delete from public.consultorios where id = :'k';
    delete from public.tipos_cita where id = :'t';
    commit;`, { k: e.consultorioId, t: e.tipoId })
  limpiarReservasE2e()
  if (paciente.id) sqlLocal(`update public.pacientes set email = nullif(:'e', '') where id = :'p'`, { e: paciente.email, p: paciente.id })
  sqlLocal(`update public.agenda_ajustes set recordatorio_horas = :'h'::int where clinica_id = :'c'`, { h: ajustesAntes || '24', c: e.clinicaId })
  interruptorAgenda('A', false)
})

let turno: Turno

test('turnos del enlace en el consultorio de Tijuana: empiezan a las 09:00 de Tijuana', async () => {
  const ctx = await api()
  try {
    const desde = desplazarFecha(hoyEnTZ(TIJUANA), { dias: 1 })
    const r = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioId}&tipo=${e.tipoId}&desde=${desde}`)
    expect(r.status()).toBe(200)
    const datos: { dias: { fecha: string; turnos: Turno[] }[] } = await r.json()
    const todos = datos.dias.flatMap(d => d.turnos)
    /* Todos caen entre las 09:00 y las 10:30 de Tijuana (el horario propio, 09–11, en su zona). */
    expect(todos.length).toBeGreaterThan(0)
    for (const t of todos) expect(['09:00', '09:30', '10:00', '10:30']).toContain(horaEn(t.inicio, TIJUANA))
    /* El primero de las 09:00 (la semilla puede ocupar alguno: las citas del médico en Mérida cuentan). */
    const primero = todos.find(t => horaEn(t.inicio, TIJUANA) === '09:00')
    if (!primero) throw new Error('El consultorio de Tijuana no ofreció ningún turno de las 09:00')
    turno = primero
  } finally {
    await ctx.dispose()
  }
  expect(horaEn(turno.inicio, 'America/Merida')).toBe('11:00')
})

test('comprobante y recordatorio con la hora de Tijuana; la confirmación dice «09:30 h» del Pacífico', async ({ page }) => {
  const previosComprobante = await contarCorreos(persona.correo, 'Tu cita con')
  expect((await reservar(e, codigo, { inicio: turno.inicio, persona })).status).toBe(201)
  const comprobante = await esperarCorreo(persona.correo, 'Tu cita con', previosComprobante)
  expect(comprobante.texto).toContain('09:00 h')

  /* El recordatorio no sale si ya salió el comprobante de esa misma hora (E4), así
     que se prueba con otra cita del mismo consultorio, media hora después, de un
     paciente con correo (creada como postgres: lo que se prueba es la tarea). */
  const correoPaciente = `husos-${Date.now().toString(36)}@t2.test`
  const media = new Date(Date.parse(turno.inicio) + 30 * 60_000).toISOString()
  sqlLocal(`update public.pacientes set email = :'e' where id = :'p'`, { e: correoPaciente, p: paciente.id })
  sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status, all_day,
                                     consultorio_timezone, consultorio_nombre, consultorio_direccion)
    values (:'c', :'p', :'m', :'k', 'Cita husos T2', :'i'::timestamptz, :'i'::timestamptz + interval '30 minutes', 'scheduled', false,
            :'tz', :'n', 'Av. Revolución 1, Tijuana')`,
  { c: e.clinicaId, p: paciente.id, m: e.medicoId, k: e.consultorioId, i: media, tz: TIJUANA, n: NOMBRE })
  const previos = await contarCorreos(correoPaciente, 'Recordatorio: tu cita del')
  const cron = await page.request.get('/api/cron/recordatorios', { headers: { authorization: `Bearer ${CRON}` } })
  expect(cron.status()).toBe(200)
  const recordatorio = await esperarCorreo(correoPaciente, 'Recordatorio: tu cita del', previos)
  expect(recordatorio.texto).toContain('a las 09:30 (zona horaria: Baja California)')

  const enlace = recordatorio.texto.match(/\/confirmar\/([A-Za-z0-9_-]{22})/)?.[1]
  expect(enlace).toBeTruthy()
  await page.goto(`/confirmar/${enlace}`)
  await expect(page.getByText(/09:30 h/)).toBeVisible()
  await expect(page.getByText(/Pacífico/)).toBeVisible()
})

test('la agenda (dispositivo en Mérida) la dibuja a las 11:00 con la etiqueta «09:00 hora Baja California»', async ({ page }) => {
  await irAAgenda(page)
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Merida' }).format(new Date(turno.inicio))
  if (!(await page.locator(`.fc-timegrid-col[data-date="${dia}"]`).count())) {
    await page.getByRole('button', { name: 'Periodo siguiente' }).click()
  }
  const tarjeta = page.locator('.fc-timegrid-event', { hasText: '09:00 hora Baja California' })
  await expect(tarjeta).toBeVisible()
  await expect(tarjeta).toContainText('11:00')
  const lane = await page.locator('td.fc-timegrid-slot-lane[data-time="11:00:00"]').boundingBox()
  const caja = await tarjeta.boundingBox()
  expect(Math.abs((caja?.y ?? 0) - (lane?.y ?? -100))).toBeLessThanOrEqual(3)
})
