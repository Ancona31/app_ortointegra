/**
 * ⚠️⚠️ ESTE SCRIPT NO SE EJECUTÓ NUNCA, Y NO ES TRABAJO A MEDIAS.
 *
 * La pregunta que venía a responder quedó SIN OBJETO el 2026-08-21, antes de
 * correrlo ni una vez. Se conserva por el trabajo de investigación que lleva
 * dentro —dónde vive el ajuste, y la vía manual del final— y para que nadie
 * vuelva a plantear la idea creyéndola inexplorada.
 *
 *   npx tsx scripts/gcal-notificaciones-humo.ts   ← NO HACE FALTA CORRERLO
 *
 * ── QUÉ VENÍA A PREGUNTAR ───────────────────────────────────────────────────
 *
 * Si `calendar.app.created` autoriza a leer y escribir
 * `calendarList.notificationSettings` del calendario de la clínica, para
 * encender por API los avisos por correo de «evento creado», «evento
 * modificado» y «evento cancelado» que Google manda al dueño de un calendario.
 *
 * El hueco que eso pretendía tapar: cuando el médico asignado a una cita ES el
 * dueño de la cuenta de Google conectada, invitarlo no le manda ningún correo,
 * porque Google no notifica al organizador de su propio evento.
 *
 * ── POR QUÉ YA NO HAY NADA QUE PREGUNTAR — DOS MOTIVOS INDEPENDIENTES ───────
 *
 * 1. **EL HUECO NO EXISTÍA.** La invitación al médico propietario SÍ funciona.
 *    No le llega correo, pero **el evento SÍ entra en su calendario personal**,
 *    que es exactamente lo que se quería: con el calendario de la clínica
 *    apagado, cada médico ve sólo SUS citas y no las de los demás. O sea que
 *    esta vía resuelve por sí sola lo que §12.9 daba por inalcanzable sin el
 *    scope sensible `calendar.acls`.
 *
 *    Un correo por evento sería avisar a alguien de algo que ya tiene delante,
 *    en su propio calendario. No es cubrir un hueco: es ruido.
 *
 * 2. **EL PRECIO DEL PLAN B ERA LA ARQUITECTURA ENTERA.** Si la prueba hubiera
 *    salido en rojo —y era el desenlace probable, porque `calendarList` es la
 *    lista de suscripciones de la CUENTA y no un calendario—, hacerlo por API
 *    habría exigido `calendar.calendarlist` o `calendar` a secas. Los dos son
 *    **scopes SENSIBLES**: reabren la verificación de la app y activan el tope
 *    de 100 usuarios que hoy no aplica, un contador que **no se puede
 *    restablecer nunca** (§12.11 del plan). Toda esta rama se sostiene sobre no
 *    pedir un solo scope sensible.
 *
 *    Así que el resultado verde sólo habría servido para una comodidad menor, y
 *    el rojo llevaba a un callejón que no se iba a tomar. Una prueba cuyos dos
 *    desenlaces terminan en «no se hace» no hay que correrla.
 *
 * ── LO QUE SÍ QUEDÓ AVERIGUADO, Y NO HIZO FALTA LA API ──────────────────────
 *
 * **El ajuste vive en `calendarList`, NO en `calendars`.** Comprobado en los
 * tipos instalados (`node_modules/googleapis/build/src/apis/calendar/v3.d.ts`):
 * `Schema$CalendarListEntry` tiene `notificationSettings.notifications`, y
 * `Schema$Calendar` no tiene nada parecido — sus campos son `id`, `summary`,
 * `description`, `location`, `timeZone`, `etag`, `kind`,
 * `conferenceProperties`, `autoAcceptInvitations` y `dataOwner`.
 *
 * La documentación del propio tipo lo dice con todas las letras: «The
 * notifications that THE AUTHENTICATED USER is receiving for this calendar». Es
 * una preferencia de SUSCRIPCIÓN de cada cuenta sobre un calendario, no una
 * propiedad del calendario compartida por todos. Dos personas suscritas al
 * mismo calendario tienen cada una la suya, y por eso encenderlo desde Spinus
 * nunca habría servido para nadie más que para la cuenta conectada.
 *
 * Los cinco tipos que admite son `eventCreation`, `eventChange`,
 * `eventCancellation`, `eventResponse` y `agenda`.
 *
 * ── LA VÍA MANUAL SIGUE SIRVIENDO, PARA OTRA COSA ───────────────────────────
 *
 * `alternativaManual()`, al final de este archivo, documenta dónde se encienden
 * a mano. Ya NO es el plan B de nada: es por si un médico quisiera esos avisos
 * **para su propia cuenta**, por gusto. Es un ajuste suyo, en su Google, y
 * Spinus no tiene nada que ver.
 *
 * ── SI ALGUIEN DECIDIERA CORRERLO IGUAL ─────────────────────────────────────
 *
 * Funciona y está probado por el compilador, pero **toca una preferencia real
 * de una cuenta real**: no crea un evento desechable, modifica un ajuste que ya
 * existe. Guarda el estado previo antes de tocar nada y lo restaura al terminar;
 * si la restauración falla, imprime a qué estado hay que volver y sale con 1.
 *
 * No toca ninguna tabla de Supabase. Si el access token estaba caducado se
 * refresca EN MEMORIA y no se persiste. NO IMPRIME NINGÚN TOKEN, ni truncado,
 * ni la dirección de correo de la cuenta.
 *
 * La salida va en líneas cortas. El volcado crudo sólo con
 * `GCAL_PRUEBA_VERBOSE=1`. Con más de una clínica conectada,
 * `GCAL_PRUEBA_CLINICA_ID=<uuid>`.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { google, type calendar_v3 } from 'googleapis'

config({ path: resolve(process.cwd(), '.env.local') })

// Imports RELATIVOS y sin alias `@/`, igual que en `gcal-attendees-humo.ts`:
// bajo `tsx` la resolución de `paths` es una variable más que puede fallar.
import { createAdminClient } from '../src/lib/supabase/admin'
import { decrypt } from '../src/lib/encrypt'

const ENV_REQUERIDAS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_TOKEN_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const

/**
 * Las tres que se piden, y por qué son tres y no cinco.
 *
 * `Schema$CalendarNotification` admite cinco tipos: los tres de aquí más
 * `eventResponse` (alguien contesta a la invitación) y `agenda` (el resumen
 * matutino). Los dos que faltan se dejan fuera A PROPÓSITO:
 *
 *  · `eventResponse` sería un correo por cada paciente que acepta o rechaza, y
 *    §12.4 ya decidió que la respuesta del invitado NO vuelve a Spinus. Meterla
 *    por el buzón es la misma idea entrando por otra puerta, y ruidosa.
 *  · `agenda` es un resumen diario, no constancia de una cita concreta, que es
 *    lo que este hueco necesita.
 *
 * Si la prueba sale en verde y luego se decide otra combinación, cambiar esta
 * constante es todo lo que hay que tocar.
 */
