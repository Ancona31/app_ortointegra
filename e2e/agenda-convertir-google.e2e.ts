import { test, expect, type Page } from '@playwright/test'
import { CORREO, DIA_LABORABLE_LIBRE, SESION, interruptorAgenda, modalCita, soloEscritorio, sqlLocal, tituloUnico } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * T3 · punto 6 (AG-DT-29, §2 del plan): un evento NACIDO EN GOOGLE (fila con
 * `origen = 'google'` y sin paciente) se convierte en cita con paciente desde
 * la tarjeta de lectura, detrás del interruptor de la v2.
 *
 * Aquí, sin Google: la fila importada se siembra como `postgres`, con un
 * `google_event_id` de mentira y SIN conexión de la clínica, así que el
 * `after()` del PUT no habla con nadie. Lo que viaja a Google (título del
 * paciente, sin observaciones; C-d al volver) lo prueba
 * `agenda-google-dos-sentidos.e2e.ts` contra el Google falso.
 *
 * MUTACIONES (comprobadas en rojo al escribirlas): quitar «convertir» de
 * `accionesDeTarjeta` → las dos primeras; quitar la llamada a
 * `vetoDeConversion` del PUT → «el servidor…» y «sin acceso»; quitar
 * `puedeAgendar` del enchufe → «sin acceso» (no sale el aviso).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const CLINICA_A = 'Clínica Semilla A'
const creadas: string[] = []
/* Lo que hay que devolver a la clínica A al acabar, aunque la prueba se corte por tiempo. */
let restaurarClinica: (() => void) | null = null

