/**
 * §12.4 — la invitación por correo, verificada contra producción.
 * TERCERA PASADA: por `events.patch`, que es como lo va a hacer el botón.
 *
 *   npx tsx scripts/gcal-attendees-humo.ts medico@ejemplo.com paciente@ejemplo.com
 *
 * SCRIPT DE UNA SOLA EJECUCIÓN. No es código de producción y no lo importa
 * nadie. Si sigue aquí dentro de un mes, sobra.
 *
 * ── UNA SOLA PREGUNTA, Y NO ES NINGUNA DE LAS YA RESPONDIDAS ────────────────
 *
 *   ¿UN `events.patch` QUE AÑADE ASISTENTES A UN EVENTO QUE YA EXISTÍA
 *   DESPACHA LA INVITACIÓN POR CORREO A ESOS ASISTENTES NUEVOS?
 *
 * Las dos pasadas anteriores verificaron `events.insert` con `attendees` y
 * `sendUpdates: 'all'`: la API lo autoriza, el correo llega, los tres
 * interruptores se aplican y Google no añade Meet por su cuenta. Todo eso
 * SIGUE EN PIE y esta pasada NO viene a repetirlo.
 *
 * Lo que viene a cerrar es que **el botón no crea el evento**. El evento nació
 * al agendar la cita, sin un solo asistente (`appointments/route.ts`), y la
 * ruta de la invitación sólo hará `events.get` + `events.patch`. Que el
 * `patch` mande el correo es comportamiento DOCUMENTADO, no comprobado — y de
 * ello depende la función entera: si no lo manda, el botón no sirve para nada
 * y hay que replantear cómo le llega la cita al médico y al paciente.
 *
 * ── POR QUÉ EL EVENTO NACE «PELADO», Y ES DELIBERADO ────────────────────────
 *
 * El `events.insert` del paso 1 va SIN asistentes, SIN `sendUpdates` y SIN los
 * tres interruptores, exactamente como lo hace hoy producción al agendar. No
 * es un descuido de este script: es que TODOS los eventos que ya existen en el
 * calendario de la clínica están así, con los DEFAULTS de Google. Mandar aquí
 * los interruptores en el insert probaría un evento que no se parece a ninguno
 * de los reales, y de paso escondería la mitad interesante del resultado:
 * ¿los aplica el `patch` sobre un evento que nació sin ellos?
 *
 * ── LO QUE NO SE PRUEBA, Y ESTÁ DECIDIDO ────────────────────────────────────
 *
 * El correo malformado. La validación de formato del cliente y del servidor lo
 * filtra antes de llegar a Google, igual que en el envío de documentos. Si aun
 * así Google rechazara el `patch`, falla entero, no entra nadie, y se vuelve a
 * pulsar tras corregir.
 *
 * ── QUÉ ESCRIBE ─────────────────────────────────────────────────────────────
 *
 * Crea UN evento de prueba en el calendario de la clínica, lo parchea y lo
 * BORRA al terminar. Si revienta a medias, imprime el `eventId` para borrarlo
 * a mano. No toca ninguna tabla de Supabase: si el access token estaba
 * caducado se refresca EN MEMORIA y no se persiste, para que un script de usar
 * y tirar no deje escrituras en producción.
 *
 * NO IMPRIME NINGÚN TOKEN, ni truncado.
 *
 * Los correos NO van escritos en este archivo: se pasan por argumento o por
 * `GCAL_PRUEBA_INVITADO` y `GCAL_PRUEBA_PACIENTE`.
 *
 * La salida va en líneas cortas. El volcado crudo de las respuestas sólo sale
 * con `GCAL_PRUEBA_VERBOSE=1`, porque son dos líneas larguísimas y la terminal
 * pasa por paginador.
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

const USO =
  '  npx tsx scripts/gcal-attendees-humo.ts medico@ejemplo.com paciente@ejemplo.com\n' +
  '  (o exporta GCAL_PRUEBA_INVITADO y GCAL_PRUEBA_PACIENTE)'

/**
 * Los DOS correos. Argumento primero, variable de entorno después, igual que
 * antes — sólo que ahora son dos.
 *
 * SE EXIGEN DISTINTOS, y no es quisquillosidad: con el mismo correo dos veces
 * Google deduplica y la respuesta trae UN asistente, o sea la prueba de la
 * primera pasada otra vez. `guestsCanSeeOtherGuests` volvería a no tener nada
 * que ocultar y el veredicto saldría verde sin haber probado nada.
 */
