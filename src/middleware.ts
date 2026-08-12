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
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/offline',  // fallback del SW — debe ser accesible sin sesión
  // ⚠ ANDAMIO — paso 0 de la captura nativa (prueba de `capture` en iPad y
  // Android, sin exigir sesión en el dispositivo). Se borra esta línea junto
  // con public/prueba-captura.html cuando la prueba termine.
  '/prueba-captura.html',
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|logo-spinus.png|landing/|audio/|fonts/|sw\\.js|manifest\\.json|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png).*)'],
}
