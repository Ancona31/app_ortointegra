import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Cookie de sesión: sin maxAge ni expires → se borra al cerrar el navegador
              const { maxAge: _m, expires: _e, ...sessionOptions } = options ?? {}
              cookieStore.set(name, value, sessionOptions)
            })
          } catch {}
        },
      },
    }
  )
}
