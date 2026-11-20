import { test, expect, type Browser, type Locator, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { SESION, CORREO, DIA_LABORABLE_LIBRE, diaDeLaSemana, interruptorAgenda, sqlLocal, eventoConTexto, modalCita, tituloUnico } from './ayudas'
import { burbuja, clicEnFranja, editarDesdeTarjeta, elegirPaciente, tarjetaLectura } from './interaccionesAyudas'
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

/**
 * Jueves de la semana SIGUIENTE: siempre en el futuro, sea cual sea la hora o
 * el día de la corrida. Lo usan las pruebas cuyo evento NUEVO de Google tiene
 * que entrar «por asignar», y la base sólo lo marca así si el evento AÚN NO HA
 * TERMINADO (`cita_asignacion_google`, `NEW.end_time > now()`, migración
 * `20261121130000`; reloj de Postgres, no del navegador). Con el jueves de la
 * semana visible, de noche o de viernes a domingo el evento ya había pasado,
 * entraba como evento y el formulario era «Editar evento» (batería del
 * 2026-11-19 a las 22:2x). Un evento que ya pasó sí se abre: lo prueba
 * «un evento de Google que ya pasó…», más abajo.
 */
const DIA_FUTURO = diaDeLaSemana(1, 3)

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

/** `abrirYSondear` y pasa a la semana de `DIA_FUTURO`. Después del sondeo: así
    esa semana se pide con la fila ya importada. */
async function sondearYVerSemanaSiguiente(page: Page): Promise<{ estado: string; cambios: number }> {
  const r = await abrirYSondear(page)
  await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${DIA_FUTURO}"]`)).toBeVisible()
  return r
}

/**
 * La FILA importada de un evento de Google (por su `data-cita-id`) y no el
 * bloque de solo lectura con el mismo título: la agenda pinta ese bloque al
 * abrir, antes de que el sondeo importe el evento, y lo sustituye por la fila
 * en el `refetch` posterior. Un clic en el bloque no abre nada (es de solo
 * lectura): eso hizo fallar la prueba de la fila editable en una corrida
 * aislada (la traza muestra el clic sobre `.ag-ev-gcal`).
 */
function filaImportada(page: Page, eventoGoogle: string): Locator {
  const id = sqlLocal(`select id from public.appointments where google_event_id = :'ev'`, { ev: eventoGoogle })
  if (!id) throw new Error(`no se importó el evento ${eventoGoogle}`)
  return page.locator(`.fc-event:has([data-cita-id="${id}"])`)
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
  const inicio = fechaHoraLocalAInstante(DIA_FUTURO, '20:00', TZ)
  const creado = g().crear({
    summary: titulo, description: 'Notas escritas en Google',
    start: { dateTime: inicio, timeZone: TZ }, end: { dateTime: new Date(Date.parse(inicio) + 3_600_000).toISOString(), timeZone: TZ },
  })
  permitirSondeo()
  const r = await sondearYVerSemanaSiguiente(page)
  expect(r.cambios).toBeGreaterThan(0)
  const [importada] = sqlLocal(`select id || '|' || origen || '|' || coalesce(notes, '') from public.appointments
                                 where google_event_id = :'ev'`, { ev: creado.id }).split('\n')
  expect(importada.split('|').slice(1)).toEqual(['google', 'Notas escritas en Google'])
  // Una sola tarjeta: la fila; el bloque de solo lectura ya no sale.
  const filaPintada = filaImportada(page, creado.id)
  await expect(filaPintada).toHaveCount(1, { timeout: 30_000 })
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(1)
  /* F3: con v2 el clic abre la tarjeta de lectura; la edición está en «Editar».
     I3 (punto 10): un evento NUEVO de Google entra «por asignar», una cita por
     ligar, así que el formulario se abre como «Editar cita» (antes, «Editar evento»). */
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  await filaPintada.click()
  await editarDesdeTarjeta(page)
  await expect(modalCita(page, 'Editar cita')).toBeVisible({ timeout: 30_000 })
})

/* Cierre M (pregunta de Angel): un evento de Google que YA PASÓ se importa como
   evento —no «por asignar»: ya terminó— y su tarjeta SE ABRE; «Editar» lleva a
   «Editar evento». Uno de hoy más temprano y uno de ayer, relativos a la hora
   de la corrida (de 75 a 45 minutos antes, y lo mismo 24 h antes; entre las
   00:00 y las 01:15 el «de hoy» cae ayer y sigue siendo un pasado). Si su
   semana no es la que abre la agenda (el ayer de un lunes), se va a la anterior.
   El clic, en la esquina de arriba: a esas horas puede haber citas empalmadas. */
