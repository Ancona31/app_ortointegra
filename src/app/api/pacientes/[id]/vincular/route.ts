import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('id, clinica_id, role, es_admin_de_clinica').eq('id', user.id).single()
  return data ? { ...data, userId: user.id } : null
}

/**
 * POST /api/pacientes/[id]/vincular — vincular un médico a un paciente existente
 *
 * DUP-RPC Fase 1 (Frente 3, D-C). Cuando ante un duplicado detectado el médico
 * elige "es el mismo paciente", se le vincula al paciente existente en vez de
 * crear uno nuevo (inserta una fila en paciente_medico).
 *
 * NO hace pre-SELECT sobre `pacientes` (corrección 🔴 #1 del plan): el médico
 * invitado aún no puede ver ese paciente por RLS, así que un pre-SELECT daría un
 * 404 falso. Se confía en el WITH CHECK de la policy de paciente_medico; si lo
 * rechaza, se traduce a 403.
 */
export async function POST(req: NextRequest, ctx: RouteContext<'/api/pacientes/[id]/vincular'>) {
  try {
    const supabase = await createClient()
    const profile = await getProfile(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { medico_id?: unknown }

    // Médico a vincular. Las policies RLS de paciente_medico son la autoridad (D-B):
    // un médico regular solo a sí mismo; secretaria/médico admin a quien indique el body.
    const isMedico = profile.role === 'medico'
    const isAdmin = profile.es_admin_de_clinica === true
    const bodyMedicoId =
      typeof body.medico_id === 'string' && body.medico_id.trim().length > 0 ? body.medico_id.trim() : null

    let medicoId: string | null = null
    if (isMedico && !isAdmin) medicoId = profile.userId   // médico regular → a sí mismo
    else if (bodyMedicoId) medicoId = bodyMedicoId         // secretaria / admin → médico del body
    else if (isMedico) medicoId = profile.userId           // médico admin sin medico_id → a sí mismo

    if (!medicoId) {
      return NextResponse.json(
        { error: 'No se pudo determinar el médico a vincular. Proporciona medico_id.' },
        { status: 400 }
      )
    }

    // INSERT idempotente (ON CONFLICT DO NOTHING). Se confía en el WITH CHECK de la policy.
    const { error } = await supabase
      .from('paciente_medico')
      .upsert(
        { paciente_id: id, medico_id: medicoId, asignado_por: profile.userId },
        { onConflict: 'paciente_id,medico_id', ignoreDuplicates: true }
      )

    if (error) {
      // 42501 = la policy WITH CHECK rechazó el INSERT (RLS) → sin permiso
      if (error.code === '42501') {
        return NextResponse.json({ error: 'No tienes permiso para vincular este paciente' }, { status: 403 })
      }
      // 23503 (FK: medico_id inexistente) / 22P02 (medico_id no es UUID) → input inválido del cliente
      if (error.code === '23503' || error.code === '22P02') {
        return NextResponse.json({ error: 'El médico especificado no es válido' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auditoría (Camino X) — fire-and-forget, no bloquea la operación
    logAudit({
      userId: profile.userId,
      accion: 'vincular_medico',
      tabla: 'paciente_medico',
      registroId: id,
      descripcion: `Vinculó al médico ${medicoId} con el paciente ${id}`,
    })

    return NextResponse.json({ ok: true, paciente_id: id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
