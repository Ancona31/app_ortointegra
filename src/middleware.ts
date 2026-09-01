import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ════════════════════════════════════════════════════════════════════
// HARD-EXCLUSION PWA — NUNCA autenticar estos recursos
// ════════════════════════════════════════════════════════════════════
// Defensa en profundidad: aunque el matcher del `config` (abajo) excluya
// estos paths, en Next.js 16 con Route Handlers el matcher regex con
// lookahead negativo puede fallar silenciosamente y dejar pasar /sw.js
// por el flujo de auth, emitiendo un 302 → /login al primer visitante
// sin sesión. El browser rechaza el registro del Service Worker con
// "SecurityError: The script resource is behind a redirect".
//
// Este early-return garantiza que esos recursos nunca lleguen al auth
// check. Cero redirects posibles, independiente del matcher.
const PWA_PUBLIC_ASSETS = new Set([
  '/sw.js',
  /* ⚠️ EL SERVICE WORKER DEL BÚNKER, Y ESTÁ AQUÍ POR EL MISMO MOTIVO QUE
     `/sw.js`, NO POR RENDIMIENTO. Lo registra `offline-setup/page.tsx:41`, y un
     script de Service Worker detrás de un 302 lo rechaza el navegador con el
     "SecurityError" del párrafo de arriba — el fallo que este bloque existe para
     impedir. Faltaba: el matcher lo dejaba pasar por el flujo de auth.
     Hoy el daño era sólo latencia, porque a `/offline-setup` se llega con sesión
     y el `catch {}` de `:44` se traga el fallo en silencio. Un `catch` mudo no es
     una garantía. */
  '/spinus-bunker-sw.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  /* ⚠️ EL TERCER ICONO DE INSTALACIÓN, y su ausencia era un agujero real. Lo
     pide `src/app/manifest.json/route.ts:17` y el sistema operativo puede
     pedirlo SIN cookies al instalar la PWA: sin esta línea recibía un 302 a
     /login y el icono de instalación salía roto. Sus dos hermanos ya estaban;
     éste se quedó fuera. Los tres van juntos o vuelve a pasar. */
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/offline',  // fallback del SW — debe ser accesible sin sesión
])

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Bypass inmediato para recursos críticos de la PWA.
  // /fonts/ se comprueba con startsWith porque el Set son rutas exactas y no
  // puede cubrir un directorio: react-pdf hace fetch de los .ttf sin cookie y
  // fontkit revienta con "Unknown font format" si recibe el HTML del login.
  if (PWA_PUBLIC_ASSETS.has(pathname) || pathname.startsWith('/fonts/')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            // Cookie de sesión: sin maxAge ni expires → se borra al cerrar el navegador
            const { maxAge: _m, expires: _e, ...sessionOptions } = options ?? {}
            supabaseResponse.cookies.set(name, value, sessionOptions)
          })
        },
      },
    }
  )

  /* ════════════════════════════════════════════════════════════════════════
     LA SESIÓN SE VERIFICA EN LOCAL, NO PREGUNTÁNDOLE AL SERVIDOR DE AUTH
     ════════════════════════════════════════════════════════════════════════
     Aquí estuvo `supabase.auth.getUser()`, y era el gasto más caro del
     proyecto entero. `getUser()` SIEMPRE sale a la red —`GET /auth/v1/user`,
     sin caché, ver `auth-js/GoTrueClient.js:1457`— y este middleware corre en
     casi todas las peticiones del dominio. Medido: 1.656 peticiones a Auth
     contra 117 a Postgres en 24 h, o sea catorce autenticaciones por consulta
     real. El testigo más claro era `/privacidad`, una página PRERENDERIZADA
     servida desde disco, que tardaba 521 ms: eso no era la página, era esta
     línea.

     `getClaims()` verifica la FIRMA del JWT con WebCrypto contra la clave
     pública del proyecto. Es criptografía, no confianza: un token falsificado
     o manipulado falla igual que antes.

     ⚠️ CONDICIÓN INDISPENSABLE, Y SI DEJA DE CUMPLIRSE ESTO NO AHORRA NADA:
     el proyecto tiene que firmar con clave ASIMÉTRICA. `getClaims()` bifurca
     en `GoTrueClient.js:2978`: si el `alg` empieza por `HS`, o falta el `kid`,
     o no hay WebCrypto, CAE A `getUser()` con red y volvemos al punto de
     partida — sin error, sólo lento otra vez. Comprobado al escribir esto:
     el JWKS del proyecto publica una clave ES256 y los tokens emitidos traen
     `alg: ES256` con el `kid` que le corresponde. Si algún día alguien rota a
     HS256 en el panel de Supabase, esta optimización se apaga sola y en
     silencio: el síntoma sería `/privacidad` volviendo a los 500 ms.

     ⚠️ NO HAY UNA PETICIÓN DE JWKS POR REQUEST. La caché de claves es GLOBAL
     del isolate, no del cliente (`GoTrueClient.js:42`, `GLOBAL_JWKS`), con TTL
     de 10 minutos, y está pensada justo para esto («shared-memory execution
     environments such as Vercel's Fluid Compute»). Da igual que aquí se cree
     un cliente nuevo en cada invocación.

     ⚠️ EL REFRESCO DE SESIÓN SIGUE VIVO, y era el otro trabajo de este
     middleware. `getClaims()` sin argumento llama a `getSession()`, que si el
     token está por caducar dispara `_callRefreshToken`
     (`GoTrueClient.js:1408`) y escribe las cookies nuevas por el adaptador de
     `@supabase/ssr` — o sea por el `setAll` de arriba, que reconstruye
     `supabaseResponse`. Si alguien sustituye esta llamada por un decodificado
     a mano del JWT, ROMPE EL REFRESCO y todas las sesiones mueren a la hora.

     ⚠️ LO QUE SE PAGA A CAMBIO: una sesión REVOCADA sigue pasando por aquí
     hasta que su token caduca (TTL de 3.600 s). Se acepta a sabiendas, y por
     tres motivos:
      1. Este middleware NUNCA fue la barrera de datos. La barrera es la RLS,
         que evalúa el JWT en cada consulta y no cambia con esto.
      2. Las operaciones donde una sesión revocada sí importaría ya validan
         contra el servidor de Auth POR SÍ MISMAS, y ahí no se ha tocado nada:
         el cierre de sesión (`lib/auth-context.tsx`, `signOut()` va directo al
         Auth), el cambio de contraseña (`app/reset-password/page.tsx`,
         `updateUser()` ídem), y la gestión de usuarios de clínica
         (`api/admin/usuarios` y `api/admin/crear-usuario`, que hacen
         `getUser()` con red ANTES de tocar `createAdminClient()`). Lo mismo
         vale para las 34 rutas que usan cliente de servicio: o llaman a
         `getUser()` en línea, o pasan por `requireSuperAdmin()` /
         `requireAdmin()` de `lib/auth.ts`, que también salen a la red.
         NO LAS "OPTIMICES" a `getClaims()` sin rehacer este razonamiento: son
         justo las que la RLS no cubre.
      3. La ventana ya existía por otra puerta. El navegador habla directamente
         con `rest/v1/*`, y PostgREST valida el JWT criptográficamente sin
         preguntarle a Auth: un token de una sesión cerrada ya funcionaba por
         ahí hasta caducar. Este middleware no cerraba esa puerta; pagaba por
         creer que sí.

     ⚠️ Y LO MÁS IMPORTANTE PARA ENTENDER QUE ESTO NO DEBILITA LA PUERTA: mira
     el `if` de abajo. Cuando NO hay sesión válida pero SÍ hay cookie `sb-*`,
     no se redirige — se deja pasar, a propósito y desde antes de este cambio.
     O sea que la decisión de redirigir ya dependía de que EXISTA una cookie,
     no de que el servidor de Auth la bendijera. Lo único que `getUser()`
     aportaba de más era el refresco, y el refresco se conserva.

     ⚠️ EL `try/catch` NO ES DECORATIVO Y NO SE QUITA. `getClaims()` reenvía
     hacia arriba cualquier error que no sea `AuthError`
     (`GoTrueClient.js:3005`) —un fallo de WebCrypto, por ejemplo—, y una
     excepción escapando de un middleware es un 500 EN TODAS LAS PETICIONES DEL
     SITIO A LA VEZ. Al fallar se cae a `false`, que es exactamente el mismo
     camino que "no hay sesión": la comprobación de cookie de abajo decide, y
     quien tenga cookie sigue entrando. Degrada hacia el lado que ya existía.

     ⚠️ UN TOKEN DE OTRO PROYECTO NO PASA, aunque parezca que aquí no se
     comprueba el emisor: su `kid` no está en el JWKS de éste, `fetchJwk`
     devuelve null y `getClaims()` cae al `getUser()` con red, que lo rechaza.
     El caso raro degrada al camino lento, que es el seguro. */
  let sesionValida = false
  try {
    const { data } = await supabase.auth.getClaims()
    /* `sub` y no la mera existencia de `data`: es el identificador del usuario
       y viene tipado como obligatorio en `RequiredClaims`. Un payload sin él no
       es una sesión de nadie. */
    sesionValida = typeof data?.claims?.sub === 'string'
  } catch {
    sesionValida = false
  }

  const isLoginPage = pathname === '/login'
  /* ⚠️ `/privacidad` Y `/privacy` SON LA MISMA PÁGINA Y LAS DOS TIENEN QUE ESTAR.
     No es redundancia: existen las dos rutas —`app/privacidad/page.tsx` y
     `app/privacy/page.tsx`, las dos devuelven `<AvisoPrivacidadContent />`— y los
     enlaces del proyecto están repartidos entre ambas. Hacia dentro se usa
     `/privacidad` (menú lateral, consentimiento de alta, paleta de comandos);
     hacia fuera, `/privacy` (pie de la landing, login, ayuda). Sólo estaba la
     segunda, así que la primera pedía iniciar sesión — y un aviso de privacidad
     que exige registrarse es exactamente la página que no puede hacer eso.
     El caso más visible ni siquiera requería compartir el enlace: el PIE de la
     propia página legal (`components/legal/LegalLayout.tsx:61`) apunta a
     `/privacidad`, así que un visitante sin sesión que llegaba a `/privacy` desde
     la landing salía disparado al login al pinchar el enlace del pie. La página
     se enlazaba a sí misma hacia el rebote.
     Que existan dos rutas para un solo aviso es deuda aparte y está documentada
     en `login/page.tsx:550`. AQUÍ NO SE RESUELVE: mientras las dos existan y
     tengan enlaces vivos, las dos son públicas. Si algún día se unifican, la que
     sobre se quita de esta lista en el mismo cambio, no antes.

     ⚠️ `/demo/receta` ES PÚBLICA POR EL MISMO MOTIVO, Y SU PÚBLICO NUNCA TIENE
     SESIÓN. Es lo que abre el QR del Teaser 2 de la landing
     (`components/landing/teaser2/qr-receta-demo.ts:4` codifica
     `https://www.spinus.com.mx/demo/receta`), o sea que quien la pide es alguien
     que acaba de escanear un código impreso en la página pública: un posible
     cliente, no un usuario. Sin esta entrada acababa en `/login`.
     No expone nada: es una hoja estática con datos ficticios, sin Supabase y sin
     `notFound()` — ver la cabecera de `app/demo/receta/page.tsx`.
     Si se añaden más páginas bajo `/demo/`, esto pasa a ser un `startsWith`; con
     una sola, el literal es más honesto sobre lo que hay. */
  const isPublicPage = ['/', '/forgot-password', '/reset-password', '/auth/confirm', '/auth/callback', '/auth/confirm-email', '/pricing', '/register', '/privacy', '/privacidad', '/terms', '/offline', '/demo/receta'].includes(pathname)
    || pathname.startsWith('/r/')
    || pathname.startsWith('/offline-mode')
    || pathname.startsWith('/offline-setup')

  // Rutas API que no requieren sesión (OAuth callbacks, Stripe webhook y Stripe checkout/portal que manejan su propia auth)
  const publicApiPaths = ['/api/google/callback', '/api/stripe/webhook', '/api/stripe/checkout', '/api/stripe/portal', '/api/auth/registro', '/api/auth/email-hook', '/api/auth/verify-email', '/api/auth/audit-login', '/api/auth/rate-limit']
  const isPublicApi = publicApiPaths.some(p => pathname.startsWith(p))

  // Si no hay sesión y no está en ruta pública → verificar cookies antes de redirigir.
  // La verificación puede no dar sesión por latencia post-login (las cookies
  // existen pero el token todavía no está escrito del todo). Si hay cookie de
  // sesión, dejar pasar.
  // ⚠️ ESTE ES EL `if` DEL QUE HABLA LA NOTA DE `getClaims()` ARRIBA: la rama
  // que redirige exige que NO haya cookie ninguna. Con cookie presente se pasa
  // aunque la sesión no valide, y eso era así ya antes. No lo endurezcas de
  // pasada creyendo que compensas algo — cerrarlo expulsaría a quien acaba de
  // iniciar sesión, que es el motivo por el que se abrió.
  if (!sesionValida && !isLoginPage && !isPublicPage && !isPublicApi) {
    const hasSessionCookie = request.cookies.getAll()
      .some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Permitir acceso a /login aunque haya sesión activa
  // El usuario puede querer cambiar de cuenta — la página mostrará un aviso

  return supabaseResponse
}

