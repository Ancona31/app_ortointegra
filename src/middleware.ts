import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isPublicPage = ['/forgot-password', '/reset-password', '/auth/confirm'].includes(pathname)

  // Rutas API que no requieren sesión (OAuth callbacks)
  const publicApiPaths = ['/api/google/callback']
  const isPublicApi = publicApiPaths.some(p => pathname.startsWith(p))

  // Si no hay sesión y no está en ruta pública → redirigir a login
  if (!user && !isLoginPage && !isPublicPage && !isPublicApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si hay sesión y está en login → redirigir al dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
