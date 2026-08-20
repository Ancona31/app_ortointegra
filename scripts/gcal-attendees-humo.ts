/**
 * §12.12.3 — ¿el token de la APP puede invitar asistentes y disparar el correo?
 *
 *   npx tsx scripts/gcal-attendees-humo.ts correo-del-invitado@ejemplo.com
 *
 * SCRIPT DE UNA SOLA EJECUCIÓN. No es código de producción y no lo importa
 * nadie. Si sigue aquí dentro de un mes, sobra.
 *
 * ── QUÉ DECIDE ──────────────────────────────────────────────────────────────
 *
 * §12.4 del plan resuelve que a los médicos invitados NO se les pide conectar
 * su cuenta de Google: se les manda una invitación por correo desde el evento
 * de la clínica (`attendees` + `sendUpdates`). Toda esa decisión descansa en un
 * supuesto que nadie ha comprobado: que el scope NO sensible
 * `calendar.app.created` autorice a invitar asistentes externos.
 *
 * Angel ya lo probó a mano desde la interfaz de Google Calendar y funciona.
 * Eso NO responde la pregunta: allí actuaba el dueño de la cuenta, con permisos
 * completos. Aquí actúa el token de la app, limitado a un solo scope. Son dos
 * actores distintos y pueden dar respuestas distintas.
 *
 * SEGUNDO OBJETIVO — el Meet. En la prueba manual, Google añadió solo un enlace
 * de videollamada. Falta saber si eso pasa también cuando el evento nace por la
 * API o si fue una preferencia de la interfaz. Si pasa siempre, cada médico
 * invitado recibiría un enlace de videollamada para una consulta PRESENCIAL, y
 * habría que apagarlo a propósito. Este script NO pide conferencia (no manda
 * `conferenceDataVersion` ni `conferenceData`): si aparece, la puso Google.
 *
 * ── QUÉ ESCRIBE ─────────────────────────────────────────────────────────────
 *
 * Crea UN evento de prueba en el calendario de la clínica y lo BORRA al
 * terminar. Si revienta a medias, imprime el `eventId` para borrarlo a mano.
 * No toca ninguna tabla de Supabase: si el access token estaba caducado se
 * refresca EN MEMORIA y no se persiste, para que un script de usar y tirar no
 * deje escrituras en producción.
 *
 * NO IMPRIME NINGÚN TOKEN, ni truncado.
 *
 * El correo del invitado NO va escrito en este archivo: se pasa por argumento
 * o por `GCAL_PRUEBA_INVITADO`.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { google, type calendar_v3 } from 'googleapis'

config({ path: resolve(process.cwd(), '.env.local') })

// Imports RELATIVOS y sin alias `@/`: bajo `tsx` la resolución de `paths` es
// una variable más que puede fallar, y este script se corre una vez. `decrypt`
// sí se importa del módulo real —descifrar a mano sería probar otra cosa—.
import { createAdminClient } from '../src/lib/supabase/admin'
import { decrypt } from '../src/lib/encrypt'

/** Copia deliberada de `GCAL_TIMEZONE` (src/lib/gcal.ts). Importar gcal.ts
 *  arrastraría sus imports con alias; para un literal no compensa. */
const ZONA = 'America/Mexico_City'

const ENV_REQUERIDAS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_TOKEN_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const

/** La conexión tal como la devuelve el puente. Los dos tokens llegan CIFRADOS. */
interface FilaConexion {
  conexion_id:    string
  clinica_id:     string
  user_id:        string
  calendar_id:    string | null
  estado:         string
  tiene_secretos: boolean
  access_token:   string | null
  refresh_token:  string | null
  expires_at:     number | null
}

function aborta(mensaje: string): never {
  console.error(`✖ ${mensaje}`)
  process.exit(1)
}

/**
 * Vuelca el error ENTERO. Un fallo aquí vale tanto como un éxito —«403
 * forbiddenForServiceAccounts» y «403 sharingRestrictionViolation» significan
 * cosas muy distintas para §12.4—, así que no se resume: se imprime el cuerpo
 * de la respuesta tal cual lo mandó Google.
 */
function imprimeError(etiqueta: string, err: unknown): void {
  console.log('')
  console.log(`✖ ${etiqueta}`)
  console.log(`  ${err instanceof Error ? err.message : String(err)}`)
  const o = err as { code?: unknown; status?: unknown; response?: { status?: unknown; data?: unknown } }
  if (o?.code !== undefined)            console.log(`  code:   ${String(o.code)}`)
  if (o?.response?.status !== undefined) console.log(`  status: ${String(o.response.status)}`)
  if (o?.response?.data !== undefined) {
    console.log('  cuerpo de la respuesta de Google, completo:')
    console.log(JSON.stringify(o.response.data, null, 2))
  }
}

