/**
 * Dueño único de la conexión de Google de una clínica: la resuelve y la escribe.
 *
 * Hasta hoy la conexión era `public.google_tokens`, una fila por usuario, y por
 * eso las citas que agenda la secretaria no llegan a Google: se le busca token a
 * quien ejecuta la acción y ella no tiene. La fuente nueva es
 * `public.clinica_conexiones_google` (metadata) más
 * `private.google_conexiones_secretos` (tokens), y la conexión se resuelve por
 * CLÍNICA, no por usuario.
 *
 * YA NO ESTÁ INERTE. Nació aparte en el commit 1 para poder verificarlo por
 * lectura antes de que tuviera consecuencias, y el commit 3 lo cableó: `gcal.ts`
 * y las seis rutas de Google resuelven por aquí. Desde ese commit, ningún otro
 * archivo del repo toca `google_tokens` ni por lectura.
 *
 * ── POR QUÉ TODO PASA POR AQUÍ ──────────────────────────────────────────────
 * Son dos fuentes y hay que escribir en las dos hasta que el archivo B retire
 * la vieja. Un camino que escriba directo deja divergencia, y la divergencia la
 * caza el archivo B abortando el corte. Por eso este archivo es el ÚNICO del
 * repo donde pueden aparecer estos seis literales (plan §2.2):
 *
 *   alta_conexion_google · guardar_secretos_conexion ·
 *   leer_conexion_google_con_secretos · clinica_conexiones_google ·
 *   google_tokens · google_conexiones_secretos
 *
 * El cerrojo que lo vigila es una prueba de Vitest, y va en el commit 6.
 *
 * ── QUÉ CLIENTE USA CADA COSA (plan §0.2 y §1) ──────────────────────────────
 * · La LECTURA de metadata va con el cliente de SESIÓN, que recibe por
 *   parámetro: la policy `clinica_conexiones_google_select` la permite.
 * · Todo lo demás va con el cliente ADMIN, que se crea aquí dentro. No es una
 *   preferencia: la tabla tiene RLS activa, ninguna policy de escritura y los
 *   privilegios revocados a `authenticated`, así que escribir exige service
 *   role por construcción. Y los tokens no se alcanzan de ninguna otra forma —
 *   `service_role` no tiene USAGE sobre el esquema `private`—, de ahí las tres
 *   RPC del puente (`20260818_gcal_puente_secretos.sql`).
 *
 * ── PRIVACIDAD ──────────────────────────────────────────────────────────────
 * Aquí NO se registra ningún token, ni cifrado ni en claro, ni truncado, ni
 * ningún nombre de paciente. Lo que sale a los logs son ids y mensajes de error
 * de Postgres. Si añades una línea de log, que siga siendo así.
 *
 * NO importa `googleapis` a propósito (plan §1): eso vive en `gcal.ts`, y este
 * módulo va a ser importado DESDE allí. Importarlo de vuelta sería un ciclo.
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/encrypt'
import { logger } from '@/lib/logger'

/** La conexión, SIN secretos. Sale de una lectura bajo RLS. */
export interface ConexionGoogle {
  id:          string
  clinicaId:   string
  userId:      string        // dueño de la cuenta de Google
  rol:         'clinica' | 'personal'
  calendarId:  string | null
  estado:      'activa' | 'revocada'
  /**
   * Correo de la cuenta de Google a la que está atado el calendario, para que
   * quien administra vea A CUÁL — puede no ser el correo con el que entra a
   * Spinus, y hoy en producción no lo es.
   *
   * NULL SIGNIFICA «IDENTIDAD DESCONOCIDA», NUNCA «SIN CUENTA» ni «conexión
   * defectuosa». Le pasa a toda conexión anterior a los scopes `openid`/`email`
   * y se puebla sola cuando su dueño reconecte (plan §12.17). El tipo lo admite
   * a propósito: si fuera `string`, el compilador dejaría de obligar a
   * contemplar ese caso y la primera conexión migrada rompería en silencio.
   *
   * Quien lo pinte, que no invente un texto de «cuenta desconocida»: con NULL
   * se calla y ya está.
   */
  googleAccountEmail: string | null
}

/** La fila tal como vive en `clinica_conexiones_google`. */
interface FilaConexion {
  id:                   string
  clinica_id:           string
  user_id:              string
  rol:                  'clinica' | 'personal'
  calendar_id:          string | null
  estado:               'activa' | 'revocada'
  google_account_email: string | null
}

