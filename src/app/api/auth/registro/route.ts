import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { PLAN_LIMITS } from '@/lib/plans'
import { checkAuthRateLimit } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'
import { RegistroSchema } from '@/lib/perfil/schemas'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  // Rate limit: 3 registros por IP por hora
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { blocked } = await checkAuthRateLimit(ip, 'registro', 3, 60)
  if (blocked) {
    logAudit({ accion: 'acceso_denegado', ip, descripcion: 'Registro bloqueado por rate limit (IP)' })
    return NextResponse.json({ error: 'Has excedido el límite de registros. Intenta más tarde.' }, { status: 429 })
  }

  const parsed = RegistroSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Faltan campos obligatorios' }, { status: 400 })
  }
  const {
    email, password, nombres, apellido_paterno, apellido_materno, nombreClinica,
    titulo, especialidad, cedula_profesional, cedula_especialidad, tipo,
  } = parsed.data

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
      suscripcion_estado: 'free',
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
  // Todos los dueños de cuenta son medico + es_admin_de_clinica=true
  // Post-refactor: el rol 'admin' fue eliminado. El médico-dueño se distingue
  // por el flag es_admin_de_clinica que le da privilegios sobre la clínica.
  const role = 'medico'

  await admin.from('profiles').upsert({
    id:                   newUser.user.id,
    role,
    es_admin_de_clinica:  true,
    nombres,
    apellido_paterno,
    apellido_materno,
    nombre_confirmado:    true,   // el dueño captura su propio nombre
    clinica_id:           clinica.id,
    titulo,
    especialidad,
    cedula_profesional:   cedula_profesional  || null,
    cedula_especialidad:  cedula_especialidad || null,
  })

  // 4. Generar link de confirmación y enviar via Resend (Supabase no envía nada)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx'
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
  })

  const tokenHash = linkData?.properties?.hashed_token
  if (tokenHash) {
    const confirmUrl = `${baseUrl}/auth/confirm-email?token_hash=${tokenHash}&type=email`
    await resend.emails.send({
      from: 'Spinus <noreply@mail.spinus.com.mx>',
      to: email,
      subject: 'Confirma tu cuenta — Spinus',
      html: generarEmailConfirmacion(nombres, confirmUrl),
    })
  }

  return NextResponse.json({ ok: true })
}

function generarEmailConfirmacion(nombre: string, confirmUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
        <tr><td style="background-color:#1a3a5c;padding:28px;">
          <p style="margin:0 0 4px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Spinus</p>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Confirma tu cuenta</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#334155;font-size:15px;margin-top:0;">Hola <strong>${nombre}</strong>,</p>
          <p style="color:#475569;font-size:14px;line-height:1.6;">Tu cuenta de Spinus ha sido creada. Confirma tu correo electrónico para comenzar a usar el sistema.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
            <tr><td align="center" style="background-color:#1e5fa8;padding:14px 36px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${confirmUrl}" style="height:48px;width:220px;v-text-anchor:middle;" arcsize="20%" fillcolor="#1e5fa8" stroke="f"><v:textbox inset="0,0,0,0"><center style="color:#ffffff;font-family:Segoe UI,Helvetica,sans-serif;font-size:15px;font-weight:600;"><![endif]-->
              <a href="${confirmUrl}" style="display:inline-block;background-color:#1e5fa8;color:#ffffff;text-decoration:none;padding:14px 36px;font-weight:600;font-size:15px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
                Confirmar mi cuenta
              </a>
              <!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
            </td></tr>
          </table>
          <p style="color:#64748b;font-size:12px;text-align:center;">Si el botón no funciona, copia este enlace:<br>
          <span style="color:#1e5fa8;word-break:break-all;">${confirmUrl}</span></p>
          <p style="color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:24px;">
            Si no creaste esta cuenta, ignora este mensaje. El enlace expira en 24 horas.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
