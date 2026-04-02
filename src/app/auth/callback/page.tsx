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

    async function manejar() {
      // Caso 1: tokens en el hash (#access_token=...) — flujo implícito de generateLink
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        // Supabase ya confirmó la cuenta y puso la sesión en el hash
        // Esperamos a que el cliente de Supabase procese el hash
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setEstado('confirmado')
          setTimeout(() => router.push('/dashboard'), 2000)
          return
        }
        // Si no hay sesión aún, escuchar el evento de auth
        supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            setEstado('confirmado')
            setTimeout(() => router.push('/dashboard'), 2000)
          }
        })
        return
      }

      // Caso 2: ?code= (PKCE)
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setEstado('error'); return }
        setEstado('confirmado')
        setTimeout(() => router.push('/dashboard'), 2000)
        return
      }

      // Caso 3: ?token_hash= (token directo)
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      if (tokenHash && (type === 'email' || type === 'signup')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
        if (error) { setEstado('error'); return }
        setEstado('confirmado')
        setTimeout(() => router.push('/dashboard'), 2000)
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
          <h1 className="text-2xl font-bold text-[#1a3a5c]">OrtoIntegra</h1>
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                El enlace es inválido o ya expiró.
              </p>
              <a href="/login" className="block text-sm text-[#1e5fa8] hover:underline">
                Ir al inicio de sesión
              </a>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-300 mt-6">© 2026 OrtoIntegra · Todos los derechos reservados</p>
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
