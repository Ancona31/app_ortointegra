import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { checkAuthRateLimit } from '@/lib/rateLimit'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
  }

  // Rate limit: 3 reenvíos por email por hora
  const { blocked } = await checkAuthRateLimit(email, 'recovery', 3, 60)
  if (blocked) {
    return NextResponse.json(
      { error: 'Has solicitado demasiados reenvíos. Espera un momento e intenta de nuevo.' },
      { status: 429 },
    )
  }

  const admin = createAdminClient()

  // Buscar usuario por email
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = users.find(u => u.email === email)

  // Respuesta genérica para no revelar si el email existe
  if (!user) {
    return NextResponse.json({ ok: true })
  }

  if (user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Este correo ya fue confirmado. Puedes iniciar sesión.' },
      { status: 400 },
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx'

  // Genera un magic link — confirma el email y abre sesión al hacer clic
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const tokenHash = linkData?.properties?.hashed_token
  if (!tokenHash) {
    return NextResponse.json({ error: 'No se pudo generar el enlace. Intenta más tarde.' }, { status: 500 })
  }

  const confirmUrl = `${baseUrl}/auth/confirm-email?token_hash=${tokenHash}&type=magiclink`
  const nombre = (user.user_metadata?.nombre as string | undefined) ?? ''

  await resend.emails.send({
    from: 'Spinus <noreply@mail.spinus.com.mx>',
    to: email,
    subject: 'Confirma tu cuenta — Spinus',
    html: generarEmail(nombre, confirmUrl),
  })

  return NextResponse.json({ ok: true })
}

function generarEmail(nombre: string, confirmUrl: string): string {
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
          <p style="color:#334155;font-size:15px;margin-top:0;">Hola${nombre ? ` <strong>${nombre}</strong>` : ''},</p>
          <p style="color:#475569;font-size:14px;line-height:1.6;">Solicitaste reenviar el enlace de confirmación. Haz clic para activar tu cuenta.</p>
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
