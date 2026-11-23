import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  CORREO, SESION, DIA_FUTURO_LIBRE, pasarASemanaSiguiente, enContextoNuevo, eventoConTexto, interruptorAgenda, modalCita, soloEscritorio, sqlLocal, tituloUnico,
} from './ayudas'
import { abrirAgendaV2, editarDesdeTarjeta, tarjetaLectura } from './interaccionesAyudas'
import { crearCitaPorLigar, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'
import { ANOTACION_A_PROPOSITO } from './guardaAsistencia'

/**
 * Tanda J · agente J3. Puntos 6, 7, 8 y 12 de Angel, contra la base local:
 *
 *   · 6: en «Próximas citas» del médico, la fila de una por ligar lleva
 *     «Ligar e iniciar consulta» en vez de «Ver en la agenda» (la secretaria,
 *     que no inicia consultas, sigue con «Ver en la agenda»).
 *   · 7: ese botón, el de la tarjeta y el aviso de la campana abren la MISMA
 *     ventana pequeña (`VentanaLigarCita`): paso 1 con lo que dio quien
 *     reservó, paso 2 con el buscador ya relleno; elegir o registrar liga
 *     (el PUT de siempre) y abre la nota. Nada del formulario de edición. En
 *     una de Google, «¿No es una cita?». El escudo contra el doble clic.
 *   · 8: editando una reserva por enlace no salen los botones de duración.
 *   · 12: el tipo sólo propone la duración; con un tipo de 30 y una cita de
 *     50, la tarjeta y el formulario dicen 50.
 *
 * ⚠️ NO SE GUARDA NINGUNA NOTA (una nota no se borra): se comprueba la URL.
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · 6: el `ligar` del dashboard devuelve `null` → «punto 6».
 *   · 7 tarjeta: `case 'ligar'` de `InteraccionesV2` abre el formulario (`editar()`) → «punto 7 · tarjeta».
 *   · 7 campana: `avisoSeLiga` devuelve `false` → «punto 7 · campana».
 *   · 7 escudo: quitar `escudoPaso.activar()` de `VentanaLigarCita` → «punto 7 · escudo».
 *   · 8: quitar `&& !sinBotonesDuracion` de `AppointmentModal` → «punto 8».
 *   · 12: `cuandoDeTarjeta` con la duración del tipo (`min = 30`) → «punto 12».
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const APELLIDOS_NUEVO = 'Ligar Jtres'
let desde = ''

test.beforeAll(() => { desde = marcaE2e() })
test.afterEach(() => {
  sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.avisos_clinica where cita_id in (select id from public.appointments where google_event_id like 'falso-j3-e2e-%' or title like 'Tipo J3 %');
    delete from public.appointments where google_event_id like 'falso-j3-e2e-%' or title like 'Tipo J3 %';
    delete from public.tipos_cita where nombre like 'Tipo J3 %'; commit;`)
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.paciente_medico where paciente_id in (select id from public.pacientes where apellidos = :'ap');
    delete from public.pacientes where apellidos = :'ap';`, { ap: APELLIDOS_NUEVO })
})
test.afterAll(() => { interruptorAgenda('A', false) })

/* AG-DT-256 · «Próximas citas» lista las siguientes del médico: la por ligar tiene que ser de dentro de
   minutos (`pronto`), no puede ir a la semana siguiente. El `afterEach` la borra (`limpiarReservasE2e`) antes de
   que la prueba termine, así que al acabar ya no dispara la ventana: la guarda la perdona con esta anotación. */
const A_PROPOSITO = { annotation: { type: ANOTACION_A_PROPOSITO, description: 'por ligar de dentro de minutos; la borra el afterEach' } }

/** Dentro de `minutos`, redondeado al minuto: la primera de «Próximas citas» del Dr. Admin. */
function pronto(minutos: number): string {
  return new Date(Math.ceil((Date.now() + minutos * 60_000) / 60_000) * 60_000).toISOString()
}

function filaGoogle(titulo: string, inicio: string): string {
  const fin = new Date(Date.parse(inicio) + 30 * 60_000).toISOString()
  return sqlLocal(`
    insert into public.appointments (clinica_id, title, start_time, end_time, all_day, status, google_event_id,
                                     gcal_sync_status, origen, medico_id, consultorio_timezone, google_asignacion)
    select c.id, :'titulo', :'inicio'::timestamptz, :'fin'::timestamptz, false, 'scheduled', 'falso-j3-e2e-' || gen_random_uuid(),
           'synced', 'google', u.id, :'tz', 'por_asignar'
      from public.clinicas c, auth.users u where c.nombre = 'Clínica Semilla A' and u.email = :'correo'
    returning id`, { titulo, inicio, fin, tz: TZ, correo: CORREO.adminA })
}

const pacienteDe = (id: string): string => sqlLocal(`select coalesce(paciente_id::text, '-') from public.appointments where id = :'id'`, { id })

function proximas(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Próximas citas' }) })
}
function renglon(page: Page, texto: string): Locator {
  return proximas(page).getByText(texto, { exact: true }).locator('xpath=ancestor::div[contains(@class, "border-t")][1]')
}
async function abrirDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard')
  await expect(proximas(page)).toBeVisible({ timeout: 30_000 })
  await expect(proximas(page).locator('.skeleton')).toHaveCount(0, { timeout: 30_000 })
}
function ventana(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Ligar e iniciar consulta' })
}
function registro(page: Page): Locator {
  return page.locator('div.fixed', { has: page.getByRole('heading', { name: 'Registrar paciente' }) }).last()
}

