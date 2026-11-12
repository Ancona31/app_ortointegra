import { test, expect, type Page } from '@playwright/test'
import {
  soloEscritorio, SESION, diaDeLaSemana, interruptorAgenda, sqlLocal, irAAgenda,
  arrastrarEventoPorMinutos, redimensionarFinEvento,
} from './ayudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * B7 · Alerta de empalme (plan del bloque B), reglas de P3. Con el interruptor
 * ENCENDIDO, una escritura que se empalma con otra cita del MISMO médico se
 * pregunta y no se bloquea: el servidor contesta 409 `empalme` con los nombres
 * (sólo los que la RLS deja ver) y sin escribir nada, y la misma petición con
 * `empalmes_aceptados` entra. Con el interruptor APAGADO (el estado del
 * `globalSetup`) no se comprueba nada y el campo se ignora.
 *
 * Las pruebas de la API van el MARTES de esta semana por la tarde; las de la
 * rejilla, el lunes, jueves y viernes, en tramos que no se pisan entre sí ni
 * con la Junta de los lunes o el «Pendiente administrativo» del viernes (que
 * `agenda-arrastre` estira hasta las 14:30: el viernes empieza a las 15:00). Cada
 * prueba crea sus propias citas por la API con la sesión del administrador, y
 * las tarjetas se buscan por columna de día, paciente y hora.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test.afterEach(() => {
  interruptorAgenda('A', false)
})

const TZ = 'America/Merida'
const MARTES = diaDeLaSemana(0, 1)

/** El médico de la cita: el administrador (Centro) o el invitado (Rehabilitación). */
const MEDICOS = {
  admin: { correo: 'admin.a@semilla.spinus.test', consultorio: 'Consultorio Centro (ficticio)' },
  invitado: { correo: 'medico.a@semilla.spinus.test', consultorio: 'Rehabilitación (ficticio)' },
} as const

