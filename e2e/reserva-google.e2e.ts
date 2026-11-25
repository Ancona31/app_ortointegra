import { test, expect, request, type APIRequestContext } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { SESION, CORREO, sqlLocal } from './ayudas'
import { arrancarGoogleFalso, CALENDARIO, type GoogleFalso } from './google-falso/servidor'
import { cerrarEscenario, correoDelEnlace, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, type Escenario, type Turno } from './reservaPublicaAyudas'
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
 *      aviso en la pestaña «Avisos» de la campana (I5), junto al del evento
 *      importado por asignar; pulsar el del empalme lleva a la cita.
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

/**
 * Tanda J (J4) · Las reservas de esta corrida se quedan (no se borran citas), pero
 * ligadas a ids del Google falso, que los reparte desde cero en cada arranque
 * (`falso1x`, `falso2x`…): la corrida siguiente chocaba con
 * `appointments_clinica_google_event_id_uniq` al ligar su primera reserva y la
 * prueba esperaba un evento que no llegaba nunca. Se sueltan los ids, nada más.
 * Sólo los que reparte ESTE falso (`falso<N>x`): otras pruebas siembran ids
 * propios con otro formato (`falso-j3-…`) y no son de aquí.
 */
/**
 * J4: los intentos que dejan I9, J9 y J10 en `gcal_movimientos_rechazados`
 * (FK RESTRICT a la clínica): sin borrarlos, `agenda-semilla.ts` no puede
 * borrar la Clínica A. Sus avisos (`avisos_clinica`, tipo
 * `google_movimiento_rechazado`) también se van: sin la fila del intento, el
 * aviso pendiente no tendría de dónde venir. Si la tabla no existe (base sin la
 * migración de J4), no hace nada.
 */
function borrarMovimientosRechazados(): void {
  sqlLocal(`do $$ begin
    if to_regclass('public.gcal_movimientos_rechazados') is not null then
      delete from public.gcal_movimientos_rechazados m using public.clinicas c
       where m.clinica_id = c.id and c.nombre = '${CLINICA_A}';
      delete from public.avisos_clinica a using public.clinicas c
       where a.clinica_id = c.id and c.nombre = '${CLINICA_A}' and a.tipo = 'google_movimiento_rechazado';
    end if;
  end $$;`)
}

