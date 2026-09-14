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
  /* ⚠️ EN PARALELO, Y ES SEGURO HACERLO: `checkAuthRateLimit` no comparte
     estado entre llamadas. Cada una construye su propio cliente con
     `createAdminClient()` —fábrica, no singleton (`lib/supabase/admin.ts:3`)—
     y el resto es local a la invocación. Las dos claves son distintas por
     construcción, así que ninguna lee ni escribe lo de la otra.
     No dependen una de otra: la segunda no necesita el resultado de la
     primera, sólo los necesita el `if` de abajo. En serie eran dos viajes a
     Supabase; ahora es uno. */
  const [previoPareja, previoEmail] = await Promise.all([
    checkAuthRateLimit(clavePareja, 'login', 5, 15, { registrar: false }),
    checkAuthRateLimit(email, 'login_email_global', 20, 60, { registrar: false }),
  ])

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
    /* Ahora SÍ se consume, y en LOS DOS: se cuentan fallos, no intentos.

       ⚠️ EN PARALELO PERO CON `await`, Y ESA DISTINCIÓN ES LA RAZÓN DE SER DEL
       BLOQUE. La respuesta NO sale hasta que las tres han terminado — es la
       diferencia con el `fetch` sin esperar que hacía la pantalla. Convertir
       esto en fire-and-forget ahorraría el viaje entero y devolvería el
       registro de accesos justo al estado que B4 vino a arreglar: una fila de
       `login_fallido` que se pierde si el proceso muere antes de escribirla.
       La NOM-024 exige que ese rastro sea fiable. Lo que se quitó es la espera
       EN SERIE entre las tres, no la espera.

       `Promise.all` y NO `allSettled`, a propósito: si una escritura rechaza
       queremos enterarnos —la excepción sale de `POST` y Next responde 500—.
       `allSettled` se la tragaría en silencio y dejaría un fallo sin contar, o
       un acceso sin registrar, sin que nadie lo sepa.

       Son independientes entre sí: dos claves distintas de `ip_rate_limits` y
       una fila de `audit_log`. Ninguna lee lo que otra escribe. */
    await Promise.all([
      checkAuthRateLimit(clavePareja, 'login', 5, 15, { registrar: true }),
      checkAuthRateLimit(email, 'login_email_global', 20, 60, { registrar: true }),
      logLogin({ email, success: false, ip, userAgent }),
    ])
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
