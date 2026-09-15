import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { z } from 'zod'
import { checkIpRateLimit } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

/* ═══ POR QUÉ ESTA RUTA NO DEVUELVE SESIÓN, Y NO ES UN OLVIDO ═══════════════
   OWASP Forgot Password: «Once they have set their new password, the user
   should then login through the usual mechanism. Don't automatically log the
   user in, as this introduces additional complexity to the authentication and
   session handling code, and increases the likelihood of introducing
   vulnerabilities».

   El canje ocurre AQUÍ con un cliente STANDALONE de @supabase/supabase-js
   —sin el adaptador de cookies de @supabase/ssr—, así que la sesión que GoTrue
   devuelve vive en la memoria de esta invocación y muere con ella. El médico
   acaba en /login y entra por la puerta de siempre.

   Aquí estuvo `/auth/confirm/page.tsx`, que llamaba a `verifyOtp` en el
   NAVEGADOR al montarse. Eso establece sesión en cookies de todo el dominio
   (auth-js GoTrueClient.js:1124-1126 + el adaptador de @supabase/ssr), así que
   un enlace ajeno dejaba al médico dentro de la cuenta del atacante, y con
   `get_clinica_id()` saliendo del JWT todo lo que escribiera a partir de ahí
   aterrizaba en la clínica de otro.

   ⚠️ NO conviertas esto en `createClient()` de `@/lib/supabase/server` ni le
   pases cookies. En el momento en que la sesión llegue al navegador vuelve el
   agujero entero, porque con `secure_password_change` en false LA SESIÓN ES LA
   AUTORIZACIÓN del cambio de contraseña.

   Mismo patrón que `/api/auth/verify-email`, y por eso allí esto nunca
   existió. */

const Body = z.object({
  token_hash: z.string().min(20).max(256),
  /* 6 es el mínimo de HOY, y coincide a propósito con `minimum_password_length`
     de config.toml y con la validación de la pantalla. El número vive en cuatro
     sitios (panel de producción, config.toml, la pantalla y esta línea) y los
     cuatro se mueven JUNTOS en el cambio de política; subirlo solo aquí deja al
     médico con un error que la pantalla no supo evitar.
     72 es el tope de bcrypt en GoTrue: por encima, el error vendría de allí. */
  password: z.string().min(6).max(72),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  /* ⚠️ ESTE TOPE NO ES DECORATIVO: AQUÍ ES EL ÚNICO POR IP QUE QUEDA. Con el
     canje en servidor, GoTrue ve la IP de Vercel y no la del atacante, así que
     su `token_verifications` (30 por 5 min por IP) deja de separar atacantes y
     pasa a ser un presupuesto compartido por toda la clínica.
     20/h: una clínica entera comparte una IP pública, y veinte recuperaciones
     por hora desde una misma IP ya es anómalo.
     No hay tope global a propósito: sería una palanca de denegación de servicio
     contra los 18 médicos, y con `otp_length` en 10 el espacio del token
     —`sha224(correo + OTP)`, o sea 10^otp_length— es 10^10 y no hace falta
     comprarla. Estuvo en 8 hasta el 2026-09-15.
     ⚠️ SI ALGUIEN BAJA `otp_length`, ESTA DECISIÓN HAY QUE REHACERLA, y el
     valor que manda es el del PANEL de producción: `supabase/config.toml` es
     sólo local y ya mintió una vez sobre esto. */
  const limitado = await checkIpRateLimit(ip, 'reset-password', 20)
  if (limitado) return limitado

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 })
  }
  const { token_hash, password } = parsed.data

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )

  /* `type: 'recovery'` fijo aquí y NO leído del cuerpo: si viniera de fuera,
     esta ruta sería un canjeador genérico de OTP para cualquier token que
     alguien traiga — es justo el defecto que se borró de `/auth/callback`.
     Con `persistSession: false` el cliente usa un adaptador EN MEMORIA propio
     de esta instancia (GoTrueClient.js:184), así que el `updateUser` y el
     `signOut` de abajo encuentran la sesión y nada se escribe fuera de esta
     invocación ni se filtra a la siguiente en un lambda caliente. */
  const { data, error: errVerify } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })

  if (errVerify || !data.user) {
    /* El detector de fuerza bruta. Sin el correo ni el token en la descripción:
       el audit_log es inmutable por trigger y no admite cancelación ARCO. */
    await logAudit({ accion: 'recuperacion_fallida', ip, descripcion: 'token no válido o caducado' })
    return NextResponse.json({ error: 'enlace_invalido' }, { status: 400 })
  }

  /* ⚠️ A PARTIR DE AQUÍ EL TOKEN YA ESTÁ CONSUMIDO. Cualquier fallo de abajo
     deja al médico sin enlace, así que la pantalla tiene que decírselo y
     mandarlo a pedir otro. Por eso el formulario valida longitud y coincidencia
     ANTES de llamar aquí: para que este camino sea raro. */
  const { error: errUpdate } = await supabase.auth.updateUser({ password })
  if (errUpdate) {
    /* No se reenvía `errUpdate.message`. GoTrue distingue «New password should
       be different from the old password», que es un oráculo de contraseña. */
    await logAudit({
      userId: data.user.id,
      accion: 'recuperacion_fallida',
      ip,
      descripcion: 'contraseña rechazada con token ya consumido',
    })
    return NextResponse.json({ error: 'password_rechazada' }, { status: 400 })
  }

  /* ⚠️ LA REVOCACIÓN ES EL MOTIVO DE LA MITAD DE LOS RESETS, no un extra: quien
     recupera su cuenta suele hacerlo porque cree que entró otro. `scope:
     'global'` revoca TODOS los refresh tokens del usuario, incluido el que esta
     invocación acaba de acuñar — que es justo lo que queremos.

     ⚠️ NO ES INSTANTÁNEO Y NO PUEDE SERLO: revoca refresh tokens, no access
     tokens. El intruso conserva acceso hasta que caduque el suyo (`jwt_expiry`
     = 3600), porque `middleware.ts` valida con `getClaims()` sin preguntarle a
     Auth y PostgREST valida el JWT por firma. Es la ventana que ese archivo ya
     documenta y acepta a sabiendas. Estrecharla es bajar `jwt_expiry` para todo
     el producto, no un arreglo de esta ruta.

     Un fallo aquí NO tumba la petición: la contraseña ya cambió y devolver
     error mandaría al médico a reintentar con un token quemado. Se registra. */
  const { error: errSignOut } = await supabase.auth.signOut({ scope: 'global' })
  if (errSignOut) logger.error('RESET-PASSWORD', 'fallo al revocar sesiones (scope global)')

  await logAudit({
    userId: data.user.id,
    accion: 'recuperacion_contrasena',
    ip,
    descripcion: errSignOut ? 'sesiones NO revocadas' : 'sesiones revocadas (scope global)',
  })

  const correo = data.user.email ?? ''
  await avisar(correo)

  return NextResponse.json({ ok: true, correo: enmascarar(correo) })
}

