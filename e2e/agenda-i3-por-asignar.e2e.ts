import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  CORREO, SESION, DIA_LABORABLE_LIBRE, enContextoNuevo, eventoConTexto, interruptorAgenda, soloEscritorio, sqlLocal, tituloUnico,
} from './ayudas'
import { abrirAgendaV2, editarDesdeTarjeta, tarjetaLectura } from './interaccionesAyudas'
import { crearCitaPorLigar, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda I · agente I3. Puntos 8, 10 y 22 de Angel, contra la base local:
 *
 *   · 8: con la agenda v2, «Próximas citas» (dashboard del médico y de la
 *     secretaria) enseña la cita POR LIGAR con el nombre que dio quien reservó y
 *     la marca «Por ligar». Apagada, no (ahí no hay por ligar).
 *   · 10: un evento de Google «por asignar» sale en «Próximas citas» con el
 *     título de Google y «Por asignar»; «¿No es una cita?» (en la fila y en la
 *     tarjeta) lo pasa a evento en el momento, queda auditado, sale de la lista
 *     y no vuelve; la tarjeta ofrece entonces «Convertir en cita». La entrada
 *     por el sondeo de Google se prueba en `agenda-google-dos-sentidos.e2e.ts`.
 *   · 22: el escudo contra el doble clic al cerrar el registro rápido de
 *     paciente, en el formulario completo y en «Convertir en cita»: el segundo
 *     clic del gesto no llega a lo de debajo.
 *
 * Las filas se preparan como `postgres` (el disparador de I3 no toca a
 * `postgres`, así que «por asignar» se escribe a mano): aquí se prueba qué hace
 * la clínica con ellas, no cómo llegan.
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · 8: `consultaProximas` sin el `.or(...)` (la consulta de siempre) → «punto 8».
 *   · 10, fila: `CON_PACIENTE_O_POR_LIGAR` con `google_asignacion.not.is.null`
 *     (deja pasar el evento) → «punto 10 · fila».
 *   · 10, tarjeta: la ruta `no-es-cita` contesta 200 sin escribir → «punto 10 · tarjeta».
 *   · 10, formulario: quitar `<BotonNoEsCita>` de `AppointmentModal` → «punto 10 · formulario».
 *   · 10, campana (integración I): quitar `<BotonNoEsCita>` de `ListaAvisos` → «punto 10 · campana».
 *   · 22: quitar `escudo.activar()` del cierre de `QuickPatientModal` en
 *     `AppointmentModal` → «punto 22 · formulario»; y en `ConvertirEnCita` →
 *     «punto 22 · convertir».
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const APELLIDOS_NUEVO = 'Escudo Itres'
let desde = ''

test.beforeAll(() => { desde = marcaE2e() })
test.afterEach(() => {
  borrarFilasGoogle()
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.paciente_medico where paciente_id in (select id from public.pacientes where apellidos = :'ap');
    delete from public.pacientes where apellidos = :'ap';`, { ap: APELLIDOS_NUEVO })
})
test.afterAll(() => {
  // Integración I: cada archivo deja la v2 APAGADA al terminar (la convención de la batería: el
  // global-setup la apaga y sólo la prueba que la necesita la enciende). Encendida, las e2e que
  // la suponen apagada (agenda-secretaria, agenda-tipos-cita) caían en el aviso de empalme B7.
  interruptorAgenda('A', false)
})

/** Dentro de `minutos`, redondeado al minuto: la primera de «Próximas citas» del Dr. Admin. */
function pronto(minutos: number): string {
  return new Date(Math.ceil((Date.now() + minutos * 60_000) / 60_000) * 60_000).toISOString()
}

/** Una fila nacida en Google, del Dr. Admin de A, con `asignacion` escrita a mano. */
function filaGoogle(titulo: string, inicio: string, asignacion: 'por_asignar' | 'evento' | null): string {
  const fin = new Date(Date.parse(inicio) + 30 * 60_000).toISOString()
  return sqlLocal(`
    insert into public.appointments (clinica_id, title, start_time, end_time, all_day, status, google_event_id,
                                     gcal_sync_status, origen, medico_id, consultorio_timezone, google_asignacion)
    select c.id, :'titulo', :'inicio'::timestamptz, :'fin'::timestamptz, false, 'scheduled', 'falso-i3-e2e-' || gen_random_uuid(),
           'synced', 'google', u.id, :'tz', nullif(:'asig', '')
      from public.clinicas c, auth.users u where c.nombre = 'Clínica Semilla A' and u.email = :'correo'
    returning id`, { titulo, inicio, fin, tz: TZ, asig: asignacion ?? '', correo: CORREO.adminA })
}

function borrarFilasGoogle(): void {
  sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.avisos_clinica where cita_id in (select id from public.appointments where google_event_id like 'falso-i3-e2e-%');
    delete from public.appointments where google_event_id like 'falso-i3-e2e-%'; commit;`)
}

const asignacion = (id: string): string => sqlLocal(`select coalesce(google_asignacion, 'NULL') from public.appointments where id = :'id'`, { id })
const auditadas = (id: string): string =>
  sqlLocal(`select count(*) from public.audit_log where registro_id = :'id' and accion = 'cita_no_es_cita'`, { id })

function proximas(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Próximas citas' }) })
}

/** El renglón de «Próximas citas» que lleva ese texto. */
function renglon(page: Page, texto: string): Locator {
  return proximas(page).getByText(texto, { exact: true }).locator('xpath=ancestor::div[contains(@class, "border-t")][1]')
}

async function abrirDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard')
  await expect(proximas(page)).toBeVisible({ timeout: 30_000 })
  await expect(proximas(page).locator('.skeleton')).toHaveCount(0, { timeout: 30_000 })
}

