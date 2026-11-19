import { test, expect, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { contarCorreos, esperarCorreo } from './mailpit'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * G3 · punto 14 de la tanda de diseño: el correo de CONFIRMACIÓN de Spinus,
 * por el transporte del proyecto (en local, Mailpit), con o sin Google.
 *
 *   · sin Google (la cita no tiene evento) y con Google (la tiene): sale UN
 *     correo al paciente con fecha, hora, médico, consultorio con su dirección
 *     y el enlace ABSOLUTO de confirmar o cancelar; nada clínico (ni el título,
 *     ni las notas, ni el nombre del paciente); queda en `cita_correos`
 *     (`confirmacion`, `enviado`) y en `audit_log` (`enviar_confirmacion_cita`);
 *   · otra vez la misma cita → 409 `ya_enviado`, sin correo nuevo (no se
 *     reenvía en ráfaga);
 *   · el servidor la rechaza aunque se llame a mano en una cita atendida o
 *     cancelada (409, ningún correo, ningún registro) y con el interruptor
 *     apagado (404).
 *
 * MUTACIONES (comprobadas en rojo): quitar `motivoSinCorreo` de la ruta →
 * «atendida o cancelada»; quitar 'confirmacion' de `cita_correo_tomar` (base
 * sin la migración G3) → «sin Google» (503).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const JUEVES = diaDeLaSemana(3, 3)
const creadas: string[] = []

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => {
  if (creadas.length) {
    sqlLocal(`
      delete from public.cita_correos where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.cita_confirmaciones where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]);`, { ids: creadas.join(',') })
    creadas.length = 0
  }
  interruptorAgenda('A', false)
})

/** Una cita de admin.a con `apellidos` en el Hospital Norte, por la API. Notas «clínicas» para comprobar que NO viajan. */
async function alta(page: Page, hora: string, apellidos: string): Promise<string> {
  const [medico, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id from auth.users u join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Hospital Norte (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = :'ap'
     where u.email = 'admin.a@semilla.spinus.test'`, { ap: apellidos }).split('|')
  const inicio = fechaHoraLocalAInstante(JUEVES, hora, TZ)
  const cuerpo = {
    title: `Paciente ${apellidos}`, start_time: inicio, end_time: new Date(new Date(inicio).getTime() + 45 * 60_000).toISOString(),
    medico_id: medico, consultorio_id: consultorio, paciente_id: paciente, notes: 'DIAGNOSTICO SECRETO G3', status: 'scheduled',
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

async function comprobarEnvio(page: Page, id: string, apellidos: string): Promise<void> {
  const para = `paciente.${apellidos.split(' ')[1]}@semilla.spinus.test`
  const previos = await contarCorreos(para, 'Confirma tu cita')
  const res = await page.request.post('/api/agenda/correo', { data: { cita_id: id } })
  expect(res.status(), await res.text()).toBe(200)
  const correo = await esperarCorreo(para, 'Confirma tu cita', previos)
  // Fecha, hora (en la zona del consultorio), médico, consultorio y su dirección.
  expect(correo.texto).toMatch(/jueves,? \d+ de \w+ a las \d\d:\d\d/)
  expect(correo.texto).toContain('Dr. Admin Semilla Uno')
  expect(correo.texto).toContain('Hospital Norte (ficticio), Avenida Ficticia 2, Norte, Mérida')
  // El enlace de confirmar o cancelar, absoluto, en el texto y en el botón del HTML. K2 (punto 8): el botón
  // «Confirmo mi asistencia» lleva `?paso=confirmar` (confirma al abrir); el texto conserva la URL simple.
  const enlace = /(https?:\/\/[^\s/]+\/confirmar\/[A-Za-z0-9_-]{22})\b/.exec(correo.texto)?.[1]
  expect(enlace, 'enlace absoluto de /confirmar/').toBeTruthy()
  expect(correo.html).toContain(`href="${enlace}?paso=confirmar"`)
  // Nada clínico: ni las notas, ni el título, ni los apellidos del paciente. Tanda L (punto 15): sólo su
  // nombre, en el saludo (en rojo si la ruta no pasa `{ nombre }`).
  expect(`${correo.asunto}\n${correo.texto}\n${correo.html}`).not.toMatch(/DIAGNOSTICO|SECRETO|Paciente Prueba|Prueba \d\d/)
  expect(correo.texto).toMatch(/Confirma tu cita\s+Hola, Paciente:\s+Tienes una cita/)
  expect(correo.html).toContain('Hola, Paciente:')
  expect(correo.asunto).not.toContain('Paciente')
  // Registrado como los demás correos de cita, y auditado.
  expect(sqlLocal(`select tipo || '/' || estado from public.cita_correos where appointment_id = :'id'`, { id })).toBe('confirmacion/enviado')
  expect(sqlLocal(`select count(*) from public.audit_log where accion = 'enviar_confirmacion_cita' and registro_id = :'id'`, { id })).toBe('1')
  // Otra vez: 409 ya_enviado y ningún correo más.
  const otra = await page.request.post('/api/agenda/correo', { data: { cita_id: id } })
  expect(otra.status()).toBe(409)
  expect(await otra.json()).toMatchObject({ error: 'ya_enviado' })
  await page.waitForTimeout(800)
  expect(await contarCorreos(para, 'Confirma tu cita')).toBe(previos + 1)
}

test('sin Google: la cita sin evento recibe la confirmación por correo de Spinus, registrada y sin nada clínico', async ({ page }) => {
  const id = await alta(page, '09:00', 'Prueba 13')
  expect(sqlLocal(`select coalesce(google_event_id, '-') from public.appointments where id = :'id'`, { id })).toBe('-')
  await comprobarEnvio(page, id, 'Prueba 13')
})

test('con Google: una cita con evento de Google recibe el MISMO correo de Spinus (la invitación es otra cosa)', async ({ page }) => {
  const id = await alta(page, '10:30', 'Prueba 12')
  sqlLocal(`update public.appointments set google_event_id = 'evento-g3-falso', gcal_sync_status = 'synced' where id = :'id'`, { id })
  await comprobarEnvio(page, id, 'Prueba 12')
})

test('el servidor lo rechaza en una cita atendida o cancelada (sin correo ni registro), y con el interruptor apagado', async ({ page }) => {
  for (const [hora, estado] of [['12:00', 'attended'], ['13:00', 'cancelled']] as const) {
    const id = await alta(page, hora, 'Prueba 11')
    sqlLocal(`update public.appointments set status = :'st' where id = :'id'`, { id, st: estado })
    const res = await page.request.post('/api/agenda/correo', { data: { cita_id: id } })
    expect(res.status()).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'no_aplica', motivo: estado === 'attended' ? 'atendida' : 'cancelada' })
    expect(sqlLocal(`select count(*) from public.cita_correos where appointment_id = :'id'`, { id })).toBe('0')
  }
  interruptorAgenda('A', false)
  const id = creadas[0] ?? ''
  expect((await page.request.post('/api/agenda/correo', { data: { cita_id: id } })).status()).toBe(404)
})