function correosDeLosInvitados(): { medico: string; paciente: string } {
  const medico   = (process.argv[2] ?? process.env.GCAL_PRUEBA_INVITADO ?? '').trim()
  const paciente = (process.argv[3] ?? process.env.GCAL_PRUEBA_PACIENTE ?? '').trim()

  if (!medico || !paciente) {
    aborta(`Faltan los dos correos (el del médico invitado y el del paciente).\n${USO}`)
  }
  for (const valor of [medico, paciente]) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) aborta(`«${valor}» no parece un correo.`)
  }
  if (medico.toLowerCase() === paciente.toLowerCase()) {
    aborta(
      'Los dos correos son el mismo. Google deduplica y quedaría UN asistente:\n' +
      '  eso es la prueba de la primera pasada, no ésta. Usa dos buzones distintos.'
    )
  }
  return { medico, paciente }
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
/** El valor que RIGE: el crudo si vino, y si no el default de ese campo. */
function efectivo(crudo: boolean | null | undefined, pordefecto: boolean): boolean {
  return crudo === null || crudo === undefined ? pordefecto : crudo
}

/** Los tres, con su default al lado. Se lee del evento que se le pase. */
function interruptoresDe(ev: calendar_v3.Schema$Event): {
  campo: string; crudo: boolean | null | undefined; pordefecto: boolean
}[] {
  return [
    { campo: 'guestsCanModify',         crudo: ev.guestsCanModify,         pordefecto: false },
    { campo: 'guestsCanInviteOthers',   crudo: ev.guestsCanInviteOthers,   pordefecto: true  },
    { campo: 'guestsCanSeeOtherGuests', crudo: ev.guestsCanSeeOtherGuests, pordefecto: true  },
  ]
}

/**
 * `etiqueta` porque en esta pasada se imprime DOS veces: el evento tal como
 * nació (con los defaults, que es como están todos los reales) y el evento
 * después del patch. La gracia está en la diferencia entre las dos.
 */
function informeInterruptores(ev: calendar_v3.Schema$Event, etiqueta: string): void {
  console.log(`Los tres interruptores de §12.4 — ${etiqueta}:`)
  for (const c of interruptoresDe(ev)) {
    const efec  = efectivo(c.crudo, c.pordefecto)
    const crudo = c.crudo === undefined ? 'ausente' : String(c.crudo)
    console.log(`  ${efec === false ? '✔' : '✖'} ${c.campo.padEnd(24)} efectivo=${String(efec).padEnd(5)} (crudo: ${crudo}, default ${c.pordefecto})`)
  }
}

/**
 * ¿Con qué asistentes quedó el evento DESPUÉS del patch, y en qué estado?
 *
 * `responseStatus: needsAction` en los dos es la señal que importa: significa
 * que Google los registró como invitados pendientes de responder, o sea con
 * RSVP. Un asistente que entrara ya en otro estado no estaría esperando
 * respuesta de nadie.
 */
function informeAsistentes(
  ev: calendar_v3.Schema$Event,
  invitados: { medico: string; paciente: string },
): void {
  const asistentes = ev.attendees ?? []
  console.log('')
  console.log(`Asistentes tras el patch: ${asistentes.length}  (se pidieron 2)`)
  for (const a of asistentes) {
    const correo = a.email ?? '(sin correo)'
    const quien  = correo.toLowerCase() === invitados.medico.toLowerCase()   ? 'médico'
                 : correo.toLowerCase() === invitados.paciente.toLowerCase() ? 'paciente'
                 : '¿?'
    console.log(`  · ${correo}`)
    console.log(`      quién=${quien}  responseStatus=${a.responseStatus ?? '?'}  organizer=${a.organizer === true}`)
  }

  const esta = (correo: string) => asistentes.some((a) => (a.email ?? '').toLowerCase() === correo.toLowerCase())
  const losDos = esta(invitados.medico) && esta(invitados.paciente)
  console.log(losDos
    ? '✔ El patch metió a LOS DOS asistentes en un evento que nació sin ninguno.'
    : '✖ Falta alguno tras el patch: Google lo descartó en silencio.')
  if (!losDos) {
    console.log(`      médico presente:   ${esta(invitados.medico)}`)
    console.log(`      paciente presente: ${esta(invitados.paciente)}`)
  }
  console.log('  Que el correo SALIERA no se comprueba desde aquí: mira los buzones.')
}