const NOTIFICACIONES_PEDIDAS: calendar_v3.Schema$CalendarNotification[] = [
  { method: 'email', type: 'eventCreation' },
  { method: 'email', type: 'eventChange' },
  { method: 'email', type: 'eventCancellation' },
]

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
 * Vuelca el error ENTERO. Aquí un fallo vale tanto como un éxito, y no todos
 * los fallos dicen lo mismo: un 403 `insufficientPermissions` significa que el
 * scope no llega, y un 404 que el recurso no existe para esta cuenta. Los dos
 * cierran la pregunta en direcciones distintas, así que no se resume nada.
 */
function imprimeError(etiqueta: string, err: unknown): void {
  console.log('')
  console.log(`✖ ${etiqueta}`)
  console.log(`  ${err instanceof Error ? err.message : String(err)}`)
  const o = err as { code?: unknown; response?: { status?: unknown; data?: unknown } }
  if (o?.code !== undefined)             console.log(`  code:   ${String(o.code)}`)
  if (o?.response?.status !== undefined) console.log(`  status: ${String(o.response.status)}`)
  if (o?.response?.data !== undefined) {
    console.log('  cuerpo de la respuesta de Google, completo:')
    console.log(JSON.stringify(o.response.data, null, 2))
  }
}

/** El `reason` de Google, que es lo que de verdad distingue un 403 de otro. */
function razonDe(err: unknown): string {
  const datos = (err as { response?: { data?: unknown } })?.response?.data
  const errores = (datos as { error?: { errors?: { reason?: string }[] } })?.error?.errors
  return errores?.[0]?.reason ?? 'sin reason'
}

