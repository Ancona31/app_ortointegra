import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { PLAN_LIMITS } from '@/lib/plans'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const {
    email, password, nombre, nombreClinica,
    titulo, especialidad, cedula_profesional, cedula_especialidad,
    tipo = 'independiente',
  } = await req.json()

  if (!email || !password || !nombre || !nombreClinica || !titulo || !especialidad || !cedula_profesional) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  if (!['independiente', 'clinica'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo de cuenta inválido' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Correo electrónico inválido' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar si el email ya existe
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (users.find(u => u.email === email)) {
    return NextResponse.json({ error: 'Este correo ya está registrado. Inicia sesión.' }, { status: 409 })
  }

  const limits = PLAN_LIMITS.free

  // 1. Crear clínica
  const { data: clinica, error: clinicaError } = await admin
    .from('clinicas')
    .insert({
      nombre:             nombreClinica,
      tipo,
      plan:               'free',
      suscripcion_estado: 'activo',
      max_medicos:        limits.max_medicos,
      max_secretarias:    limits.max_secretarias,
      max_pacientes:      limits.max_pacientes,
    })
    .select('id')
    .single()

  if (clinicaError || !clinica) {
    return NextResponse.json({ error: 'Error al crear el consultorio. Intenta de nuevo.' }, { status: 500 })
  }

  // 2. Crear usuario sin confirmar (Supabase NO envía email)
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (authError) {
    await admin.from('clinicas').delete().eq('id', clinica.id)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intenta de nuevo.' }, { status: 400 })
  }

  // 3. Crear perfil
  // Todos los dueños de cuenta son admin — independientes y clínicas
  // En clínicas: admin no ocupa slot de médico, gestiona el equipo
  // En independiente: admin ES el médico (billing lo cuenta como 1 médico)
  const role = 'admin'

  await admin.from('profiles').upsert({
    id:                  newUser.user.id,
    role,
    nombre,
    clinica_id:          clinica.id,
    titulo,
    especialidad,
    cedula_profesional:  cedula_profesional  || null,
    cedula_especialidad: cedula_especialidad || null,
  })

  // 4. Generar link de confirmación y enviar via Resend (Supabase no envía nada)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx'
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { redirectTo: `${baseUrl}/auth/callback` },
  })

  const confirmUrl = linkData?.properties?.action_link
  if (confirmUrl) {
    await resend.emails.send({
      from: 'Spinus <noreply@mail.spinus.com.mx>',
      to: email,
      subject: 'Confirma tu cuenta — Spinus',
      html: generarEmailConfirmacion(nombre, confirmUrl),
    })
  }

  return NextResponse.json({ ok: true })
}

function generarEmailConfirmacion(nombre: string, confirmUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="max-width:540px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1a3a5c,#1e5fa8);padding:28px;">
      <p style="margin:0 0 4px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Spinus</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Confirma tu cuenta</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:15px;margin-top:0;">Hola <strong>${nombre}</strong>,</p>
      <p style="color:#475569;font-size:14px;line-height:1.6;">Tu cuenta de Spinus ha sido creada. Confirma tu correo electrónico para comenzar a usar el sistema.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a3a5c,#1e5fa8);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:600;font-size:15px;">
          Confirmar mi cuenta
        </a>
      </div>
      <p style="color:#64748b;font-size:13px;">Si el botón no funciona, copia este enlace:</p>
      <p style="color:#1e5fa8;font-size:12px;word-break:break-all;">${confirmUrl}</p>
      <p style="color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:24px;">
        Si no creaste esta cuenta, ignora este mensaje. El enlace expira en 24 horas.
      </p>
    </div>
  </div>
</body>
</html>`
}