/**
 * Visibilidad entre invitados, ahora sobre un evento que NACIÓ CON EL
 * INTERRUPTOR EN `true` (el default) y al que el patch se lo apagó. En las
 * pasadas anteriores el evento ya nacía con él en `false`, así que esto no es
 * repetir: es comprobar que el patch lo cambia de verdad.
 *
 * ⚠ LA TRAMPA, otra vez, porque es donde se lee mal: `guestsCanSeeOtherGuests`
 * vale `true` POR DEFECTO, así que un campo AUSENTE en la respuesta NO significa
 * «aplicado» — significa que Google lo ignoró y los invitados SÍ se ven. Es al
 * revés que en `guestsCanModify`, cuyo default es `false`. Hay que mirar el
 * valor crudo, nunca si el campo está.
 */
function informeVisibilidadEntreInvitados(ev: calendar_v3.Schema$Event): void {
  const crudo   = ev.guestsCanSeeOtherGuests
  const cuantos = (ev.attendees ?? []).length
  const efec    = efectivo(crudo, true)
  const oculta  = efec === false

  console.log('')
  console.log(`Visibilidad entre invitados, con ${cuantos} en la lista:`)
  console.log(`  guestsCanSeeOtherGuests crudo: ${crudo === undefined ? 'AUSENTE' : String(crudo)}`)
  console.log(`  efectivo (default true):       ${String(efec)}`)

  if (cuantos < 2) {
    console.log('  ⚠ Hay menos de dos asistentes: esto NO queda probado.')
    console.log('    Con uno solo el interruptor no tiene nada que ocultar.')
    return
  }
  if (oculta) {
    console.log('  ✔ Google guardó el evento con la lista de invitados OCULTA.')
    return
  }
  console.log('  ✖ LOS INVITADOS SE VEN ENTRE SÍ.')
  console.log('    El correo personal del médico llegaría al paciente, y el del')
  console.log('    paciente al médico. §12.4 se queda sin suelo en su punto 3 y hay')
  console.log('    que replantear cómo le llega la cita al médico invitado.')
}

/** El valor efectivo de los tres, en un renglón corto y comparable. */
function resumenInterruptores(ev: calendar_v3.Schema$Event): string {
  return interruptoresDe(ev)
    .map((c) => `${c.campo.replace('guestsCan', '')}=${efectivo(c.crudo, c.pordefecto)}`)
    .join('  ')
}

/**
 * ANTES contra DESPUÉS, que es la comparación de esta pasada.
 *
 * La de las pasadas anteriores era contra la ejecución previa; aquí lo que hay
 * que ver es qué le hizo el PATCH a un evento que ya existía. Se imprime el
 * mismo puñado de campos en los dos momentos para que un cambio inesperado
 * —o la ausencia de un cambio esperado— salte a la vista sin leer el JSON.
 *
 * `creator` y `organizer` se imprimen para mirarlos, no se juzgan: son
 * identidades de la cuenta. `creator` es el correo personal de quien
 * administra, y ahora también viaja al buzón del paciente (§9 y §12.4).
 */
