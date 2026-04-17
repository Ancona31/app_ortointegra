'use client'

import { useState, useEffect, useRef } from 'react'
import { WifiOff, Loader2 } from 'lucide-react'

/**
 * OfflineAlert — Modal bloqueante full-screen cuando no hay conexión.
 *
 * Flujo:
 *   1. navigator.onLine pasa a false → debounce 4s
 *   2. Si no reconecta → modal full-screen con blur, NO dismissable
 *   3. Dos opciones: esperar (la red vuelve y el modal se quita solo) o ir al offline-mode
 *   4. Si reconecta → modal desaparece automáticamente
 *
 * AISLADO: no importa AuthContext, Supabase ni hooks complejos.
 */
export default function OfflineAlert() {
  const [showModal, setShowModal] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleOffline() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setShowModal(true)
      }, 4000)
    }

    function handleOnline() {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      setShowModal(false)
    }

    if (!navigator.onLine) handleOffline()

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-[modalEnter_0.22s_cubic-bezier(0.32,0.72,0,1)]">
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <WifiOff size={28} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Sin conexión</h2>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            No se detecta conexión o es de mala calidad. Espera a que se estabilice la red o cambia a modo offline.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-400">
            <Loader2 size={12} className="animate-spin" />
            <span>Esperando reconexión...</span>
          </div>
        </div>
        <div className="px-6 pb-6 pt-2">
          <a
            href="/offline-mode"
            className="block w-full py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm text-center hover:bg-amber-700 transition-colors"
          >
            Entrar a Modo Offline
          </a>
        </div>
      </div>
    </div>
  )
}
