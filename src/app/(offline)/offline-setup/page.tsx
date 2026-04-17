'use client'

import { useEffect, useState } from 'react'
import { Loader2, Shield, CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * Offline Setup — Landing de captura intermedia.
 *
 * Se activa al hacer click en "Modo Offline" del Sidebar.
 * Ejecuta 3 pasos antes de redirigir al búnker:
 *   1. Registra el micro SW (spinus-bunker-sw.js) con scope /offline-mode
 *   2. Captura spinus_session_meta (userId + email) desde Supabase SDK
 *   3. Sincroniza doctorProfile (logo + firma → Base64)
 *   4. Redirige a /offline-mode
 *
 * NO importa AuthContext, dashboard, ni componentes de (app).
 * Solo usa el SDK de Supabase directamente para captura puntual.
 */

type SetupStep = 'sw' | 'session' | 'profile' | 'done' | 'error'

const STEP_LABELS: Record<SetupStep, string> = {
  sw: 'Preparando entorno seguro...',
  session: 'Capturando sesión...',
  profile: 'Cargando perfil del médico...',
  done: 'Listo. Redirigiendo...',
  error: 'Error en la preparación',
}

export default function OfflineSetupPage() {
  const [step, setStep] = useState<SetupStep>('sw')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function setup() {
      try {
        // ── Paso 1: Registrar micro SW ──
        setStep('sw')
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/spinus-bunker-sw.js', {
              scope: '/offline-mode',
            })
          } catch {
            // SW registration failed — no bloquear, el offline-mode
            // funcionará online pero no cacheará para uso sin red
            console.warn('[OfflineSetup] SW registration failed — continuing without cache')
          }
        }

        // ── Paso 2: Capturar sesión ──
        setStep('session')
        try {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data } = await supabase.auth.getSession()

          if (data.session?.user) {
            const user = data.session.user
            const meta = {
              userId: user.id,
              email: user.email ?? null,
              expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : null,
              redVerifiedAt: Date.now(),
            }
            localStorage.setItem('spinus_session_meta', JSON.stringify(meta))
          }
        } catch {
          // Si falla, puede que ya exista un meta previo — continuar
          console.warn('[OfflineSetup] Session capture failed — using existing meta if available')
        }

        // ── Paso 3: Sincronizar perfil (logo + firma → Base64) ──
        setStep('profile')
        try {
          const { syncDoctorProfile } = await import('@/lib/offline/doctorProfile')
          const res = await fetch('/api/me/perfil-medico')
          if (res.ok) {
            const { medico } = await res.json()
            if (medico) await syncDoctorProfile(medico)
          }
        } catch {
          // Si falla, puede que ya exista un profile previo — continuar
          console.warn('[OfflineSetup] Profile sync failed — using existing profile if available')
        }

        // ── Paso 4: Pre-cachear la ruta /offline-mode ──
        try {
          // Visitar la ruta para que el SW la cachee
          await fetch('/offline-mode', { cache: 'reload' })
        } catch {
          // Si falla, el SW cacheará en la primera visita real
        }

        // ── Redirigir ──
        setStep('done')
        setTimeout(() => {
          window.location.href = '/offline-mode'
        }, 500)

      } catch (err) {
        setStep('error')
        setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
      }
    }

    setup()
  }, [])

  return (
    <div className="min-h-screen bg-amber-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-8 text-center space-y-5">
        {/* Icono */}
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
          step === 'error' ? 'bg-red-100' : step === 'done' ? 'bg-emerald-100' : 'bg-amber-100'
        }`}>
          {step === 'error' ? (
            <AlertTriangle size={28} className="text-red-600" />
          ) : step === 'done' ? (
            <CheckCircle2 size={28} className="text-emerald-600" />
          ) : (
            <Shield size={28} className="text-amber-600" />
          )}
        </div>

        {/* Título */}
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            {step === 'error' ? 'Error' : step === 'done' ? 'Entorno listo' : 'Preparando modo offline'}
          </h1>
          <p className="text-sm text-slate-500 mt-2">{STEP_LABELS[step]}</p>
        </div>

        {/* Spinner o error */}
        {step !== 'done' && step !== 'error' && (
          <Loader2 size={24} className="animate-spin text-amber-600 mx-auto" />
        )}

        {step === 'error' && (
          <div className="space-y-3">
            <p className="text-xs text-red-500">{errorMsg}</p>
            <a
              href="/offline-mode"
              className="block w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              Continuar de todos modos
            </a>
          </div>
        )}

        {/* Pasos completados */}
        {step !== 'error' && (
          <div className="space-y-2 text-left">
            {(['sw', 'session', 'profile'] as const).map(s => {
              const isDone = ['session', 'profile', 'done'].indexOf(step) > ['sw', 'session', 'profile'].indexOf(s)
                || step === 'done'
              const isCurrent = step === s
              return (
                <div key={s} className={`flex items-center gap-2 text-xs ${isDone ? 'text-emerald-600' : isCurrent ? 'text-amber-700 font-medium' : 'text-slate-300'}`}>
                  {isDone ? <CheckCircle2 size={13} /> : isCurrent ? <Loader2 size={13} className="animate-spin" /> : <div className="w-[13px] h-[13px] rounded-full border border-slate-200" />}
                  <span>{s === 'sw' ? 'Entorno seguro' : s === 'session' ? 'Sesión capturada' : 'Perfil sincronizado'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