test('punto 6: en Próximas citas la por ligar lleva «Ligar e iniciar consulta»; elegir un paciente liga y abre la nota', A_PROPOSITO, async ({ page, browser }) => {
  interruptorAgenda('A', true)
  const nombre = tituloUnico('Lucía Reserva J3')
  const c = crearCitaPorLigar({ correo: CORREO.adminA, inicio: pronto(3), minutos: 30, nombre, canal: 'unico' })
  await abrirDashboard(page)
  const fila = renglon(page, nombre)
  await expect(fila.getByRole('link', { name: /en la agenda/ })).toHaveCount(0)
  await fila.getByRole('button', { name: `Ligar e iniciar consulta de ${nombre}` }).click()
  // Paso 1: lo que dio quien reservó, nada del formulario de edición.
  const v = ventana(page)
  await expect(v.getByText(nombre)).toBeVisible()
  await expect(v.getByText('5512345678')).toBeVisible()
  await expect(v.getByText('persona.e2e@ejemplo.test')).toBeVisible()
  await expect(v.getByText(/Duración|Tipo de cita|Notas|Observaciones/)).toHaveCount(0)
  await v.getByRole('button', { name: 'Ligar e iniciar consulta' }).click()
  // Paso 2: el buscador ya relleno con el nombre.
  const buscador = v.getByRole('textbox', { name: 'Buscar paciente existente' })
  await expect(buscador).toHaveValue(nombre)
  await buscador.fill('Prueba 07')
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${c.citaId}`) && r.request().method() === 'PUT')
  await v.getByRole('button', { name: /Prueba 07/ }).click()
  expect((await put).ok()).toBeTruthy()
  await page.waitForURL(new RegExp(`/expediente/[0-9a-f-]+/nueva-nota\\?cita=${c.citaId}$`))
  expect(pacienteDe(c.citaId)).toMatch(/^[0-9a-f-]{36}$/)

  const otra = tituloUnico('Marta Reserva J3')
  crearCitaPorLigar({ correo: CORREO.adminA, inicio: pronto(4), minutos: 30, nombre: otra, canal: 'unico' })
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    await abrirDashboard(p)
    await expect(renglon(p, otra).getByRole('link', { name: /en la agenda/ })).toBeVisible()
    await expect(renglon(p, otra).getByRole('button', { name: /Ligar/ })).toHaveCount(0)
  })
})

/* MUTACIÓN: el rótulo largo («Ligar e iniciar consulta») también en la fila de Google → se sale de la tarjeta a 1280. */
test('punto 6 · a 1280, en la fila de Google el botón cabe junto a «¿No es una cita?»', async ({ page }) => {
  interruptorAgenda('A', true)
  await page.setViewportSize({ width: 1280, height: 800 })
  const titulo = tituloUnico('Rodilla Google J3')
  filaGoogle(titulo, pronto(3))
  await abrirDashboard(page)
  const fila = renglon(page, titulo)
  await expect(fila.getByRole('button', { name: '¿No es una cita?' })).toBeVisible()
  const boton = fila.getByRole('button', { name: `Ligar e iniciar consulta de ${titulo}` })
  const [b, f] = [await boton.boundingBox(), await fila.boundingBox()]
  if (!b || !f) throw new Error('sin caja')
  expect(b.x + b.width).toBeLessThanOrEqual(f.x + f.width)
})

test('punto 7 · tarjeta: abre la ventana; «Registrar paciente nuevo» con los datos puestos y el consentimiento; liga y abre la nota', async ({ page }) => {
  interruptorAgenda('A', true)
  const nombre = `Zoila ${APELLIDOS_NUEVO}`
  const c = crearCitaPorLigar({
    correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(DIA_FUTURO_LIBRE, '18:00', TZ), minutos: 30, nombre, canal: 'fijo',
  })
  await abrirAgendaV2(page)
  await pasarASemanaSiguiente(page) // AG-DT-256: semana siguiente
  await eventoConTexto(page, nombre).click({ position: { x: 8, y: 8 } })
  await tarjetaLectura(page).getByRole('button', { name: 'Ligar expediente e iniciar', exact: true }).click()
  const v = ventana(page)
  await expect(v).toBeVisible()
  await expect(modalCita(page, 'Editar cita')).toHaveCount(0)
  await v.getByRole('button', { name: 'Ligar e iniciar consulta' }).click()
  await v.getByRole('button', { name: 'Registrar paciente nuevo' }).click()
  const alta = registro(page)
  await expect(alta.locator('label:text-is("Nombre") + input')).toHaveValue('Zoila')
  await expect(alta.locator('label:text-is("Apellidos") + input')).toHaveValue(APELLIDOS_NUEVO)
  await expect(alta.locator('input[type="email"]')).toHaveValue('persona.e2e@ejemplo.test')
  await expect(alta.locator('input[type="tel"]')).toHaveValue('551 234 5678')
  await alta.getByRole('button', { name: 'Crear y continuar' }).click()
  await expect(page.getByText('Debes marcar el consentimiento del aviso de privacidad.')).toBeVisible()
  expect(pacienteDe(c.citaId)).toBe('-')
  await alta.getByRole('checkbox').check()
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${c.citaId}`) && r.request().method() === 'PUT')
  await alta.getByRole('button', { name: 'Crear y continuar' }).click()
  expect((await put).ok()).toBeTruthy()
  await page.waitForURL(new RegExp(`/expediente/[0-9a-f-]+/nueva-nota\\?cita=${c.citaId}$`))
  const auditoria = sqlLocal(`select descripcion from public.audit_log where accion = 'cita_ligada' and registro_id = :'id'`, { id: c.citaId })
  expect(auditoria).toContain('"campos"')
  expect(auditoria).not.toContain(nombre)
})

