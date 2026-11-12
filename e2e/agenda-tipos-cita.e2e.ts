import { test, expect, type Page } from '@playwright/test'
import {
  soloEscritorio, SESION, diaDeLaSemana, interruptorAgenda, sqlLocal, irAAgenda, modalCita, tituloUnico,
} from './ayudas'
import { editarDesdeTarjeta } from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * B6c · Tipos de cita en el alta y la edición (plan del bloque B, decisión P5).
 * Con el interruptor ENCENDIDO, POST y PUT de `/api/appointments` aceptan
 * `tipo_cita_id`, lo validan (visible, activo si se acaba de asignar,
 * compatible con el médico, sólo con paciente) y guardan el tipo y su
 * instantánea; el modal ofrece el selector y al elegir escribe el fin. Con el
 * interruptor APAGADO (el estado del `globalSetup`) el campo se ignora y el
 * modal no cambia.
 *
 * LOS TIPOS LOS SIEMBRA ESTE ARCHIVO, no la semilla global, por la API y con la
 * sesión del administrador (la ruta exige el interruptor encendido). Llevan el
 * prefijo `E2E B6c` y se borran al terminar, con sus citas, como `postgres`:
 * las FKs de `tipos_cita` son RESTRICT y un tipo que se quedara rompería la
 * siguiente siembra (la semilla también los borra, por si esto no corre).
 *
 * Las pruebas de API van en la semana +5, fuera del rango de la semilla (no
 * hay empalmes); las del modal, el jueves de esta semana a las 13:20, un tramo
 * del administrador que no pisa la semilla ni otras pruebas.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test.afterEach(() => {
  interruptorAgenda('A', false)
})

test.afterAll(() => {
  sqlLocal(`
    delete from public.appointments where tipo_cita_id in (select id from public.tipos_cita where nombre like 'E2E B6c%');
    delete from public.tipos_cita where nombre like 'E2E B6c%';`)
})

const TZ = 'America/Merida'
const LEJOS = diaDeLaSemana(5, 2)
const JUEVES = diaDeLaSemana(0, 3)

const MEDICOS = {
  admin: { correo: 'admin.a@semilla.spinus.test', consultorio: 'Consultorio Centro (ficticio)' },
  invitado: { correo: 'medico.a@semilla.spinus.test', consultorio: 'Rehabilitación (ficticio)' },
} as const

function idsDe(medico: keyof typeof MEDICOS): { medico: string; consultorio: string } {
  const [id, consultorio] = sqlLocal(`
    select p.id, co.id from auth.users u
      join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = :'consultorio'
     where u.email = :'correo'`, MEDICOS[medico]).split('|')
  if (!consultorio) throw new Error(`idsDe: no está el médico «${medico}» en la semilla`)
  return { medico: id, consultorio }
}

function pacienteId(apellidos: string): string {
  const id = sqlLocal(`select pa.id from public.pacientes pa join public.clinicas c on c.id = pa.clinica_id
                        where c.nombre = 'Clínica Semilla A' and pa.apellidos = :'apellidos'`, { apellidos })
  if (!id) throw new Error(`pacienteId: no está «${apellidos}» en la semilla`)
  return id
}

/** Crea un tipo por la API (interruptor encendido) y devuelve id y nombre. */
async function crearTipo(page: Page, base: string, duracion: number, medico: keyof typeof MEDICOS | null = null, color: string | null = null): Promise<{ id: string; nombre: string }> {
  const nombre = tituloUnico(`E2E B6c ${base}`).slice(0, 60)
  const res = await page.request.post('/api/agenda/tipos-cita', {
    data: { nombre, duracion_min: duracion, color, medico_id: medico ? idsDe(medico).medico : null },
  })
  expect(res.status(), await res.text()).toBe(201)
  return { id: ((await res.json()) as { tipo: { id: string } }).tipo.id, nombre }
}

