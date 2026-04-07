'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

// Confirma el email vía API server-side sin tocar la sesión activa del browser
function ConfirmEmailContent() {
  const searchParams = useSearchParams()
  const [estado, setEstado] = useState<'verificando' | 'confirmado' | 'error'>('verificando')

  useEffect(() => {
    async function confirmar() {
      const tokenHash = searchParams.get('token_hash')

      if (!tokenHash) {
        setEstado('error')
        return
      }

      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash }),
      })

      if (res.ok) {
        setEstado('confirmado')
      } else {
        setEstado('error')
      }
    }

    confirmar()
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
              <p className="text-sm text-slate-500">
                Tu correo electrónico ha sido verificado. Ya puedes iniciar sesión con tu nueva cuenta.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
              >
                Iniciar sesión
              </Link>
            </div>
          )}

          {estado === 'error' && (
            <div className="space-y-4 py-4">
              <XCircle size={48} className="text-red-400 mx-auto" />
              <h2 className="font-semibold text-slate-700">Enlace inválido</h2>
              <p className="text-sm text-slate-500">
                El enlace ya fue utilizado o expiró. Si ya confirmaste tu cuenta, inicia sesión normalmente.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
              >
                Ir al inicio de sesión
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">© 2026 Spinus® · Todos los derechos reservados</p>
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