const COLUMNAS_CONEXION =
  'id, clinica_id, user_id, rol, calendar_id, estado, google_account_email'

function aDescriptor(fila: FilaConexion): ConexionGoogle {
  return {
    id:         fila.id,
    clinicaId:  fila.clinica_id,
    userId:     fila.user_id,
    rol:        fila.rol,
    calendarId: fila.calendar_id,
    estado:     fila.estado,
    googleAccountEmail: fila.google_account_email,
  }
}

/**
 * El espejo a la fuente vieja falló y la nueva no. Se sigue adelante —la fuente
 * que se queda ya está escrita— y se deja una línea con un literal fijo,
 * `doble_escritura_espejo`, para poder greparla. La divergencia que quede la
 * caza el archivo B abortando el corte; esto es sólo el aviso temprano.
 *
 * Usa `logger` y no `registrarFalloGCal` (`gcal.ts:135`), que es lo que nombra
 * el plan §2.4: esa función vive en un módulo que importa `googleapis`, y este
 * archivo no puede importarlo (ver la cabecera). Lo que el plan pide de ella es
 * que el fallo sea greppable por operación, y eso se conserva entero.
 */
function registrarFalloEspejo(operacion: string, mensaje: string): void {
  logger.error('GCal', 'fallo ' + JSON.stringify({
    operacion: `doble_escritura_espejo (${operacion})`,
    mensaje,
  }))
}

/* ── Resolución ─────────────────────────────────────────── */

/**
 * LA conexión de la clínica. Cero o una fila, garantizado por el índice único
 * parcial `clinica_conexiones_google_una_por_clinica` (`WHERE rol='clinica'`).
 *
 * Los tres filtros son obligatorios y ninguno es decorativo:
 * · `clinica_id` va explícito aunque la RLS ya lo imponga (plan §1). `clinicaId`
 *   sale SIEMPRE de `profiles` de la sesión autenticada, nunca del cuerpo de la
 *   petición ni de un query param.
 * · `rol` acota a la conexión de clínica. Sin él la garantía de «cero o una»
 *   se cae: el índice único parcial sólo cubre las filas con `rol='clinica'`, y
 *   una clínica puede tener además conexiones `'personal'`.
 * · `estado` deja fuera las revocadas (plan §5): «conectado» significa «hay una
 *   conexión que la última vez que se usó seguía sirviendo», no «hay fila».
 *
 * Devuelve null SÓLO cuando no hay conexión. Un fallo de la consulta se lanza:
 * convertirlo en null es exactamente el defecto que H4 denuncia —aguas arriba
 * se leería como «esta clínica nunca conectó»—.
 */
export async function resolverConexionClinica(
  sesion: SupabaseClient,
  clinicaId: string,
): Promise<ConexionGoogle | null> {
  const { data, error } = await sesion
    .from('clinica_conexiones_google')
    .select(COLUMNAS_CONEXION)
    .eq('clinica_id', clinicaId)
    .eq('rol', 'clinica')
    .eq('estado', 'activa')
    .maybeSingle<FilaConexion>()

  if (error) {
    throw new Error(`resolverConexionClinica: ${error.message}`)
  }
  return data ? aDescriptor(data) : null
}

/* ── Lectura de tokens ──────────────────────────────────── */

/** La conexión con sus tokens, tal como la devuelve el RPC del puente. */
export interface ConexionConSecretos {
  conexionId:    string
  clinicaId:     string
  userId:        string
  rol:           'clinica' | 'personal'
  calendarId:    string | null
  estado:        'activa' | 'revocada'
  tieneSecretos: boolean
  accessToken:   string | null   // cifrado
  refreshToken:  string | null   // cifrado
  expiresAt:     number | null
}

/**
 * Las tres respuestas posibles del RPC, sin interpretar. `fila` y `error` en
 * null a la vez significa cero filas.
 */
export interface LecturaConexion {
  fila:  ConexionConSecretos | null
  error: string | null
}

interface FilaSecretos {
  conexion_id:    string
  clinica_id:     string
  user_id:        string
  rol:            'clinica' | 'personal'
  calendar_id:    string | null
  estado:         'activa' | 'revocada'
  tiene_secretos: boolean
  access_token:   string | null
  refresh_token:  string | null
  expires_at:     number | null
}

