'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle } from 'lucide-react'
import { useState } from 'react'

function CallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [estado, setEstado] = useState<'verificando' | 'confirmado' | 'error'>('verificando')

  useEffect(() => {
    const supabase = createClient()

    function confirmar() {
      sessionStorage.setItem('spinus_active', '1')
      setEstado('confirmado')
      setTimeout(() => router.push('/dashboard'), 2000)
    }

    async function manejar() {
      const hash = window.location.hash

      // Caso 1: tokens en el hash (#access_token=...)
      if (hash.includes('access_token')) {
        // Intentar obtener sesión directamente
        const { data } = await supabase.auth.getSession()
        if (data.session) { confirmar(); return }

        // Si no hay sesión aún, escuchar el evento de auth con timeout
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: { user: { id: string } } | null) => {
          if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            confirmar()
          }
        })

        // Timeout: si después de 8s no se resuelve, verificar una vez más y decidir
        setTimeout(async () => {
          const { data: retry } = await supabase.auth.getSession()
          subscription.unsubscribe()
          if (retry.session) { confirmar() }
          else { setEstado('error') }
        }, 8000)
        return
      }

      // Caso 2: hash vacío pero la sesión ya existe (Supabase procesó los tokens antes del mount)
      if (hash === '#' || hash === '') {
        const { data } = await supabase.auth.getSession()
        if (data.session) { confirmar(); return }

        // Esperar un momento — a veces el SDK necesita tiempo para procesar
        await new Promise(r => setTimeout(r, 2000))
        const { data: retry } = await supabase.auth.getSession()
        if (retry.session) { confirmar(); return }
      }

      // Caso 3: ?code= (PKCE)
      const code = searchParams.get('code')
      if (code) {
        const { error }: { error: { message: string } | null } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setEstado('error'); return }
        confirmar()
        return
      }

      // Caso 4: ?token_hash= (token directo)
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      if (tokenHash && (type === 'email' || type === 'signup')) {
        const { error }: { error: { message: string } | null } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
        if (error) { setEstado('error'); return }
        confirmar()
        return
      }

      setEstado('error')
    }

    manejar()
  }, [searchParams, router])

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
