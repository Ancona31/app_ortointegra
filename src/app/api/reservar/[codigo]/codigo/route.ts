/**
 * POST /api/reservar/[codigo]/codigo  { correo }
 *
 * Pública (agenda D5). Sólo el enlace FIJO verifica el correo (el único se
 * salta la verificación, §2). Manda un código de 6 dígitos por
 * `transporte.ts` (en local, a Mailpit). El código no se guarda: la base
 * guarda su HMAC atado al enlace y al correo (seudónimo). La respuesta no
 * dice si ese correo ya reservó ni si está bloqueado (lista A, 14).
 */
import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { PedirCodigoSchema } from '@/lib/reserva/esquemasReserva'
import { abrirEnlace, cuerpoJson, noEncontrado, nombreDelMedico, responder } from '@/lib/reserva/puertaReserva'
import { emitirCodigo } from '@/lib/reserva/servidorReserva'
import { COOKIE_DISPOSITIVO, OPCIONES_COOKIE, dentroDeLimites, dispositivoDe, ipDe, seudonimoRed } from '@/lib/reserva/limitesReserva'
import { normalizarCorreo } from '@/lib/reserva/contacto'
import { hmacCodigoCorreo, hmacContacto } from '@/lib/reserva/secretos'
import { correoCodigo } from '@/lib/reserva/correosReserva'
import { enviarCorreo } from '@/lib/correo/transporte'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/reservar/[codigo]/codigo'>) {
  const { codigo } = await ctx.params
  const enlace = await abrirEnlace(codigo)
  if (!enlace) return noEncontrado()
  if (enlace.ctx.clase !== 'fijo') return responder({ status: 400, cuerpo: { error: 'no_aplica' } })

  const cuerpo = PedirCodigoSchema.safeParse(await cuerpoJson(req))
  const destinatario = cuerpo.success ? cuerpo.data.correo : null
  const correo = destinatario ? normalizarCorreo(destinatario) : null
  const correoHmac = correo ? hmacContacto('correo', correo) : null
  if (!destinatario || !correoHmac) return responder({ status: 400, cuerpo: { error: 'correo_invalido' } })

  const almacen = await cookies()
  const disp = dispositivoDe(almacen.get(COOKIE_DISPOSITIVO)?.value)
  if (disp.nuevo) almacen.set(COOKIE_DISPOSITIVO, disp.id, OPCIONES_COOKIE)
  const pasa = await dentroDeLimites('codigo', {
    correo: correoHmac, ip: seudonimoRed('ip', ipDe(req.headers)), disp: seudonimoRed('disp', disp.id),
  })
  if (!pasa) return responder({ status: 429, cuerpo: { error: 'demasiados_intentos' } })

  const digitos = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const codigoHmac = hmacCodigoCorreo(enlace.ctx.enlace_id, correoHmac, digitos)
  if (!codigoHmac) return noEncontrado()
  const emitido = await emitirCodigo(enlace.ctx, correoHmac, codigoHmac)
  if (emitido === 'enlace_invalido') return noEncontrado()
  if (emitido !== 'ok') return responder({ status: 500, cuerpo: { error: 'no_disponible' } })

  const plantilla = correoCodigo(nombreDelMedico(enlace.ctx), digitos)
  const envio = await enviarCorreo({ para: destinatario, ...plantilla, etiqueta: 'reserva_codigo' })
  if (!envio.ok) return responder({ status: 503, cuerpo: { error: 'correo_no_enviado' } })
  return responder({ status: 200, cuerpo: { estado: 'enviado' } })
}