/**
 * Los tokens de una conexión. ESTA FUNCIÓN NO DECIDE NADA: devuelve la fila tal
 * cual, con su `tieneSecretos`, o el error, o los dos en null si no hubo fila.
 *
 * Las tres respuestas anómalas —error, cero filas, `tieneSecretos = false`— las
 * distingue y las lanza `abrirSesionGoogle` (plan §3.1, brief §4 fila A2), que
 * es quien sabe qué significan en su contexto. Adelantar aquí ese `throw`
 * dejaría a esa función sin poder separarlas.
 *
 * El `clinicaId` no es redundante con el `conexionId`: es la guarda de
 * aislamiento del propio RPC, que devuelve cero filas si la conexión es de otra
 * clínica. Sale de la sesión, no del descriptor.
 */
export async function leerConexionConSecretos(
  args: { clinicaId: string; conexionId: string },
): Promise<LecturaConexion> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('leer_conexion_google_con_secretos', {
    p_clinica_id:  args.clinicaId,
    p_conexion_id: args.conexionId,
  })

  if (error) return { fila: null, error: error.message }

  const filas: FilaSecretos[] = Array.isArray(data) ? data : data ? [data] : []
  const fila = filas[0]
  if (!fila) return { fila: null, error: null }

  return {
    error: null,
    fila: {
      conexionId:    fila.conexion_id,
      clinicaId:     fila.clinica_id,
      userId:        fila.user_id,
      rol:           fila.rol,
      calendarId:    fila.calendar_id,
      estado:        fila.estado,
      tieneSecretos: fila.tiene_secretos,
      accessToken:   fila.access_token,
      refreshToken:  fila.refresh_token,
      expiresAt:     fila.expires_at,
    },
  }
}

/* ── Alta ───────────────────────────────────────────────── */

/**
 * Los errores CON NOMBRE de `alta_conexion_google`. Los cinco están en el
 * `COMMENT` de la función (`20260818_gcal_puente_secretos.sql:334`) y los
 * levanta como mensaje de un `RAISE EXCEPTION`, con el detalle en `DETAIL`.
 *
 * No son fallos: son respuestas. Cada uno tiene una salida distinta de cara al
 * médico y el llamador está obligado a cubrirlos todos.
 */
export const ERRORES_ALTA = [
  'perfil_ajeno_a_clinica',
  'conexion_de_otra_clinica',
  'clinica_ya_conectada',
  'rol_no_promovido',
  'access_token_nulo',
] as const

/**
 * El sexto, y es de ESTE módulo, no del RPC: la cuenta de Google que se intenta
 * conectar ya está enlazada a OTRO usuario de Spinus.
 *
 * Lo impone el índice único parcial `..._account_sub_uniq`
 * (`20260817_gcal_conexion_clinica_a_esquema.sql:267-269`), y hasta hoy era
 * INALCANZABLE: la columna valía siempre NULL y el índice es parcial
 * (`WHERE google_account_sub IS NOT NULL`), así que nunca podía chocar. Al
 * empezar a poblar la identidad, el choque se estrena.
 *
 * NO es el relevo de administrador. Ése es `clinica_ya_conectada` —otra cuenta
 * ya es la de esta clínica— y lo resuelve el RPC. Éste es al revés: la misma
 * cuenta de Google intentando dar servicio a dos usuarios de Spinus, cosa que
 * el caso real produce sin ninguna malicia —una persona con dos contextos, dos
 * clínicas y dos cuentas de Spinus— y que no puede permitirse, porque las citas
 * de los dos acabarían en el mismo calendario.
 *
 * VA APARTE DE `ERRORES_ALTA` A PROPÓSITO: esa lista es el contrato del RPC —los
 * cinco literales que levanta con `RAISE EXCEPTION` y que están en su `COMMENT`—
 * y meter dentro uno que el RPC no produce dejaría esa documentación mintiendo.
 * De cara al llamador los seis son lo mismo: respuestas con nombre, no fallos.
 */
export const ERROR_CUENTA_YA_VINCULADA = 'cuenta_ya_vinculada'

export type ErrorAlta =
  | (typeof ERRORES_ALTA)[number]
  | typeof ERROR_CUENTA_YA_VINCULADA

function esErrorAlta(mensaje: string): mensaje is ErrorAlta {
  return ERRORES_ALTA.some((nombre) => nombre === mensaje)
}

