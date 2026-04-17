'use client'

import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * OfflineAlert — Banner que aparece cuando no hay conexión.
 * Ofrece un link directo al modo offline (/offline-mode).
 *
 * AISLADO: no importa AuthContext, Supabase, ni hooks complejos.
 * Solo usa navigator.onLine y eventos online/offline del browser.
 */
export default function OfflineAlert() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="sticky top-0 z-[60] bg-amber-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <WifiOff size={16} />
      <span>Sin conexión a internet</span>
      <a
        href="/offline-mode"
        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold transition-colors"
      >
        Ir al modo offline
      </a>
    </div>
  )
}
