import { test, expect, type Browser, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { SESION, CORREO, DIA_LABORABLE_LIBRE, interruptorAgenda, sqlLocal, eventoConTexto, modalCita, tituloUnico } from './ayudas'
import { editarDesdeTarjeta, tarjetaLectura } from './interaccionesAyudas'
import { arrancarGoogleFalso, CALENDARIO, type EventoFalso, type GoogleFalso } from './google-falso/servidor'
import { fechaHoraLocalAInstante } from '../src/lib/dates'
import { encrypt } from '../src/lib/encrypt'

/**
 * Bloque C (C5 + C6) de punta a punta contra un Google FALSO: nunca contra el
 * real. El falso (`e2e/google-falso/servidor.ts`) corre en el proceso de la
 * prueba, en 127.0.0.1, y la app llega a él porque `src/lib/gcalFalso.ts`
 * desvía `rootUrl`.
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO LEVANTA SU PROPIO `next dev` EN :3002 Y NO USA :3001.
 * La guarda del desvío exige `NODE_ENV !== 'production'`, y `next start` (el
 * servidor de :3001) corre siempre con `NODE_ENV=production`: contra él el
 * desvío está muerto a propósito y la app hablaría con Google de verdad. Así
 * que aquí se arranca `next dev --webpack -p 3002` con `GCAL_FALSO_URL`, y se
 * para al acabar. `next dev` escribe en `.next/dev` y no pisa el build de
 * :3001 (Next 16, «Concurrent dev and build»). Los `storageState` de
 * `global-setup.ts` valen: las cookies son de `localhost`, sin puerto.
 *
 * Por seguridad, además: `GOOGLE_CLIENT_ID`/`SECRET` falsos y tokens que no
 * caducan (no hay refresco que pudiera salir a `oauth2.googleapis.com`), y la
 * conexión de prueba se borra al acabar (antes y después), para que :3001 no
 * la vea nunca.
 *
 * Sólo en el proyecto `escritorio`: un `next dev` por corrida basta.
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

/* ── Preparación ──────────────────────────────────────────────────────── */

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
  interruptorAgenda('A', false)
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

function idsDe(apellidos: string): { medico: string; consultorio: string; paciente: string } {
  const [medico, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Consultorio Centro (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = :'apellidos'
     where u.email = :'correo'`, { apellidos, correo: CORREO.adminA }).split('|')
  if (!paciente) throw new Error(`idsDe: no está «${apellidos}» en la semilla`)
  return { medico, consultorio, paciente }
}

/** Alta por la API (con v2: acepta el empalme si lo hay). Devuelve el id. */
async function alta(page: Page, datos: { apellidos?: string; titulo?: string; hora: string; minutos: number }): Promise<string> {
  const ids = idsDe(datos.apellidos ?? 'Prueba 23')
  const inicio = fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, datos.hora, TZ)
  const cuerpo = {
    title: datos.titulo ?? `Paciente ${datos.apellidos}`, start_time: inicio,
    end_time: new Date(Date.parse(inicio) + datos.minutos * 60_000).toISOString(),
    medico_id: ids.medico, consultorio_id: ids.consultorio, paciente_id: datos.apellidos ? ids.paciente : null,
    notes: 'OBSERVACION-PRIVADA-E2E', status: 'scheduled',
  }
  let res = await page.request.post('/api/appointments', { data: cuerpo })
  if (res.status() === 409) {
    const { empalmes } = await res.json() as { empalmes: { id: string }[] }
    res = await page.request.post('/api/appointments', { data: { ...cuerpo, empalmes_aceptados: empalmes.map((e) => e.id) } })
  }
  expect(res.ok(), await res.text()).toBeTruthy()
  return ((await res.json()) as { appointment: { id: string } }).appointment.id
}

/** Lo que dice la base de una cita. */
function fila(id: string): { evento: string; etag: string; estado: string; inicio: string; origen: string } {
  const [evento, etag, estado, inicio, origen] = sqlLocal(`
    select coalesce(google_event_id, ''), coalesce(gcal_etag, ''), status,
           to_char(start_time at time zone 'America/Merida', 'HH24:MI'), origen
      from public.appointments where id = :'id'`, { id }).split('|')
  return { evento, etag, estado, inicio, origen }
}

/** Espera a que el `after()` de la ruta ligue la cita con su evento del falso. */
async function esperarLigada(id: string): Promise<EventoFalso> {
  await expect.poll(() => fila(id).evento, { timeout: 30_000 }).not.toBe('')
  const ev = g().eventos.get(fila(id).evento)
  if (!ev) throw new Error('el evento ligado no está en el Google falso')
  return ev
}

/** Abre la agenda y devuelve la respuesta del sondeo (que sale en ocioso). */
async function abrirYSondear(page: Page): Promise<{ estado: string; cambios: number }> {
  const sondeo = page.waitForResponse((r) => r.url().endsWith('/api/google/sync') && r.request().method() === 'POST', { timeout: 60_000 })
  await page.goto('/agenda')
  return (await (await sondeo).json()) as { estado: string; cambios: number }
}

function mover(ev: EventoFalso, minutos: number): Partial<EventoFalso> {
  const corre = (iso: string | null | undefined): string => new Date(Date.parse(iso ?? '') + minutos * 60_000).toISOString()
  return { start: { dateTime: corre(ev.start?.dateTime), timeZone: TZ }, end: { dateTime: corre(ev.end?.dateTime), timeZone: TZ } }
}

/* ── Las pruebas ──────────────────────────────────────────────────────── */

test('apagado: la agenda NO llama a /api/google/sync', async ({ page }) => {
  interruptorAgenda('A', false)
  const sondeos: string[] = []
  page.on('request', (r) => { if (r.url().includes('/api/google/sync')) sondeos.push(r.url()) })
  await page.goto('/agenda')
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'apagada', { timeout: 60_000 })
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForTimeout(4_000)
  expect(sondeos).toEqual([])
})

test('encendido: el alta lleva la marca privada y el etag; un evento movido en Google se refleja al abrir la agenda', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Junta Google e2e')
  const id = await alta(page, { titulo, hora: '17:00', minutos: 30 })
  const ev = await esperarLigada(id)
  // C5: la marca va en `private` (nunca en `shared`) y el etag queda guardado.
  expect(ev.extendedProperties?.private).toEqual({ spinus_cita: id, spinus_v: '2' })
  expect(ev.extendedProperties?.shared).toBeUndefined()
  await expect.poll(() => fila(id).etag).toBe(g().eventos.get(ev.id)?.etag)
  expect(JSON.stringify(ev)).not.toContain('OBSERVACION-PRIVADA-E2E')

  g().modificar(ev.id, mover(ev, 120))
  permitirSondeo()
  const r = await abrirYSondear(page)
  expect(r.estado).toBe('ok')
  expect(r.cambios).toBeGreaterThan(0)
  expect(fila(id).inicio).toBe('19:00')
  await expect(eventoConTexto(page, titulo)).toContainText('19:00', { timeout: 30_000 })
})

test('encendido: un borrado en Google cancela la cita (no la borra)', async ({ page }) => {
  interruptorAgenda('A', true)
  const id = await alta(page, { apellidos: 'Prueba 24', hora: '17:45', minutos: 30 })
  const ev = await esperarLigada(id)
  g().borrar(ev.id)
  permitirSondeo()
  const r = await abrirYSondear(page)
  expect(r.cambios).toBeGreaterThan(0)
  expect(fila(id)).toMatchObject({ estado: 'cancelled', evento: '' })
})

test('encendido: un evento creado en Google aparece como fila editable y una sola vez', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Creado en Google')
  const inicio = fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '20:00', TZ)
  const creado = g().crear({
    summary: titulo, description: 'Notas escritas en Google',
    start: { dateTime: inicio, timeZone: TZ }, end: { dateTime: new Date(Date.parse(inicio) + 3_600_000).toISOString(), timeZone: TZ },
  })
  permitirSondeo()
  const r = await abrirYSondear(page)
  expect(r.cambios).toBeGreaterThan(0)
  const [importada] = sqlLocal(`select id || '|' || origen || '|' || coalesce(notes, '') from public.appointments
                                 where google_event_id = :'ev'`, { ev: creado.id }).split('\n')
  expect(importada.split('|').slice(1)).toEqual(['google', 'Notas escritas en Google'])
  // Una sola tarjeta: la fila; el bloque de solo lectura ya no sale.
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(1, { timeout: 30_000 })
  /* F3: con v2 el clic abre la tarjeta de lectura; la edición está en «Editar». */
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  await eventoConTexto(page, titulo).click()
  await editarDesdeTarjeta(page)
  await expect(modalCita(page, 'Editar evento')).toBeVisible({ timeout: 30_000 })
})

/* T3 · punto 6 (AG-DT-29): convertir en cita un evento nacido en Google, desde
   la tarjeta. A Google va el título del paciente y la descripción fija, nunca
   las notas (S1); un título cambiado después en Google no pisa la cita (C-d).
   Mutación en rojo: `descripcionV2` mandando las notas aunque haya paciente. */
test('encendido: un evento creado en Google se convierte en cita; a Google va el paciente sin las notas y su título no vuelve', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Google a cita')
  const inicio = fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '20:30', TZ)
  const creado = g().crear({
    summary: titulo, description: 'NOTAS-GOOGLE-T3',
    start: { dateTime: inicio, timeZone: TZ }, end: { dateTime: new Date(Date.parse(inicio) + 1_800_000).toISOString(), timeZone: TZ },
  })
  permitirSondeo()
  await abrirYSondear(page)
  const id = sqlLocal(`select id from public.appointments where google_event_id = :'ev'`, { ev: creado.id })
  expect(id).not.toBe('')
  const columna = (c: 'title' | 'notes'): string => sqlLocal(`select coalesce(${c}, '') from public.appointments where id = :'id'`, { id })

  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  /* La FILA importada (por su `data-cita-id`), no el bloque de solo lectura de
     Google que la caché pudo pintar antes del sondeo. */
  const filaPintada = page.locator(`.fc-event:has([data-cita-id="${id}"])`)
  await expect(filaPintada).toHaveCount(1, { timeout: 30_000 })
  await filaPintada.click()
  await tarjetaLectura(page).getByRole('button', { name: 'Convertir en cita' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Convertir en cita' })
  await dialogo.getByRole('combobox', { name: 'Paciente' }).fill('Prueba 20')
  await dialogo.getByRole('option', { name: /Paciente Prueba 20/ }).click()
  const consultorio = dialogo.getByLabel('Consultorio')
  if ((await consultorio.inputValue()) === '') await consultorio.selectOption({ index: 1 })
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await dialogo.getByRole('button', { name: 'Convertir en cita' }).click()
  expect((await put).status()).toBe(200)

  await expect.poll(() => g().eventos.get(creado.id)?.summary, { timeout: 30_000 }).toBe('Cita médica: Paciente Prueba 20')
  const descripcion = g().eventos.get(creado.id)?.description ?? ''
  expect(descripcion).not.toContain('NOTAS-GOOGLE-T3')
  expect(descripcion).toContain('Paciente Prueba 20')
  expect(columna('notes')).toBe('NOTAS-GOOGLE-T3')

  g().modificar(creado.id, { summary: 'Cambiado en Google', description: 'Otra descripción en Google' })
  permitirSondeo()
  await abrirYSondear(page)
  expect(columna('title')).toBe('Paciente Prueba 20')
  expect(columna('notes')).toBe('NOTAS-GOOGLE-T3')
  await expect.poll(() => g().eventos.get(creado.id)?.summary, { timeout: 30_000 }).toBe('Cita médica: Paciente Prueba 20')
})

test('encendido: un recurrente creado en Google sigue en solo lectura (no se importa)', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Serie de Google')
  const inicio = fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '21:00', TZ)
  const serie = g().crear({
    summary: titulo, recurrence: ['RRULE:FREQ=DAILY;COUNT=2'],
    start: { dateTime: inicio, timeZone: TZ }, end: { dateTime: new Date(Date.parse(inicio) + 1_800_000).toISOString(), timeZone: TZ },
  })
  permitirSondeo()
  await abrirYSondear(page)
  expect(sqlLocal(`select count(*) from public.appointments where google_event_id like :'ev' || '%'`, { ev: serie.id })).toBe('0')
  await expect(eventoConTexto(page, titulo)).toBeVisible({ timeout: 30_000 })
  await eventoConTexto(page, titulo).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('encendido: una cita attended movida en Google vuelve a su sitio', async ({ page }) => {
  interruptorAgenda('A', true)
  const id = await alta(page, { apellidos: 'Prueba 25', hora: '18:30', minutos: 30 })
  const ev = await esperarLigada(id)
  const res = await page.request.put(`/api/appointments/${id}`, { data: { status: 'attended' } })
  expect(res.ok(), await res.text()).toBeTruthy()
  // El after() del PUT v2: patch con color 8 y etag nuevo guardado.
  await expect.poll(() => g().eventos.get(ev.id)?.colorId).toBe('8')
  await expect.poll(() => fila(id).etag).toBe(g().eventos.get(ev.id)?.etag)

  g().modificar(ev.id, mover(g().eventos.get(ev.id) ?? ev, 90))
  permitirSondeo()
  await abrirYSondear(page)
  expect(fila(id)).toMatchObject({ estado: 'attended', inicio: '18:30' })
  // Restablecida en Google: vuelve a las 18:30 y el etag nuevo queda guardado.
  const vuelto = g().eventos.get(ev.id)
  expect(Date.parse(vuelto?.start?.dateTime ?? '')).toBe(Date.parse(fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '18:30', TZ)))
  expect(fila(id).etag).toBe(vuelto?.etag)
  expect(sqlLocal(`select count(*) from public.audit_log where accion = 'gcal_cambio_rechazado' and registro_id = :'id'`, { id })).toBe('1')
})

test('encendido: dos sondeos seguidos — el segundo respeta los 60 s mínimos', async ({ page }) => {
  interruptorAgenda('A', true)
  permitirSondeo()
  const primero = await (await page.request.post('/api/google/sync')).json() as { estado: string }
  const segundo = await (await page.request.post('/api/google/sync')).json() as Record<string, unknown>
  expect(primero.estado).toBe('ok')
  expect(segundo).toEqual({ estado: 'omitida', cambios: 0 })
})