function idsDe(apellidos: string, medico: keyof typeof MEDICOS): { medico: string; consultorio: string; paciente: string } {
  const [id, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = :'consultorio'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = :'apellidos'
     where u.email = :'correo'`, { apellidos, ...MEDICOS[medico] }).split('|')
  if (!paciente) throw new Error(`idsDe: no está «${apellidos}» en la semilla`)
  return { medico: id, consultorio, paciente }
}

interface Cuerpo { title: string; start_time: string; end_time: string; medico_id: string; consultorio_id: string; paciente_id: string; notes: null; status: string }

function cuerpoDeAlta(apellidos: string, fecha: string, hora: string, minutos: number, medico: keyof typeof MEDICOS = 'admin'): Cuerpo {
  const ids = idsDe(apellidos, medico)
  const inicio = fechaHoraLocalAInstante(fecha, hora, TZ)
  const fin = new Date(new Date(inicio).getTime() + minutos * 60_000).toISOString()
  return {
    title: `Paciente ${apellidos}`, start_time: inicio, end_time: fin, medico_id: ids.medico,
    consultorio_id: ids.consultorio, paciente_id: ids.paciente, notes: null, status: 'scheduled',
  }
}

/** Alta por la API; si se empalma (interruptor encendido), la acepta y reenvía. */
async function alta(page: Page, apellidos: string, fecha: string, hora: string, minutos: number, medico: keyof typeof MEDICOS = 'admin'): Promise<string> {
  const cuerpo = cuerpoDeAlta(apellidos, fecha, hora, minutos, medico)
  let res = await page.request.post('/api/appointments', { data: cuerpo })
  if (res.status() === 409) {
    const { empalmes } = await res.json() as { empalmes: { id: string }[] }
    res = await page.request.post('/api/appointments', { data: { ...cuerpo, empalmes_aceptados: empalmes.map(e => e.id) } })
  }
  expect(res.ok(), await res.text()).toBeTruthy()
  return ((await res.json()) as { appointment: { id: string } }).appointment.id
}

function horasEnBase(id: string): string {
  return sqlLocal(`select to_char(start_time at time zone 'America/Merida', 'HH24:MI') || '-' ||
                          to_char(end_time at time zone 'America/Merida', 'HH24:MI')
                     from public.appointments where id = :'id'`, { id })
}

/** Cuántas citas de ese paciente empiezan en ese instante exacto. */
function citasDe(apellidos: string, fecha: string, hora: string): number {
  return Number(sqlLocal(`select count(*) from public.appointments a join public.pacientes p on p.id = a.paciente_id
                           where p.apellidos = :'apellidos' and a.start_time = :'inicio'::timestamptz`,
  { apellidos, inicio: fechaHoraLocalAInstante(fecha, hora, TZ) }))
}

test('API encendido: el alta empalmada da 409 con el nombre y sin escribir; con empalmes_aceptados entra', async ({ page }) => {
  interruptorAgenda('A', true)
  const x = await alta(page, 'Prueba 07', MARTES, '14:05', 25)
  // Pegada por detrás (14:30): semiabierto, no se empalma.
  await alta(page, 'Prueba 19', MARTES, '14:30', 10)

  const cuerpo = cuerpoDeAlta('Prueba 20', MARTES, '14:20', 20)
  const r409 = await page.request.post('/api/appointments', { data: cuerpo })
  expect(r409.status()).toBe(409)
  const json = await r409.json() as { error: string; empalmes: { id: string; titulo: string }[] }
  expect(json.error).toBe('empalme')
  expect(json.empalmes.map(e => e.titulo).sort()).toEqual(['Paciente Prueba 07', 'Paciente Prueba 19'])
  expect(citasDe('Prueba 20', MARTES, '14:20')).toBe(0)

  // Aceptando sólo una, sigue faltando la otra.
  const parcial = await page.request.post('/api/appointments', { data: { ...cuerpo, empalmes_aceptados: [x] } })
  expect(parcial.status()).toBe(409)
  expect(((await parcial.json()) as { empalmes: { titulo: string }[] }).empalmes.map(e => e.titulo)).toEqual(['Paciente Prueba 19'])

  const ok = await page.request.post('/api/appointments', { data: { ...cuerpo, empalmes_aceptados: json.empalmes.map(e => e.id) } })
  expect(ok.ok()).toBeTruthy()
  expect(citasDe('Prueba 20', MARTES, '14:20')).toBe(1)
})

test('API encendido: semiabierto, cancelada, no_show y otro médico no cuentan; empalmes_aceptados mal formado es 400', async ({ page }) => {
  interruptorAgenda('A', true)
  const nueva = cuerpoDeAlta('Prueba 21', MARTES, '15:00', 20)
  // Pegada por detrás (empieza cuando acaba la nueva): semiabierto, no cuenta.
  await alta(page, 'Prueba 22', MARTES, '15:20', 20)
  // Encima, pero cancelada: no cuenta.
  const cancelada = await alta(page, 'Prueba 23', MARTES, '14:50', 20)
  sqlLocal(`update public.appointments set status = 'cancelled' where id = :'id'`, { id: cancelada })
  // Encima, pero «no asistió» (corrección de Angel a P3): no cuenta.
  const noAsistio = await alta(page, 'Prueba 18', MARTES, '15:05', 10)
  sqlLocal(`update public.appointments set status = 'no_show' where id = :'id'`, { id: noAsistio })
  // Encima, pero de OTRO médico (el invitado): no cuenta.
  await alta(page, 'Prueba 24', MARTES, '15:00', 20, 'invitado')
  const r = await page.request.post('/api/appointments', { data: nueva })
  expect(r.ok(), await r.text()).toBeTruthy()

  const malo = await page.request.post('/api/appointments', { data: { ...cuerpoDeAlta('Prueba 25', MARTES, '15:05', 10), empalmes_aceptados: ['x'] } })
  expect(malo.status()).toBe(400)
  expect(((await malo.json()) as { error: string }).error).toBe('empalmes_invalidos')
})

test('API encendido: el PUT avisa al mover y al reactivar, pero no al tocar sólo las notas', async ({ page }) => {
  interruptorAgenda('A', true)
  await alta(page, 'Prueba 07', MARTES, '16:05', 20)
  const y = await alta(page, 'Prueba 08', MARTES, '16:30', 20)

  // Mover encima → 409 sin escribir.
  const mover = { start_time: fechaHoraLocalAInstante(MARTES, '16:10', TZ), end_time: fechaHoraLocalAInstante(MARTES, '16:30', TZ) }
  const r409 = await page.request.put(`/api/appointments/${y}`, { data: mover })
  expect(r409.status()).toBe(409)
  expect(horasEnBase(y)).toBe('16:30-16:50')
  const { empalmes } = await r409.json() as { empalmes: { id: string }[] }
  expect((await page.request.put(`/api/appointments/${y}`, { data: { ...mover, empalmes_aceptados: empalmes.map(e => e.id) } })).ok()).toBeTruthy()
  expect(horasEnBase(y)).toBe('16:10-16:30')

  // Ya empalmada: editar sólo las notas, o mandar las mismas horas, no avisa.
  expect((await page.request.put(`/api/appointments/${y}`, { data: { notes: 'B7: sólo notas' } })).ok()).toBeTruthy()
  expect((await page.request.put(`/api/appointments/${y}`, { data: { ...mover, notes: 'B7: mismas horas' } })).ok()).toBeTruthy()

  // Cancelarla no avisa; reactivarla sí.
  expect((await page.request.put(`/api/appointments/${y}`, { data: { status: 'cancelled' } })).ok()).toBeTruthy()
  expect((await page.request.put(`/api/appointments/${y}`, { data: { status: 'scheduled' } })).status()).toBe(409)
})

test('API apagado: el alta empalmada entra sin preguntar y empalmes_aceptados se ignora', async ({ page }) => {
  await alta(page, 'Prueba 07', MARTES, '17:05', 20)
  const r = await page.request.post('/api/appointments', {
    data: { ...cuerpoDeAlta('Prueba 25', MARTES, '17:10', 20), empalmes_aceptados: 'basura' },
  })
  expect(r.ok(), await r.text()).toBeTruthy()
  expect(citasDe('Prueba 25', MARTES, '17:10')).toBe(1)
})

/* ── La rejilla: arrastrar y redimensionar (B7b) ─────────────────────────── */

const LUNES = diaDeLaSemana(0, 0)
const JUEVES = diaDeLaSemana(0, 3)
const VIERNES = diaDeLaSemana(0, 4)

/** La tarjeta de ese paciente, ese día, cuyo rango empieza a esa hora. */
function tarjeta(page: Page, fecha: string, apellidos: string, hora: string) {
  return page.locator(`.fc-timegrid-col[data-date="${fecha}"] .fc-timegrid-event`, { hasText: `Paciente ${apellidos}` })
    .filter({ has: page.locator('.ag-tarjeta-hora-rango', { hasText: new RegExp(`^${hora}( |$)`) }) })
}

/** El aviso (`ConfirmModal`): un diálogo cuyo nombre es su propio mensaje. */
function aviso(page: Page, texto: RegExp) {
  return page.getByRole('dialog', { name: texto })
}

async function abrir(page: Page, estado: 'encendida' | 'apagada'): Promise<void> {
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', estado)
}

function putsDe(page: Page, id: string): { cuantos: () => number } {
  let n = 0
  page.on('request', r => { if (r.method() === 'PUT' && r.url().includes(`/api/appointments/${id}`)) n++ })
  return { cuantos: () => n }
}

test('rejilla encendido: arrastrar sobre otra cita la nombra; Cancelar la deja en su sitio (una tarjeta) y Aceptar guarda', async ({ page }) => {
  interruptorAgenda('A', true)
  const x = await alta(page, 'Prueba 07', VIERNES, '15:05', 25)
  const movida = await alta(page, 'Prueba 08', VIERNES, '16:05', 25)
  await abrir(page, 'encendida')
  const puts = putsDe(page, movida)

  await arrastrarEventoPorMinutos(page, tarjeta(page, VIERNES, 'Prueba 08', '16:05'), -60)
  /* Sin anclar el principio de la frase: otros archivos crean sus propias
     citas el viernes (`agenda-candado-gesto`), y si alguna cae en el tramo el
     aviso las nombra a las dos. Lo que se exige es que nombre ÉSTA. */
  const primero = aviso(page, /«Paciente Prueba 07» \(15:05–15:30\)/)
  await expect(primero).toBeVisible()
  await primero.getByRole('button', { name: 'Cancelar' }).click()
  await expect(tarjeta(page, VIERNES, 'Prueba 08', '16:05')).toHaveCount(1)
  await expect(tarjeta(page, VIERNES, 'Prueba 08', '15:05')).toHaveCount(0)
  expect(puts.cuantos()).toBe(0)
  expect(horasEnBase(movida)).toBe('16:05-16:30')

  await arrastrarEventoPorMinutos(page, tarjeta(page, VIERNES, 'Prueba 08', '16:05'), -60)
  const segundo = aviso(page, /«Paciente Prueba 07» \(15:05–15:30\)/)
  await expect(segundo).toBeVisible()
  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${movida}`) && r.request().method() === 'PUT')
  await segundo.getByRole('button', { name: 'Aceptar' }).click()
  const res = await resp
  expect(res.ok()).toBeTruthy()
  expect((res.request().postDataJSON() as { empalmes_aceptados?: string[] }).empalmes_aceptados).toContain(x)
  await expect(tarjeta(page, VIERNES, 'Prueba 08', '15:05')).toHaveCount(1)
  await expect(tarjeta(page, VIERNES, 'Prueba 08', '16:05')).toHaveCount(0)
  expect(horasEnBase(movida)).toBe('15:05-15:30')
})