/** El correo del invitado. Argumento primero, variable de entorno después. */
function correoDelInvitado(): string {
  const valor = (process.argv[2] ?? process.env.GCAL_PRUEBA_INVITADO ?? '').trim()
  if (!valor) {
    aborta(
      'Falta el correo del invitado.\n' +
      '  npx tsx scripts/gcal-attendees-humo.ts alguien@ejemplo.com\n' +
      '  (o exporta GCAL_PRUEBA_INVITADO)'
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) aborta(`«${valor}» no parece un correo.`)
  return valor
}

/**
 * Resuelve LA conexión de la clínica por el mismo camino que va a usar la
 * aplicación a partir del commit 3: la tabla de metadata para encontrarla, y el
 * puente `leer_conexion_google_con_secretos` para los tokens.
 *
 * `GCAL_PRUEBA_CLINICA_ID` fija la clínica cuando hay más de una conectada. Sin
 * él se exige que haya exactamente una: probar contra la clínica equivocada
 * daría un veredicto que no vale.
 */
async function resolverConexion(): Promise<FilaConexion> {
  const admin = createAdminClient()
  const clinicaFijada = (process.env.GCAL_PRUEBA_CLINICA_ID ?? '').trim()

  let q = admin
    .from('clinica_conexiones_google')
    .select('id, clinica_id')
    .eq('rol', 'clinica')
    .eq('estado', 'activa')
  if (clinicaFijada) q = q.eq('clinica_id', clinicaFijada)

  const { data, error } = await q
  if (error) aborta(`no se pudo leer clinica_conexiones_google: ${error.message}`)
  const filas = (data ?? []) as { id: string; clinica_id: string }[]
  if (filas.length === 0) {
    aborta('no hay ninguna conexión de clínica activa. Sin sujeto, esto no prueba nada.')
  }
  if (filas.length > 1) {
    console.error('✖ Hay varias conexiones de clínica activas. Elige una con GCAL_PRUEBA_CLINICA_ID:')
    for (const f of filas) console.error(`    clinica_id = ${f.clinica_id}`)
    process.exit(1)
  }

  const { id: conexionId, clinica_id: clinicaId } = filas[0]
  const rpc = await admin.rpc('leer_conexion_google_con_secretos', {
    p_clinica_id:  clinicaId,
    p_conexion_id: conexionId,
  })
  if (rpc.error) aborta(`el puente falló: ${rpc.error.code ?? 'sin código'} ${rpc.error.message}`)

  const conexion = (Array.isArray(rpc.data) ? rpc.data : [])[0] as FilaConexion | undefined
  if (!conexion) aborta('el puente devolvió 0 filas para una conexión que existe.')
  if (!conexion.tiene_secretos) aborta('la conexión no tiene tokens (tiene_secretos = false).')
  return conexion
}

/**
 * Cliente de Calendar con las credenciales de la conexión, montado igual que
 * `abrirSesionGoogle` (src/lib/gcal.ts:154): mismo `OAuth2` con las mismas tres
 * variables de entorno, mismos tokens descifrados con el mismo `decrypt`. Ese
 * parecido ES la prueba; un cliente montado de otra manera no probaría nada.
 *
 * Única diferencia deliberada: si toca refrescar, el token nuevo se queda en
 * memoria y NO se persiste. Un script de una sola ejecución no escribe en
 * producción, y para esta petición sirve igual.
 */
async function abrirCalendar(conexion: FilaConexion): Promise<calendar_v3.Calendar> {
  const acceso   = decrypt(conexion.access_token)
  const refresco = decrypt(conexion.refresh_token)
  if (!acceso && !refresco) aborta('los tokens no se pudieron descifrar. ¿GOOGLE_TOKEN_SECRET es el de este entorno?')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({
    access_token:  acceso,
    refresh_token: refresco,
    expiry_date:   conexion.expires_at,
  })

  const caducado = conexion.expires_at !== null && Date.now() > conexion.expires_at
  if (caducado) {
    console.log('· access token caducado: se refresca en memoria (no se guarda)')
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)
  }

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

/** Mañana a las 09:00 hora local, media hora. Futuro próximo y fácil de ubicar. */
function ventanaDePrueba(): { inicio: string; fin: string } {
  const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000)
  inicio.setHours(9, 0, 0, 0)
  const fin = new Date(inicio.getTime() + 30 * 60 * 1000)
  return { inicio: inicio.toISOString(), fin: fin.toISOString() }
}

