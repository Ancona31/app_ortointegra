'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import NeuralBackground from '@/components/ui/NeuralBackground'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sesionActiva, setSesionActiva] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=access_denied') || hash.includes('otp_expired')) {
      setError('El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo.')
    }

    // Sprint 3 Hotfix — Blindaje offline del login:
    // Si ya hay sesión local válida (cliente tiene tokens en localStorage),
    // redirect automático a /inicio sin pedir credenciales. Esto cubre el
    // caso en que el proxy server-side empuja al médico a /login en gray
    // zone mientras la sesión del cliente sigue intacta.
    const supabase = createClient()
    supabase.auth.getSession()
      .then(({ data: { session } }: { data: { session: { user: { email: string | null } } | null } }) => {
        if (session?.user?.email) {
          // Sesión válida local → volver a la app sin pedir credenciales
          router.push('/inicio')
          return
        }
        // Sin sesión local → flujo normal de login, detectar sesión residual
        return supabase.auth.getUser().then((res: { data: { user: { email: string } | null } }) => {
          if (res.data.user?.email) {
            setSesionActiva(res.data.user.email)
          }
        })
      })
      .catch(() => {
        // silent — si getSession/getUser fallan (SDK offline strict),
        // permitir el form de login normal
      })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Sprint 3 Hotfix — Rate-limit offline-aware:
    // Si el browser reporta sin red, saltar el rate-limit completamente
    // (no hay ataques remotos sin red). Además wrap en try/catch como
    // safety net — el Service Worker NO intercepta POSTs (solo cachea
    // GETs), entonces offline real el fetch falla con TypeError. Sin
    // este wrap, el spinner del login quedaba eterno.
    const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false

    if (!isBrowserOffline) {
      try {
        const rlRes = await fetch('/api/auth/rate-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login_email', email }),
        })
        if (rlRes.status === 429) {
          const rlData = await rlRes.json()
          setLoading(false)
          setError(rlData.error || 'Demasiados intentos. Espera 15 minutos.')
          return
        }
      } catch {
        // Red cayó durante el rate-limit check → procedemos sin rate-limit.
        // Si el signInWithPassword también falla por red, mostrará su
        // propio error abajo.
      }
    }

    const supabase = createClient()

    // Cerrar sesión activa antes de iniciar con otra cuenta.
    // clearMirror no se llama aquí — el backstop de startMirrorEngine
    // detecta cambio de mirrorUserId y limpia automáticamente al login
    // del nuevo usuario. La limpieza completa está en signOut() del AuthContext.
    if (sesionActiva) {
      await supabase.auth.signOut()
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (err) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      // NOM-024: registrar intento fallido de login
      fetch('/api/auth/audit-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login_fallido', email }),
      }).catch(() => {})
    } else {
      sessionStorage.setItem('spinus_active', '1')
      // Solicitar persistencia de storage inmediatamente tras el gesto del login.
      // El click del botón cuenta como 'user activation' en Chromium/Firefox,
      // maximizando la probabilidad de 'granted' sin prompt intrusivo.
      // NOM-024: registrar login exitoso
      fetch('/api/auth/audit-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login_exitoso' }),
      }).catch(() => {})
      router.push('/inicio')
      router.refresh()
    }
  }

  function handleVolverDashboard() {
    router.push('/inicio')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <NeuralBackground />
      <div className="w-full max-w-sm relative z-[1]">
        {/* Logo y encabezado */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg mb-4 overflow-hidden border border-white/40">
            <img
              src="/logo.png"
              alt="Logo Dr. Ancona"
              className="w-20 h-20 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Spinus®</h1>
          <p className="text-xs text-slate-400 mt-1 text-center">Gestión clínica inteligente para el especialista moderno</p>
        </div>

        {/* Aviso de sesión activa */}
        {sesionActiva && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Sesión activa</p>
                <p className="text-xs text-amber-600 mt-1">
                  Tienes una sesión abierta como <strong>{sesionActiva}</strong>.
                  Al iniciar sesión con otra cuenta, se cerrará la sesión actual.
                </p>
                <button
                  onClick={handleVolverDashboard}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 underline mt-2 inline-block"
                >
                  Volver al dashboard →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Formulario */}
        <div className="bg-white/30 backdrop-blur-md rounded-2xl shadow-lg border border-white/30 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} className="text-[#1a3a5c]" />
            <h2 className="font-semibold text-slate-700">
              {sesionActiva ? 'Cambiar de cuenta' : 'Acceso al sistema'}
            </h2>
          </div>

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
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm space-y-1">
                <p>{error}</p>
                {error.includes('expiró') && (
                  <Link href="/forgot-password" className="block text-[#1e5fa8] hover:underline font-medium">
                    Solicitar nuevo enlace →
                  </Link>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Iniciando sesión...</>
                : sesionActiva ? 'Cambiar de cuenta' : 'Iniciar sesión'
              }
            </button>

            <div className="text-center pt-1 space-y-2">
              <Link href="/forgot-password" className="block text-xs text-slate-400 hover:text-[#1e5fa8] transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
              <p className="text-xs text-slate-400">
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="text-[#1e5fa8] font-medium hover:underline">
                  Regístrate gratis
                </Link>
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">
          © 2026 Spinus® · Todos los derechos reservados
          <br />
          <Link href="/privacidad" target="_blank" className="text-slate-400 hover:text-[#1e5fa8] transition-colors">
            Aviso de Privacidad
          </Link>
        </p>
      </div>
    </div>
  )
}
