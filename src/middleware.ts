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

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = pathname === '/login'
  const isPublicPage = ['/', '/forgot-password', '/reset-password', '/auth/confirm', '/auth/callback', '/auth/confirm-email', '/pricing', '/register', '/privacy', '/terms', '/offline'].includes(pathname)
    || pathname.startsWith('/r/')
    || pathname.startsWith('/offline-mode')
    || pathname.startsWith('/offline-setup')

  // Rutas API que no requieren sesión (OAuth callbacks, Stripe webhook y Stripe checkout/portal que manejan su propia auth)
  const publicApiPaths = ['/api/google/callback', '/api/stripe/webhook', '/api/stripe/checkout', '/api/stripe/portal', '/api/auth/registro', '/api/auth/email-hook', '/api/auth/verify-email', '/api/auth/audit-login', '/api/auth/rate-limit']
  const isPublicApi = publicApiPaths.some(p => pathname.startsWith(p))

  // Si no hay sesión y no está en ruta pública → verificar cookies antes de redirigir.
  // getUser() puede fallar por latencia post-login (las cookies existen pero el
  // servidor de Supabase aún no las procesó). Si hay cookie de sesión, dejar pasar.
  if (!user && !isLoginPage && !isPublicPage && !isPublicApi) {
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

   ⚠️ Y AQUÍ ESTÁ EL PRECIO, QUE SE ACEPTA A SABIENDAS: si algún día se crea un
   route handler AUTENTICADO cuya ruta termine en `.json`, `.svg` o `.js`,
   quedaría fuera del middleware SIN AVISO NINGUNO — sin error de compilación,
   sin fallo en el build, sin nada que se vea. Si escribes una ruta así, o le
   quitas la extensión, o la exceptúas aquí a mano. Es el único caso en que esta
   línea muerde.

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