function estado(err: unknown): number | null {
  const o = err as { code?: unknown; response?: { status?: unknown } }
  if (typeof o?.code === 'number') return o.code
  if (typeof o?.response?.status === 'number') return o.response.status
  return null
}

/**
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
 * `abrirSesionGoogle` (src/lib/gcal.ts): mismo `OAuth2`, mismas variables,
 * mismos tokens descifrados con el mismo `decrypt`. Ese parecido ES la prueba.
 *
 * Única diferencia deliberada: si toca refrescar, el token nuevo se queda en
 * memoria y NO se persiste.
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

/** Las notificaciones de una entrada, en una línea por notificación. */
function informeNotificaciones(
  entrada: calendar_v3.Schema$CalendarListEntry | null,
  etiqueta: string,
): void {
  console.log('')
  console.log(`${etiqueta}:`)
  if (entrada === null) {
    console.log('  (no se pudo leer)')
    return
  }
  const lista = entrada.notificationSettings?.notifications ?? []
  if (lista.length === 0) {
    /* ⚠️ AUSENTE Y VACÍO NO SON LO MISMO, y aquí conviene no confundirlos: si
       `notificationSettings` no viene, Google no está diciendo «ninguna», está
       diciendo que no mandó el campo. Se distingue por escrito. */
    const hayObjeto = entrada.notificationSettings !== undefined
    console.log(hayObjeto
      ? '  notificationSettings presente, con la lista VACÍA'
      : '  sin `notificationSettings` en la respuesta')
    return
  }
  for (const n of lista) {
    console.log(`  ${n.method ?? '?'} · ${n.type ?? '?'}`)
  }
}

/** Volcado crudo, sólo con `GCAL_PRUEBA_VERBOSE=1`: son líneas larguísimas. */
function volcado(etiqueta: string, valor: unknown): void {
  if (process.env.GCAL_PRUEBA_VERBOSE !== '1') return
  console.log('')
  console.log(`${etiqueta} (una línea):`)
  console.log(JSON.stringify(valor))
}

function cabecera(): void {
  console.log('')
  console.log('══════════════════════════════════════════════════')
  console.log(' NOTIFICACIONES DEL CALENDARIO — prueba de humo')
  console.log('══════════════════════════════════════════════════')
  console.log('')
  console.log('La pregunta:')
  console.log('  ¿`calendar.app.created` autoriza LEER y ESCRIBIR')
  console.log('  `calendarList.notificationSettings` del calendario')
  console.log('  de Spinus?')
  console.log('')
  console.log('Dónde vive el ajuste ya está respondido sin API:')
  console.log('  en `calendarList`, NO en `calendars`. Es una')
  console.log('  preferencia de suscripción de CADA cuenta.')
  console.log('')
  console.log('Se pide activar, por correo:')
  for (const n of NOTIFICACIONES_PEDIDAS) console.log(`  ${n.method} · ${n.type}`)
  console.log('')
}

/**
 * Dónde se encienden a mano.
 *
 * ⚠️ YA NO ES LA SALIDA SI LA API NO LO AUTORIZA — eso era cuando esto tapaba un
 * hueco, y el hueco no existía (ver la cabecera). Se conserva porque sigue
 * sirviendo para otra cosa: que un médico se ponga estos avisos **en su propia
 * cuenta** si le apetece. Es un ajuste suyo, en su Google, y Spinus no participa.
 *
 * Se imprime siempre, salga la prueba como salga, si es que alguien la corre.
 */