test('rejilla encendido: redimensionar hasta otra cita también avisa', async ({ page }) => {
  interruptorAgenda('A', true)
  await alta(page, 'Prueba 09', JUEVES, '14:40', 15)
  const estirada = await alta(page, 'Prueba 10', JUEVES, '14:05', 20)
  await abrir(page, 'encendida')

  await redimensionarFinEvento(page, tarjeta(page, JUEVES, 'Prueba 10', '14:05'), 30)
  const elAviso = aviso(page, /«Paciente Prueba 09»/)
  await expect(elAviso).toBeVisible()
  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${estirada}`) && r.request().method() === 'PUT')
  await elAviso.getByRole('button', { name: 'Aceptar' }).click()
  expect((await resp).ok()).toBeTruthy()
  expect(horasEnBase(estirada)).toBe('14:05-14:55')
})

test('rejilla encendido: una cita «no asistió» en el mismo tramo NO dispara el aviso', async ({ page }) => {
  interruptorAgenda('A', true)
  const noAsistio = await alta(page, 'Prueba 11', LUNES, '15:05', 30)
  sqlLocal(`update public.appointments set status = 'no_show' where id = :'id'`, { id: noAsistio })
  const movida = await alta(page, 'Prueba 12', LUNES, '16:10', 15)
  // Precondición: en el destino (15:10–15:25) no hay otra cita del médico que cuente.
  expect(sqlLocal(`select count(*) from public.appointments a join auth.users u on u.id = a.medico_id
                    where u.email = 'admin.a@semilla.spinus.test' and a.id <> :'id'
                      and a.status not in ('cancelled', 'no_show') and not a.all_day
                      and a.start_time < :'fin'::timestamptz and a.end_time > :'ini'::timestamptz`,
  { id: noAsistio, ini: fechaHoraLocalAInstante(LUNES, '15:10', TZ), fin: fechaHoraLocalAInstante(LUNES, '15:25', TZ) })).toBe('0')
  await abrir(page, 'encendida')

  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${movida}`) && r.request().method() === 'PUT')
  await arrastrarEventoPorMinutos(page, tarjeta(page, LUNES, 'Prueba 12', '16:10'), -60)
  const res = await resp
  expect(res.ok()).toBeTruthy()
  expect(res.request().postDataJSON()).not.toHaveProperty('empalmes_aceptados')
  await expect(page.getByRole('dialog', { name: /Se empalma/ })).toHaveCount(0)
  expect(horasEnBase(movida)).toBe('15:10-15:25')
})

