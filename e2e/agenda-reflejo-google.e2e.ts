import { test, expect, request, type Browser, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { CORREO, SESION, diaDeLaSemana, interruptorAgenda, sqlLocal } from './ayudas'
import { arrancarGoogleFalso, CALENDARIO, type GoogleFalso } from './google-falso/servidor'
import { fechaHoraLocalAInstante } from '../src/lib/dates'
import { encrypt } from '../src/lib/encrypt'

/**
 * I1 · punto 6 de Angel, el camino de Google: lo que trae una sincronización
 * que NO sale de esta agenda (el cron, otra pestaña, la que hace la reserva
 * por enlace antes de reservar) llega a la agenda abierta sin recargar, por el
 * canal de Realtime: el `INSERT` de un evento creado en Google y el `UPDATE`
 * del RSVP «accepted» del paciente (E9) que pasa la cita a confirmada.
 *
 * El sondeo AL ABRIR la agenda (C6) ya lo cubre `agenda-google-dos-sentidos`;
 * esto es lo que llega con la agenda ya abierta. Al volver a la agenda tras un
 * cambio así lo cubre el mismo canal que sobrevive al desmontaje (ver
 * `agenda-reflejo-enlace.e2e.ts`: el camino del cambio en la base es el mismo).
 *
 * Como `agenda-google-dos-sentidos.e2e.ts` (léelo: POR QUÉ :3002 y no :3001):
 * su propio `next dev --webpack -p 3002` contra el Google FALSO, nunca el real,
 * y aquí además con `AGENDA_RSVP_GOOGLE=encendido` (E9 está detrás de él).
 * Las ayudas de preparación se duplican a propósito (Protocolo 4). Sólo en
 * `escritorio`, con el candado de las e2e como todas.
 *
 * MUTACIÓN (comprobada en rojo): no reenviar el cambio del canal a la agenda
 * montada (`vivo.montaje?.aplicar` en `abrirCanalAgenda`) → las dos.
 */

const PUERTO = 3002
const BASE = `http://localhost:${PUERTO}`
const CLINICA_A = 'Clínica Semilla A'
const ESCRITORIO = 'escritorio'
const TZ = 'America/Merida'
const JUEVES_W1 = diaDeLaSemana(1, 3)

let google: GoogleFalso | null = null
let servidor: ChildProcess | null = null
const creadas: string[] = []

test.describe.configure({ mode: 'serial' })
test.use({ baseURL: BASE, storageState: SESION.adminA })

/* ── Preparación (la de agenda-google-dos-sentidos, duplicada) ─────────── */

function cargarClaveDeTokens(): void {
  const linea = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('GOOGLE_TOKEN_SECRET='))
  if (!linea) throw new Error('falta GOOGLE_TOKEN_SECRET en .env.local')
  process.env.GOOGLE_TOKEN_SECRET = linea.slice('GOOGLE_TOKEN_SECRET='.length).trim().replace(/^"|"$/g, '')
}

function borrarConexion(): void {
  sqlLocal(`
    delete from private.google_conexiones_secretos s using public.clinica_conexiones_google g, public.clinicas c
     where s.conexion_id = g.id and g.clinica_id = c.id and c.nombre = :'clinica';
    delete from public.gcal_sync_estado e using public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';
    delete from public.clinica_conexiones_google g using public.clinicas c where g.clinica_id = c.id and c.nombre = :'clinica';`,
  { clinica: CLINICA_A })
}

function sembrarConexion(): void {
  borrarConexion()
  const salida = sqlLocal(`
    with g as (
      insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado, google_account_email)
      select c.id, u.id, 'clinica', :'calendario', 'activa', 'falso@google-falso.test'
        from public.clinicas c, auth.users u where c.nombre = :'clinica' and u.email = :'correo'
      returning id)
    insert into private.google_conexiones_secretos (conexion_id, access_token, refresh_token, expires_at)
    select g.id, :'acceso', :'refresco', :'caduca'::bigint from g returning conexion_id;`, {
    clinica: CLINICA_A, correo: CORREO.adminA, calendario: CALENDARIO,
    acceso: encrypt('token-falso-de-acceso'), refresco: encrypt('token-falso-de-refresco'),
    caduca: String(Date.now() + 10 * 365 * 86_400_000),
  })
  if (salida.split('\n').filter(Boolean).length !== 1) throw new Error(`sembrarConexion: salió «${salida}»`)
}

/** Simula que pasaron los 60 s mínimos entre sondeos (C-g) sin esperarlos. */
function permitirSondeo(): void {
  sqlLocal(`update public.gcal_sync_estado e set ultima_ok = now() - interval '5 minutes', candado = null, candado_hasta = null
              from public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';`, { clinica: CLINICA_A })
}

