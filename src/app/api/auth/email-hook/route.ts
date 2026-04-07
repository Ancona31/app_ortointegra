import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createHmac, timingSafeEqual } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

function verificarFirma(payload: string, signatureHeader: string): boolean {
  const secret = process.env.SUPABASE_HOOK_SECRET
  if (!secret) return false

  // Secret: "v1,whsec_BASE64" → extraer la parte base64
  const secretBase64 = secret.replace(/^v1,whsec_/, '')
  const key = Buffer.from(secretBase64, 'base64')

  // Firma recibida: "v1,BASE64_HMAC" → extraer solo el base64
  const receivedBase64 = signatureHeader.replace(/^v1,/, '')

  const expected = createHmac('sha256', key).update(payload).digest('base64')
  try {
    return timingSafeEqual(Buffer.from(receivedBase64), Buffer.from(expected))
  } catch {
    return false
  }
}

// Supabase Auth Hook — Send Email
// Configurar en: Supabase → Authentication → Hooks → Send Email
// URL: https://www.spinus.com.mx/api/auth/email-hook
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-supabase-signature') ?? ''

  if (!verificarFirma(rawBody, signature)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)

  const { user, email_data } = body
  const email: string = user?.email
  const nombre: string = user?.user_metadata?.nombre || 'Doctor'
  const actionType: string = email_data?.email_action_type
  const tokenHash: string = email_data?.token_hash
  const redirectTo: string = email_data?.redirect_to || 'https://www.spinus.com.mx/auth/callback'

  if (!email || !tokenHash) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  // Construir URL de confirmación/acción
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx'
  let subject = ''
  let html = ''

  if (actionType === 'signup') {
    const confirmUrl = `${siteUrl}/auth/confirm-email?token_hash=${tokenHash}&type=email&redirect_to=${encodeURIComponent(redirectTo)}`
    subject = 'Confirma tu cuenta — Spinus'
    html = emailConfirmacion(nombre, confirmUrl)
  } else if (actionType === 'recovery') {
    const recoveryUrl = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery`
    subject = 'Recupera tu contraseña — Spinus'
    html = emailRecuperacion(nombre, recoveryUrl)
  } else if (actionType === 'magiclink') {
    const magicUrl = `${siteUrl}/auth/callback?token_hash=${tokenHash}&type=magiclink`
    subject = 'Tu enlace de acceso — Spinus'
    html = emailMagicLink(nombre, magicUrl)
  } else {
    // Tipo no manejado — dejar que Supabase lo envíe
    return NextResponse.json({ ok: true })
  }

  await resend.emails.send({
    from: 'Spinus <noreply@mail.spinus.com.mx>',
    to: email,
    subject,
    html,
  })

  return NextResponse.json({ ok: true })
}

function emailBase(titulo: string, contenido: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#f8fafc;margin:0;padding:0;">
  <div style="max-width:540px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1a3a5c,#1e5fa8);padding:28px;">
      <p style="margin:0 0 4px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Spinus</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${titulo}</h1>
    </div>
    <div style="padding:32px;">
      ${contenido}
      <p style="color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:24px;">
        Si no reconoces esta acción, ignora este mensaje.
      </p>
    </div>
  </div>
</body>
</html>`
}

function boton(url: string, texto: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#1a3a5c,#1e5fa8);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:600;font-size:15px;">
      ${texto}
    </a>
  </div>
  <p style="color:#64748b;font-size:12px;text-align:center;">Si el botón no funciona, copia este enlace:<br>
  <span style="color:#1e5fa8;word-break:break-all;">${url}</span></p>`
}

function emailConfirmacion(nombre: string, url: string): string {
  return emailBase('Confirma tu cuenta', `
    <p style="color:#334155;font-size:15px;margin-top:0;">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Tu cuenta de Spinus ha sido creada. Confirma tu correo electrónico para comenzar.</p>
    ${boton(url, 'Confirmar mi cuenta')}
  `)
}

function emailRecuperacion(nombre: string, url: string): string {
  return emailBase('Recupera tu contraseña', `
    <p style="color:#334155;font-size:15px;margin-top:0;">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
    ${boton(url, 'Restablecer contraseña')}
  `)
}

function emailMagicLink(nombre: string, url: string): string {
  return emailBase('Tu enlace de acceso', `
    <p style="color:#334155;font-size:15px;margin-top:0;">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Usa el botón a continuación para acceder a tu cuenta.</p>
    ${boton(url, 'Acceder a Spinus')}
  `)
}
