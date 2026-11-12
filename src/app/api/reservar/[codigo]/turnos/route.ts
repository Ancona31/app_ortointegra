/**
 * GET /api/reservar/[codigo]/turnos?consultorio=&tipo=&desde=YYYY-MM-DD
 *
 * Pública y sin sesión (agenda D5). Devuelve sólo `{ dias: [{ fecha,
 * turnos: [{ inicio, fin }] }] }` de 7 días: libre u ocupado, NUNCA datos de
 * otras citas (la RPC de ocupación sólo da puntas). Consultorio y tipo tienen
 * que ser del enlace: uno de otra clínica o de otro médico es 400.
 * 404 uniforme para cualquier enlace que no abre; 410 si el único se usó o
 * caducó; 429 al pasar el límite por IP.
 */
import type { NextRequest } from 'next/server'
import { TurnosQuerySchema } from '@/lib/reserva/esquemasReserva'
import { abrirEnlace, noEncontrado, responder, respuestaEstado } from '@/lib/reserva/puertaReserva'
import { ocupacionDeEnlace } from '@/lib/reserva/servidorReserva'
import { dentroDeLimites, ipDe, seudonimoRed } from '@/lib/reserva/limitesReserva'
import { ocupacionSinEstado, primerDia, rangoDeConsulta, reglasDe, turnosDeDias } from '@/lib/reserva/turnosReserva'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: RouteContext<'/api/reservar/[codigo]/turnos'>) {
  const { codigo } = await ctx.params
  const enlace = await abrirEnlace(codigo)
  if (!enlace) return noEncontrado()
  const estado = respuestaEstado(enlace.ctx)
  if (estado) return responder(estado)

  const q = TurnosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!q.success) return responder({ status: 400, cuerpo: { error: 'solicitud_invalida' } })
  const consultorio = enlace.ctx.consultorios.find(c => c.id === q.data.consultorio)
  const tipo = enlace.ctx.tipos.find(t => t.id === q.data.tipo)
  if (!consultorio || !tipo) return responder({ status: 400, cuerpo: { error: 'consultorio_o_tipo_invalido' } })

  if (!(await dentroDeLimites('turnos', { ip: seudonimoRed('ip', ipDe(req.headers)) }))) {
    return responder({ status: 429, cuerpo: { error: 'demasiados_intentos' } })
  }

  const ahora = new Date()
  const reglas = reglasDe(consultorio, enlace.ctx.clinica?.horario, tipo.duracion_min, enlace.ctx.ajustes)
  const desde = primerDia(q.data.desde, reglas.tz, ahora)
  const rango = rangoDeConsulta(desde, reglas.tz)
  const ocupacion = await ocupacionDeEnlace(enlace.ctx, rango.desde, rango.hasta)
  if (!ocupacion) return responder({ status: 500, cuerpo: { error: 'no_disponible' } })

  const dias = turnosDeDias(reglas, desde, ocupacionSinEstado(ocupacion), ahora)
    .map(d => ({ fecha: d.fecha, turnos: d.turnos.map(t => ({ inicio: t.inicio, fin: t.fin })) }))
  return Response.json({ dias }, { headers: { 'Cache-Control': 'no-store' } })
}
