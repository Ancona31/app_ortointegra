import { spawn } from 'node:child_process'
import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  CORREO, SESION, arrastrarEventoPorMinutos, diaDeLaSemana, enContextoNuevo, interruptorAgenda, irAAgenda,
  pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal, toastConTexto,
} from './ayudas'
import { abrirAgendaV2, burbuja, elegirPaciente, preguntaAsistencia, tarjetaLectura } from './interaccionesAyudas'
import { crearCitaPorLigar, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda I (agente I4) · los puntos 1, 3, 11 y 12 de Angel.
 *   1 · una atendida con nota no se mueve de fecha ni de hora, también con la v2 apagada.
 *   3 · el horario que nadie confirmó sale «por revisar» en «Primeros pasos».
 *  11 · «¿Asistió el paciente?» al abrir la agenda, con las de hace más de 48 horas sin nota.
 *  12 · «Reasignar» de una cancelada: la burbuja en ese hueco; al guardar, la cancelada se cierra.
 * (El «Reagendar cita» que cierra la cancelada va en `agenda-g3-tarjeta`; el «Restablecer» que
 * devuelve el horario a «por revisar», en `agenda-h2-configuracion`.)
 * Cada prueba deja la base como estaba; el interruptor de A se queda encendido (regla de la tanda).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const MIERCOLES_5 = diaDeLaSemana(5, 2)
const creadas: string[] = []
let desde = ''

test.beforeAll(() => { desde = marcaE2e() })
// Encendida en A por omisión (otra e2e la deja apagada); las de «v2 apagada» la apagan ellas.
test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => {
  if (creadas.length) {
    sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.consultas where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.cita_confirmaciones where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]); commit;`, { ids: creadas.join(',') })
    creadas.length = 0
  }
  limpiarReservasE2e(desde)
})
test.afterAll(() => {
  // Integración I: cada archivo deja la v2 APAGADA al terminar (la convención de la batería: el
  // global-setup la apaga y sólo la prueba que la necesita la enciende). Encendida, las e2e que
  // la suponen apagada (agenda-secretaria, agenda-tipos-cita) caían en el aviso de empalme B7.
  interruptorAgenda('A', false)
})

/** Una cita por SQL en un consultorio de quien diga `correo`, con su estado y su inicio (instante). */
function cita(o: { correo: string; inicio: string; apellidos: string; estado: string; minutos?: number }): { id: string; paciente: string } {
  const [id = '', paciente = ''] = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status,
           consultorio_nombre, consultorio_timezone, origen, gcal_sync_status)
    select co.clinica_id, pa.id, co.medico_id, co.id, 'Paciente ' || pa.apellidos, :'ini'::timestamptz,
           :'ini'::timestamptz + make_interval(mins => :'min'::int), :'st', co.nombre, co.timezone, 'spinus', 'synced'
      from auth.users u join public.consultorios co on co.medico_id = u.id and co.activo
      join public.pacientes pa on pa.clinica_id = co.clinica_id and pa.apellidos = :'ap'
     where u.email = :'c' order by co.created_at limit 1
    returning id || '|' || paciente_id`, { c: o.correo, ini: o.inicio, st: o.estado, ap: o.apellidos, min: String(o.minutos ?? 60) }).split('|')
  creadas.push(id)
  return { id, paciente }
}

function notaLigada(citaId: string, paciente: string): void {
  sqlLocal(`insert into public.consultas (paciente_id, medico_id, motivo_consulta, nota_origen, appointment_id)
    select :'p', medico_id, 'NOTA DE PRUEBA I4', 'manual', id from public.appointments where id = :'id'`, { p: paciente, id: citaId })
}

const haceHoras = (h: number): string => new Date(Date.now() - h * 3_600_000).toISOString()
const estado = (id: string): string => sqlLocal(`select status from public.appointments where id = :'id'`, { id })

/* ── Punto 1 · la atendida con nota no se mueve, con la v2 APAGADA ───────── */