/* Aviso al dueño de la cuenta. Es la única detección que tiene un médico al que
   le cambian la contraseña.

   ⚠️ NO SE MANDA POR EL BLOQUE `[auth.email.notification.password_changed]` DE
   config.toml, y no es por pereza: ese archivo es sólo local, en producción es
   el panel, y sobre todo el Auth Hook de correo intercepta los envíos de
   GoTrue — un `email_action_type` que `email-hook:109-111` no conozca cae en el
   `else`, devuelve `{ok:true}` y NO MANDA NADA. Encenderlo allí daría una
   detección que parece existir y no existe. Desde aquí es determinista.

   ⚠️ SIN ENLACES EN EL CUERPO, a propósito: un correo de seguridad con botón es
   la plantilla exacta del phishing que este cambio cierra.

   No lanza: el envío no puede tumbar un cambio de contraseña ya aplicado. */
async function avisar(correo: string): Promise<void> {
  if (!correo) return
  try {
    await resend.emails.send({
      from: 'Spinus <noreply@mail.spinus.com.mx>',
      to: correo,
      subject: 'Tu contraseña de Spinus ha cambiado',
      html: `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#334155;font-size:14px;line-height:1.6;max-width:540px">
        <p>La contraseña de tu cuenta de Spinus acaba de cambiarse, y se cerraron todas las sesiones abiertas.</p>
        <p><strong>Si no fuiste tú</strong>, escribe de inmediato a soporte respondiendo a este correo. No sigas enlaces que digan «recupera tu cuenta»: nosotros no te los vamos a mandar en este mensaje.</p>
      </div>`,
    })
  } catch {
    logger.error('RESET-PASSWORD', 'no se pudo enviar el aviso de cambio de contraseña')
  }
}

/* El correo se enmascara y no se devuelve entero: quien tenga un token robado
   —de unos logs, de Sentry— no debe poder convertirlo en una dirección. Lo que
   queda basta para que su dueño lo reconozca y no para cosecharlo. */
function enmascarar(correo: string): string {
  const [local, dominio] = correo.split('@')
  if (!local || !dominio) return ''
  const velar = (s: string): string =>
    s.length <= 2 ? `${s[0]}•` : `${s[0]}${'•'.repeat(Math.min(s.length - 2, 6))}${s[s.length - 1]}`
  const punto = dominio.lastIndexOf('.')
  return punto < 0
    ? `${velar(local)}@${velar(dominio)}`
    : `${velar(local)}@${velar(dominio.slice(0, punto))}${dominio.slice(punto)}`
}