/* Tanda K, puntos 17 y 18: la palabra «Por ligar» es ahora el expediente tachado (nombre accesible
   «Sin expediente») y el eslabón con su texto «Por enlace». */
test('punto 8: con la v2, la por ligar sale en Próximas citas con el nombre de quien reservó, el expediente tachado y el eslabón; apagada, no', async ({ page, browser }) => {
  const nombre = tituloUnico('Lucía Reserva I3')
  crearCitaPorLigar({ correo: CORREO.adminA, inicio: pronto(3), minutos: 30, nombre, canal: 'unico' })
  interruptorAgenda('A', true)
  await abrirDashboard(page)
  await expect(renglon(page, nombre)).toBeVisible()
  await expect(renglon(page, nombre).getByRole('img', { name: 'Sin expediente' })).toBeVisible()
  await expect(renglon(page, nombre).getByText('Por enlace', { exact: true })).toBeVisible()
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    await abrirDashboard(p)
    await expect(renglon(p, nombre).getByRole('img', { name: 'Sin expediente' })).toBeVisible()
  })
  interruptorAgenda('A', false)
  await abrirDashboard(page)
  await expect(proximas(page).getByText(nombre)).toHaveCount(0)
})

test('punto 10 · fila: la por asignar sale con el título de Google; «¿No es una cita?» la quita, queda auditada y no vuelve', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Revisión rodilla Google I3')
  const yaEvento = tituloUnico('Junta de Google I3')
  const id = filaGoogle(titulo, pronto(4), 'por_asignar')
  filaGoogle(yaEvento, pronto(5), 'evento')
  await abrirDashboard(page)
  const fila = renglon(page, titulo)
  await expect(fila.getByRole('img', { name: 'Sin expediente' })).toBeVisible()
  await expect(fila.getByText('Por enlace', { exact: true })).toHaveCount(0)
  await expect(proximas(page).getByText(yaEvento)).toHaveCount(0)
  const post = page.waitForResponse(r => r.url().endsWith(`/api/appointments/${id}/no-es-cita`) && r.request().method() === 'POST')
  await fila.getByRole('button', { name: '¿No es una cita?' }).click()
  expect((await post).status()).toBe(200)
  await expect(proximas(page).getByText(titulo)).toHaveCount(0)
  expect(asignacion(id)).toBe('evento')
  expect(auditadas(id)).toBe('1')
  await abrirDashboard(page)
  await expect(proximas(page).getByText(titulo)).toHaveCount(0)
})

test('punto 10 · tarjeta: «Por asignar» en la agenda; «¿No es una cita?» la deja en evento con «Convertir en cita»', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Control Google I3')
  const id = filaGoogle(titulo, fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '19:30', TZ), 'por_asignar')
  await abrirAgendaV2(page)
  await expect(eventoConTexto(page, titulo).locator('.ag-icono-sin-exp')).toBeVisible()
  await eventoConTexto(page, titulo).click({ position: { x: 6, y: 6 } })
  const tarjeta = tarjetaLectura(page)
  await expect(tarjeta.getByRole('button', { name: 'Convertir en cita' })).toHaveCount(0)
  /* Tanda K, punto 21: en la burbuja, «No es una cita», sin signos. */
  await tarjeta.getByRole('button', { name: 'No es una cita', exact: true }).click()
  await expect.poll(() => asignacion(id), { timeout: 15_000 }).toBe('evento')
  expect(auditadas(id)).toBe('1')
  await page.keyboard.press('Escape')
  await expect(eventoConTexto(page, titulo).locator('.ag-icono-sin-exp')).toHaveCount(0)
  await eventoConTexto(page, titulo).click({ position: { x: 6, y: 6 } })
  await expect(tarjetaLectura(page).getByRole('button', { name: 'Convertir en cita' })).toBeVisible()
  await expect(tarjetaLectura(page).getByRole('button', { name: 'No es una cita', exact: true })).toHaveCount(0)
})

/* Desde el formulario completo, «¿No es una cita?» cierra el formulario y la
   marca se va de la rejilla sin recargar (medido: menos de 1,5 s, por el
   refresco que ya tiene la agenda; no hace falta cablear nada más). */
