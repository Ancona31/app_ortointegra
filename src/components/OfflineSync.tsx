'use client'

import { useEffect } from 'react'
import { startAutoSync } from '@/lib/offlineQueue'
import { syncPendingNotes } from '@/lib/offlineNotes'
import { syncOfflinePatients, updateOfflineReferences } from '@/lib/offlinePatients'
import { subscribe } from '@/lib/connectionMonitor'

async function fullSync() {
  // 1. Sincronizar pacientes primero para obtener IDs reales
  const idMap = await syncOfflinePatients()

  // 2. Actualizar referencias en colas de notas/documentos
  await updateOfflineReferences(idMap)

  // 3. Sincronizar notas y documentos con IDs correctos
  await syncPendingNotes()
}

export default function OfflineSync() {
  useEffect(() => {
    const cleanupQueue = startAutoSync()

    // Sincronización completa cuando la conexión se restablece
    const unsubConnection = subscribe((status) => {
      if (status === 'online') {
        fullSync()
      }
    })

    return () => {
      cleanupQueue?.()
      unsubConnection()
    }
  }, [])

  return null
}
