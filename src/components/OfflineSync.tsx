'use client'

import { useEffect } from 'react'
import { startAutoSync } from '@/lib/offlineQueue'

export default function OfflineSync() {
  useEffect(() => {
    const cleanup = startAutoSync()
    return cleanup
  }, [])

  return null
}
