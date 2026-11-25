/**
 * Google Calendar SIMULADO para las pruebas A MANO de la agenda v2
 * (`GUIA_PRUEBAS_AGENDA_V2.md`, C0, C1-C10 y G1-G5). Solo local.
 *
 *   npx tsx scripts/google-falso-manual.ts
 *
 * Con un solo comando:
 *   1. arranca el Google falso de las e2e (`e2e/google-falso/servidor.ts`) en
 *      127.0.0.1:4555;
 *   2. conecta la «Clínica Semilla A» a él, como si el Dr. Admin hubiera
 *      conectado su cuenta (tokens falsos que no caducan: nunca hay refresco
 *      que pudiera salir a Google);
 *   3. arranca la app en http://localhost:3002 con `next dev` y las variables
 *      que abren el desvío de `src/lib/gcalFalso.ts` (modo de desarrollo,
 *      dirección local del falso, llaves de Google falsas, base local). Su
 *      salida va a `test-results/google-falso-manual-next.log`;
 *   4. atiende las órdenes por `curl` en 127.0.0.1:4556 (`/ayuda` las lista).
 *
 * Ctrl+C lo deshace: para la app del 3002 y el Google falso, borra la conexión
 * y el estado de sincronización de la Clínica A, borra los eventos que entraron
 * desde el Google falso, suelta de él las citas de Spinus que se le mandaron
 * (vuelven a `pending`, como las sembradas) y borra los avisos de empalme
 * detectados durante la sesión. Lo que se hizo A MANO en la agenda (citas
 * nuevas, cancelaciones) se queda, como en cualquier prueba. La auditoría
 * (`audit_log`) no se borra ni se edita: la limpieza le deja sus renglones
 * normales (un `cita_eliminada` de `system` por evento importado que borra).
 * Al arrancar hace la parte segura de esa limpieza (lo que lleva la marca
 * exacta del Google falso) y para la app del 3002 que haya dejado una sesión
 * cerrada de golpe; un evento importado que ya se había cancelado y soltado en
 * esa sesión no lleva marca, y se queda hasta la próxima siembra.
 *
 * ⚠️ SOLO LOCAL. Aborta si `NEXT_PUBLIC_SUPABASE_URL` no es 127.0.0.1 o
 * localhost, y nunca toca una conexión de Google que no sea la falsa.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { execFileSync, spawn, type ChildProcess } from 'child_process'
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync } from 'fs'
import { createServer, type Server } from 'http'
import { arrancarGoogleFalso, CALENDARIO, type EventoFalso, type GoogleFalso } from '../e2e/google-falso/servidor'
import { encrypt } from '../src/lib/encrypt'

config({ path: resolve(process.cwd(), '.env.local'), quiet: true })

const CONTENEDOR = 'supabase_db_app_ortointegra'
const CLINICA = 'Clínica Semilla A'
const CORREO_ADMIN = 'admin.a@semilla.spinus.test'
const CUENTA_FALSA = 'falso@google-falso.test'
const PUERTO_GOOGLE = 4555
const PUERTO_ORDENES = 4556
const PUERTO_APP = 3002
const LOG_APP = 'test-results/google-falso-manual-next.log'
const ZONA = 'America/Merida'
/** Marca en el entorno de la app que lanza este script: así se reconoce una que quedó huérfana. */
const MARCA_APP = 'SPINUS_GOOGLE_FALSO_MANUAL=1'

function exigirLocal(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  let host = ''
  try { host = new URL(url).hostname } catch { /* vacía o ilegible: no es local */ }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('CANDADO: NEXT_PUBLIC_SUPABASE_URL de .env.local no es local. No sigo.')
  }
  const clave = process.env.GOOGLE_TOKEN_SECRET ?? ''
  if (clave.length !== 64) throw new Error('falta GOOGLE_TOKEN_SECRET (64 caracteres) en .env.local')
}