function informeAntesYDespues(
  antes: calendar_v3.Schema$Event,
  despues: calendar_v3.Schema$Event,
): void {
  const cuenta = (ev: calendar_v3.Schema$Event) => (ev.attendees ?? []).length
  const meet   = (ev: calendar_v3.Schema$Event) =>
    ev.conferenceData || ev.hangoutLink ? 'PRESENTE' : 'ausente'

  const filas: { que: string; antes: string; despues: string }[] = [
    { que: 'asistentes',   antes: String(cuenta(antes)),        despues: String(cuenta(despues)) },
    { que: 'interruptores', antes: resumenInterruptores(antes), despues: resumenInterruptores(despues) },
    { que: 'Meet',         antes: meet(antes),                  despues: meet(despues) },
    { que: 'organizer',    antes: antes.organizer?.email ?? '?', despues: despues.organizer?.email ?? '?' },
    { que: 'creator',      antes: antes.creator?.email ?? '?',   despues: despues.creator?.email ?? '?' },
    { que: 'etag',         antes: antes.etag ?? '?',             despues: despues.etag ?? '?' },
  ]

  console.log('')
  console.log('Antes del patch (events.get) contra después:')
  for (const f of filas) {
    console.log(`  ${f.que}`)
    console.log(`      antes:   ${f.antes}`)
    console.log(`      después: ${f.despues}`)
  }
}

/**
 * ¿Metió Google un Meet sin que nadie se lo pidiera? Se vuelve a mirar porque
 * es gratis y porque el disparador podría ser el patch y no el insert: en las
 * pasadas anteriores el evento nacía ya con asistentes, y aquí los gana
 * después. Un Meet en una consulta PRESENCIAL habría que apagarlo a propósito.
 */
function informeConferencia(ev: calendar_v3.Schema$Event): void {
  const tieneConf = ev.conferenceData !== undefined && ev.conferenceData !== null
  const tieneLink = typeof ev.hangoutLink === 'string' && ev.hangoutLink.length > 0
  console.log('')
  if (!tieneConf && !tieneLink) {
    console.log('✔ Sin conferenceData y sin hangoutLink: el patch no añade Meet solo.')
    return
  }
  console.log('✖ GOOGLE AÑADIÓ VIDEOLLAMADA SIN QUE SE LE PIDIERA.')
  console.log(`  hangoutLink presente:   ${tieneLink}`)
  console.log(`  conferenceData presente: ${tieneConf}`)
  if (tieneConf) console.log(`  conferenceSolution: ${ev.conferenceData?.conferenceSolution?.name ?? '(sin nombre)'}`)
  console.log('  Consecuencia: cada médico invitado recibiría un enlace de videollamada')
  console.log('  para una consulta PRESENCIAL. Hay que apagarlo a propósito.')
}

/** Qué se viene a responder. Va arriba del todo para que nadie lea otra cosa. */
function cabeceraDelExperimento(): void {
  console.log('─'.repeat(74))
  console.log('TERCERA PASADA — UNA SOLA PREGUNTA:')
  console.log('')
  console.log('  ¿Un events.patch que AÑADE asistentes a un evento que YA EXISTÍA')
  console.log('  les despacha la invitación por correo?')
  console.log('')
  console.log('NO se viene a repetir lo ya verificado (que el insert con attendees')
  console.log('invita, que los tres interruptores se aplican, que no hay Meet). Eso')
  console.log('está en verde y sigue en pie.')
  console.log('')
  console.log('Se prueba el patch porque el botón NO crea el evento: el evento nace')
  console.log('al agendar la cita, sin asistentes, y la ruta sólo hace get + patch.')
  console.log('Si el patch no manda correo, el botón no sirve para nada.')
  console.log('─'.repeat(74))
  console.log('')
}

/** Qué contestó la mitad que sí se ve desde la API, y qué queda por ver. */
function laPregunta(patchOk: boolean): void {
  console.log('')
  console.log('─'.repeat(74))
  console.log('LA PREGUNTA DE ESTA PASADA:')
  console.log('  ¿el patch que añade asistentes despacha la invitación?')
  console.log('')
  if (!patchOk) {
    console.log('✖ EL PATCH NI SIQUIERA PASÓ. Lee el error de arriba: si Google')
    console.log('  rechaza el patch, no hay invitación que despachar y §12.4 se')
    console.log('  queda sin suelo por esta vía. Los buzones deberían estar vacíos.')
    console.log('─'.repeat(74))
    return
  }
  console.log('· La API contestó la MITAD: 200, y los asistentes quedaron guardados.')
  console.log('· La otra mitad —si el correo SALIÓ— la API no la dice nunca.')
  console.log('  Un 200 es idéntico se despache el correo o no.')
  console.log('─'.repeat(74))
}

