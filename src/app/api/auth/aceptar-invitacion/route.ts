import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { checkIpRateLimit } from '@/lib/rateLimit'
import { contrasenaConocida } from '@/lib/hibp'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

/* ═══ POR QUÉ ESTA RUTA NO DEVUELVE SESIÓN, Y NO ES UN OLVIDO ═══════════════
   Es la misma decisión de B6-bis, y por el mismo motivo: el enlace llega por
   correo, y los correos se reenvían. El canje ocurre AQUÍ con un cliente
   STANDALONE de @supabase/supabase-js —sin el adaptador de cookies de
   @supabase/ssr—, así que la sesión que GoTrue devuelve vive en la memoria de
   esta invocación y muere con ella. El invitado acaba en /login y entra por la
   puerta de siempre.

   ⚠️ COMPROBADO, NO SUPUESTO: `POST /auth/v1/verify` con `type: 'invite'`
   devuelve `access_token` Y `refresh_token` (GoTrue v2.196.0). O sea que si
   esto se canjeara en el navegador —o con `createClient()` de
   `@/lib/supabase/server`, que sí escribe cookies—, un enlace ajeno dejaría a
   quien lo abra dentro de la cuenta de otro, y con `get_clinica_id()` saliendo
   del JWT todo lo que escribiera aterrizaría en la clínica de otra persona.

   ⚠️ NO conviertas esto en `createClient()` de `@/lib/supabase/server` ni le
   pases cookies. Mismo criterio que `api/auth/reset-password`.

   ─── Y LO QUE ESTA RUTA NO HACE, QUE EN `reset-password` SÍ ────────────────
   · NO revoca sesiones con `scope: 'global'`. Allí es media razón de ser del
     flujo: quien recupera su cuenta suele hacerlo porque cree que entró otro.
     Aquí la cuenta acaba de nacer y aceptar una invitación no es señal de
     compromiso; un `global` solo podría echar de su sesión a alguien que entró
     legítimamente. Se revoca `local`, que es la sesión que este proceso acuñó.
   · NO manda correo de aviso al dueño. Ese aviso existe para que a un médico no
     le cambien la contraseña a sus espaldas; aquí el dueño de la cuenta es
     exactamente quien está actuando, y el correo sería ruido en el primer
     minuto de alguien en Spinus.
   · NO toca `profiles`. El nombre, el rol, la clínica y `invitado_por` se
     escribieron al invitar (`api/admin/invitar`), y `email_confirmed_at` lo
     pone GoTrue al canjear. Por eso esta ruta no necesita cliente de servicio. */

