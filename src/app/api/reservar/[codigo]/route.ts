/**
 * POST /api/reservar/[codigo] — reservar un turno por enlace (agenda D5).
 *
 * Pública y sin sesión. El orden importa y es éste:
 *   1. puerta común (404 uniforme) y estado del único (410);
 *   2. forma del cuerpo (400) y casilla del aviso (`acepta_aviso: true`);
 *   3. límites por IP, dispositivo y enlace fijo (429);
 *   4. teléfono de México y correo con forma (400);
 *   5. consultorio y tipo del enlace (400);
 *   6. CONVENIO DE D3: `inicio` tiene que ser un turno ofrecido —horario del
 *      consultorio, alineación al paso del tipo, anticipación y horizonte—
 *      (400 si no lo es). Si sigue libre lo decide la RPC (409);
 *   7. `reservar_por_enlace`, que bajo su candado vuelve a comprobar enlace,
 *      interruptor, aviso, S3, ventana, empalme, verificación y candado de la
 *      persona, e inserta la cita.
 * Después de responder (`after()`), D8: el evento de Google y el comprobante.
 */
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { ReservarSchema } from '@/lib/reserva/esquemasReserva'
import {
  abrirEnlace, cuerpoJson, noEncontrado, responder, respuestaEstado, telefonoDeContacto,
} from '@/lib/reserva/puertaReserva'
import { reservar } from '@/lib/reserva/servidorReserva'
import {
  COOKIE_DISPOSITIVO, OPCIONES_COOKIE, dentroDeLimites, dispositivoDe, ipDe, seudonimoRed,
} from '@/lib/reserva/limitesReserva'
import { normalizarCorreo, normalizarTelefonoMx } from '@/lib/reserva/contacto'
import { hmacContacto, hmacFicha } from '@/lib/reserva/secretos'
import { AVISO_VERSION, hashAviso } from '@/lib/reserva/avisoReserva'
import { respuestaErrorRpc, respuestaReserva } from '@/lib/reserva/respuestasReserva'
import { reglasDe, turnoOfrecido } from '@/lib/reserva/turnosReserva'

export const dynamic = 'force-dynamic'

const MAL = (error: string) => responder({ status: 400, cuerpo: { error } })

export async function POST(req: NextRequest, rctx: RouteContext<'/api/reservar/[codigo]'>) {
  const { codigo } = await rctx.params
  const enlace = await abrirEnlace(codigo)
  if (!enlace) return noEncontrado()
  const { ctx, codigoHash } = enlace
  const estado = respuestaEstado(ctx)
  if (estado) return responder(estado)

  const cuerpo = ReservarSchema.safeParse(await cuerpoJson(req))
  if (!cuerpo.success) return MAL('solicitud_invalida')
  const b = cuerpo.data

  const almacen = await cookies()
  const disp = dispositivoDe(almacen.get(COOKIE_DISPOSITIVO)?.value)
  if (disp.nuevo) almacen.set(COOKIE_DISPOSITIVO, disp.id, OPCIONES_COOKIE)
  const pasa = await dentroDeLimites('reservar', {
    ip: seudonimoRed('ip', ipDe(req.headers)), disp: seudonimoRed('disp', disp.id),
    enlace: ctx.clase === 'fijo' ? codigoHash : undefined,
  })
  if (!pasa) return responder({ status: 429, cuerpo: { error: 'demasiados_intentos' } })

  const telefono = normalizarTelefonoMx(b.telefono)
  const correoLlave = normalizarCorreo(b.correo)
  const telHmac = telefono ? hmacContacto('telefono', telefono) : null
  const correoHmac = correoLlave ? hmacContacto('correo', correoLlave) : null
  if (!telefono || !telHmac) return MAL('telefono_invalido')
  if (!correoHmac) return MAL('correo_invalido')

  const consultorio = ctx.consultorios.find(c => c.id === b.consultorio_id)
  const tipo = ctx.tipos.find(t => t.id === b.tipo_cita_id)
  if (!consultorio || !tipo) return MAL('consultorio_o_tipo_invalido')

  const ahora = new Date()
  const reglas = reglasDe(consultorio, ctx.clinica?.horario, tipo.duracion_min, ctx.ajustes)
  // Sin ocupación a propósito: lo libre lo decide la RPC bajo su candado
  // (`ocupado` → 409), y así un reenvío del mismo client_id llega a la RPC y
  // sale `repetida` en vez de chocar con su propia cita.
  const turno = turnoOfrecido(reglas, b.inicio, [], ahora)
  if (!turno) return MAL('turno_invalido')

  const r = await reservar(ctx, {
    codigoHash, consultorioId: consultorio.id, tipoCitaId: tipo.id, inicio: turno.inicio,
    nombre: b.nombre, telefono, correo: b.correo, telHmac, correoHmac,
    fichaHmac: b.ficha ? hmacFicha(b.ficha) : null, avisoVersion: AVISO_VERSION, avisoSha: hashAviso(), clientId: b.client_id,
  })
  if (!r.ok) return responder(respuestaErrorRpc(r.ausente, r.codigo))
  return responder(respuestaReserva(r.data.r_resultado, telefonoDeContacto(ctx, consultorio.id)))
}