/**
 * LO QUE ESTE SCRIPT NO PUEDE COMPROBAR, Y ES LA PREGUNTA ENTERA.
 *
 * Un 200 del patch dice que Google GUARDÓ a los asistentes. NO dice que haya
 * mandado nada: la respuesta es idéntica se despache el correo o no. Si el
 * patch guardara los asistentes sin avisarles, todo lo de arriba saldría en
 * verde y el botón no serviría para nada.
 *
 * Y hay una segunda cosa que sólo se ve en el buzón: QUÉ CLASE de correo llega.
 * Una invitación con RSVP —los botones de Sí / No / Quizá— es lo que hace falta
 * y es lo que le mete la cita en su calendario. Un aviso de «evento
 * actualizado», sin RSVP, sería el patch notificando un cambio y no invitando:
 * técnicamente llegó un correo, y la función seguiría sin suelo.
 */
function instruccionesParaLosBuzones(invitados: { medico: string; paciente: string }): void {
  console.log('')
  console.log('─'.repeat(74))
  console.log('LA RESPUESTA ESTÁ EN LOS BUZONES, NO ARRIBA. ÁBRELOS LOS DOS:')
  console.log('')
  console.log(`  1. ${invitados.medico}`)
  console.log(`  2. ${invitados.paciente}`)
  console.log('')
  console.log('PREGUNTA 1 — ¿llegó algo?')
  console.log('  ✔ BIEN si en los dos buzones hay un correo del evento de prueba.')
  console.log('  ✖ MAL si no llega nada: el patch guarda asistentes y NO avisa,')
  console.log('    y entonces el botón de invitación no sirve. Hay que replantear')
  console.log('    cómo le llega la cita al médico y al paciente.')
  console.log('')
  console.log('PREGUNTA 2 — ¿qué clase de correo es?')
  console.log('  ✔ BIEN si es una INVITACIÓN con RSVP: botones de Sí / No / Quizá.')
  console.log('  ✖ MAL si es un aviso de «evento actualizado» SIN RSVP: eso es')
  console.log('    notificar un cambio, no invitar, y no les mete la cita.')
  console.log('')
  console.log('PREGUNTA 3 — el bloque «Invitados» de cada correo.')
  console.log('  ✔ BIEN si dice que la lista se ocultó a petición del organizador,')
  console.log('    o si no aparece ningún otro correo además del propio.')
  console.log('  ✖ MAL si en el correo del médico sale el del paciente, o al revés.')
  console.log('')
  console.log('OJO AL BORRAR: el evento se borra solo al terminar, así que en el')
  console.log('calendario no vas a encontrar nada. El correo SÍ sigue en la')
  console.log('bandeja: es ése el que hay que abrir, no el calendario. Y junto a')
  console.log('él va a haber otro de cancelación, del borrado — no lo confundas')
  console.log('con la invitación.')
  console.log('─'.repeat(74))
}

/**
 * El calendario de la clínica. Sale de la conexión y, si ésta todavía no lo
 * tiene anotado, del legado `google_tokens` filtrado por el DUEÑO de esa misma
 * conexión. Aborta si no hay ninguno: sin calendario no hay evento que crear.
 */
async function resolverCalendarId(conexion: FilaConexion): Promise<string> {
  if (conexion.calendar_id) return conexion.calendar_id

  const admin = createAdminClient()
  const { data } = await admin
    .from('google_tokens')
    .select('calendar_id')
    .eq('user_id', conexion.user_id)
    .maybeSingle()
  const legado = (data as { calendar_id: string | null } | null)?.calendar_id ?? null
  if (legado) {
    console.log('· calendar_id tomado de google_tokens (la conexión aún no lo tiene)')
    return legado
  }
  aborta('la clínica no tiene calendario de Spinus creado. Créalo desde /perfil y repite.')
}

