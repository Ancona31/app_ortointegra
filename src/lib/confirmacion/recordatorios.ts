/**
 * recordatorios.ts — el recordatorio por correo N horas antes de la cita
 * (agenda E4). SÓLO SERVIDOR. Lo recorre la tarea programada
 * `GET /api/cron/recordatorios`.
 *
 * Por cada cita: tomar el envío (`cita_correo_tomar`, con el testigo de la
 * ejecución) → emitir el enlace de confirmación (E2) → componer el correo
 * (determinista) → mandarlo con `Idempotency-Key = recordatorio/<envío>` →
 * cerrar el envío (`cita_correo_marcar`). La base decide quién toca: ventana
 * (ahora+1 h, ahora+N h], interruptor, puerta S3, destinatario, que no haya
 * salido ya el comprobante para ese inicio y los 3 intentos.
 *
 * ⚠️ TANDA H (punto 9 de Angel): el recordatorio tiene su PROPIO interruptor
 * por clínica, `agenda_ajustes.recordatorio_encendido`, APAGADO de fábrica.
 * Lo aplica el listado (`cita_recordatorios_pendientes`, migración
 * `20261120120000`) en la misma consulta que elige a las clínicas: una
 * clínica apagada no da ninguna cita. Sin esa migración la función no existe
 * (PGRST202) y no se manda NADA: «apagado de fábrica» también sin la columna.
 * No vuelvas a llamar a `cita_correos_pendientes` (la de E4, sin interruptor).
 * El comprobante y la confirmación manual no pasan por aquí y no dependen
 * de este interruptor.
 *
 * ⚠️ CLIENTE DE SERVICIO SÓLO PARA `.rpc()`, NUNCA `.from()` (pendiente
 * prioritario de CLAUDE.md). El listado es la única lectura entre clínicas y
 * devuelve sólo (clínica, cita); tomar y marcar llevan `p_clinica_id`, que la
 * base vuelve a casar con la fila. El `clinicaId` sale del listado, nunca de
 * una petición.
 *
 * TOLERANTE: sin las migraciones (PGRST202 / 42883 / 42P01 / PGRST205), el
 * listado queda vacío y no pasa nada. Nada lanza hacia fuera salvo un fallo
 * inesperado del listado, que la ruta traduce a 500 sin cuerpo.
 *
 * Al logger sólo van etiquetas y conteos: nunca el correo, la URL ni ids.
 */
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { enviarCorreo } from '@/lib/correo/transporte'
import { emitirEnlaceParaCorreo } from '@/lib/confirmacion/enlaceConfirmacion'
import { correoRecordatorio } from '@/lib/confirmacion/correosCita'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

const TAG = 'recordatorios'
const CODIGOS_AUSENTE = new Set(['PGRST202', '42883', '42P01', 'PGRST205'])
const UUID = z.guid()

/** Las RPC de E4 no están en esta base. No es un fallo: no hay nada que mandar. */
export class RecordatoriosNoDisponibles extends Error {
  constructor() {
    super('recordatorios no disponibles: faltan las RPC de E4')
    this.name = 'RecordatoriosNoDisponibles'
  }
}

async function llamar(rpc: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await createAdminClient().rpc(rpc, args)
  if (!error) return data
  const codigo: string | undefined = error.code
  if (codigo !== undefined && CODIGOS_AUSENTE.has(codigo)) throw new RecordatoriosNoDisponibles()
  // Sólo el nombre de la RPC y el código: el mensaje puede repetir datos.
  throw new Error(`${rpc}: ${codigo ?? 'sin código'}`)
}

const PendienteSchema = z.object({ r_clinica_id: UUID, r_cita_id: UUID })
export interface Pendiente { clinicaId: string; citaId: string }