/** psql como `postgres` en la base local, con `:'clinica'`, `:'cal'` y `:'cuenta'` ya puestos. */
function sql(consulta: string, variables: Record<string, string> = {}): string {
  const fijas: Record<string, string> = { clinica: CLINICA, cal: CALENDARIO, cuenta: CUENTA_FALSA, ...variables }
  const vars = Object.entries(fijas).flatMap(([k, v]) => ['-v', `${k}=${v}`])
  return execFileSync('docker', ['exec', '-i', CONTENEDOR, 'psql', '-U', 'postgres', '-X', '-tAq',
    '-v', 'ON_ERROR_STOP=1', ...vars, '-f', '-'], { input: consulta, encoding: 'utf8' }).trim()
}

/* Cada paso de la limpieza va por separado: si uno falla, los demás se hacen
   igual. Los marcados `soloAlCerrar` no se hacen al arrancar: sin la hora de
   inicio de la sesión, sólo se toca lo que lleva la marca exacta del falso. */
interface Paso { que: string; consulta: string; soloAlCerrar: boolean }
const LIMPIEZA: readonly Paso[] = [
  { que: 'conexión falsa', soloAlCerrar: false, consulta: `
    delete from private.google_conexiones_secretos s using public.clinica_conexiones_google g, public.clinicas c
     where s.conexion_id = g.id and g.clinica_id = c.id and c.nombre = :'clinica' and g.google_account_email = :'cuenta';
    delete from public.clinica_conexiones_google g using public.clinicas c
     where g.clinica_id = c.id and c.nombre = :'clinica' and g.google_account_email = :'cuenta';` },
  { que: 'estado de sincronización', soloAlCerrar: false, consulta: `
    delete from public.gcal_sync_estado e using public.clinicas c
     where e.clinica_id = c.id and c.nombre = :'clinica' and e.calendar_id = :'cal';` },
  { que: 'eventos que entraron desde el Google falso', soloAlCerrar: false, consulta: `
    delete from public.appointments a using public.clinicas c
     where a.clinica_id = c.id and c.nombre = :'clinica' and a.origen = 'google' and a.gcal_calendar_id = :'cal'
       and a.paciente_id is null and a.reserva_canal is null;` },
  /* Un evento importado que luego se borró en Google queda cancelado y suelto
     (sin calendario): ya no lleva la marca del falso. Sólo se borran los
     nacidos durante ESTA sesión, en la que la única conexión era la falsa. */
  { que: 'eventos sueltos de esta sesión', soloAlCerrar: true, consulta: `
    delete from public.appointments a using public.clinicas c
     where a.clinica_id = c.id and c.nombre = :'clinica' and a.origen = 'google' and a.gcal_calendar_id is null
       and a.created_at >= :'desde'::timestamptz and a.paciente_id is null and a.reserva_canal is null;` },
  { que: 'citas de Spinus mandadas al Google falso', soloAlCerrar: false, consulta: `
    update public.appointments a set google_event_id = null, gcal_etag = null, gcal_calendar_id = null,
           gcal_sync_status = 'pending'
      from public.clinicas c
     where a.clinica_id = c.id and c.nombre = :'clinica' and a.gcal_calendar_id = :'cal';` },
  /* `reserva_empalmes_google` es un registro que la app nunca borra; esto es
     herramienta LOCAL (como la semilla, que también lo vacía) y sólo quita los
     avisos detectados durante la sesión con el Google falso. */
  { que: 'avisos de empalme de esta sesión', soloAlCerrar: true, consulta: `
    delete from public.reserva_empalmes_google r using public.clinicas c
     where r.clinica_id = c.id and c.nombre = :'clinica' and r.detectado_en >= :'desde'::timestamptz;` },
]

/* La limpieza al cerrar NO puede ser síncrona: `npx tsx` reenvía el Ctrl+C al
   proceso hijo y, si en 30 ms el hijo no le contesta por IPC (que no sale con el
   bucle de eventos bloqueado), lo remata con SIGKILL a media limpieza. Por eso
   aquí psql va con `spawn` y el bucle queda libre. */
