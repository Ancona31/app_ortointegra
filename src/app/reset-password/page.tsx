'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Lock, CheckCircle } from 'lucide-react'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [sesionLista, setSesionLista] = useState(false)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('Enlace inválido o expirado. Solicita uno nuevo.')
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error: err }: { error: { message: string } | null }) => {
      if (err) {
        setError('Enlace inválido o expirado. Solicita uno nuevo.')
      } else {
        setSesionLista(true)
      }
    })
  }, [searchParams, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (err) {
      setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
    } else {
      setListo(true)
      setTimeout(() => router.push('/dashboard'), 2500)
    }
  }

  /* ⚠️ EL RELLENO DE ARRIBA LLEVA EL ÁREA SEGURA SUMADA, no sustituida.
     Centrar protege sólo mientras el contenido CABE: en cuanto desborda
     —formulario largo, teclado abierto, tipografía grande— el contenedor crece
     y la tarjeta se alinea arriba. Con `viewport-fit=cover` ese borde es el
     FÍSICO, y la franja navy de `globals.css` (`body::before`) es OPACA y mide
     lo que la muesca (47-59 px), así que se comía la cabecera.
     Esta pantalla no tenía relleno vertical de diseño, así que el área segura
     es aquí todo el valor.
     En escritorio y en una pestaña normal el `env()` vale 0 y esto queda
     exactamente como estaba. */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
          <p className="text-xs text-slate-400 mt-1 text-center">Gestión clínica inteligente para el especialista moderno</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {listo ? (
            <div className="text-center space-y-4">
              <CheckCircle size={40} className="text-emerald-500 mx-auto" />
              <h2 className="font-semibold text-slate-700">Contraseña actualizada</h2>
              <p className="text-sm text-slate-500">Redirigiendo al sistema...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Lock size={16} className="text-[#1a3a5c]" />
                <h2 className="font-semibold text-slate-700">Nueva contraseña</h2>
              </div>

              {error && !sesionLista ? (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                  <a href="/forgot-password" className="block text-sm text-[#1e5fa8] hover:underline text-center">
                    Solicitar nuevo enlace
                  </a>
                </div>
              ) : !sesionLista ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">
                      Confirmar contraseña
                    </label>
                    <input
                      type="password"
                      value={confirmar}
                      onChange={e => setConfirmar(e.target.value)}
                      placeholder="Repite la contraseña"
                      required
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                      : 'Guardar nueva contraseña'
                    }
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">
          © 2026 Spinus® · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}