/** Las citas que tocan ahora, de todas las clínicas con la v2 Y el recordatorio encendidos. Sólo ids. */
export async function listarRecordatoriosPendientes(limite: number): Promise<Pendiente[]> {
  const data = await llamar('cita_recordatorios_pendientes', { p_limite: limite })
  return z.array(PendienteSchema).parse(data ?? []).map((f) => ({ clinicaId: f.r_clinica_id, citaId: f.r_cita_id }))
}

const NombreSchema = z.object({
  titulo: z.string().nullable(), nombres: z.string().nullable(),
  apellido_paterno: z.string().nullable(), apellido_materno: z.string().nullable(),
})
const TomaSchema = z.object({
  r_envio_id: UUID,
  r_para: z.string().min(3),
  r_inicio: z.string(),
  r_fin: z.string(),
  r_zona: z.string().nullable(),
  r_estado: z.enum(['scheduled', 'confirmed']),
  r_medico: NombreSchema.nullable(),
  r_consultorio: z.object({ nombre: z.string().nullable(), direccion: z.string().nullable(), telefono: z.string().nullable() }),
})
export type Toma = z.infer<typeof TomaSchema>

export type Cierre = { estado: 'enviado'; motivo: null } | { estado: 'fallido' | 'omitido'; motivo: 'transporte' | 'duplicado' | 'sin_enlace' | 'plantilla' }

/** Los tipos de `cita_correos`. `confirmacion` es de G3 (migración 20261119140000). */
export type TipoEnvio = 'recordatorio' | 'comprobante' | 'confirmacion'

/**
 * Toma UN envío de `tipo` (`cita_correo_tomar`). null = la base dice que no
 * toca. Lanza `RecordatoriosNoDisponibles` sin las RPC de E4 y Error ante otro
 * fallo. La usa también el comprobante de la reserva por enlace (E5,
 * `comprobanteReserva.ts`), con `tipo: 'comprobante'`, y el correo de
 * confirmación que manda el personal (G3, `confirmacionCita.ts`), con
 * `tipo: 'confirmacion'`.
 */
export async function tomarEnvio(clinicaId: string, citaId: string, tipo: TipoEnvio, testigo: string): Promise<Toma | null> {
  const data = await llamar('cita_correo_tomar', { p_clinica_id: clinicaId, p_cita_id: citaId, p_tipo: tipo, p_testigo: testigo })
  const filas = z.array(TomaSchema).parse(data ?? [])
  return filas[0] ?? null
}

async function tomar(clinicaId: string, citaId: string, testigo: string): Promise<Toma | null> {
  return tomarEnvio(clinicaId, citaId, 'recordatorio', testigo)
}

/** Cierra UN envío tomado por `testigo` (`cita_correo_marcar`). false = ya no era suyo. */
export async function marcarEnvio(clinicaId: string, envioId: string, testigo: string, c: Cierre): Promise<boolean> {
  return marcar(clinicaId, envioId, testigo, c)
}

async function marcar(clinicaId: string, envioId: string, testigo: string, c: Cierre): Promise<boolean> {
  return z.boolean().parse(await llamar('cita_correo_marcar', {
    p_clinica_id: clinicaId, p_envio_id: envioId, p_testigo: testigo, p_estado: c.estado, p_motivo: c.motivo,
  }))
}

/**
 * Integración M: el nombre del saludo (`cita_nombre_saludo`, migración
 * `20261125180000`: el paciente ligado y, si no, la reserva). Nunca lanza: sin
 * la función o con cualquier fallo, null y el recordatorio sale con «Hola:».
 */
async function nombreDelSaludo(clinicaId: string, citaId: string): Promise<string | null> {
  try {
    const n = z.string().nullable().safeParse(await llamar('cita_nombre_saludo', { p_clinica_id: clinicaId, p_cita_id: citaId }))
    return n.success ? n.data : null
  } catch {
    return null
  }
}

