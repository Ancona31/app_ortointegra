import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { checkAuthRateLimit } from '@/lib/rateLimit'
import { contrasenaConocida } from '@/lib/hibp'
import { logAudit } from '@/lib/audit'
import { RegistroSchema } from '@/lib/perfil/schemas'
import { escapeHtml } from '@/lib/htmlEscape'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Alta pública — correo y contraseña, y nada más (Bloque B5, quinta parte).
 *
 * QUÉ CREA: el usuario de `auth` sin confirmar y su fila en `profiles`. QUÉ YA
 * NO CREA: la clínica (con su plan y sus topes) ni los datos del médico. Eso lo
 * pide el gate de onboarding — la clínica por `POST /api/me/clinica`, el resto
 * por `PUT /api/me/perfil-medico` y `POST /api/consultorios`.
 *
 * ⚠️ LA FILA DE `profiles` SE QUEDA AQUÍ, Y ES LOAD-BEARING. No hay trigger en
 * `auth.users` que la cree. Sin ella, `/api/me/estado-perfil` responde 404, el
 * gate lo lee como «todavía no sé» y NO monta el modal: el médico entraría sin
 * saber qué le falta, con la RLS como único freno. O sea que el gate se quedaría
 * ciego justo con el usuario que más lo necesita.
 *
 * ⚠️ `es_admin_de_clinica: true` NO ES DECORATIVO, PERO YA NO POR LO QUE AQUÍ
 * DECÍA. Esta nota justificaba el flag con el gate: que su `NOT NULL DEFAULT
 * false` hacía `requiereSoporte: true` y encerraba al médico nuevo en el panel
 * de soporte. Eso se arregló en B5.7 (2026-09-14) atacando la causa: el gate
 * mira `invitado_por`, no este flag, así que hoy un médico sin clínica y sin
 * invitador va al formulario aunque el flag esté en false.
 *
 * Lo que el flag decide —y por eso se escribe en true— es el PERMISO: es lo
 * que `canManageClinica` (`lib/permissions.ts:98`) lee para dejarle crear
 * consultorios, dar de alta a su equipo, tocar el logo y la facturación de la
 * clínica. Quien se registra por su cuenta es el dueño de la cuenta que está
 * creando. A los invitados los da de alta el admin con el flag en su default
 * false y con `invitado_por` puesto (`api/admin/crear-usuario`).
 *
 * `nombre_confirmado` se queda en su default `false`: aquí ya no se captura
 * ningún nombre. Lo pone en true `PUT /api/me/perfil-medico` cuando el médico
 * guarda el primer paso del onboarding.
 */
