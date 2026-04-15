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
   Persistencia de metadata (fuera del SDK)
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
   Obtención de token raw desde Supabase localStorage
   ────────────────────────────────────────────────────────────────────── */

function getSupabaseToken(): string | null {
  try {
    const prefix = 'sb-'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix) && key.includes('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw) as { access_token?: string }
        if (parsed.access_token) return parsed.access_token
      }
    }
  } catch {
    // Silencioso
  }
  return null
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
   * Sincroniza metadata con Supabase — solo se ejecuta online.
   * Extrae el JWT del localStorage de Supabase, decodifica payload,
   * y actualiza red_verified_at si el token es válido.
   *
   * Esta función es idempotente y no falla — si hay error, mantiene
   * el último estado conocido válido.
   */
  const refreshMeta = useCallback(async (): Promise<void> => {
    if (getStatus() === 'offline') return

    const token = getSupabaseToken()
    if (!token) return

    const payload = decodeJWTPayload(token)
    if (!payload) return

    const userId = payload.sub as string | undefined
    const exp = getTokenExpiration(payload.exp)
    const email = payload.email as string | undefined

    if (!userId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
        const newMeta: SessionMeta = {
          userId: meta.userId,
          expiresAt: exp ?? meta.expiresAt,
          redVerifiedAt: meta.redVerifiedAt,
          email: meta.email,
        }
        setMeta(newMeta)
        saveMeta(newMeta)
        return
      }

      const newMeta: SessionMeta = {
        userId: data.user.id,
        expiresAt: exp ?? meta.expiresAt,
        redVerifiedAt: Date.now(),
        email: data.user.email ?? email ?? null,
      }
      setMeta(newMeta)
      saveMeta(newMeta)
    } catch {
      // Mantener estado existente si falla
    }
  }, [meta])

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
   * Inicialización — extrae sesión persistida del SDK de Supabase
   * y-popula la metadata local para que esté disponible inmediatamente.
   *
   * IMPORTANTE: Esta función se ejecuta una sola vez al montar.
   * No espera a que el SDK complete su proceso asíncrono — lee
   * directamente del localStorage para tener userId disponible
   * antes de que el Mirror y el Outbox necesiten inicializarse.
   */
  useEffect(() => {
    async function init() {
      const storedMeta = getStoredMeta()
      const token = getSupabaseToken()

      if (token && !storedMeta.redVerifiedAt) {
        const payload = decodeJWTPayload(token)
        if (payload) {
          const userId = payload.sub as string | undefined
          const exp = getTokenExpiration(payload.exp)
          const email = payload.email as string | undefined

          if (userId) {
            const newMeta: SessionMeta = {
              userId,
              expiresAt: exp,
              redVerifiedAt: Date.now(),
              email: email ?? null,
            }
            setMeta(newMeta)
            saveMeta(newMeta)
          }
        }
      } else if (storedMeta.userId) {
        setMeta(storedMeta)
      }

      setInitialized(true)
    }

    void init()
  }, [])

  /**
   * Sync periódico — cada vez que la conexión cambia a online,
   * refreshMeta actualiza red_verified_at.
   * También se dispara cuando la pestaña vuelve al foreground.
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