function sqlAsincrono(consulta: string, variables: Record<string, string>): Promise<void> {
  const fijas: Record<string, string> = { clinica: CLINICA, cal: CALENDARIO, cuenta: CUENTA_FALSA, ...variables }
  const vars = Object.entries(fijas).flatMap(([k, v]) => ['-v', `${k}=${v}`])
  return new Promise((ok, mal) => {
    const psql = spawn('docker', ['exec', '-i', CONTENEDOR, 'psql', '-U', 'postgres', '-X', '-tAq',
      '-v', 'ON_ERROR_STOP=1', ...vars, '-f', '-'], { stdio: ['pipe', 'ignore', 'pipe'] })
    let error = ''
    psql.stderr.on('data', (t: Buffer) => { error += t.toString('utf8') })
    psql.on('error', mal)
    psql.on('close', (codigo) => { if (codigo === 0) ok(); else mal(new Error(error.trim() || `psql salió con ${codigo}`)) })
    psql.stdin.end(consulta)
  })
}

/** Deshace lo que deja el Google falso. `desde`: inicio de la sesión, o `null` al arrancar. */
async function limpiar(desde: string | null): Promise<string[]> {
  const fallos: string[] = []
  for (const paso of LIMPIEZA) {
    if (paso.soloAlCerrar && desde === null) continue
    try { await sqlAsincrono(paso.consulta, { desde: desde ?? 'infinity' }) } catch (e) {
      fallos.push(`${paso.que}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    }
  }
  return fallos
}

function exigirSinOtraConexion(): void {
  const otra = sql(`select count(*) from public.clinica_conexiones_google g join public.clinicas c on c.id = g.clinica_id
                     where c.nombre = :'clinica' and g.google_account_email is distinct from :'cuenta';`)
  if (otra !== '0') throw new Error('La Clínica Semilla A ya tiene otra conexión con Google (no la falsa). No toco nada.')
}

function conectar(): void {
  const hecha = sql(`with g as (
      insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado, google_account_email)
      select c.id, u.id, 'clinica', :'cal', 'activa', :'cuenta'
        from public.clinicas c, auth.users u where c.nombre = :'clinica' and u.email = :'correo'
      returning id)
    insert into private.google_conexiones_secretos (conexion_id, access_token, refresh_token, expires_at)
    select g.id, :'acceso', :'refresco', :'caduca'::bigint from g returning conexion_id;`, {
    correo: CORREO_ADMIN, acceso: encrypt('token-falso-de-acceso'), refresco: encrypt('token-falso-de-refresco'),
    caduca: String(Date.now() + 10 * 365 * 86_400_000),
  })
  if (!hecha) throw new Error('No encontré la Clínica Semilla A o al Dr. Admin: siembra primero (P6).')
}

/**
 * Si una sesión anterior se cerró de golpe, su app del 3002 sigue viva (se lanza
 * aparte para poder pararla entera). Sólo se paran los procesos de ESTA carpeta
 * que llevan la marca de este script en su entorno; nada más.
 */
function pararAppHuerfana(): number {
  let parados = 0
  for (const pid of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    try {
      if (Number(pid) === process.pid || readlinkSync(`/proc/${pid}/cwd`) !== process.cwd()) continue
      if (!readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(MARCA_APP)) continue
      process.kill(Number(pid), 'SIGTERM')
      parados += 1
    } catch { /* ya no está, o no es nuestro: no se toca */ }
  }
  return parados
}

async function puertoOcupado(puerto: number): Promise<boolean> {
  try { await fetch(`http://localhost:${puerto}/`, { signal: AbortSignal.timeout(2000) }); return true } catch { return false }
}

function arrancarApp(urlGoogle: string): ChildProcess {
  mkdirSync('test-results', { recursive: true })
  const log = openSync(LOG_APP, 'w')
  const env: NodeJS.ProcessEnv = {
    ...process.env, NODE_ENV: 'development', GCAL_FALSO_URL: urlGoogle, GOOGLE_CLIENT_ID: 'cliente-falso',
    GOOGLE_CLIENT_SECRET: 'secreto-falso', NEXT_PUBLIC_APP_URL: `http://localhost:${PUERTO_APP}`, NEXT_TELEMETRY_DISABLED: '1',
    SPINUS_GOOGLE_FALSO_MANUAL: '1',
  }
  const hijo = spawn('npx', ['next', 'dev', '--webpack', '-p', String(PUERTO_APP)],
    { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log, log] })
  closeSync(log)
  return hijo
}

async function esperarApp(hijo: ChildProcess): Promise<void> {
  const tope = Date.now() + 240_000
  while (Date.now() < tope) {
    if (hijo.exitCode !== null) throw new Error(`la app del ${PUERTO_APP} se cerró; mira ${LOG_APP}`)
    try {
      const res = await fetch(`http://localhost:${PUERTO_APP}/login`, { signal: AbortSignal.timeout(5000) })
      if (res.status === 200) return
    } catch { /* todavía no escucha */ }
    await new Promise((ok) => setTimeout(ok, 1000))
  }
  throw new Error(`la app del ${PUERTO_APP} no respondió en 4 minutos; mira ${LOG_APP}`)
}

/* ── Las órdenes ────────────────────────────────────────────────────────── */

type Parametros = URLSearchParams
type Orden = (g: GoogleFalso, p: Parametros) => string

/** Día AAAA-MM-DD y hora HH:MM de Mérida (UTC-6, sin horario de verano) → puntas de Google. */
function puntas(p: Parametros): Pick<EventoFalso, 'start' | 'end'> {
  const dia = p.get('dia') ?? ''
  const hora = p.get('hora') ?? ''
  const min = Number(p.get('min') ?? '60')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^\d{2}:\d{2}$/.test(hora) || !(min > 0)) {
    throw new Error('faltan datos: dia=AAAA-MM-DD, hora=HH:MM y, si quieres, min=minutos (60 si no)')
  }
  const ini = new Date(`${dia}T${hora}:00-06:00`)
  if (Number.isNaN(ini.getTime())) throw new Error(`fecha u hora imposible: ${dia} ${hora}`)
  return { start: { dateTime: ini.toISOString() }, end: { dateTime: new Date(ini.getTime() + min * 60_000).toISOString() } }
}

