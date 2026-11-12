/**
 * POST /api/reservar/[codigo]/verificar  { correo, codigo }
 *
 * Pública (agenda D5). Comprueba el código del correo (5 intentos por código,
 * 10 min) y, si vale, devuelve una ficha de un solo uso (30 min) que la
 * reserva exige en el enlace fijo. La base guarda sólo el HMAC de la ficha.
 */
import type { NextRequest } from 'next/server'
import { VerificarCodigoSchema } from '@/lib/reserva/esquemasReserva'
import { abrirEnlace, cuerpoJson, noEncontrado, responder } from '@/lib/reserva/puertaReserva'
import { verificarCodigo } from '@/lib/reserva/servidorReserva'
import { dentroDeLimites, ipDe, seudonimoRed } from '@/lib/reserva/limitesReserva'
import { normalizarCorreo } from '@/lib/reserva/contacto'
import { hmacCodigoCorreo, hmacContacto, nuevaFicha } from '@/lib/reserva/secretos'
import { respuestaVerificacion } from '@/lib/reserva/respuestasReserva'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/reservar/[codigo]/verificar'>) {
  const { codigo } = await ctx.params
  const enlace = await abrirEnlace(codigo)
  if (!enlace) return noEncontrado()
  if (enlace.ctx.clase !== 'fijo') return responder({ status: 400, cuerpo: { error: 'no_aplica' } })

  const cuerpo = VerificarCodigoSchema.safeParse(await cuerpoJson(req))
  if (!cuerpo.success) return responder({ status: 400, cuerpo: { error: 'solicitud_invalida' } })
  const correo = normalizarCorreo(cuerpo.data.correo)
  const correoHmac = correo ? hmacContacto('correo', correo) : null
  if (!correoHmac) return responder({ status: 400, cuerpo: { error: 'correo_invalido' } })

  if (!(await dentroDeLimites('verificar', { ip: seudonimoRed('ip', ipDe(req.headers)) }))) {
    return responder({ status: 429, cuerpo: { error: 'demasiados_intentos' } })
  }

  const codigoHmac = hmacCodigoCorreo(enlace.ctx.enlace_id, correoHmac, cuerpo.data.codigo)
  const ficha = nuevaFicha()
  if (!codigoHmac || !ficha) return noEncontrado()
  const resultado = await verificarCodigo(enlace.ctx, correoHmac, codigoHmac, ficha.fichaHmac)
  if (resultado === null) return responder({ status: 500, cuerpo: { error: 'no_disponible' } })
  const r = respuestaVerificacion(resultado)
  return resultado === 'ok' ? responder({ status: 200, cuerpo: { ...r.cuerpo, ficha: ficha.ficha } }) : responder(r)
}
