import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createHmac } from 'crypto'
import { logger } from '@/lib/logger'
import { escapeHtml } from '@/lib/htmlEscape'

const resend = new Resend(process.env.RESEND_API_KEY)

/* ─── Standard Webhooks verification ─────────────────────────
   Supabase Auth Hooks (HTTPS) usan el estándar "Standard Webhooks".
   Headers enviados: webhook-id, webhook-timestamp, webhook-signature
   Secret format: v1,whsec_<base64_key>
   Signed content: "${webhook-id}.${webhook-timestamp}.${body}"
   Signature: HMAC-SHA256 del signed content con la key decodificada
   ──────────────────────────────────────────────────────────── */

function verificarFirma(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.SUPABASE_HOOK_SECRET
  if (!secret) {
    logger.error('EMAIL-HOOK', 'SUPABASE_HOOK_SECRET no configurado')
    return false
  }

  const webhookId = req.headers.get('webhook-id')
  const webhookTimestamp = req.headers.get('webhook-timestamp')
  const webhookSignature = req.headers.get('webhook-signature')

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    logger.warn('EMAIL-HOOK', `Headers faltantes — id: ${!!webhookId}, ts: ${!!webhookTimestamp}, sig: ${!!webhookSignature}`)
    return false
  }

  // Extraer la clave base64 del secret: "v1,whsec_BASE64" → BASE64
  const secretBase64 = secret.replace(/^v1,whsec_/, '')
  const key = Buffer.from(secretBase64, 'base64')

  // El contenido firmado es: "webhook-id.webhook-timestamp.body"
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const expectedSignature = createHmac('sha256', key).update(signedContent).digest('base64')

  // webhook-signature puede tener múltiples firmas separadas por espacio: "v1,SIG1 v1,SIG2"
  const signatures = webhookSignature.split(' ')

  for (const sig of signatures) {
    const sigValue = sig.replace(/^v1,/, '')
    if (sigValue === expectedSignature) return true
  }

  logger.warn('EMAIL-HOOK', 'Firma no coincide')
  return false
}

