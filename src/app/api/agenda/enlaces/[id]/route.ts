/**
 * /api/agenda/enlaces/[id] — un enlace de reserva (bloque D; la parte de D1
 * que quedó pendiente).
 *   · GET   vuelve a enseñar su código mientras esté VIGENTE (lista A, 15).
 *   · PATCH `{accion:'revocar'}` lo revoca. No hay DELETE ni otra edición: un
 *     enlace emitido no se modifica (lo impone `proteger_reserva_enlaces`).
 *
 * Puertas comunes en `entradaGestion()` (401/403/404 con el interruptor
 * apagado). Cliente de SESIÓN y `clinica_id` explícito; el médico invitado
 * sólo alcanza los suyos (filtro explícito y RLS). Un enlace que no existe o
 * que no se puede ver es 404, igual que uno de otra clínica.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { entradaGestion, type ClienteSesion } from '@/lib/reserva/gestionServidor'
import {
  COLUMNAS_ENLACE, RevocarEnlaceSchema, estadoEnlace, gestionaTodos, respuestaErrorEnlace,
  type EnlaceReserva, type PerfilGestion,
} from '@/lib/reserva/gestionReserva'
import { codigoDeEnlace } from '@/lib/reserva/secretos'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const NO_ENCONTRADO = { error: 'Enlace no encontrado' }

/** El enlace por id, acotado a la clínica y, si quien llama no gestiona todos, a sus enlaces. */
async function leerEnlace(supabase: ClienteSesion, clinicaId: string, perfil: PerfilGestion, id: string) {
  let q = supabase.from('reserva_enlaces').select(COLUMNAS_ENLACE).eq('id', id).eq('clinica_id', clinicaId)
  if (!gestionaTodos(perfil)) q = q.eq('medico_id', perfil.id)
  return q.maybeSingle<EnlaceReserva>()
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/agenda/enlaces/[id]'>): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const { id } = await ctx.params
    if (!z.guid().safeParse(id).success) return NextResponse.json(NO_ENCONTRADO, { status: 404 })
    const { data, error } = await leerEnlace(e.supabase, e.clinicaId, e.perfil, id)
    if (error) {
      logger.error('agenda', `enlace de reserva sin leer: ${error.code ?? ''}`)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    if (!data) return NextResponse.json(NO_ENCONTRADO, { status: 404 })
    if (estadoEnlace(data, new Date()) !== 'vigente') {
      return NextResponse.json({ error: 'no_vigente', mensaje: 'Este enlace ya no está vigente' }, { status: 410 })
    }
    const codigo = codigoDeEnlace(data.id)
    if (!codigo) return NextResponse.json({ error: 'sin_secreto', mensaje: 'La reserva por enlace no está configurada en este servidor' }, { status: 503 })
    return NextResponse.json({ codigo }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: unknown) {
    logger.error('agenda', `GET enlace: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/agenda/enlaces/[id]'>): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const { id } = await ctx.params
    if (!z.guid().safeParse(id).success) return NextResponse.json(NO_ENCONTRADO, { status: 404 })
    if (!RevocarEnlaceSchema.safeParse(await req.json().catch(() => null)).success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    /* `revocado_en` lo reescribe la protección con `now()` y pone
       `revocado_por = auth.uid()`; el valor de aquí sólo dice «revócalo». */
    let q = e.supabase.from('reserva_enlaces').update({ revocado_en: new Date().toISOString() })
      .eq('id', id).eq('clinica_id', e.clinicaId).is('revocado_en', null)
    if (!gestionaTodos(e.perfil)) q = q.eq('medico_id', e.perfil.id)
    const { data, error } = await q.select(COLUMNAS_ENLACE).maybeSingle()
    if (error) {
      const r = respuestaErrorEnlace(error)
      if (r.status === 500) logger.error('agenda', `enlace sin revocar: ${error.code ?? ''}`)
      return NextResponse.json(r.body, { status: r.status })
    }
    if (!data) return NextResponse.json(NO_ENCONTRADO, { status: 404 })
    return NextResponse.json({ enlace: data })
  } catch (err: unknown) {
    logger.error('agenda', `PATCH enlace: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
