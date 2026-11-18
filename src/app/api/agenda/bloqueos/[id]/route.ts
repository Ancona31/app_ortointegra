/**
 * PATCH / DELETE /api/agenda/bloqueos/[id] — K1 · editar o quitar un bloqueo
 * de horario. Mismas reglas que el POST (`../route.ts`): v2, cliente de
 * SESIÓN, el permiso de quien hoy puede agendar para ese médico, `clinica_id`
 * del perfil. El médico de un bloqueo no se cambia (no hay `UPDATE` de esa
 * columna): para otro médico, se quita y se crea.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { borrarBloqueoEnGoogle, empujarBloqueo, type BloqueoParaGoogle } from '@/lib/agenda/bloqueosGoogle'
import {
  COLUMNAS_BLOQUEO_RUTA, PuntasBloqueoSchema, citasEnPeriodo, columnasDePuntas, perfilBloqueo, puedeBloquear,
  respuestaErrorBloqueo, type PerfilBloqueo,
} from '@/lib/agenda/bloqueosServidor'
import { logger } from '@/lib/logger'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>
type Fila = BloqueoParaGoogle & { medico_id: string }
type Previo = { supabase: ClienteSesion; perfil: PerfilBloqueo; clinicaId: string; fila: Fila }

/** Sesión, v2, la fila (por la RLS) y el permiso sobre su médico; o la respuesta de error. */
async function preparar(params: Promise<{ id: string }>): Promise<Previo | NextResponse> {
  const { id } = await params
  if (!z.guid().safeParse(id).success) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const supabase = await createClient()
  const perfil = await perfilBloqueo(supabase)
  if (!perfil) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const clinicaId = perfil.clinica_id
  if (!clinicaId) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (!(await agendaV2Encendida(supabase, clinicaId))) return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
  const { data: fila } = await supabase.from('agenda_bloqueos').select(COLUMNAS_BLOQUEO_RUTA)
    .eq('id', id).eq('clinica_id', clinicaId).maybeSingle<Fila>()
  if (!fila) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!puedeBloquear(perfil, fila.medico_id)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  return { supabase, perfil, clinicaId, fila }
}

async function contexto(p: Previo) {
  const conexion = await resolverConexionClinica(p.supabase, p.clinicaId)
  return conexion ? { conexion, admin: createAdminClient(), puedeReparar: canManageClinica(p.perfil), actorId: p.perfil.userId } : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const p = await preparar(params)
    if (p instanceof NextResponse) return p
    const parsed = PuntasBloqueoSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const { data, error } = await p.supabase.from('agenda_bloqueos').update(columnasDePuntas(parsed.data))
      .eq('id', p.fila.id).eq('clinica_id', p.clinicaId).select(COLUMNAS_BLOQUEO_RUTA).maybeSingle<Fila>()
    if (error || !data) {
      const r = error ? respuestaErrorBloqueo(error) : { status: 403, error: 'Sin permisos' }
      if (r.status === 500) logger.error('agenda', `bloqueo sin editar: ${error?.code ?? ''}`)
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    const citas = await citasEnPeriodo(p.supabase, p.clinicaId, data.medico_id, data.inicio, data.fin)
    const ctx = await contexto(p)
    if (ctx) after(() => empujarBloqueo(data, ctx))
    return NextResponse.json({ bloqueo: data, citas })
  } catch (err: unknown) {
    logger.error('agenda', `PATCH bloqueo: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const p = await preparar(params)
    if (p instanceof NextResponse) return p
    const { data, error } = await p.supabase.from('agenda_bloqueos').delete()
      .eq('id', p.fila.id).eq('clinica_id', p.clinicaId).select('id')
    if (error) {
      logger.error('agenda', `bloqueo sin quitar: ${error.code ?? ''}`)
      return NextResponse.json({ error: 'No se pudo quitar el bloqueo' }, { status: 500 })
    }
    if (!data?.length) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    const ctx = await contexto(p)
    const vinculo = { google_event_id: p.fila.google_event_id, gcal_calendar_id: p.fila.gcal_calendar_id }
    if (ctx) after(() => borrarBloqueoEnGoogle(vinculo, ctx))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    logger.error('agenda', `DELETE bloqueo: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
