import { test, expect } from '@playwright/test'
import { interruptorAgenda, sqlLocal, soloEscritorio, SESION, tituloUnico, diaDeLaSemana } from './ayudas'
import { clicEnTarjeta } from './reservaAyudas'
import { ANOTACION_A_PROPOSITO } from './guardaAsistencia'

/* AG-DT-256: «mañana» se calcula UNA vez, al cargar el archivo, y con esa misma fecha se siembra la
   cita y se decide si hay que pasar de semana. Antes la cita salía de `now()` al sembrar y la semana
   se decidía con el día de la semana al correr la prueba: si la batería cruzaba la medianoche del
   sábado, la cita era del domingo de ESTA semana y la prueba pasaba a la siguiente (2026-11-22).
   La cita tiene que ser de mañana (es lo que lista «Por confirmar»): no puede ir a una fecha fija. */
const MANANA = new Date(Date.parse(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

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

/* AG-DT-256 · la cita es de mañana y, de lunes a viernes, de la semana visible: la guarda la vería al
   final del domingo. Cada prueba la crea al empezar (`sembrarCita`) y el `afterEach` la borra antes de
   que termine; al acabar ya no dispara la ventana y la guarda la perdona con la anotación. Antes nacía
   en un `beforeAll` y vivía hasta el final del archivo (también en `telefono`, donde todo se salta). */
const A_PROPOSITO = { annotation: { type: ANOTACION_A_PROPOSITO, description: 'cita de mañana; la borra el afterEach' } }

test.beforeAll(() => { interruptorAgenda('A', true) })

function sembrarCita(): void {
  titulo = tituloUnico('WhatsApp E7')
  // Una cita de MAÑANA a las 10:00 (zona del consultorio), con paciente con teléfono.
  citaId = sqlLocal(`
    with c as (select id from public.clinicas where nombre = 'Clínica Semilla A'),
         m as (select p.id from public.profiles p where p.clinica_id = (select id from c) and p.es_admin_de_clinica limit 1),
         -- Un paciente propio, con el título por nombre: la tarjeta de una cita con paciente pinta su NOMBRE.
         u as (insert into public.pacientes (clinica_id, nombre, apellidos, telefono)
               select (select id from c), :'titulo', 'E7', '5512345678' returning id),
         d as (select ((:'manana' || ' 10:00')::timestamp at time zone 'America/Mexico_City') as t)
    insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                     consultorio_timezone, consultorio_nombre)
    select (select id from c), (select id from u), (select id from m), :'titulo', d.t, d.t + interval '30 min',
           'scheduled', false, 'America/Mexico_City', 'Consultorio E7' from d
    returning id || '|' || paciente_id;`, { titulo, manana: MANANA })
  ;[citaId = '', pacienteId = ''] = citaId.split('|')
}
test.afterEach(() => {
  if (!citaId) return
  // Los enlaces que emitió el botón al PULSARLO (la prueba de la lista) tienen FK RESTRICT a la cita.
  sqlLocal(`
    delete from public.cita_confirmaciones where appointment_id = :'id';
    delete from public.appointments where id = :'id';
    delete from public.pacientes where id = :'p';`, { id: citaId, p: pacienteId })
  citaId = ''
  pacienteId = ''
})
test.afterAll(() => { interruptorAgenda('A', false) })

const enlacesDeLaCita = (): string => sqlLocal(`
  select (select count(*) from public.cita_confirmaciones where appointment_id = :'id') || '|'
      || (select count(*) from public.audit_log where tabla = 'cita_confirmaciones'
            and registro_id in (select id from public.cita_confirmaciones where appointment_id = :'id'));`, { id: citaId })

test('abrir el modal de una cita con teléfono y cerrarlo NO crea ningún enlace de confirmación', A_PROPOSITO, async ({ page }) => {
  sembrarCita()
  expect(enlacesDeLaCita()).toBe('0|0')
  await page.goto('/agenda')
  /* Se espera a las interacciones de la v2 antes de pulsar. Sin esto la prueba dependía de una
     carrera: un clic ANTES de que llegue ese chunk abre el formulario (con el WhatsApp a la vista)
     y uno DESPUÉS abre la tarjeta, donde el WhatsApp va dentro de «Confirmar» (tanda K, punto 21).
     Los domingos, el clic de «siguiente» daba tiempo al chunk y la prueba caía. */
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  // La cita es de mañana: si mañana cae en la semana siguiente a la visible, se pasa a ella.
  if (MANANA >= diaDeLaSemana(1, 0)) await page.locator('.fc-next-button').click()
  await clicEnTarjeta(page.locator('.fc-event', { hasText: titulo }).first())
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialogo.locator(`[data-whatsapp-cita="${citaId}"]`)).toBeVisible()
  await page.waitForTimeout(2000) // lo que antes salía en tiempo ocioso, ya habría salido
  await dialogo.getByRole('button', { name: 'Cerrar' }).first().click()
  await expect(dialogo).toHaveCount(0)
  await page.waitForTimeout(1000)
  expect(enlacesDeLaCita()).toBe('0|0')
})

test('la lista de mañana: wa.me/521 + 10 dígitos, texto sin título; pulsar marca whatsapp_reminder_sent_at sin tocar updated_at', A_PROPOSITO, async ({ page }) => {
  sembrarCita()
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
  // I5 (punto 17): el estado va en una línea debajo de la fila, en forma corta.
  await expect(fila.locator('[data-estado-fila]')).toHaveText(/^WhatsApp abierto \d\d:\d\d$/)
  await expect.poll(() => sqlLocal(`select whatsapp_reminder_sent_at is not null from public.appointments where id = :'id';`, { id: citaId })).toBe('t')
  expect(sqlLocal(`select updated_at from public.appointments where id = :'id';`, { id: citaId })).toBe(antes)
})

test('confirmada sale de la lista', A_PROPOSITO, async ({ page }) => {
  sembrarCita()
  sqlLocal(`update public.appointments set status = 'confirmed' where id = :'id';`, { id: citaId })
  await page.goto('/agenda')
  await page.locator('[data-por-confirmar]').click()
  await expect(page.getByRole('dialog', { name: 'Por confirmar y avisos' })).toBeVisible() // I5: la capa de la campana
  await expect(page.locator(`[data-fila-por-confirmar="${citaId}"]`)).toHaveCount(0)
})

test('apagado: sin botón «Por confirmar» y la API da 404', A_PROPOSITO, async ({ page, request }) => {
  sembrarCita()
  interruptorAgenda('A', false)
  await page.goto('/agenda')
  await expect(page.locator('[data-agenda-v2="apagada"]')).toBeVisible()
  await expect(page.locator('[data-por-confirmar]')).toHaveCount(0)
  expect((await request.post('/api/agenda/whatsapp', { data: { cita_id: citaId, paso: 'preparar', tipo: 'enlace' } })).status()).toBe(404)
  interruptorAgenda('A', true)
})