/** El índice único parcial sobre la identidad de la cuenta de Google. */
const INDICE_CUENTA_UNICA = 'clinica_conexiones_google_account_sub_uniq'

/**
 * ¿Es el choque contra ese índice? Se reconoce POR EL NOMBRE DEL ÍNDICE, que
 * Postgres pone en el mensaje del 23505, y no sólo por el SQLSTATE: sobre esta
 * tabla hay tres índices únicos más y confundirlos daría un aviso equivocado.
 *
 * Se mira también `details`, donde Postgres repite el nombre de la columna. Ese
 * campo lleva además el VALOR que chocó —el `sub` de la cuenta—, así que se usa
 * para decidir y NUNCA se registra ni se devuelve.
 *
 * Que el reconocimiento falle no rompe nada: se cae al `throw` de abajo, que es
 * el comportamiento que había antes de este commit.
 */
function esCuentaYaVinculada(error: PostgrestError): boolean {
  return `${error.message} ${error.details ?? ''}`.includes(INDICE_CUENTA_UNICA)
}

/** Lo que el RPC devuelve del alta. */
export interface DescriptorAlta {
  conexionId: string
  calendarId: string | null
  rol:        'clinica' | 'personal'
  estado:     'activa' | 'revocada'
}

/**
 * Unión discriminada, para que el llamador no pueda ignorar los errores con
 * nombre: sin mirar `ok` no llega al descriptor.
 */
export type ResultadoAlta =
  | { ok: true;  alta:  DescriptorAlta }
  | { ok: false; error: ErrorAlta }

interface FilaAlta {
  conexion_id: string
  calendar_id: string | null
  rol:         'clinica' | 'personal'
  estado:      'activa' | 'revocada'
}

/**
 * Alta o reconexión. Metadata y secretos entran en UNA transacción dentro del
 * RPC, así que no puede nacer una conexión sin tokens.
 *
 * Los tokens llegan EN CLARO y se cifran aquí, una sola vez: el mismo string
 * cifrado va al puente y al espejo (plan §2.3), para que la comprobación de
 * bytes idénticos del archivo B sea verificable en vez de ciega — el IV es
 * aleatorio, así que cifrar dos veces daría dos ciphertexts distintos.
 *
 * Un error con nombre no toca el espejo: no se escribió nada en la fuente nueva.
 *
 * ── `cuenta` CON LAS DOS MITADES EN NULL ES NORMAL ──────────────────────────
 * Significa **«no se sabe qué cuenta de Google es»**, y NUNCA «conexión
 * defectuosa». Hay dos formas de llegar aquí con nulos y ninguna es un fallo:
 * el `id_token` no vino o no verificó, y —la habitual— la conexión es anterior
 * a los scopes `openid`/`email`.
 *
 * Añadir un scope NO le vuelve a pedir consentimiento a quien ya conectó: su
 * token sigue sirviendo con los permisos viejos y sus dos columnas se quedan en
 * NULL. **Se decidió CONVIVIR con eso en vez de forzar reconexiones** —con diez
 * betatesters el dato no vale la molestia, y una reconexión mal hecha deja a una
 * clínica sin sincronizar—, así que a partir de aquí conviven conexiones con
 * identidad y sin ella. **Nada puede romperse, degradarse ni avisar por eso.**
 * Se van poblando solas conforme la gente reconecte por otros motivos.
 *
 * El RPC ya está escrito para esto: hace `COALESCE` sobre las dos columnas, o
 * sea que NULL es «no lo toques», nunca «bórralo» — la misma regla que el
 * `refresh_token` en `guardarSecretos`.
 *
 * ── YA OCURRIÓ: `google_account_email` SUBIÓ AL DESCRIPTOR ──────────────────
 * Esto era un aviso de futuro; hoy es historia. `ConexionGoogle` lleva el correo
 * para que /perfil enseñe a qué cuenta está atado el calendario, y entró
 * —como el aviso exigía— tipado `string | null`. NO lo estreches a `string`: ese
 * tipo es lo único que obliga a contemplar las conexiones migradas, que lo
 * tienen vacío hasta que su dueño reconecte.
 *
 * `google_account_sub` NO subió y no hace falta que suba: es el identificador
 * estable con el que se distingue una cuenta de otra, no algo que se enseñe. Si
 * algún día lo necesitas arriba, vale la misma regla — `string | null`.
 */
