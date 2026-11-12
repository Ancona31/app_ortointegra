/**
 * secretos.ts — todo lo que la reserva por enlace deriva de RESERVA_SECRETO
 * (agenda D1). SÓLO SERVIDOR: nada de esto se importa desde un componente.
 *
 * Una variable, `RESERVA_SECRETO` (≥ 32 bytes en hex), y una subllave HKDF
 * por propósito, para que un valor de un uso nunca sirva en otro:
 *   - `enlace`:   el código del enlace = HMAC('enlace:' || id), 16 bytes en
 *                 base64url (22 caracteres, 128 bits). La base NO lo guarda:
 *                 guarda sha256(código) (`hashDeCodigo`), y el código se
 *                 puede volver a enseñar derivándolo del id.
 *   - `contacto`: seudónimo del teléfono / correo normalizados (llave del
 *                 candado, D2). La clase entra en el mensaje: el mismo texto
 *                 como teléfono y como correo da HMAC distintos.
 *   - `codigo`:   el código de 6 dígitos del correo y la ficha de
 *                 verificación, atados al enlace y al correo.
 *   - `red`:      IP y dispositivo para los límites de intentos (nunca en claro).
 *
 * Sin secreto (o con uno corto o que no es hex) todas devuelven null y
 * `secretoDisponible()` es false: quien llama falla cerrado.
 * ROTAR el secreto invalida todos los enlaces y el historial del candado.
 */
import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto'

export type Proposito = 'enlace' | 'contacto' | 'codigo' | 'red'
export type ClaseContacto = 'telefono' | 'correo'
export type ClaseRed = 'ip' | 'dispositivo'

const SAL = 'spinus-reserva-v1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const HEX64 = /^[0-9a-f]{64}$/
const CODIGO = /^[A-Za-z0-9_-]{22}$/

function secretoMaestro(): Buffer | null {
  const crudo = process.env.RESERVA_SECRETO?.trim().toLowerCase() ?? ''
  if (crudo.length < 64 || crudo.length % 2 !== 0 || !/^[0-9a-f]+$/.test(crudo)) return null
  return Buffer.from(crudo, 'hex')
}

function subllave(proposito: Proposito): Buffer | null {
  const maestro = secretoMaestro()
  if (!maestro) return null
  return Buffer.from(hkdfSync('sha256', maestro, SAL, `reserva:${proposito}`, 32))
}

function hmacHex(proposito: Proposito, mensaje: string): string | null {
  const llave = subllave(proposito)
  return llave ? createHmac('sha256', llave).update(mensaje, 'utf8').digest('hex') : null
}

/** ¿Hay un RESERVA_SECRETO utilizable? Sin él, la reserva no funciona. */
export function secretoDisponible(): boolean {
  return secretoMaestro() !== null
}

/** El código del enlace `id` (uuid en minúsculas). null sin secreto o con id inválido. */
export function codigoDeEnlace(id: string): string | null {
  if (!UUID.test(id)) return null
  const llave = subllave('enlace')
  if (!llave) return null
  return createHmac('sha256', llave).update(`enlace:${id}`, 'utf8').digest().subarray(0, 16).toString('base64url')
}

/** ¿Tiene la forma de un código de enlace? Se mira antes de tocar la base. */
export function esCodigoDeEnlace(codigo: string): boolean {
  return CODIGO.test(codigo)
}

/** sha256 del código, en hex: lo único que la base guarda y por donde busca. */
export function hashDeCodigo(codigo: string): string {
  return createHash('sha256').update(codigo, 'utf8').digest('hex')
}

/** Seudónimo de un contacto YA normalizado (D5 normaliza). */
export function hmacContacto(clase: ClaseContacto, normalizado: string): string | null {
  if (normalizado === '') return null
  return hmacHex('contacto', `${clase}:${normalizado}`)
}

/** HMAC del código de 6 dígitos, atado al enlace y al correo (seudónimo). */
export function hmacCodigoCorreo(enlaceId: string, correoHmac: string, codigo: string): string | null {
  if (!UUID.test(enlaceId) || !HEX64.test(correoHmac) || !/^[0-9]{6}$/.test(codigo)) return null
  return hmacHex('codigo', `correo:${enlaceId}:${correoHmac}:${codigo}`)
}

/** Seudónimo de una IP o de un dispositivo para los límites de intentos (la clase entra en el mensaje). */
export function hmacRed(clase: ClaseRed, valor: string): string | null {
  if (valor === '') return null
  return hmacHex('red', `${clase}:${valor}`)
}

/** HMAC de una ficha de verificación: lo que guarda la base. */
export function hmacFicha(ficha: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ficha)) return null
  return hmacHex('codigo', `ficha:${ficha}`)
}

/** Ficha nueva (32 bytes al azar) y su HMAC. null sin secreto. */
export function nuevaFicha(): { ficha: string; fichaHmac: string } | null {
  const ficha = randomBytes(32).toString('base64url')
  const fichaHmac = hmacFicha(ficha)
  return fichaHmac ? { ficha, fichaHmac } : null
}