/* ⚠️⚠️ LA REGLA POR EXTENSIÓN (`\.(?:svg|png|…)$`) NO ES UNA OPTIMIZACIÓN SUELTA:
   CIERRA UNA CLASE DE FALLO QUE YA SE COBRÓ TRES VÍCTIMAS. NO LA QUITES.

   Lo que había era una lista de nombres, o sea una denylist por omisión: todo lo
   que no estuviera escrito pasaba por el flujo de auth, y eso significa una
   petición de red a Supabase (`auth.getUser()`, abajo) ANTES de servir el
   archivo. Un icono de 2,7 kB tardaba 470 ms medidos en producción, y ninguno
   era el tiempo de transferencia.

   La lista falló, por este orden: primero con `/sw.js` (302 → registro del
   Service Worker rechazado, ver la cabecera de `PWA_PUBLIC_ASSETS`), luego con
   `/fonts/` (react-pdf recibía el HTML del login y fontkit reventaba con
   "Unknown font format"), y al escribir esto seguía fallando con TRES más a la
   vez: los 20 SVG de `/icons/`, `/spinus-bunker-sw.js` y
   `/icon-512-maskable.png`. Tres omisiones simultáneas no son descuido: son la
   forma de la regla. Nombrar la cuarta, la quinta y la sexta deja la trampa
   puesta para la séptima.

   ⚠️ POR QUÉ ES SEGURA, COMPROBADO Y NO SUPUESTO. De las 119 rutas de la
   aplicación compilada, sólo DOS terminan en extensión —`/favicon.ico` y
   `/manifest.json`— y las dos ya estaban excluidas y deben ser públicas de todos
   modos. Ninguna ruta de API lleva extensión. Se verificó leyendo
   `routes-manifest.json` + `app-path-routes-manifest.json` del build.

   ⚠️ `.json` NO ESTÁ EN LA LISTA, y conviene saberlo antes de razonar sobre
   ella: `/manifest.json` sale por su propio literal, no por la extensión. Una
   ruta autenticada terminada en `.json` sigue pasando por aquí — comprobado con
   `/api/documentos/x.json`, que redirige a /login sin sesión.

   ⚠️ Y AQUÍ ESTÁ EL PRECIO, QUE SE ACEPTA A SABIENDAS: si algún día se crea un
   route handler AUTENTICADO cuya ruta termine en `.svg`, `.js` o cualquier otra
   de la lista, quedaría fuera del middleware SIN AVISO NINGUNO — sin error de
   compilación, sin fallo en el build, sin nada que se vea. Si escribes una ruta
   así, o le quitas la extensión, o la exceptúas aquí a mano.

   ⚠️⚠️ Y LO QUE SE VERIFICÓ FUERON PATRONES DE RUTA, NO RUTAS DE PETICIÓN. Esa
   distinción importa y el párrafo de arriba se queda corto sin ella: un SEGMENTO
   DINÁMICO puede recibir un valor que termine en una de estas extensiones, y esa
   PETICIÓN se salta el middleware aunque el PATRÓN no llevara extensión ninguna.
   `/expediente/loquesea.png` casa con `/expediente/[id]` y no pasa por aquí —
   comprobado.

   NO ES EXPLOTABLE, y por eso la regla se queda: esas rutas se autentican SOLAS.
   `/expediente/loquesea.png` y `/expediente/abc.svg` contestan 307 a /login sin
   sesión, igual que `/dashboard`, porque el guarda vive en
   `(app)/layout.tsx` y `expediente/layout.tsx`, no aquí. El middleware nunca fue
   la única puerta — y si algún día alguien crea un subárbol autenticado SIN
   guarda propia en su layout, este párrafo es el que hay que releer.

   ⚠️ NADA DE `public/` NECESITA LA BARRERA, y se revisó el árbol entero antes de
   abrirlo: iconos, audio de tutoriales, tipografías, logos, el QR de la demo y
   los iconos de la PWA. Cero PII, cero datos clínicos. Todo eso se compila al
   output estático de Vercel de todas formas; el middleware era lo único que lo
   tapaba, y tapar arte genérica cuesta un viaje de autenticación por archivo sin
   comprar nada. SI ALGÚN DÍA SE SUBE A `public/` ALGO QUE SÍ HAYA QUE PROTEGER,
   el sitio para protegerlo no es esta línea: es no ponerlo en `public/`.

   La lista de nombres SE CONSERVA al lado a propósito. Es redundante con la
   regla nueva para varios de sus miembros, y así se queda: dice qué recursos son
   públicos por decisión y no sólo por su terminación, y sobrevive si alguien
   toca la parte de las extensiones. */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|logo-spinus.png|landing/|audio/|fonts/|sw\\.js|manifest\\.json|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|wav|ttf|otf|woff|woff2|js|mjs|css|map|txt|xml|pdf)$).*)'],
}