async function esperarServidor(): Promise<void> {
  const tope = Date.now() + 240_000
  while (Date.now() < tope) {
    try {
      if ((await fetch(`${BASE}/login`)).status === 200) return
    } catch { /* todavía no escucha */ }
    await new Promise((ok) => setTimeout(ok, 1000))
  }
  throw new Error('next dev en :3002 no respondió en 4 minutos (ver test-results/next-dev-3002.log)')
}

function arrancarNextDev(urlFalso: string): ChildProcess {
  mkdirSync('test-results', { recursive: true })
  const log = openSync('test-results/next-dev-3002.log', 'w')
  const env: NodeJS.ProcessEnv = {
    ...process.env, NODE_ENV: 'development', GCAL_FALSO_URL: urlFalso, AGENDA_RSVP_GOOGLE: 'encendido',
    GOOGLE_CLIENT_ID: 'cliente-falso', GOOGLE_CLIENT_SECRET: 'secreto-falso', NEXT_TELEMETRY_DISABLED: '1',
  }
  const hijo = spawn('npx', ['next', 'dev', '--webpack', '-p', String(PUERTO)], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log, log] })
  closeSync(log)
  return hijo
}

/** Primera compilación de las páginas y rutas que se usan (en dev se compila al pedir). */
async function calentar(browser: Browser): Promise<void> {
  const ctx = await browser.newContext({ storageState: SESION.adminA, baseURL: BASE })
  const page = await ctx.newPage()
  await page.goto('/agenda', { timeout: 240_000 })
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 240_000 })
  await page.request.post('/api/google/sync', { timeout: 120_000 })
  await page.request.get(`/api/appointments/${'00000000-0000-4000-8000-000000000000'}`, { timeout: 120_000 })
  await ctx.close()
}

test.beforeAll(async ({ browser }, info) => {
  if (info.project.name !== ESCRITORIO) return
  info.setTimeout(420_000)
  cargarClaveDeTokens()
  google = await arrancarGoogleFalso()
  sembrarConexion()
  interruptorAgenda('A', true)
  servidor = arrancarNextDev(google.url)
  await esperarServidor()
  await calentar(browser)
})

test.afterAll(async ({}, info) => {
  if (info.project.name !== ESCRITORIO) return
  if (creadas.length) {
    sqlLocal(`
      begin;
      set local session_replication_role = replica;
      delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]);
      commit;`, { ids: creadas.join(',') })
  }
  borrarConexion()
  if (servidor?.pid) {
    try { process.kill(-servidor.pid, 'SIGTERM') } catch { /* ya no estaba */ }
  }
  await google?.cerrar()
  // Integración I: cada archivo deja la v2 APAGADA al terminar (la convención de la batería: el
  // global-setup la apaga y sólo la prueba que la necesita la enciende). Encendida, las e2e que
  // la suponen apagada (agenda-secretaria, agenda-tipos-cita) caían en el aviso de empalme B7.
  interruptorAgenda('A', false)
})

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== ESCRITORIO, 'un solo next dev por corrida: sólo en escritorio')
  info.setTimeout(180_000)
})

/* ── Ayudas de la prueba ──────────────────────────────────────────────── */

function g(): GoogleFalso {
  if (!google) throw new Error('el Google falso no arrancó')
  return google
}

/** Una sincronización que NO sale de la agenda abierta: otro contexto, como el cron u otra pestaña. */
async function sincronizarDesdeFuera(): Promise<number> {
  permitirSondeo()
  const ctx = await request.newContext({ baseURL: BASE, storageState: SESION.adminA })
  try {
    const r = await ctx.post('/api/google/sync', { timeout: 120_000 })
    const cuerpo = (await r.json()) as { estado: string; cambios: number }
    expect(r.ok(), JSON.stringify(cuerpo)).toBeTruthy()
    expect(cuerpo.estado, JSON.stringify(cuerpo)).toBe('ok')
    return cuerpo.cambios
  } finally {
    await ctx.dispose()
  }
}

/** Abre la agenda, espera su sondeo al abrir (para que no se cruce con el de la prueba) y pasa a W+1. */
async function abrirEnW1(page: Page): Promise<void> {
  permitirSondeo()
  const sondeo = page.waitForResponse((r) => r.url().endsWith('/api/google/sync') && r.request().method() === 'POST', { timeout: 60_000 })
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 60_000 })
  await sondeo
  await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${diaDeLaSemana(1, 0)}"]`)).toBeVisible()
}

