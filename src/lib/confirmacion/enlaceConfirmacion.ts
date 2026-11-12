/**
 * enlaceConfirmacion.ts — el enlace de confirmación de una cita en el servidor
 * (agenda E2). SÓLO SERVIDOR: nada de esto se importa desde un componente.
 *
 * El código del enlace NO se guarda: es `codigoDeConfirmacion(id)` (HMAC con
 * la subllave `confirmacion` de RESERVA_SECRETO) y la base sólo tiene su
 * sha256. La URL es `<NEXT_PUBLIC_APP_URL>/confirmar/<código de 22>`: sin
 * datos personales, sin ids, sin nada más.
 *
 * ⚠️ CLIENTE DE SERVICIO SÓLO PARA `.rpc()`, NUNCA `.from()` (pendiente
 * prioritario de CLAUDE.md). Las RPC de E1 son INVOKER, sólo `service_role`,
 * y emitir / revocar / responder llevan `p_clinica_id` OBLIGATORIO, que la
 * base vuelve a casar con la fila. La clínica de `resolver` sale de la base
 * por el hash del código, nunca de la petición.
 *
 * TOLERANTE Y CERRADO: sin secreto, con el interruptor apagado (lo decide la
 * base), con las migraciones de E1 sin aplicar (PGRST202 / 42883 / 42P01 /
 * PGRST205) o ante cualquier error, todo devuelve null / false y nada lanza:
 * no hay enlace y la agenda sigue como hoy.
 *
 * Para quien construya encima (E3-E9):
 *   - emitir   → correo (E4/E5), WhatsApp (E7), reagendar (E6).
 *   - resolver → página GET /confirmar/[codigo] (E3): STABLE, no escribe.
 *   - responder → SÓLO el POST de /api/confirmar/[codigo] (E3), nunca un GET.
 *   - revocar  → reagendar (E6), o cuando el enlace ya no deba valer.
 */
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { codigoDeConfirmacion, esCodigoDeEnlace, hashDeCodigo, secretoDisponible } from '@/lib/reserva/secretos'

const TAG = 'confirmacion'
const CODIGOS_AUSENTE = new Set(['PGRST202', '42883', '42P01', 'PGRST205'])
const UUID = z.guid()
const HEX64 = z.string().regex(/^[0-9a-f]{64}$/)
const FECHA = z.iso.datetime({ offset: true })

/** Un enlace listo para enseñar. `url` es lo único que sale hacia el paciente. */
export interface EnlaceConfirmacion { id: string; codigo: string; url: string }

const ContextoSchema = z.object({
  clinica_id: UUID,
  estado: z.enum(['agendada', 'confirmada', 'cancelada', 'cerrada', 'pasada']),
  inicio: FECHA,
  fin: FECHA,
  zona: z.string().nullable(),
  medico: z.object({
    titulo: z.string().nullable(), nombres: z.string().nullable(),
    apellido_paterno: z.string().nullable(), apellido_materno: z.string().nullable(),
  }).nullable(),
  consultorio: z.object({ nombre: z.string().nullable(), direccion: z.string().nullable(), telefono: z.string().nullable() }),
  puede_confirmar: z.boolean(),
  puede_cancelar: z.boolean(),
  corte_cancelar: FECHA,
  respuesta: z.enum(['confirmo', 'cancelo']).nullable(),
})
/**
 * Lo que la página puede enseñar, más `clinica_id` y `codigo_hash` para el
 * POST. ⚠️ `clinica_id` y `codigo_hash` NO van al HTML.
 */
export type ContextoConfirmacion = z.infer<typeof ContextoSchema> & { codigo_hash: string }

export const RESULTADOS_RESPUESTA = [
  'confirmada', 'cancelada', 'ya_confirmada', 'ya_cancelada', 'cerrada', 'pasada', 'fuera_de_plazo', 'invalido',
] as const
const RespuestaSchema = z.object({
  r_resultado: z.enum(RESULTADOS_RESPUESTA),
  r_cita_id: UUID.nullable(),
  r_google_event_id: z.string().nullable(),
  r_gcal_etag: z.string().nullable(),
})
/** Fila de `cita_confirmacion_responder`. `r_google_event_id`/`r_gcal_etag` sólo con confirmada o cancelada. */
export type RespuestaConfirmacion = z.infer<typeof RespuestaSchema>
export type AccionConfirmacion = 'confirmar' | 'cancelar'

const EmisionSchema = z.object({ r_id: UUID.nullable(), r_codigo_hash: HEX64.nullable() })

type Llamada = { ok: true; data: unknown } | { ok: false }

async function llamar(rpc: string, args: Record<string, unknown>, unaFila: boolean): Promise<Llamada> {
  try {
    const consulta = createAdminClient().rpc(rpc, args)
    const { data, error } = unaFila ? await consulta.single() : await consulta
    if (!error) return { ok: true, data }
    const codigo: string | undefined = error.code
    // Sólo el nombre de la RPC y el código: el mensaje puede repetir datos.
    if (codigo !== undefined && CODIGOS_AUSENTE.has(codigo)) logger.warn(TAG, `${rpc} no disponible: ${codigo}`)
    else logger.error(TAG, `${rpc} falló: ${codigo ?? 'sin código'}`)
    return { ok: false }
  } catch {
    logger.error(TAG, `${rpc} lanzó`)
    return { ok: false }
  }
}