/** Volcado crudo, sólo con `GCAL_PRUEBA_VERBOSE=1`: son líneas larguísimas. */
function volcado(etiqueta: string, ev: calendar_v3.Schema$Event): void {
  if (process.env.GCAL_PRUEBA_VERBOSE !== '1') return
  console.log('')
  console.log(`${etiqueta} (una línea):`)
  console.log(JSON.stringify(ev))
}

/**
 * PASO 1 — el evento nace COMO LOS DE VERDAD.
 *
 * Sin `attendees`, sin `sendUpdates` y sin los tres interruptores, calcado de
 * lo que hace hoy `appointments/route.ts` al agendar una cita. Ése es el
 * estado real de todos los eventos que el botón se va a encontrar, y probar
 * sobre un evento nacido de otra manera no probaría nada de lo que interesa.
 */
async function crearEventoPelado(
  calendar: calendar_v3.Calendar,
  calendarId: string,
): Promise<{ ev: calendar_v3.Schema$Event; status: number }> {
  const { inicio, fin } = ventanaDePrueba()
  const respuesta = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary:     'PRUEBA SPINUS — invitacion por patch (borrar si sigue aqui)',
      description: 'Evento de prueba de scripts/gcal-attendees-humo.ts. Sin datos de paciente. Se borra solo.',
      start: { dateTime: inicio, timeZone: ZONA },
      end:   { dateTime: fin,    timeZone: ZONA },
    },
  })
  return { ev: respuesta.data, status: respuesta.status }
}

/**
 * PASO 3 — EL EXPERIMENTO. Añade a los DOS de una vez sobre el evento que ya
 * existe, que es exactamente lo que hará la ruta del botón.
 *
 * `sendUpdates: 'all'` es lo único que puede despachar el correo, y de que lo
 * haga o no depende la función entera. Los tres interruptores van aquí porque
 * el evento nació sin ellos: si el patch no los aplicara, los dos invitados se
 * verían el correo el uno al otro.
 *
 * ⚠ `attendees` es un array, y en las semánticas de patch de Google un array
 * que se manda REEMPLAZA al que había. Aquí da igual —no había ninguno— pero
 * en la ruta real hay que leer los existentes y mezclar, nunca mandar sólo al
 * que se está invitando.
 */
async function parchearConLosDos(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string,
  invitados: { medico: string; paciente: string },
): Promise<{ ev: calendar_v3.Schema$Event; status: number }> {
  const respuesta = await calendar.events.patch({
    calendarId,
    eventId,
    sendUpdates: 'all',
    requestBody: {
      attendees: [
        { email: invitados.medico },
        { email: invitados.paciente },
      ],
      guestsCanModify:         false,
      guestsCanInviteOthers:   false,
      guestsCanSeeOtherGuests: false,
    },
  })
  return { ev: respuesta.data, status: respuesta.status }
}