function enMerida(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('es-MX', { timeZone: ZONA, dateStyle: 'short', timeStyle: 'short' }) : '-'
}

function renglon(e: EventoFalso): string {
  const ini = enMerida(e.start?.dateTime ?? e.start?.date)
  const fin = enMerida(e.end?.dateTime ?? e.end?.date)
  const serie = e.recurrence ? ' | serie' : ''
  const desc = (e.description ?? '').replace(/\s+/g, ' ').slice(0, 80)
  return `${e.id} | ${e.status} | ${e.summary ?? ''} | ${ini} → ${fin}${serie} | descripción: ${desc}`
}

function existente(g: GoogleFalso, p: Parametros): string {
  const id = p.get('id') ?? ''
  if (!g.eventos.has(id)) throw new Error(`no hay ningún evento «${id}» (mira /lista)`)
  return id
}

/** Fecha de la última lectura buena de Google; 0 filas = la agenda del 3002 aún no se abrió. */
function fijarUltima(segundos: number): boolean {
  const filas = sql(`update public.gcal_sync_estado e
       set ultima_ok = now() - make_interval(secs => :'s'::int), errores_seguidos = 0, ultimo_error = null,
           candado = null, candado_hasta = null
      from public.clinicas c where e.clinica_id = c.id and c.nombre = :'clinica' returning e.id;`, { s: String(segundos) })
  return filas !== ''
}

const SIN_ESTADO = 'todavía no hay lectura de Google: abre una vez http://localhost:3002/agenda y repite la orden'