function soltarEventosFalsos(): void {
  sqlLocal(`update public.appointments a set google_event_id = null, gcal_etag = null
              from public.clinicas c
             where a.clinica_id = c.id and c.nombre = :'clinica' and a.google_event_id ~ '^falso[0-9]+x$'`, { clinica: CLINICA_A })
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

/** Ninguna pasada de A tiene el candado (o el que tenga ya caducó). */
function candadoLibre(): boolean {
  return sqlLocal(`select count(*) from public.gcal_sync_estado e join public.clinicas c on c.id = e.clinica_id
                    where c.nombre = :'clinica' and e.candado is not null and e.candado_hasta > now()`, { clinica: CLINICA_A }) === '0'
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

async function reservarEn(codigo: string, inicio: string): Promise<{ status: number; cuerpo: Record<string, unknown>; ms: number; correo: string; nombre: string }> {
  const ctx = await publico()
  const p = personaNueva()
  // J2, punto 3: en el único el correo de la cita es el que escribió la clínica
  // al emitir, no el tecleado; se pone en el enlace para poder buscar la cita.
  correoDelEnlace(codigo, p.correo)
  try {
    const t0 = Date.now()
    const r = await ctx.post(`/api/reservar/${codigo}`, { timeout: 120_000, data: {
      consultorio_id: e.consultorioId, tipo_cita_id: e.tipoId, inicio, nombre: p.nombre,
      telefono: p.telefono, correo: p.correo, acepta_aviso: true, client_id: randomUUID(),
    } })
    return { status: r.status(), cuerpo: await r.json().catch(() => ({})), ms: Date.now() - t0, correo: p.correo, nombre: p.nombre }
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
/* J9–J11: por el nombre (único por corrida), no por el correo: con J2 (punto 3) el enlace único
   guarda el correo que puso la clínica al emitirlo, no el que escribe quien reserva. */
const citaPorNombre = (nombre: string): string => sqlLocal(`select id from public.appointments where title = :'n'`, { n: nombre })

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
  /* B13 · remate (diagnóstico de la prueba 4): en `next dev` una ruta se compila la primera vez que se
     pide, y mientras compila las demás peticiones esperan. Pulsar un aviso de la campana manda el PATCH
     de `/api/avisos` (darlo por revisado) A LA VEZ que la agenda pide a `/api/appointments` el rango del
     día de la cita; la primera semana de `/agenda` llega con la página, así que ninguna de las dos rutas
     se había pedido aún. Medido en el log de :3002: 6,7 s y 10,2 s (6,5 y 10,0 de compilación; la app,
     0,16–0,2) contra los 6 s de `esperarEvento`, que se rinde con «No se pudo mostrar esa cita en la
     agenda.». Se compilan aquí, como en el `calentar` de los otros archivos que levantan :3002. En
     producción no hay compilación al pedir. */
  await admin.get('/api/avisos', { timeout: 240_000 })
  await admin.get('/api/appointments?from=2026-01-05T06:00:00.000Z&to=2026-01-12T06:00:00.000Z', { timeout: 240_000 })
  await admin.dispose()
  ultimaBuenaHace(0)
  const { codigo } = emitirEnlace(e, 'unico')
  // Un turno por día, de tres semanas a partir de dentro de dos semanas (D10 usa la tercera).
  const r = await turnos(codigo, dentroDe(14))
  const r2 = await turnos(codigo, dentroDe(21))
  // Tanda L (L5): una semana más, que con la prueba del punto 18 son 13 las que gastan turno.
  const r3 = await turnos(codigo, dentroDe(28))
  const porDia = new Map<string, Turno>()
  for (const t of [...r.turnos, ...r2.turnos, ...r3.turnos]) {
    const dia = t.inicio.slice(0, 10)
    if (!porDia.has(dia)) porDia.set(dia, t)
  }
  libres = [...porDia.values()]
})

test.afterAll(async ({}, info) => {
  if (info.project.name !== ESCRITORIO) return
  cerrarEscenario()
  soltarEventosFalsos()
  borrarMovimientosRechazados()
  borrarConexion()
  if (servidor?.pid) {
    try { process.kill(-servidor.pid, 'SIGTERM') } catch { /* ya no estaba */ }
  }
  await google?.cerrar()
})

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== ESCRITORIO, 'un solo next dev por corrida: sólo en escritorio')
  info.setTimeout(240_000)
  if (google) { google.lista = { demoraMs: 0, falla: null }; google.parche = { falla: null } }
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
  /* Lo que se prueba es UNA pasada que ve el evento nuevo. Antes de crearlo, que no quede nada en
     marcha que pueda verlo antes que ella (batería E1, 2026-11-23: el evento salió importado, la
     pasada de la prueba respondió `cambios: 0` y el par no llegó nunca):
     · la pasada que la prueba 3 dejó viva tras su tope (`mantenerViva`, en `after()`) suelta el
       candado al terminar: se espera a que lo suelte ANTES de que `ultimaBuenaHace` lo borre;
     · la reserva crea su propio evento en Google en un `after()`: se espera a que lo ligue. */
  await expect.poll(candadoLibre, { message: 'una pasada anterior sigue con el candado', timeout: 30_000 }).toBe(true)
  ultimaBuenaHace(0)
  const r = await reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio)
  expect(r.status, JSON.stringify(r.cuerpo)).toBe(201)
  const reserva = citaPorCorreo(r.correo)
  expect(reserva).not.toBe('')
  await expect.poll(() => sqlLocal(`select coalesce(google_event_id, '') from public.appointments where id = :'r'`, { r: reserva }),
    { message: 'la reserva no ligó su evento de Google', timeout: 60_000 }).not.toBe('')
  await expect.poll(candadoLibre, { message: 'la pasada de la reserva sigue con el candado', timeout: 30_000 }).toBe(true)

  const ev = eventoEn(t, 'Junta encima D11')
  ultimaBuenaHace(120)
  const s1 = await (await page.request.post('/api/google/sync')).json() as { estado: string; cambios: number }
  expect(s1.estado).toBe('ok')
  expect(importadas(ev)).toBe('1')
  const avisos = (): string => sqlLocal(`select count(*) from public.reserva_empalmes_google where cita_reserva_id = :'r'`, { r: reserva })
  const auditadas = (): string => sqlLocal(`select count(*) from public.audit_log where accion = 'reserva_empalme_google' and registro_id = :'r'`, { r: reserva })
  /* Se espera el par en vez de contarlo en el acto (falló una vez en la batería con 0 y sola
     pasa siempre). La ruta espera la escritura de punta a punta, pero `ultimaBuenaHace` quita
     el candado: otra pasada viva puede importar el evento primero (y la de esta petición ya no
     lo ve como nuevo) y registrar el par un instante después. Lo que se prueba no cambia: un
     par y una auditoría. Si no llega, lo recibido dice si la pasada contó el fallo en el log
     (`avisarEmpalmes` se lo traga y la ruta responde `ok` igual). */
  const falloEnLog = (): string => {
    try {
      return readFileSync('test-results/next-dev-3002.log', 'utf8').includes('empalmes con reservas sin registrar') ? '|fallo en el log' : ''
    } catch { return '' }
  }
  await expect.poll(() => `${avisos()}|${auditadas()}${falloEnLog()}`, {
    message: `par del empalme tras el sondeo (respuesta: ${JSON.stringify(s1)})`, timeout: 15_000,
  }).toBe('1|1')

  // Resincronizar (y mover el evento sin dejar de empalmarse) no repite.
  const corrido = new Date(Date.parse(t.inicio) + 5 * 60_000).toISOString()
  g().modificar(ev, { start: { dateTime: corrido, timeZone: TZ } })
  ultimaBuenaHace(120)
  expect(((await (await page.request.post('/api/google/sync')).json()) as { estado: string }).estado).toBe('ok')
  expect(avisos()).toBe('1')
  expect(auditadas()).toBe('1')

  // I5 (punto 19): con la v2 encendida (`prepararEscenario`), los dos avisos
  // en la pestaña «Avisos» de la campana: el empalme sobre la reserva y el
  // evento importado, por asignar. Uno por par, aunque se resincronizó.
  const importada = sqlLocal(`select id from public.appointments where google_event_id = :'ev'`, { ev })
  const filas = (tipo: string, cita: string): string =>
    /* Avisos globales (M1): «revisado» es POR USUARIO. Pendiente = sin cerrar para todos y sin una fila de
       `avisos_vistos` posterior al último cambio del aviso (la misma regla de `agenda-i5-barra-avisos`). */
    sqlLocal(`select count(*) || '|' || count(*) filter (where a.revisado_en is null and not exists (
                 select 1 from public.avisos_vistos v where v.aviso_id = a.id and v.visto_en >= a.creado_en))
                from public.avisos_clinica a where a.tipo = :'t' and a.cita_id = :'c'`, { t: tipo, c: cita })
  expect(filas('empalme_google', reserva)).toBe('1|1')
  expect(filas('google_por_asignar', importada)).toBe('1|1')
  await page.goto('/agenda')
  await page.locator('[data-campana]').click({ timeout: 120_000 })
  const panel = page.getByRole('dialog', { name: 'Por confirmar y avisos' })
  await panel.getByRole('tab', { name: /^Avisos/ }).click()
  const empalme = panel.locator(`[data-aviso-tipo="empalme_google"][data-aviso-cita="${reserva}"]`)
  await expect(empalme).toContainText('se empalma con un evento de Google', { timeout: 30_000 })
  await expect(panel.locator(`[data-aviso-tipo="google_por_asignar"][data-aviso-cita="${importada}"]`)).toBeVisible()
  // Pulsarlo lleva a su cita y lo da por revisado; el otro se queda.
  await empalme.click()
  await expect(page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Más opciones de la cita', exact: true }) }))
    .toBeVisible({ timeout: 30_000 })
  await expect.poll(() => filas('empalme_google', reserva)).toBe('1|0')
  expect(filas('google_por_asignar', importada)).toBe('1|1')
})

