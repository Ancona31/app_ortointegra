/**
 * comprobanteReserva.ts — el comprobante de la reserva por enlace con su
 * registro en `cita_correos` (agenda E5 + E4, plan_E lista A 4). SÓLO
 * SERVIDOR; corre en el `after()` de POST /api/reservar/[codigo].
 *
 * Tomar el envío (`cita_correo_tomar` con `tipo: 'comprobante'`) → emitir el
 * enlace de confirmación (E2) → componer (determinista) → mandar con
 * `Idempotency-Key = comprobante/<envío>` → cerrar (`cita_correo_marcar`).
 * Así la tarea de recordatorios NO manda otro correo para ese mismo inicio
 * (`cita_correo_tomar` del recordatorio lo salta si el comprobante salió o
 * se está mandando): una reserva hecha dentro de la ventana recibe UNO.
 *
 * Destinatario: el que da la base (`r_para`, la misma expresión que el
 * recordatorio), no el cuerpo de la petición.
 *
 * TOLERANTE, con lo que menos cambia lo de hoy (D8):
 *   · sin las RPC de E4 (migración sin aplicar) o si la toma FALLA: el
 *     comprobante sale igual, sin registro, al correo que se escribió. Sin
 *     registro, el recordatorio de esa cita podría salir también: es el D8
 *     de siempre más un recordatorio, nunca menos que hoy.
 *   · la base dice que no toca (la clínica perdió el acceso en ese instante,
 *     la cita ya no está agendada…): no se manda.
 *   · sin enlace: el comprobante de D8 sin enlace (se marca enviado igual).
 *   · un fallo del transporte se marca `fallido` (no impide el recordatorio).
 * ⚠️ CLIENTE DE SERVICIO SÓLO `.rpc()`, con `p_clinica_id` (recordatorios.ts).
 * Nunca lanza; al logger sólo etiquetas.
 */
import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'
import { enviarCorreo } from '@/lib/correo/transporte'
import { emitirEnlaceConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import { RecordatoriosNoDisponibles, marcarEnvio, tomarEnvio, type Cierre, type Toma } from '@/lib/confirmacion/recordatorios'
import { correoComprobante, type DatosComprobante } from '@/lib/reserva/correosReserva'

const TAG = 'reserva'
const ETIQUETA = 'reserva_comprobante'

export interface Comprobante {
  clinicaId: string
  citaId: string
  /** El correo que escribió la persona: sólo si no hay registro de E4. */
  correoEscrito: string
  /** Lo que pinta la plantilla, salvo el enlace. */
  datos: Omit<DatosComprobante, 'urlConfirmacion'>
}

async function componer(c: Comprobante): Promise<ReturnType<typeof correoComprobante>> {
  // Nunca lanza (E2); el catch es por si eso cambia: sin enlace, sale el comprobante de D8.
  const enlace = await emitirEnlaceConfirmacion(c.clinicaId, c.citaId, null).catch(() => null)
  return correoComprobante({ ...c.datos, urlConfirmacion: enlace?.url ?? null })
}

type Toma0 = { tipo: 'toma'; toma: Toma } | { tipo: 'sin_registro' } | { tipo: 'no_toca' }

async function tomarComprobante(c: Comprobante, testigo: string): Promise<Toma0> {
  try {
    const toma = await tomarEnvio(c.clinicaId, c.citaId, 'comprobante', testigo)
    return toma ? { tipo: 'toma', toma } : { tipo: 'no_toca' }
  } catch (e) {
    if (!(e instanceof RecordatoriosNoDisponibles)) logger.error(TAG, 'comprobante: no se pudo registrar; sale sin registro')
    return { tipo: 'sin_registro' }
  }
}

/** Manda el comprobante de una reserva NUEVA. Nunca lanza. */
export async function enviarComprobante(c: Comprobante): Promise<void> {
  try {
    const testigo = randomUUID()
    const t = await tomarComprobante(c, testigo)
    if (t.tipo === 'no_toca') return
    const correo = await componer(c)
    if (t.tipo === 'sin_registro') {
      await enviarCorreo({ para: c.correoEscrito, ...correo, etiqueta: ETIQUETA })
      return
    }
    const r = await enviarCorreo({ para: t.toma.r_para, ...correo, etiqueta: ETIQUETA, idempotencia: `comprobante/${t.toma.r_envio_id}` })
    const cierre: Cierre = r.ok ? { estado: 'enviado', motivo: null }
      : { estado: 'fallido', motivo: r.motivo === 'duplicado' ? 'duplicado' : 'transporte' }
    if (!(await marcarEnvio(c.clinicaId, t.toma.r_envio_id, testigo, cierre))) logger.warn(TAG, 'comprobante cerrado por otra ejecución')
  } catch (err) {
    logger.error(TAG, `comprobante no enviado: ${err instanceof Error ? err.name : 'desconocido'}`)
  }
}
