'use client'

/**
 * PersistenceWarning — Banner accionable que advierte al usuario SOLO
 * cuando el almacenamiento local está por agotarse.
 *
 * Criterios (ambos son motivos para mostrar el banner):
 *   1. Espacio libre < 500 MB, o
 *   2. Porcentaje usado >= 90% (menos del 10% disponible)
 *
 * Diseño intencional:
 *   - NO se muestra si el navegador simplemente deniega persistencia
 *     pero hay espacio de sobra (era ruido visual sin acción posible)
 *   - NO se muestra si getStorageQuota() devuelve null (API no soportada)
 *   - Solo alertas accionables: el médico debe saber cuándo liberar
 *     espacio o migrar datos, no recibir avisos vagos de "no garantizado"
 *
 * Comportamiento:
 *   - Dismissable por sesión (flag en sessionStorage)
 *   - Re-evalúa cada vez que se monta (cambio de tab / recarga)
 *
 * Integración:
 *   - Importar desde el layout principal de la app
 *   - No requiere props
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { getStorageQuota } from '@/lib/storage-vault'

const DISMISS_KEY = 'spinus_persistence_warning_dismissed'
const FREE_SPACE_THRESHOLD_BYTES = 500 * 1024 * 1024 // 500 MB
const PERCENT_USED_THRESHOLD = 90 // 90% = menos del 10% disponible

type WarningReason = 'low_space' | 'high_usage'

export default function PersistenceWarning() {
  const [mounted, setMounted] = useState(false)
  const [reason, setReason] = useState<WarningReason | null>(null)
  const [freeMb, setFreeMb] = useState<number | null>(null)
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
      const quota = await getStorageQuota()
      if (cancelled) return

      // API no soportada → silencio total, sin banner
      if (!quota) return

      // Si no hay info válida de cuota, no podemos decidir → silencio
      if (quota.totalQuota <= 0) return

      const freeBytes = quota.totalQuota - quota.totalUsed

      // Criterio 1: menos de 500 MB libres
      if (freeBytes < FREE_SPACE_THRESHOLD_BYTES) {
        setFreeMb(Math.max(0, Math.round(freeBytes / (1024 * 1024))))
        setReason('low_space')
        return
      }

      // Criterio 2: más del 90% usado
      if (quota.percentUsed >= PERCENT_USED_THRESHOLD) {
        setFreeMb(Math.round(freeBytes / (1024 * 1024)))
        setReason('high_usage')
        return
      }

      // Hay espacio de sobra → no mostrar nada
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
  if (reason === null) return null

  const title =
    reason === 'low_space'
      ? 'Espacio local casi agotado'
      : 'Almacenamiento casi lleno'

  const body =
    reason === 'low_space'
      ? `Queda menos de 500 MB libres en tu navegador (≈ ${freeMb ?? '?'} MB). Libera espacio en tu dispositivo o sincroniza y limpia datos antiguos para evitar que se borren registros locales.`
      : `Has usado más del 90% del almacenamiento del navegador (≈ ${freeMb ?? '?'} MB libres). Sincroniza tus cambios pendientes y considera limpiar datos antiguos para mantener la app funcional offline.`

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
            {title}
          </p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            {body}
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
