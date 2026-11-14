import { test, expect, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, modalCita, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaV2, burbuja, clicEnFranja, elegirPaciente, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * T1 · Puntos 2, 4, 13 y 14 de Angel (escritorio, interruptor encendido).
 *
 *   · 2: la burbuja ofrece «Registrar "…"» si el paciente no existe y abre
 *     `QuickPatientModal` (consentimiento obligatorio); el creado queda elegido.
 *   · 13 y 14: tras Guardar, la burbuja enseña «Cita agendada», el foco va a
 *     «Listo» (la principal) y ofrece «Enviar por WhatsApp» (con el logo en su
 *     verde) e «Invitar por correo» (sólo si habrá evento de Google), con «Más
 *     opciones» junto a «Listo».
 *   · 4: el botón de WhatsApp no sale en una cita pasada, atendida o de todo el
 *     día; y si aun así se llega al error (la cita cambió con la tarjeta
 *     abierta), el motivo se dice en llano.
 *
 * Todo en la SEMANA +3 (la semilla siembra de la −2 a la +2 y las demás e2e de
 * la burbuja usan la +2), entre 14:00 y 16:00; la cita pasada, en la −3.
 *
 * MUTACIONES (cada una pone en rojo su prueba):
 *   · 2: quitar la opción «Registrar» de `CampoPaciente` (`BurbujaAlta.tsx`);
 *   · 13: en `BurbujaAlta.guardar`, `salir()` también con alta (como antes);
 *   · 4: en `CapaTarjeta` (`InteraccionesV2.tsx`) volver a `viva && !esEventoGenerico`
 *     como condición del WhatsApp; y en `BotonWhatsAppCita` volver al texto
 *     único de `no_aplica`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const MARTES = diaDeLaSemana(3, 1)
const MIERCOLES = diaDeLaSemana(3, 2)
const JUEVES = diaDeLaSemana(3, 3)
const VIERNES_PASADO = diaDeLaSemana(-3, 4)
const NUEVO = { nombre: 'Zoila', apellidos: 'Burbujat Uno' }
const creadas: string[] = []

test.afterEach(() => {
  sqlLocal(`
    delete from public.cita_confirmaciones where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
    delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]);
    delete from public.paciente_medico where paciente_id in (select id from public.pacientes where apellidos = :'ap');
    delete from public.pacientes where apellidos = :'ap';`,
  { ids: creadas.join(',') || '00000000-0000-0000-0000-000000000000', ap: NUEVO.apellidos })
  creadas.length = 0
  interruptorAgenda('A', false)
})

async function aLaSemanaMasTres(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${MARTES}"]`)).toBeVisible()
}

function idsAdminA(apellidos: string): { medico: string; consultorio: string; paciente: string } {
  const [medico, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id from auth.users u join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Hospital Norte (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = :'ap'
     where u.email = 'admin.a@semilla.spinus.test'`, { ap: apellidos }).split('|')
  return { medico, consultorio, paciente }
}

/** Una cita por la API (con el empalme aceptado si lo hubiera). */
async function alta(page: Page, fecha: string, hora: string, apellidos: string): Promise<string> {
  const ids = idsAdminA(apellidos)
  const inicio = fechaHoraLocalAInstante(fecha, hora, TZ)
  const cuerpo = {
    title: `Paciente ${apellidos}`, start_time: inicio, end_time: new Date(new Date(inicio).getTime() + 25 * 60_000).toISOString(),
    medico_id: ids.medico, consultorio_id: ids.consultorio, paciente_id: ids.paciente, notes: null, status: 'scheduled',
  }
  let res = await page.request.post('/api/appointments', { data: cuerpo })
  if (res.status() === 409) {
    const { empalmes } = await res.json() as { empalmes: { id: string }[] }
    res = await page.request.post('/api/appointments', { data: { ...cuerpo, empalmes_aceptados: empalmes.map(e => e.id) } })
  }
  expect(res.ok(), await res.text()).toBeTruthy()
  const id = ((await res.json()) as { appointment: { id: string } }).appointment.id
  creadas.push(id)
  return id
}

/**
 * Guardar en la burbuja. En la batería completa otras e2e dejan citas en esta
 * semana: si sale el aviso de empalme (B7), se acepta (aquí no se prueba B7).
 */
async function guardarEnBurbuja(page: Page): Promise<void> {
  await burbuja(page).getByRole('button', { name: 'Guardar', exact: true }).click()
  const aviso = page.getByRole('dialog', { name: /Se empalma/ })
  const hecho = burbuja(page).getByText('Cita agendada', { exact: true })
  await expect(aviso.or(hecho).first()).toBeVisible()
  if (await aviso.count()) await aviso.getByRole('button', { name: 'Aceptar' }).click()
}

test('punto 2: un paciente que no existe se registra desde la burbuja (con consentimiento) y queda elegido', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, MIERCOLES, '14:30')
  const b = burbuja(page)
  await b.getByRole('combobox').fill(`${NUEVO.nombre} ${NUEVO.apellidos}`)
  await b.getByRole('option', { name: /Registrar «Zoila Burbujat Uno»/ }).click()
  const qpm = page.locator('div.fixed', { has: page.getByRole('heading', { name: 'Registrar paciente' }) }).last()
  await expect(qpm.getByRole('heading', { name: 'Registrar paciente' })).toBeVisible()
  await expect(b).toBeVisible()
  // Sin el consentimiento no se crea (regla de CLAUDE.md, la del formulario completo).
  await qpm.getByRole('button', { name: 'Crear y continuar' }).click()
  await expect(qpm.getByText('Debes marcar el consentimiento del aviso de privacidad.')).toBeVisible()
  await qpm.getByRole('checkbox').check()
  await qpm.getByRole('button', { name: 'Crear y continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Registrar paciente' })).toHaveCount(0)
  await expect(b.getByRole('combobox')).toHaveValue('Zoila Burbujat Uno')
  await expect(b.getByRole('button', { name: 'Guardar', exact: true })).toBeFocused()
  expect(sqlLocal(`select count(*) from public.pacientes where apellidos = :'ap' and consentimiento_otorgado is true`, { ap: NUEVO.apellidos })).toBe('1')
})

test('puntos 13 y 14: tras Guardar, «Cita agendada» con «Listo» (foco) y WhatsApp con su logo; sin Google, sin invitar', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, MARTES, '14:30')
  const b = burbuja(page)
  await elegirPaciente(b, 'Prueba 21')
  const post = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/appointments'))
  await guardarEnBurbuja(page)
  creadas.push(((await (await post).json()) as { appointment: { id: string } }).appointment.id)
  await expect(b.getByRole('status')).toHaveText(/^Cita agendada: /)
  await expect(b.getByText('Cita agendada', { exact: true })).toBeVisible()
  const listo = b.getByRole('button', { name: 'Listo', exact: true })
  await expect(listo).toBeFocused()
  await expect(listo).toHaveClass(/ag-capa-boton--principal/)
  const wa = b.getByRole('button', { name: 'Enviar por WhatsApp' })
  await expect(wa).toBeVisible()
  await expect(wa.locator('svg path[fill="#25D366"]')).toHaveCount(1)
  await expect(b.getByRole('button', { name: 'Invitar por correo' })).toHaveCount(0)
  // Simetría: «Listo» y «Más opciones» en la misma fila y del mismo ancho.
  const [l, m] = [await listo.boundingBox(), await b.getByRole('button', { name: 'Más opciones' }).boundingBox()]
  expect(l && m && Math.abs(l.y - m.y) < 1 && Math.abs(l.width - m.width) < 1).toBe(true)
  await b.getByRole('button', { name: 'Más opciones' }).click()
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await expect(b).toHaveCount(0)
})

test('punto 13: con el evento de Google en camino, «Invitar por correo» abre la invitación y cierra la burbuja', async ({ page }) => {
  interruptorAgenda('A', true)
  /* Sin Google conectado en local, la respuesta se marca `pending` como la de
     una clínica conectada: lo que se prueba es la burbuja, no Google. */
  await page.route('**/api/appointments', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    const res = await route.fetch()
    const json = await res.json() as { appointment?: { id: string }; gcalSync?: string }
    if (json.appointment?.id) creadas.push(json.appointment.id)
    await route.fulfill({ response: res, json: { ...json, gcalSync: 'pending' } })
  })
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, JUEVES, '14:30')
  const b = burbuja(page)
  await elegirPaciente(b, 'Prueba 22')
  await guardarEnBurbuja(page)
  await expect(b.getByText('Cita agendada', { exact: true })).toBeVisible()
  // Desde la burbuja la invitación NO se abre sola: es un botón.
  await expect(page.getByRole('dialog', { name: 'Invitar por correo' })).toHaveCount(0)
  await b.getByRole('button', { name: 'Invitar por correo' }).click()
  await expect(page.getByRole('dialog', { name: 'Invitar por correo' })).toBeVisible()
  await expect(b).toHaveCount(0)
})

test('punto 4: en una cita PASADA, atendida o de todo el día la tarjeta no ofrece WhatsApp; en una futura, sí', async ({ page }) => {
  interruptorAgenda('A', true)
  const pasada = await alta(page, VIERNES_PASADO, '14:40', 'Prueba 23')
  const futura = await alta(page, JUEVES, '15:20', 'Prueba 24')
  await abrirAgendaV2(page)
  for (let i = 0; i < 3; i++) await page.locator('.fc-prev-button').click()
  await page.locator('.fc-event', { hasText: 'Prueba 23' }).first().click()
  await expect(tarjetaLectura(page)).toBeVisible()
  await expect(tarjetaLectura(page).locator(`[data-whatsapp-cita="${pasada}"]`)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.locator('.fc-today-button').click()
  await aLaSemanaMasTres(page)
  const cita = page.locator('.fc-event', { hasText: 'Prueba 24' }).first()
  await cita.click()
  await expect(tarjetaLectura(page).locator(`[data-whatsapp-cita="${futura}"]`)).toBeVisible()
  await page.keyboard.press('Escape')
  sqlLocal(`update public.appointments set status = 'attended' where id = :'id'`, { id: futura })
  await page.reload()
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await page.locator('.fc-event', { hasText: 'Prueba 24' }).first().click()
  await expect(tarjetaLectura(page)).toBeVisible()
  await expect(tarjetaLectura(page).locator(`[data-whatsapp-cita="${futura}"]`)).toHaveCount(0)
})

test('punto 4: si la cita cambió con la tarjeta abierta, el error dice el motivo en llano', async ({ page, context }) => {
  interruptorAgenda('A', true)
  const id = await alta(page, JUEVES, '15:20', 'Prueba 25')
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await page.locator('.fc-event', { hasText: 'Prueba 25' }).first().click()
  const t = tarjetaLectura(page)
  await expect(t.locator(`[data-whatsapp-cita="${id}"]`)).toBeVisible()
  sqlLocal(`update public.appointments set status = 'cancelled' where id = :'id'`, { id })
  const pestana = context.waitForEvent('page')
  await t.getByRole('button', { name: 'Enviar por WhatsApp' }).click()
  await (await pestana).waitForEvent('close')
  await expect(t.getByRole('alert')).toHaveText('La cita está cancelada.')
  expect(sqlLocal(`select count(*) from public.cita_confirmaciones where appointment_id = :'id'`, { id })).toBe('0')
})
