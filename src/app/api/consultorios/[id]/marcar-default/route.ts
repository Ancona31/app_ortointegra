import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  return data ? { ...data, userId: user.id } : null
}

/**
 * PATCH /api/consultorios/[id]/marcar-default
 *
 * Marca el consultorio target como default. Invoca la función SQL
 * `marcar_consultorio_default(p_target_id uuid)` (migración 2.2-bis) que
 * ejecuta un UPDATE atómico single-statement.
 *
 * La función SQL es SECURITY INVOKER y valida internamente que el target
 * existe, está activo, y pertenece al usuario (medico_id = auth.uid()).
 * Si no → RAISE P0002 → 404.
 *
 * Idempotente: si el target ya es default, el UPDATE es no-op pero el
 * statement valida la invariante igualmente.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetId } = await params
    const supabase = await createClient()
    const profile = await getProfile(supabase)

    if (!profile) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('marcar_consultorio_default', {
      p_target_id: targetId,
    })

    if (error) {
      console.error('[PATCH marcar-default] error:', error)

      if (error.code === 'P0002') {
        return NextResponse.json(
          { error: 'Consultorio no encontrado o no pertenece al usuario' },
          { status: 404 }
        )
      }
      /* 23505 = unique_violation · 23P01 = exclusion_violation. LOS DOS, y no
         por duplicar por si acaso: `consultorios_default_unico` dejó de ser un
         índice único y pasó a ser una constraint EXCLUDE diferida
         (migración 20260919_consultorios_07_default_exclude), y una EXCLUDE
         violada lanza 23P01. El 23505 se queda porque esta rama es también el
         paracaídas de cualquier otra unicidad que llegue a la tabla, y porque
         el código tiene que sobrevivir a correr contra el esquema sin migrar.
         Si se mira sólo uno de los dos, el conflicto sale como 500 crudo. */
      if (error.code === '23505' || error.code === '23P01') {
        return NextResponse.json(
          { error: 'Conflicto de unicidad. Reintenta.' },
          { status: 409 }
        )
      }
      if (error.code === '23514') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, consultorio: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