function alternativaManual(calendarId: string): void {
  console.log('')
  console.log('──────────────────────────────────────────────────')
  console.log(' LA VÍA MANUAL (una vez por clínica, sin código)')
  console.log('──────────────────────────────────────────────────')
  console.log('')
  console.log('La hace quien administra, con la cuenta de Google')
  console.log('de la clínica ya iniciada:')
  console.log('')
  console.log('  1. calendar.google.com, en navegador de escritorio.')
  console.log('     Desde el móvil NO se llega a este ajuste.')
  console.log('  2. Barra lateral izquierda, «Mis calendarios».')
  console.log('     Localizar el calendario de Spinus.')
  console.log('  3. Pasar el ratón por encima, botón de los tres')
  console.log('     puntos, «Configuración y uso compartido».')
  console.log('  4. Bajar hasta «Notificaciones generales».')
  console.log('  5. Poner en «Correo electrónico» las tres:')
  console.log('       · Nuevos eventos')
  console.log('       · Eventos modificados')
  console.log('       · Eventos cancelados')
  console.log('     Se guardan solas, no hay botón de guardar.')
  console.log('')
  console.log('  Ojo: «Notificaciones generales» es la sección de')
  console.log('  abajo, distinta de «Notificaciones de eventos»,')
  console.log('  que es la de los recordatorios previos a la cita.')
  console.log('  Esa segunda no sirve para esto.')
  console.log('')
  console.log(`  Calendario sobre el que hay que hacerlo:`)
  console.log(`    ${calendarId}`)
  console.log('')
  console.log('  Es por CUENTA y por CALENDARIO: si mañana otra')
  console.log('  persona se suscribe al mismo calendario, sus')
  console.log('  notificaciones son cosa suya y empiezan de cero.')
}

function veredicto(lectura: boolean, escritura: boolean | null): void {
  console.log('')
  console.log('──────────────────────────────────────────────────')
  console.log(' VEREDICTO')
  console.log('──────────────────────────────────────────────────')
  console.log('')
  if (!lectura) {
    console.log('✖ El scope NO alcanza `calendarList`: falla ya la')
    console.log('  LECTURA. No se intentó escribir.')
    console.log('')
    console.log('  Encender esto por API exigiría un scope más')
    console.log('  (`calendar.calendarlist` o `calendar` a secas),')
    console.log('  y los dos son SENSIBLES: activarían el tope de')
    console.log('  100 usuarios que hoy no aplica, y ese contador')
    console.log('  no se puede restablecer nunca. La vía es manual.')
    return
  }
  if (escritura === true) {
    console.log('✔ Los dos: se puede LEER y ESCRIBIR.')
    console.log('  Encenderlo al conectar es posible sin scopes')
    console.log('  nuevos. Queda por DECIDIR si se hace; esto sólo')
    console.log('  comprueba que se puede.')
    console.log('')
    console.log('  El estado previo se restauró: ver arriba.')
    return
  }
  console.log('◑ LECTURA sí, ESCRITURA no.')
  console.log('  La app puede COMPROBAR si están encendidas —y')
  console.log('  avisar a quien administra si no lo están— pero no')
  console.log('  encenderlas. El ajuste es manual.')
}

