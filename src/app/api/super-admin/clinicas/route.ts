import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const { user, error } = await requireSuperAdmin()
  if (error) return error
  void user

  const admin = createAdminClient()
  const { data: clinicas } = await admin.from('clinicas').select('*').order('nombre')
  const { data: profiles } = await admin.from('profiles').select('id, clinica_id, role, nombre')
  const { data: authData } = await admin.auth.admin.listUsers()
  const authUsers = authData?.users ?? []

  const result = (clinicas || []).map(c => {
    const clinicaProfiles = (profiles || []).filter(p => p.clinica_id === c.id)

    // Todos los dueños de cuenta son role='admin' (independientes y clínicas)
    const adminProfile = clinicaProfiles.find(p => p.role === 'admin')

    const adminEmail = adminProfile
      ? (authUsers.find(u => u.id === adminProfile.id)?.email ?? null)
      : null

    // Independiente: admin ES el médico → cuenta como 1
    // Clínica: solo role='medico' ocupa slots
    const count_medicos = c.tipo === 'independiente'
      ? (adminProfile ? 1 : 0)
      : clinicaProfiles.filter(p => p.role === 'medico').length

    const usuarios = clinicaProfiles
      .filter(p => ['medico', 'secretaria', 'admin'].includes(p.role))
      .map(p => ({
        id:     p.id,
        nombre: p.nombre,
        role:   p.role,
        email:  authUsers.find(u => u.id === p.id)?.email ?? null,
      }))

    return {
      ...c,
      count_medicos,
      count_secretarias: clinicaProfiles.filter(p => p.role === 'secretaria').length,
      admin: adminProfile
        ? { id: adminProfile.id, nombre: adminProfile.nombre, email: adminEmail }
        : null,
      usuarios,
    }
  })

  return NextResponse.json({ clinicas: result })
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const { nombre, max_medicos, max_secretarias, adminNombre, adminEmail, adminPassword } = await req.json()

  // Todas las clínicas requieren administrador al momento de creación
  if (!nombre || !adminNombre || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Se requieren nombre de clínica, nombre, email y contraseña del administrador' }, { status: 400 })
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(adminEmail)) return NextResponse.json({ error: 'Email del admin inválido' }, { status: 400 })
  if (adminPassword.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Crear clínica
  const { data: nuevaClinica, error } = await admin
    .from('clinicas')
    .insert({ nombre, max_medicos, max_secretarias })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 2. Crear admin — revertir clínica si falla
  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  })

  if (authErr) {
    await admin.from('clinicas').delete().eq('id', nuevaClinica.id)
    return NextResponse.json({ error: `Error al crear admin: ${authErr.message}` }, { status: 400 })
  }

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: newUser.user.id,
    role: 'admin',
    nombre: adminNombre,
    clinica_id: nuevaClinica.id,
    titulo: 'Dr.',
  })

  if (profileErr) {
    await admin.auth.admin.deleteUser(newUser.user.id)
    await admin.from('clinicas').delete().eq('id', nuevaClinica.id)
    return NextResponse.json({ error: `Error al crear perfil: ${profileErr.message}` }, { status: 500 })
  }

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_crear_clinica',
    tabla: 'clinicas',
    registroId: nuevaClinica.id,
    descripcion: `nombre=${nombre}; admin=${adminEmail}`,
  })

  return NextResponse.json({ ok: true })
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
