import { test, expect, request, type APIRequestContext } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { SESION, CORREO, sqlLocal } from './ayudas'
import { arrancarGoogleFalso, CALENDARIO, type GoogleFalso } from './google-falso/servidor'
import { cerrarEscenario, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, type Escenario, type Turno } from './reservaPublicaAyudas'
import { desplazarFecha, hoyEnTZ } from '../src/lib/dates'
import { encrypt } from '../src/lib/encrypt'

/**
 * D11 — la reserva por enlace se sincroniza con Google ANTES de reservar
 * (decisión de Angel, mejora_agendaV2.md §6-bis), de punta a punta contra el
 * Google FALSO (`e2e/google-falso/servidor.ts`), nunca contra el real:
 *   1. GET de turnos con la última buena de hace más de 60 s: importa lo de
 *      Google y el turno deja de ofrecerse; con menos de 60 s no sincroniza.
 *   2. POST: sincroniza SIEMPRE (aunque la última buena sea de hace 1 s) y un
 *      turno que Google ocupó responde el mismo 409 «turno no disponible».
 *   3. Google falla o tarda: con la última buena de hace 10 min, reserva; de
 *      hace 40 min, 503 con el teléfono del consultorio. El tope corta de
 *      verdad (la respuesta llega mucho antes que el Google lento).
 *   4. Un evento importado que se empalma con una reserva por enlace: un
 *      registro y una fila de auditoría, sin repetir al resincronizar, y el
 *      aviso en el panel «Por confirmar» de la agenda.
 *   +. Dos reservas simultáneas con Google conectado: la segunda espera el
 *      candado de la sincronización y hace su propia pasada (sin solapes del
 *      syncToken); una sola cita.
 *
 * Como `agenda-google-dos-sentidos.e2e.ts` (léelo: POR QUÉ :3002 y no :3001):
 * levanta su propio `next dev --webpack -p 3002` con `GCAL_FALSO_URL`, tokens
 * falsos que no caducan y `GOOGLE_CLIENT_ID/SECRET` falsos, y borra la
 * conexión de prueba antes y después. Las ayudas de preparación se duplican a
 * propósito (Protocolo 4). Requiere en `.env.local` lo mismo que las e2e de la
 * reserva (EMAIL_TRANSPORT=captura, RESERVA_SECRETO,
 * RESERVA_AVISO_BORRADOR_LOCAL=1). Sólo en `escritorio`.
 */

const PUERTO = 3002
const BASE = `http://localhost:${PUERTO}`
const CLINICA_A = 'Clínica Semilla A'
const ESCRITORIO = 'escritorio'
const TZ = 'America/Merida'

let google: GoogleFalso | null = null
let servidor: ChildProcess | null = null
let e: Escenario
let libres: Turno[] = []

test.describe.configure({ mode: 'serial' })
test.use({ baseURL: BASE, storageState: SESION.adminA })

/* ── Preparación (la de agenda-google-dos-sentidos, duplicada) ─────────── */

function cargarClaveDeTokens(): void {
  const linea = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('GOOGLE_TOKEN_SECRET='))
  if (!linea) throw new Error('falta GOOGLE_TOKEN_SECRET en .env.local')
  process.env.GOOGLE_TOKEN_SECRET = linea.slice('GOOGLE_TOKEN_SECRET='.length).trim().replace(/^"|"$/g, '')
}

/** Borra la conexión de prueba de A, su estado de sincronización y los avisos de D11 de A. */
function borrarConexion(): void {
  sqlLocal(`
    delete from private.google_conexiones_secretos s using public.clinica_conexiones_google g, public.clinicas c
     where s.conexion_id = g.id and g.clinica_id = c.id and c.nombre = :'clinica';
    delete from public.gcal_sync_estado e using public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';
    delete from public.clinica_conexiones_google g using public.clinicas c where g.clinica_id = c.id and c.nombre = :'clinica';
    delete from public.reserva_empalmes_google r using public.clinicas c where r.clinica_id = c.id and c.nombre = :'clinica';`,
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
    ...process.env, NODE_ENV: 'development', GCAL_FALSO_URL: urlFalso,
    GOOGLE_CLIENT_ID: 'cliente-falso', GOOGLE_CLIENT_SECRET: 'secreto-falso', NEXT_TELEMETRY_DISABLED: '1',
  }
  const hijo = spawn('npx', ['next', 'dev', '--webpack', '-p', String(PUERTO)], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log, log] })
  closeSync(log)
  return hijo
}

