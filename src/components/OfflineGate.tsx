'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { subscribe, getStatus } from '@/lib/connectionMonitor'
import OfflineFallbackPage from '@/components/OfflineFallbackPage'

/** Rutas que requieren servidor — todo lo demás funciona offline */
const ONLINE_ONLY_PREFIXES = [
  '/super-admin',
  '/login',
  '/register',
  '/reset-password',
  '/forgot-password',
]

function isRouteOnlineOnly(pathname: string): boolean {
  return ONLINE_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export default function OfflineGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(() => getStatus() !== 'offline')

  useEffect(() => {
    const unsub = subscribe((status) => setIsOnline(status !== 'offline'))
    return unsub
  }, [])

  if (!isOnline && isRouteOnlineOnly(pathname)) {
    return <OfflineFallbackPage />
  }

  return <>{children}</>
}