test('encendido: un evento de Google que ya pasó (hoy más temprano y ayer) se importa como evento y su tarjeta se abre', async ({ page }) => {
  interruptorAgenda('A', true)
  const ahora = Date.now()
  const casos = [0, 1].map((dias) => {
    const inicio = new Date(ahora - 75 * 60_000 - dias * 86_400_000)
    const titulo = tituloUnico(dias ? 'Pasado ayer' : 'Pasado hoy')
    const ev = g().crear({
      summary: titulo, start: { dateTime: inicio.toISOString(), timeZone: TZ },
      end: { dateTime: new Date(inicio.getTime() + 30 * 60_000).toISOString(), timeZone: TZ },
    })
    return { titulo, ev: ev.id, fecha: inicio.toLocaleDateString('en-CA', { timeZone: TZ }) }
  })
  permitirSondeo()
  await abrirYSondear(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  for (const c of casos) {
    expect(sqlLocal(`select origen || '|' || coalesce(google_asignacion, 'NULL') || '|' || (end_time < now())::text
                       from public.appointments where google_event_id = :'ev'`, { ev: c.ev })).toBe('google|NULL|true')
    const columna = page.locator(`.fc-timegrid-col[data-date="${c.fecha}"]`)
    if (await columna.count() === 0) await page.locator('.fc-prev-button, [aria-label="Periodo anterior"]').first().click()
    await expect(columna).toBeVisible()
    const filaPintada = filaImportada(page, c.ev)
    await expect(filaPintada).toHaveCount(1, { timeout: 30_000 })
    await expect(page.locator('.fc-event', { hasText: c.titulo })).toHaveCount(1)
    await filaPintada.click({ position: { x: 6, y: 4 } })
    await editarDesdeTarjeta(page)
    await expect(modalCita(page, 'Editar evento')).toBeVisible({ timeout: 30_000 })
    await page.keyboard.press('Escape')
    await expect(modalCita(page, 'Editar evento')).toHaveCount(0)
  }
})

/* I3 · punto 10: un evento NUEVO creado en Google entra SIEMPRE «por asignar»
   (marca en la agenda); «¿No es una cita?» lo deja en evento al momento y una
   edición posterior en Google no lo devuelve (el título sí viaja: ya es un
   evento). Mutación en rojo: quitar la rama INSERT de `cita_asignacion_google`
   (el sondeo lo deja NULL, un evento como antes). */
test('encendido (I3): un evento nuevo de Google entra «Por asignar»; tras «¿No es una cita?» una edición en Google no lo devuelve', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Revisión nueva en Google')
  const inicio = fechaHoraLocalAInstante(DIA_FUTURO, '19:15', TZ)
  const creado = g().crear({
    summary: titulo, start: { dateTime: inicio, timeZone: TZ },
    end: { dateTime: new Date(Date.parse(inicio) + 1_800_000).toISOString(), timeZone: TZ },
  })
  permitirSondeo()
  await sondearYVerSemanaSiguiente(page)
  const id = sqlLocal(`select id from public.appointments where google_event_id = :'ev'`, { ev: creado.id })
  const columna = (c: 'title' | 'google_asignacion'): string =>
    sqlLocal(`select coalesce(${c}, 'NULL') from public.appointments where id = :'id'`, { id })
  expect(columna('google_asignacion')).toBe('por_asignar')
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  const filaPintada = page.locator(`.fc-event:has([data-cita-id="${id}"])`)
  await expect(filaPintada.locator('.ag-icono-sin-exp')).toBeVisible({ timeout: 30_000 })
  await filaPintada.click()
  await tarjetaLectura(page).getByRole('button', { name: 'No es una cita', exact: true }).click()
  await expect.poll(() => columna('google_asignacion'), { timeout: 15_000 }).toBe('evento')

  g().modificar(creado.id, { summary: `${titulo} editado` })
  permitirSondeo()
  await sondearYVerSemanaSiguiente(page)
  await expect.poll(() => columna('title'), { timeout: 30_000 }).toBe(`${titulo} editado`)
  expect(columna('google_asignacion')).toBe('evento')
  await expect(filaPintada).toContainText('editado', { timeout: 30_000 })
  await expect(filaPintada.locator('.ag-icono-sin-exp')).toHaveCount(0)
})

/* T3 · punto 6 (AG-DT-29): convertir en cita un evento nacido en Google, desde
   la tarjeta. A Google va el título del paciente y la descripción fija, nunca
   las notas (S1); un título cambiado después en Google no pisa la cita (C-d).
   Mutación en rojo: `descripcionV2` mandando las notas aunque haya paciente. */