/* ── Ayudas de la prueba ──────────────────────────────────────────────── */

function g(): GoogleFalso {
  if (!google) throw new Error('el Google falso no arrancó')
  return google
}

/** Fija la última sincronización buena de A (y quita el candado y la espera creciente). */
function ultimaBuenaHace(segundos: number): void {
  sqlLocal(`update public.gcal_sync_estado e
               set ultima_ok = now() - make_interval(secs => :'s'::int), errores_seguidos = 0, ultimo_error = null,
                   candado = null, candado_hasta = null
              from public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica';`,
  { clinica: CLINICA_A, s: String(segundos) })
}

async function publico(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE, extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })
}

/** La fecha (YYYY-MM-DD) de un instante en la zona del consultorio. */
const diaDe = (iso: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
const dentroDe = (dias: number): string => desplazarFecha(hoyEnTZ(TZ), { dias })

async function turnos(codigo: string, desde: string): Promise<{ status: number; cuerpo: Record<string, unknown>; turnos: Turno[] }> {
  const ctx = await publico()
  try {
    const r = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioId}&tipo=${e.tipoId}&desde=${desde}`, { timeout: 120_000 })
    const cuerpo: Record<string, unknown> = await r.json()
    const dias = Array.isArray(cuerpo.dias) ? (cuerpo.dias as Array<{ turnos: Turno[] }>) : []
    return { status: r.status(), cuerpo, turnos: dias.flatMap((d) => d.turnos) }
  } finally {
    await ctx.dispose()
  }
}

async function reservarEn(codigo: string, inicio: string): Promise<{ status: number; cuerpo: Record<string, unknown>; ms: number; correo: string }> {
  const ctx = await publico()
  const p = personaNueva()
  try {
    const t0 = Date.now()
    const r = await ctx.post(`/api/reservar/${codigo}`, { timeout: 120_000, data: {
      consultorio_id: e.consultorioId, tipo_cita_id: e.tipoId, inicio, nombre: p.nombre,
      telefono: p.telefono, correo: p.correo, acepta_aviso: true, client_id: randomUUID(),
    } })
    return { status: r.status(), cuerpo: await r.json().catch(() => ({})), ms: Date.now() - t0, correo: p.correo }
  } finally {
    await ctx.dispose()
  }
}

/** Un turno libre por día, cada prueba el suyo (así ninguna toca los huecos de otra). */
let siguiente = 0
function turnoNuevo(): Turno {
  const t = libres[siguiente++]
  if (!t) throw new Error('se acabaron los turnos libres')
  return t
}

/** Un evento «creado en Google» que ocupa exactamente ese turno. */
function eventoEn(t: Turno, titulo: string): string {
  return g().crear({ summary: titulo, start: { dateTime: t.inicio, timeZone: TZ }, end: { dateTime: t.fin, timeZone: TZ } }).id
}

const importadas = (ev: string): string => sqlLocal(`select count(*) from public.appointments where google_event_id = :'ev'`, { ev })
const citaPorCorreo = (correo: string): string => sqlLocal(`select id from public.appointments where reserva_correo = :'c'`, { c: correo })

/* ── Ciclo ────────────────────────────────────────────────────────────── */

test.beforeAll(async ({}, info) => {
  if (info.project.name !== ESCRITORIO) return
  info.setTimeout(420_000)
  cargarClaveDeTokens()
  google = await arrancarGoogleFalso()
  sembrarConexion()
  e = prepararEscenario()
  servidor = arrancarNextDev(google.url)
  await esperarServidor()
  // Primera compilación de las rutas y primera sincronización (crea el estado y el token).
  const admin = await request.newContext({ baseURL: BASE, storageState: SESION.adminA })
  await admin.post('/api/google/sync', { timeout: 240_000 })
  await admin.dispose()
  ultimaBuenaHace(0)
  const { codigo } = emitirEnlace(e, 'unico')
  // Un turno por día, de dos semanas a partir de dentro de dos semanas (D10 usa la tercera).
  const r = await turnos(codigo, dentroDe(14))
  const r2 = await turnos(codigo, dentroDe(21))
  const porDia = new Map<string, Turno>()
  for (const t of [...r.turnos, ...r2.turnos]) {
    const dia = t.inicio.slice(0, 10)
    if (!porDia.has(dia)) porDia.set(dia, t)
  }
  libres = [...porDia.values()]
})

test.afterAll(async ({}, info) => {
  if (info.project.name !== ESCRITORIO) return
  cerrarEscenario()
  borrarConexion()
  if (servidor?.pid) {
    try { process.kill(-servidor.pid, 'SIGTERM') } catch { /* ya no estaba */ }
  }
  await google?.cerrar()
})

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== ESCRITORIO, 'un solo next dev por corrida: sólo en escritorio')
  info.setTimeout(240_000)
  if (google) google.lista = { demoraMs: 0, falla: null }
})

/* ── Las pruebas ──────────────────────────────────────────────────────── */

test('1 · GET de turnos: con la última buena de hace más de 60 s importa lo de Google y el turno sale; con menos, no sincroniza', async () => {
  const { codigo } = emitirEnlace(e, 'unico')
  const fresco = turnoNuevo()
  const ev1 = eventoEn(fresco, 'Google reciente D11')
  ultimaBuenaHace(10)
  const antes = await turnos(codigo, diaDe(fresco.inicio))
  expect(antes.status).toBe(200)
  // Con la última buena de hace 10 s no se llama a Google: el evento no entra y el turno se sigue ofreciendo.
  expect(importadas(ev1)).toBe('0')
  expect(antes.turnos.map((x) => x.inicio)).toContain(fresco.inicio)

  const viejo = turnoNuevo()
  const ev2 = eventoEn(viejo, 'Google viejo D11')
  ultimaBuenaHace(120)
  const despues = await turnos(codigo, diaDe(viejo.inicio))
  expect(despues.status).toBe(200)
  expect(importadas(ev2)).toBe('1')
  expect(despues.turnos.map((t) => t.inicio)).not.toContain(viejo.inicio)
  // La respuesta pública no trae nada de Google.
  expect(JSON.stringify(despues.cuerpo)).not.toContain('Google viejo D11')
})

test('2 · POST: sincroniza SIEMPRE (última buena de hace 1 s) y un turno que Google ocupó da el mismo 409', async () => {
  const { codigo } = emitirEnlace(e, 'unico')
  const t = turnoNuevo()
  const ev = eventoEn(t, 'Ocupado en Google D11')
  ultimaBuenaHace(1)
  const r = await reservarEn(codigo, t.inicio)
  expect(r.status).toBe(409)
  expect(r.cuerpo).toEqual({ error: 'turno_ocupado' })
  expect(importadas(ev)).toBe('1')
  expect(citaPorCorreo(r.correo)).toBe('')
})

test('3 · Google falla o tarda: reserva con la última buena de hace 10 min; con la de hace 40 min, 503 con el teléfono', async () => {
  g().lista = { demoraMs: 0, falla: 503 }
  ultimaBuenaHace(10 * 60)
  const bien = await reservarEn(emitirEnlace(e, 'unico').codigo, turnoNuevo().inicio)
  expect(bien.status, JSON.stringify(bien.cuerpo)).toBe(201)

  ultimaBuenaHace(40 * 60)
  const t = turnoNuevo()
  const { codigo } = emitirEnlace(e, 'unico')
  const mal = await reservarEn(codigo, t.inicio)
  expect(mal.status).toBe(503)
  expect(mal.cuerpo.error).toBe('no_disponible_por_ahora')
  expect(String(mal.cuerpo.mensaje)).toContain('comunícate con el consultorio')
  if (e.consultorioTelefono) expect(String(mal.cuerpo.mensaje)).toContain(e.consultorioTelefono)
  expect(JSON.stringify(mal.cuerpo).toLowerCase()).not.toContain('google')
  expect(citaPorCorreo(mal.correo)).toBe('')
  // El GET de turnos dice lo mismo.
  ultimaBuenaHace(40 * 60)
  expect((await turnos(codigo, diaDe(t.inicio))).status).toBe(503)

  // Google LENTO (8 s): el tope (4 s) corta y la respuesta llega mucho antes.
  g().lista = { demoraMs: 8_000, falla: null }
  ultimaBuenaHace(40 * 60)
  const lento = await reservarEn(codigo, t.inicio)
  expect(lento.status).toBe(503)
  expect(lento.ms).toBeLessThan(7_000)
  g().lista = { demoraMs: 8_000, falla: null }
  ultimaBuenaHace(10 * 60)
  const lentoReciente = await reservarEn(codigo, t.inicio)
  expect(lentoReciente.status, JSON.stringify(lentoReciente.cuerpo)).toBe(201)
  expect(lentoReciente.ms).toBeLessThan(7_000)
})

test('4 · un evento de Google que se empalma con una reserva por enlace: un aviso, auditado, sin repetir, y en el panel', async ({ page }) => {
  const t = turnoNuevo()
  ultimaBuenaHace(0)
  const r = await reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio)
  expect(r.status, JSON.stringify(r.cuerpo)).toBe(201)
  const reserva = citaPorCorreo(r.correo)
  expect(reserva).not.toBe('')

  const ev = eventoEn(t, 'Junta encima D11')
  ultimaBuenaHace(120)
  const s1 = await (await page.request.post('/api/google/sync')).json() as { estado: string; cambios: number }
  expect(s1.estado).toBe('ok')
  expect(importadas(ev)).toBe('1')
  const avisos = (): string => sqlLocal(`select count(*) from public.reserva_empalmes_google where cita_reserva_id = :'r'`, { r: reserva })
  const auditadas = (): string => sqlLocal(`select count(*) from public.audit_log where accion = 'reserva_empalme_google' and registro_id = :'r'`, { r: reserva })
  expect(avisos()).toBe('1')
  expect(auditadas()).toBe('1')

  // Resincronizar (y mover el evento sin dejar de empalmarse) no repite.
  const corrido = new Date(Date.parse(t.inicio) + 5 * 60_000).toISOString()
  g().modificar(ev, { start: { dateTime: corrido, timeZone: TZ } })
  ultimaBuenaHace(120)
  expect(((await (await page.request.post('/api/google/sync')).json()) as { estado: string }).estado).toBe('ok')
  expect(avisos()).toBe('1')
  expect(auditadas()).toBe('1')

  // El aviso, en el panel «Por confirmar» (canal de E8).
  await page.goto('/agenda')
  await page.locator('[data-por-confirmar]').click({ timeout: 120_000 })
  await expect(page.locator(`[data-fila-empalme="${reserva}"]`)).toBeVisible({ timeout: 30_000 })
})

test('+ · dos reservas simultáneas con Google conectado: la segunda espera el candado y hace SU pasada; una sola cita', async () => {
  // Google tarda 1 s: la primera tiene el candado mientras la segunda llega.
  // Con la última buena de hace 40 min, si la segunda no esperase y no
  // sincronizase, contestaría 503; esperando, llega a la RPC y sale 409.
  // (La garantía atómica de la RPC la prueban scripts/reserva-carrera.sh y
  // reserva-enlace.e2e.ts, sin Google: aquí la espera ya serializa las dos.)
  const t = turnoNuevo()
  g().lista = { demoraMs: 1_000, falla: null }
  ultimaBuenaHace(40 * 60)
  const [a, b] = await Promise.all([
    reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio),
    reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio),
  ])
  expect([a.status, b.status].sort(), JSON.stringify([a.cuerpo, b.cuerpo])).toEqual([201, 409])
  const citas = sqlLocal(`select count(*) from public.appointments where medico_id = :'m' and start_time = :'i'::timestamptz
                            and status not in ('cancelled', 'no_show')`, { m: e.medicoId, i: t.inicio })
  expect(citas).toBe('1')
  // Dos pasadas, una detrás de otra (nunca a la vez): dos lecturas de la sincronización.
  const listas = g().peticiones.filter((p) => p.metodo === 'GET' && /\/events\?/.test(p.ruta) && !p.ruta.includes('singleEvents=true'))
  expect(listas.length).toBeGreaterThanOrEqual(2)
})