const ORDENES: Record<string, Orden> = {
  lista: (g) => [...g.eventos.values()].map(renglon).join('\n') || '(sin eventos)',
  crear: (g, p) => {
    const veces = Number(p.get('veces') ?? '0')
    const e = g.crear({
      summary: p.get('titulo') ?? 'Evento de Google', description: p.get('descripcion') ?? undefined, ...puntas(p),
      ...(veces > 1 ? { recurrence: [`RRULE:FREQ=DAILY;COUNT=${Math.min(veces, 30)}`] } : {}),
    })
    return `creado ${e.id}`
  },
  mover: (g, p) => { g.modificar(existente(g, p), puntas(p)); return 'movido' },
  titulo: (g, p) => { g.modificar(existente(g, p), { summary: p.get('texto') ?? '' }); return 'título cambiado' },
  descripcion: (g, p) => { g.modificar(existente(g, p), { description: p.get('texto') ?? '' }); return 'descripción cambiada' },
  borrar: (g, p) => { g.borrar(existente(g, p)); return 'borrado (queda cancelado en Google)' },
  caido: (g) => { g.lista = { demoraMs: 0, falla: 503 }; return 'Google CAÍDO (responde 503 al leer)' },
  lento: (g, p) => {
    g.lista = { demoraMs: Math.max(0, Number(p.get('ms') ?? '8000')), falla: null }
    return `Google LENTO (${g.lista.demoraMs} ms al leer)`
  },
  normal: (g) => { g.lista = { demoraMs: 0, falla: null }; return 'Google normal' },
  ya: () => fijarUltima(300) ? 'listo: la próxima recarga de la agenda vuelve a leer Google' : SIN_ESTADO,
  ultima: (_g, p) => {
    const s = Math.max(0, Math.trunc(Number(p.get('seg') ?? '0')) || 0)
    return fijarUltima(s) ? `última lectura buena de Google: hace ${s} s` : SIN_ESTADO
  },
}

const AYUDA = `órdenes: /${Object.keys(ORDENES).join(' /')} (ver la guía, C0)`

function atenderOrdenes(g: GoogleFalso): Server {
  return createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://127.0.0.1')
    const nombre = u.pathname.replace(/^\//, '')
    const orden = Object.hasOwn(ORDENES, nombre) ? ORDENES[nombre] : null
    let salida: string
    try { salida = orden ? orden(g, u.searchParams) : AYUDA } catch (e) {
      salida = `ERROR: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`${salida}\n`)
  })
}

async function escuchar(servidor: Server, puerto: number): Promise<void> {
  await new Promise<void>((ok, mal) => {
    servidor.once('error', mal)
    servidor.listen(puerto, '127.0.0.1', () => ok())
  })
}

async function main(): Promise<void> {
  exigirLocal()
  if (pararAppHuerfana() > 0) {
    console.log(`Paré la app del ${PUERTO_APP} que dejó una sesión anterior cerrada de golpe.`)
    await new Promise((ok) => setTimeout(ok, 3000))
  }
  if (await puertoOcupado(PUERTO_APP)) throw new Error(`el puerto ${PUERTO_APP} ya está en uso: cierra la otra app (¿otra terminal?)`)
  exigirSinOtraConexion()
  const fallosPrevios = await limpiar(null)
  if (fallosPrevios.length) throw new Error(`no pude limpiar una sesión anterior: ${fallosPrevios.join('; ')}`)
  const inicio = sql('select now();')
  let app: ChildProcess | null = null
  let cerrando = false
  const cerrar = async (codigo: number): Promise<void> => {
    if (cerrando) return
    cerrando = true
    console.log('\nCerrando: deshaciendo la conexión de prueba (unos segundos)…')
    if (app?.pid) { try { process.kill(-app.pid, 'SIGTERM') } catch { /* ya no estaba */ } }
    const fallos = await limpiar(inicio)
    console.log(fallos.length ? `OJO, no se pudo deshacer todo: ${fallos.join('; ')}` : 'Listo: app del 3002 parada, conexión de prueba borrada y base como estaba.')
    process.exit(codigo)
  }
  for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(senal, () => { void cerrar(0) })
  const g = await arrancarGoogleFalso(PUERTO_GOOGLE)
  await escuchar(atenderOrdenes(g), PUERTO_ORDENES)
  conectar()
  console.log(`Google simulado en ${g.url} y órdenes en http://127.0.0.1:${PUERTO_ORDENES} (Clínica Semilla A conectada).`)
  console.log(`Arrancando la app en http://localhost:${PUERTO_APP} (puede tardar un par de minutos)…`)
  app = arrancarApp(g.url)
  try { await esperarApp(app) } catch (e) { console.error(e instanceof Error ? e.message : e); await cerrar(1); return }
  console.log(`Lista: abre http://localhost:${PUERTO_APP}/agenda. Deja esta ventana abierta; Ctrl+C para terminar.`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