/* MUTACIÓN: `pideComprobarNota` sin `mueveCita` (sólo el estado) → rojo: el PUT de hora da 200. */
test('1 · v2 apagada: una atendida con nota no cambia de fecha ni de hora (PUT y arrastre); sin nota, sí', async ({ page }) => {
  interruptorAgenda('A', false)
  const ini = fechaHoraLocalAInstante(MIERCOLES_5, '10:00', TZ)
  const { id, paciente } = cita({ correo: CORREO.adminA, inicio: ini, apellidos: 'Prueba 21', estado: 'attended' })
  notaLigada(id, paciente)
  const antes = sqlLocal(`select start_time || '|' || end_time from public.appointments where id = :'id'`, { id })
  const una = new Date(new Date(ini).getTime() + 3_600_000).toISOString()
  const dos = new Date(new Date(ini).getTime() + 7_200_000).toISOString()
  const r = await page.request.put(`/api/appointments/${id}`, { data: { start_time: una, end_time: dos } })
  expect(r.status()).toBe(409)
  expect(await r.json()).toMatchObject({ error: 'nota_ligada', message: expect.stringMatching(/no se puede cambiar de fecha ni de hora/) })
  // El arrastre en la rejilla (v2 apagada): vuelve a su sitio con el motivo, y la base no cambia.
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')
  for (let i = 0; i < 5; i++) await page.locator('.fc-next-button').click()
  const ev = page.locator('.fc-timegrid-event', { hasText: 'Prueba 21' }).first()
  const put = page.waitForResponse(x => x.url().endsWith(`/api/appointments/${id}`) && x.request().method() === 'PUT')
  await arrastrarEventoPorMinutos(page, ev, 60)
  expect((await put).status()).toBe(409)
  await expect(toastConTexto(page, 'no se puede cambiar de fecha ni de hora')).toBeVisible()
  expect(sqlLocal(`select start_time || '|' || end_time from public.appointments where id = :'id'`, { id })).toBe(antes)
  // Sin nota, la atendida se sigue moviendo con la v2 apagada (como hoy).
  const sin = cita({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(MIERCOLES_5, '13:00', TZ), apellidos: 'Prueba 22', estado: 'attended' })
  expect((await page.request.put(`/api/appointments/${sin.id}`, { data: { start_time: una, end_time: dos } })).status()).toBe(200)
})

/** Corre SQL en segundo plano (otra sesión de psql) y resuelve cuando termina. */
function sqlEnSegundoPlano(sql: string): Promise<void> {
  return new Promise((ok, ko) => {
    const p = spawn('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1'])
    p.on('error', ko)
    p.on('close', c => (c === 0 ? ok() : ko(new Error(`psql salió con ${c}`))))
    p.stdin.end(sql)
  })
}

/* La CARRERA: la nota entra entre la comprobación de la ruta y el UPDATE (otra sesión tiene la
   fila bloqueada y la nota sin confirmar). Lo para el disparador (42501), y la ruta lo traduce a
   409 `nota_ligada` con SU mensaje. MUTACIÓN: quitar la traducción del 42501 en el PUT → rojo (500). */
test('1 · v2 apagada: la nota que entra a mitad del cambio la para la base, y la ruta contesta 409', async ({ page }) => {
  interruptorAgenda('A', false)
  const ini = fechaHoraLocalAInstante(MIERCOLES_5, '11:00', TZ)
  const { id, paciente } = cita({ correo: CORREO.adminA, inicio: ini, apellidos: 'Prueba 23', estado: 'attended' })
  const otra = sqlEnSegundoPlano(`begin;
    select 1 from public.appointments where id = '${id}' for update;
    insert into public.consultas (paciente_id, medico_id, motivo_consulta, nota_origen, appointment_id)
      select '${paciente}', medico_id, 'NOTA DE PRUEBA I4 carrera', 'manual', id from public.appointments where id = '${id}';
    select pg_sleep(3);
    commit;`)
  await expect.poll(() => sqlLocal(`select count(*) from pg_stat_activity
    where query like '%pg_sleep(3)%' and state = 'active' and pid <> pg_backend_pid()`), { timeout: 5000 }).toBe('1')
  const una = new Date(new Date(ini).getTime() + 3_600_000).toISOString()
  const dos = new Date(new Date(ini).getTime() + 7_200_000).toISOString()
  const r = await page.request.put(`/api/appointments/${id}`, { data: { start_time: una, end_time: dos } })
  await otra
  expect(r.status()).toBe(409)
  expect(await r.json()).toEqual({
    error: 'nota_ligada', message: 'Esta cita ya tiene una nota clínica: sigue como atendida y no se puede cambiar de estado, de fecha ni de hora.',
  })
  expect(sqlLocal(`select start_time = :'i'::timestamptz from public.appointments where id = :'id'`, { id, i: ini })).toBe('t')
})

