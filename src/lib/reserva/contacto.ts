/**
 * contacto.ts — normalización del teléfono y el correo de quien reserva por
 * enlace (agenda D5). Puro. La forma normalizada SÓLO alimenta el HMAC del
 * candado (`hmacContacto`): en la cita se guardan el teléfono de 10 dígitos y
 * el correo tal como la persona lo escribió (recortado).
 *
 * Lista A: 11 (sólo números de México de 10 dígitos) y 12 (correo en
 * minúsculas y sin `+etiqueta`; los puntos de Gmail NO se quitan).
 */

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Diez dígitos de un número de México, o null. Quita todo lo que no sea
 * dígito y luego el prefijo internacional `52` (y el `1` de móvil de antes,
 * `521`) si sobra. Sin ese prefijo tienen que quedar exactamente 10.
 */
export function normalizarTelefonoMx(crudo: string): string | null {
  let d = crudo.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3)
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2)
  return /^[0-9]{10}$/.test(d) ? d : null
}

/** ¿Tiene forma de correo (y cabe en la columna)? Sobre el texto recortado. */
export function correoValido(crudo: string): boolean {
  const c = crudo.trim()
  return c.length >= 3 && c.length <= 254 && CORREO.test(c)
}

/**
 * La llave del correo para el candado: minúsculas y sin la `+etiqueta` de la
 * parte local (`ana+x@a.mx` y `Ana@A.mx` son la misma persona). null si no
 * tiene forma de correo.
 */
export function normalizarCorreo(crudo: string): string | null {
  if (!correoValido(crudo)) return null
  const c = crudo.trim().toLowerCase()
  const arroba = c.lastIndexOf('@')
  const local = c.slice(0, arroba).split('+')[0] ?? ''
  if (local === '') return null
  return `${local}${c.slice(arroba)}`
}
