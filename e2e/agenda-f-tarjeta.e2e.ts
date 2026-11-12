import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, diaDeLaSemana, interruptorAgenda, modalCita, sqlLocal, toastConTexto, tituloUnico } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2, contarPeticiones, tarjetaLectura } from './interaccionesAyudas'
import { crearCitaPorLigar, limpiarReservasE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * F3.2 · La tarjeta de lectura (bloque F, detrás del interruptor `agendaV2`).
 *
 * APAGADO: un clic en una cita abre «Editar cita» directo, como hoy.
 * ENCENDIDO: abre la tarjeta (diálogo nombrado por el paciente, foco en la
 * primera acción, flechas en la barra, Escape devuelve el foco a la cita), y
 * sus acciones hacen lo de siempre por las puertas de siempre:
 *   · Confirmar → PUT `confirmed` (`cambiarEstadoCita`, de `guardadoCitas`);
 *   · Cancelar → aviso y PUT `cancelled`, NUNCA un DELETE (B3);
 *   · Eliminar → sólo en un evento sin paciente, con aviso y DELETE;
 *   · Editar → el modal de hoy; Reagendar → el modal con el foco en la fecha;
 *   · Iniciar consulta → `/expediente/<paciente>/nueva-nota?cita=<id>`; en una
 *     por ligar, el modal (donde vive D7).
 * En el teléfono es una hoja inferior.
 *
 * ⚠️ DOS PRUEBAS DEPENDEN DE ARCHIVOS AJENOS (`contratosV2.ts`): «Confirmar»
 * sale sólo cuando `crearGuardadoCitas` devuelva `cambiarEstadoCita`
 * (Movimiento), y el foco en la fecha de «Reagendar» cuando el modal acepte
 * `enfocar` (Superficie). Hasta integrarlos, esas dos se quedan en rojo.
 *
 * MUTACIONES: quitar `agendaV2 ?` en `abrirCita` → «apagado» ve la tarjeta;
 * mandar «cancelar» a `handleDelete` → sale un DELETE; quitar `pideConfirmacion`
 * del enchufe → la cita se cancela sin aviso.
 *
 * ⚠️ NO SE GUARDA NINGUNA NOTA (ver `agenda-ligar-consulta.e2e.ts`): «Iniciar
 * consulta» sólo se comprueba hasta la URL.
 */
test.use({ storageState: SESION.adminA })

test.afterEach(() => {
  limpiarReservasE2e()
  interruptorAgenda('A', false)
})

const TZ = 'America/Merida'
const VIERNES = diaDeLaSemana(2, 4)

function idsAdminA(apellidos: string): { medico: string; consultorio: string; paciente: string } {
  const [medico, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Hospital Norte (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = :'ap'
     where u.email = 'admin.a@semilla.spinus.test'`, { ap: apellidos }).split('|')
  if (!paciente) throw new Error('idsAdminA: no se encontraron los datos de la semilla')
  return { medico, consultorio, paciente }
}

/** Alta por la API en el viernes de la semana +2; `apellidos` null = evento sin paciente. */
async function alta(page: Page, hora: string, apellidos: string | null, titulo?: string): Promise<{ id: string; paciente: string }> {
  const ids = idsAdminA(apellidos ?? 'Prueba 15')
  const res = await page.request.post('/api/appointments', { data: {
    title: apellidos ? `Paciente ${apellidos}` : titulo, start_time: fechaHoraLocalAInstante(VIERNES, hora, TZ),
    end_time: new Date(new Date(fechaHoraLocalAInstante(VIERNES, hora, TZ)).getTime() + 25 * 60_000).toISOString(),
    medico_id: ids.medico, consultorio_id: ids.consultorio, paciente_id: apellidos ? ids.paciente : null, notes: null, status: 'scheduled',
  } })
  expect(res.ok(), await res.text()).toBeTruthy()
  return { id: ((await res.json()) as { appointment: { id: string } }).appointment.id, paciente: ids.paciente }
}

async function aLaSemanaMasDos(page: Page): Promise<void> {
  const siguiente = page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first()
  await siguiente.click()
  await siguiente.click()
}

function citaEnRejilla(page: Page, texto: string) {
  return page.locator('.fc-event', { hasText: texto }).first()
}

function soloEn(proyecto: 'escritorio' | 'telefono'): void {
  test.skip(test.info().project.name !== proyecto, `sólo en el proyecto ${proyecto}`)
}

test('apagado: un clic en una cita abre «Editar cita» directo, sin tarjeta', async ({ page }) => {
  soloEn('escritorio')
  await alta(page, '14:05', 'Prueba 15')
  await abrirAgendaApagada(page)
  await aLaSemanaMasDos(page)
  await citaEnRejilla(page, 'Prueba 15').click()
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await expect(tarjetaLectura(page)).toHaveCount(0)
})

test('encendido: tarjeta nombrada por el paciente, foco en la primera acción, flechas y Escape devuelve el foco a la cita', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  await alta(page, '14:05', 'Prueba 15')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  const laCita = citaEnRejilla(page, 'Prueba 15')
  await laCita.click()
  const t = tarjetaLectura(page)
  await expect(t).toHaveAccessibleName('Paciente Prueba 15')
  await expect(t).toHaveAttribute('aria-modal', 'true')
  await expect(modalCita(page, 'Editar cita')).toHaveCount(0)
  const botones = t.getByRole('toolbar', { name: 'Acciones de la cita' }).getByRole('button')
  await expect(botones.first()).toBeFocused()
  await expect(botones.first()).toHaveText('Iniciar consulta')
  await page.keyboard.press('ArrowRight')
  await expect(botones.nth(1)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(t).toHaveCount(0)
  await expect(laCita).toBeFocused()
  // Y por teclado: Enter sobre la cita la abre igual.
  await page.keyboard.press('Enter')
  await expect(tarjetaLectura(page)).toBeVisible()
})

/* Pendiente de `cambiarEstadoCita` en `guardadoCitas.ts` (movimiento): sin ella la tarjeta no ofrece Confirmar. */
test('encendido: Confirmar manda PUT confirmed', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  const { id } = await alta(page, '14:40', 'Prueba 16')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await citaEnRejilla(page, 'Prueba 16').click()
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await tarjetaLectura(page).getByRole('button', { name: 'Confirmar', exact: true }).click()
  const res = await put
  expect(res.ok()).toBeTruthy()
  expect(res.request().postDataJSON()).toMatchObject({ status: 'confirmed' })
  await expect.poll(() => sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('confirmed')
})

test('encendido: Cancelar pregunta y manda PUT cancelled; NINGÚN DELETE (B3)', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  const { id } = await alta(page, '15:15', 'Prueba 17')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  const deletes = contarPeticiones(page, 'DELETE')
  await citaEnRejilla(page, 'Prueba 17').click()
  await tarjetaLectura(page).getByRole('button', { name: 'Cancelar cita', exact: true }).click()
  const aviso = page.getByRole('dialog', { name: /Cancelar la cita de Paciente Prueba 17/ })
  await expect(aviso).toBeVisible()
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await aviso.getByRole('button', { name: 'Aceptar' }).click()
  expect((await put).request().postDataJSON()).toMatchObject({ status: 'cancelled' })
  await expect(toastConTexto(page, 'Se canceló la cita')).toBeVisible()
  expect(deletes.cuantas()).toBe(0)
  expect(sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('cancelled')
})

test('encendido: Editar abre el modal de hoy', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  await alta(page, '15:50', 'Prueba 18')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await citaEnRejilla(page, 'Prueba 18').click()
  await tarjetaLectura(page).getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await expect(tarjetaLectura(page)).toHaveCount(0)
})

/* Pendiente de `ModalState.edit.enfocar` en `AppointmentModal` (superficie). */
test('encendido: Reagendar abre el modal con el foco en la fecha', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  await alta(page, '15:50', 'Prueba 18')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  const modal = modalCita(page, 'Editar cita')
  await citaEnRejilla(page, 'Prueba 18').click()
  await tarjetaLectura(page).getByRole('button', { name: 'Reagendar', exact: true }).click()
  await expect(modal).toBeVisible()
  await expect(modal.locator('input[type="date"]').first()).toBeFocused()
})

test('encendido: Iniciar consulta lleva a la nota con ?cita=', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  const { id, paciente } = await alta(page, '16:25', 'Prueba 19')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await citaEnRejilla(page, 'Prueba 19').click()
  await tarjetaLectura(page).getByRole('button', { name: 'Iniciar consulta', exact: true }).click()
  await page.waitForURL(`**/expediente/${paciente}/nueva-nota?cita=${id}`)
})

test('encendido: en una por ligar, Iniciar consulta abre el modal (donde vive D7), no la nota', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  const nombre = tituloUnico('Persona F3')
  crearCitaPorLigar({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(VIERNES, '17:00', TZ), minutos: 30, nombre, canal: 'fijo' })
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await citaEnRejilla(page, nombre).click({ position: { x: 8, y: 8 } })
  await tarjetaLectura(page).getByRole('button', { name: 'Iniciar consulta', exact: true }).click()
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  expect(page.url()).toContain('/agenda')
})

test('encendido: un evento sin paciente ofrece Editar y Eliminar; Eliminar pregunta y manda DELETE', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Evento F3')
  const { id } = await alta(page, '14:05', null, titulo)
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await citaEnRejilla(page, titulo).click()
  const t = tarjetaLectura(page)
  await expect(t.getByRole('toolbar').getByRole('button')).toHaveText(['Editar', 'Eliminar evento'])
  await t.getByRole('button', { name: 'Eliminar evento' }).click()
  const aviso = page.getByRole('dialog', { name: /Eliminar el evento/ })
  const del = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'DELETE')
  await aviso.getByRole('button', { name: 'Aceptar' }).click()
  expect((await del).ok()).toBeTruthy()
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(0)
})

test('encendido: la tarjeta trae el botón de WhatsApp de E7 y abrirla no emite ningún enlace', async ({ page }) => {
  soloEn('escritorio')
  interruptorAgenda('A', true)
  const { id } = await alta(page, '14:40', 'Prueba 20')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await citaEnRejilla(page, 'Prueba 20').click()
  await expect(tarjetaLectura(page).locator(`[data-whatsapp-cita="${id}"]`)).toBeVisible()
  expect(sqlLocal(`select count(*) from public.cita_confirmaciones where appointment_id = :'id'`, { id })).toBe('0')
})

test('teléfono encendido: la tarjeta es una hoja inferior', async ({ page }) => {
  soloEn('telefono')
  interruptorAgenda('A', true)
  await alta(page, '14:05', 'Prueba 15')
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await page.locator('.fc-list-event', { hasText: 'Prueba 15' }).first().click()
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  await expect(t).toHaveClass(/ag-hoja/)
})
