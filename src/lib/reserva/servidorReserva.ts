/**
 * servidorReserva.ts — las llamadas a la base de la reserva por enlace
 * (agenda D5). SÓLO SERVIDOR.
 *
 * ⚠️ CLIENTE DE SERVICIO SÓLO PARA `.rpc()`, NUNCA `.from()` (pendiente
 * prioritario de CLAUDE.md). Las RPC de D3 son INVOKER, sólo `service_role`,
 * y cada una vuelve a casar `p_clinica_id` con el enlace. La clínica sale de
 * `reserva_contexto` (por el hash del código), nunca de la petición.
 *
 * TOLERANTE: si la RPC no existe (migraciones de D sin aplicar en
 * producción) se devuelve «no disponible» y la ruta contesta 404, igual que
 * un enlace que no existe. Nada lanza hacia la página.
 */
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const CODIGOS_AUSENTE = new Set(['PGRST202', '42883', '42P01', 'PGRST205'])
const TAG = 'reserva'

const HorarioCrudo = z.unknown()

export const ContextoSchema = z.object({
  clinica_id: z.guid(),
  enlace_id: z.guid(),
  medico_id: z.guid(),
  clase: z.enum(['fijo', 'unico']),
  estado: z.enum(['vigente', 'usado', 'caducado']),
  medico: z.object({
    titulo: z.string().nullable(), nombres: z.string().nullable(), apellido_paterno: z.string().nullable(),
    apellido_materno: z.string().nullable(), especialidad: z.string().nullable(), telefono: z.string().nullable(),
  }),
  clinica: z.object({ nombre: z.string().nullable(), nombre_display: z.string().nullable(), horario: HorarioCrudo }).nullable(),
  consultorios: z.array(z.object({
    id: z.guid(), nombre: z.string(), direccion: z.string().nullable(), telefono: z.string().nullable(),
    timezone: z.string(), horario: HorarioCrudo, horario_propio: z.boolean().nullable().optional(),
  })),
  tipos: z.array(z.object({ id: z.guid(), nombre: z.string(), duracion_min: z.number().int() })),
  ajustes: z.object({ anticipacion_min_horas: z.number().int(), horizonte_dias: z.number().int() }),
})
export type ContextoReserva = z.infer<typeof ContextoSchema>

interface ErrorRpc { code?: string; message: string }

/** Resultado de una RPC: los datos, «no disponible» (falta la RPC) o un error con su código SQL. */
export type Llamada<T> = { ok: true; data: T } | { ok: false; ausente: boolean; codigo: string | null }

async function llamar(rpc: string, args: Record<string, unknown>, unaFila = false): Promise<Llamada<unknown>> {
  const consulta = createAdminClient().rpc(rpc, args)
  const { data, error } = unaFila ? await consulta.single() : await consulta
  if (!error) return { ok: true, data }
  const e: ErrorRpc = error
  const ausente = e.code !== undefined && CODIGOS_AUSENTE.has(e.code)
  // Sólo el nombre de la RPC y el código: el mensaje puede repetir datos.
  logger.error(TAG, `${rpc} falló: ${e.code ?? 'sin código'}`)
  return { ok: false, ausente, codigo: e.code ?? null }
}

/** El contexto público del enlace, o null (no existe, apagado, sin aviso, sin acceso, RPC ausente, error). */
export async function contextoDeEnlace(codigoHash: string, avisoVersion: string, avisoSha: string): Promise<ContextoReserva | null> {
  const r = await llamar('reserva_contexto', { p_codigo_hash: codigoHash, p_aviso_version: avisoVersion, p_aviso_sha256: avisoSha })
  if (!r.ok || r.data === null) return null
  const p = ContextoSchema.safeParse(r.data)
  if (!p.success) logger.error(TAG, 'reserva_contexto: forma inesperada')
  return p.success ? p.data : null
}

const OcupacionSchema = z.array(z.object({ start_time: z.string(), end_time: z.string() }))

