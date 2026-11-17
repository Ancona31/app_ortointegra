/**
 * transporte.ts — un solo camino para mandar correo, con el transporte elegido
 * por `EMAIL_TRANSPORT` (agenda D0, mejora_agendaV2.md §6: «correos: ninguno
 * real» en local).
 *
 *   - `captura`: Mailpit por su API HTTP (`POST /api/v1/send`). Sólo a un
 *     host loopback; nunca se llama a `/release`, así que nada sale.
 *   - `resend`: producción. DOBLE GUARDA: además de la variable, la URL de
 *     Supabase tiene que ser remota (https y nombre DNS que no sea local). Con
 *     la base local, `resend` queda apagado aunque la variable lo pida.
 *   - Sin variable, o con cualquier otro valor: apagado. No se envía nada, se
 *     devuelve `{ ok: false, motivo: 'apagado' }` y queda en el logger.
 *
 * `resend` se importa con `await import()` SÓLO dentro de su rama, y
 * `RESEND_API_KEY` sólo se lee ahí: en local la llave real de `.env.local` no
 * se toca. El logger nunca recibe el destinatario, el asunto ni el cuerpo
 * (CLAUDE.md, PII); sólo la etiqueta, que es un literal del código.
 *
 * Las rutas viejas que construyen `new Resend()` directamente NO pasan por
 * aquí (registro, reset, invitación, email-hook, reenviar-confirmación,
 * enviar-documento). Migrarlas es otro paso.
 */
import { logger } from '@/lib/logger'

export type ModoTransporte = 'captura' | 'resend' | 'apagado'

/** Por qué quedó apagado. Sin datos del entorno: sólo la causa. */
export type MotivoApagado = 'sin_variable' | 'valor_desconocido' | 'supabase_local' | 'sin_llave'

export type DecisionTransporte =
  | { modo: 'captura' }
  | { modo: 'resend'; llave: string }
  | { modo: 'apagado'; motivo: MotivoApagado }

export interface Correo {
  para: string
  asunto: string
  texto: string
  html: string
  /** Literal del código (`^[a-z0-9_-]{1,40}$`): es lo único que va al logger. */
  etiqueta: string
  /**
   * Llave de idempotencia de Resend (agenda E4): con la misma llave y el mismo
   * cuerpo, Resend no vuelve a mandar durante 24 h. Sólo `^[a-z0-9/_-]{1,256}$`
   * (`recordatorio/<uuid>`); otra forma no se manda y el envío sigue sin llave.
   * Mailpit la ignora. Nunca va al logger.
   */
  idempotencia?: string
  /**
   * Tanda I, punto 21 de Angel: el NOMBRE del remitente (el del médico, para
   * que el paciente reconozca el correo). La DIRECCIÓN no cambia nunca
   * (`REMITENTE_CORREO`). Se sanea en `nombreRemitente` (cabecera `From`:
   * sin saltos, sin controles, sin comillas ni ángulos). Ausente o vacío,
   * «Spinus», como siempre.
   */
  remitente?: string
}

export type ResultadoEnvio =
  | { ok: true; modo: 'captura' | 'resend' }
  /** `duplicado`: Resend respondió 409 a la llave de idempotencia (el primero salió o sigue en curso). */
  | { ok: false; modo: ModoTransporte; motivo: 'apagado' | 'fallo' | 'duplicado' }

type Entorno = Readonly<Record<string, string | undefined>>

export const REMITENTE = 'Spinus <noreply@mail.spinus.com.mx>'
const REMITENTE_CORREO = 'noreply@mail.spinus.com.mx'
const MAILPIT_POR_OMISION = 'http://127.0.0.1:54324'
const ESPERA_MS = 10_000
const TAG = 'correo'

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

const NOMBRE_REMITENTE_MAX = 64
/** Lo que no puede ir en un nombre de cabecera: controles, formato, separadores de línea, lo que cierra o rompe la comilla o el ángulo, y `@` (un nombre no finge otra dirección). */
const NO_EN_CABECERA = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}"\\<>@]/gu

/**
 * El nombre visible del remitente, a salvo de inyección de cabeceras: fuera
 * saltos de línea y todo carácter de control o de formato (un CR/LF partiría
 * la cabecera `From` y metería otras), fuera comillas, barra invertida y
 * ángulos (cerrarían el nombre entrecomillado o fingirían otra dirección),
 * fuera `@` (que «Dr. x@banco.mx» no se lea como otra dirección), espacios
 * juntos en uno y como mucho 64 caracteres, contados por punto de código para
 * no partir un emoji en dos mitades. Vacío → «Spinus».
 */
export function nombreRemitente(nombre: string | undefined): string {
  const unido = (nombre ?? '').replace(NO_EN_CABECERA, ' ').replace(/\s+/g, ' ').trim()
  const limpio = Array.from(unido).slice(0, NOMBRE_REMITENTE_MAX).join('').trim()
  return limpio || 'Spinus'
}

/**
 * `"Nombre" <noreply@…>`: el nombre saneado entre comillas y la dirección de
 * siempre. Sin nombre, exactamente el `REMITENTE` de antes.
 */
export function cabeceraFrom(nombre: string | undefined): string {
  const n = nombreRemitente(nombre)
  return n === 'Spinus' ? REMITENTE : `"${n}" <${REMITENTE_CORREO}>`
}

function esLoopback(host: string): boolean {
  return host === 'localhost' || host === '[::1]' || (IPV4.test(host) && host.startsWith('127.'))
}