/** El estado que dice la tarjeta de esa cita («… · Confirmada»), o «(sin tarjeta)». */
async function estadoEnTarjeta(page: Page, id: string): Promise<string> {
  const caja = page.locator(`.fc-timegrid-event [data-cita-id="${id}"]`)
  if (!(await caja.count())) return '(sin tarjeta)'
  const texto = (await caja.getAttribute('title')) ?? (await caja.getAttribute('aria-label')) ?? ''
  return texto.split(' · ')[1] ?? texto
}

/**
 * Un id de evento que no haya usado nadie. Los del falso (`google1`,
 * `falso3x`…) vuelven a empezar en cada corrida y la base guarda filas de
 * corridas anteriores ligadas a esos mismos ids: con uno repetido, la
 * sincronización casa el evento con una fila vieja y no importa nada.
 */
function idUnico(): string {
  return `i1${Date.now().toString(32)}${Math.floor(Math.random() * 1e6).toString(32)}`
}

/**
 * Una cita de admin.a para «Paciente Prueba 17» el jueves de W+1, YA ligada a
 * su evento del Google falso (como la dejaría el alta), por SQL y con un id de
 * evento propio (ver `idUnico`). Devuelve la cita, el evento y el correo del
 * paciente, que es con el que la base casa el RSVP.
 */
function citaLigada(hora: string): { id: string; evento: string; correo: string } {
  const evento = idUnico()
  const inicio = fechaHoraLocalAInstante(JUEVES_W1, hora, TZ)
  const fin = new Date(Date.parse(inicio) + 30 * 60_000).toISOString()
  const [id = '', correo = ''] = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status,
           consultorio_nombre, consultorio_nombre_corto, consultorio_direccion, consultorio_telefono, consultorio_timezone,
           origen, google_event_id, gcal_calendar_id, gcal_sync_status)
    select co.clinica_id, pa.id, co.medico_id, co.id, 'Paciente Prueba 17', :'ini'::timestamptz, :'fin'::timestamptz, 'scheduled',
           co.nombre, co.nombre_corto, co.direccion, co.telefono, :'tz', 'spinus', :'ev', :'cal', 'synced'
      from public.consultorios co join public.pacientes pa on pa.clinica_id = co.clinica_id and pa.apellidos = 'Prueba 17'
     where co.nombre = 'Consultorio Centro (ficticio)'
    returning id || '|' || (select email from public.pacientes where id = paciente_id)`,
  { ini: inicio, fin, tz: TZ, ev: evento, cal: CALENDARIO }).split('|')
  creadas.push(id)
  g().crear({ id: evento, summary: 'Paciente Prueba 17', start: { dateTime: inicio, timeZone: TZ }, end: { dateTime: fin, timeZone: TZ },
    extendedProperties: { private: { spinus_cita: id, spinus_v: '2' } } })
  return { id, evento, correo }
}

/* ── Las pruebas ──────────────────────────────────────────────────────── */

test('un evento creado en Google, importado por una sincronización de fuera, aparece en la agenda abierta', async ({ page }) => {
  await abrirEnW1(page)
  const titulo = `Junta Google I1 ${Date.now().toString(36)}`
  const inicio = fechaHoraLocalAInstante(JUEVES_W1, '18:00', TZ)
  g().crear({ id: idUnico(), summary: titulo, start: { dateTime: inicio, timeZone: TZ },
    end: { dateTime: new Date(Date.parse(inicio) + 30 * 60_000).toISOString(), timeZone: TZ } })
  expect(await sincronizarDesdeFuera()).toBeGreaterThan(0)
  const id = sqlLocal(`select id from public.appointments where title = :'t'`, { t: titulo })
  if (id) creadas.push(id)
  await expect(page.locator('.fc-timegrid-event', { hasText: titulo })).toBeVisible({ timeout: 10_000 })
})

test('E9 · el paciente acepta la invitación en Google: con la agenda abierta, la tarjeta pasa a «Confirmada»', async ({ page }) => {
  const cita = citaLigada('18:45')
  await abrirEnW1(page)
  await expect.poll(() => estadoEnTarjeta(page, cita.id)).toBe('Agendada')
  g().modificar(cita.evento, { attendees: [{ email: cita.correo, responseStatus: 'accepted' }] })
  expect(await sincronizarDesdeFuera()).toBeGreaterThan(0)
  expect(sqlLocal(`select status from public.appointments where id = :'id'`, { id: cita.id })).toBe('confirmed')
  await expect.poll(() => estadoEnTarjeta(page, cita.id), { timeout: 10_000 }).toBe('Confirmada')
})