/** Sólo las puntas de lo que ocupa (nunca títulos). null si falla. */
export async function ocupacionDeEnlace(ctx: ContextoReserva, desde: string, hasta: string): Promise<{ start_time: string; end_time: string }[] | null> {
  const r = await llamar('reserva_ocupacion', { p_clinica_id: ctx.clinica_id, p_enlace_id: ctx.enlace_id, p_desde: desde, p_hasta: hasta })
  if (!r.ok) return null
  const p = OcupacionSchema.safeParse(r.data ?? [])
  return p.success ? p.data : null
}

const TextoSchema = z.string()

/** Emite el código (ya en HMAC). 'ok' | 'enlace_invalido' | null si falla. */
export async function emitirCodigo(ctx: ContextoReserva, correoHmac: string, codigoHmac: string): Promise<string | null> {
  const r = await llamar('reserva_codigo_emitir', { p_clinica_id: ctx.clinica_id, p_enlace_id: ctx.enlace_id, p_correo_hmac: correoHmac, p_codigo_hmac: codigoHmac })
  return r.ok && TextoSchema.safeParse(r.data).success ? String(r.data) : null
}

/** Verifica el código. 'ok' | 'sin_codigo' | 'agotado' | 'caducado' | 'incorrecto' | null si falla. */
export async function verificarCodigo(ctx: ContextoReserva, correoHmac: string, codigoHmac: string, fichaHmac: string): Promise<string | null> {
  const r = await llamar('reserva_codigo_verificar', {
    p_clinica_id: ctx.clinica_id, p_enlace_id: ctx.enlace_id, p_correo_hmac: correoHmac, p_codigo_hmac: codigoHmac, p_ficha_hmac: fichaHmac,
  })
  return r.ok && TextoSchema.safeParse(r.data).success ? String(r.data) : null
}

const ReservaSchema = z.object({
  r_resultado: z.string(),
  r_cita_id: z.guid().nullable(),
  r_inicio: z.string().nullable(),
  r_fin: z.string().nullable(),
  r_historial: z.number().int().nullable(),
})
export type ResultadoReservaRpc = z.infer<typeof ReservaSchema>

export interface ArgsReserva {
  codigoHash: string; consultorioId: string; tipoCitaId: string; inicio: string
  nombre: string; telefono: string; correo: string; telHmac: string; correoHmac: string
  fichaHmac: string | null; avisoVersion: string; avisoSha: string; clientId: string
}

function argsReserva(ctx: ContextoReserva, a: ArgsReserva): Record<string, unknown> {
  return {
    p_clinica_id: ctx.clinica_id, p_codigo_hash: a.codigoHash, p_consultorio_id: a.consultorioId, p_tipo_cita_id: a.tipoCitaId,
    p_inicio: a.inicio, p_nombre: a.nombre, p_telefono: a.telefono, p_correo: a.correo, p_tel_hmac: a.telHmac,
    p_correo_hmac: a.correoHmac, p_ficha_hmac: a.fichaHmac, p_aviso_version: a.avisoVersion, p_aviso_sha256: a.avisoSha,
    p_client_id: a.clientId,
  }
}

async function reservarCon(rpc: string, args: Record<string, unknown>): Promise<Llamada<ResultadoReservaRpc>> {
  const r = await llamar(rpc, args, true)
  if (!r.ok) return r
  const p = ReservaSchema.safeParse(r.data)
  return p.success ? { ok: true, data: p.data } : { ok: false, ausente: false, codigo: 'forma' }
}

/** La reserva atómica (D3). Devuelve la fila o el error con su código SQL. */
export async function reservar(ctx: ContextoReserva, a: ArgsReserva): Promise<Llamada<ResultadoReservaRpc>> {
  return reservarCon('reservar_por_enlace', argsReserva(ctx, a))
}

/**
 * Reagendar (E6): la misma reserva, envuelta por `reagendar_por_enlace`, que
 * valida en la misma transacción el enlace de confirmación de la cita
 * cancelada (`confirmacionHash` = sha256 de su código) y el tope. Sin la
 * migración de E6, `ausente` (404 uniforme).
 */
export async function reagendar(ctx: ContextoReserva, a: ArgsReserva, confirmacionHash: string): Promise<Llamada<ResultadoReservaRpc>> {
  return reservarCon('reagendar_por_enlace', { p_confirmacion_hash: confirmacionHash, ...argsReserva(ctx, a) })
}