/**
 * Los tres interruptores de §12.4, leídos de la respuesta.
 *
 * OJO CON EL AUSENTE. Google omite estos campos cuando valen su valor por
 * defecto, y los defaults NO son los mismos para los tres (documentados en
 * `node_modules/googleapis/.../calendar/v3.d.ts`):
 *
 *   guestsCanModify          por defecto FALSE  → ausente = quedó como queremos
 *   guestsCanInviteOthers    por defecto TRUE   → ausente = NO se aplicó
 *   guestsCanSeeOtherGuests  por defecto TRUE   → ausente = NO se aplicó
 *
 * Por eso se imprime el valor crudo al lado del efectivo: si Google cambiara un
 * default, la columna cruda seguiría diciendo la verdad.
 */
function informeInterruptores(ev: calendar_v3.Schema$Event): void {
  const casos: { campo: string; crudo: boolean | null | undefined; pordefecto: boolean }[] = [
    { campo: 'guestsCanModify',         crudo: ev.guestsCanModify,         pordefecto: false },
    { campo: 'guestsCanInviteOthers',   crudo: ev.guestsCanInviteOthers,   pordefecto: true  },
    { campo: 'guestsCanSeeOtherGuests', crudo: ev.guestsCanSeeOtherGuests, pordefecto: true  },
  ]
  console.log('Los tres interruptores de §12.4 (se pidieron los tres en false):')
  for (const c of casos) {
    const efectivo = c.crudo === null || c.crudo === undefined ? c.pordefecto : c.crudo
    const crudo    = c.crudo === undefined ? 'ausente' : String(c.crudo)
    console.log(`  ${efectivo === false ? '✔' : '✖'} ${c.campo.padEnd(24)} efectivo=${String(efectivo).padEnd(5)} (crudo: ${crudo}, default ${c.pordefecto})`)
  }
}

/** Objetivo 1: ¿aceptó Google al asistente, y en qué estado quedó? */
function informeAsistentes(ev: calendar_v3.Schema$Event, invitado: string): void {
  const asistentes = ev.attendees ?? []
  console.log('')
  console.log(`Asistentes en la respuesta: ${asistentes.length}`)
  for (const a of asistentes) {
    console.log(`  · ${a.email ?? '(sin correo)'}  responseStatus=${a.responseStatus ?? '?'}  organizer=${a.organizer === true}`)
  }
  const entro = asistentes.some((a) => (a.email ?? '').toLowerCase() === invitado.toLowerCase())
  console.log(entro
    ? '✔ OBJETIVO 1 — el token de la app SÍ pudo añadir al asistente.'
    : '✖ OBJETIVO 1 — el asistente NO aparece en la respuesta: Google lo descartó en silencio.')
  console.log('  El correo NO se puede comprobar desde aquí: mira la bandeja del invitado.')
}

/** Objetivo 2: ¿metió Google un Meet sin que nadie se lo pidiera? */
function informeConferencia(ev: calendar_v3.Schema$Event): void {
  const tieneConf = ev.conferenceData !== undefined && ev.conferenceData !== null
  const tieneLink = typeof ev.hangoutLink === 'string' && ev.hangoutLink.length > 0
  console.log('')
  if (!tieneConf && !tieneLink) {
    console.log('✔ OBJETIVO 2 — sin conferenceData y sin hangoutLink: la API no añade Meet sola.')
    return
  }
  console.log('✖ OBJETIVO 2 — GOOGLE AÑADIÓ VIDEOLLAMADA SIN QUE SE LE PIDIERA.')
  console.log(`  hangoutLink presente:   ${tieneLink}`)
  console.log(`  conferenceData presente: ${tieneConf}`)
  if (tieneConf) console.log(`  conferenceSolution: ${ev.conferenceData?.conferenceSolution?.name ?? '(sin nombre)'}`)
  console.log('  Consecuencia: cada médico invitado recibiría un enlace de videollamada')
  console.log('  para una consulta PRESENCIAL. Hay que apagarlo a propósito.')
}

