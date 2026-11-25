/**
 * avisoCancelacion.ts — «avisa a la clínica» cuando un paciente cancela por
 * el enlace (agenda E8, §2 «Cancelación por el paciente … avisa a la
 * clínica»). Puro. Sin correo a la clínica (plan_E lista A 12): un aviso en la
 * agenda abierta y la sección «Canceladas por el paciente (48 h)» del panel.
 *
 * Dos pasos, para no pedir nada por cada evento de tiempo real:
 *   1. `esCancelacionAjena`: el canal trajo un UPDATE a `cancelled` de una
 *      cita PINTADA que no estaba cancelada, y no es eco propio. Sólo entonces
 *      la agenda pregunta a `GET /api/agenda/respuestas?cita=`.
 *   2. `esRespuestaReciente`: la respuesta es «cancelo» de hace menos de 2 min
 *      (si no, la canceló el personal, Google, o es una respuesta vieja).
 */

/** Antigüedad máxima de la respuesta para avisar. */
export const AVISO_CANCELACION_MS = 120_000
/** Ventana de la sección «Canceladas por el paciente». */
export const VENTANA_CANCELADAS_MS = 48 * 3_600_000

/** Una fila de «Canceladas por el paciente (48 h)» (`GET /api/agenda/por-confirmar`). */
export interface FilaCancelada {
  id: string
  inicio: string
  zona: string
  titulo: string
  respondido_en: string
}

export interface CambioRealtime {
  tipo: 'INSERT' | 'UPDATE' | 'DELETE'
  /** `status` de la fila que llegó. */
  statusNuevo: string | null | undefined
  /** `status` del evento ya pintado, o undefined si no está pintado. */
  statusPintado: string | null | undefined
  /** La firma (`client_id`) era de esta pestaña. */
  esEco: boolean
}

export function esCancelacionAjena(c: CambioRealtime): boolean {
  return c.tipo === 'UPDATE' && !c.esEco && c.statusNuevo === 'cancelled'
    && typeof c.statusPintado === 'string' && c.statusPintado !== 'cancelled'
}

/** «Un paciente canceló su cita del martes 17 de noviembre a las 10:00» (zona del consultorio). Sin nombre. */
export function textoAvisoCancelacion(inicio: string | null, zona: string | null): string {
  if (!inicio) return 'Un paciente canceló su cita por el enlace.'
  try {
    const tz = zona || 'America/Mexico_City'
    const d = new Date(inicio)
    const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(d)
    const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d)
    return `Un paciente canceló su cita del ${fecha} a las ${hora}.`
  } catch {
    return 'Un paciente canceló su cita por el enlace.'
  }
}

/** La respuesta de `GET /api/agenda/respuestas`, validada sin `as`. */
export function leerRespuesta(d: unknown): { respuesta: string | null; respondidoEn: string | null } {
  const o = typeof d === 'object' && d !== null ? d : {}
  return {
    respuesta: 'respuesta' in o && typeof o.respuesta === 'string' ? o.respuesta : null,
    respondidoEn: 'respondido_en' in o && typeof o.respondido_en === 'string' ? o.respondido_en : null,
  }
}

export function esRespuestaReciente(respuesta: string | null, respondidoEn: string | null, ahora: number): boolean {
  if (respuesta !== 'cancelo' || !respondidoEn) return false
  const t = Date.parse(respondidoEn)
  return Number.isFinite(t) && ahora - t >= -5_000 && ahora - t < AVISO_CANCELACION_MS
}
