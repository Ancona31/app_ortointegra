'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Lock, CheckCircle } from 'lucide-react'

function ConfirmContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [estado, setEstado] = useState<'verificando' | 'listo' | 'error'>('verificando')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const type      = searchParams.get('type')

    if (!tokenHash || type !== 'recovery') {
      setEstado('error')
      return
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error: err }: { error: { message: string } | null }) => {
      if (err) {
        setEstado('error')
      } else {
        setEstado('listo')
      }
    })
  }, [searchParams, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres.'); return }

    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
    } else {
      setExito(true)
      setTimeout(() => router.push('/dashboard'), 2500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
          <p className="text-xs text-slate-400 mt-1 text-center">Gestión clínica inteligente para el especialista moderno</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {estado === 'verificando' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={24} className="animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Verificando enlace...</p>
            </div>
          )}

{estado === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                Enlace inválido o expirado. Solicita uno nuevo.
              </div>
              <a href="/forgot-password" className="block text-sm text-[#1e5fa8] hover:underline text-center">
                Solicitar nuevo enlace
              </a>
            </div>
          )}

          {estado === 'listo' && !exito && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Lock size={16} className="text-[#1a3a5c]" />
                <h2 className="font-semibold text-slate-700">Nueva contraseña</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Nueva contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" required
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Confirmar contraseña</label>
                  <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                    placeholder="Repite la contraseña" required
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                {error && (
                  <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</p>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : 'Guardar nueva contraseña'}
                </button>
              </form>
            </>
          )}

          {exito && (
            <div className="text-center space-y-4">
              <CheckCircle size={40} className="text-emerald-500 mx-auto" />
              <h2 className="font-semibold text-slate-700">Contraseña actualizada</h2>
              <p className="text-sm text-slate-500">Redirigiendo al sistema...</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">© 2026 Spinus® · Todos los derechos reservados</p>
      </div>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  )
}