test('punto 10 · formulario: «¿No es una cita?» desde «Editar» quita la marca al momento', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Consulta Google form I3')
  const id = filaGoogle(titulo, fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '19:00', TZ), 'por_asignar')
  await abrirAgendaV2(page)
  await eventoConTexto(page, titulo).click({ position: { x: 6, y: 6 } })
  await editarDesdeTarjeta(page)
  const formulario = page.getByRole('dialog', { name: 'Editar cita' })
  await formulario.getByRole('button', { name: '¿No es una cita?' }).click()
  await expect(formulario).toHaveCount(0)
  await expect(eventoConTexto(page, titulo).locator('.ag-icono-sin-exp')).toHaveCount(0, { timeout: 1_500 })
  expect(asignacion(id)).toBe('evento')
})

/* Integración I (I3 + I5): el aviso «Evento nuevo de Google por asignar» de la
   campana lleva «¿No es una cita?» al lado; pulsarlo deja el evento y revisa
   el aviso. MUTACIÓN: quitar `<BotonNoEsCita>` de `ListaAvisos` → rojo. */
test('punto 10 · campana: «¿No es una cita?» en el aviso de Google lo deja en evento y revisa el aviso', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Aviso Google I3')
  const id = filaGoogle(titulo, fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '18:30', TZ), 'por_asignar')
  const pendiente = (): string => sqlLocal(`select count(*) from public.avisos_clinica
    where cita_id = :'id' and tipo = 'google_por_asignar' and revisado_en is null`, { id })
  expect(pendiente()).toBe('1')
  await abrirAgendaV2(page)
  await page.locator('[data-campana]').first().click()
  const capa = page.getByRole('dialog', { name: 'Por confirmar y avisos' })
  await capa.getByRole('tab', { name: /^Avisos/ }).click()
  const junto = capa.locator(`[data-aviso-no-es-cita="${id}"]`)
  await expect(junto).toBeVisible()
  const post = page.waitForResponse(r => r.url().endsWith(`/api/appointments/${id}/no-es-cita`) && r.request().method() === 'POST')
  await junto.getByRole('button', { name: '¿No es una cita?' }).click()
  expect((await post).status()).toBe(200)
  await expect(capa.locator(`[data-aviso-cita="${id}"]`)).toHaveCount(0)
  expect(asignacion(id)).toBe('evento')
  await expect.poll(pendiente, { timeout: 10_000 }).toBe('0')
})

/**
 * Un clic en el centro de `boton` y, en cuanto se va el registro, otro en el
 * mismo sitio (el doble clic). Devuelve cuántos `click` llegaron a `window` en
 * fase de burbuja durante el gesto: 1 con el escudo (el del botón), 2 sin él.
 */
async function clicsQueLleganTrasDobleClic(page: Page, boton: Locator): Promise<number> {
  const caja = await boton.boundingBox()
  if (!caja) throw new Error('el botón no está a la vista')
  const x = caja.x + caja.width / 2, y = caja.y + caja.height / 2
  await page.evaluate(() => {
    const w = window as unknown as { __clicsI3: number }
    w.__clicsI3 = 0
    window.addEventListener('click', () => { w.__clicsI3++ })
  })
  await page.mouse.click(x, y)
  await expect(page.getByRole('heading', { name: 'Registrar paciente' })).toHaveCount(0)
  await page.mouse.click(x, y)
  await page.waitForTimeout(700)
  return page.evaluate(() => (window as unknown as { __clicsI3: number }).__clicsI3)
}

function registro(page: Page): Locator {
  return page.locator('div.fixed', { has: page.getByRole('heading', { name: 'Registrar paciente' }) }).last()
}

test('punto 22 · formulario: el doble clic en «Crear y continuar» no llega al formulario completo', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await page.getByRole('button', { name: 'Agendar' }).first().click()
  await page.getByPlaceholder('Buscar paciente por nombre o apellido...').fill(`Zoila ${APELLIDOS_NUEVO}`)
  await page.getByText(`Registrar "Zoila ${APELLIDOS_NUEVO}"`).click()
  await registro(page).getByRole('checkbox').check()
  expect(await clicsQueLleganTrasDobleClic(page, registro(page).getByRole('button', { name: 'Crear y continuar' }))).toBe(1)
  await expect(page.getByRole('dialog', { name: 'Nueva cita' })).toBeVisible()
})

test('punto 22 · convertir: el doble clic en «Crear y continuar» no llega a «Convertir en cita»', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Evento Google escudo I3')
  filaGoogle(titulo, fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '20:00', TZ), 'evento')
  await abrirAgendaV2(page)
  await eventoConTexto(page, titulo).click({ position: { x: 6, y: 6 } })
  await tarjetaLectura(page).getByRole('button', { name: 'Convertir en cita' }).click()
  await page.getByRole('button', { name: 'Registrar paciente nuevo' }).click()
  await registro(page).locator('label:text-is("Nombre") + input').fill('Zoila')
  await registro(page).locator('label:text-is("Apellidos") + input').fill(APELLIDOS_NUEVO)
  await registro(page).getByRole('checkbox').check()
  expect(await clicsQueLleganTrasDobleClic(page, registro(page).getByRole('button', { name: 'Crear y continuar' }))).toBe(1)
  await expect(page.getByRole('dialog', { name: 'Convertir en cita' })).toBeVisible()
})
