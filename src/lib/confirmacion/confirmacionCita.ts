/**
 * confirmacionCita.ts — el correo de CONFIRMACIÓN de una cita que manda el
 * personal desde la agenda (G3, punto 14 de la tanda de diseño), con o sin
 * Google conectado. SÓLO SERVIDOR; lo llama `POST /api/agenda/correo` DESPUÉS
 * de sus puertas de sesión (interruptor, la cita vista con la RLS y la regla
 * `motivoSinCorreo`).
 *
 * Mismo camino que el recordatorio (E4) y el comprobante (E5): tomar el envío
 * (`cita_correo_tomar` con `tipo: 'confirmacion'`, migración 20261119140000)
 * → emitir el enlace de confirmación (E2, el mismo HMAC y la misma regla de un
 * solo código vigente por cita) → componer (determinista, la plantilla de los
 * correos de cita) → mandar por `transporte.ts` con `Idempotency-Key =
 * confirmacion/<envío>` → cerrar (`cita_correo_marcar`). El destinatario es el
 * de la base (`r_para`), nunca uno que venga de la petición.
 *
 * El límite («no reenviar en ráfaga») lo pone la base: UNA confirmación por
 * hora de inicio; sólo se vuelve a tomar si la anterior falló (no por
 * duplicado) o quedó colgada, y como mucho 3 veces.
 *
 * ⚠️ CLIENTE DE SERVICIO SÓLO `.rpc()`, con `p_clinica_id` de la SESIÓN
 * (recordatorios.ts); la base lo vuelve a casar con la fila. Nunca lanza; al
 * logger sólo etiquetas (ni correo, ni URL, ni ids).
 */
import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'
import { enviarCorreo } from '@/lib/correo/transporte'
import { emitirEnlaceConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import { correoCambio, correoConfirmacion } from '@/lib/confirmacion/correosCita'
import { RecordatoriosNoDisponibles, marcarEnvio, tomarEnvio, type Cierre, type Toma } from '@/lib/confirmacion/recordatorios'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

const TAG = 'agenda'
const ETIQUETA = 'cita_confirmacion'

export type ResultadoConfirmacion =
  | { tipo: 'enviado' }
  /** La base no dio el envío: ya salió (o está saliendo) para esa hora, o la cita dejó de admitirlo. */
  | { tipo: 'no_toca' }
  /** Sin la migración de G3 (o de E4) o la base falló: no se mandó nada. */
  | { tipo: 'no_disponible' }
  /** Sin `RESERVA_SECRETO` o sin la base de E1: no hay enlace; no se mandó. */
  | { tipo: 'sin_enlace' }
  /** El transporte falló (o lo tiene apagado): queda `fallido` y se puede reintentar. */
  | { tipo: 'fallido' }

async function tomar(clinicaId: string, citaId: string, testigo: string): Promise<Toma | null | 'no_disponible'> {
  try {
    return await tomarEnvio(clinicaId, citaId, 'confirmacion', testigo)
  } catch (e) {
    if (!(e instanceof RecordatoriosNoDisponibles)) logger.error(TAG, `confirmación por correo: toma fallida (${e instanceof Error ? e.name : 'desconocido'})`)
    return 'no_disponible'
  }
}

/** Compone y manda la confirmación ya tomada. Devuelve cómo cerrarla. */
async function mandar(clinicaId: string, citaId: string, perfilId: string, t: Toma, o: OpcionesConfirmacion): Promise<Cierre> {
  const enlace = await emitirEnlaceConfirmacion(clinicaId, citaId, perfilId)
  if (!enlace) return { estado: 'omitido', motivo: 'sin_enlace' }
  let correo
  try {
    const datos = {
      inicio: t.r_inicio, zona: t.r_zona,
      medico: t.r_medico ? componerNombreMedicoCompleto(t.r_medico) : '',
      consultorio: t.r_consultorio, confirmada: t.r_estado === 'confirmed', url: enlace.url,
    }
    // Tanda L (punto 15) e integración M: la confirmación y el aviso de cambio saludan por el nombre.
    correo = o.cambio === true ? correoCambio(datos, o.nombre ?? null) : correoConfirmacion(datos, o.nombre ?? null)
  } catch {
    return { estado: 'omitido', motivo: 'plantilla' }
  }
  const r = await enviarCorreo({ para: t.r_para, ...correo, etiqueta: ETIQUETA, idempotencia: `confirmacion/${t.r_envio_id}` })
  if (r.ok) return { estado: 'enviado', motivo: null }
  return { estado: 'fallido', motivo: r.motivo === 'duplicado' ? 'duplicado' : 'transporte' }
}

function resultadoDe(c: Cierre): ResultadoConfirmacion {
  if (c.estado === 'enviado') return { tipo: 'enviado' }
  if (c.motivo === 'sin_enlace') return { tipo: 'sin_enlace' }
  return c.motivo === 'duplicado' ? { tipo: 'no_toca' } : { tipo: 'fallido' }
}

/** Cierra el envío. Un fallo aquí no cambia lo que ya pasó con el correo (se suelta solo a los 10 min). */
async function cerrar(clinicaId: string, envioId: string, testigo: string, cierre: Cierre): Promise<void> {
  try {
    if (!(await marcarEnvio(clinicaId, envioId, testigo, cierre))) logger.warn(TAG, 'confirmación por correo cerrada por otra ejecución')
  } catch (e) {
    logger.error(TAG, `confirmación por correo sin cerrar: ${e instanceof Error ? e.name : 'desconocido'}`)
  }
}

/**
 * `cambio` (tanda I, punto 9): las palabras del aviso de cambio. `nombre` (tanda L, punto 15): el nombre
 * con que saluda la confirmación; lo lee la ruta con la SESIÓN (RLS), nunca viene de la petición.
 */
export interface OpcionesConfirmacion { cambio?: boolean; nombre?: string | null }

/**
 * Manda la confirmación de UNA cita. `perfilId`: quien la manda (queda en el
 * enlace emitido). Con `cambio` (tanda I, punto 9: «Reagendar» de una cita por
 * enlace), las palabras del aviso de cambio (`correoCambio`); el registro es el
 * mismo (`tipo: 'confirmacion'` del NUEVO inicio). Nunca lanza.
 */
export async function enviarConfirmacionCita(clinicaId: string, citaId: string, perfilId: string, opciones: OpcionesConfirmacion = {}): Promise<ResultadoConfirmacion> {
  try {
    const testigo = randomUUID()
    const t = await tomar(clinicaId, citaId, testigo)
    if (t === 'no_disponible') return { tipo: 'no_disponible' }
    if (!t) return { tipo: 'no_toca' }
    const cierre = await mandar(clinicaId, citaId, perfilId, t, opciones)
    await cerrar(clinicaId, t.r_envio_id, testigo, cierre)
    return resultadoDe(cierre)
  } catch (e) {
    logger.error(TAG, `confirmación por correo sin enviar: ${e instanceof Error ? e.name : 'desconocido'}`)
    return { tipo: 'no_disponible' }
  }
}
