import { test, expect, type Page } from '@playwright/test'
import {
  irAAgenda, modalCita, soloEscritorio, SESION, DIA_LABORABLE_LIBRE, tituloUnico,
  eventoConTexto, toastConTexto, enContextoNuevo, interruptorAgenda, sqlLocal,
} from './ayudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * B3 · Cancelar en vez de borrar (plan del bloque B). Con el interruptor
 * ENCENDIDO, «eliminar» una cita con paciente la cancela: la tarjeta se queda,
 * la base dice `cancelled` y la auditoría de B0 deja `cita_cancelada`. Un
 * evento sin paciente se sigue borrando, y un DELETE directo a una cita con
 * paciente contesta 409. Con el interruptor APAGADO (el estado del
 * `globalSetup`) la papelera de una cita con paciente borra como siempre.
 *
 * Google: la base local no tiene ninguna clínica conectada, así que aquí no
 * viaja nada; lo que la cancelación manda a Google lo fija la prueba de Vitest
 * `src/lib/tests/cancelarCita.test.ts`, contra un Google simulado.
 *
 * Cada prueba crea sus propias citas por la API (con la sesión del
 * administrador) y sólo toca ésas.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test.afterEach(() => {
  interruptorAgenda('A', false)
})

const TZ = 'America/Merida'

