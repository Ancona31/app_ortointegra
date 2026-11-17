import { test, expect, type Page } from '@playwright/test'
import {
  CORREO, SESION, DIA_LABORABLE_LIBRE, arrastrarEventoPorMinutos, interruptorAgenda, irAAgenda, modalCita, soloEscritorio,
  redimensionarFinEvento, sqlLocal, toastConTexto,
} from './ayudas'
import { editarDesdeTarjeta, tarjetaLectura } from './interaccionesAyudas'
import { esperarCorreo } from './mailpit'
import { clicEnTarjeta, crearCitaPorLigar, limpiarReservasE2e, marcaE2e, type CitaPorLigar } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda I, punto 9 de Angel — el candado sobre lo que el paciente ELIGIÓ al
 * reservar por enlace, en la agenda (con la v2 encendida):
 *
 *   · el formulario deja deshabilitados médico, consultorio, día y hora, dice
 *     por qué y ofrece «Reagendar»; la duración sí se cambia y se guarda;
 *   · el arrastre de esa cita se rechaza con un aviso, sin escribir;
 *   · el servidor rechaza lo mismo aunque se llame a mano (409);
 *   · «Reagendar» pide confirmación, mueve la cita y le manda al paciente el
 *     correo de CAMBIO (a nombre del médico, con su enlace); sin correo, lo
 *     avisa y ofrece el WhatsApp manual;
 *   · ya ligada a un paciente sigue igual, y el «Reagendar» de la tarjeta abre
 *     directamente el panel.
 * La base lo cierra también: `supabase/pruebas-sql/i2_candado_eleccion.sql`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })
test.describe.configure({ mode: 'serial' })

const TZ = 'America/Merida'
const NOMBRE = 'Reserva Eleccion I2'
let desde = ''
let pacienteId = ''

