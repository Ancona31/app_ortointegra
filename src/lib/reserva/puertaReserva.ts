/**
 * puertaReserva.ts — la puerta común de la página y de las rutas públicas de
 * la reserva por enlace (agenda D5). SÓLO SERVIDOR.
 *
 * Un enlace se abre sólo si TODO se cumple, y si no, la respuesta es la
 * misma para cualquier causa (404 uniforme, lista A 18):
 *   1. hay `RESERVA_SECRETO` utilizable (sin él D falla cerrado);
 *   2. el código tiene la forma de un código de enlace (sin tocar la base);
 *   3. el aviso es publicable (sin la marca de pendiente: D9);
 *   4. `reserva_contexto` lo resuelve: enlace no revocado, interruptor de la
 *      clínica encendido, aviso aprobado con ESTE sha256, puerta S3 y médico
 *      todavía en la clínica (todo eso lo comprueba la RPC, D3).
 * La clínica sale de aquí y de ningún otro sitio.
 */
import { NextResponse } from 'next/server'
import { AVISO_VERSION, avisoPublicable, hashAviso } from '@/lib/reserva/avisoReserva'
import { esCodigoDeEnlace, hashDeCodigo, secretoDisponible } from '@/lib/reserva/secretos'
import { contextoDeEnlace, type ContextoReserva } from '@/lib/reserva/servidorReserva'
import { NO_ENCONTRADO, type Respuesta } from '@/lib/reserva/respuestasReserva'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

export interface EnlaceAbierto { ctx: ContextoReserva; codigoHash: string }

/**
 * Pasos 1 a 3 sin tocar la base: ¿vale la pena preguntar por este código?
 * seg1 (punto 8): las rutas públicas lo miran ANTES de su límite por IP, y el
 * límite va ANTES de `reserva_contexto` (la primera consulta de verdad). Así
 * un código sin forma sigue sin tocar la base, y una ráfaga de códigos con
 * forma la frena el límite antes de llegar al contexto.
 */
export function codigoAbrible(codigo: string): boolean {
  return secretoDisponible() && esCodigoDeEnlace(codigo) && avisoPublicable()
}

/** El enlace abierto, o null por cualquier causa (todas cuentan como 404). */
export async function abrirEnlace(codigo: string): Promise<EnlaceAbierto | null> {
  if (!codigoAbrible(codigo)) return null
  const codigoHash = hashDeCodigo(codigo)
  const ctx = await contextoDeEnlace(codigoHash, AVISO_VERSION, hashAviso())
  return ctx ? { ctx, codigoHash } : null
}

/** Una respuesta JSON sin caché. */
export function responder(r: Respuesta): NextResponse {
  return NextResponse.json(r.cuerpo, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}

export function noEncontrado(): NextResponse {
  return responder(NO_ENCONTRADO)
}

/** El enlace ya no sirve (único usado o caducado): 410 con su causa. */
export function respuestaEstado(ctx: ContextoReserva): Respuesta | null {
  if (ctx.estado === 'usado') return { status: 410, cuerpo: { error: 'enlace_usado' } }
  if (ctx.estado === 'caducado') return { status: 410, cuerpo: { error: 'enlace_caducado' } }
  return null
}

/** «Dr. Nombre Apellidos» del médico del enlace. */
export function nombreDelMedico(ctx: ContextoReserva): string {
  return componerNombreMedicoCompleto(ctx.medico)
}

/** El teléfono para «comunícate con el consultorio»: el del consultorio por omisión, si no el del médico. */
export function telefonoDeContacto(ctx: ContextoReserva, consultorioId?: string): string | null {
  const c = ctx.consultorios.find(x => x.id === consultorioId) ?? ctx.consultorios[0]
  return c?.telefono ?? ctx.medico.telefono ?? null
}

/** Lee el cuerpo JSON sin lanzar: null si no es JSON. */
export async function cuerpoJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