/* Tanda I, punto 9: lo que el paciente eligió no se cambia moviendo el evento en Google. La base
   rechaza la hora nueva (cita_proteger_eleccion), la pasada lo audita como cambio rechazado y
   Spinus vuelve a escribir su hora en Google (C5), como con una atendida (C-e). */
test('I9 · una reserva por enlace movida en Google: la base la rechaza, se audita y Google vuelve a la hora de Spinus', async ({ page }) => {
  const t = turnoNuevo()
  ultimaBuenaHace(0)
  const r = await reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio)
  expect(r.status, JSON.stringify(r.cuerpo)).toBe(201)
  const reserva = citaPorCorreo(r.correo)
  const evento = (): string => sqlLocal(`select coalesce(google_event_id, '') from public.appointments where id = :'r'`, { r: reserva })
  await expect.poll(evento, { timeout: 60_000 }).not.toBe('')
  const ev = evento()
  const hora = Date.parse(t.inicio) + 60 * 60_000
  g().modificar(ev, { start: { dateTime: new Date(hora).toISOString(), timeZone: TZ }, end: { dateTime: new Date(hora + 30 * 60_000).toISOString(), timeZone: TZ } })
  ultimaBuenaHace(120)
  expect(((await (await page.request.post('/api/google/sync')).json()) as { estado: string }).estado).toBe('ok')
  expect(sqlLocal(`select (start_time = :'i'::timestamptz)::text from public.appointments where id = :'r'`, { r: reserva, i: t.inicio })).toBe('true')
  expect(sqlLocal(`select count(*) from public.audit_log where accion = 'gcal_cambio_rechazado' and registro_id = :'r'
                     and descripcion::jsonb ->> 'motivo' = 'eleccion_paciente'`, { r: reserva })).toBe('1')
  expect(Date.parse(g().eventos.get(ev)?.start?.dateTime ?? '')).toBe(Date.parse(t.inicio))
})

