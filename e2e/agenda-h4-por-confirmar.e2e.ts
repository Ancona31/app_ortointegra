import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { SESION, interruptorAgenda, soloEscritorio, sqlLocal, tituloUnico } from './ayudas'
import { abrirAgendaV2 } from './interaccionesAyudas'
import { ipAlAzar } from './reservaPublicaAyudas' // además carga .env.local (RESERVA_SECRETO)
import { codigoDeConfirmacion, hashDeCodigo } from '../src/lib/reserva/secretos'

/**
 * H4 · «Por confirmar» (puntos 15 a 19 de Angel):
 *   15. sólo las citas de MAÑANA que siguen agendadas;
 *   16. al abrirlo, la leyenda «Estos pacientes están pendientes…»;
 *   17. cada fila, los avisos según lo que tenga el paciente (WhatsApp, correo,
 *       los dos) y, sin ninguno, lo dice y ofrece «Marcar como confirmada»;
 *   18. al confirmar o cancelar (a mano o el paciente por /confirmar), la fila
 *       sale sin cerrar el menú, por el canal ÚNICO de tiempo real (un join);
 *   19. el punto rojo del botón también con pendientes, y el contador de
 *       canceladas y empalmes de siempre.
 *
 * MUTACIONES que lo ponen en rojo (comprobadas): sin la leyenda; `con_correo`
 * siempre `true` en la ruta; sin `onCambioCita` en `AgendaCliente` (las filas no
 * salen solas); `AlertaBoton` sin el punto de pendientes; «Marcar como
 * confirmada» sin `cambiarEstadoCita`.
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
type Fila = { cita: string; paciente: string; titulo: string; codigo: string }
const filas: Record<'ambos' | 'tel' | 'correo' | 'ninguno', Fila> = {
  ambos: { cita: '', paciente: '', titulo: '', codigo: '' },
  tel: { cita: '', paciente: '', titulo: '', codigo: '' },
  correo: { cita: '', paciente: '', titulo: '', codigo: '' },
  ninguno: { cita: '', paciente: '', titulo: '', codigo: '' },
}
/** Lo que crean las pruebas además de las cuatro filas (la cita nueva de mañana y su paciente). */
const extras: string[] = []
const pacientesExtra: string[] = []

/** Una cita de MAÑANA (hora de Mérida) del administrador en Centro, con su paciente y su enlace de confirmación. */
function citaDeManana(hora: string, titulo: string, tel: string | null, correo: string | null): Fila {
  const enlace = randomUUID()
  const codigo = codigoDeConfirmacion(enlace)
  if (!codigo) throw new Error('Falta RESERVA_SECRETO en .env.local')
  const salida = sqlLocal(`
    with p as (insert into public.pacientes (clinica_id, nombre, apellidos, telefono, email)
               values (${CL}, :'titulo', 'H4', nullif(:'tel', ''), nullif(:'correo', '')) returning id),
         co as (select id, medico_id, nombre, timezone from public.consultorios
                 where clinica_id = ${CL} and nombre = 'Consultorio Centro (ficticio)'),
         d as (select (((now() at time zone :'tz')::date + 1) + :'hora'::time) at time zone :'tz' as t),
         a as (insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time,
                                                status, all_day, consultorio_nombre, consultorio_timezone, origen)
               select ${CL}, (select id from p), co.medico_id, co.id, :'titulo', d.t, d.t + interval '30 min',
                      'scheduled', false, co.nombre, co.timezone, 'spinus' from co, d returning id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select :'enlace', ${CL}, a.id, :'hash', a.paciente_id from a
    returning appointment_id || '|' || paciente_id;`,
  { titulo, tel: tel ?? '', correo: correo ?? '', tz: TZ, hora, enlace, hash: hashDeCodigo(codigo) })
  const [cita = '', paciente = ''] = salida.split('|')
  return { cita, paciente, titulo, codigo }
}

test.beforeAll(() => {
  interruptorAgenda('A', true)
  filas.ambos = citaDeManana('07:00', tituloUnico('H4 Ambos'), '9990000091', 'h4.ambos@semilla.spinus.test')
  filas.tel = citaDeManana('07:15', tituloUnico('H4 Telefono'), '9990000092', null)
  filas.correo = citaDeManana('07:30', tituloUnico('H4 Correo'), null, 'h4.correo@semilla.spinus.test')
  filas.ninguno = citaDeManana('07:45', tituloUnico('H4 Ninguno'), null, null)
})

