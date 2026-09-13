import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuthRateLimit } from '@/lib/rateLimit'
import { logLogin, logAudit } from '@/lib/audit'
import { LoginSchema } from '@/lib/perfil/schemas'

/**
 * POST /api/auth/login — autenticación DEL LADO DEL SERVIDOR.
 *
 * ⚠️ POR QUÉ EXISTE. Hasta aquí la autenticación ocurría entera en el navegador
 * (`login/page.tsx:211`), contra GoTrue con la anon key pública. Los tres
 * controles —límite, login_fallido, login_exitoso— eran `fetch` que el cliente
 * DECIDÍA si hacer: un POST directo a `/auth/v1/token?grant_type=password`
 * obtenía sesión sin dejar una sola fila en `audit_log`. La trazabilidad de
 * accesos que exige la NOM-024 no puede vivir donde el cliente puede saltársela.
 *
 * ⚠️ LAS COOKIES DE SESIÓN SALEN SOLAS, no hay que reenviarlas a mano.
 * `signInWithPassword` espera a `_notifyAllSubscribers('SIGNED_IN')`, que espera
 * al callback que `@supabase/ssr` registra en `createServerClient`, que llama a
 * `applyServerStorage` → nuestro `setAll` → `cookies().set()`. Todo dentro del
 * `await` de abajo, y en un route handler Next sí vuelca esos `set` a la
 * respuesta. Si alguien convierte esto en Server Component, se rompe en silencio.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const parsed = LoginSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Correo o contraseña inválidos' }, { status: 400 })
  }
  const email = parsed.data.email.toLowerCase()
  const { password } = parsed.data

  /* ⚠️ DOS LÍMITES, Y HACEN FALTA LOS DOS.

     El ESTRICTO va por la pareja (email, IP), NO por el email solo. Con el
     email solo, cualquiera que conozca el correo de un médico lo deja fuera
     quince minutos desde su casa: denegación de servicio dirigida, gratis. La
     pareja obliga al atacante a quemar presupuesto por cada IP que use.

     Pero la pareja abre el hueco contrario: a ojos del limitador cada IP es
     una cuenta nueva, así que quien disponga de muchas obtiene cinco intentos
     POR IP contra el MISMO médico, sin tope agregado. El AMPLIO —solo por
     email— cierra eso. Está puesto donde ningún médico real llega (veinte
     fallos en una hora) y aun así el ataque distribuido choca con él.

     ⚠️ LAS ACCIONES TIENEN QUE SER DISTINTAS. `checkAuthRateLimit` compone la
     clave como `auth:${action}:${identifier}`; con la misma acción las dos
     comprobaciones escribirían y contarían sobre la misma fila y los conteos
     se mezclarían, que es justo lo que separa a un límite del otro. */
  const clavePareja = `${email}|${ip}`

  // Comprobar SIN consumir: un login correcto no debe gastar presupuesto.
  const previoPareja = await checkAuthRateLimit(clavePareja, 'login', 5, 15, { registrar: false })
  const previoEmail = await checkAuthRateLimit(email, 'login_email_global', 20, 60, {
    registrar: false,
  })

  if (previoPareja.blocked || previoEmail.blocked) {
    /* ⚠️ EL AUDIT DICE CUÁL DE LOS DOS DISPARÓ, y no es un detalle cosmético:
       es lo único que al investigar distingue al médico que olvidó su
       contraseña (salta el estricto, desde su IP) del ataque distribuido
       contra esa cuenta (salta el amplio, con el estricto intacto porque cada
       IP va por su lado). Sin la distinción, ambos casos dejan la misma fila. */
    const motivo = previoPareja.blocked
      ? 'limite estricto (email+IP): 5 fallos / 15 min'
      : 'limite amplio (email): 20 fallos / 60 min'
    await logAudit({
      accion: 'acceso_denegado',
      ip,
      descripcion: `Login bloqueado por rate limit — ${motivo}`,
    })
    return NextResponse.json(
      {
        error: previoPareja.blocked
          ? 'Demasiados intentos fallidos. Espera 15 minutos.'
          : 'Demasiados intentos fallidos. Espera 60 minutos.',
      },
      { status: 429 },
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    // Ahora SÍ se consume, y en LOS DOS: se cuentan fallos, no intentos.
    await checkAuthRateLimit(clavePareja, 'login', 5, 15, { registrar: true })
    await checkAuthRateLimit(email, 'login_email_global', 20, 60, { registrar: true })
    // ⚠️ CON `await`: la respuesta no sale hasta que la fila está escrita. Es la
    // diferencia con el `fetch` sin esperar que hacía la pantalla.
    await logLogin({ email, success: false, ip, userAgent })
    // Mensaje genérico a propósito: no distingue «no existe» de «contraseña mal».
    return NextResponse.json(
      { error: 'Credenciales incorrectas. Verifica tu correo y contraseña.' },
      { status: 401 },
    )
  }

  await logLogin({ userId: data.user.id, success: true, ip, userAgent })

  /* Hueco deliberado para el segundo paso del TOTP, que NO se implementa aquí:
     cuando llegue, esta respuesta pasa a `{ ok: true, mfaRequired: true }` y la
     sesión queda a medio elevar (aal1) hasta verificar el reto. La fontanería de
     cookies no cambiará: `MFA_CHALLENGE_VERIFIED` ya está entre los eventos que
     disparan `applyServerStorage` en @supabase/ssr. */
  return NextResponse.json({ ok: true })
}
