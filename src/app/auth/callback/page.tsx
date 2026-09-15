'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle } from 'lucide-react'
import { useState } from 'react'

function CallbackContent() {
  const searchParams = useSearchParams()
  const [estado, setEstado] = useState<'verificando' | 'confirmado' | 'error'>('verificando')

  useEffect(() => {
    const supabase = createClient()

    /* ⚠️ VA A /inicio Y CON `window.location.href`, NO A /dashboard NI CON
       `router.push`. Dos correcciones distintas en la misma línea:
       · /dashboard no es el destino del médico autenticado — lo es /inicio,
         que es adonde manda el login (`login/page.tsx`) y adonde vuelve el
         guard de sesión. Mandar a /dashboard es un rebote de más, o un 404.
       · `router.push` es navegación de cliente: conserva el árbol de React y
         los datos que el Router Cache ya tenga de cuando NO había sesión.
         `window.location.href` fuerza una carga de documento completa, así
         que el middleware vuelve a correr con la cookie de sesión recién
         puesta y todo se pinta ya autenticado. Es lo mismo que hace el login. */
    function confirmar() {
      sessionStorage.setItem('spinus_active', '1')
      setEstado('confirmado')
      setTimeout(() => { window.location.href = '/inicio' }, 2000)
    }

    /* ═══ POR QUÉ ESTA FUNCIÓN NO CANJEA NADA ═══════════════════════════════
       Aquí NO se llama a `exchangeCodeForSession`, Y NO ES UN OLVIDO.

       Cuando el navegador vuelve de Google con `?code=`, el SDK YA lo canjeó
       solo: `createBrowserClient` de @supabase/ssr fuerza `detectSessionInUrl:
       true` (createBrowserClient.js:38-39, pisa lo que diga
       `lib/supabase/client.ts`), y con esa opción el canje ocurre dentro de
       `_initialize()` (GoTrueClient.js:271, :282) — es decir, antes de que
       este `useEffect` llegue a correr.

       El `code` de OAuth es DE UN SOLO USO. Canjearlo por segunda vez devuelve
       error, y como esta pantalla traduce cualquier error a «el enlace ya fue
       utilizado o expiró», el médico vería ese mensaje JUSTO CUANDO EL LOGIN
       ACABA DE FUNCIONAR, con la sesión ya creada. Añadir el canje «por si
       acaso» es exactamente lo que rompe este archivo.

       ⚠️ Y EL CANJE TIENE QUE OCURRIR EN EL NAVEGADOR, no en una ruta de
       servidor (no lo muevas a /api/auth/login ni a un route handler): PKCE
       exige el `code_verifier`, y ese lo genera y lo guarda ESTE navegador en
       el momento de salir hacia Google. El servidor no lo tiene.

       Basta entonces con UNA sola lectura: `getSession()` espera internamente
       a que `_initialize()` termine, así que si el canje salió bien la sesión
       ya está ahí, y si no, no la hay. No hacen falta reintentos ni
       `onAuthStateChange`.

       ⚠️ AQUÍ VIVÍAN CUATRO CASOS Y SE BORRARON TRES. No los repongas:
       · Casos 1 y 2 — tokens en el hash (`#access_token=…`). Inalcanzables:
         @supabase/ssr fuerza `flowType: 'pkce'`, y con pkce
         `_getSessionFromURL` rechaza los tokens del hash de plano
         (GoTrueClient.js:1649-1651). Era código que no podía ejecutarse.
       · Caso 4 — `?token_hash=` con `type=email|signup`, que llamaba a
         `verifyOtp`. Muerto y además explotable: nada de este proyecto manda
         a esta URL con esos tipos (el hook de correo manda `type=magiclink`,
         `email-hook:94`, que ni siquiera entraba en la condición), así que lo
         único que hacía era ofrecer un canjeador de OTP a quien trajera un
         token de fuera. */
    async function manejar() {
      /* GoTrue devuelve los fallos de OAuth en la query, no como excepción:
         el médico que cancela en la pantalla de Google vuelve con
         `?error=access_denied`. Sin esta comprobación caeríamos al
         `getSession()` de abajo, que no encontraría sesión y acabaría en el
         mismo estado de error — pero sólo por casualidad, y después de una
         ida y vuelta al storage. */
      if (searchParams.get('error') || searchParams.get('error_code')) {
        setEstado('error')
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) { confirmar(); return }

      setEstado('error')
    }

    manejar()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          {estado === 'verificando' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={28} className="animate-spin text-[#1e5fa8]" />
              <p className="text-sm text-slate-500">Confirmando tu cuenta...</p>
            </div>
          )}
          {estado === 'confirmado' && (
            <div className="space-y-4 py-4">
              <CheckCircle size={48} className="text-emerald-500 mx-auto" />
              <h2 className="font-bold text-slate-800 text-lg">¡Cuenta confirmada!</h2>
              <p className="text-sm text-slate-500">Tu cuenta está activa. Redirigiendo al sistema...</p>
              <Loader2 size={16} className="animate-spin text-slate-400 mx-auto" />
            </div>
          )}
          {estado === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-[#3d3d3f] bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg">
                El enlace ya fue utilizado o expiró. Si ya confirmaste tu cuenta, inicia sesión normalmente.
              </p>
              <a href="/login" className="inline-block px-6 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors">
                Ir al inicio de sesión
              </a>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-300 mt-6">© 2026 Spinus® · Todos los derechos reservados</p>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  )
}
