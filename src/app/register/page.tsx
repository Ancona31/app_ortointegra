'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Eye, EyeOff, CheckCircle, RefreshCw } from 'lucide-react'

/**
 * Registro público — correo y contraseña (Bloque B5, quinta parte).
 *
 * Los nueve campos que había aquí —título, nombre, apellidos, especialidad, las
 * dos cédulas y el «nombre del consultorio»— los pide ahora el gate de
 * onboarding, después de confirmar el correo. Dos razones: un formulario largo
 * delante de quien todavía no ha visto el producto, y que esos datos ya se
 * exigían otra vez en el gate, con otro criterio.
 *
 * ⚠️ EL «NOMBRE DEL CONSULTORIO» DE AQUÍ CREABA LA CLÍNICA, no un consultorio.
 * La clínica es la cuenta; el consultorio, el lugar físico, y vive en otra
 * tabla. En el onboarding son dos pasos distintos y cada uno se llama por su
 * nombre.
 */

export default function RegisterPage() {
  const router = useRouter()
  const [step,     setStep]     = useState<'form' | 'enviado'>('form')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // Reenvío de correo de confirmación
  const [reenvioLoading, setReenvioLoading] = useState(false)
  const [reenvioMsg,     setReenvioMsg]     = useState('')
  const [reenvioError,   setReenvioError]   = useState('')
  const [cooldown,       setCooldown]       = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [])

  async function handleReenviar() {
    setReenvioLoading(true)
    setReenvioMsg('')
    setReenvioError('')
    try {
      const res = await fetch('/api/auth/reenviar-confirmacion', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: form.email }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setReenvioError(data.error ?? 'No se pudo reenviar. Intenta más tarde.')
      } else {
        setReenvioMsg('¡Correo reenviado! Revisa tu bandeja de entrada.')
        // Cooldown de 60 s para no spamear
        setCooldown(60)
        cooldownRef.current = setInterval(() => {
          setCooldown(s => {
            if (s <= 1) { clearInterval(cooldownRef.current!); return 0 }
            return s - 1
          })
        }, 1000)
      }
    } finally {
      setReenvioLoading(false)
    }
  }

  const [form, setForm] = useState({
    email:    '',
    password: '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/registro', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (res.status === 409) {
        setError(data.message || data.error)
        setTimeout(() => router.push('/login'), 2000)
      } else {
        setError(data.message || data.error || 'Error al crear la cuenta. Intenta de nuevo.')
      }
      return
    }

    setStep('enviado')
  }

  /* ── Pantalla: confirmación enviada ────────────────────── */
  if (step === 'enviado') {
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
          <Logo />
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">¡Cuenta creada!</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Te enviamos un correo de confirmación a <strong className="text-slate-700">{form.email}</strong>.
              Revísalo y haz clic en el enlace para activar tu cuenta.
            </p>
            <p className="text-xs text-slate-400">
              ¿No lo ves? Revisa tu carpeta de <strong>spam o correo no deseado</strong>.
            </p>

            {/* Reenvío */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
              {reenvioMsg && (
                <p className="text-xs text-emerald-600 font-medium">{reenvioMsg}</p>
              )}
              {reenvioError && (
                <p className="text-xs text-red-500">{reenvioError}</p>
              )}
              <button
                onClick={handleReenviar}
                disabled={reenvioLoading || cooldown > 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {reenvioLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <RefreshCw size={14} />
                }
                {cooldown > 0
                  ? `Reenviar correo (${cooldown}s)`
                  : reenvioLoading ? 'Enviando...' : 'Reenviar correo de confirmación'
                }
              </button>
              <Link href="/login" className="block text-center text-sm text-[#1e5fa8] hover:underline mt-1">
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Pantalla: formulario de registro ──────────────────── */
  /* ⚠️ EL RELLENO DE ARRIBA LLEVA EL ÁREA SEGURA SUMADA, no sustituida.
     Centrar protege sólo mientras el contenido CABE: en cuanto desborda
     —formulario largo, teclado abierto, tipografía grande— el contenedor crece
     y la tarjeta se alinea arriba. Con `viewport-fit=cover` ese borde es el
     FÍSICO, y la franja navy de `globals.css` (`body::before`) es OPACA y mide
     lo que la muesca (47-59 px), así que se comía la cabecera.
     El `py-10` se parte en `pt` + `pb` A PROPÓSITO: dejar `py-10` y añadir un
     `pt-*` detrás haría que el ganador lo decidiera el orden de la hoja
     generada, no el del atributo. Los 40 px de diseño se conservan.
     En escritorio y en una pestaña normal el `env()` vale 0 y esto queda
     exactamente como estaba. */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] pb-10">
      <div className="w-full max-w-sm">
        <Logo />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            <p className="text-xs text-slate-500 leading-relaxed">
              Crea tu cuenta con tu correo. Al entrar te pediremos tus datos
              profesionales y los de tu clínica, una sola vez.
            </p>

            {/* Acceso */}
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Acceso</p>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Correo electrónico *</label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="correo@ejemplo.com" required autoFocus
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Contraseña *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="Mínimo 8 caracteres" required minLength={8}
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Creando cuenta...</>
                : 'Crear cuenta gratuita'
              }
            </button>

            <p className="text-center text-xs text-slate-400 pt-1">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-[#1e5fa8] hover:underline font-medium">
                Inicia sesión
              </Link>
            </p>
          </form>
        </div>
        <Footer />
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex flex-col items-center mb-6">
      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 overflow-hidden">
        <img src="/logo.png" alt="Logo Spinus" className="w-16 h-16 object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      </div>
      <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
      <p className="text-xs text-slate-400 mt-1">Crea tu cuenta gratuita</p>
    </div>
  )
}

function Footer() {
  return (
    <p className="text-center text-xs text-slate-300 mt-6">
      © 2026 Spinus® · Todos los derechos reservados
    </p>
  )
}