test('punto 7 · campana: el aviso de una reserva abre la ventana; la de Google trae «¿No es una cita?»', async ({ page }) => {
  interruptorAgenda('A', true)
  const nombre = tituloUnico('Rosa Aviso J3')
  const c = crearCitaPorLigar({
    correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(DIA_FUTURO_LIBRE, '18:30', TZ), minutos: 30, nombre, canal: 'unico',
  })
  const titulo = tituloUnico('Valoración Google J3')
  const g = filaGoogle(titulo, fechaHoraLocalAInstante(DIA_FUTURO_LIBRE, '19:30', TZ))
  await abrirAgendaV2(page)
  await pasarASemanaSiguiente(page) // AG-DT-256: semana siguiente
  const abrirAviso = async (id: string): Promise<void> => {
    await page.locator('[data-campana]').first().click()
    const capa = page.getByRole('dialog', { name: 'Por confirmar y avisos' })
    await capa.getByRole('tab', { name: /^Avisos/ }).click()
    await capa.locator(`button[data-aviso-cita="${id}"]`).click()
  }
  await abrirAviso(c.citaId)
  await expect(ventana(page).getByText(nombre)).toBeVisible()
  await expect(tarjetaLectura(page)).toHaveCount(0)
  await ventana(page).getByRole('button', { name: 'Cancelar' }).click()

  await abrirAviso(g)
  const post = page.waitForResponse(r => r.url().endsWith(`/api/appointments/${g}/no-es-cita`) && r.request().method() === 'POST')
  await ventana(page).getByRole('button', { name: '¿No es una cita?' }).click()
  expect((await post).status()).toBe(200)
  await expect(ventana(page)).toHaveCount(0)
  expect(sqlLocal(`select google_asignacion from public.appointments where id = :'id'`, { id: g })).toBe('evento')
})

/** Doble clic en el centro de `boton`: cuántos `click` llegan a `window` (1 con el escudo, 2 sin él). */
async function clicsTrasDobleClic(page: Page, boton: Locator, tras: () => Promise<void>): Promise<number> {
  const caja = await boton.boundingBox()
  if (!caja) throw new Error('el botón no está a la vista')
  const x = caja.x + caja.width / 2, y = caja.y + caja.height / 2
  await page.evaluate(() => {
    const w = window as unknown as { __clicsJ3: number; __oyenteJ3?: boolean }
    w.__clicsJ3 = 0
    if (!w.__oyenteJ3) { w.__oyenteJ3 = true; window.addEventListener('click', () => { w.__clicsJ3++ }) }
  })
  await page.mouse.click(x, y)
  await tras()
  await page.mouse.click(x, y)
  await page.waitForTimeout(700)
  return page.evaluate(() => (window as unknown as { __clicsJ3: number }).__clicsJ3)
}