async function main(): Promise<void> {
  const faltan = ENV_REQUERIDAS.filter(k => !process.env[k])
  if (faltan.length > 0) aborta(`faltan variables de entorno: ${faltan.join(', ')}`)

  cabecera()

  const conexion   = await resolverConexion()
  const calendar   = await abrirCalendar(conexion)
  const calendarId = await resolverCalendarId(conexion)

  console.log(`· clinica_id:  ${conexion.clinica_id}`)
  console.log(`· calendarId:  ${calendarId}`)

  // ── Paso 1: LEER. Es el estado ANTES y es media pregunta. ────────────────
  let antes: calendar_v3.Schema$CalendarListEntry | null = null
  try {
    const res = await calendar.calendarList.get({ calendarId })
    antes = res.data
    console.log('')
    console.log('✔ calendarList.get → 200')
    volcado('respuesta del get', res.data)
  } catch (err) {
    imprimeError('calendarList.get FALLÓ', err)
    console.log('')
    console.log(`  status: ${String(estado(err))} · reason: ${razonDe(err)}`)
    veredicto(false, null)
    alternativaManual(calendarId)
    process.exit(1)
  }

  informeNotificaciones(antes, 'ESTADO ANTES (lo que Google trae de fábrica)')

  /* Se guarda AHORA, antes de tocar nada, y se guarda una copia profunda: la
     respuesta del patch reutiliza objetos y una referencia compartida haría
     que «lo de antes» cambiara solo. */
  const previas: calendar_v3.Schema$CalendarNotification[] =
    JSON.parse(JSON.stringify(antes?.notificationSettings?.notifications ?? []))

  // ── Paso 2: ESCRIBIR. La pregunta de verdad. ─────────────────────────────
  let despues: calendar_v3.Schema$CalendarListEntry | null = null
  let escrituraOk = false
  try {
    const res = await calendar.calendarList.patch({
      calendarId,
      requestBody: { notificationSettings: { notifications: NOTIFICACIONES_PEDIDAS } },
    })
    despues = res.data
    escrituraOk = true
    console.log('')
    console.log('✔ calendarList.patch → 200')
    volcado('respuesta del patch', res.data)
  } catch (err) {
    imprimeError('calendarList.patch FALLÓ', err)
    console.log('')
    console.log(`  status: ${String(estado(err))} · reason: ${razonDe(err)}`)
    console.log('')
    console.log('  Nada que restaurar: el patch no llegó a aplicarse.')
  }

  if (escrituraOk) {
    informeNotificaciones(despues, 'ESTADO DESPUÉS (con lo que quedó configurado)')

    /* ⚠️ NO BASTA CON EL 200 DEL PATCH. Google puede aceptar la petición y
       quedarse con menos de lo pedido; lo que cuenta es lo que devuelve. */
    const quedaron = new Set((despues?.notificationSettings?.notifications ?? []).map(n => `${n.method}:${n.type}`))
    const faltantes = NOTIFICACIONES_PEDIDAS.filter(n => !quedaron.has(`${n.method}:${n.type}`))
    if (faltantes.length > 0) {
      console.log('')
      console.log('⚠ El patch respondió 200 pero NO quedaron todas:')
      for (const n of faltantes) console.log(`  falta ${n.method} · ${n.type}`)
    }

    // ── Paso 3: DESHACER. Obligatorio: esto no decide nada, sólo comprueba. ──
    try {
      const res = await calendar.calendarList.patch({
        calendarId,
        requestBody: { notificationSettings: { notifications: previas } },
      })
      console.log('')
      console.log('✔ restaurado al estado previo')
      informeNotificaciones(res.data, 'ESTADO RESTAURADO (debe coincidir con el de ANTES)')
      if (previas.length === 0) {
        console.log('')
        console.log('  ⚠ El estado previo era una lista VACÍA, así que la')
        console.log('    restauración manda una lista vacía. Si de fábrica no')
        console.log('    venía `notificationSettings` en absoluto, comprueba a')
        console.log('    ojo en calendar.google.com que no quedó nada marcado.')
      }
    } catch (err) {
      imprimeError('LA RESTAURACIÓN FALLÓ — HAY QUE DESHACERLO A MANO', err)
      console.log('')
      console.log('  ⚠⚠ La cuenta se quedó con las notificaciones que este')
      console.log('     script activó. Estado al que hay que volver:')
      if (previas.length === 0) console.log('     (ninguna)')
      for (const n of previas) console.log(`     ${n.method ?? '?'} · ${n.type ?? '?'}`)
      console.log('     Se deshace por la vía manual de más abajo.')
      veredicto(true, true)
      alternativaManual(calendarId)
      process.exit(1)
    }
  }

  veredicto(true, escrituraOk)
  alternativaManual(calendarId)
  process.exit(escrituraOk ? 0 : 1)
}

main().catch((err: unknown) => {
  imprimeError('el script reventó antes de terminar:', err)
  process.exit(1)
})
