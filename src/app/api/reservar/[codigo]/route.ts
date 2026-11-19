/**
 * POST /api/reservar/[codigo] — reservar un turno por enlace (agenda D5).
 *
 * Pública y sin sesión. El orden importa y es éste:
 *   0. seg1 (punto 8): forma del código sin tocar la base (404) y límites por
 *      IP y dispositivo (429) ANTES de la primera consulta a la base;
 *   1. puerta común (404 uniforme); usado o caducado lo dice la RPC (410);
 *   2. forma del cuerpo (400) y casilla del aviso (`acepta_aviso: true`);
 *   3. límite por enlace fijo (429; necesita saber la clase del enlace);
 *   4. teléfono de México y correo con forma (400);
 *   5. consultorio y tipo del enlace (400);
 *   6. CONVENIO DE D3: `inicio` tiene que ser un turno de la rejilla fija
 *      (G2: desde la apertura, con paso igual a la duración) en horario, con
 *      la anticipación y dentro del horizonte (400 si no lo es;
 *      `turnoValido`). Si sigue libre lo decide la RPC (409), con la misma
 *      regla de ocupación que la lista de turnos;
 *   6-bis. D11 (decisión de Angel): sincronizar con Google JUSTO ANTES de la
 *      RPC, siempre y sin el mínimo de 60 s (`sincronizarAntesDeReservar`,
 *      fuera de la transacción: la RPC no cambia). Lo importado ocupa y la
 *      RPC contesta `ocupado` (409, el mismo «turno no disponible»). Si
 *      Google falla o tarda y la última buena tiene 30 min o más: 503 «no se
 *      puede reservar por ahora» con el teléfono del consultorio;
 *   7. `reservar_por_enlace`, que bajo su candado vuelve a comprobar enlace,
 *      interruptor, aviso, S3, ventana, empalme, verificación y candado de la
 *      persona, e inserta la cita. Con `origen` (E6, reagendar), la misma
 *      llamada envuelta por `reagendar_por_enlace`.
 * Después de responder (`after()`, D8): el evento de Google y el comprobante.
 * Tanda I, punto 2: en el enlace de UN SOLO USO el correo es opcional (sin
 * código en los dos casos); sin correo no hay comprobante. El fijo no cambia.
 * Tanda J, punto 3: en el ÚNICO el correo que llegue en el cuerpo se IGNORA
 * (sólo pasa la forma mínima del esquema; no se usa ni viaja a la base): el
 * de la cita es el que escribió la clínica al emitir el enlace (`reservar_por_enlace` lo toma del enlace), y
 * el comprobante va sólo ahí, nunca al tecleado. La base cuenta además los
 * intentos del único (tope; agotado = 410 neutro).
 */
import { cookies } from 'next/headers'
import { after, type NextRequest } from 'next/server'
import { ReservarSchema } from '@/lib/reserva/esquemasReserva'
import {
  abrirEnlace, codigoAbrible, cuerpoJson, demasiadosIntentos, noEncontrado, nombreDelMedico, responder, telefonoDeContacto,
} from '@/lib/reserva/puertaReserva'
import { reagendar, reservar } from '@/lib/reserva/servidorReserva'
import {
  COOKIE_DISPOSITIVO, OPCIONES_COOKIE, dentroDeLimites, dispositivoDe, esperaDeLimites, ipDe, seudonimoRed,
} from '@/lib/reserva/limitesReserva'
import { normalizarCorreo, normalizarTelefonoMx } from '@/lib/reserva/contacto'
import { hashDeCodigo, hmacContacto, hmacFicha } from '@/lib/reserva/secretos'
import { AVISO_VERSION, hashAviso } from '@/lib/reserva/avisoReserva'
import { respuestaErrorRpc, respuestaNoPorAhora, respuestaReserva } from '@/lib/reserva/respuestasReserva'
import { sincronizarAntesDeReservar } from '@/lib/reserva/sincronizarReserva'
import { tiposDelConsultorio } from '@/lib/agenda/tiposPorConsultorio'
import { reglasDe, turnoValido } from '@/lib/reserva/turnosReserva'
import { crearEventoReserva } from '@/lib/reserva/googleReserva'
import { enviarComprobante } from '@/lib/reserva/comprobanteReserva'
import { avisarReservaAClinica } from '@/lib/reserva/correoClinicaReserva'
import type { ContextoReserva, ResultadoReservaRpc } from '@/lib/reserva/servidorReserva'

export const dynamic = 'force-dynamic'

const MAL = (error: string) => responder({ status: 400, cuerpo: { error } })

