/**
 * PATCH /api/agenda/tipos-cita/[id] — edita o archiva un tipo de cita.
 * Agenda B6 (decisión P5). No hay DELETE: un tipo se archiva con
 * `{ activo: false }` (las citas lo referencian con RESTRICT y ni la RLS ni
 * los privilegios conceden borrar). El ámbito (`medico_id`) no se edita: ver
 * `EditarTipoCitaSchema`.
 *
 * Sólo el administrador de la clínica (403), con la agenda v2 encendida (404).
 * Cliente de SESIÓN: la RLS de `tipos_cita` limita la escritura a su clínica,
 * y el `eq('clinica_id')` es explícito aunque ya filtre. La auditoría la da el
 * disparador `audit_tipos_cita` (log_tabla_change).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import { COLUMNAS_TIPO_CITA, EditarTipoCitaSchema, respuestaErrorTipoCita } from '@/lib/agenda/tiposCita'
import { logger } from '@/lib/logger'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

async function perfilDeSesion(supabase: ClienteSesion) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  return data ? { ...data, userId: user.id } : null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    const supabase = await createClient()
    const profile = await perfilDeSesion(supabase)
    if (!profile) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!profile.clinica_id || !canManageClinica(profile)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    if (!(await agendaV2Encendida(supabase, profile.clinica_id))) {
      return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
    }
    if (!z.guid().safeParse(id).success) {
      return NextResponse.json({ error: 'Tipo de cita no encontrado' }, { status: 404 })
    }
    const parsed = EditarTipoCitaSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    const { data, error } = await supabase.from('tipos_cita')
      .update(parsed.data)
      .eq('id', id)
      .eq('clinica_id', profile.clinica_id)
      .select(COLUMNAS_TIPO_CITA)
      .maybeSingle()
    if (error) {
      const r = respuestaErrorTipoCita(error)
      if (r.status === 500) logger.error('agenda', `tipo de cita sin editar: ${error.code ?? ''} ${error.message}`)
      return NextResponse.json(r.body, { status: r.status })
    }
    if (!data) return NextResponse.json({ error: 'Tipo de cita no encontrado' }, { status: 404 })
    return NextResponse.json({ tipo: data })
  } catch (err: unknown) {
    logger.error('agenda', `PATCH tipos de cita: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
