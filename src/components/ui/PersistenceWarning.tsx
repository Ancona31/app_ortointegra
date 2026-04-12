'use client'

/**
 * PersistenceWarning — Banner discreto que advierte al usuario si el
 * navegador no garantiza la persistencia de los datos locales.
 *
 * Se muestra cuando:
 *   - isPersistenceReliable() === false (Safari: la API miente)
 *   - isStoragePersistent() === false (concedido explícitamente denegado)
 *
 * Comportamiento:
 *   - Dismissable por sesión (flag en sessionStorage, no permanente)
 *   - Reaparece al cerrar/reabrir el tab — forzamos consciencia del riesgo
 *     en cada sesión médica
 *
 * Integración:
 *   - Importar desde el layout principal de la app
 *   - No requiere props
 *   - Si no aplica (navegador confiable y persistencia granted), retorna null
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import {
  isPersistenceReliable,
  isStoragePersistent,
} from '@/lib/storage-vault'

const DISMISS_KEY = 'spinus_persistence_warning_dismissed'

export default function PersistenceWarning() {
  const [mounted, setMounted] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Respetar dismissal previo de esta misma sesión del tab
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true)
        return
      }
    } catch {
      // sessionStorage bloqueado — continuar evaluación normal
    }

    let cancelled = false

    ;(async () => {
      // Detección síncrona: Safari nunca es confiable
      if (!isPersistenceReliable()) {
        if (!cancelled) setShouldShow(true)
        return
      }

      // Detección async: estado actual de persistencia concedida
      const persistent = await isStoragePersistent()
      if (!cancelled && !persistent) {
        setShouldShow(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function handleDismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sessionStorage bloqueado — el dismiss solo dura en memoria
    }
  }

  // SSR + hydration safe: no renderizar hasta estar montado en cliente
  if (!mounted) return null
  if (dismissed) return null
  if (!shouldShow) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-[60] bg-amber-50 border-b border-amber-200 shadow-sm"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="text-amber-600 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Almacenamiento no garantizado
          </p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            Tu navegador no permite marcar los datos como persistentes. En
            casos de poco espacio en el dispositivo, el sistema podría borrar
            información local. Conéctate regularmente a internet para
            sincronizar tus datos.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar advertencia"
          className="flex-shrink-0 p-1 rounded-md text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