function cuerpo(apellidos: string | null, hora: string, minutos: number, extra: Record<string, unknown> = {}, medico: keyof typeof MEDICOS = 'admin') {
  const ids = idsDe(medico)
  const inicio = fechaHoraLocalAInstante(LEJOS, hora, TZ)
  return {
    title: apellidos ? `Paciente ${apellidos}` : tituloUnico('Evento B6c'), start_time: inicio,
    end_time: new Date(new Date(inicio).getTime() + minutos * 60_000).toISOString(),
    medico_id: ids.medico, consultorio_id: ids.consultorio, paciente_id: apellidos ? pacienteId(apellidos) : null,
    notes: null, status: 'scheduled', ...extra,
  }
}

async function altaOk(page: Page, datos: Record<string, unknown>): Promise<string> {
  const res = await page.request.post('/api/appointments', { data: datos })
  expect(res.status(), await res.text()).toBe(200)
  return ((await res.json()) as { appointment: { id: string } }).appointment.id
}

/** `tipo_cita_id|tipo_cita_nombre|minutos` de la cita, tal como quedó en la base. */
function tipoEnBase(id: string): string {
  return sqlLocal(`select coalesce(tipo_cita_id::text, '') || '|' || coalesce(tipo_cita_nombre, '') || '|' ||
                          (extract(epoch from end_time - start_time) / 60)::int
                     from public.appointments where id = :'id'`, { id })
}

test('API encendido: el alta con tipo guarda el tipo y su instantánea; incompatible, sin paciente y mal formado dan 400', async ({ page }) => {
  interruptorAgenda('A', true)
  const deClinica = await crearTipo(page, 'Primera vez', 40, null, 'oliva')
  const delInvitado = await crearTipo(page, 'Solo invitado', 30, 'invitado')

  const id = await altaOk(page, cuerpo('Prueba 02', '09:00', 40, { tipo_cita_id: deClinica.id }))
  expect(tipoEnBase(id)).toBe(`${deClinica.id}|${deClinica.nombre}|40`)

  for (const [datos, error] of [
    [cuerpo('Prueba 02', '10:00', 30, { tipo_cita_id: delInvitado.id }), 'tipo_incompatible'],
    [cuerpo(null, '11:00', 30, { tipo_cita_id: deClinica.id }), 'tipo_sin_paciente'],
    [cuerpo('Prueba 02', '12:00', 30, { tipo_cita_id: 'no-es-uuid' }), 'tipo_cita_invalido'],
  ] as const) {
    const res = await page.request.post('/api/appointments', { data: datos })
    expect(res.status()).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(error)
  }
  // El 400 no escribió nada.
  expect(sqlLocal(`select count(*) from public.appointments a join public.pacientes p on p.id = a.paciente_id
                    where p.apellidos = 'Prueba 02' and a.start_time = :'t'::timestamptz`,
  { t: fechaHoraLocalAInstante(LEJOS, '10:00', TZ) })).toBe('0')
})

test('API encendido: el PUT cambia el tipo, valida al reasignar el médico y quitar el paciente sigue siendo el 409 de B3', async ({ page }) => {
  interruptorAgenda('A', true)
  const delAdmin = await crearTipo(page, 'Solo admin', 20, 'admin')
  const deClinica = await crearTipo(page, 'Control', 30)
  const id = await altaOk(page, cuerpo('Prueba 03', '13:00', 20, { tipo_cita_id: delAdmin.id }))
  const invitado = idsDe('invitado')

  // Reasignar al invitado con un tipo personal del admin: 400 aunque el cuerpo no nombre el tipo.
  let res = await page.request.put(`/api/appointments/${id}`, { data: { medico_id: invitado.medico, consultorio_id: invitado.consultorio } })
  expect(res.status()).toBe(400)
  expect(((await res.json()) as { error: string }).error).toBe('tipo_incompatible')
  expect(tipoEnBase(id)).toBe(`${delAdmin.id}|${delAdmin.nombre}|20`)

  // Cambiar a un tipo de clínica: nueva instantánea; y entonces sí se puede reasignar.
  res = await page.request.put(`/api/appointments/${id}`, { data: { tipo_cita_id: deClinica.id } })
  expect(res.ok(), await res.text()).toBeTruthy()
  expect(tipoEnBase(id)).toBe(`${deClinica.id}|${deClinica.nombre}|20`)
  res = await page.request.put(`/api/appointments/${id}`, { data: { medico_id: invitado.medico, consultorio_id: invitado.consultorio } })
  expect(res.ok(), await res.text()).toBeTruthy()
  expect(tipoEnBase(id)).toBe(`${deClinica.id}|${deClinica.nombre}|20`)

  // Quitar el paciente de una cita con tipo: el 409 de B3, antes que cualquier regla de tipo.
  res = await page.request.put(`/api/appointments/${id}`, { data: { paciente_id: null, tipo_cita_id: null } })
  expect(res.status()).toBe(409)
  expect(((await res.json()) as { error: string }).error).toBe('cita_con_paciente')

  // Quitar el tipo (null) limpia las dos columnas.
  res = await page.request.put(`/api/appointments/${id}`, { data: { tipo_cita_id: null } })
  expect(res.ok(), await res.text()).toBeTruthy()
  expect(tipoEnBase(id)).toBe('||20')
})

