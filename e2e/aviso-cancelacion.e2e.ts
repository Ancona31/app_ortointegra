import { test, expect } from '@playwright/test'
import { interruptorAgenda, sqlLocal, soloEscritorio, SESION, tituloUnico, diaDeLaSemana, toastConTexto } from './ayudas'

/**
 * «Avisa a la clínica» (agenda E8, plan_E.md E10 caso 4, segunda mitad): con
 * la agenda del administrador abierta, el paciente cancela por el enlace y
 * sale «[Nombre] canceló su cita…» (con su nombre desde 2026-11-24, una sola burbuja); el panel «Por
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
  /* AG-DT-256: la cita va el JUEVES DE LA SEMANA SIGUIENTE a las 16:00, una fecha
     fija respecto de la corrida, y las pruebas pasan a esa semana. Antes iba a
     `now() + 3 h`: el domingo desde las 21:00 caía en la semana siguiente y no
     se veía. Siempre es futura, así que el paciente siempre está en plazo. */
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
                      (:'dia' || ' 16:00')::timestamp at time zone 'America/Merida',
                      (:'dia' || ' 16:30')::timestamp at time zone 'America/Merida',
                      'scheduled', 'America/Mexico_City'
               returning id, clinica_id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select gen_random_uuid(), a.clinica_id, a.id, :'hash', a.paciente_id from a
    returning appointment_id || '|' || clinica_id || '|' || paciente_id;`, { titulo, hash: HASH, dia: diaDeLaSemana(1, 3) })
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
  await page.locator('.fc-next-button').click()
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 15000 })
  sqlLocal(`
    begin;
    select set_config('request.jwt.claims', '{"role":"service_role"}', true);
    set local role service_role;
    select r_resultado from public.cita_confirmacion_responder(:'clinica', :'hash', 'cancelar');
    commit;`,
  { clinica: clinicaId, hash: HASH })
  /* Avisos globales (2026-11-24): la burbuja lleva el NOMBRE y sale de la campana (el aviso
     `cancelacion_paciente`), ya no de E8. EXACTAMENTE UNA: ni se pierde ni se duplica con la de antes. */
  const burbuja = toastConTexto(page, `${titulo} canceló su cita del`)
  await expect(burbuja).toBeVisible({ timeout: 10000 })
  await expect(burbuja).toHaveCount(1)
  await expect(page.getByText(/Un paciente canceló su cita/)).toHaveCount(0)
  // I5 (punto 19): la cancelación es un aviso de la pestaña «Avisos» de la campana.
  await page.locator('[data-por-confirmar]').click()
  await page.getByRole('dialog', { name: 'Por confirmar y avisos' }).getByRole('tab', { name: /^Avisos/ }).click()
  await expect(page.locator(`[data-aviso-tipo="cancelacion_paciente"][data-aviso-cita="${citaId}"]`)).toBeVisible()
})

test('una cancelación del personal no avisa', async ({ page }) => {
  sqlLocal(`update public.appointments set status = 'scheduled' where id = :'id';`, { id: citaId })
  await page.goto('/agenda')
  await page.locator('.fc-next-button').click()
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 15000 })
  // Como postgres, sin pasar por el enlace: la respuesta guardada ya tiene más de 2 min o es la anterior.
  sqlLocal(`update public.cita_confirmaciones set respondido_en = now() - interval '10 minutes' where appointment_id = :'id';
            update public.appointments set status = 'cancelled' where id = :'id';`, { id: citaId })
  await page.waitForTimeout(3000)
  await expect(page.getByText(/canceló su cita/)).toHaveCount(0)
})
