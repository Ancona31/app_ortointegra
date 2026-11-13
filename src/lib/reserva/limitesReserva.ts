/**
 * limitesReserva.ts — límites de intentos de las rutas públicas de la
 * reserva por enlace (agenda D5, lista A 13), con `rate_limit_intento`
 * (atómica: candado consultivo 1789; sólo service_role; una fila → `.single()`).
 *
 * ⚠️ `rate_limit_intento` CUENTA POR `p_ruta`, no por `p_clave`
 * (`20260919230000_auth_02…`: `WHERE ruta = p_ruta`). Por eso la llave entera
 * va en `p_ruta`: `reserva:<acción>:<ip|disp|correo|enlace>:<hmac>`, y
 * `p_clave` lleva la constante `reserva`. NUNCA la IP, el correo ni la cookie
 * en claro: van por `hmacRed` / `hmacContacto` (subllave del secreto).
 *
 * La IP sale de `x-real-ip` y, si falta, del primer valor de
 * `x-forwarded-for`. Vercel sobrescribe las dos y no reenvía IP externas
 * («to prevent IP spoofing», https://vercel.com/docs/headers/request-headers,
 * consultado el 2026-11-12). En local se pueden falsificar, y las e2e lo usan.
 *
 * Falla CERRADO: si la RPC falla, cuenta como bloqueado (429).
 */
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { hmacRed } from '@/lib/reserva/secretos'

/**
 * `confirmar`: el POST del enlace de confirmación de una cita (agenda E3), con el hash de SU código como `enlace`.
 * `sincronizar` (seg1, punto 8): las pasadas con Google que dispara el POST público de reservar (D11), por clínica.
 */
export type Accion = 'turnos' | 'codigo' | 'verificar' | 'reservar' | 'confirmar' | 'sincronizar'
export type Sujeto = 'ip' | 'disp' | 'correo' | 'enlace' | 'clinica'
const SUJETOS: readonly Sujeto[] = ['ip', 'disp', 'correo', 'enlace', 'clinica']

/** Límite y ventana, en minutos. Lista A, 13 (tabla de D5). */
export const LIMITES: Readonly<Record<Accion, Partial<Record<Sujeto, readonly [number, number]>>>> = {
  turnos: { ip: [120, 10] },
  codigo: { correo: [3, 60], ip: [10, 60], disp: [5, 60] },
  verificar: { ip: [20, 60] },
  reservar: { ip: [6, 60], disp: [4, 60], enlace: [30, 1440] },
  // E3 (plan_E): 10 por enlace y 30 por IP cada hora.
  confirmar: { ip: [30, 60], enlace: [10, 60] },
  // seg1: 60 pasadas con Google cada 10 min por clínica desde el POST público
  // (6 por minuto). Una clínica de verdad no recibe ni una fracción; pasado
  // el tope, la reserva no llama a Google y decide la ventana de 30 min de D11.
  sincronizar: { clinica: [60, 10] },
}

/** Nombre de la cookie de dispositivo. Path propio: sólo viaja a estas rutas. */
export const COOKIE_DISPOSITIVO = 'sp_rdisp'
export const OPCIONES_COOKIE = {
  httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/api/reservar', maxAge: 60 * 60 * 24 * 30,
}

const DISPOSITIVO = /^[A-Za-z0-9_-]{32}$/

/** El identificador de la cookie si tiene forma, o uno nuevo (y que hay que ponerla). */
export function dispositivoDe(valor: string | undefined): { id: string; nuevo: boolean } {
  if (valor && DISPOSITIVO.test(valor)) return { id: valor, nuevo: false }
  return { id: randomBytes(24).toString('base64url'), nuevo: true }
}

/** La IP de la petición, o '' si no viene ninguna. */
export function ipDe(cabeceras: Headers): string {
  const real = cabeceras.get('x-real-ip')?.trim()
  if (real) return real
  return cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
}

/** La llave de `p_ruta`. null si no hay secreto o valor (la ruta ya falló cerrada antes). */
export function llaveLimite(accion: Accion, sujeto: Sujeto, valorSeudonimo: string): string | null {
  return /^[0-9a-f]{64}$/.test(valorSeudonimo) ? `reserva:${accion}:${sujeto}:${valorSeudonimo}` : null
}

/**
 * La llave de una clínica: sha256 de su id (no es secreto ni dato personal;
 * sólo hace falta la forma de 64 hexadecimales de `llaveLimite`).
 */
export function seudonimoClinica(clinicaId: string): string {
  return createHash('sha256').update(`clinica:${clinicaId}`).digest('hex')
}

/** Seudónimo de red de una IP o dispositivo para la llave. */
export function seudonimoRed(sujeto: 'ip' | 'disp', valor: string): string | null {
  return hmacRed(sujeto === 'ip' ? 'ip' : 'dispositivo', valor === '' ? 'sin-ip' : valor)
}

async function intento(ruta: string, limite: number, ventanaMin: number): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .rpc('rate_limit_intento', { p_clave: 'reserva', p_ruta: ruta, p_limite: limite, p_ventana_min: ventanaMin })
    .single<{ bloqueado: boolean; restantes: number }>()
  if (error || !data) {
    logger.error('reserva', `rate_limit_intento falló: ${error?.code ?? 'sin datos'}`)
    return false
  }
  return data.bloqueado !== true
}

/**
 * ¿Pasan todos los límites de la acción? `seudonimos` trae, por sujeto, el
 * HMAC ya calculado; un sujeto ausente (o `undefined`) no se cuenta, uno en
 * `null` hace fallar cerrado. Cada llamada es su propia transacción y van en paralelo:
 * todas consumen aunque otra bloquee (así un ataque no se salva por orden).
 */
export async function dentroDeLimites(accion: Accion, seudonimos: Partial<Record<Sujeto, string | null>>): Promise<boolean> {
  const llamadas: Promise<boolean>[] = []
  for (const sujeto of SUJETOS) {
    const regla = LIMITES[accion][sujeto]
    if (!regla) continue
    // `undefined` = ese sujeto no aplica a esta petición (el enlace único no
    // tiene tope por enlace); `null` = aplica pero no hay seudónimo (sin
    // secreto): falla cerrado.
    if (!(sujeto in seudonimos) || seudonimos[sujeto] === undefined) continue
    const valor = seudonimos[sujeto]
    const llave = valor ? llaveLimite(accion, sujeto, valor) : null
    if (!llave) return false
    llamadas.push(intento(llave, regla[0], regla[1]))
  }
  const resultados = await Promise.all(llamadas)
  return resultados.every(Boolean)
}