/* Tanda J, punto 9: la misma reserva movida en Google, ahora con Google SIN RESPONDER al
   restablecer. La base nunca cambia; Google queda con la otra hora (desfasada) hasta la pasada
   siguiente, que repite la página y la devuelve. Después, otra pasada no cambia nada (el eco no
   se rechaza otra vez): las dos quedan iguales. Mutación en rojo: quitar el `throw new
   RestablecimientoPendiente()` de `procesarPagina` (la página avanzaba y Google se quedaba con
   la hora movida para siempre). */
test('J9 · reserva movida en Google y Google no responde al restablecer: la pasada siguiente la devuelve; nada queda desfasado', async ({ page }) => {
  const t = turnoNuevo()
  ultimaBuenaHace(0)
  const r = await reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio)
  expect(r.status, JSON.stringify(r.cuerpo)).toBe(201)
  const reserva = citaPorNombre(r.nombre)
  const evento = (): string => sqlLocal(`select coalesce(google_event_id, '') from public.appointments where id = :'r'`, { r: reserva })
  await expect.poll(evento, { timeout: 60_000 }).not.toBe('')
  const ev = evento()
  const inicioGoogle = (): number => Date.parse(g().eventos.get(ev)?.start?.dateTime ?? '')
  const enBase = (): string => sqlLocal(`select (start_time = :'i'::timestamptz)::text from public.appointments where id = :'r'`, { r: reserva, i: t.inicio })
  const rechazos = (): string => sqlLocal(`select count(*) from public.audit_log where accion = 'gcal_cambio_rechazado' and registro_id = :'r'
                                             and descripcion::jsonb ->> 'motivo' = 'eleccion_paciente'`, { r: reserva })
  const sondeo = async (): Promise<{ estado: string; ms: number }> => {
    ultimaBuenaHace(120)
    const t0 = Date.now()
    const { estado } = (await (await page.request.post('/api/google/sync')).json()) as { estado: string }
    return { estado, ms: Date.now() - t0 }
  }
  const hora = Date.parse(t.inicio) + 60 * 60_000
  g().modificar(ev, { start: { dateTime: new Date(hora).toISOString(), timeZone: TZ }, end: { dateTime: new Date(hora + 30 * 60_000).toISOString(), timeZone: TZ } })

  g().parche = { falla: 503 }
  const caido = await sondeo()
  expect(caido.estado).toBe('error')
  expect(enBase()).toBe('true')
  expect(inicioGoogle()).toBe(hora) // desfasada: Google sigue con la hora que le pusieron

  g().parche = { falla: null }
  const bueno = await sondeo()
  expect(bueno.estado).toBe('ok')
  expect(enBase()).toBe('true')
  expect(inicioGoogle()).toBe(Date.parse(t.inicio))
  expect(sqlLocal(`select gcal_etag from public.appointments where id = :'r'`, { r: reserva })).toBe(g().eventos.get(ev)?.etag)
  const rechazosTrasRestablecer = rechazos()
  console.log(`J9: sondeo que restablece ${bueno.ms} ms; rechazos auditados ${rechazosTrasRestablecer}`)

  // Una pasada más: el eco del restablecimiento no se rechaza otra vez y nada se mueve.
  expect((await sondeo()).estado).toBe('ok')
  expect(enBase()).toBe('true')
  expect(inicioGoogle()).toBe(Date.parse(t.inicio))
  expect(rechazos()).toBe(rechazosTrasRestablecer)
})