test('punto 7 · escudo: el segundo clic de un doble clic no cae en el buscador ni, al cancelar el alta, en la ventana', A_PROPOSITO, async ({ page }) => {
  interruptorAgenda('A', true)
  const nombre = tituloUnico('Elsa Escudo J3')
  crearCitaPorLigar({ correo: CORREO.adminA, inicio: pronto(3), minutos: 30, nombre, canal: 'unico' })
  await abrirDashboard(page)
  await renglon(page, nombre).getByRole('button', { name: /Ligar/ }).click()
  const v = ventana(page)
  const seguir = v.getByRole('button', { name: 'Ligar e iniciar consulta' })
  expect(await clicsTrasDobleClic(page, seguir, () => expect(v.getByRole('textbox', { name: 'Buscar paciente existente' })).toBeVisible())).toBe(1)
  await v.getByRole('button', { name: 'Registrar paciente nuevo' }).click()
  const cancelar = registro(page).getByRole('button', { name: 'Cancelar' })
  expect(await clicsTrasDobleClic(page, cancelar, () => expect(page.getByRole('heading', { name: 'Registrar paciente' })).toHaveCount(0))).toBe(1)
  await expect(v).toBeVisible()
})

test('punto 8: editando una reserva por enlace no salen los botones de duración; con paciente sí', async ({ page }) => {
  interruptorAgenda('A', true)
  const nombre = tituloUnico('Iván Duración J3')
  crearCitaPorLigar({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(DIA_FUTURO_LIBRE, '17:00', TZ), minutos: 30, nombre, canal: 'fijo' })
  await abrirAgendaV2(page)
  await pasarASemanaSiguiente(page) // AG-DT-256: semana siguiente
  await eventoConTexto(page, nombre).click({ position: { x: 8, y: 8 } })
  await editarDesdeTarjeta(page)
  const m = modalCita(page, 'Editar cita')
  await expect(m).toBeVisible()
  await expect(m.getByText('Hora de fin', { exact: true })).toBeVisible()
  await expect(m.getByText('Duración', { exact: true })).toHaveCount(0)
  await expect(m.getByRole('button', { name: '45 min', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Agendar' }).first().click()
  await expect(modalCita(page, 'Nueva cita').getByText('Duración', { exact: true })).toBeVisible()
})

test('punto 12: tipo de 30 min y cita de 50: la tarjeta y el formulario dicen 50', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Tipo J3 cita')
  const id = sqlLocal(`
    with m as (select p.id, p.clinica_id, co.id as co, co.nombre, co.timezone from auth.users u join public.profiles p on p.id = u.id
                 join public.consultorios co on co.medico_id = p.id and co.activo where u.email = :'correo' order by co.created_at limit 1),
         t as (insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, activo)
               select clinica_id, id, 'Tipo J3 treinta', 30, true from m returning id, nombre),
         pa as (select pa.id from public.pacientes pa join public.clinicas cl on cl.id = pa.clinica_id
                 where cl.nombre = 'Clínica Semilla A' and pa.apellidos = 'Prueba 07')
    insert into public.appointments (clinica_id, medico_id, consultorio_id, consultorio_nombre, consultorio_timezone, paciente_id, title,
      start_time, end_time, status, origen, gcal_sync_status, tipo_cita_id, tipo_cita_nombre)
    select m.clinica_id, m.id, m.co, m.nombre, m.timezone, pa.id, :'titulo', :'ini'::timestamptz, :'ini'::timestamptz + interval '50 minutes',
           'scheduled', 'spinus', 'pending', t.id, t.nombre from m, t, pa returning id`,
  { correo: CORREO.adminA, titulo, ini: fechaHoraLocalAInstante(DIA_FUTURO_LIBRE, '10:00', TZ) })
  // El enlace profundo de I5 abre la tarjeta de ESA cita (la semilla tiene otras de Prueba 07).
  await page.goto(`/agenda?cita=${id}`)
  await expect(tarjetaLectura(page).getByText(/50 min/)).toBeVisible()
  await expect(tarjetaLectura(page).getByText(/30 min/)).toHaveCount(0)
  await editarDesdeTarjeta(page)
  const m = modalCita(page, 'Editar cita')
  await expect(m.locator('input[type="time"]').nth(1)).toHaveValue('10:50')
})
