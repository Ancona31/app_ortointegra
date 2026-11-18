/**
 * POST /api/reservar/[codigo]/codigo  { correo }
 *
 * Pública (agenda D5). Sólo el enlace FIJO verifica el correo (el único se
 * salta la verificación, §2). Manda un código de 6 dígitos por
 * `transporte.ts` (en local, a Mailpit). El código no se guarda: la base
 * guarda su HMAC atado al enlace y al correo (seudónimo). La respuesta no
 * dice si ese correo ya reservó ni si está bloqueado (lista A, 14).
 * seg1 (punto 8): los límites de red (IP y dispositivo) van ANTES de la primera
 * consulta a la base; el del correo, después de abrir el enlace (así un código
 * inventado no deja una fila por cada correo que alguien pruebe).
 * K2 (punto 10): un 429 dice cuánto falta (`espera_s` y `Retry-After`); entre
 * dos códigos al mismo correo, 30 s (`espera_reenvio`), que la página cuenta
 * hacia atrás con el `reenviar_en` de la respuesta. Los límites de arriba no
 * cambian.
 */
import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { PedirCodigoSchema } from '@/lib/reserva/esquemasReserva'
import {
  abrirEnlace, codigoAbrible, cuerpoJson, demasiadosIntentos, noEncontrado, nombreDelMedico, responder,
} from '@/lib/reserva/puertaReserva'
import { emitirCodigo } from '@/lib/reserva/servidorReserva'
import {
  COOKIE_DISPOSITIVO, OPCIONES_COOKIE, REENVIO_CODIGO_S, dentroDeLimites, dispositivoDe, esperaDeLimites, esperaReenvio, ipDe, seudonimoRed,
} from '@/lib/reserva/limitesReserva'
import { normalizarCorreo } from '@/lib/reserva/contacto'
import { hmacCodigoCorreo, hmacContacto } from '@/lib/reserva/secretos'
import { correoCodigo } from '@/lib/reserva/correosReserva'
import { enviarCorreo } from '@/lib/correo/transporte'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/reservar/[codigo]/codigo'>) {
  const { codigo } = await ctx.params
  if (!codigoAbrible(codigo)) return noEncontrado()
  const almacen = await cookies()
  const disp = dispositivoDe(almacen.get(COOKIE_DISPOSITIVO)?.value)
  if (disp.nuevo) almacen.set(COOKIE_DISPOSITIVO, disp.id, OPCIONES_COOKIE)
  const red = { ip: seudonimoRed('ip', ipDe(req.headers)), disp: seudonimoRed('disp', disp.id) }
  if (!(await dentroDeLimites('codigo', red))) return demasiadosIntentos(await esperaDeLimites('codigo', red))

  const enlace = await abrirEnlace(codigo)
  if (!enlace) return noEncontrado()
  if (enlace.ctx.clase !== 'fijo') return responder({ status: 400, cuerpo: { error: 'no_aplica' } })

  const cuerpo = PedirCodigoSchema.safeParse(await cuerpoJson(req))
  const destinatario = cuerpo.success ? cuerpo.data.correo : null
  const correo = destinatario ? normalizarCorreo(destinatario) : null
  const correoHmac = correo ? hmacContacto('correo', correo) : null
  if (!destinatario || !correoHmac) return responder({ status: 400, cuerpo: { error: 'correo_invalido' } })
  // K2 (punto 10): 30 s entre dos códigos al mismo correo EN ESTE ENLACE, ANTES de contar (así no gasta el
  // límite por correo). Por enlace: la espera no dice nada de lo pedido en otros enlaces ni otras clínicas.
  const reenvio = await esperaReenvio(enlace.ctx, correoHmac)
  if (reenvio) return demasiadosIntentos(reenvio, 'espera_reenvio')
  // El tope por correo es GLOBAL (todos los enlaces): su 429 va SIN cuánto falta, porque ese plazo saldría de
  // lo pedido en otros enlaces y otras clínicas. Los de IP y dispositivo sí lo llevan: son de quien pregunta.
  if (!(await dentroDeLimites('codigo', { correo: correoHmac }))) return demasiadosIntentos(null)

  const digitos = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const codigoHmac = hmacCodigoCorreo(enlace.ctx.enlace_id, correoHmac, digitos)
  if (!codigoHmac) return noEncontrado()
  const emitido = await emitirCodigo(enlace.ctx, correoHmac, codigoHmac)
  if (emitido === 'enlace_invalido') return noEncontrado()
  if (emitido !== 'ok') return responder({ status: 500, cuerpo: { error: 'no_disponible' } })

  // Tanda I, punto 21: el consultorio de la cabecera, sólo si es uno de ESTE enlace (si no, sin él).
  const consultorio = enlace.ctx.consultorios.find(c => c.id === cuerpo.data?.consultorio_id)?.nombre ?? null
  const plantilla = correoCodigo(nombreDelMedico(enlace.ctx), digitos, { consultorio })
  const envio = await enviarCorreo({ para: destinatario, ...plantilla, etiqueta: 'reserva_codigo' })
  if (!envio.ok) return responder({ status: 503, cuerpo: { error: 'correo_no_enviado' } })
  // K2: cuándo se puede pedir otro (la cuenta regresiva de la página sale de aquí).
  return responder({ status: 200, cuerpo: { estado: 'enviado', reenviar_en: REENVIO_CODIGO_S } })
}