test('rejilla: un 409 empalme del servidor se pregunta SIEMPRE, aunque el cliente crea el interruptor apagado', async ({ page }) => {
  const movida = await alta(page, 'Prueba 13', VIERNES, '16:35', 15)
  await abrir(page, 'apagada')
  const FALSA = '33333333-3333-4333-8333-333333333333'
  let primera = true
  await page.route(`**/api/appointments/${movida}`, async (route) => {
    if (route.request().method() !== 'PUT' || !primera) return route.continue()
    primera = false
    return route.fulfill({
      status: 409, contentType: 'application/json',
      body: JSON.stringify({ error: 'empalme', message: 'x', empalmes: [{ id: FALSA, titulo: 'Cita simulada', inicio: fechaHoraLocalAInstante(VIERNES, '16:00', TZ), fin: fechaHoraLocalAInstante(VIERNES, '16:30', TZ) }] }),
    })
  })

  await arrastrarEventoPorMinutos(page, tarjeta(page, VIERNES, 'Prueba 13', '16:35'), -30)
  const elAviso = aviso(page, /Se empalma con «Cita simulada» \(16:00–16:30\)/)
  await expect(elAviso).toBeVisible()
  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${movida}`) && r.request().method() === 'PUT' && r.status() === 200)
  await elAviso.getByRole('button', { name: 'Aceptar' }).click()
  const res = await resp
  expect((res.request().postDataJSON() as { empalmes_aceptados?: string[] }).empalmes_aceptados).toEqual([FALSA])
  expect(horasEnBase(movida)).toBe('16:05-16:20')
})

test('rejilla apagado: arrastrar sobre otra cita no avisa y el PUT no lleva empalmes_aceptados', async ({ page }) => {
  await alta(page, 'Prueba 14', VIERNES, '17:05', 15)
  const movida = await alta(page, 'Prueba 15', VIERNES, '17:35', 15)
  await abrir(page, 'apagada')

  const resp = page.waitForResponse(r => r.url().includes(`/api/appointments/${movida}`) && r.request().method() === 'PUT')
  await arrastrarEventoPorMinutos(page, tarjeta(page, VIERNES, 'Prueba 15', '17:35'), -30)
  const res = await resp
  expect(res.ok()).toBeTruthy()
  expect(res.request().postDataJSON()).not.toHaveProperty('empalmes_aceptados')
  await expect(page.getByRole('dialog', { name: /Se empalma/ })).toHaveCount(0)
  expect(horasEnBase(movida)).toBe('17:05-17:20')
})
