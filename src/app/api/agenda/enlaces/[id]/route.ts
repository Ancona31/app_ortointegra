/**
 * /api/agenda/enlaces/[id] — un enlace de reserva (bloque D; la parte de D1
 * que quedó pendiente).
 *   · GET   vuelve a enseñar su código mientras esté VIGENTE (lista A, 15).
 *   · PATCH `{accion:'revocar'}` lo revoca. No hay DELETE ni otra edición: un
 *     enlace emitido no se modifica (lo impone `proteger_reserva_enlaces`).
 *     K3 (punto 14): `{accion:'pausar'|'reanudar'}` apaga o prende el FIJO
 *     vigente sin revocarlo (`pausado_en`): al prenderlo, la misma dirección.
 *     La fecha la pone el servidor (`now()` o `null`), nunca el navegador.
 *
 * Puertas comunes en `entradaGestion()` (401/403/404 con el interruptor
 * apagado). Cliente de SESIÓN y `clinica_id` explícito; el médico invitado
 * sólo alcanza los suyos (filtro explícito y RLS). Un enlace que no existe o
 * que no se puede ver es 404, igual que uno de otra clínica.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { entradaGestion, type ClienteSesion, type EntradaGestion } from '@/lib/reserva/gestionServidor'
import {
  AccionEnlaceSchema, COLUMNAS_ENLACE, estadoEnlace, gestionaTodos, respuestaErrorEnlace,
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

type Accion = z.output<typeof AccionEnlaceSchema>['accion']

/**
 * El UPDATE de cada acción, acotado a la clínica, a lo vigente y, si quien llama no gestiona todos,
 * a sus enlaces. `revocado_en` lo reescribe la protección con `now()` y pone `revocado_por =
 * auth.uid()`; el valor de aquí sólo dice «revócalo». Pausar y reanudar, sólo el fijo (el CHECK
 * `reserva_enlaces_pausado_check` lo repite en la base).
 */
function actualizar(e: Extract<EntradaGestion, { ok: true }>, id: string, accion: Accion) {
  const cambio = accion === 'revocar' ? { revocado_en: new Date().toISOString() }
    : { pausado_en: accion === 'pausar' ? new Date().toISOString() : null }
  let q = e.supabase.from('reserva_enlaces').update(cambio).eq('id', id).eq('clinica_id', e.clinicaId).is('revocado_en', null)
  if (accion !== 'revocar') q = q.eq('clase', 'fijo')
  if (!gestionaTodos(e.perfil)) q = q.eq('medico_id', e.perfil.id)
  return q.select(accion === 'revocar' ? COLUMNAS_ENLACE : `${COLUMNAS_ENLACE}, pausado_en`).maybeSingle<EnlaceReserva>()
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/agenda/enlaces/[id]'>): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const { id } = await ctx.params
    if (!z.guid().safeParse(id).success) return NextResponse.json(NO_ENCONTRADO, { status: 404 })
    const cuerpo = AccionEnlaceSchema.safeParse(await req.json().catch(() => null))
    if (!cuerpo.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const { data, error } = await actualizar(e, id, cuerpo.data.accion)
    /* 42703: el código llegó antes que la migración de K3; no se pausó nada. */
    if (error?.code === '42703') {
      return NextResponse.json({ error: 'sin_pausa', mensaje: 'Falta una actualización de la base para apagar el enlace sin cambiarlo' }, { status: 409 })
    }
    if (error) {
      const r = respuestaErrorEnlace(error)
      if (r.status === 500) logger.error('agenda', `enlace sin ${cuerpo.data.accion === 'revocar' ? 'revocar' : 'pausar'}: ${error.code ?? ''}`)
      return NextResponse.json(r.body, { status: r.status })
    }
    if (!data) return NextResponse.json(NO_ENCONTRADO, { status: 404 })
    return NextResponse.json({ enlace: data })
  } catch (err: unknown) {
    logger.error('agenda', `PATCH enlace: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