/* ── Punto 3 · «por revisar» (J5: en el funnel y en la tarjeta del consultorio) ── */

/* Tanda J (J5): «Primeros pasos» ya no existe. Con TODOS los consultorios por revisar es «primera vez»:
   el funnel abre en el paso 1 y «Continuar» los confirma. Con UNO por revisar (uno nuevo, p. ej.), las
   pestañas: su tarjeta dice «Por revisar» y «Confirmar horario» lo deja hecho.
   MUTACIONES: `porRevisar` siempre `false` en `pasosDe` → rojo (con todo por revisar abre en pestañas,
   no en el paso 1); el botón «Confirmar horario» fuera de `PestanaHorario` → rojo. */
test('3 · el horario que nadie confirmó sale «por revisar»; «Continuar» en el funnel o «Confirmar horario» en su tarjeta lo deja hecho', async ({ page }) => {
  const mios = sqlLocal(`select string_agg(k.id::text, ',') from public.consultorios k join auth.users u on u.id = k.medico_id
    where u.email = :'c' and k.activo`, { c: CORREO.adminA })
  const marca = (): string => sqlLocal(`select count(*) filter (where horario_revisado_en is not null) || '/' || count(*)
    from public.consultorios where id = any (string_to_array(:'m', ',')::uuid[])`, { m: mios })
  const sinMarca = () => sqlLocal(`update public.consultorios set horario_revisado_en = null where id = any (string_to_array(:'m', ',')::uuid[])`, { m: mios })
  // «Continuar» puede copiar el horario de la clínica a la columna: se devuelve como estaba.
  const horarios = sqlLocal(`select json_agg(json_build_object('id', id, 'h', horario, 'p', horario_propio))::text from public.consultorios
    where id = any (string_to_array(:'m', ',')::uuid[])`, { m: mios })
  const deshacer = sinPendientesAgenda(CORREO.adminA)
  const total = Number(marca().split('/')[1])
  try {
    // Todos por revisar: primera vez, el funnel en el paso 1; «Continuar» los confirma.
    sinMarca()
    await page.goto('/agenda/configuracion')
    // K3 (punto 12): quien administra pasa antes por el horario de la clínica.
    await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible()
    await expect(page.getByText('Paso 1 de 4 · menos de 2 minutos')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
    expect(marca()).toBe(`${total}/${total}`)

    // Uno por revisar: pestañas; su tarjeta lo dice y «Confirmar horario» lo deja hecho.
    sqlLocal(`update public.consultorios set horario_revisado_en = null where id = (string_to_array(:'m', ','))[1]::uuid`, { m: mios })
    await page.goto('/agenda/configuracion')
    await pestanaConfig(page, 'Cuándo das consulta')
    const panel = page.getByRole('tabpanel', { name: 'Cuándo das consulta' })
    await expect(panel.getByText('Por revisar', { exact: true })).toHaveCount(1)
    const botones = panel.getByRole('button', { name: 'Confirmar horario' })
    await expect(botones).toHaveCount(1)
    await botones.click()
    await expect(botones).toHaveCount(0)
    await expect(panel.getByText('Por revisar', { exact: true })).toHaveCount(0)
    expect(marca()).toBe(`${total}/${total}`)
  } finally {
    deshacer()
    sinMarca()
    sqlLocal(`update public.consultorios k set horario = x.v -> 'h', horario_propio = (x.v ->> 'p')::boolean
      from (select jsonb_array_elements(:'h'::jsonb) v) x where k.id = (x.v ->> 'id')::uuid`, { h: horarios })
  }
})

/* ── Punto 11 · ¿asistió? ────────────────────────────────────────────── */

const filaDe = (v: Locator, id: string): Locator => v.locator(`[data-asistencia-cita="${id}"]`)

/* MUTACIONES: `HORAS_SIN_PREGUNTAR` en 46 → rojo (sale la de hace 47 h); `alcanceDeAsistencia`
   devolviendo '' a todos → rojo (la médica invitada ve las del administrador). */
test('11 · una ventana con las de hace más de 48 h sin nota; «Sí asistió», «No asistió» y «Decidir después»', async ({ page, browser }) => {
  const vieja = cita({ correo: CORREO.adminA, inicio: haceHoras(49), apellidos: 'Prueba 21', estado: 'scheduled', minutos: 30 })
  const confirmada = cita({ correo: CORREO.adminA, inicio: haceHoras(60), apellidos: 'Prueba 22', estado: 'confirmed', minutos: 30 })
  const reciente = cita({ correo: CORREO.adminA, inicio: haceHoras(47), apellidos: 'Prueba 23', estado: 'scheduled', minutos: 30 })
  const conNota = cita({ correo: CORREO.adminA, inicio: haceHoras(50), apellidos: 'Prueba 24', estado: 'scheduled', minutos: 30 })
  notaLigada(conNota.id, conNota.paciente)
  const deLaInvitada = cita({ correo: CORREO.medicoA, inicio: haceHoras(52), apellidos: 'Prueba 25', estado: 'scheduled', minutos: 30 })
  const porLigar = crearCitaPorLigar({ correo: CORREO.adminA, inicio: haceHoras(55), minutos: 30, nombre: 'Persona Por Ligar I4', canal: 'unico' })
  const incidencias = (): string => sqlLocal(`select count(*) from public.reserva_incidencias where appointment_id = :'id' and anulada_en is null`, { id: porLigar.citaId })

  await abrirAgendaV2(page)
  const v = preguntaAsistencia(page)
  await expect(v).toBeVisible()
  await expect(v.locator('[data-asistencia-cita]')).toHaveCount(4)
  for (const id of [vieja.id, confirmada.id, deLaInvitada.id, porLigar.citaId]) await expect(filaDe(v, id)).toHaveCount(1)
  // Abrir la agenda no cambia nada solo, ni cuenta para el candado.
  expect([vieja.id, confirmada.id, reciente.id, deLaInvitada.id, porLigar.citaId].map(estado)).toEqual(['scheduled', 'confirmed', 'scheduled', 'scheduled', 'scheduled'])
  expect(incidencias()).toBe('0')
  // Sin ofrecer la nota.
  await expect(v.getByRole('button', { name: /nota/i })).toHaveCount(0)

  await filaDe(v, vieja.id).getByRole('button', { name: 'Sí asistió' }).click()
  await expect(filaDe(v, vieja.id)).toHaveCount(0)
  expect(estado(vieja.id)).toBe('attended')
  await filaDe(v, porLigar.citaId).getByRole('button', { name: 'No asistió' }).click()
  await expect(filaDe(v, porLigar.citaId)).toHaveCount(0)
  expect(estado(porLigar.citaId)).toBe('no_show')
  expect(incidencias()).toBe('1')
  await v.getByRole('button', { name: 'Decidir después' }).click()
  await expect(v).toHaveCount(0)
  expect([confirmada.id, deLaInvitada.id].map(estado)).toEqual(['confirmed', 'scheduled'])

  // La próxima vez vuelve a salir, con las que quedan.
  await page.reload()
  await expect(preguntaAsistencia(page).locator('[data-asistencia-cita]')).toHaveCount(2)

  // La médica invitada: sólo las suyas.
  await enContextoNuevo(browser, SESION.medicoA, async (p: Page) => {
    await abrirAgendaV2(p)
    const w = preguntaAsistencia(p)
    await expect(filaDe(w, deLaInvitada.id)).toHaveCount(1)
    await expect(w.locator('[data-asistencia-cita]')).toHaveCount(1)
  })
  // La secretaria: las de la clínica.
  await enContextoNuevo(browser, SESION.secretariaA, async (p: Page) => {
    await abrirAgendaV2(p)
    await expect(preguntaAsistencia(p).locator('[data-asistencia-cita]')).toHaveCount(2)
  })
})

/* Con la v2 apagada no se pregunta nada (y nada cambia). */
test('11 · v2 apagada: no sale la ventana', async ({ page }) => {
  const vieja = cita({ correo: CORREO.adminA, inicio: haceHoras(49), apellidos: 'Prueba 21', estado: 'scheduled', minutos: 30 })
  interruptorAgenda('A', false)
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada')
  await page.waitForLoadState('networkidle')
  await expect(preguntaAsistencia(page)).toHaveCount(0)
  expect(estado(vieja.id)).toBe('scheduled')
})

/* ── Punto 12 · «Reasignar» ──────────────────────────────────────────── */

/* MUTACIÓN: la burbuja sin `sustituye_a` (CapaBurbuja) → rojo (la cancelada no se cierra y se sigue pintando). */
test('12 · «Reasignar»: la burbuja en ESE hueco, otro paciente; la cancelada se cierra, no se borra, y deja de pintarse', async ({ page }) => {
  const ini = fechaHoraLocalAInstante(MIERCOLES_5, '10:00', TZ)
  const vieja = cita({ correo: CORREO.adminA, inicio: ini, apellidos: 'Prueba 21', estado: 'cancelled', minutos: 30 })
  await abrirAgendaV2(page)
  for (let i = 0; i < 5; i++) await page.locator('.fc-next-button').click()
  await page.locator('.fc-timegrid-event', { hasText: 'Prueba 21' }).first().click({ position: { x: 8, y: 8 } })
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  await t.getByRole('button', { name: 'Reasignar el horario', exact: true }).click()
  const b = burbuja(page)
  await expect(b).toBeVisible()
  await expect(b).toHaveAccessibleName(/10:00–10:30/)
  await expect(b.getByRole('combobox')).toHaveValue('')
  await elegirPaciente(b, 'Prueba 22')
  const post = page.waitForResponse(r => r.url().endsWith('/api/appointments') && r.request().method() === 'POST')
  await b.getByRole('button', { name: 'Guardar', exact: true }).click()
  const res = await post
  const cuerpo = (await res.json()) as { appointment: { id: string }; sustituida: string | null }
  // Antes de afirmar nada: lo creado se borra al terminar aunque la prueba falle (una mutación lo dejó suelto).
  if (cuerpo.appointment?.id) creadas.push(cuerpo.appointment.id)
  expect(res.ok()).toBe(true)
  expect(res.request().postDataJSON()).toMatchObject({ sustituye_a: vieja.id })
  expect(cuerpo.sustituida).toBe(vieja.id)
  // En la base: sigue cancelada, cerrada y ligada a la nueva; la nueva, en el mismo hueco.
  expect(sqlLocal(`select status || '|' || (cerrada_en is not null) || '|' || sustituida_por from public.appointments where id = :'id'`, { id: vieja.id }))
    .toBe(`cancelled|true|${cuerpo.appointment.id}`)
  expect(sqlLocal(`select start_time = :'i'::timestamptz from public.appointments where id = :'n'`, { n: cuerpo.appointment.id, i: ini })).toBe('t')
  expect(sqlLocal(`select count(*) from public.audit_log where registro_id = :'id' and accion = 'cita_sustituida'`, { id: vieja.id })).toBe('1')
  // En la agenda: la cancelada ya no está (tampoco tras recargar); la nueva, sí.
  await expect(page.locator('.fc-timegrid-event', { hasText: 'Prueba 21' })).toHaveCount(0)
  await page.reload()
  await abrirAgendaV2(page)
  for (let i = 0; i < 5; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator('.fc-timegrid-event', { hasText: 'Prueba 22' })).toHaveCount(1)
  await expect(page.locator('.fc-timegrid-event', { hasText: 'Prueba 21' })).toHaveCount(0)
})

/* Lo que el servidor rechaza: sustituir algo que no es una cancelada abierta. */
test('12 · el servidor sólo cierra una cancelada abierta de la clínica, y la nueva no se crea si no', async ({ page }) => {
  const viva = cita({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(MIERCOLES_5, '12:00', TZ), apellidos: 'Prueba 21', estado: 'scheduled', minutos: 30 })
  const [medico, consultorio, paciente] = sqlLocal(`select medico_id || '|' || consultorio_id || '|' || paciente_id from public.appointments where id = :'id'`, { id: viva.id }).split('|')
  const ini = fechaHoraLocalAInstante(MIERCOLES_5, '15:00', TZ)
  const cuerpo = (sustituye: string): Record<string, unknown> => ({
    title: 'Paciente Prueba 21', start_time: ini, end_time: new Date(new Date(ini).getTime() + 1_800_000).toISOString(),
    medico_id: medico, consultorio_id: consultorio, paciente_id: paciente, status: 'scheduled', sustituye_a: sustituye,
  })
  const antes = sqlLocal(`select count(*) from public.appointments where start_time = :'i'::timestamptz`, { i: ini })
  const estados: number[] = []
  for (const s of [viva.id, 'no-es-uuid', '00000000-0000-4000-8000-000000000000']) {
    const r = await page.request.post('/api/appointments', { data: cuerpo(s) })
    estados.push(r.status())
    const id = ((await r.json().catch(() => ({}))) as { appointment?: { id?: string } }).appointment?.id
    if (id) creadas.push(id) // si una mutación la dejó entrar, se borra igual
  }
  expect(estados).toEqual([409, 400, 404])
  expect(sqlLocal(`select count(*) from public.appointments where start_time = :'i'::timestamptz`, { i: ini })).toBe(antes)
})

/* Revisión independiente: el REINTENTO de la misma alta (mismo `client_id`) no es un 409: devuelve la
   cita que ya entró y la cancelada que cerró. MUTACIÓN: `comprobarSustituible` sin el paso del
   reintento → rojo (409 `sustituye_a_invalida` en el segundo envío). */
test('12 · el reintento de la misma alta (mismo client_id) devuelve la cita que ya entró, con su cancelada cerrada', async ({ page }) => {
  const vieja = cita({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(MIERCOLES_5, '16:00', TZ), apellidos: 'Prueba 21', estado: 'cancelled', minutos: 30 })
  const [medico, consultorio, paciente] = sqlLocal(`select medico_id || '|' || consultorio_id || '|' || paciente_id from public.appointments where id = :'id'`, { id: vieja.id }).split('|')
  const ini = fechaHoraLocalAInstante(MIERCOLES_5, '17:00', TZ)
  const data = {
    title: 'Paciente Prueba 21', start_time: ini, end_time: new Date(new Date(ini).getTime() + 1_800_000).toISOString(),
    medico_id: medico, consultorio_id: consultorio, paciente_id: paciente, status: 'scheduled', sustituye_a: vieja.id,
    client_id: sqlLocal('select gen_random_uuid()'),
  }
  const r1 = await page.request.post('/api/appointments', { data })
  const c1 = (await r1.json()) as { appointment: { id: string }; sustituida: string | null }
  if (c1.appointment?.id) creadas.push(c1.appointment.id)
  expect(r1.status()).toBe(200)
  expect(c1.sustituida).toBe(vieja.id)
  const r2 = await page.request.post('/api/appointments', { data })
  expect(r2.status()).toBe(200)
  expect(await r2.json()).toMatchObject({ appointment: { id: c1.appointment.id }, sustituida: vieja.id })
  expect(sqlLocal(`select count(*) from public.audit_log where registro_id = :'id' and accion = 'cita_sustituida'`, { id: vieja.id })).toBe('1')
})