export async function POST(req: NextRequest, rctx: RouteContext<'/api/reservar/[codigo]'>) {
  const { codigo } = await rctx.params
  if (!codigoAbrible(codigo)) return noEncontrado()
  const almacen = await cookies()
  const disp = dispositivoDe(almacen.get(COOKIE_DISPOSITIVO)?.value)
  if (disp.nuevo) almacen.set(COOKIE_DISPOSITIVO, disp.id, OPCIONES_COOKIE)
  const red = { ip: seudonimoRed('ip', ipDe(req.headers)), disp: seudonimoRed('disp', disp.id) }
  // K2 (punto 10): los 429 dicen cuánto falta.
  if (!(await dentroDeLimites('reservar', red))) return demasiadosIntentos(await esperaDeLimites('reservar', red))

  const enlace = await abrirEnlace(codigo)
  if (!enlace) return noEncontrado()
  // Un único usado o caducado NO se corta aquí: lo dice la RPC (410), que
  // antes reconoce un reenvío del mismo client_id y devuelve la cita
  // (`repetida`, 200). Cortarlo aquí rompía la idempotencia del único.
  const { ctx, codigoHash } = enlace

  const cuerpo = ReservarSchema.safeParse(await cuerpoJson(req))
  if (!cuerpo.success) return MAL('solicitud_invalida')
  const b = cuerpo.data
  /* Tanda I, punto 2: el correo es opcional SÓLO en el único (basta el
     teléfono). En el fijo, sin correo, el mismo 400 de antes y en el mismo
     punto (lo daba el esquema, antes del límite por enlace). Con correo, en
     los dos, la misma validación de siempre. */
  const correo = ctx.clase === 'unico' ? null : (b.correo ?? null)
  if (correo === null && ctx.clase !== 'unico') return MAL('solicitud_invalida')
  if (ctx.clase === 'fijo' && !(await dentroDeLimites('reservar', { enlace: codigoHash }))) {
    return demasiadosIntentos(await esperaDeLimites('reservar', { enlace: codigoHash }))
  }

  const telefono = normalizarTelefonoMx(b.telefono)
  const correoLlave = correo === null ? null : normalizarCorreo(correo)
  const telHmac = telefono ? hmacContacto('telefono', telefono) : null
  const correoHmac = correoLlave ? hmacContacto('correo', correoLlave) : null
  if (!telefono || !telHmac) return MAL('telefono_invalido')
  if (correo !== null && !correoHmac) return MAL('correo_invalido')

  const consultorio = ctx.consultorios.find(c => c.id === b.consultorio_id)
  // G2: sólo los tipos que valen en ESE consultorio. `reservar_por_enlace`
  // no mira el consultorio del tipo: este filtro es la única puerta.
  const tipo = consultorio ? tiposDelConsultorio(ctx.tipos, consultorio.id).find(t => t.id === b.tipo_cita_id) : undefined
  if (!consultorio || !tipo) return MAL('consultorio_o_tipo_invalido')

  const reglas = reglasDe(consultorio, ctx.clinica?.horario, tipo.duracion_min, ctx.ajustes)
  // G2: la rejilla fija no depende de la ocupación (ver `turnoValido`): lo
  // libre lo decide la RPC bajo su candado (409), con la regla de la lista.
  const turno = turnoValido(reglas, b.inicio, new Date())
  if (!turno) return MAL('turno_invalido')

  const args = {
    codigoHash, consultorioId: consultorio.id, tipoCitaId: tipo.id, inicio: turno.inicio,
    nombre: b.nombre, telefono, correo, telHmac, correoHmac,
    fichaHmac: b.ficha ? hmacFicha(b.ficha) : null, avisoVersion: AVISO_VERSION, avisoSha: hashAviso(), clientId: b.client_id,
  }
  if (await sincronizarAntesDeReservar(ctx.clinica_id, 'reservar') === 'no_por_ahora') {
    return responder(respuestaNoPorAhora(telefonoDeContacto(ctx, consultorio.id)))
  }
  const r = b.origen ? await reagendar(ctx, args, hashDeCodigo(b.origen)) : await reservar(ctx, args)
  if (!r.ok) return responder(respuestaErrorRpc(r.ausente, r.codigo))
  // D8, sólo con una reserva NUEVA (una `repetida` ya los programó la primera vez).
  if (r.data.r_resultado === 'ok') programarDespues(ctx, consultorio, { nombre: b.nombre, correo, unico: ctx.clase === 'unico' }, r.data, !!b.origen)
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
 * I5 (punto 20): y, si la clínica lo encendió en la configuración (apagado de
 * fábrica), un correo a sus administradores (`correoClinicaReserva.ts`).
 */
function programarDespues(
  ctx: ContextoReserva, consultorio: ConsultorioCtx, b: { nombre: string; correo: string | null; unico: boolean }, fila: ResultadoReservaRpc, reagendada: boolean,
): void {
  const { r_cita_id: citaId, r_inicio: inicio, r_fin: fin } = fila
  if (!citaId || !inicio || !fin) return
  const nombre = b.nombre.trim()
  after(async () => {
    await crearEventoReserva({
      clinicaId: ctx.clinica_id, citaId, medicoId: ctx.medico_id, nombre, inicio, fin, zona: consultorio.timezone,
      clinica: ctx.clinica ? { nombre: ctx.clinica.nombre ?? '', nombre_display: ctx.clinica.nombre_display } : null,
    })
    // Tanda J, punto 3: en el único el destinatario lo da SÓLO la base (el
    // correo del enlace; sin él, no hay a quién y no sale nada): sin
    // `correoEscrito`, así que tampoco hay respaldo al tecleado. En el fijo, el
    // verificado, como siempre. Integración I: no es un `return`, porque el
    // aviso a la clínica (I5) sale también por una reserva sin correo.
    if (b.unico || b.correo !== null) {
      await enviarComprobante({
        clinicaId: ctx.clinica_id, citaId, correoEscrito: b.unico ? null : b.correo,
        datos: {
          medico: nombreDelMedico(ctx), consultorio: consultorio.nombre, direccion: consultorio.direccion,
          telefono: consultorio.telefono ?? ctx.medico.telefono, inicio, zona: consultorio.timezone,
          // M5 (punto 11): el nombre que escribió, para el saludo y la fila «Paciente» del comprobante.
          paciente: nombre,
        },
      })
    }
    // I5 (punto 20): el aviso a la clínica, si lo encendió; detrás del comprobante y sin datos clínicos.
    await avisarReservaAClinica({
      clinicaId: ctx.clinica_id, citaId, nombre, medico: nombreDelMedico(ctx), consultorio: consultorio.nombre,
      inicio, zona: consultorio.timezone, reagendada,
    })
  })
}
