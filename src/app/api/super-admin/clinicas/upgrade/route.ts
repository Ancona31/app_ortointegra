import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/* ── POST /api/super-admin/clinicas/upgrade ─────────────────
   Convierte una cuenta independiente en cuenta de clínica.
   - Cambia clinicas.tipo a 'clinica'
   - Cambia el profile del dueño de role:'medico' a role:'admin'
   - Actualiza los límites del plan
   Body: { clinicaId, max_medicos, max_secretarias, max_pacientes }
──────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const { clinicaId, max_medicos, max_secretarias, max_pacientes } = await req.json()
  if (!clinicaId) return NextResponse.json({ error: 'Falta clinicaId' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que existe y es independiente
  const { data: clinica } = await admin
    .from('clinicas')
    .select('id, tipo')
    .eq('id', clinicaId)
    .single()

  if (!clinica) return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })
  if (clinica.tipo !== 'independiente') {
    return NextResponse.json({ error: 'Esta cuenta ya es de tipo clínica' }, { status: 409 })
  }

  // 1. Actualizar la clínica
  const { error: clinicaErr } = await admin
    .from('clinicas')
    .update({
      tipo:             'clinica',
      max_medicos:      max_medicos      ?? 3,
      max_secretarias:  max_secretarias  ?? 1,
      max_pacientes:    max_pacientes    ?? null,
    })
    .eq('id', clinicaId)

  if (clinicaErr) return NextResponse.json({ error: clinicaErr.message }, { status: 500 })

  // 2. Cambiar el rol del dueño a admin (independientemente de si era 'medico' o 'admin')
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('clinica_id', clinicaId)
    .in('role', ['medico', 'admin'])

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_upgrade_clinica',
    tabla: 'clinicas',
    registroId: String(clinicaId),
    descripcion: `max_medicos=${max_medicos}; max_secretarias=${max_secretarias}; max_pacientes=${max_pacientes}`,
  })

  return NextResponse.json({ ok: true })
}