export async function altaConexion(args: {
  userId:    string
  clinicaId: string
  rol:       'clinica' | 'personal'
  /** NULL en cualquiera de las dos = identidad desconocida. Ver el docstring. */
  cuenta:    { sub: string | null; email: string | null }
  tokens:    { accessToken: string; refreshToken: string | null; expiresAt: number | null }
}): Promise<ResultadoAlta> {
  const admin   = createAdminClient()
  const access  = encrypt(args.tokens.accessToken)
  const refresh = args.tokens.refreshToken ? encrypt(args.tokens.refreshToken) : null

  const { data, error } = await admin.rpc('alta_conexion_google', {
    p_clinica_id:           args.clinicaId,
    p_user_id:              args.userId,
    p_rol:                  args.rol,
    p_google_account_sub:   args.cuenta.sub,
    p_google_account_email: args.cuenta.email,
    p_access:               access,
    p_refresh:              refresh,
    p_expires:              args.tokens.expiresAt,
  })

  if (error) {
    if (esErrorAlta(error.message)) return { ok: false, error: error.message }
    // El 23505 del índice de identidad NO llega con nombre —el RPC sólo
    // reetiqueta el de «una conexión de clínica por clínica» y vuelve a lanzar
    // el resto—, así que se le pone aquí. Sin esto sube como excepción y el
    // médico acaba en la dashboard con un `?error=oauth_failed` que nadie
    // pinta: un fallo mudo, que es el patrón que abre esta rama entera.
    if (esCuentaYaVinculada(error)) return { ok: false, error: ERROR_CUENTA_YA_VINCULADA }
    throw new Error(`altaConexion: ${error.message}`)
  }

  const filas: FilaAlta[] = Array.isArray(data) ? data : data ? [data] : []
  const fila = filas[0]
  if (!fila) throw new Error('altaConexion: el RPC no devolvió descriptor')

  await espejarAlta(admin, args.userId, access, refresh, args.tokens.expiresAt)

  return {
    ok:   true,
    alta: {
      conexionId: fila.conexion_id,
      calendarId: fila.calendar_id,
      rol:        fila.rol,
      estado:     fila.estado,
    },
  }
}

/** El espejo del alta: la fila entera de la fuente vieja, con los mismos bytes. */
async function espejarAlta(
  admin:     ReturnType<typeof createAdminClient>,
  userId:    string,
  access:    string,
  refresh:   string | null,
  expiresAt: number | null,
): Promise<void> {
  const { error } = await admin.from('google_tokens').upsert({
    user_id:       userId,
    access_token:  access,
    refresh_token: refresh,
    expires_at:    expiresAt,
  })
  if (error) registrarFalloEspejo('altaConexion', error.message)
}

/* ── Refresco de tokens ─────────────────────────────────── */

/**
 * El guardado del refresco. `access_token` y `expires_at` viajan JUNTOS y no hay
 * firma que permita mover uno sin el otro (plan §2.3).
 *
 * EL REFRESH TOKEN NO SE PASA, y no es un olvido: `guardar_secretos_conexion`
 * hace `COALESCE` sobre esa columna, así que `null` significa «no lo toques».
 * Google devuelve `credentials.refresh_token` al refrescar por cortesía —es un
 * eco de nuestra propia entrada, no un dato suyo—, y reenviarlo sería depender
 * de que el siguiente que toque esto lo sepa. Ver el brief §2.2.
 *
 * ESTA ES LA ÚNICA ESCRITURA QUE NO ABORTA (plan §2.4, H9). El resto del módulo
 * lanza cuando falla la fuente nueva; aquí no, porque el access token que se
 * acaba de refrescar ya está en memoria y sirve para esta petición: tirar la
 * operación por un fallo de guardado significaría perder una cita que se podía
 * sincronizar. Se registra y se sigue.
 *
 * Lo que SÍ se mantiene es el orden: si la fuente nueva falla, el espejo NO se
 * toca. Escribirlo entonces crearía divergencia en la dirección que el archivo
 * B no sabe reparar.
 */