test('API apagado: tipo_cita_id se ignora en el alta y en la edición', async ({ page }) => {
  interruptorAgenda('A', true)
  const tipo = await crearTipo(page, 'Ignorado', 45)
  interruptorAgenda('A', false)

  const id = await altaOk(page, cuerpo('Prueba 04', '15:00', 30, { tipo_cita_id: tipo.id }))
  expect(tipoEnBase(id)).toBe('||30')
  // Ni siquiera se valida: una basura tampoco da 400.
  const res = await page.request.put(`/api/appointments/${id}`, { data: { tipo_cita_id: 'no-es-uuid', notes: 'B6c apagado' } })
  expect(res.ok(), await res.text()).toBeTruthy()
  expect(tipoEnBase(id)).toBe('||30')
  // La ruta de tipos tampoco existe para esta clínica.
  expect((await page.request.get('/api/agenda/tipos-cita')).status()).toBe(404)
})

async function abrir(page: Page, estado: 'encendida' | 'apagada'): Promise<void> {
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', estado)
  /* F3: con v2 las interacciones van en un chunk diferido; un clic antes de que llegue abriría el modal directo. */
  if (estado === 'encendida') await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
}

async function rellenarAlta(page: Page, apellidos: string, desde: string, hasta: string): Promise<void> {
  await page.locator('[data-onboard="nueva-cita"]').click()
  await expect(modalCita(page, 'Nueva cita')).toBeVisible()
  await page.getByPlaceholder('Buscar paciente por nombre o apellido...').fill(apellidos)
  await page.getByRole('button', { name: new RegExp(`Paciente ${apellidos}`) }).click()
  await page.locator('input[type="date"]').first().fill(JUEVES)
  await page.locator('input[type="time"]').nth(0).fill(desde)
  await page.locator('input[type="date"]').nth(1).fill(JUEVES)
  await page.locator('input[type="time"]').nth(1).fill(hasta)
}

function tarjeta(page: Page, apellidos: string, hora: string) {
  return page.locator(`.fc-timegrid-col[data-date="${JUEVES}"] .fc-timegrid-event`, { hasText: `Paciente ${apellidos}` })
    .filter({ has: page.locator('.ag-tarjeta-hora-rango', { hasText: new RegExp(`^${hora}( |$)`) }) })
}

