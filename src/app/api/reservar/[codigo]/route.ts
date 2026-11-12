/**
 * POST /api/reservar/[codigo] — reservar un turno por enlace (agenda D5).
 *
 * Pública y sin sesión. El orden importa y es éste:
 *   1. puerta común (404 uniforme); usado o caducado lo dice la RPC (410);
 *   2. forma del cuerpo (400) y casilla del aviso (`acepta_aviso: true`);
 *   3. límites por IP, dispositivo y enlace fijo (429);
 *   4. teléfono de México y correo con forma (400);
 *   5. consultorio y tipo del enlace (400);
 *   6. CONVENIO DE D3: `inicio` tiene que ser un turno ofrecido —horario del
 *      consultorio, alineación al paso del tipo, anticipación y horizonte—
 *      (400 si no lo es; `turnoValido`). Si sigue libre lo decide la RPC (409);
 *   7. `reservar_por_enlace`, que bajo su candado vuelve a comprobar enlace,
 *      interruptor, aviso, S3, ventana, empalme, verificación y candado de la
 *      persona, e inserta la cita. Con `origen` (E6, reagendar), la misma
 *      llamada envuelta por `reagendar_por_enlace`.
 * Después de responder (`after()`, D8): el evento de Google y el comprobante.
 */
import { cookies } from 'next/headers'
import { after, type NextRequest } from 'next/server'
import { ReservarSchema } from '@/lib/reserva/esquemasReserva'
import {
  abrirEnlace, cuerpoJson, noEncontrado, nombreDelMedico, responder, telefonoDeContacto,
} from '@/lib/reserva/puertaReserva'
import { ocupacionDeEnlace, reagendar, reservar } from '@/lib/reserva/servidorReserva'
import {
  COOKIE_DISPOSITIVO, OPCIONES_COOKIE, dentroDeLimites, dispositivoDe, ipDe, seudonimoRed,
} from '@/lib/reserva/limitesReserva'
import { normalizarCorreo, normalizarTelefonoMx } from '@/lib/reserva/contacto'
import { hashDeCodigo, hmacContacto, hmacFicha } from '@/lib/reserva/secretos'
import { AVISO_VERSION, hashAviso } from '@/lib/reserva/avisoReserva'
import { respuestaErrorRpc, respuestaReserva } from '@/lib/reserva/respuestasReserva'
import { fechaEnZona, ocupacionSinEstado, rangoDeConsulta, reglasDe, turnoValido } from '@/lib/reserva/turnosReserva'
import { crearEventoReserva } from '@/lib/reserva/googleReserva'
import { enviarComprobante } from '@/lib/reserva/comprobanteReserva'
import type { ContextoReserva, ResultadoReservaRpc } from '@/lib/reserva/servidorReserva'

export const dynamic = 'force-dynamic'

const MAL = (error: string) => responder({ status: 400, cuerpo: { error } })

export async function POST(req: NextRequest, rctx: RouteContext<'/api/reservar/[codigo]'>) {
  const { codigo } = await rctx.params
  const enlace = await abrirEnlace(codigo)
  if (!enlace) return noEncontrado()
  // Un único usado o caducado NO se corta aquí: lo dice la RPC (410), que
  // antes reconoce un reenvío del mismo client_id y devuelve la cita
  // (`repetida`, 200). Cortarlo aquí rompía la idempotencia del único.
  const { ctx, codigoHash } = enlace

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
  // Ver `turnoValido`: con la ocupación del día (P9: los turnos arrancan en
  // cada hueco) sin la cita idéntica, para que un reenvío del mismo client_id
  // llegue a la RPC y salga `repetida`. Lo libre lo decide la RPC (409).
  const dia = Number.isNaN(Date.parse(b.inicio)) ? null : rangoDeConsulta(fechaEnZona(new Date(b.inicio), reglas.tz), reglas.tz, 1)
  if (!dia) return MAL('turno_invalido')
  const ocupacion = await ocupacionDeEnlace(ctx, dia.desde, dia.hasta)
  if (!ocupacion) return responder({ status: 500, cuerpo: { error: 'no_disponible' } })
  const turno = turnoValido(reglas, b.inicio, ocupacionSinEstado(ocupacion), ahora)
  if (!turno) return MAL('turno_invalido')

  const args = {
    codigoHash, consultorioId: consultorio.id, tipoCitaId: tipo.id, inicio: turno.inicio,
    nombre: b.nombre, telefono, correo: b.correo, telHmac, correoHmac,
    fichaHmac: b.ficha ? hmacFicha(b.ficha) : null, avisoVersion: AVISO_VERSION, avisoSha: hashAviso(), clientId: b.client_id,
  }
  const r = b.origen ? await reagendar(ctx, args, hashDeCodigo(b.origen)) : await reservar(ctx, args)
  if (!r.ok) return responder(respuestaErrorRpc(r.ausente, r.codigo))
  // D8, sólo con una reserva NUEVA (una `repetida` ya los programó la primera vez).
  if (r.data.r_resultado === 'ok') programarDespues(ctx, consultorio, b, r.data)
  return responder(respuestaReserva(r.data.r_resultado, telefonoDeContacto(ctx, consultorio.id)))
}

type ConsultorioCtx = ContextoReserva['consultorios'][number]

/**
 * Después de responder (D8): el evento de Google (`googleReserva.ts`, sólo
 * nombre, clínica y hora; invitado sólo el médico) y el comprobante por
 * `transporte.ts` (en local, a Mailpit), sin tipo de cita. Nada de esto
 * cambia la respuesta: la cita ya existe.
 * E5 (lista A 1): el comprobante lleva el enlace de confirmación de la cita
 * y queda registrado en `cita_correos` (E4), para que el recordatorio no
 * salga otra vez para ese inicio (lista A 4): `comprobanteReserva.ts`. Las
 * citas que agenda el personal siguen sin correo al agendar.
 */
function programarDespues(ctx: ContextoReserva, consultorio: ConsultorioCtx, b: { nombre: string; correo: string }, fila: ResultadoReservaRpc): void {
  const { r_cita_id: citaId, r_inicio: inicio, r_fin: fin } = fila
  if (!citaId || !inicio || !fin) return
  const nombre = b.nombre.trim()
  after(async () => {
    await crearEventoReserva({
      clinicaId: ctx.clinica_id, citaId, medicoId: ctx.medico_id, nombre, inicio, fin, zona: consultorio.timezone,
      clinica: ctx.clinica ? { nombre: ctx.clinica.nombre ?? '', nombre_display: ctx.clinica.nombre_display } : null,
    })
    await enviarComprobante({
      clinicaId: ctx.clinica_id, citaId, correoEscrito: b.correo,
      datos: {
        medico: nombreDelMedico(ctx), consultorio: consultorio.nombre, direccion: consultorio.direccion,
        telefono: consultorio.telefono ?? ctx.medico.telefono, inicio, zona: consultorio.timezone,
      },
    })
  })
}
