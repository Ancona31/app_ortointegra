'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Rate limit: 3 recovery por email por hora
    const rlRes = await fetch('/api/auth/rate-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recovery', email }),
    })
    // Siempre mostrar éxito — no revelar si el email existe o si fue bloqueado
    if (rlRes.status === 429 || !(await rlRes.json()).ok) {
      setLoading(false)
      setEnviado(true)
      return
    }

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/reset-password`

    await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    // Siempre mostrar éxito — no revelar si el email existe
    setLoading(false)
    setEnviado(true)
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
          {enviado ? (
            <div className="text-center space-y-4">
              <CheckCircle size={40} className="text-emerald-500 mx-auto" />
              <h2 className="font-semibold text-slate-700">Correo enviado</h2>
              <p className="text-sm text-slate-500">
                Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue el enlace para restablecer tu contraseña.
              </p>
              <Link href="/login" className="block text-sm text-[#1e5fa8] hover:underline mt-2">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Mail size={16} className="text-[#1a3a5c]" />
                <h2 className="font-semibold text-slate-700">Restablecer contraseña</h2>
              </div>

              <p className="text-sm text-slate-500 mb-5">
                Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
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
                    ? <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    : 'Enviar enlace'
                  }
                </button>
              </form>

              <Link href="/login" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mt-5 transition-colors">
                <ArrowLeft size={13} /> Volver al inicio de sesión
              </Link>
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
