import { test, expect, type Browser, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { SESION, CORREO, DIA_LABORABLE_LIBRE, interruptorAgenda, sqlLocal } from './ayudas'
import { arrancarGoogleFalso, CALENDARIO, type GoogleFalso } from './google-falso/servidor'
import { encrypt } from '../src/lib/encrypt'
import { desplazarFecha } from '../src/lib/dates'

/**
 * K1 (punto 6) · El bloqueo de horario y Google, contra el Google FALSO (nunca
 * el real). La preparación —`next dev` propio en :3002 con `GCAL_FALSO_URL`,
 * conexión de clínica con tokens falsos que se borra antes y después— es COPIA
 * de `agenda-google-dos-sentidos.e2e.ts` (léelo: por qué :3002 y no :3001).
 *
 *   · De Spinus a Google: el bloqueo sale como evento «Ocupado» (`opaque`),
 *     título «Bloqueado — motivo», con la marca privada `spinus_bloqueo`, en el
 *     calendario de Spinus; y la vista de solo lectura no lo pinta dos veces.
 *   · Movido en Google: se refleja en Spinus (con hora y a días completos).
 *   · Borrado en Google (el borrado llega SIN marca): se borra en Spinus.
 *   · Creado en Google, aunque se titule «Bloqueado»: NUNCA es un bloqueo.
 *   · Quitado en Spinus: se borra en Google.
 *
 * MUTACIONES: en `eventoDeBloqueo`, `transparency: 'transparent'`; en
 * `procesarPagina`, no apartar los marcados (el evento entraría como cita
 * importada); no mandar los borrados sin fila a `aplicarBloqueosDePagina`.
 */

const PUERTO = 3002
const BASE = `http://localhost:${PUERTO}`
const TZ = 'America/Merida'
const CLINICA_A = 'Clínica Semilla A'
const ESCRITORIO = 'escritorio'

let google: GoogleFalso | null = null
let servidor: ChildProcess | null = null

test.describe.configure({ mode: 'serial' })
test.use({ baseURL: BASE, storageState: SESION.adminA })

/* ── Preparación (copia de agenda-google-dos-sentidos) ─────────────────── */

/** `GOOGLE_TOKEN_SECRET` de `.env.local`, para cifrar los tokens falsos como la app. */
function cargarClaveDeTokens(): void {
  const linea = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('GOOGLE_TOKEN_SECRET='))
  if (!linea) throw new Error('falta GOOGLE_TOKEN_SECRET en .env.local')
  process.env.GOOGLE_TOKEN_SECRET = linea.slice('GOOGLE_TOKEN_SECRET='.length).trim().replace(/^"|"$/g, '')
}

/** Borra la conexión de prueba de la clínica A y su estado de sincronización. */
function borrarConexion(): void {
  sqlLocal(`
    delete from private.google_conexiones_secretos s using public.clinica_conexiones_google g, public.clinicas c
     where s.conexion_id = g.id and g.clinica_id = c.id and c.nombre = :'clinica';
    delete from public.gcal_sync_estado e using public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';
    delete from public.clinica_conexiones_google g using public.clinicas c where g.clinica_id = c.id and c.nombre = :'clinica';`,
  { clinica: CLINICA_A })
}

/** Conexión de clínica, del administrador de A, con tokens falsos que no caducan. */
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
  sqlLocal(`update public.gcal_sync_estado e set ultima_ok = now() - interval '5 minutes'
              from public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';`, { clinica: CLINICA_A })
}

async function esperarServidor(): Promise<void> {
  const tope = Date.now() + 240_000
  while (Date.now() < tope) {
    try {
      const res = await fetch(`${BASE}/login`)
      if (res.status === 200) return
    } catch { /* todavía no escucha */ }
    await new Promise((ok) => setTimeout(ok, 1000))
  }
  throw new Error('next dev en :3002 no respondió en 4 minutos (ver test-results/next-dev-3002.log)')
}

function arrancarNextDev(urlFalso: string): ChildProcess {
  mkdirSync('test-results', { recursive: true })
  const log = openSync('test-results/next-dev-3002.log', 'w')
  // `development` explícito: es el de `next dev`, y el único con el que se
  // abre la guarda del desvío (nunca se hereda uno de producción).
  const env: NodeJS.ProcessEnv = {
    ...process.env, NODE_ENV: 'development', GCAL_FALSO_URL: urlFalso,
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
  servidor = arrancarNextDev(google.url)
  await esperarServidor()
  await calentar(browser)
})

