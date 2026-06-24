import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

export async function GET() {
  const { user, error } = await requireSuperAdmin()
  if (error) return error
  void user

  const admin = createAdminClient()
  const { data: clinicas } = await admin.from('clinicas').select('*').order('nombre')
  const { data: profiles } = await admin.from('profiles').select('id, clinica_id, role, titulo, nombres, apellido_paterno, apellido_materno, es_admin_de_clinica')
  const { data: authData } = await admin.auth.admin.listUsers()
  const authUsers = authData?.users ?? []

  const result = (clinicas || []).map(c => {
    const clinicaProfiles = (profiles || []).filter(p => p.clinica_id === c.id)

    // Dueño/admin de la clínica: medico con es_admin_de_clinica=true
    const adminProfile = clinicaProfiles.find(p => p.es_admin_de_clinica === true)

    const adminEmail = adminProfile
      ? (authUsers.find(u => u.id === adminProfile.id)?.email ?? null)
      : null

    // Post-refactor: todos los médicos (admin de clínica + invitados) son role='medico'
    const count_medicos = clinicaProfiles.filter(p => p.role === 'medico').length

    const usuarios = clinicaProfiles
      .filter(p => ['medico', 'secretaria'].includes(p.role))
      .map(p => ({
        id:     p.id,
        nombre: componerNombreMedicoCompleto({
          titulo: p.titulo, nombres: p.nombres,
          apellido_paterno: p.apellido_paterno, apellido_materno: p.apellido_materno,
        }),
        role:   p.role,
        email:  authUsers.find(u => u.id === p.id)?.email ?? null,
      }))

    return {
      ...c,
      count_medicos,
      count_secretarias: clinicaProfiles.filter(p => p.role === 'secretaria').length,
      admin: adminProfile
        ? { id: adminProfile.id, nombre: componerNombreMedicoCompleto({
            titulo: adminProfile.titulo, nombres: adminProfile.nombres,
            apellido_paterno: adminProfile.apellido_paterno, apellido_materno: adminProfile.apellido_materno,
          }), email: adminEmail }
        : null,
      usuarios,
    }
  })

  return NextResponse.json({ clinicas: result })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  if ('es_vip_grant' in body && typeof body.es_vip_grant !== 'boolean') {
    return NextResponse.json(
      { error: 'invalid_type', message: 'es_vip_grant debe ser boolean' },
      { status: 400 }
    )
  }

  if (typeof body.es_vip_grant === 'boolean') {
    const requested = body.es_vip_grant
    const admin = createAdminClient()

    const { data: row, error: selErr } = await admin
      .from('clinicas')
      .select('id, plan, suscripcion_estado, stripe_subscription_id, es_vip_grant, max_pacientes, max_medicos, max_secretarias')
      .eq('id', id)
      .maybeSingle()

    if (selErr) {
      return NextResponse.json(
        { error: 'select_failed', message: selErr.message },
        { status: 500 }
      )
    }
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    if (row.es_vip_grant === requested) {
      return NextResponse.json({ ok: true, no_change: true, clinica: row })
    }

    if (requested === true) {
      const { data: updated, error: updErr } = await admin
        .from('clinicas')
        .update({ es_vip_grant: true, max_pacientes: null })
        .eq('id', id)
        .select('*')
        .single()

      if (updErr) {
        return NextResponse.json(
          { error: 'update_failed', message: updErr.message },
          { status: 500 }
        )
      }

      await logAudit({
        userId: auth.user.id,
        accion: 'sa_toggle_vip',
        tabla: 'clinicas',
        registroId: String(id),
        descripcion: JSON.stringify({ from: row.es_vip_grant, to: true }),
      })

      return NextResponse.json({ ok: true, clinica: updated })
    }

    if (
      row.stripe_subscription_id &&
      row.suscripcion_estado === 'activo' &&
      row.plan !== 'free'
    ) {
      return NextResponse.json(
        {
          error: 'subscription_active',
          message: 'Esta cuenta tiene suscripción activa en Stripe. Gestiona desde Stripe Dashboard.',
        },
        { status: 409 }
      )
    }

    const { data: updated, error: updErr } = await admin
      .from('clinicas')
      .update({
        es_vip_grant: false,
        plan: 'free',
        max_pacientes: 5,
        max_medicos: 1,
        max_secretarias: 0,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updErr) {
      return NextResponse.json(
        { error: 'update_failed', message: updErr.message },
        { status: 500 }
      )
    }

    await logAudit({
      userId: auth.user.id,
      accion: 'sa_toggle_vip',
      tabla: 'clinicas',
      registroId: String(id),
      descripcion: JSON.stringify({ from: row.es_vip_grant, to: false }),
    })

    return NextResponse.json({ ok: true, clinica: updated })
  }

  const campos: Record<string, unknown> = {}
  if ('max_medicos' in body) campos.max_medicos = body.max_medicos
  if ('max_secretarias' in body) campos.max_secretarias = body.max_secretarias
  if ('nombre_display' in body) campos.nombre_display = body.nombre_display
  if ('subtitulo' in body) campos.subtitulo = body.subtitulo
  if ('color_primario' in body) campos.color_primario = body.color_primario
  if ('color_secundario' in body) campos.color_secundario = body.color_secundario
  if ('suspendida'      in body) campos.suspendida       = body.suspendida
  if ('max_pacientes'   in body) campos.max_pacientes    = body.max_pacientes

  const admin = createAdminClient()
  const { error } = await admin.from('clinicas').update(campos).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Determinar acción específica para el audit
  let accion: 'sa_toggle_vip' | 'sa_suspender_clinica' | 'sa_reactivar_clinica' | 'sa_editar_clinica' =
    'sa_editar_clinica'
  if ('max_pacientes' in body) accion = 'sa_toggle_vip'
  else if ('suspendida' in body) accion = body.suspendida ? 'sa_suspender_clinica' : 'sa_reactivar_clinica'

  await logAudit({
    userId: auth.user.id,
    accion,
    tabla: 'clinicas',
    registroId: String(id),
    descripcion: JSON.stringify(campos),
  })

  return NextResponse.json({ ok: true })
}