// Supabase Auth Hook — Send Email
// URL: https://www.spinus.com.mx/api/auth/email-hook
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verificarFirma(req, rawBody)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = JSON.parse(rawBody)
    const { user, email_data } = body
    const email: string = user?.email
    /* ⚠️ AQUÍ SE LEÍA UN NOMBRE DE `user_metadata` CON RESPALDO 'Doctor', Y EL
       RESPALDO ERA EL ÚNICO VALOR QUE EXISTÍA: `user_metadata.nombre` no lo
       escribe nadie en todo el proyecto —tres lecturas, cero escrituras—, así
       que TODOS los correos de este hook saludaban «Hola, Doctor». Incluido el
       de recuperación de contraseña de una asistente, que no es doctora.
       El saludo va sin nombre, como en `api/auth/registro` y en
       `api/auth/reenviar-confirmacion`. Si algún día hace falta el nombre de
       verdad, sale de `profiles` y no de los metadatos de auth — pero eso es
       una consulta a la base dentro del camino crítico del correo, y hoy no la
       paga ningún beneficio. */
    const actionType: string = email_data?.email_action_type
    const tokenHash: string = email_data?.token_hash
    const redirectTo: string = email_data?.redirect_to || 'https://www.spinus.com.mx/auth/callback'

    if (!email || !tokenHash) {
      logger.error('EMAIL-HOOK', `Datos incompletos — action: ${actionType}`)
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.spinus.com.mx'
    let subject = ''
    let html = ''

    if (actionType === 'signup') {
      const url = `${siteUrl}/auth/confirm-email?token_hash=${tokenHash}&type=email&redirect_to=${encodeURIComponent(redirectTo)}`
      subject = 'Confirma tu cuenta — Spinus'
      html = emailConfirmacion(url)
    } else if (actionType === 'recovery') {
      /* ⚠️ APUNTA A NUESTRA PÁGINA Y EL TOKEN NO SE CANJEA EN EL NAVEGADOR.
         `/reset-password` sólo pinta un formulario; quien canjea es
         `/api/auth/reset-password`, en servidor, con un cliente sin cookies y
         sin devolver sesión.
         Aquí estuvo `/auth/confirm?token_hash=…&type=recovery`, que llamaba a
         `verifyOtp` al montarse: eso ESTABLECE SESIÓN, así que un enlace ajeno
         dejaba al médico dentro de la cuenta del atacante y todo lo que
         escribiera aterrizaba en la clínica de otro vía `get_clinica_id()`.
         · No lo mandes a `/auth/v1/verify` de GoTrue «para usar PKCE»: eso ata
           la recuperación a UN navegador y la rompe entre dispositivos.
         · No añadas `&type=`: el tipo lo fija el servidor. Un parámetro que el
           cliente puede cambiar es una palanca, no un dato. */
      const url = `${siteUrl}/reset-password?token_hash=${tokenHash}`
      subject = 'Recupera tu contraseña — Spinus'
      html = emailRecuperacion(url)
    } else if (actionType === 'magiclink') {
      const url = `${siteUrl}/auth/callback?token_hash=${tokenHash}&type=magiclink`
      subject = 'Tu enlace de acceso — Spinus'
      html = emailMagicLink(url)
    } else {
      logger.info('EMAIL-HOOK', `Tipo no manejado: ${actionType}`)
      return NextResponse.json({ ok: true })
    }

    const { error } = await resend.emails.send({
      from: 'Spinus <noreply@mail.spinus.com.mx>',
      to: email,
      subject,
      html,
    })

    if (error) {
      logger.error('EMAIL-HOOK', 'Error al enviar email vía Resend')
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 })
    }

    logger.info('EMAIL-HOOK', `${actionType} procesado correctamente`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    logger.error('EMAIL-HOOK', 'Error inesperado en hook')
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/* ─── Templates de email (compatibles con Outlook) ───────── */

function emailBase(titulo: string, contenido: string): string {
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
        <!-- Header -->
        <tr><td style="background-color:#1a3a5c;padding:28px;">
          <p style="margin:0 0 4px;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Spinus</p>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${titulo}</h1>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px;">
          ${contenido}
          <p style="color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:24px;">
            Si no reconoces esta acción, ignora este mensaje.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function boton(url: string, texto: string): string {
  // `texto` no se escapa: los tres sitios que llaman pasan un literal. `url` sí,
  // por la razón de siempre — que la garantía no dependa de su procedencia.
  const urlSegura = escapeHtml(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
    <tr><td align="center" style="background-color:#1e5fa8;padding:14px 36px;">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${urlSegura}" style="height:48px;width:220px;v-text-anchor:middle;" arcsize="20%" fillcolor="#1e5fa8" stroke="f"><v:textbox inset="0,0,0,0"><center style="color:#ffffff;font-family:Segoe UI,Helvetica,sans-serif;font-size:15px;font-weight:600;"><![endif]-->
      <a href="${urlSegura}" style="display:inline-block;background-color:#1e5fa8;color:#ffffff;text-decoration:none;padding:14px 36px;font-weight:600;font-size:15px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
        ${texto}
      </a>
      <!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
    </td></tr>
  </table>
  <p style="color:#64748b;font-size:12px;text-align:center;">Si el botón no funciona, copia este enlace:<br>
  <span style="color:#1e5fa8;word-break:break-all;">${urlSegura}</span></p>`
}

function emailConfirmacion(url: string): string {
  return emailBase('Confirma tu cuenta', `
    <p style="color:#334155;font-size:15px;margin-top:0;">Hola,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Tu cuenta de Spinus ha sido creada. Confirma tu correo electrónico para comenzar.</p>
    ${boton(url, 'Confirmar mi cuenta')}
  `)
}

function emailRecuperacion(url: string): string {
  return emailBase('Recupera tu contraseña', `
    <p style="color:#334155;font-size:15px;margin-top:0;">Hola,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
    ${boton(url, 'Restablecer contraseña')}
  `)
}

function emailMagicLink(url: string): string {
  return emailBase('Tu enlace de acceso', `
    <p style="color:#334155;font-size:15px;margin-top:0;">Hola,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Usa el botón a continuación para acceder a tu cuenta.</p>
    ${boton(url, 'Acceder a Spinus')}
  `)
}