test('modal encendido: elegir un tipo escribe el fin; se guarda con su instantánea, la tarjeta no lo nombra y se puede cambiar al editar', async ({ page }) => {
  interruptorAgenda('A', true)
  const largo = await crearTipo(page, 'Valoracion', 40, null, 'bronce')
  const corto = await crearTipo(page, 'Revision', 20, 'admin')
  const delInvitado = await crearTipo(page, 'Ajeno', 25, 'invitado')
  await abrir(page, 'encendida')

  await rellenarAlta(page, 'Prueba 06', '13:20', '13:35')
  const grupo = page.getByRole('radiogroup', { name: 'Tipo de cita' })
  await expect(grupo.getByRole('radio', { name: 'Sin tipo' })).toHaveAttribute('aria-checked', 'true')
  // El tipo personal de otro médico no se ofrece.
  await expect(grupo.getByRole('radio', { name: new RegExp(delInvitado.nombre) })).toHaveCount(0)
  await grupo.getByRole('radio', { name: new RegExp(largo.nombre) }).click()
  await expect(grupo.getByRole('radio', { name: new RegExp(largo.nombre) })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('input[type="time"]').nth(1)).toHaveValue('14:00')

  const alta = page.waitForResponse(r => r.url().endsWith('/api/appointments') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const res = await alta
  expect(res.status(), await res.text()).toBe(200)
  expect(res.request().postDataJSON()).toMatchObject({ tipo_cita_id: largo.id })
  const id = ((await res.json()) as { appointment: { id: string } }).appointment.id
  expect(tipoEnBase(id)).toBe(`${largo.id}|${largo.nombre}|40`)

  // P5: la tarjeta conserva sus dos líneas y no nombra el tipo.
  const laTarjeta = tarjeta(page, 'Prueba 06', '13:20')
  await expect(laTarjeta).toHaveCount(1)
  await expect(laTarjeta).not.toContainText(largo.nombre)

  // Editar: el tipo viene marcado; cambiarlo reescribe el fin y la instantánea.
  await laTarjeta.click()
  await editarDesdeTarjeta(page)
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  const grupoEd = page.getByRole('radiogroup', { name: 'Tipo de cita' })
  await expect(grupoEd.getByRole('radio', { name: new RegExp(largo.nombre) })).toHaveAttribute('aria-checked', 'true')
  await grupoEd.getByRole('radio', { name: new RegExp(corto.nombre) }).click()
  await expect(page.locator('input[type="time"]').nth(1)).toHaveValue('13:40')
  const edicion = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const resEd = await edicion
  expect(resEd.ok(), await resEd.text()).toBeTruthy()
  expect(resEd.request().postDataJSON()).toMatchObject({ tipo_cita_id: corto.id })
  expect(tipoEnBase(id)).toBe(`${corto.id}|${corto.nombre}|20`)
  await expect(tarjeta(page, 'Prueba 06', '13:20')).not.toContainText(corto.nombre)

  // Editar sólo las notas: no viaja tipo_cita_id.
  await tarjeta(page, 'Prueba 06', '13:20').click()
  await editarDesdeTarjeta(page)
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
  await page.getByPlaceholder('Instrucciones, observaciones...').fill('Nota B6c')
  const notas = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const resNotas = await notas
  expect(resNotas.ok()).toBeTruthy()
  expect(resNotas.request().postDataJSON()).not.toHaveProperty('tipo_cita_id')
  expect(tipoEnBase(id)).toBe(`${corto.id}|${corto.nombre}|20`)
})

test('modal apagado: no hay selector de tipo, no se piden los tipos y el alta no lleva tipo_cita_id', async ({ page }) => {
  let pedidas = 0
  page.on('request', r => { if (r.url().includes('/api/agenda/tipos-cita')) pedidas++ })
  await abrir(page, 'apagada')

  await rellenarAlta(page, 'Prueba 06', '13:50', '14:00')
  await expect(page.getByRole('radiogroup', { name: 'Tipo de cita' })).toHaveCount(0)
  await expect(page.getByText('Tipo de cita', { exact: true })).toHaveCount(0)
  const alta = page.waitForResponse(r => r.url().endsWith('/api/appointments') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar' }).click()
  const res = await alta
  expect(res.ok(), await res.text()).toBeTruthy()
  expect(res.request().postDataJSON()).not.toHaveProperty('tipo_cita_id')
  expect(pedidas).toBe(0)
  const id = ((await res.json()) as { appointment: { id: string } }).appointment.id
  expect(tipoEnBase(id)).toBe('||10')
})