const Body = z.object({
  token_hash: z.string().min(20).max(256),
  /* 8 Y NO 6, y la diferencia con `reset-password` es deliberada. Aquí se está
     eligiendo la PRIMERA contraseña de una cuenta, que es el caso de
     `RegistroSchema` (min 8) y no el de la recuperación (min 6, atado a
     `minimum_password_length` de GoTrue y al panel de producción). El número
     vive en dos sitios —este zod y la pantalla `/invitacion`— y los dos se
     mueven juntos. 72 es el tope de bcrypt en GoTrue: por encima, el error
     vendría de allí. */
  password: z.string().min(8).max(72),
  /* Ya vio el aviso de contraseña conocida y decidió seguir. La manda el
     cliente y está bien así: el aviso es consultivo y ninguna propiedad de
     seguridad depende de esta bandera. */
  aviso_visto: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  /* Con el canje en servidor, GoTrue ve la IP de Vercel y no la de quien lo
     intenta, así que su límite por IP deja de separar atacantes: éste es el
     único tope real. Mismo valor que `reset-password`, y por el mismo
     razonamiento —una clínica entera comparte una IP pública—. */
  const limitado = await checkIpRateLimit(ip, 'aceptar-invitacion', 20)
  if (limitado) return limitado

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 })
  }
  const { token_hash, password, aviso_visto } = parsed.data

  /* ⚠️ VA ANTES DEL CANJE, Y ESE ORDEN ES TODO EL DISEÑO. Aquí el token sigue
     intacto: si la contraseña resulta conocida, se devuelve el aviso y el
     ENLACE SIGUE VIVO, así que puede elegir otra sin pedir una invitación
     nueva — que además tendría que pedírsela a otra persona, no a un
     formulario. Si esto se moviera debajo del `verifyOtp`, dudar costaría el
     enlace.
     Se comprueba SIEMPRE, aunque venga `aviso_visto`: la bandera decide si nos
     detenemos, no si miramos. */
  if (await contrasenaConocida(password) && !aviso_visto) {
    return NextResponse.json({ aviso: 'password_conocida' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )

  /* `type: 'invite'` fijo aquí y NO leído del cuerpo: si viniera de fuera, esta
     ruta sería un canjeador genérico de OTP para cualquier token que alguien
     traiga. */
  const { data, error: errVerify } = await supabase.auth.verifyOtp({ token_hash, type: 'invite' })

  if (errVerify || !data.user) {
    /* El detector de fuerza bruta contra `token_hash`, y el único que va a
       existir por lo dicho arriba del tope por IP. Sin el token ni el correo en
       la descripción: el audit_log es inmutable y no admite cancelación ARCO, y
       un token sigue siendo canjeable durante una hora. */
    await logAudit({ accion: 'invitacion_fallida', ip, descripcion: 'token no válido o caducado' })
    return NextResponse.json({ error: 'enlace_invalido' }, { status: 400 })
  }

  /* ⚠️ A PARTIR DE AQUÍ EL TOKEN ESTÁ CONSUMIDO. Cualquier fallo de abajo deja
     a la persona sin enlace y dependiendo de que alguien se lo reenvíe, así que
     la pantalla valida longitud y coincidencia ANTES de llamar aquí. */
  const { error: errUpdate } = await supabase.auth.updateUser({ password })

  /* ⚠️ `same_password` SE TRATA COMO ÉXITO, IGUAL QUE EN `reset-password`, Y
     AQUÍ SÍ ES ALCANZABLE aunque la cuenta naciera sin contraseña. El camino es
     el riesgo que ya conocemos y aceptamos: mientras la invitación no se acepta
     la cuenta existe sin contraseña, así que su dueño puede haber pasado antes
     por «olvidé mi contraseña» y haberse puesto una. Si ahora acepta la
     invitación con ESA misma contraseña, GoTrue responde 422 `same_password`.
     El resultado que pidió ya es cierto: se sigue por el camino de éxito.
     El razonamiento largo —por qué contárselo sería un oráculo para quien traiga
     un token robado— está escrito en `api/auth/reset-password/route.ts` y no se
     repite aquí; si vas a tocar esta rama, léelo antes.
     Se distingue por `code` y no por `message`: el código es API estable. */
  const mismaContrasena = errUpdate?.code === 'same_password'

  if (errUpdate && !mismaContrasena) {
    /* La sesión que `verifyOtp` acuñó tres líneas arriba se queda viva en
       GoTrue si no se revoca — sin dueño, porque nunca sale de este proceso,
       pero viva. */
    await supabase.auth.signOut({ scope: 'local' })
    await logAudit({
      userId: data.user.id,
      accion: 'invitacion_fallida',
      ip,
      descripcion: 'contraseña rechazada con token ya consumido',
    })
    return NextResponse.json(
      { error: errUpdate.code === 'weak_password' ? 'password_debil' : 'password_rechazada' },
      { status: 400 },
    )
  }

  /* `local` y NO `global`: ver la cabecera. Un fallo aquí NO tumba la petición
     —la contraseña ya está puesta y devolver error mandaría a reintentar con un
     token quemado—, se registra. */
  const { error: errSignOut } = await supabase.auth.signOut({ scope: 'local' })
  if (errSignOut) logger.error('ACEPTAR-INVITACION', 'fallo al revocar la sesión del canje (scope local)')

  /* Sin distinguir el caso `same_password`, por lo mismo que en
     `reset-password`: sería meter en el sitio menos borrable —audit_log es
     inmutable y lo lee cualquier super_admin— el oráculo que la rama de arriba
     acaba de suprimir. */
  await logAudit({
    userId: data.user.id,
    accion: 'invitacion_aceptada',
    ip,
  })

  /* ⚠️ EL CORREO VA ENTERO Y NO ENMASCARADO, al revés que en `reset-password`,
     y la asimetría tiene motivo. Allí se enmascara porque quien abre un enlace
     de recuperación ROBADO no tiene por qué aprender la dirección de su
     víctima. Aquí, a esta pantalla solo se llega con un enlace que llegó a ese
     buzón: quien lo tiene ya conoce la dirección, así que enmascararla no le
     oculta nada a nadie y sí le quita a la persona la forma más clara de
     darse cuenta de que abrió el enlace de otro. */
  return NextResponse.json({ ok: true, correo: data.user.email ?? '' })
}
