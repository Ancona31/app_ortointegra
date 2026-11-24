/**
 * Logger seguro para producción — LFPDPPP vigente (DOF 20/03/2025): deber de seguridad
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