test.beforeAll(() => {
  desde = marcaE2e()
  pacienteId = sqlLocal(`insert into public.pacientes (clinica_id, medico_id, nombre, apellidos)
    select p.clinica_id, p.id, 'Paciente', 'Eleccion I2' from public.profiles p join auth.users u on u.id = p.id
     where u.email = :'correo' returning id`, { correo: CORREO.adminA })
})
test.afterEach(() => { limpiarReservasE2e(desde) })
test.afterAll(() => {
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.appointments where paciente_id = :'p'; delete from public.pacientes where id = :'p'`, { p: pacienteId })
  interruptorAgenda('A', true) // las reglas de la tanda: la v2 queda encendida en A
})

function cita(hora: string, correo: string | null): CitaPorLigar {
  const inicio = fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, hora, TZ)
  test.skip(new Date(inicio).getTime() < Date.now() + 2 * 3600_000, 'el día libre de la semana ya pasó: el candado no aplica')
  const c = crearCitaPorLigar({ correo: CORREO.adminA, inicio, minutos: 30, nombre: NOMBRE, canal: 'unico' })
  sqlLocal(`update public.appointments set reserva_correo = nullif(:'c', '') where id = :'id'`, { c: correo ?? '', id: c.citaId })
  return c
}
const tarjeta = (page: Page) => page.locator('.fc-event', { hasText: NOMBRE }).first()
const inicioDe = (id: string) => sqlLocal(`select extract(epoch from start_time)::bigint from public.appointments where id = :'id'`, { id })
const duracionDe = (id: string) => sqlLocal(`select extract(epoch from end_time - start_time)::int / 60 from public.appointments where id = :'id'`, { id })
/** «Sí, reagendar y avisar» y, si se empalma con algo de la base compartida (B7), «de todos modos». */
async function confirmarReagendar(panel: ReturnType<Page['getByTestId']>): Promise<void> {
  await panel.getByRole('button', { name: 'Sí, reagendar y avisar' }).click()
  await expect(panel.getByText(/Reagendar de todos modos|se reagendó/)).toBeVisible()
  if (await panel.getByText('¿Reagendar de todos modos?').isVisible()) await panel.getByRole('button', { name: 'Sí, reagendar y avisar' }).click()
}
const segundos = (hora: string) => String(new Date(fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, hora, TZ)).getTime() / 1000)

async function abrirFormulario(page: Page): Promise<ReturnType<typeof modalCita>> {
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  await clicEnTarjeta(tarjeta(page))
  await editarDesdeTarjeta(page)
  const modal = modalCita(page, 'Editar cita')
  await expect(modal).toBeVisible()
  return modal
}

test('formulario: médico, consultorio, día y hora deshabilitados con su porqué; la duración se guarda', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', 'eleccion.i2@reserva.test')
  const modal = await abrirFormulario(page)
  await expect(modal.getByTestId('eleccion-paciente')).toContainText('El paciente eligió médico, consultorio, día y hora')
  await expect(modal.locator('input[type="date"]').first()).toBeDisabled()
  await expect(modal.locator('input[type="time"]').first()).toBeDisabled()
  await expect(modal.locator('label', { hasText: 'Médico' }).locator('xpath=following-sibling::div//select')).toBeDisabled()
  await expect(modal.locator('label', { hasText: 'Consultorio' }).locator('xpath=following-sibling::div//select')).toBeDisabled()
  await expect(modal.locator('input[type="time"]').nth(1)).toBeEnabled()
  await modal.locator('input[type="time"]').nth(1).fill('17:45')
  await modal.getByRole('button', { name: 'Guardar' }).click()
  // La base compartida puede tener otras citas a esa hora (B7 sólo avisa): se acepta.
  const empalme = page.getByRole('button', { name: 'Aceptar', exact: true })
  await expect(modal.or(empalme).first()).toBeVisible()
  if (await empalme.isVisible().catch(() => false)) await empalme.click()
  await expect(modal).toBeHidden()
  await expect.poll(() => duracionDe(c.citaId)).toBe('45')
  expect(inicioDe(c.citaId)).toBe(segundos('17:00'))
})

test('servidor: el PUT a mano no cambia la hora ni el médico (409 eleccion_paciente); el fin sí', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', null)
  await irAAgenda(page)
  const hora = await page.request.put(`/api/appointments/${c.citaId}`, { data: {
    start_time: fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '18:00', TZ), end_time: fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '18:30', TZ),
  } })
  expect(hora.status()).toBe(409)
  expect(await hora.json()).toMatchObject({ error: 'eleccion_paciente', campo: 'reagendar' })
  const cuerpoFin = { end_time: fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '17:50', TZ) }
  let fin = await page.request.put(`/api/appointments/${c.citaId}`, { data: cuerpoFin })
  if (fin.status() === 409) { // B7: otra cita de la base compartida a esa hora; se acepta y se reenvía
    const { empalmes }: { empalmes?: Array<{ id: string }> } = await fin.json()
    fin = await page.request.put(`/api/appointments/${c.citaId}`, { data: { ...cuerpoFin, empalmes_aceptados: (empalmes ?? []).map(x => x.id) } })
  }
  expect(fin.status()).toBe(200)
  expect(inicioDe(c.citaId)).toBe(segundos('17:00'))
  expect(duracionDe(c.citaId)).toBe('50')
})

test('arrastre: se rechaza con un aviso y no sale ningún PUT', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', null)
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  const puts: string[] = []
  page.on('request', r => { if (r.method() === 'PUT' && r.url().includes(c.citaId)) puts.push(r.url()) })
  await arrastrarEventoPorMinutos(page, tarjeta(page), 60)
  await expect(toastConTexto(page, 'sólo se cambian con «Reagendar»')).toBeVisible()
  await page.waitForTimeout(800)
  expect(puts).toEqual([])
  expect(inicioDe(c.citaId)).toBe(segundos('17:00'))
})

/** Arrastra el asa de ARRIBA (mueve el inicio) `px` píxeles; negativo = hacia arriba. */
async function estirarDesdeArriba(page: Page, px: number): Promise<void> {
  const evento = tarjeta(page)
  await evento.scrollIntoViewIfNeeded()
  await evento.hover()
  const caja = await evento.locator('.fc-event-resizer-start').boundingBox()
  if (!caja) throw new Error('estirarDesdeArriba: asa no encontrada')
  const x = caja.x + caja.width / 2
  const y = caja.y + caja.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + px, { steps: 12 })
  await page.mouse.up()
}

test('estirar: el fin se estira y se guarda; desde arriba se rechaza con el aviso, sin PUT', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', null)
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  const puts: string[] = []
  page.on('request', r => { if (r.method() === 'PUT' && r.url().includes(c.citaId)) puts.push(r.url()) })
  await estirarDesdeArriba(page, -60)
  await expect(toastConTexto(page, 'sólo se cambian con «Reagendar»')).toBeVisible()
  await page.waitForTimeout(800)
  expect(puts).toEqual([])
  expect(inicioDe(c.citaId)).toBe(segundos('17:00'))
  // El fin sí: la duración es libre (si se empalma con algo de la base compartida, B7 sólo avisa).
  await redimensionarFinEvento(page, tarjeta(page), 30)
  const empalme = page.getByRole('button', { name: 'Aceptar', exact: true })
  await expect.poll(async () => (await empalme.isVisible().catch(() => false)) || duracionDe(c.citaId) !== '30').toBe(true)
  if (await empalme.isVisible().catch(() => false)) await empalme.click()
  await expect.poll(() => duracionDe(c.citaId)).not.toBe('30')
  expect(inicioDe(c.citaId)).toBe(segundos('17:00'))
})

test('Reagendar con correo: confirmación explícita, la cita se mueve y el paciente recibe el correo de cambio del médico', async ({ page }) => {
  interruptorAgenda('A', true)
  const correo = `cambio-${Date.now().toString(36)}@reserva.test`
  const c = cita('17:00', correo)
  const modal = await abrirFormulario(page)
  await modal.getByTestId('eleccion-paciente').getByRole('button', { name: 'Reagendar' }).click()
  const panel = modal.getByTestId('panel-reagendar')
  await expect(panel).toContainText('Le enviaremos al paciente un correo con los datos nuevos')
  await panel.locator('#reagendar-hora').fill('18:00')
  await panel.getByRole('button', { name: 'Revisar cambio' }).click()
  await expect(panel).toContainText('¿Reagendar la cita con estos datos?')
  expect(inicioDe(c.citaId)).toBe(segundos('17:00')) // nada se escribe sin confirmar
  await confirmarReagendar(panel)
  await expect(panel).toContainText('le enviamos el correo con los datos nuevos')
  expect(inicioDe(c.citaId)).toBe(segundos('18:00'))
  expect(duracionDe(c.citaId)).toBe('30')
  expect(sqlLocal(`select count(*) from public.audit_log where accion = 'cita_reagendada_clinica' and registro_id = :'id'`, { id: c.citaId })).toBe('1')
  const aviso = await esperarCorreo(correo, 'Cambio en tu cita')
  expect(aviso.texto).toContain('Tu cita cambió')
  expect(aviso.texto).toContain('18:00')
  expect(aviso.texto).toMatch(/\/confirmar\/[A-Za-z0-9_-]+/)
  expect(aviso.texto.trim().endsWith('Enviado con Spinus')).toBe(true)
  await panel.getByRole('button', { name: 'Cerrar' }).click()
  await expect(modal).toBeHidden()
})

test('Reagendar sin correo (único sin correo): lo avisa antes y después, y ofrece el WhatsApp', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', null)
  const modal = await abrirFormulario(page)
  await modal.getByTestId('eleccion-paciente').getByRole('button', { name: 'Reagendar' }).click()
  const panel = modal.getByTestId('panel-reagendar')
  await expect(panel).toContainText('Esta cita no tiene correo: no se le avisará solo')
  await panel.locator('#reagendar-hora').fill('18:30')
  await panel.getByRole('button', { name: 'Revisar cambio' }).click()
  await confirmarReagendar(panel)
  await expect(panel).toContainText('No tiene correo: avísale por WhatsApp')
  await expect(panel.getByRole('button', { name: 'Enviar confirmación' })).toBeVisible()
  expect(inicioDe(c.citaId)).toBe(segundos('18:30'))
})

test('ligada a un paciente: el candado sigue, y «Reagendar» de la tarjeta abre el panel', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita('17:00', null)
  sqlLocal(`update public.appointments set paciente_id = :'p', title = 'Paciente Eleccion I2' where id = :'id'`, { p: pacienteId, id: c.citaId })
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  await clicEnTarjeta(page.locator('.fc-event', { hasText: 'Eleccion I2' }).first())
  await tarjetaLectura(page).getByRole('button', { name: 'Reagendar', exact: true }).click()
  const modal = modalCita(page, 'Editar cita')
  await expect(modal.getByTestId('panel-reagendar')).toBeVisible()
  // El campo del FORMULARIO (el panel tiene el suyo, «Día nuevo»).
  await expect(modal.locator('label', { hasText: 'Fecha de inicio' }).locator('xpath=following-sibling::input')).toBeDisabled()
})