test('encendido: un evento creado en Google se convierte en cita; a Google va el paciente sin las notas y su título no vuelve', async ({ page }) => {
  interruptorAgenda('A', true)
  const titulo = tituloUnico('Google a cita')
  const inicio = fechaHoraLocalAInstante(DIA_FUTURO, '20:30', TZ)
  const creado = g().crear({
    summary: titulo, description: 'NOTAS-GOOGLE-T3',
    start: { dateTime: inicio, timeZone: TZ }, end: { dateTime: new Date(Date.parse(inicio) + 1_800_000).toISOString(), timeZone: TZ },
  })
  permitirSondeo()
  await sondearYVerSemanaSiguiente(page)
  const id = sqlLocal(`select id from public.appointments where google_event_id = :'ev'`, { ev: creado.id })
  expect(id).not.toBe('')
  const columna = (c: 'title' | 'notes'): string => sqlLocal(`select coalesce(${c}, '') from public.appointments where id = :'id'`, { id })

  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  /* La FILA importada (por su `data-cita-id`), no el bloque de solo lectura de
     Google que la caché pudo pintar antes del sondeo. */
  const filaPintada = page.locator(`.fc-event:has([data-cita-id="${id}"])`)
  await expect(filaPintada).toHaveCount(1, { timeout: 30_000 })
  /* I3 (punto 10): recién importado está «por asignar»; «¿No es una cita?» lo deja en
     evento y «Convertir en cita» es el camino de vuelta (el que prueba esto). */
  await filaPintada.click()
  await tarjetaLectura(page).getByRole('button', { name: 'No es una cita', exact: true }).click()
  await expect.poll(() => sqlLocal(`select coalesce(google_asignacion, '') from public.appointments where id = :'id'`, { id })).toBe('evento')
  await page.keyboard.press('Escape')
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

/* H3 · punto 14: las observaciones escritas en la burbuja de alta rápida se
   guardan en la cita y NO viajan a Google (S1): el evento lleva la descripción
   fija de `eventoParaGoogle`. Mutación en rojo: en el `after()` del POST de
   `/api/appointments`, añadir `notes` a la descripción. */
test('encendido: las observaciones de la burbuja se guardan en la cita y no viajan a Google (H3, S1)', async ({ page }) => {
  interruptorAgenda('A', true)
  const obs = `OBS-BURBUJA-H3-${Date.now()}`
  await page.goto('/agenda')
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas', { timeout: 120_000 })
  /* 13:00 y no 15:00: en la batería completa `agenda-cancelar` (corre antes)
     deja ese jueves sus citas canceladas de las 15:05 y las 15:40, y el clic
     abría la tarjeta de una de ellas (integración de la tanda H). A las 13:00
     ese jueves sólo está la «Comida» de la semilla, que es de la Dra. Invitada:
     el Dr. Admin abre filtrado a SU agenda y no se pinta (y `agenda-arrastre`,
     que corre antes, la mueve a las 18:00). Si esta prueba pasa a «Todos los
     médicos», elige otra hora. */
  await clicEnFranja(page, DIA_LABORABLE_LIBRE, '13:00')
  const b = burbuja(page)
  const avisoHorario = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Aceptar' }) })
  await expect(b.or(avisoHorario).first()).toBeVisible({ timeout: 30_000 })
  if (await avisoHorario.count()) await avisoHorario.getByRole('button', { name: 'Aceptar' }).click()
  await elegirPaciente(b, 'Prueba 22')
  await b.getByRole('button', { name: 'Añadir observaciones' }).click()
  await b.getByRole('textbox', { name: 'Observaciones' }).fill(obs)
  const post = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/appointments') && r.status() === 200, { timeout: 60_000 })
  await b.getByRole('button', { name: 'Guardar', exact: true }).click()
  const aviso = page.getByRole('dialog', { name: /Se empalma/ })
  await expect(aviso.or(b.getByText('Cita agendada', { exact: true })).first()).toBeVisible({ timeout: 60_000 })
  if (await aviso.count()) await aviso.getByRole('button', { name: 'Aceptar' }).click()
  const id = ((await (await post).json()) as { appointment: { id: string } }).appointment.id
  expect(sqlLocal(`select notes from public.appointments where id = :'id'`, { id })).toBe(obs)
  const ev = await esperarLigada(id)
  expect(ev.description ?? '').toContain('Paciente Prueba 22')
  expect(JSON.stringify(ev)).not.toContain(obs)
  /* Integración I: se borra. Quedaba el jueves 13:00–14:00 de esta semana y
     `agenda-tipos-cita` (corre después) da de alta 13:20–14:00 ese jueves: con
     la v2 encendida, el aviso de empalme tapaba su «Guardar». */
  sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.cita_confirmaciones where appointment_id = :'id';
    delete from public.cita_correos where appointment_id = :'id';
    delete from public.avisos_clinica where cita_id = :'id';
    delete from public.appointments where id = :'id'; commit;`, { id })
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