/* Tanda J, punto 10: el aviso de la campana, UNO POR INTENTO. Intento = la versión del evento
   de Google (su `updated`): dos sondeos que leen el mismo cambio (Google sin responder al
   restablecer, la página se repite) dejan un aviso; moverlo otra vez es otro intento (el aviso
   sin revisar sube; en la base, dos renglones). Pulsarlo abre la tarjeta con «Reagendar» de
   principal y con el foco. Mutaciones en rojo: la RPC sin ON CONFLICT (el segundo sondeo
   revienta y no restablece) y `destacarDeAviso` devolviendo undefined (la principal es otra). */
test('J10 · reserva movida en Google: un aviso por intento; pulsarlo abre la tarjeta con «Reagendar» destacado', async ({ page }) => {
  const t = turnoNuevo()
  ultimaBuenaHace(0)
  const r = await reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio)
  expect(r.status, JSON.stringify(r.cuerpo)).toBe(201)
  const reserva = citaPorNombre(r.nombre)
  const evento = (): string => sqlLocal(`select coalesce(google_event_id, '') from public.appointments where id = :'r'`, { r: reserva })
  await expect.poll(evento, { timeout: 60_000 }).not.toBe('')
  const ev = evento()
  /* Avisos globales (M1): pendiente = sin cerrar para todos y sin verlo nadie después de su último cambio. */
  const avisos = (): string => sqlLocal(`select count(*) || '|' || count(*) filter (where a.revisado_en is null and not exists (
                                            select 1 from public.avisos_vistos v where v.aviso_id = a.id and v.visto_en >= a.creado_en))
                                           from public.avisos_clinica a
                                          where a.tipo = 'google_movimiento_rechazado' and a.cita_id = :'r'`, { r: reserva })
  const intentos = (): string => sqlLocal(`select count(*) from public.gcal_movimientos_rechazados where cita_id = :'r'`, { r: reserva })
  const creado = (): string => sqlLocal(`select creado_en from public.avisos_clinica where tipo = 'google_movimiento_rechazado' and cita_id = :'r'
                                          and revisado_en is null`, { r: reserva })
  const sondeo = async (): Promise<string> => {
    ultimaBuenaHace(120)
    return ((await (await page.request.post('/api/google/sync')).json()) as { estado: string }).estado
  }
  const mover = (min: number): void => {
    const h = Date.parse(t.inicio) + min * 60_000
    g().modificar(ev, { start: { dateTime: new Date(h).toISOString(), timeZone: TZ }, end: { dateTime: new Date(h + 30 * 60_000).toISOString(), timeZone: TZ } })
  }

  mover(60)
  g().parche = { falla: 503 }
  expect(await sondeo()).toBe('error')
  expect(avisos()).toBe('1|1')
  const primero = creado()
  // El mismo cambio, leído otra vez (la página no avanzó): el mismo intento, ningún aviso más.
  expect(await sondeo()).toBe('error')
  expect([avisos(), intentos(), creado()]).toEqual(['1|1', '1', primero])
  g().parche = { falla: null }
  expect(await sondeo()).toBe('ok')
  expect([avisos(), intentos()]).toEqual(['1|1', '1'])

  // Otro intento con el aviso sin revisar: el mismo aviso sube; en la base, dos intentos.
  mover(90)
  expect(await sondeo()).toBe('ok')
  expect([avisos(), intentos()]).toEqual(['1|1', '2'])
  expect(Date.parse(creado())).toBeGreaterThan(Date.parse(primero))

  await page.goto('/agenda')
  await page.locator('[data-campana]').click({ timeout: 120_000 })
  const panel = page.getByRole('dialog', { name: 'Por confirmar y avisos' })
  await panel.getByRole('tab', { name: /^Avisos/ }).click()
  const fila = panel.locator(`[data-aviso-tipo="google_movimiento_rechazado"][data-aviso-cita="${reserva}"]`)
  await expect(fila).toContainText('Desde Google no se pueden mover las citas reservadas por enlace. Para cambiarla, usa Reagendar: se le avisará al paciente.',
    { timeout: 30_000 })
  await fila.click()
  const tarjeta = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Más opciones de la cita', exact: true }) })
  await expect(tarjeta).toBeVisible({ timeout: 30_000 })
  const reagendar = tarjeta.getByRole('button', { name: 'Reagendar', exact: true })
  /* Tanda K, punto 21: el botón ancho de la burbuja. */
  await expect(reagendar).toHaveClass(/ag-burbuja-cta/)
  await expect(reagendar).toBeFocused()
  await expect.poll(avisos).toBe('1|0')
})

