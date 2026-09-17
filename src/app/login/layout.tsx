import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { inter } from '@/lib/fonts'

/* Layout de /login — Server Component (sin `'use client'`, sin hooks).
   Hace tres cosas y ninguna más: el guarda de sesión de aquí abajo, montar la
   familia Inter sobre esta ruta y poner el fondo de la pantalla.

   SIN `metadata` PROPIA, a propósito. El `<title>` sigue siendo el del layout
   raíz (`src/app/layout.tsx:5`), que hoy dice "Spinus®". Ese ® es real y está
   contabilizado en **LP-DT-15** (barrido de ® fuera de la landing); corregirlo
   aquí con un `metadata` que lo pise sería esconder el síntoma en una ruta y
   dejarlo vivo en las otras veinte. Se arregla en su proyecto, en el archivo
   raíz, de una vez. No añadas metadata aquí para "arreglar el título".

   ⚠️ `font-lp` NO ES SOLO TIPOGRAFÍA EN ESTE ÁRBOL, y por eso la clase va aquí
   y no en el <div> de la página. El anillo de foco único de la landing
   (`globals.css`, bloque "ANILLO DE FOCO ÚNICO") está acotado con el selector
   `.font-lp :where(a, button, summary, [tabindex]…):focus-visible` — un
   DESCENDIENTE de `.font-lp`, no el elemento que la lleva. Verificado leyendo
   la regla, no supuesto: con la clase en este envoltorio, los inputs, el botón
   de envío, el botón-ojo y los enlaces de la página quedan dentro del selector
   y heredan el `outline: 2px solid var(--lp-focus)` sin declarar ni uno.
   La contrapartida es que el anillo del <div> mismo NO estaría cubierto — es
   irrelevante, no es enfocable.

   `inter.variable` declara `--lp-font`; la utilidad `font-lp` la consume
   (`globals.css`, bloque `@theme inline`). Las dos son necesarias: la clase
   de next/font sin la utilidad no aplica la familia a nada.

   ⚠️ `min-h-dvh` Y NO `min-h-screen`, que es lo que había. En Tailwind 4
   `min-h-screen` compila a `100vh`, y §4.3·10 del maestro es explícito:
   `100dvh` nunca `100vh`. En iOS/Android `100vh` no descuenta la barra de
   direcciones, así que el alto reservado excede el viewport real y aparece un
   salto al mostrarse u ocultarse la barra al hacer scroll. Es la misma
   corrección que **LP-DT-18** aplicó a la landing. No lo devuelvas a
   `min-h-screen`. */

