'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

// Página intermedia para confirmación de email vía token_hash (Auth Hook)
// Cierra cualquier sesión activa, verifica el OTP y redirige al dashboard
function ConfirmEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    async function confirmar() {
      const tokenHash = searchParams.get('token_hash')

      if (!tokenHash) {
        router.replace('/login?error=invalid_link')
        return
      }

      const supabase = createClient()

      // Cerrar sesión activa para evitar conflicto con otro usuario
      await supabase.auth.signOut()

      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })

      if (error) {
        router.replace('/login?error=invalid_link')
        return
      }

      // Crear perfil si no existe
      await fetch('/api/auth/complete-registro', { method: 'POST' })
      router.replace('/dashboard')
    }

    confirmar()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
      <div className="text-center space-y-3">
        <Loader2 size={28} className="animate-spin text-[#1e5fa8] mx-auto" />
        <p className="text-sm text-slate-500">Confirmando tu cuenta...</p>
      </div>
    </div>
  )
}

export default function ConfirmEmailPage() {
  return (
    <Suspense>
      <ConfirmEmailContent />
    </Suspense>
  )
}
