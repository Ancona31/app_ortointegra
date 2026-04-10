'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { subscribe, getStatus } from '@/lib/connectionMonitor'
import OfflineFallbackPage from '@/components/OfflineFallbackPage'

const OFFLINE_ALLOWED_PREFIXES = ['/inicio', '/documentos']

function isRouteAvailableOffline(pathname: string): boolean {
  return OFFLINE_ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.includes('/nueva-nota')
}

export default function OfflineGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(() => getStatus() !== 'offline')

  useEffect(() => {
    const unsub = subscribe((status) => setIsOnline(status !== 'offline'))
    return unsub
  }, [])

  if (!isOnline && !isRouteAvailableOffline(pathname)) {
    return <OfflineFallbackPage />
  }

  return <>{children}</>
}