export async function guardarSecretos(args: {
  clinicaId:   string
  conexion:    ConexionGoogle
  accessToken: string
  expiresAt:   number | null
}): Promise<void> {
  const admin  = createAdminClient()
  const access = encrypt(args.accessToken)

  const { error } = await admin.rpc('guardar_secretos_conexion', {
    p_clinica_id:  args.clinicaId,
    p_conexion_id: args.conexion.id,
    p_access:      access,
    p_refresh:     null,
    p_expires:     args.expiresAt,
  })

  if (error) {
    logger.error('GCal', 'fallo ' + JSON.stringify({
      operacion: 'guardarSecretos (fuente nueva) — no aborta, ver plan §2.4 H9',
      mensaje:   error.message,
    }))
    return
  }

  const { error: errEspejo } = await admin
    .from('google_tokens')
    .update({ access_token: access, expires_at: args.expiresAt })
    .eq('user_id', args.conexion.userId)
  if (errEspejo) registrarFalloEspejo('guardarSecretos', errEspejo.message)
}

/* ── Revocación ─────────────────────────────────────────── */

/**
 * Marca la conexión como revocada. La dispara el refresco de `gcal.ts` cuando
 * Google contesta `invalid_grant`: el permiso se retiró desde la cuenta de
 * Google y esos tokens ya no sirven.
 *
 * ⚠ EL RADIO DEL FALLO ES LA CLÍNICA ENTERA, Y ESO ES NUEVO. Como
 * `resolverConexionClinica` filtra por `estado = 'activa'`, en cuanto esta
 * columna pasa a 'revocada' la clínica **completa** deja de sincronizar —el
 * administrador, la secretaria y todos los médicos invitados a la vez— hasta
 * que alguien reconecte a mano desde /perfil. Antes de la conexión por clínica,
 * un `invalid_grant` afectaba sólo a la persona dueña de esos tokens.
 *
 * Es la consecuencia deliberada del plan §5 —«conectado» pasa a significar «hay
 * una conexión que la última vez que se usó seguía sirviendo», no «hay fila»— y
 * viene con un segundo efecto que conviene saber: una conexión revocada SIGUE
 * ocupando el índice único parcial, así que otro administrador no puede
 * conectar encima sin desconectar primero. Coherente con «el relevo es un flujo
 * consciente»; molesto el día que pase.
 *
 * NO ABORTA. El fallo de marcar no puede tumbar la operación que lo detectó: el
 * llamador está en mitad de un `catch` relanzando el `invalid_grant`, y ese
 * error es la información que importa. Se registra y se sigue.
 *
 * SIN ESPEJO, y no es un olvido: `google_tokens` no tiene columna `estado`. Por
 * eso el archivo B no compara este campo — ver plan §2.6, que avisa de que un
 * veredicto verde de B no dice nada sobre si la conexión sirve.
 */
export async function marcarRevocada(conexion: ConexionGoogle): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('clinica_conexiones_google')
    .update({ estado: 'revocada' })
    .eq('id', conexion.id)
    .eq('clinica_id', conexion.clinicaId)

  if (error) {
    logger.error('GCal', 'fallo ' + JSON.stringify({
      operacion: 'marcarRevocada — no aborta, ver el docstring',
      mensaje:   error.message,
    }))
  }
}

/* ── Calendario ─────────────────────────────────────────── */

/**
 * El único camino a `calendar_id`, y es un comparar-y-cambiar: el `UPDATE` sólo
 * prende si la columna sigue valiendo `esperado`. Dos peticiones en carrera
 * —la agenda dispara dos— llegan aquí con el mismo `esperado` y sólo una gana.
 *
 * Devuelve si prendió, y NADA MÁS. No devuelve el valor ganador a propósito: un
 * CAS que falla no se «arregla» leyendo quién ganó, se acata. Quien necesite
 * saber qué hay ahora vuelve a resolver la conexión.
 *
 * `esperado === null` se compara con `.is`, no con `.eq`: en SQL nada es igual a
 * NULL, ni NULL mismo, así que un `.eq('calendar_id', null)` no prendería nunca.
 */
export async function guardarCalendarIdSiEsperado(args: {
  conexion: ConexionGoogle
  nuevo:    string | null
  esperado: string | null
}): Promise<boolean> {
  const admin = createAdminClient()
  const cambio = admin
    .from('clinica_conexiones_google')
    .update({ calendar_id: args.nuevo })
    .eq('id', args.conexion.id)
    .eq('clinica_id', args.conexion.clinicaId)

  const { data, error } = await (
    args.esperado === null
      ? cambio.is('calendar_id', null)
      : cambio.eq('calendar_id', args.esperado)
  ).select('calendar_id').maybeSingle()

  if (error) throw new Error(`guardarCalendarIdSiEsperado: ${error.message}`)
  if (!data)  return false

  await espejarCalendarId(admin, args)
  return true
}