async function main(): Promise<void> {
  for (const v of ENV_REQUERIDAS) {
    if (!process.env[v]) aborta(`falta ${v} en .env.local. Sin eso esto no prueba nada.`)
  }

  const invitados = correosDeLosInvitados()
  cabeceraDelExperimento()

  // CONTRA QUÉ PROYECTO SE HABLA. Con un .env.local apuntando a otro sitio, el
  // veredicto sale igual de limpio y no vale nada. El ref es público (sale del
  // host de la URL); la clave de servicio NO se imprime nunca.
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  console.log(`Proyecto Supabase: ${url.hostname.split('.')[0]}  (${url.hostname})`)
  console.log(`Invitado 1 (médico):   ${invitados.medico}`)
  console.log(`Invitado 2 (paciente): ${invitados.paciente}`)
  console.log('')

  const conexion = await resolverConexion()
  console.log(`· conexión de clínica resuelta — clinica_id ${conexion.clinica_id}`)

  const calendarId = await resolverCalendarId(conexion)
  console.log(`· calendario: ${calendarId}`)

  const calendar = await abrirCalendar(conexion)

  // ── PASO 1: el evento, pelado ─────────────────────────────────────────────
  let eventId: string | null = null
  try {
    const { ev, status } = await crearEventoPelado(calendar, calendarId)
    eventId = ev.id ?? null
    console.log('')
    console.log(`· PASO 1 — events.insert SIN asistentes respondió ${status}`)
    console.log(`  eventId:  ${eventId ?? '(sin id)'}`)
    console.log(`  asistentes al nacer: ${(ev.attendees ?? []).length}  (deben ser 0)`)
  } catch (err) {
    imprimeError('el events.insert de partida FALLÓ. No hay experimento que hacer:', err)
    process.exit(1)
  }
  if (!eventId) {
    aborta('Google no devolvió eventId en el insert. Sin él no se puede parchear.')
  }

  // A partir de aquí HAY UN EVENTO VIVO en el calendario de la clínica: pase lo
  // que pase, el borrado del final tiene que ejecutarse. Por eso el fallo del
  // patch NO sale por `process.exit` aquí dentro.
  let patchOk = false
  try {
    // ── PASO 2: cómo está antes ─────────────────────────────────────────────
    const antesResp = await calendar.events.get({ calendarId, eventId })
    const antes = antesResp.data
    console.log(`· PASO 2 — events.get respondió ${antesResp.status}`)
    console.log('')
    informeInterruptores(antes, 'ANTES del patch, tal como nació')
    console.log('  (así están HOY todos los eventos reales del calendario)')

    // ── PASO 3: el experimento ──────────────────────────────────────────────
    const { ev, status } = await parchearConLosDos(calendar, calendarId, eventId, invitados)
    patchOk = status === 200

    console.log('')
    console.log('─'.repeat(74))
    console.log(`${patchOk ? '✔' : '✖'} PASO 3 — events.patch respondió ${status}`)
    console.log(`  htmlLink:  ${ev.htmlLink ?? '(sin enlace)'}`)
    console.log(`  organizer: ${ev.organizer?.email ?? '?'}   status: ${ev.status ?? '?'}`)
    console.log('─'.repeat(74))

    informeAsistentes(ev, invitados)
    informeVisibilidadEntreInvitados(ev)
    informeConferencia(ev)
    console.log('')
    informeInterruptores(ev, 'DESPUÉS del patch')
    informeAntesYDespues(antes, ev)

    volcado('Respuesta completa de events.get', antes)
    volcado('Respuesta completa de events.patch', ev)
    if (process.env.GCAL_PRUEBA_VERBOSE !== '1') {
      console.log('')
      console.log('(Las respuestas crudas, con GCAL_PRUEBA_VERBOSE=1)')
    }
  } catch (err) {
    imprimeError('el get o el patch FALLARON. Este error ES el resultado:', err)
    console.log('  El evento se borra igual, más abajo.')
  }

  // ── Limpieza ──────────────────────────────────────────────────────────────
  console.log('')
  let borrado = false
  try {
    // `sendUpdates: 'all'` también al borrar: si no, el invitado se queda con
    // un evento fantasma en su calendario y sin aviso de cancelación.
    await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' })
    borrado = true
    console.log(`✔ evento de prueba borrado (${eventId}). No queda rastro en el calendario.`)
  } catch (err) {
    imprimeError('el borrado FALLÓ. BÓRRALO A MANO:', err)
    console.log(`  eventId:    ${eventId}`)
    console.log(`  calendarId: ${calendarId}`)
  }

  // Va al final del todo, a propósito: es lo último que queda en pantalla y es
  // la mitad del experimento que no sale de la API. Se imprime aunque el patch
  // haya fallado —ahí lo que se comprueba es que NO llegó nada— y aunque el
  // borrado haya fallado: el correo ya salió y es lo que se venía a mirar.
  laPregunta(patchOk)
  instruccionesParaLosBuzones(invitados)
  process.exit(borrado && patchOk ? 0 : 1)
}

main().catch((err: unknown) => {
  imprimeError('el script reventó antes de terminar:', err)
  process.exit(1)
})