/** Origen público de la app (mismo valor por omisión que el resto del repo), o null si no es http(s) sin ruta. */
function baseUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx').trim().replace(/\/+$/, '')
  return /^https?:\/\/[^/?#\s]+$/.test(base) ? base : null
}

/** La URL pública de un código, o null si el código no tiene forma o no hay base de URL válida. */
export function urlDeConfirmacion(codigo: string): string | null {
  const base = baseUrl()
  return base && esCodigoDeEnlace(codigo) ? `${base}/confirmar/${codigo}` : null
}

async function emitirUnaVez(clinicaId: string, citaId: string, creadoPor: string | null): Promise<{ id: string; hash: string } | null> {
  const id = randomUUID()
  const codigo = codigoDeConfirmacion(id)
  if (!codigo) return null
  const r = await llamar('cita_confirmacion_emitir', {
    p_clinica_id: clinicaId, p_cita_id: citaId, p_id: id, p_codigo_hash: hashDeCodigo(codigo), p_creado_por: creadoPor,
  }, true)
  if (!r.ok) return null
  const p = EmisionSchema.safeParse(r.data)
  if (!p.success) { logger.error(TAG, 'cita_confirmacion_emitir: forma inesperada'); return null }
  return p.data.r_id && p.data.r_codigo_hash ? { id: p.data.r_id, hash: p.data.r_codigo_hash } : null
}

/**
 * Emite el enlace de la cita, o devuelve el vigente (la base decide: uno por
 * cita, atado a su paciente o, por ligar, al correo de la reserva). null si no
 * aplica (interruptor apagado, clínica sin acceso, cita pasada, cancelada,
 * atendida, de todo el día, sin destinatario u otra clínica), sin secreto o
 * ante un error; sin secreto o sin URL base válida, sin escribir nada.
 * `creadoPor` = perfil de quien lo pide; null para el sistema (tarea programada).
 * Si el vigente se emitió con OTRO secreto (se rotó RESERVA_SECRETO), su
 * código ya no se puede derivar: se revoca y se emite uno nuevo, una vez.
 */
export async function emitirEnlaceConfirmacion(clinicaId: string, citaId: string, creadoPor: string | null): Promise<EnlaceConfirmacion | null> {
  if (!secretoDisponible() || baseUrl() === null) return null
  if (!UUID.safeParse(clinicaId).success || !UUID.safeParse(citaId).success) return null
  const autor = creadoPor !== null && UUID.safeParse(creadoPor).success ? creadoPor : null
  for (let intento = 0; intento < 2; intento++) {
    const e = await emitirUnaVez(clinicaId, citaId, autor)
    if (!e) return null
    const codigo = codigoDeConfirmacion(e.id)
    if (codigo && hashDeCodigo(codigo) === e.hash) {
      const url = urlDeConfirmacion(codigo)
      return url ? { id: e.id, codigo, url } : null
    }
    if (intento === 0 && !(await revocarEnlaceConfirmacion(clinicaId, citaId))) return null
  }
  logger.error(TAG, 'cita_confirmacion_emitir: el código emitido no coincide con el guardado')
  return null
}

/**
 * Lo que la página enseña de un código, o null (mala forma, sin secreto,
 * inexistente, revocado, interruptor apagado, el paciente de la cita cambió,
 * RPC ausente o error). NO escribe nada: la base la declara STABLE.
 */
export async function resolverEnlaceConfirmacion(codigo: string): Promise<ContextoConfirmacion | null> {
  if (!secretoDisponible() || !esCodigoDeEnlace(codigo)) return null
  const codigoHash = hashDeCodigo(codigo)
  const r = await llamar('cita_confirmacion_contexto', { p_codigo_hash: codigoHash }, false)
  if (!r.ok || r.data === null) return null
  const p = ContextoSchema.safeParse(r.data)
  if (!p.success) { logger.error(TAG, 'cita_confirmacion_contexto: forma inesperada'); return null }
  return { ...p.data, codigo_hash: codigoHash }
}

/**
 * La respuesta del paciente: SÓLO desde un POST (nunca al abrir el enlace).
 * `ctx` sale de `resolverEnlaceConfirmacion`. null si la RPC falla o falta;
 * la base decide plazos y transiciones y deja la auditoría (`via` =
 * `enlace_paciente`).
 */
export async function responderEnlaceConfirmacion(ctx: ContextoConfirmacion, accion: AccionConfirmacion): Promise<RespuestaConfirmacion | null> {
  if (accion !== 'confirmar' && accion !== 'cancelar') return null
  const r = await llamar('cita_confirmacion_responder', {
    p_clinica_id: ctx.clinica_id, p_codigo_hash: ctx.codigo_hash, p_accion: accion,
  }, true)
  if (!r.ok) return null
  const p = RespuestaSchema.safeParse(r.data)
  if (!p.success) { logger.error(TAG, 'cita_confirmacion_responder: forma inesperada'); return null }
  return p.data
}

/**
 * Revoca el enlace vigente de la cita (nunca borra). true si la llamada salió, haya o no un vigente.
 * No exige RESERVA_SECRETO a propósito: no deriva nada de él, y revocar sin secreto es lo seguro.
 */
export async function revocarEnlaceConfirmacion(clinicaId: string, citaId: string): Promise<boolean> {
  if (!UUID.safeParse(clinicaId).success || !UUID.safeParse(citaId).success) return false
  const r = await llamar('cita_confirmacion_revocar', { p_clinica_id: clinicaId, p_cita_id: citaId }, false)
  return r.ok && typeof r.data === 'number'
}