test.afterAll(() => {
  const citas = [...Object.values(filas).map(f => f.cita), ...extras].filter(Boolean)
  const pacientes = [...Object.values(filas).map(f => f.paciente), ...pacientesExtra].filter(Boolean)
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    create temp table _c on commit drop as select unnest(string_to_array(:'citas', ','))::uuid as id;
    delete from public.audit_log where registro_id in (select id from _c)
       or registro_id in (select id from public.cita_confirmaciones where appointment_id in (select id from _c));
    delete from public.cita_correos where appointment_id in (select id from _c);
    delete from public.cita_confirmaciones where appointment_id in (select id from _c);
    delete from public.appointments where id in (select id from _c);
    delete from public.pacientes where id = any(string_to_array(:'pacientes', ',')::uuid[]);
    commit;`, { citas: citas.join(','), pacientes: pacientes.join(',') })
  interruptorAgenda('A', false) // como el resto de las e2e: quien lo enciende, lo apaga (global-setup)
})

const panel = (page: Page) => page.getByRole('dialog', { name: 'Citas de mañana por confirmar' })
const fila = (page: Page, f: Fila) => page.locator(`[data-fila-por-confirmar="${f.cita}"]`)

async function abrirPanel(page: Page): Promise<void> {
  await page.locator('[data-por-confirmar]').click()
  await expect(panel(page)).toBeVisible()
  await expect(fila(page, filas.ambos)).toBeVisible()
}

/** Cuenta los `phx_join` del canal de la agenda. Antes de `goto`. */
function contarJoins(page: Page): () => number {
  let n = 0
  page.on('websocket', ws => ws.on('framesent', ({ payload }) => {
    const t = typeof payload === 'string' ? payload : payload.toString('utf8')
    if (t.includes('"phx_join"') && t.includes('appointments-realtime')) n += 1
  }))
  return () => n
}

test('15-17: sólo agendadas de mañana; la leyenda; cada fila con sus medios; sin ninguno, «Marcar como confirmada»', async ({ page }) => {
  await abrirAgendaV2(page)
  await abrirPanel(page)
  await expect(panel(page).getByText('Estos pacientes están pendientes de confirmar su cita. Envía un recordatorio.', { exact: true })).toBeVisible()
  const medios = async (f: Fila) => {
    const l = fila(page, f)
    return [
      await l.getByRole('button', { name: 'WhatsApp' }).count(),
      await l.getByRole('button', { name: 'Enviar confirmación por correo' }).count(),
      await l.getByRole('button', { name: 'Marcar como confirmada' }).count(),
    ].join('')
  }
  expect(await medios(filas.ambos)).toBe('110')
  expect(await medios(filas.tel)).toBe('100')
  expect(await medios(filas.correo)).toBe('010')
  expect(await medios(filas.ninguno)).toBe('001')
  await expect(fila(page, filas.ninguno)).toContainText('Sin teléfono válido ni correo.')
  // Nombre, hora y consultorio; nada clínico.
  await expect(fila(page, filas.ambos)).toContainText('07:00 · Consultorio Centro (ficticio)')
  // El correo sale por la ruta de G3 (Mailpit en local).
  const post = page.waitForResponse(r => r.url().endsWith('/api/agenda/correo') && r.request().method() === 'POST')
  await fila(page, filas.correo).getByRole('button', { name: 'Enviar confirmación por correo' }).click()
  expect((await post).status()).toBe(200)
  await expect(fila(page, filas.correo)).toContainText('Enviado por correo')
})

test('18: «Marcar como confirmada» la saca al instante, sin cerrar el menú, por el PUT de «Confirmar» (firma y auditoría)', async ({ page }) => {
  await abrirAgendaV2(page)
  await abrirPanel(page)
  const auditAntes = Number(sqlLocal(`select count(*) from public.audit_log where registro_id = :'id'`, { id: filas.ninguno.cita }))
  const put = page.waitForRequest(r => r.url().endsWith(`/api/appointments/${filas.ninguno.cita}`) && r.method() === 'PUT')
  await fila(page, filas.ninguno).getByRole('button', { name: 'Marcar como confirmada' }).click()
  const cuerpo: unknown = (await put).postDataJSON()
  expect(cuerpo).toMatchObject({ status: 'confirmed' })
  expect(typeof (cuerpo as { client_id?: unknown }).client_id).toBe('string')
  await expect(fila(page, filas.ninguno)).toHaveCount(0)
  await expect(panel(page)).toBeVisible()
  await expect.poll(() => sqlLocal(`select status from public.appointments where id = :'id'`, { id: filas.ninguno.cita })).toBe('confirmed')
  await expect.poll(() => Number(sqlLocal(`select count(*) from public.audit_log where registro_id = :'id'`, { id: filas.ninguno.cita })))
    .toBeGreaterThan(auditAntes)
})

test('18: el paciente confirma por /confirmar en otra pestaña y la fila sale sin cerrar el menú; un solo join y sin peticiones en reposo', async ({ page, browser }) => {
  const joins = contarJoins(page)
  let gets = 0
  page.on('request', r => { if (r.url().includes('/api/agenda/por-confirmar')) gets += 1 })
  await abrirAgendaV2(page)
  await expect.poll(() => gets).toBe(1) // la de siempre, en ocioso al montar
  await page.waitForTimeout(2500)
  expect(gets).toBe(1) // en reposo, nada
  await abrirPanel(page)
  const getsTrasAbrir = gets
  const paciente = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })
  try {
    const p = await paciente.newPage()
    await p.goto(`/confirmar/${filas.tel.codigo}`)
    await p.getByRole('button', { name: 'Confirmo mi asistencia' }).click()
    await p.waitForURL(/\?r=confirmada$/)
  } finally { await paciente.close() }
  await expect(fila(page, filas.tel)).toHaveCount(0, { timeout: 10000 })
  await expect(panel(page)).toBeVisible()
  expect(gets).toBe(getsTrasAbrir) // salir no pide nada
  expect(joins()).toBe(1)
})

test('18 y 19: cancelar (el paciente y el personal) la saca; una cita nueva para mañana entra; el contador rojo de canceladas', async ({ page, browser }) => {
  await abrirAgendaV2(page)
  await abrirPanel(page)
  const paciente = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })
  try {
    const p = await paciente.newPage()
    await p.goto(`/confirmar/${filas.correo.codigo}?paso=cancelar`)
    await p.getByRole('button', { name: 'Sí, cancelar mi cita' }).click()
    await p.waitForURL(/\?r=cancelada$/)
  } finally { await paciente.close() }
  await expect(fila(page, filas.correo)).toHaveCount(0, { timeout: 10000 })
  await expect(page.locator(`[data-fila-cancelada="${filas.correo.cita}"]`)).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-alerta-por-confirmar="avisos"]')).toBeVisible()

  // El personal, desde otra sesión: el mismo PUT que «Cancelar» de la tarjeta.
  const secretaria = await browser.newContext({ storageState: SESION.secretariaA })
  try {
    const r = await secretaria.request.put(`/api/appointments/${filas.ambos.cita}`, { data: { status: 'cancelled', client_id: randomUUID() } })
    expect(r.status()).toBe(200)
  } finally { await secretaria.close() }
  await expect(fila(page, filas.ambos)).toHaveCount(0, { timeout: 10000 })

  // Una cita nueva para mañana entra sola.
  const nueva = citaDeManana('06:45', tituloUnico('H4 Nueva'), '9990000093', null)
  extras.push(nueva.cita)
  pacientesExtra.push(nueva.paciente)
  await expect(page.locator(`[data-fila-por-confirmar="${nueva.cita}"]`)).toBeVisible({ timeout: 10000 })
  await expect(panel(page)).toBeVisible()
})

test('19: el punto rojo — vacío, nada; sólo pendientes, un punto; con canceladas o empalmes, el contador de siempre', async ({ page }) => {
  const fila0 = { id: 'x', inicio: new Date(Date.now() + 26 * 3_600_000).toISOString(), zona: TZ, titulo: 'X', consultorio: 'C',
    con_whatsapp: false, con_correo: false, whatsapp_reminder_sent_at: null }
  const cancelada = { id: 'y', inicio: fila0.inicio, zona: TZ, titulo: 'Y', respondido_en: new Date().toISOString() }
  const casos: [string, unknown, string | null][] = [
    ['vacío', { citas: [], canceladas: [], empalmes: [] }, null],
    ['pendientes', { citas: [fila0], canceladas: [], empalmes: [] }, 'pendientes'],
    ['avisos', { citas: [fila0], canceladas: [cancelada], empalmes: [] }, 'avisos'],
  ]
  for (const [, json, alerta] of casos) {
    await page.route('**/api/agenda/por-confirmar', r => r.fulfill({ json }))
    await abrirAgendaV2(page)
    await expect(page.locator('[data-por-confirmar]')).toContainText(/Por confirmar \(\d+\)/)
    if (alerta) await expect(page.locator(`[data-alerta-por-confirmar="${alerta}"]`)).toBeVisible()
    else await expect(page.locator('[data-alerta-por-confirmar]')).toHaveCount(0)
    if (alerta === 'avisos') await expect(page.locator('[data-alerta-por-confirmar="avisos"]')).toHaveText('1')
    await page.unroute('**/api/agenda/por-confirmar')
  }
})
