import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

type Tipo = 'independiente' | 'clinica'

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { max_medicos, max_secretarias, tipo } = body as {
    max_medicos?: unknown
    max_secretarias?: unknown
    tipo?: unknown
  }

  if (!isInt(max_medicos) || max_medicos < 1) {
    return NextResponse.json(
      { error: 'invalid_max_medicos', message: 'max_medicos debe ser entero >= 1' },
      { status: 400 }
    )
  }
  if (!isInt(max_secretarias) || max_secretarias < 0) {
    return NextResponse.json(
      { error: 'invalid_max_secretarias', message: 'max_secretarias debe ser entero >= 0' },
      { status: 400 }
    )
  }

  let tipoValidado: Tipo | undefined
  if (tipo !== undefined) {
    if (tipo !== 'independiente' && tipo !== 'clinica') {
      return NextResponse.json(
        { error: 'invalid_tipo', message: "tipo debe ser 'independiente' o 'clinica'" },
        { status: 400 }
      )
    }
    tipoValidado = tipo
  }

  const admin = createAdminClient()

  const { data: row, error: selErr } = await admin
    .from('clinicas')
    .select('id, es_vip_grant, max_medicos, max_secretarias, tipo')
    .eq('id', id)
    .maybeSingle()

  if (selErr) {
    return NextResponse.json(
      { error: 'select_failed', message: selErr.message },
      { status: 500 }
    )
  }
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (row.es_vip_grant !== true) {
    return NextResponse.json(
      {
        error: 'not_vip',
        message: 'Solo las clínicas VIP pueden tener límites editables manualmente.',
      },
      { status: 409 }
    )
  }

  const updateFields: Record<string, unknown> = {
    max_medicos,
    max_secretarias,
  }
  if (tipoValidado !== undefined) updateFields.tipo = tipoValidado

  const { data: updated, error: updErr } = await admin
    .from('clinicas')
    .update(updateFields)
    .eq('id', id)
    .select('id, max_medicos, max_secretarias, tipo')
    .single()

  if (updErr) {
    return NextResponse.json(
      { error: 'update_failed', message: updErr.message },
      { status: 500 }
    )
  }

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_editar_limites',
    tabla: 'clinicas',
    registroId: String(id),
    descripcion: JSON.stringify({
      from: {
        max_medicos: row.max_medicos,
        max_secretarias: row.max_secretarias,
        tipo: row.tipo,
      },
      to: {
        max_medicos: updated.max_medicos,
        max_secretarias: updated.max_secretarias,
        tipo: updated.tipo,
      },
    }),
  })

  return NextResponse.json({ ok: true, clinica: updated })
}
