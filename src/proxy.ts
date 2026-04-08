import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isPublicPage = ['/', '/forgot-password', '/reset-password', '/auth/confirm', '/auth/callback', '/auth/confirm-email', '/pricing', '/register', '/privacy', '/terms'].includes(pathname)
    || pathname.startsWith('/r/')

  // Rutas API que no requieren sesión (OAuth callbacks, Stripe webhook y Stripe checkout/portal que manejan su propia auth)
  const publicApiPaths = ['/api/google/callback', '/api/stripe/webhook', '/api/stripe/checkout', '/api/stripe/portal', '/api/auth/registro', '/api/auth/complete-registro', '/api/auth/email-hook', '/api/auth/verify-email', '/api/auth/audit-login']
  const isPublicApi = publicApiPaths.some(p => pathname.startsWith(p))

  // Si no hay sesión y no está en ruta pública → redirigir a login
  if (!user && !isLoginPage && !isPublicPage && !isPublicApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Permitir acceso a /login aunque haya sesión activa
  // El usuario puede querer cambiar de cuenta — la página mostrará un aviso

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|logo-spinus.png|landing/|audio/).*)'],
}
