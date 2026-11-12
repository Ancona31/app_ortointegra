import { test, expect } from '@playwright/test'
import { interruptorAgenda, sqlLocal, soloEscritorio, SESION, tituloUnico } from './ayudas'
import { clicEnTarjeta } from './reservaAyudas'

/**
 * WhatsApp MANUAL (agenda E7, plan_E.md E10 caso 10). Sin salir de local: la
 * navegación a wa.me se intercepta con `page.route` y se responde vacía.
 *
 * Comprueba: abrir el modal de una cita con teléfono (y cerrarlo) NO escribe
 * nada (el enlace sólo se emite AL PULSAR); el botón de la lista abre
 * `https://wa.me/521` + 10 dígitos con el texto (`/confirmar/`, sin el
 * título); pulsarlo escribe
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
let pacienteId = ''

test.beforeAll(() => {
  interruptorAgenda('A', true)
  titulo = tituloUnico('WhatsApp E7')
  // Una cita de MAÑANA a las 10:00 (zona del consultorio), con paciente con teléfono.
  citaId = sqlLocal(`
    with c as (select id from public.clinicas where nombre = 'Clínica Semilla A'),
         m as (select p.id from public.profiles p where p.clinica_id = (select id from c) and p.es_admin_de_clinica limit 1),
         -- Un paciente propio, con el título por nombre: la tarjeta de una cita con paciente pinta su NOMBRE.
         u as (insert into public.pacientes (clinica_id, nombre, apellidos, telefono)
               select (select id from c), :'titulo', 'E7', '5512345678' returning id),
         d as (select ((date_trunc('day', now() at time zone 'America/Mexico_City') + interval '1 day 10 hours')
                       at time zone 'America/Mexico_City') as t)
    insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                     consultorio_timezone, consultorio_nombre)
    select (select id from c), (select id from u), (select id from m), :'titulo', d.t, d.t + interval '30 min',
           'scheduled', false, 'America/Mexico_City', 'Consultorio E7' from d
    returning id || '|' || paciente_id;`, { titulo })
  ;[citaId = '', pacienteId = ''] = citaId.split('|')
})
test.afterAll(() => {
  // Los enlaces que emitió el botón al PULSARLO (la prueba de la lista) tienen FK RESTRICT a la cita.
  sqlLocal(`
    delete from public.cita_confirmaciones where appointment_id = :'id';
    delete from public.appointments where id = :'id';
    delete from public.pacientes where id = :'p';`, { id: citaId, p: pacienteId })
  interruptorAgenda('A', false)
})

const enlacesDeLaCita = (): string => sqlLocal(`
  select (select count(*) from public.cita_confirmaciones where appointment_id = :'id') || '|'
      || (select count(*) from public.audit_log where tabla = 'cita_confirmaciones'
            and registro_id in (select id from public.cita_confirmaciones where appointment_id = :'id'));`, { id: citaId })

test('abrir el modal de una cita con teléfono y cerrarlo NO crea ningún enlace de confirmación', async ({ page }) => {
  expect(enlacesDeLaCita()).toBe('0|0')
  await page.goto('/agenda')
  // La cita es de mañana: si hoy es domingo, mañana es otra semana.
  if (new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Mexico_City' }).format(new Date()) === 'Sun') {
    await page.locator('.fc-next-button').click()
  }
  await clicEnTarjeta(page.locator('.fc-event', { hasText: titulo }).first())
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await expect(dialogo.locator(`[data-whatsapp-cita="${citaId}"]`)).toBeVisible()
  await page.waitForTimeout(2000) // lo que antes salía en tiempo ocioso, ya habría salido
  await dialogo.getByRole('button', { name: 'Cerrar' }).first().click()
  await expect(dialogo).toHaveCount(0)
  await page.waitForTimeout(1000)
  expect(enlacesDeLaCita()).toBe('0|0')
})

test('la lista de mañana: wa.me/521 + 10 dígitos, texto sin título; pulsar marca whatsapp_reminder_sent_at sin tocar updated_at', async ({ page }) => {
  // Las pestañas que abre el botón son de la página: la ruta va en el contexto.
  await page.context().route('https://wa.me/**', (r) => r.fulfill({ status: 200, body: '' }))
  const antes = sqlLocal(`select updated_at from public.appointments where id = :'id';`, { id: citaId })
  await page.goto('/agenda')
  await page.locator('[data-por-confirmar]').click()
  const fila = page.locator(`[data-fila-por-confirmar="${citaId}"]`)
  await expect(fila).toBeVisible()
  expect(enlacesDeLaCita()).toBe('0|0') // abrir la lista tampoco emite
  const [popup] = await Promise.all([page.waitForEvent('popup'), fila.getByRole('button', { name: 'WhatsApp' }).click()])
  await popup.waitForURL(/^https:\/\/wa\.me\//)
  const href = popup.url()
  expect(href).toMatch(/^https:\/\/wa\.me\/521\d{10}\?text=/)
  const texto = decodeURIComponent(new URL(href).searchParams.get('text') ?? '')
  expect(texto).toContain('/confirmar/')
  expect(texto).not.toContain(titulo)
  expect(enlacesDeLaCita().split('|')[0]).toBe('1') // pulsar sí lo emite
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