test.afterAll(async ({}, info) => {
  if (info.project.name !== ESCRITORIO) return
  borrarBloqueos()
  interruptorAgenda('A', true)
  interruptorAgenda('B', false)
  borrarConexion()
  if (servidor?.pid) {
    try { process.kill(-servidor.pid, 'SIGTERM') } catch { /* ya no estaba */ }
  }
  await google?.cerrar()
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

function medicoA(): string {
  return sqlLocal(`select id from auth.users where email = :'correo'`, { correo: CORREO.adminA })
}

function borrarBloqueos(): void {
  sqlLocal(`delete from public.agenda_bloqueos b using public.clinicas c where c.id = b.clinica_id and c.nombre = :'clinica';`, { clinica: CLINICA_A })
}

/** Lo que dice la base del bloqueo: evento, inicio (hora de Mérida), días completos. */
function bloqueo(id: string): string {
  return sqlLocal(`select coalesce(google_event_id, '') || '|' || to_char(inicio at time zone :'tz', 'YYYY-MM-DD HH24:MI') || '|' ||
      case when todo_el_dia then 't' else 'f' end from public.agenda_bloqueos where id = :'id'`, { id, tz: TZ })
}

async function crearBloqueo(page: Page): Promise<string> {
  const res = await page.request.post('/api/agenda/bloqueos', { data: {
    medico_id: medicoA(), todo_el_dia: false, fecha: DIA_LABORABLE_LIBRE, hora_inicio: '18:00',
    fecha_fin: DIA_LABORABLE_LIBRE, hora_fin: '19:00', zona: TZ, motivo: 'Congreso K1',
  } })
  expect(res.status(), await res.text()).toBe(201)
  return ((await res.json()) as { bloqueo: { id: string } }).bloqueo.id
}

async function sondear(page: Page): Promise<void> {
  permitirSondeo()
  const res = await page.request.post('/api/google/sync', { timeout: 120_000 })
  expect(res.ok(), await res.text()).toBeTruthy()
}

/* ── Las pruebas ──────────────────────────────────────────────────────── */

test('de Spinus a Google: «Ocupado», «Bloqueado — motivo», marca privada, y no se pinta dos veces', async ({ page }) => {
  interruptorAgenda('A', true)
  borrarBloqueos()
  const id = await crearBloqueo(page)
  await expect.poll(() => bloqueo(id).split('|')[0], { timeout: 30_000 }).not.toBe('')
  const ev = g().eventos.get(bloqueo(id).split('|')[0])
  expect(ev?.summary).toBe('Bloqueado — Congreso K1')
  expect(ev?.transparency).toBe('opaque')
  expect(ev?.extendedProperties?.private).toEqual({ spinus_bloqueo: id, spinus_v: '2' })
  expect(ev?.attendees).toBeUndefined()
  const lista = await page.request.get(`/api/google/events?from=${DIA_LABORABLE_LIBRE}T00:00:00Z&to=${DIA_LABORABLE_LIBRE}T23:59:59Z`)
  expect(JSON.stringify(await lista.json())).not.toContain('Bloqueado')
  const antes = sqlLocal(`select count(*) from public.appointments where google_event_id = :'ev'`, { ev: ev?.id ?? '' })
  await sondear(page)
  expect(sqlLocal(`select count(*) from public.appointments where google_event_id = :'ev'`, { ev: ev?.id ?? '' })).toBe(antes)
})

test('movido en Google, con hora y a días completos, se refleja; borrado en Google, se borra', async ({ page }) => {
  interruptorAgenda('A', true)
  borrarBloqueos()
  const id = await crearBloqueo(page)
  await expect.poll(() => bloqueo(id).split('|')[0], { timeout: 30_000 }).not.toBe('')
  const evId = bloqueo(id).split('|')[0]
  const ini = new Date(Date.parse(g().eventos.get(evId)?.start?.dateTime ?? '') + 3_600_000).toISOString()
  g().modificar(evId, { start: { dateTime: ini, timeZone: TZ }, end: { dateTime: new Date(Date.parse(ini) + 3_600_000).toISOString(), timeZone: TZ } })
  await sondear(page)
  expect(bloqueo(id)).toBe(`${evId}|${DIA_LABORABLE_LIBRE} 19:00|f`)
  g().modificar(evId, { start: { date: DIA_LABORABLE_LIBRE, dateTime: null }, end: { date: desplazarFecha(DIA_LABORABLE_LIBRE, { dias: 1 }), dateTime: null } })
  await sondear(page)
  expect(bloqueo(id)).toBe(`${evId}|${DIA_LABORABLE_LIBRE} 00:00|t`)
  g().borrar(evId)
  await sondear(page)
  expect(bloqueo(id)).toBe('')
})

test('creado en Google, aunque se titule «Bloqueado», nunca es un bloqueo', async ({ page }) => {
  interruptorAgenda('A', true)
  borrarBloqueos()
  const ini = `${DIA_LABORABLE_LIBRE}T20:00:00-06:00`
  g().crear({ summary: 'Bloqueado', transparency: 'opaque', start: { dateTime: ini, timeZone: TZ }, end: { dateTime: `${DIA_LABORABLE_LIBRE}T21:00:00-06:00`, timeZone: TZ } })
  await sondear(page)
  expect(sqlLocal(`select count(*) from public.agenda_bloqueos b join public.clinicas c on c.id = b.clinica_id where c.nombre = :'clinica'`, { clinica: CLINICA_A })).toBe('0')
})

test('quitado en Spinus, se borra en Google', async ({ page }) => {
  interruptorAgenda('A', true)
  borrarBloqueos()
  const id = await crearBloqueo(page)
  await expect.poll(() => bloqueo(id).split('|')[0], { timeout: 30_000 }).not.toBe('')
  const evId = bloqueo(id).split('|')[0]
  const res = await page.request.delete(`/api/agenda/bloqueos/${id}`)
  expect(res.ok()).toBeTruthy()
  await expect.poll(() => g().eventos.get(evId)?.status ?? 'ausente', { timeout: 30_000 }).not.toBe('confirmed')
})
