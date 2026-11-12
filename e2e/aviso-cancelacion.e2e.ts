import { test, expect } from '@playwright/test'
import { interruptorAgenda, sqlLocal, soloEscritorio, SESION, tituloUnico } from './ayudas'

/**
 * «Avisa a la clínica» (agenda E8, plan_E.md E10 caso 4, segunda mitad): con
 * la agenda del administrador abierta, el paciente cancela por el enlace y
 * sale «Un paciente canceló su cita…» (sin su nombre); el panel «Por
 * confirmar» lo lista en «Canceladas por el paciente (48 h)».
 *
 * La cancelación del paciente se hace como la haría el POST público de E3
 * (otra rama): `cita_confirmacion_responder` como `service_role`, sobre un
 * enlace emitido por SQL. Lo que se prueba aquí es el aviso, no la página.
 *
 * ESCRITA, NO CORRIDA en E8 (otro agente usa el servidor local a la vez).
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.adminA })

let citaId = ''
let clinicaId = ''
let pacienteId = ''
let titulo = ''
const HASH = 'e8'.repeat(32)

test.beforeAll(() => {
  interruptorAgenda('A', true)
  titulo = tituloUnico('Cancela E8')
  // Una cita de esta semana a +3 h (se ve en la vista Semana) con paciente y su enlace.
  const fila = sqlLocal(`
    with c as (select id from public.clinicas where nombre = 'Clínica Semilla A'),
         m as (select p.id from public.profiles p where p.clinica_id = (select id from c) and p.es_admin_de_clinica limit 1),
         -- Un paciente propio con el título por nombre: la tarjeta de una cita con paciente pinta el
         -- NOMBRE del paciente, no el título de la cita (con uno de la semilla, la tarjeta no se encontraba).
         p as (insert into public.pacientes (clinica_id, nombre, apellidos)
               select (select id from c), :'titulo', 'E8' returning id),
         a as (insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                                consultorio_timezone)
               select (select id from c), (select id from p), (select id from m), :'titulo',
                      date_trunc('hour', now()) + interval '3 hours', date_trunc('hour', now()) + interval '3 hours 30 min',
                      'scheduled', 'America/Mexico_City'
               returning id, clinica_id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select gen_random_uuid(), a.clinica_id, a.id, :'hash', a.paciente_id from a
    returning appointment_id || '|' || clinica_id || '|' || paciente_id;`, { titulo, hash: HASH })
  ;[citaId = '', clinicaId = '', pacienteId = ''] = fila.split('|')
})
test.afterAll(() => {
  sqlLocal(`
    delete from public.cita_confirmaciones where appointment_id = :'id';
    delete from public.appointments where id = :'id';
    delete from public.pacientes where id = :'p';`, { id: citaId, p: pacienteId })
  interruptorAgenda('A', false)
})

test('el paciente cancela por el enlace: aviso en la agenda abierta y fila en el panel', async ({ page }) => {
  await page.goto('/agenda')
  await expect(page.locator('[data-agenda-v2="encendida"]')).toBeVisible()
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 15000 })
  sqlLocal(`
    begin;
    select set_config('request.jwt.claims', '{"role":"service_role"}', true);
    set local role service_role;
    select r_resultado from public.cita_confirmacion_responder(:'clinica', :'hash', 'cancelar');
    commit;`,
  { clinica: clinicaId, hash: HASH })
  await expect(page.getByText(/Un paciente canceló su cita del/)).toBeVisible({ timeout: 10000 })
  expect(await page.getByText(/Un paciente canceló su cita del/).first().textContent()).not.toContain(titulo)
  await page.locator('[data-por-confirmar]').click()
  await expect(page.locator(`[data-fila-cancelada="${citaId}"]`)).toBeVisible()
})

test('una cancelación del personal no avisa', async ({ page }) => {
  sqlLocal(`update public.appointments set status = 'scheduled' where id = :'id';`, { id: citaId })
  await page.goto('/agenda')
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 15000 })
  // Como postgres, sin pasar por el enlace: la respuesta guardada ya tiene más de 2 min o es la anterior.
  sqlLocal(`update public.cita_confirmaciones set respondido_en = now() - interval '10 minutes' where appointment_id = :'id';
            update public.appointments set status = 'cancelled' where id = :'id';`, { id: citaId })
  await page.waitForTimeout(3000)
  await expect(page.getByText(/Un paciente canceló su cita/)).toHaveCount(0)
})