/* Tanda L, punto 18 (L5): lo que Angel no había visto, de punta a punta EN PANTALLA. Una cita
   reservada por enlace y movida en Google se queda en su hora EN LA REJILLA de Spinus (la misma
   posición antes y después del sondeo, también tras recargar), Google vuelve a la hora de Spinus
   y la campana trae el aviso con «Reagendar» destacado. Deja las capturas del antes y el después
   en la carpeta de salida de la prueba (`p18-*.png`), y el evento movido del Google falso, que no
   tiene pantalla, como una página con su JSON. Mutación en rojo (comprobada): el disparador
   `trg_appointments_proteger_eleccion` apagado (la base acepta la hora de Google y la cita baja
   en la rejilla: falla la comparación de la altura, que va antes que la de la base). */
test('L5 · punto 18: reserva por enlace movida en Google, en pantalla: la cita se queda en su hora y el aviso trae «Reagendar» destacado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  /* Las capturas, cuando la animación de abrir ya terminó (sólo para que se lean; no deciden nada). */
  const foto = async (nombre: string): Promise<void> => {
    await page.waitForTimeout(700)
    try { await page.screenshot({ path: test.info().outputPath(`${nombre}.png`) }) } catch { /* captura de apoyo */ }
  }
  const fotoCita = async (nombre: string): Promise<void> => {
    try { await enRejilla.screenshot({ path: test.info().outputPath(`${nombre}.png`) }) } catch { /* captura de apoyo */ }
  }
  const t = turnoNuevo()
  ultimaBuenaHace(0)
  const r = await reservarEn(emitirEnlace(e, 'unico').codigo, t.inicio)
  expect(r.status, JSON.stringify(r.cuerpo)).toBe(201)
  const reserva = citaPorNombre(r.nombre)
  const evento = (): string => sqlLocal(`select coalesce(google_event_id, '') from public.appointments where id = :'r'`, { r: reserva })
  await expect.poll(evento, { timeout: 60_000 }).not.toBe('')
  const ev = evento()
  const tarjeta = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Más opciones de la cita', exact: true }) })
  const enRejilla = page.locator(`.fc-timegrid-event:has([data-cita-id="${reserva}"])`)
  /* Revisión: la posición se mide contra la PRIMERA fila de la rejilla (las dos dentro del mismo
     desplazamiento), no contra la ventana: así no depende de cuánto se haya desplazado. Y se lee
     hasta que dos lecturas seguidas coinciden (la tarjeta puede estar a media animación). */
  const relativa = async (): Promise<number> => {
    const [c, fila0] = [await enRejilla.boundingBox(), await page.locator('.fc-timegrid-slots tr').first().boundingBox()]
    if (!c || !fila0) throw new Error('la cita no está pintada en la rejilla')
    return Math.round(c.y - fila0.y)
  }
  /** Abre la agenda en la semana de la cita (`?cita=` la abre en su sitio) y devuelve su altura en la rejilla. */
  const verEnRejilla = async (): Promise<number> => {
    await page.goto(`/agenda?cita=${reserva}`)
    await expect(tarjeta).toBeVisible({ timeout: 120_000 })
    await page.keyboard.press('Escape')
    await expect(tarjeta).toHaveCount(0)
    await enRejilla.scrollIntoViewIfNeeded()
    let previa = Number.NaN
    await expect.poll(async () => { const y = await relativa(); const igual = y === previa; previa = y; return igual }, { timeout: 10_000 }).toBe(true)
    return previa
  }

  // Antes: la cita en su hora, en Spinus.
  const yAntes = await verEnRejilla()
  await foto('p18-1-spinus-antes-1280')
  await fotoCita('p18-1b-la-cita-antes-1280')

  // Google la mueve una hora. El Google falso no tiene pantalla: su evento, como página.
  const movida = Date.parse(t.inicio) + 60 * 60_000
  g().modificar(ev, { start: { dateTime: new Date(movida).toISOString(), timeZone: TZ }, end: { dateTime: new Date(movida + 30 * 60_000).toISOString(), timeZone: TZ } })
  const hora = (iso: string | null | undefined): string =>
    new Intl.DateTimeFormat('es-MX', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso ?? 0))
  const verGoogle = async (titulo: string, nombre: string): Promise<void> => {
    const g1 = g().eventos.get(ev)
    const pg = await page.context().newPage()
    try {
      await pg.setViewportSize({ width: 1280, height: 800 })
      const esc = (x: string): string => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)
      await pg.setContent(`<meta charset="utf-8"><body style="font:16px system-ui;margin:24px"><h2>${esc(titulo)}</h2>
        <p><b>Inicio:</b> ${esc(hora(g1?.start?.dateTime))}<br><b>Fin:</b> ${esc(hora(g1?.end?.dateTime))}</p>
        <pre style="background:#f4f4f4;padding:12px;white-space:pre-wrap">${esc(JSON.stringify(g1, null, 2))}</pre></body>`)
      await pg.screenshot({ path: test.info().outputPath(`${nombre}.png`) })
    } catch { /* captura de apoyo */ } finally {
      await pg.close()
    }
  }
  await verGoogle('Google falso · el evento, movido una hora', 'p18-2-google-movido')

  // La pasada. Primero LA PANTALLA (lo que pidió Angel, y lo que la mutación tiene que tumbar):
  // la cita sigue en su hora, a la misma altura de la rejilla. Después, la base y Google.
  ultimaBuenaHace(120)
  expect(((await (await page.request.post('/api/google/sync')).json()) as { estado: string }).estado).toBe('ok')
  expect(Math.abs((await verEnRejilla()) - yAntes)).toBeLessThan(2)
  await foto('p18-4-spinus-despues-1280')
  await fotoCita('p18-4b-la-cita-despues-1280')
  expect(sqlLocal(`select (start_time = :'i'::timestamptz)::text from public.appointments where id = :'r'`, { r: reserva, i: t.inicio })).toBe('true')
  expect(Date.parse(g().eventos.get(ev)?.start?.dateTime ?? '')).toBe(Date.parse(t.inicio))
  await verGoogle('Google falso · tras la pasada, de vuelta a la hora de Spinus', 'p18-3-google-restablecido')

  // Y la campana trae el aviso.
  await page.locator('[data-campana]').first().click()
  const panel = page.getByRole('dialog', { name: 'Por confirmar y avisos' })
  await panel.getByRole('tab', { name: /^Avisos/ }).click()
  const fila = panel.locator(`[data-aviso-tipo="google_movimiento_rechazado"][data-aviso-cita="${reserva}"]`)
  await expect(fila).toBeVisible({ timeout: 30_000 })
  await foto('p18-5-aviso-1280')
  await fila.click()
  const reagendar = tarjeta.getByRole('button', { name: 'Reagendar', exact: true })
  await expect(reagendar).toHaveClass(/ag-burbuja-cta/)
  await expect(reagendar).toBeFocused()
  await foto('p18-6-reagendar-destacado-1280')

  // En el teléfono, otro intento (revisado el aviso, no se puede «des-revisar»: nace otro, J4).
  const otra = Date.parse(t.inicio) + 90 * 60_000
  g().modificar(ev, { start: { dateTime: new Date(otra).toISOString(), timeZone: TZ }, end: { dateTime: new Date(otra + 30 * 60_000).toISOString(), timeZone: TZ } })
  ultimaBuenaHace(120)
  expect(((await (await page.request.post('/api/google/sync')).json()) as { estado: string }).estado).toBe('ok')
  expect(sqlLocal(`select (start_time = :'i'::timestamptz)::text from public.appointments where id = :'r'`, { r: reserva, i: t.inicio })).toBe('true')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/agenda')
  await page.locator('.ag-banda-movil [data-campana]').click({ timeout: 120_000 })
  await panel.getByRole('tab', { name: /^Avisos/ }).click()
  await expect(fila).toBeVisible({ timeout: 30_000 })
  await foto('p18-5-aviso-390')
  await fila.click()
  await expect(reagendar).toHaveClass(/ag-burbuja-cta/)
  await foto('p18-6-reagendar-destacado-390')
})

