'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

/* ──────────────────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────────────────── */

export type AuthStatus = 'AUTHENTICATED' | 'UNAUTHENTICATED'

export interface SessionMeta {
  userId: string | null
  expiresAt: number | null
  redVerifiedAt: number | null
  email: string | null
}

export interface AuthContextValue {
  userId: string | null
  email: string | null
  status: AuthStatus
  isAuthenticated: boolean
  initialized: boolean
  signOut: () => Promise<void>
  refreshMeta: () => Promise<void>
}

/* ──────────────────────────────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────────────────────────────── */

const SESSION_META_KEY = 'spinus_session_meta'

/* ──────────────────────────────────────────────────────────────────────
   Helpers JWT — Zero dependency
   ────────────────────────────────────────────────────────────────────── */

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function getTokenExpiration(exp: unknown): number | null {
  if (typeof exp !== 'number') return null
  return exp * 1000
}

/* ──────────────────────────────────────────────────────────────────────
   Persistencia de metadata local (spinus_session_meta)
   ────────────────────────────────────────────────────────────────────── */

function getStoredMeta(): SessionMeta {
  try {
    const raw = localStorage.getItem(SESSION_META_KEY)
    if (!raw) return { userId: null, expiresAt: null, redVerifiedAt: null, email: null }
    const parsed = JSON.parse(raw) as Partial<SessionMeta>
    return {
      userId: parsed.userId ?? null,
      expiresAt: parsed.expiresAt ?? null,
      redVerifiedAt: parsed.redVerifiedAt ?? null,
      email: parsed.email ?? null,
    }
  } catch {
    return { userId: null, expiresAt: null, redVerifiedAt: null, email: null }
  }
}

function saveMeta(meta: SessionMeta): void {
  try {
    localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta))
  } catch {
    // Silencioso — localStorage puede fallar en privado mode
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Sincronizar metadata desde sesión del SDK (cookies)
   ────────────────────────────────────────────────────────────────────── */

async function syncFromSdkSession(currentMeta: SessionMeta): Promise<SessionMeta> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getSession()

    if (error || !data.session) {
      return currentMeta.userId ? currentMeta : { userId: null, expiresAt: null, redVerifiedAt: null, email: null }
    }

    const { session } = data
    const { user, access_token, expires_at } = session

    let exp: number | null = null
    let email: string | null = null

    if (access_token) {
      const payload = decodeJWTPayload(access_token)
      if (payload) {
        exp = getTokenExpiration(payload.exp)
        email = (payload.email as string | undefined) ?? null
      }
    }

    if (!user?.id) {
      return currentMeta.userId ? currentMeta : { userId: null, expiresAt: null, redVerifiedAt: null, email: null }
    }

    const newMeta: SessionMeta = {
      userId: user.id,
      expiresAt: exp ?? (expires_at ? expires_at * 1000 : null),
      redVerifiedAt: Date.now(),
      email: email ?? user.email ?? null,
    }

    saveMeta(newMeta)
    return newMeta
  } catch {
    return currentMeta.userId ? currentMeta : { userId: null, expiresAt: null, redVerifiedAt: null, email: null }
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Validación de token
   ────────────────────────────────────────────────────────────────────── */

function validateToken(meta: SessionMeta): AuthStatus {
  if (!meta.userId) return 'UNAUTHENTICATED'

  if (meta.expiresAt && meta.expiresAt < Date.now()) {
    return 'UNAUTHENTICATED'
  }

  return 'AUTHENTICATED'
}

/* ──────────────────────────────────────────────────────────────────────
   Context
   ────────────────────────────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextValue | null>(null)

/* ──────────────────────────────────────────────────────────────────────
   Provider
   ────────────────────────────────────────────────────────────────────── */

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [meta, setMeta] = useState<SessionMeta>(() => getStoredMeta())
  const [initialized, setInitialized] = useState(false)

  const status = validateToken(meta)
  const isAuthenticated = status === 'AUTHENTICATED'

  const refreshMeta = useCallback(async (): Promise<void> => {
    const newMeta = await syncFromSdkSession(meta)
    setMeta(newMeta)
  }, [meta])

  const signOut = useCallback(async (): Promise<void> => {
    try {
      document.cookie.split(';').forEach(c => {
        const name = c.trim().split('=')[0]
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      })
    } catch { /* silent */ }
    try {
      sessionStorage.removeItem('spinus_active')
    } catch { /* silent */ }

    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch { /* silent */ }

    const emptyMeta: SessionMeta = {
      userId: null, expiresAt: null, redVerifiedAt: null, email: null,
    }
    setMeta(emptyMeta)
    saveMeta(emptyMeta)
  }, [])

  // Inicialización: sync con SDK antes de renderizar children
  useEffect(() => {
    async function init() {
      const storedMeta = getStoredMeta()
      if (storedMeta.userId) {
        setMeta(storedMeta)
      }
      const syncedMeta = await syncFromSdkSession(storedMeta)
      setMeta(syncedMeta)
      setInitialized(true)
    }
    void init()
  }, [])

  // Sync en reconexión y visibilitychange
  useEffect(() => {
    if (!initialized) return
    const handleOnline = () => { void refreshMeta() }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshMeta()
    }
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [initialized, refreshMeta])

  const value: AuthContextValue = {
    userId: meta.userId,
    email: meta.email,
    status,
    isAuthenticated,
    initialized,
    signOut,
    refreshMeta,
  }

  // Loading gate: NO renderizar children hasta que la sesión se resuelva
  if (!initialized) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 size={28} className="animate-spin text-[#1e5fa8]" />
        </div>
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ──────────────────────────────────────────────────────────────────────
   Hook público
   ────────────────────────────────────────────────────────────────────── */

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return context
}