/** Compone y manda UN recordatorio ya tomado. Devuelve cómo cerrarlo. */
async function mandar(clinicaId: string, citaId: string, t: Toma): Promise<Cierre> {
  const enlace = await emitirEnlaceParaCorreo(clinicaId, citaId, null)
  // Oleada 3, arreglo 4: un ERROR queda `fallido` (F4: `cita_correo_tomar` lo vuelve a tomar, hasta 3
  // intentos, y `cita_recordatorios_pendientes` lo vuelve a listar); sólo lo que no aplica, `omitido`.
  if (enlace === 'error') return { estado: 'fallido', motivo: 'sin_enlace' }
  if (enlace === 'no_aplica') return { estado: 'omitido', motivo: 'sin_enlace' }
  const nombre = await nombreDelSaludo(clinicaId, citaId)
  let correo
  try {
    correo = correoRecordatorio({
      inicio: t.r_inicio, zona: t.r_zona,
      medico: t.r_medico ? componerNombreMedicoCompleto(t.r_medico) : '',
      consultorio: t.r_consultorio, confirmada: t.r_estado === 'confirmed', url: enlace.url,
    }, nombre)
  } catch {
    return { estado: 'omitido', motivo: 'plantilla' }
  }
  const r = await enviarCorreo({ para: t.r_para, ...correo, etiqueta: 'recordatorio', idempotencia: `recordatorio/${t.r_envio_id}` })
  if (r.ok) return { estado: 'enviado', motivo: null }
  return { estado: 'fallido', motivo: r.motivo === 'duplicado' ? 'duplicado' : 'transporte' }
}

export type ResultadoRecordatorio = 'no_toca' | 'enviado' | 'fallido' | 'omitido' | 'error'

/**
 * Procesa UNA cita del listado. Nunca lanza. 'no_toca' = la base no la dio
 * (otra ejecución la tiene, ya salió, salió de la ventana…); 'error' = falló
 * la base (el envío tomado se soltará solo a los 10 min).
 */
export async function procesarRecordatorio(clinicaId: string, citaId: string, testigo: string): Promise<ResultadoRecordatorio> {
  try {
    const t = await tomar(clinicaId, citaId, testigo)
    if (!t) return 'no_toca'
    const cierre = await mandar(clinicaId, citaId, t)
    if (!(await marcar(clinicaId, t.r_envio_id, testigo, cierre))) logger.warn(TAG, 'envío cerrado por otra ejecución')
    return cierre.estado
  } catch (e) {
    logger.error(TAG, `cita sin procesar: ${e instanceof Error ? e.name : 'desconocido'}`)
    return 'error'
  }
}

export interface OpcionesRecorrido {
  testigo: string
  limite: number
  presupuestoMs: number
  /** Pausa entre envíos que llegaron a salir (límite por segundo de Resend). */
  pausaMs: number
  ahora?: () => number
  dormir?: (ms: number) => Promise<void>
}

export type Conteo = Record<ResultadoRecordatorio, number>

const dormirReal = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Recorre el listado en serie dentro del presupuesto. Devuelve conteos (sólo
 * para el log). Sin las RPC de E4: conteos en cero. Lanza sólo si el listado
 * falla por otra causa.
 */
export async function recorrerRecordatorios(op: OpcionesRecorrido): Promise<Conteo> {
  const ahora = op.ahora ?? Date.now
  const dormir = op.dormir ?? dormirReal
  const inicio = ahora()
  const conteo: Conteo = { no_toca: 0, enviado: 0, fallido: 0, omitido: 0, error: 0 }
  let pendientes: Pendiente[]
  try {
    pendientes = await listarRecordatoriosPendientes(op.limite)
  } catch (e) {
    if (e instanceof RecordatoriosNoDisponibles) { logger.warn(TAG, e.message); return conteo }
    throw e
  }
  for (const p of pendientes) {
    if (ahora() - inicio >= op.presupuestoMs) break
    const r = await procesarRecordatorio(p.clinicaId, p.citaId, op.testigo)
    conteo[r] += 1
    if (r === 'enviado' || r === 'fallido') await dormir(op.pausaMs)
  }
  return conteo
}
