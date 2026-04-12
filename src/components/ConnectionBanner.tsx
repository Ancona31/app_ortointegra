'use client'

import { useEffect, useState, useCallback } from 'react'
import { WifiOff, Wifi, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react'
import {
  startMonitor, subscribe, type ConnectionStatus,
} from '@/lib/connectionMonitor'
import { getPendingNotesCount, syncPendingNotes } from '@/lib/offlineNotes'
import { pendingCount as pendingDocCount, flush as flushDocs } from '@/lib/offlineQueue'
import { getPendingPatientsCount, syncOfflinePatients, updateOfflineReferences } from '@/lib/offlinePatients'
import { getOutboxStats } from '@/lib/outbox-engine'
import DeadLetterDrawer from '@/components/ui/DeadLetterDrawer'

type BannerState = 'none' | 'offline' | 'slow' | 'restored'

export default function ConnectionBanner() {
  const [banner, setBanner] = useState<BannerState>('none')
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingDetail, setPendingDetail] = useState({ notes: 0, docs: 0, patients: 0 })
  const [syncing, setSyncing] = useState(false)
  const [prevStatus, setPrevStatus] = useState<ConnectionStatus>('online')
  const [deadLetterCount, setDeadLetterCount] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Monitor de conexión
  useEffect(() => {
    startMonitor()
    const unsub = subscribe((status) => {
      setPrevStatus(prev => {
        // Conexión restablecida después de estar offline
        if (prev === 'offline' && status === 'online') {
          setBanner('restored')
          setTimeout(() => setBanner('none'), 5000)
          // Auto-sync al reconectar
          syncPendingNotes()
          return status
        }

        if (status === 'offline') setBanner('offline')
        else if (status === 'slow') setBanner('slow')
        else if (prev !== 'offline') setBanner('none')

        return status
      })
    })
    return unsub
  }, [])

  // Contar pendientes + DLQ cada 10s
  useEffect(() => {
    async function check() {
      const [notes, docs, patients] = await Promise.all([
        getPendingNotesCount(),
        pendingDocCount(),
        getPendingPatientsCount(),
      ])
      setPendingTotal(notes + docs + patients)
      setPendingDetail({ notes, docs, patients })

      // Contar items con error permanente en la DLQ
      try {
        const stats = await getOutboxStats()
        setDeadLetterCount(stats.failed)
      } catch {
        setDeadLetterCount(0)
      }
    }
    check()
    const timer = setInterval(check, 10_000)
    return () => clearInterval(timer)
  }, [])

  // Prevenir pérdida de datos al cerrar tab con pendientes
  useEffect(() => {
    if (pendingTotal === 0) return

    const handler = (e: BeforeUnloadEvent) => {
      // El browser muestra su diálogo nativo. El mensaje custom puede ser
      // ignorado en Chrome/Firefox modernos por seguridad, pero la alerta
      // aparece igualmente.
      e.preventDefault()
      e.returnValue = `Tienes ${pendingTotal} cambio${pendingTotal > 1 ? 's' : ''} sin sincronizar. ¿Salir de todas formas?`
      return e.returnValue
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [pendingTotal])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      // Sync patients first to get real IDs
      const idMap = await syncOfflinePatients()
      await updateOfflineReferences(idMap)
      // Sync notes and documents in parallel
      await Promise.all([syncPendingNotes(), flushDocs()])
      const [notes, docs, patients] = await Promise.all([
        getPendingNotesCount(),
        pendingDocCount(),
        getPendingPatientsCount(),
      ])
      setPendingTotal(notes + docs + patients)
    } finally {
      setSyncing(false)
    }
  }, [])

  // Nada que mostrar — mostrar si hay banner de estado, pendientes o errores en DLQ
  if (banner === 'none' && pendingTotal === 0 && deadLetterCount === 0) return null

  return (
    <div className="sticky top-0 z-[60] flex flex-col">
      {/* Banner de estado de conexión */}
      {banner === 'offline' && (
        <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
          <WifiOff size={16} />
          <span>Sin conexion a internet — modo offline activo. Tus cambios se guardaran localmente.</span>
        </div>
      )}

      {banner === 'slow' && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
          <AlertTriangle size={16} />
          <span>Conexion lenta — los cambios pueden tardar en guardarse.</span>
        </div>
      )}

      {banner === 'restored' && (
        <div className="bg-emerald-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-fade-in">
          <Wifi size={16} />
          <span>Conexion restablecida — sincronizando datos...</span>
        </div>
      )}

      {/* Badge de pendientes */}
      {pendingTotal > 0 && banner !== 'offline' && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-orange-700 font-medium">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold">
              {pendingTotal}
            </span>
            {pendingTotal === 1 ? 'cambio pendiente' : 'cambios pendientes'}
            {pendingTotal > 1 && (
              <span className="text-orange-500 text-xs font-normal">
                ({[
                  pendingDetail.docs > 0 && `${pendingDetail.docs} doc`,
                  pendingDetail.notes > 0 && `${pendingDetail.notes} nota`,
                  pendingDetail.patients > 0 && `${pendingDetail.patients} pac`,
                ].filter(Boolean).join(', ')})
              </span>
            )}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      )}

      {/* Badge de errores permanentes (DLQ) — siempre visible si hay items fallidos */}
      {deadLetterCount > 0 && banner !== 'offline' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
            <AlertCircle size={14} />
            <span>
              {deadLetterCount} {deadLetterCount === 1 ? 'error de sincronización' : 'errores de sincronización'}
            </span>
          </span>
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
          >
            Ver detalles
          </button>
        </div>
      )}

      {/* Drawer modal de Dead Letter Queue */}
      <DeadLetterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