/** Los ids de la semilla que hacen falta para dar de alta por la API. */
function idsAdminA(): { medico: string; consultorio: string; paciente: string } {
  const [medico, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Consultorio Centro (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = 'Prueba 07'
     where u.email = 'admin.a@semilla.spinus.test'`).split('|')
  if (!paciente) throw new Error('idsAdminA: no se encontraron los datos de la semilla')
  return { medico, consultorio, paciente }
}

/** Da de alta por la API (como el modal) y devuelve el id. */
async function alta(page: Page, opciones: { hora: string; minutos: number; paciente: boolean; titulo: string }): Promise<string> {
  const ids = idsAdminA()
  const inicio = fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, opciones.hora, TZ)
  const fin = new Date(new Date(inicio).getTime() + opciones.minutos * 60_000).toISOString()
  const res = await page.request.post('/api/appointments', {
    data: {
      title: opciones.titulo, start_time: inicio, end_time: fin, medico_id: ids.medico, consultorio_id: ids.consultorio,
      paciente_id: opciones.paciente ? ids.paciente : null, notes: null, status: 'scheduled',
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const { appointment } = await res.json() as { appointment: { id: string } }
  return appointment.id
}

function estadoEnBase(id: string): string {
  return sqlLocal(`select coalesce((select status from public.appointments where id = :'id'), 'BORRADA')`, { id })
}
function auditorias(id: string, accion: string): number {
  return Number(sqlLocal(`select count(*) from public.audit_log
                           where tabla = 'appointments' and registro_id = :'id' and accion = :'accion'`, { id, accion }))
}

/** La tarjeta de una cita de Paciente Prueba 07 a esa hora. */
function tarjetaDe(page: Page, hora: string) {
  return page.locator('.fc-event', { hasText: 'Paciente Prueba 07' }).filter({ hasText: hora })
}

async function abrirAgendaV2(page: Page): Promise<void> {
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'encendida')
}

test('encendido: la papelera de una cita con paciente la CANCELA; sigue pintada y queda cita_cancelada', async ({ page, browser }) => {
  interruptorAgenda('A', true)
  const id = await alta(page, { hora: '15:05', minutos: 25, paciente: true, titulo: 'Paciente Prueba 07' })
  await abrirAgendaV2(page)

  await tarjetaDe(page, '15:05').click()
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eliminar cita', exact: true })).toHaveCount(0)

  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Cancelar cita', exact: true }).click()
  const res = await resp
  expect(res.ok()).toBeTruthy()
  expect(res.request().postDataJSON()).toMatchObject({ status: 'cancelled' })
  await expect(toastConTexto(page, 'Se canceló la cita')).toBeVisible()

  await expect(tarjetaDe(page, '15:05')).toHaveCount(1)
  await expect(tarjetaDe(page, '15:05')).toHaveClass(/ag-ev-status--cancelled/)
  expect(estadoEnBase(id)).toBe('cancelled')
  expect(auditorias(id, 'cita_cancelada')).toBe(1)
  expect(auditorias(id, 'cita_eliminada')).toBe(0)

  // Reabierta: ya cancelada, no ofrece ni cancelar, ni eliminar, ni la X.
  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await abrirAgendaV2(pagina)
    await tarjetaDe(pagina, '15:05').click()
    await expect(modalCita(pagina, 'Editar cita')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Cancelar cita', exact: true })).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: 'Eliminar cita', exact: true })).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: /^Quitar paciente/ })).toHaveCount(0)
  })
})

test('encendido: la X del paciente también cancela, con su propio aviso', async ({ page }) => {
  interruptorAgenda('A', true)
  const id = await alta(page, { hora: '15:40', minutos: 25, paciente: true, titulo: 'Paciente Prueba 07' })
  await abrirAgendaV2(page)

  await tarjetaDe(page, '15:40').click()
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await page.getByRole('button', { name: 'Quitar paciente y cancelar la cita', exact: true }).click()
  const aviso = page.getByRole('dialog', { name: /quitar al paciente CANCELA la cita/ })
  await expect(aviso).toBeVisible()

  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await aviso.getByRole('button', { name: 'Aceptar' }).click()
  expect((await resp).ok()).toBeTruthy()
  await expect(tarjetaDe(page, '15:40')).toHaveClass(/ag-ev-status--cancelled/)
  expect(estadoEnBase(id)).toBe('cancelled')
  expect(auditorias(id, 'cita_cancelada')).toBe(1)
})

test('encendido: un evento sin paciente se sigue borrando y deja cita_eliminada', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Evento B3 para borrar')
  const id = await alta(page, { hora: '08:05', minutos: 20, paciente: false, titulo })
  await abrirAgendaV2(page)

  await eventoConTexto(page, titulo).click()
  await expect(modalCita(page, 'Editar evento')).toBeVisible()
  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Eliminar evento', exact: true }).click()
  expect((await resp).ok()).toBeTruthy()
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(0)
  expect(estadoEnBase(id)).toBe('BORRADA')
  expect(auditorias(id, 'cita_eliminada')).toBe(1)
})

test('encendido: un DELETE directo sobre una cita con paciente contesta 409 y no borra', async ({ page }) => {
  interruptorAgenda('A', true)
  const id = await alta(page, { hora: '16:20', minutos: 15, paciente: true, titulo: 'Paciente Prueba 07' })
  const res = await page.request.delete(`/api/appointments/${id}`)
  expect(res.status()).toBe(409)
  expect(await res.json()).toMatchObject({ error: 'cita_con_paciente' })
  expect(estadoEnBase(id)).toBe('scheduled')
  expect(auditorias(id, 'cita_eliminada')).toBe(0)

  // Tampoco por la puerta de atrás: dejarla sin paciente para luego borrarla.
  const desligar = await page.request.put(`/api/appointments/${id}`, { data: { paciente_id: null } })
  expect(desligar.status()).toBe(409)
  expect(sqlLocal(`select paciente_id is not null from public.appointments where id = :'id'`, { id })).toBe('t')
})

test('apagado: la papelera de una cita con paciente borra como siempre', async ({ page }) => {
  const id = await alta(page, { hora: '16:40', minutos: 15, paciente: true, titulo: 'Paciente Prueba 07' })
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')

  await tarjetaDe(page, '16:40').click()
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar cita', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quitar paciente y eliminar la cita', exact: true })).toBeVisible()

  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Eliminar cita', exact: true }).click()
  expect((await resp).ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se eliminó de la agenda')).toBeVisible()
  await expect(tarjetaDe(page, '16:40')).toHaveCount(0)
  expect(estadoEnBase(id)).toBe('BORRADA')
  expect(auditorias(id, 'cita_eliminada')).toBe(1)
})
