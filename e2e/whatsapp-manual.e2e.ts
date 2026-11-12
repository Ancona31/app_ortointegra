import { test, expect } from '@playwright/test'
import { interruptorAgenda, sqlLocal, soloEscritorio, SESION, tituloUnico } from './ayudas'

/**
 * WhatsApp MANUAL (agenda E7, plan_E.md E10 caso 10). Sin salir de local: la
 * navegación a wa.me se intercepta con `page.route` y se responde vacía.
 *
 * Comprueba: el botón de la lista lleva `https://wa.me/521` + 10 dígitos con el
 * texto (`/confirmar/`, sin el título); pulsarlo escribe
 * `whatsapp_reminder_sent_at` y no cambia `updated_at` (el botón del modal, `whatsapp_sent_at`, lo cubre whatsappRuta.test.ts);
 * una cita
 * confirmada ya no sale; apagado, ni botón ni lista.
 *
 * Requiere en .env.local RESERVA_SECRETO (el enlace de confirmación).
 * ESCRITA, NO CORRIDA en E7 (otro agente usa el servidor local a la vez).
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.adminA })

let citaId = ''
let titulo = ''

test.beforeAll(() => {
  interruptorAgenda('A', true)
  titulo = tituloUnico('WhatsApp E7')
  // Una cita de MAÑANA a las 10:00 (zona del consultorio), con paciente con teléfono.
  citaId = sqlLocal(`
    with c as (select id from public.clinicas where nombre = 'Clínica Semilla A'),
         m as (select p.id from public.profiles p where p.clinica_id = (select id from c) and p.es_admin_de_clinica limit 1),
         p as (select id from public.pacientes where clinica_id = (select id from c) and activo order by created_at limit 1),
         u as (update public.pacientes set telefono = '5512345678' where id = (select id from p) returning id),
         d as (select ((date_trunc('day', now() at time zone 'America/Mexico_City') + interval '1 day 10 hours')
                       at time zone 'America/Mexico_City') as t)
    insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                     consultorio_timezone, consultorio_nombre)
    select (select id from c), (select id from u), (select id from m), :'titulo', d.t, d.t + interval '30 min',
           'scheduled', false, 'America/Mexico_City', 'Consultorio E7' from d
    returning id;`, { titulo })
})
test.afterAll(() => {
  sqlLocal(`
    delete from public.cita_confirmaciones where appointment_id = :'id';
    delete from public.appointments where id = :'id';`, { id: citaId })
  interruptorAgenda('A', false)
})

test('la lista de mañana: wa.me/521 + 10 dígitos, texto sin título; pulsar marca whatsapp_reminder_sent_at sin tocar updated_at', async ({ page }) => {
  await page.route('https://wa.me/**', (r) => r.fulfill({ status: 200, body: '' }))
  const antes = sqlLocal(`select updated_at from public.appointments where id = :'id';`, { id: citaId })
  await page.goto('/agenda')
  await page.locator('[data-por-confirmar]').click()
  const fila = page.locator(`[data-fila-por-confirmar="${citaId}"]`)
  await expect(fila).toBeVisible()
  const enlace = fila.locator('a[href^="https://wa.me/"]')
  await expect(enlace).toBeVisible()
  const href = (await enlace.getAttribute('href')) ?? ''
  expect(href).toMatch(/^https:\/\/wa\.me\/521\d{10}\?text=/)
  const texto = decodeURIComponent(new URL(href).searchParams.get('text') ?? '')
  expect(texto).toContain('/confirmar/')
  expect(texto).not.toContain(titulo)
  const [popup] = await Promise.all([page.waitForEvent('popup'), enlace.click()])
  await popup.close()
  await expect(fila.getByText(/Abierto en WhatsApp/)).toBeVisible()
  await expect.poll(() => sqlLocal(`select whatsapp_reminder_sent_at is not null from public.appointments where id = :'id';`, { id: citaId })).toBe('t')
  expect(sqlLocal(`select updated_at from public.appointments where id = :'id';`, { id: citaId })).toBe(antes)
})

test('confirmada sale de la lista', async ({ page }) => {
  sqlLocal(`update public.appointments set status = 'confirmed' where id = :'id';`, { id: citaId })
  await page.goto('/agenda')
  await page.locator('[data-por-confirmar]').click()
  await expect(page.getByText(/Citas de mañana por confirmar/)).toBeVisible()
  await expect(page.locator(`[data-fila-por-confirmar="${citaId}"]`)).toHaveCount(0)
})

test('apagado: sin botón «Por confirmar» y la API da 404', async ({ page, request }) => {
  interruptorAgenda('A', false)
  await page.goto('/agenda')
  await expect(page.locator('[data-agenda-v2="apagada"]')).toBeVisible()
  await expect(page.locator('[data-por-confirmar]')).toHaveCount(0)
  expect((await request.post('/api/agenda/whatsapp', { data: { cita_id: citaId, paso: 'preparar', tipo: 'enlace' } })).status()).toBe(404)
  interruptorAgenda('A', true)
})