/** Una fila como las que importa el sondeo (C2, `gcal_importar_evento`), del administrador de A. */
function sembrarEventoDeGoogle(titulo: string, hora: string): string {
  const inicio = fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, hora, TZ)
  const fin = new Date(Date.parse(inicio) + 30 * 60_000).toISOString()
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, title, start_time, end_time, all_day, status, notes,
                                     google_event_id, gcal_sync_status, origen, medico_id, consultorio_timezone)
    select c.id, :'titulo', :'inicio'::timestamptz, :'fin'::timestamptz, false, 'scheduled', 'Notas que vinieron de Google',
           'falso-t3-' || md5(:'titulo'), 'synced', 'google', u.id, :'tz'
      from public.clinicas c, auth.users u where c.nombre = :'clinica' and u.email = :'correo'
    returning id`, { titulo, inicio, fin, tz: TZ, clinica: CLINICA_A, correo: CORREO.adminA })
  creadas.push(id)
  return id
}

function fila(id: string): { paciente: string; titulo: string; origen: string; evento: string; notas: string; consultorio: string } {
  const [paciente, titulo, origen, evento, notas, consultorio] = sqlLocal(`
    select coalesce(paciente_id::text, ''), title, origen, coalesce(google_event_id, ''), coalesce(notes, ''), coalesce(consultorio_id::text, '')
      from public.appointments where id = :'id'`, { id }).split('|')
  return { paciente, titulo, origen, evento, notas, consultorio }
}

function idDe(consulta: string, params: Record<string, string>): string {
  const id = sqlLocal(consulta, params)
  if (!id) throw new Error(`sin resultado: ${consulta}`)
  return id
}

const consultorioAdminA = (): string => idDe(`select co.id from public.consultorios co join auth.users u on u.id = co.medico_id
  where u.email = :'correo' and co.activo order by co.nombre limit 1`, { correo: CORREO.adminA })
const pacienteDe = (apellidos: string): string => idDe(`select id from public.pacientes where apellidos = :'a' limit 1`, { a: apellidos })

async function abrirTarjetaDe(page: Page, titulo: string): Promise<void> {
  await page.locator('.fc-event', { hasText: titulo }).first().click()
  await expect(tarjetaLectura(page)).toBeVisible()
}

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => {
  restaurarClinica?.()
  restaurarClinica = null
  interruptorAgenda('A', false)
  // Como `postgres`: con la v2 encendida la base no deja borrar citas a nadie más.
  while (creadas.length) sqlLocal(`delete from public.appointments where id = :'id'`, { id: creadas.pop() ?? '' })
})

test('la tarjeta de un evento nacido en Google ofrece «Convertir en cita»; la de uno de Spinus, no', async ({ page }) => {
  const titulo = tituloUnico('Junta en Google T3')
  sembrarEventoDeGoogle(titulo, '16:00')
  await abrirAgendaV2(page)
  await abrirTarjetaDe(page, titulo)
  const barra = tarjetaLectura(page).getByRole('toolbar', { name: 'Acciones de la cita' })
  await expect(barra.getByRole('button')).toHaveText(['Editar', 'Convertir en cita', 'Eliminar evento'])
  await page.keyboard.press('Escape')

  await abrirTarjetaDe(page, 'Cirugía programada')
  await expect(tarjetaLectura(page).getByRole('button', { name: 'Convertir en cita' })).toHaveCount(0)
})

test('convertir: elegir paciente y consultorio liga la fila sin perder su vínculo con Google, y se audita', async ({ page }) => {
  const titulo = tituloUnico('Evento Google a cita T3')
  const id = sembrarEventoDeGoogle(titulo, '16:30')
  const antes = fila(id)
  const desde = sqlLocal('select now()')
  await abrirAgendaV2(page)
  await abrirTarjetaDe(page, titulo)
  await tarjetaLectura(page).getByRole('button', { name: 'Convertir en cita' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Convertir en cita' })
  await expect(dialogo).toBeVisible()
  const convertir = dialogo.getByRole('button', { name: 'Convertir en cita' })
  await expect(convertir).toBeDisabled()
  await dialogo.getByRole('combobox', { name: 'Paciente' }).fill('Prueba 22')
  await dialogo.getByRole('option', { name: /Paciente Prueba 22/ }).click()
  const consultorio = dialogo.getByLabel('Consultorio')
  if ((await consultorio.inputValue()) === '') await consultorio.selectOption({ index: 1 })
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await convertir.click()
  expect((await put).status()).toBe(200)

  const despues = fila(id)
  expect(despues.paciente).toBe(pacienteDe('Prueba 22'))
  expect(despues.titulo).toBe('Paciente Prueba 22')
  expect(despues.consultorio).not.toBe('')
  // Sigue siendo la fila de Google, con su vínculo, y sus notas se quedan en Spinus.
  expect([despues.origen, despues.evento, despues.notas]).toEqual(['google', antes.evento, 'Notas que vinieron de Google'])
  expect(sqlLocal(`select count(*) from public.audit_log where accion = 'cita_ligada' and registro_id = :'id'
                     and created_at >= :'desde'::timestamptz and descripcion like '%"via":"convertir"%'`, { id, desde })).toBe('1')
  // En la agenda ya es la cita del paciente.
  await abrirTarjetaDe(page, 'Paciente Prueba 22')
  await expect(tarjetaLectura(page).getByRole('button', { name: 'Cancelar cita' }).first()).toBeVisible()
})

test('el servidor: paciente de otra clínica o sin consultorio, 400 y nada escrito', async ({ page }) => {
  const id = sembrarEventoDeGoogle(tituloUnico('Evento Google veto T3'), '17:00')
  await abrirAgendaV2(page)
  const ajeno = await page.request.put(`/api/appointments/${id}`, {
    data: { paciente_id: pacienteDe('Prueba B1'), title: 'Paciente Prueba B1', consultorio_id: consultorioAdminA() },
  })
  expect(ajeno.status()).toBe(400)
  expect((await ajeno.json()).error).toBe('paciente_invalido')
  const sinConsultorio = await page.request.put(`/api/appointments/${id}`, {
    data: { paciente_id: pacienteDe('Prueba 21'), title: 'Paciente Prueba 21' },
  })
  expect(sinConsultorio.status()).toBe(400)
  expect((await sinConsultorio.json()).error).toBe('consultorio_id_required')
  expect(fila(id).paciente).toBe('')
})

test('clínica sin acceso: la tarjeta enseña el aviso de suscripción y el PUT da 403', async ({ page }) => {
  const titulo = tituloUnico('Evento Google sin acceso T3')
  const id = sembrarEventoDeGoogle(titulo, '17:30')
  const original = sqlLocal(`select es_vip_grant || '|' || coalesce(ha_tenido_acceso_premium::text, 'null') || '|' || suscripcion_estado
                               from public.clinicas where nombre = :'c'`, { c: CLINICA_A })
  const [vip, latch, estado] = original.split('|')
  restaurarClinica = () => sqlLocal(`update public.clinicas set es_vip_grant = :'vip'::boolean,
                     ha_tenido_acceso_premium = nullif(:'latch', 'null')::boolean, suscripcion_estado = :'estado'
               where nombre = :'c'`, { vip, latch, estado, c: CLINICA_A })
  // Free degradada: tuvo premium, sin VIP y cancelada (RN-1 dice «sin acceso»; `subscription.ts`, bloqueada).
  sqlLocal(`update public.clinicas set es_vip_grant = false, ha_tenido_acceso_premium = true, suscripcion_estado = 'cancelado'
             where nombre = :'c'`, { c: CLINICA_A })
  await abrirAgendaV2(page)
  await abrirTarjetaDe(page, titulo)
  await tarjetaLectura(page).getByRole('button', { name: 'Convertir en cita' }).click()
  await expect(page.getByText('Función no disponible')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Convertir en cita' })).toHaveCount(0)

  const res = await page.request.put(`/api/appointments/${id}`, {
    data: { paciente_id: pacienteDe('Prueba 21'), title: 'Paciente Prueba 21', consultorio_id: consultorioAdminA() },
  })
  expect(res.status()).toBe(403)
  expect(fila(id).paciente).toBe('')
})

test.describe('con el interruptor apagado', () => {
  test.beforeEach(() => { interruptorAgenda('A', false) })

  test('el evento importado abre el modal de siempre: ni tarjeta ni conversión', async ({ page }) => {
    const titulo = tituloUnico('Evento Google apagado T3')
    sembrarEventoDeGoogle(titulo, '18:00')
    await abrirAgendaApagada(page)
    await page.locator('.fc-event', { hasText: titulo }).first().click()
    await expect(modalCita(page, 'Editar evento')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Convertir en cita' })).toHaveCount(0)
  })
})
