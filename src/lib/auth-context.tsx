'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStatus } from '@/lib/connectionMonitor'

/* ──────────────────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────────────────── */

export type AuthStatus = 'FRESH' | 'GRACE_EXPIRED' | 'UNAUTHENTICATED'

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
  tokenState: {
    expiresAt: number | null
    redVerifiedAt: number | null
    isExpired: boolean
    graceRemainingMs: number | null
  }
  signOut: () => Promise<void>
  refreshMeta: () => Promise<void>
}

/* ──────────────────────────────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────────────────────────────── */

const GRACE_PERIOD_MS = 30 * 60 * 1000

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

/**
 * Obtiene sesión del SDK de Supabase y sincroniza a spinus_session_meta.
 * El SDK lee de cookies en SSR, o de localStorage en client puro.
 * Si SDK retorna null (offline), se mantiene el último estado conocido.
 */
async function syncFromSdkSession(currentMeta: SessionMeta): Promise<SessionMeta> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getSession()

    if (error || !data.session) {
      // SDK no tiene sesión — mantener estado actual si existe
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
    // Error — mantener estado actual si existe
    return currentMeta.userId ? currentMeta : { userId: null, expiresAt: null, redVerifiedAt: null, email: null }
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Validación de token
   ────────────────────────────────────────────────────────────────────── */

function validateToken(meta: SessionMeta): AuthStatus {
  const now = Date.now()

  if (!meta.userId) return 'UNAUTHENTICATED'

  if (meta.expiresAt && meta.expiresAt < now) {
    return 'UNAUTHENTICATED'
  }

  if (!meta.redVerifiedAt) {
    return 'UNAUTHENTICATED'
  }

  const elapsed = now - meta.redVerifiedAt
  if (elapsed < GRACE_PERIOD_MS) {
    return 'FRESH'
  }

  return 'GRACE_EXPIRED'
}

function computeTokenState(meta: SessionMeta): AuthContextValue['tokenState'] {
  const now = Date.now()
  const isExpired = meta.expiresAt ? meta.expiresAt < now : true

  let graceRemainingMs: number | null = null
  if (meta.redVerifiedAt) {
    const remaining = GRACE_PERIOD_MS - (now - meta.redVerifiedAt)
    graceRemainingMs = Math.max(0, remaining)
  }

  return {
    expiresAt: meta.expiresAt,
    redVerifiedAt: meta.redVerifiedAt,
    isExpired,
    graceRemainingMs,
  }
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
  const tokenState = computeTokenState(meta)
  const isAuthenticated = meta.userId !== null && !tokenState.isExpired

  /**
   * RefreshMeta — Sincroniza con el SDK y actualiza spinus_session_meta.
   * Se ejecuta:
   *   - Online, periódicamente (visibility change)
   *   - Al reconectar (evento online)
   *   - Explicitamente vía hook
   *
   * Esto garantiza que cada vez que hay red y la sesión es válida,
   * el timestamp redVerifiedAt se actualiza, extendiendo el grace period.
   */
  const refreshMeta = useCallback(async (): Promise<void> => {
    if (getStatus() === 'offline') return

    setMeta(current => {
      void syncFromSdkSession(current).then(newMeta => {
        setMeta(newMeta)
      })
      return current
    })
  }, [])

  /**
   * SignOut explícito — limpia todo lo relacionado con la sesión.
   * Se llama desde el handleLogout del Sidebar.
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Silencioso — signOut server-side es best-effort
    }

    const emptyMeta: SessionMeta = {
      userId: null,
      expiresAt: null,
      redVerifiedAt: null,
      email: null,
    }
    setMeta(emptyMeta)
    saveMeta(emptyMeta)
  }, [])

  /**
   * Inicialización — Hidratación híbrida
   *
   * Paso 1: Leer spinus_session_meta del localStorage (inmediato, offline-safe)
   *         → Esto nos da userId disponible para Mirror y Outbox SIN esperar SDK
   *
   * Paso 2: Si estamos online, sincronizar con SDK (getSession → cookies)
   *         → Esto actualiza redVerifiedAt y mantiene la sesión fresca
   *
   * El resultado: incluso si SDK falla o las cookies expiran,
   * siempre tenemos el último userId conocido guardado localmente.
   */
  useEffect(() => {
    async function init() {
      // Paso 1: Cargar estado local inmediatamente
      const storedMeta = getStoredMeta()

      if (storedMeta.userId) {
        // Hay sesión guardada previamente — usarla inmediatamente
        setMeta(storedMeta)
      }

      // Paso 2: Sincronizar con SDK si hay red
      if (getStatus() !== 'offline') {
        const syncedMeta = await syncFromSdkSession(storedMeta)
        setMeta(syncedMeta)
      }

      setInitialized(true)
    }

    void init()
  }, [])

  /**
   * Sync periódico — cada vez que la conexión cambia a online
   * o cuando la pestaña vuelve al foreground, refreshMeta actualiza
   * redVerifiedAt para extender el grace period.
   */
  useEffect(() => {
    if (!initialized) return

    const handleOnline = () => {
      void refreshMeta()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshMeta()
      }
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
    tokenState,
    signOut,
    refreshMeta,
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