/* ⚠️⚠️ EL GUARDA DE SESIÓN VIVE AQUÍ, EN EL SERVIDOR, Y ESO ES TODO EL PUNTO.
   ════════════════════════════════════════════════════════════════════════════
   `login/page.tsx` es `'use client'`, así que su comprobación sólo puede correr
   DESPUÉS de que el HTML haya pintado — y el HTML de esta ruta trae el
   formulario dentro. Resultado: un médico con sesión buena veía el formulario
   de inicio de sesión ~40 ms medidos en local (estimado 100-300 ms en
   producción, donde el viaje a Supabase cloud es real) antes de que el
   `router.push` se lo llevara. No era un problema de orden de pintado que se
   arregle con un spinner: el formulario ESTABA en el documento. La única forma
   de no enseñarlo es no entregar el documento, y eso se decide aquí.

   ⚠️ LA AUTORIDAD ES `getUser()`, QUE PREGUNTA AL SERVIDOR DE AUTH. NO LA
   CAMBIES POR `getClaims()` NI POR "hay cookie, luego hay sesión". La regla
   general está en `CLAUDE.md` § «Autoridad de sesión», y el caso concreto es
   éste: el destino de este redirect —`(launcher)/inicio/layout.tsx:16`— decide
   con `getUser()`. Si el origen decidiera con una autoridad MÁS DÉBIL, una
   sesión revocada (JWT criptográficamente válido hasta su `exp`, pero borrada
   en el servidor) haría que este layout dijera «sí hay» y el de /inicio «no
   hay»: /login → /inicio → /login → … Es exactamente el bucle de recarga que
   ahogaba la pestaña en producción, sólo que en forma de cadena de redirects
   HTTP, que el navegador corta con ERR_TOO_MANY_REDIRECTS.
   Tal como está, las dos puntas preguntan lo mismo al mismo sitio con las
   mismas cookies, y las dos degradan hacia SERVIR EL FORMULARIO: /inicio
   redirige cuando NO hay usuario, éste cuando SÍ lo hay. /login sigue siendo el
   sumidero de todos los caminos de error.

   ⚠️ EL `getUser()` VA CONDICIONADO A QUE EXISTA LA COOKIE, Y NO ES MICRO-
   OPTIMIZACIÓN. `getUser()` SIEMPRE sale a la red (`GET /auth/v1/user`, sin
   caché). Sin la condición, CADA VISITANTE ANÓNIMO de /login pagaría un viaje a
   Supabase Auth antes de recibir una sola línea de HTML — que es justo el gasto
   que el bloque medido de `middleware.ts:92-174` vino a quitar (1.656
   peticiones a Auth contra 117 a Postgres en 24 h). Con la condición, el
   anónimo no pregunta nada y sólo paga el render dinámico.

   ⚠️ EL PREDICADO DE LA COOKIE ES EL MISMO DE `middleware.ts:260-266`, Y SUS
   TRES CLÁUSULAS SON NECESARIAS: se excluye `-code-verifier` porque esa cookie
   la escribe el flujo PKCE en el navegador de un VISITANTE ANÓNIMO que pulsa
   «olvidé mi contraseña», y se exige valor no vacío porque una cookie de sesión
   vaciada sigue presente en el navegador. Cualquiera de las dos, sin su
   cláusula, mandaría a un anónimo a pagar el viaje a Auth para nada.

   ⚠️ EL `try/catch` NO ES DECORATIVO. Mismo criterio que `middleware.ts:176-184`:
   una excepción que escapa de este layout —un 5xx de Auth, un fallo de red del
   runtime— es un error EN LA PUERTA DE ENTRADA DEL PRODUCTO para todo el que
   traiga cookie. Al fallar se cae a `false`, que sirve el formulario: degrada
   hacia el camino que ya existía.
   ⚠️ Y `redirect()` VA FUERA DEL `try`. Lanza `NEXT_REDIRECT` para señalizar, así
   que dentro del bloque el `catch` se lo comería y el redirect no ocurriría
   nunca — es explícito en los docs de Next 16 (`redirect.md`, «Behavior»).

   ⚠️⚠️ ESTO SÓLO FUNCIONA MIENTRAS `redirect()` SEA UN 307, Y ES FRÁGIL A ALGO
   QUE NADIE RELACIONARÍA CON EL LOGIN. `redirect.md:12` de Next 16: «When used
   in a streaming context, this will insert a meta tag to emit the redirect on
   the client side […] Otherwise, it will serve a 307 HTTP redirect response.»
   O sea: si alguien añade un `loading.tsx` en `src/app/` o en `src/app/login/`,
   o mete un <Suspense> por encima de esta ruta, la respuesta empieza a
   transmitirse antes de que este guarda decida y el redirect DEGRADA A CLIENTE
   — el parpadeo vuelve entero, sin error, sin fallo de build, sin nada que se
   vea. Comprobado al escribir esto: hoy no hay ninguno (los seis `loading.tsx`
   del proyecto cuelgan de `(app)`, grupo hermano).
   ⚠️ POR LO MISMO, ESTA RUTA ES INCOMPATIBLE CON PPR / `cacheComponents`. Hoy
   `next.config.ts` no los activa. Si algún día se activan, /login tiene que
   quedar fuera o este guarda deja de servir.

   ⚠️ EL EFECTO DE `login/page.tsx:166-240` SE QUEDA Y NO ES REDUNDANTE. Para la
   carga de documento sí lo es —este guarda llega antes—, pero cubre dos huecos
   que el servidor no puede cubrir:
    1. SIN RED no hay petición, luego no hay guarda: su rama de
       `navigator.onLine === false` (`:227-234`) es el blindaje offline y es lo
       único que evita dejar al médico tirado en /login en gray zone.
    2. El botón ATRÁS tras iniciar sesión restaura el documento desde bfcache
       SIN volver a ejecutar este layout.
   Son capas distintas, no alternativas. No borres una creyéndola copia de la
   otra. */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const tieneCookieSesion = cookieStore.getAll().some(c =>
    c.name.startsWith('sb-')
    && c.name.includes('-auth-token')
    && !c.name.includes('-code-verifier')
    && c.value.trim() !== ''
  )

  let haySesion = false
  if (tieneCookieSesion) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      haySesion = data.user !== null
    } catch {
      haySesion = false
    }
  }

  if (haySesion) redirect('/inicio')

  return (
    <div className={`${inter.variable} font-lp min-h-dvh bg-[var(--lp-wash)]`}>
      {children}
    </div>
  )
}