/**
 * El espejo del CAS es TAMBIÉN un CAS, con el mismo `esperado` (plan §2.6, H10).
 * Espejar sin comparar dejaba que dos peticiones en carrera escribieran la
 * fuente vieja en el orden inverso al que persistieron la nueva: las dos
 * fuentes acabarían con calendarios distintos y el archivo B abortaría el corte
 * pendiente de reparación a mano.
 *
 * Que el espejo no prenda no es un fallo de esta operación —la fuente que se
 * queda ya está escrita— pero sí es divergencia, así que se registra igual.
 */
async function espejarCalendarId(
  admin: ReturnType<typeof createAdminClient>,
  args:  { conexion: ConexionGoogle; nuevo: string | null; esperado: string | null },
): Promise<void> {
  const cambio = admin
    .from('google_tokens')
    .update({ calendar_id: args.nuevo })
    .eq('user_id', args.conexion.userId)

  const { data, error } = await (
    args.esperado === null
      ? cambio.is('calendar_id', null)
      : cambio.eq('calendar_id', args.esperado)
  ).select('calendar_id').maybeSingle()

  if (error) {
    registrarFalloEspejo('guardarCalendarIdSiEsperado', error.message)
  } else if (!data) {
    registrarFalloEspejo(
      'guardarCalendarIdSiEsperado',
      'el CAS del espejo no prendió: la fuente vieja no tenía el calendar_id esperado',
    )
  }
}

/**
 * Qué `calendar_id` tiene la conexión AHORA. Es el desempate del CAS: cuando
 * `guardarCalendarIdSiEsperado` devuelve false, esto dice si fue porque otra
 * petición ganó la carrera —y entonces su calendario sirve igual— o porque el
 * guardado falló de verdad.
 *
 * VA CON CLIENTE ADMIN, y ésa es su razón de existir. La lectura de metadata la
 * hace normalmente el cliente de sesión (`resolverConexionClinica`), pero este
 * desempate ocurre a veces DENTRO de `after()`, donde por la regla del plan §1
 * sólo entra el admin. Torcer `resolverConexionClinica` pasándole un cliente que
 * su docstring no contempla dejaría esa documentación mintiendo; esto es una
 * función con nombre propio que dice lo que hace.
 *
 * Los dos filtros son explícitos porque con el cliente admin la RLS no acota
 * nada, ni siquiera teniendo la clave primaria.
 *
 * Un error de la consulta se LANZA. Devolver null lo haría indistinguible de
 * «no hay calendario registrado», que es justo la confusión que H4 denuncia: el
 * desempate leería «nadie ganó la carrera» ante un fallo de red.
 */
export async function releerCalendarId(conexion: ConexionGoogle): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clinica_conexiones_google')
    .select('calendar_id')
    .eq('id', conexion.id)
    .eq('clinica_id', conexion.clinicaId)
    .maybeSingle<{ calendar_id: string | null }>()

  if (error) throw new Error(`releerCalendarId: ${error.message}`)
  return data?.calendar_id ?? null
}

/* ── Baja ───────────────────────────────────────────────── */

/**
 * Borra la conexión. Los secretos caen solos por el `ON DELETE CASCADE` de
 * `google_conexiones_secretos`, que corre como acción de integridad referencial
 * y no pide privilegios sobre `private`.
 *
 * Primero la fuente nueva, después el espejo. Si el espejo falla queda una fila
 * en la vieja sin conexión detrás, y el archivo B aborta por su comprobación de
 * «tokens sin conexión»: ruidoso y correcto (plan §2.4).
 *
 * El filtro por `clinica_id` no es decorativo aunque `id` sea la clave primaria:
 * con el cliente admin la RLS no acota nada.
 */
export async function borrarConexion(args: { conexion: ConexionGoogle }): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('clinica_conexiones_google')
    .delete()
    .eq('id', args.conexion.id)
    .eq('clinica_id', args.conexion.clinicaId)

  if (error) throw new Error(`borrarConexion: ${error.message}`)

  const { error: errEspejo } = await admin
    .from('google_tokens')
    .delete()
    .eq('user_id', args.conexion.userId)
  if (errEspejo) registrarFalloEspejo('borrarConexion', errEspejo.message)
}