/* Tanda J, punto 11: con la v2, lo que viene de Google deja el morado. El evento importado
   (fila de Spinus, por asignar) lleva su «G» en la tarjeta de la rejilla y en la de lectura;
   el bloque de sólo lectura (una serie, no se importa) usa el fondo de «Agendada» y no el
   morado; la leyenda del engrane explica la «G» y ya no dice «GCal». Mutaciones en rojo: el
   bloque de globals.css que reasigna `--ag-gcal-*` borrado (el bloque sale morado) y
   `renderEventContent` sin `origenGoogle` (la tarjeta sin «G»). */
test('J11 · lo de Google con los colores de estado y su «G»; la leyenda sin morado', async ({ page }) => {
  const t = turnoNuevo()
  const suelto = eventoEn(t, 'Junta J11')
  const serie = Date.parse(t.inicio) + 2 * 3_600_000
  g().crear({ summary: 'Serie J11', recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
    start: { dateTime: new Date(serie).toISOString(), timeZone: TZ }, end: { dateTime: new Date(serie + 3_600_000).toISOString(), timeZone: TZ } })
  ultimaBuenaHace(120)
  expect((await (await page.request.post('/api/google/sync')).json()).estado).toBe('ok')
  const importada = sqlLocal(`select id from public.appointments where google_event_id = :'ev'`, { ev: suelto })
  expect(importada).not.toBe('')

  // `?cita=` lleva a su día (vista Día) y abre su tarjeta de lectura: con la «G».
  await page.goto(`/agenda?cita=${importada}`)
  const tarjeta = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Más opciones de la cita', exact: true }) })
  /* Tanda K, punto 21: en la burbuja la «G» va en la línea «Agendada desde Google Calendar» (CALMA §28; antes «Llegó de Google Calendar»), a color. */
  const linea = tarjeta.locator('.ag-burbuja-origen', { hasText: 'Agendada desde Google Calendar' })
  await expect(linea).toBeVisible({ timeout: 120_000 })
  await expect(linea.locator('path[fill="#4285F4"]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(tarjeta).toBeHidden()
  // En la rejilla la «G» se ve y lo dice la etiqueta de la tarjeta (la marca es decorativa ahí).
  const enRejilla = page.locator(`.fc [data-cita-id="${importada}"]`)
  await expect(enRejilla.locator('.ag-g-origen')).toBeVisible()
  await expect(enRejilla).toHaveAttribute('aria-label', /Agendada en Google/)

  // El bloque de la serie: el fondo de «Agendada», no el morado de antes.
  const bloque = page.locator('.fc .ag-gcal', { hasText: 'Serie J11' }).first()
  await expect(bloque).toBeVisible()
  const fondos = await bloque.evaluate((el) => {
    const ref = document.createElement('div')
    ref.style.background = 'var(--ag-status-scheduled-bg)'
    el.parentElement?.appendChild(ref)
    const agendada = getComputedStyle(ref).backgroundColor
    ref.remove()
    return { bloque: getComputedStyle(el).backgroundColor, agendada }
  })
  expect(fondos.bloque).toBe(fondos.agendada)
  expect(fondos.bloque).not.toBe('rgb(243, 238, 252)') // --ag-gcal-bg1 en claro, el morado

  await page.getByRole('button', { name: 'Opciones de la agenda' }).first().click()
  await page.getByRole('menu', { name: 'Opciones de la agenda' }).getByRole('menuitem', { name: 'Leyenda de estados' }).click()
  const leyenda = page.getByRole('dialog', { name: 'Leyenda de estados' })
  await expect(leyenda).toContainText('Agendada desde Google Calendar')
  await expect(leyenda).not.toContainText('GCal')
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
