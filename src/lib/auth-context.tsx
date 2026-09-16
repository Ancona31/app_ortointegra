'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

  /* `meta` viaja por ref, no por dependencia. Con `[meta]`, refreshMeta cambiaba
     de identidad en cada setMeta y remontaba el efecto de listeners de abajo;
     como esos listeners son `online` y `visibilitychange`, volver a la pestaña
     re-renderizaba la aplicacion entera. El ref se actualiza en commit y
     refreshMeta solo se invoca desde manejadores de evento, que corren despues
     del commit, asi que nunca lee un valor viejo. */
  const metaRef = useRef(meta)
  useEffect(() => { metaRef.current = meta }, [meta])

  const refreshMeta = useCallback(async (): Promise<void> => {
    const newMeta = await syncFromSdkSession(metaRef.current)
    setMeta(newMeta)
  }, [])

  /**
   * Cierra la sesión: revoca en el servidor, limpia lo local SIEMPRE, y lanza al
   * final si la revocación no se consiguió.
   *
   * ⚠️ LA LIMPIEZA LOCAL YA NO ESTÁ CONDICIONADA A LA REVOCACIÓN, Y AHÍ ESTABA EL
   * DEFECTO DE SEGURIDAD. Antes, un `signOut` que devolviera `error` salía por un
   * `throw` colocado ANTES del borrado, así que las cookies sb-* se quedaban con
   * el JWT dentro y el refresh token al lado. Y no las borraba nadie más:
   * `_signOut` de auth-js sólo llama a `_removeSession()` después de hablar con
   * el servidor (GoTrueClient.js:1754+), así que en ese camino el SDK tampoco
   * limpia. Resultado: el navegador se quedaba con una credencial completa y
   * `autoRefreshToken: true` la renovaba sola. No era una ventana de una hora
   * hasta el `exp`; era indefinida, en un equipo desde el que alguien acababa de
   * pulsar «cerrar sesión».
   * El invariante nuevo, y es el que hay que conservar: ESTE navegador nunca se
   * queda con una credencial cuya revocación no esté confirmada. Que siga viva
   * en OTROS dispositivos es lo que no controlamos desde aquí, y de eso informa
   * el `throw` del final.
   *
   * ⚠️ EL ORDEN NO ES DE ESTILO, y la parte de revocar PRIMERO sigue vigente
   * tal cual. `@supabase/ssr` guarda la sesión DENTRO de las cookies sb-*, así
   * que borrarlas antes de llamar al servidor deja al SDK sin sesión que
   * revocar: `_signOut` sólo llama al servidor `if (accessToken)`
   * (GoTrueClient.js:1754), se salta esa rama entera y devuelve éxito con el
   * refresh token vivo en Supabase Auth. Revocar → limpiar → informar, en ese
   * orden y en ninguno otro.
   *
   * ⚠️ HACEN FALTA LAS DOS COSAS, `try/catch` Y MIRAR EL `{ error }`, y quedarse
   * con una sola es un error que ya se ha cometido en los dos sentidos:
   *  · auth-js DEVUELVE el fallo del SERVIDOR en `{ error }`, no lo lanza — el
   *    mismo malentendido que ya se corrigió en logAudit. Un try/catch a secas
   *    no lo ve.
   *  · Pero `signOut()` SÍ RECHAZA por su cuenta antes de llegar al servidor:
   *    envuelve todo en `_acquireLock(this.lockAcquireTimeout, …)`
   *    (GoTrueClient.js:1748-1753) y `navigatorLock` lanza
   *    `NavigatorLockAcquireTimeoutError` a los 5 s (`lib/locks.js:156`), o
   *    antes si otra pestaña le roba el cerrojo (`:243`). Con varias pestañas
   *    abiertas —lo normal en un consultorio— una puede estar refrescando el
   *    token y sostener el cerrojo. Sin el `catch`, esa excepción se llevaba por
   *    delante la limpieza de abajo y la invariante de este bloque no se cumplía
   *    justo en el caso que la hace falta.
   *
   * `scope: 'global'` es deliberado: cierra la sesión en TODOS los dispositivos.
   */
  const signOut = useCallback(async (): Promise<void> => {
    const supabase = createClient()

    /* `fallo` recoge los dos caminos: el `{ error }` que devuelve auth-js y la
       excepción que puede lanzar el cerrojo. Ver el bloque de arriba. */
    let fallo: unknown = null
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      fallo = error
    } catch (e) {
      fallo = e
    }

    /* Limpieza local, pase lo que pase con la revocación. En el camino feliz el
       `_removeSession()` del SDK ya borró las cookies por el adaptador de
       `lib/supabase/client.ts`; esto es la red para el camino en que no llegó a
       correr. Es idempotente: borrar dos veces la misma cookie no cuesta nada. */
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

    const emptyMeta: SessionMeta = {
      userId: null, expiresAt: null, redVerifiedAt: null, email: null,
    }
    setMeta(emptyMeta)
    saveMeta(emptyMeta)

    /* Se informa AL FINAL, no antes: cuando esto lanza, la credencial de este
       navegador ya está destruida y `status` ya es UNAUTHENTICATED, así que
       `SessionGuard` saca al usuario del árbol de (app) aunque quien llame
       decida no navegar.
       ⚠️ NO SUBAS ESTA LÍNEA otra vez por encima de la limpieza. Eso es
       exactamente el defecto que este bloque vino a cerrar. */
    if (fallo) throw fallo
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

  const value: AuthContextValue = useMemo(
    () => ({
      userId: meta.userId,
      email: meta.email,
      status,
      isAuthenticated,
      initialized,
      signOut,
      refreshMeta,
    }),
    [meta.userId, meta.email, status, isAuthenticated, initialized, signOut, refreshMeta],
  )

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

