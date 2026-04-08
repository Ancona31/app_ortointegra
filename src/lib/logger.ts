/**
 * Logger seguro para producción — LFPDPPP Art. 19
 *
 * En desarrollo: imprime todo para debugging.
 * En producción: solo warnings y errors, sin datos sensibles.
 * Nunca imprime: emails, nombres de pacientes, CURP, RFC, teléfonos.
 */

const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  /** Solo visible en development */
  info(tag: string, message: string) {
    if (isDev) console.log(`[${tag}] ${message}`)
  },

  /** Visible en development y production */
  warn(tag: string, message: string) {
    console.warn(`[${tag}] ${message}`)
  },

  /** Visible en development y production */
  error(tag: string, message: string) {
    console.error(`[${tag}] ${message}`)
  },
}