/**
 * ¿La URL de Supabase es de producción? Sólo `https:` con un nombre DNS de
 * dos o más etiquetas que no sea local. Cualquier IP literal, `http:`, nombre
 * de una etiqueta (`kong`), `.localhost`, `.local`, `.internal`, o una URL
 * ausente o mal escrita cuentan como LOCAL: falla cerrado.
 */
export function supabaseEsRemota(url: string | undefined): boolean {
  if (!url) return false
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  const host = u.hostname.toLowerCase()
  if (u.protocol !== 'https:') return false
  if (host.startsWith('[') || IPV4.test(host) || !host.includes('.')) return false
  return !/\.(localhost|local|internal)$/.test(host)
}

/** Decide el transporte. Pura: sólo lee el entorno que recibe. */
export function decidirTransporte(env: Entorno): DecisionTransporte {
  const pedido = env.EMAIL_TRANSPORT
  if (pedido === undefined || pedido === '') return { modo: 'apagado', motivo: 'sin_variable' }
  if (pedido === 'captura') return { modo: 'captura' }
  if (pedido !== 'resend') return { modo: 'apagado', motivo: 'valor_desconocido' }
  if (!supabaseEsRemota(env.NEXT_PUBLIC_SUPABASE_URL)) return { modo: 'apagado', motivo: 'supabase_local' }
  const llave = env.RESEND_API_KEY
  if (!llave) return { modo: 'apagado', motivo: 'sin_llave' }
  return { modo: 'resend', llave }
}

/** Atajo sin la llave, para quien sólo quiere saber el modo. */
export function modoTransporte(env: Entorno): ModoTransporte {
  return decidirTransporte(env).modo
}

/** URL de envío de Mailpit, o null si `MAILPIT_URL` no es loopback http(s). */
export function urlEnvioMailpit(env: Entorno): URL | null {
  let base: URL
  try {
    base = new URL(env.MAILPIT_URL || MAILPIT_POR_OMISION)
  } catch {
    return null
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return null
  if (!esLoopback(base.hostname.toLowerCase())) return null
  return new URL('/api/v1/send', base)
}

function etiquetaSegura(etiqueta: string): string {
  return /^[a-z0-9_-]{1,40}$/.test(etiqueta) ? etiqueta : 'sin_etiqueta'
}

async function enviarPorMailpit(c: Correo, env: Entorno, etiqueta: string): Promise<boolean> {
  const url = urlEnvioMailpit(env)
  if (!url) {
    logger.error(TAG, `(${etiqueta}) MAILPIT_URL no es loopback; no se envió`)
    return false
  }
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      From: { Email: REMITENTE_CORREO, Name: nombreRemitente(c.remitente) },
      To: [{ Email: c.para }],
      Subject: c.asunto,
      Text: c.texto,
      HTML: c.html,
      Tags: [etiqueta],
    }),
    // Sin seguir redirecciones: un 3xx sacaría el correo de loopback.
    redirect: 'manual',
    signal: AbortSignal.timeout(ESPERA_MS),
  })
  if (!respuesta.ok) logger.error(TAG, `(${etiqueta}) Mailpit respondió ${respuesta.status}`)
  return respuesta.ok
}

const IDEMPOTENCIA = /^[a-z0-9/_-]{1,256}$/
/** Los dos 409 de la llave de idempotencia (resend.com/docs/dashboard/emails/idempotency-keys). */
const ERRORES_DUPLICADO = new Set(['invalid_idempotent_request', 'concurrent_idempotent_requests'])

async function enviarPorResend(c: Correo, llave: string, etiqueta: string): Promise<'ok' | 'fallo' | 'duplicado'> {
  const { Resend } = await import('resend')
  const resend = new Resend(llave)
  const opciones = c.idempotencia !== undefined && IDEMPOTENCIA.test(c.idempotencia)
    ? { idempotencyKey: c.idempotencia }
    : undefined
  const { error } = await resend.emails.send({
    from: cabeceraFrom(c.remitente), to: c.para, subject: c.asunto, html: c.html, text: c.texto,
  }, opciones)
  if (!error) return 'ok'
  // Sólo el código del error: su mensaje puede repetir la dirección.
  logger.error(TAG, `(${etiqueta}) Resend rechazó el envío: ${error.name}`)
  return ERRORES_DUPLICADO.has(error.name) ? 'duplicado' : 'fallo'
}

/**
 * Manda un correo por el transporte del entorno. Nunca lanza: devuelve el
 * resultado. `env` sólo se pasa en las pruebas.
 */
export async function enviarCorreo(c: Correo, env: Entorno = process.env): Promise<ResultadoEnvio> {
  const etiqueta = etiquetaSegura(c.etiqueta)
  const decision = decidirTransporte(env)
  if (decision.modo === 'apagado') {
    logger.warn(TAG, `(${etiqueta}) no se envió: transporte apagado (${decision.motivo})`)
    return { ok: false, modo: 'apagado', motivo: 'apagado' }
  }
  try {
    const r = decision.modo === 'captura'
      ? ((await enviarPorMailpit(c, env, etiqueta)) ? 'ok' : 'fallo')
      : await enviarPorResend(c, decision.llave, etiqueta)
    return r === 'ok' ? { ok: true, modo: decision.modo } : { ok: false, modo: decision.modo, motivo: r }
  } catch (e) {
    const nombre = e instanceof Error ? e.name : 'desconocido'
    logger.error(TAG, `(${etiqueta}) falló el envío por ${decision.modo}: ${nombre}`)
    return { ok: false, modo: decision.modo, motivo: 'fallo' }
  }
}