async function main(): Promise<void> {
  for (const v of ENV_REQUERIDAS) {
    if (!process.env[v]) aborta(`falta ${v} en .env.local. Sin eso esto no prueba nada.`)
  }

  const invitado = correoDelInvitado()

  // CONTRA QUÉ PROYECTO SE HABLA. Con un .env.local apuntando a otro sitio, el
  // veredicto sale igual de limpio y no vale nada. El ref es público (sale del
  // host de la URL); la clave de servicio NO se imprime nunca.
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  console.log(`Proyecto Supabase: ${url.hostname.split('.')[0]}  (${url.hostname})`)
  console.log(`Invitado de prueba: ${invitado}`)
  console.log('')

  const conexion = await resolverConexion()
  console.log(`· conexión de clínica resuelta — clinica_id ${conexion.clinica_id}`)

  let calendarId = conexion.calendar_id
  if (!calendarId) {
    // La conexión todavía no tiene calendario propio anotado (el commit 3 es
    // quien la pondrá al día). Se cae a la fuente que usa producción HOY, y
    // filtrada por el dueño de esa misma conexión.
    const admin = createAdminClient()
    const { data } = await admin
      .from('google_tokens')
      .select('calendar_id')
      .eq('user_id', conexion.user_id)
      .maybeSingle()
    calendarId = (data as { calendar_id: string | null } | null)?.calendar_id ?? null
    if (calendarId) console.log('· calendar_id tomado de google_tokens (la conexión aún no lo tiene)')
  }
  if (!calendarId) aborta('la clínica no tiene calendario de Spinus creado. Créalo desde /perfil y repite.')
  console.log(`· calendario: ${calendarId}`)

  const calendar = await abrirCalendar(conexion)
  const { inicio, fin } = ventanaDePrueba()

  let eventId: string | null = null
  try {
    const respuesta = await calendar.events.insert({
      calendarId,
      // Lo que dispara el correo. Sin esto Google crea el asistente y no avisa.
      sendUpdates: 'all',
      // NO se manda `conferenceDataVersion` ni `conferenceData` a propósito: si
      // aparece un Meet en la respuesta, lo puso Google por su cuenta.
      requestBody: {
        summary:     'PRUEBA SPINUS — verificacion de attendees (borrar si sigue aqui)',
        description: 'Evento de prueba de scripts/gcal-attendees-humo.ts. Sin datos de paciente. Se borra solo.',
        start: { dateTime: inicio, timeZone: ZONA },
        end:   { dateTime: fin,    timeZone: ZONA },
        attendees: [{ email: invitado }],
        guestsCanModify:         false,
        guestsCanInviteOthers:   false,
        guestsCanSeeOtherGuests: false,
      },
    })

    const ev = respuesta.data
    eventId = ev.id ?? null

    console.log('')
    console.log('─'.repeat(74))
    console.log(`✔ events.insert respondió ${respuesta.status}`)
    console.log(`  eventId: ${eventId ?? '(sin id)'}`)
    console.log(`  htmlLink: ${ev.htmlLink ?? '(sin enlace)'}`)
    console.log(`  organizer: ${ev.organizer?.email ?? '?'}   status: ${ev.status ?? '?'}`)
    console.log('─'.repeat(74))

    informeAsistentes(ev, invitado)
    informeConferencia(ev)
    console.log('')
    informeInterruptores(ev)

    // La respuesta ENTERA, en UNA sola línea y al final: así el veredicto de
    // arriba se lee sin paginador y aquí no se oculta nada.
    console.log('')
    console.log('─'.repeat(74))
    console.log('Respuesta completa de events.insert (una línea):')
    console.log(JSON.stringify(ev))
  } catch (err) {
    imprimeError('events.insert FALLÓ. Este error ES el resultado del experimento:', err)
    if (eventId) console.log(`  ⚠ Quedó un evento a medias: eventId ${eventId} en ${calendarId}`)
    process.exit(1)
  }

  // ── Limpieza ──────────────────────────────────────────────────────────────
  console.log('')
  if (!eventId) {
    console.log('⚠ Google no devolvió eventId: no hay nada que borrar, o hay que buscarlo a mano.')
    process.exit(0)
  }
  try {
    // `sendUpdates: 'all'` también al borrar: si no, el invitado se queda con
    // un evento fantasma en su calendario y sin aviso de cancelación.
    await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' })
    console.log(`✔ evento de prueba borrado (${eventId}). No queda rastro en el calendario.`)
  } catch (err) {
    imprimeError('el borrado FALLÓ. BÓRRALO A MANO:', err)
    console.log(`  eventId:    ${eventId}`)
    console.log(`  calendarId: ${calendarId}`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err: unknown) => {
  imprimeError('el script reventó antes de terminar:', err)
  process.exit(1)
})