export async function POST(req: NextRequest) {
  // Rate limit: 3 registros por IP por hora
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  /* ⚠️ `registrar: false` AQUÍ: SE COMPRUEBA SIN CONSUMIR, y el presupuesto se
     gasta más abajo, justo antes de crear. El motivo es el aviso de contraseña
     conocida: con el consumo en esta línea, un médico que ve el aviso y decide
     —dos envíos— gastaría 2 de sus 3 registros por hora solo por dudar, y el
     tercero le dejaría fuera. Mismo criterio que `/api/auth/login`, que cuenta
     fallos y no intentos. */
  const { blocked } = await checkAuthRateLimit(ip, 'registro', 3, 60, { registrar: false })
  if (blocked) {
    logAudit({ accion: 'acceso_denegado', ip, descripcion: 'Registro bloqueado por rate limit (IP)' })
    return NextResponse.json({ error: 'Has excedido el límite de registros. Intenta más tarde.' }, { status: 429 })
  }

  const cuerpo = await req.json().catch(() => null)
  const parsed = RegistroSchema.safeParse(cuerpo)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Faltan campos obligatorios' }, { status: 400 })
  }
  const { email, password } = parsed.data
  /* Se lee del cuerpo crudo y no del esquema porque `RegistroSchema` describe
     el ALTA —correo y contraseña—, y esta bandera es del diálogo del aviso, no
     del registro. Es consultiva: la manda el cliente y ninguna propiedad de
     seguridad depende de ella. */
  const avisoVisto = (cuerpo as { aviso_visto?: unknown } | null)?.aviso_visto === true

  /* Aviso de contraseña conocida. Va antes de crear nada y antes de consumir
     presupuesto: si el médico decide elegir otra, no ha pasado nada. Aquí no
     hay token que quemar —a diferencia de la recuperación—, pero el orden se
     mantiene por la misma razón que allí: el aviso tiene que llegar cuando
     todavía puede elegir.
     Se comprueba siempre; la bandera decide si nos detenemos, no si miramos. */
  if (await contrasenaConocida(password) && !avisoVisto) {
    return NextResponse.json({ aviso: 'password_conocida' })
  }

  const admin = createAdminClient()

  // Verificar si el email ya existe
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (users.find(u => u.email === email)) {
    return NextResponse.json({ error: 'Este correo ya está registrado. Inicia sesión.' }, { status: 409 })
  }

  /* Ahora sí se consume: llegados aquí se va a crear la cuenta. La pareja de
     esta llamada es el `registrar: false` del principio — si quitas una, quita
     la otra, o el presupuesto deja de contarse o se cuenta dos veces. */
  await checkAuthRateLimit(ip, 'registro', 3, 60)

  // 1. Crear usuario sin confirmar (Supabase NO envía email)
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (authError) {
    return NextResponse.json({ error: 'Error al crear la cuenta. Intenta de nuevo.' }, { status: 400 })
  }

  /* 2. Crear perfil. El rol 'admin' no existe desde el refactor de etapa 4: el
        médico-dueño es `medico` + `es_admin_de_clinica`, que es lo que le da
        privilegios sobre la clínica que creará en el onboarding.

     ⚠️ ESTE ERROR NO SE COMPROBABA, y por ahí nacieron las cuentas huérfanas:
     si el upsert fallaba, la ruta respondía `ok` y quedaba un usuario de `auth`
     sin fila en `profiles` —sin gate, sin rol, sin clínica— que además ya podía
     iniciar sesión en cuanto confirmara el correo. Se revierte el usuario,
     igual que se revertía la clínica cuando fallaba `createUser`. */
  const { error: perfilError } = await admin.from('profiles').upsert({
    id:                  newUser.user.id,
    role:                'medico',
    es_admin_de_clinica: true,
  })

  if (perfilError) {
    await admin.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intenta de nuevo.' }, { status: 500 })
  }

  // 3. Generar link de confirmación y enviar via Resend (Supabase no envía nada)
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
      html: generarEmailConfirmacion(confirmUrl),
    })
  }

  return NextResponse.json({ ok: true })
}

function generarEmailConfirmacion(confirmUrl: string): string {
  /* EL SALUDO YA NO LLEVA NOMBRE porque el registro ya no lo pide: el médico lo
     captura en el onboarding, después de confirmar. Mismo saludo que
     `api/auth/reenviar-confirmacion/route.ts`, que lleva tiempo mandándolo sin
     nombre (lee `user_metadata.nombre`, que esta ruta nunca escribió).
     ⚠️ EL `escapeHtml` DE LA URL SE QUEDA aunque hoy la construya el servidor:
     este correo lo firma DKIM con mail.spinus.com.mx, y la garantía de que su
     cuerpo no lo elige un tercero no debe depender de que nadie cambie de dónde
     sale el valor. Antes se escapaba también el nombre, que sí venía del
     registro; ese riesgo se fue con el campo. */
  const urlSegura = escapeHtml(confirmUrl)
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
          <p style="color:#334155;font-size:15px;margin-top:0;">Hola,</p>
          <p style="color:#475569;font-size:14px;line-height:1.6;">Tu cuenta de Spinus ha sido creada. Confirma tu correo electrónico para comenzar a usar el sistema.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
            <tr><td align="center" style="background-color:#1e5fa8;padding:14px 36px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${urlSegura}" style="height:48px;width:220px;v-text-anchor:middle;" arcsize="20%" fillcolor="#1e5fa8" stroke="f"><v:textbox inset="0,0,0,0"><center style="color:#ffffff;font-family:Segoe UI,Helvetica,sans-serif;font-size:15px;font-weight:600;"><![endif]-->
              <a href="${urlSegura}" style="display:inline-block;background-color:#1e5fa8;color:#ffffff;text-decoration:none;padding:14px 36px;font-weight:600;font-size:15px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
                Confirmar mi cuenta
              </a>
              <!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
            </td></tr>
          </table>
          <p style="color:#64748b;font-size:12px;text-align:center;">Si el botón no funciona, copia este enlace:<br>
          <span style="color:#1e5fa8;word-break:break-all;">${urlSegura}</span></p>
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
