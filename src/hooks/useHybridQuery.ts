'use client'

/**
 * useHybridQuery — Hook Stale-While-Revalidate local-first
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Estrategia: lee del Read Mirror primero (instantáneo), luego hace
 * fetch remoto en background para refrescar. Si estamos offline, se
 * queda con los datos locales sin mostrar error — es un modo legítimo.
 *
 * Flujo en mount:
 *   1. localFetcher() → si hay data, render inmediato con source='local'
 *   2. Si getStatus() !== 'offline' y hay remoteFetcher → fetch remoto
 *   3. Al resolver remoto → setState con source='remote', isFresh=true
 *   4. updateLocal(remote) refresca el mirror (fire-and-forget)
 *
 * Triggers de refetch automático:
 *   • Reconexión (subscribe al connectionMonitor)
 *   • Visibilitychange al foreground (si stale > staleTimeMs)
 *   • Manual vía refetch() expuesto en el estado
 *
 * Optimizaciones:
 *   • Shallow equal para evitar re-renders si la data no cambió
 *     (comparación por id+updated_at en arrays y objetos "row-like")
 *   • Refs para evitar stale closures en listeners
 *   • Cleanup flags para evitar setState tras unmount
 *
 * Genérico en T — el llamador especifica el tipo (ej. PacienteLocal[]
 * o ConsultaLocal[]) y el hook lo preserva en todos los estados.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getStatus,
  subscribe,
  type ConnectionStatus,
} from '@/lib/connectionMonitor'

export type HybridSource = 'local' | 'remote' | 'none'

export interface HybridQueryState<T> {
  /** Datos actuales (local o remoto, null si aún no hay nada) */
  data: T | null
  /** True solo mientras no tenemos NADA (ni local ni remoto) */
  isLoading: boolean
  /** True si los datos vienen de un fetch remoto reciente */
  isFresh: boolean
  /** Origen de los datos actuales */
  source: HybridSource
  /** Timestamp en ms del último fetch remoto exitoso */
  lastSyncAt: number | null
  /** Error del último fetch remoto (null si offline — no es error) */
  error: Error | null
  /** Refetch manual — respeta offline (no-op si no hay red) */
  refetch: () => Promise<void>
}

export interface HybridQueryOptions<T> {
  /** Clave lógica del hook — cambiar = re-mount del flow */
  key: string
  /** Lectura del mirror local (IndexedDB) */
  localFetcher: () => Promise<T | null>
  /** Lectura remota (Supabase). Si se omite, el hook es solo-local. */
  remoteFetcher?: () => Promise<T>
  /** Callback para actualizar el mirror tras fetch remoto exitoso */
  updateLocal?: (data: T) => Promise<void>
  /** Tiempo tras el cual la data se considera stale (default 60s) */
  staleTimeMs?: number
  /** Habilita/deshabilita el hook entero (default true) */
  enabled?: boolean
}

const DEFAULT_STALE_TIME_MS = 60_000

/* ──────────────────────────────────────────────────────────────────────
   Shallow equality helpers — optimización anti re-render
   ────────────────────────────────────────────────────────────────────── */

/**
 * Compara dos arrays de registros por id + updated_at. Suficiente para
 * listas de pacientes/consultas/documentos: si un registro cambió en
 * el server, su updated_at difiere y detectamos el cambio sin inspeccionar
 * cada campo.
 */
function shallowArrayEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ra = a[i] as Record<string, unknown> | null | undefined
    const rb = b[i] as Record<string, unknown> | null | undefined
    if (!ra || !rb) {
      if (ra !== rb) return false
      continue
    }
    if (ra.id !== rb.id) return false
    if (ra.updated_at !== rb.updated_at) return false
  }
  return true
}

/**
 * Compara dos valores cualquiera con una heurística pragmática:
 *   • === directo si son primitivos o misma referencia
 *   • array → shallowArrayEqual por id+updated_at
 *   • objeto con id/updated_at → compara esos dos campos
 *   • objeto plano → compara keys superficialmente
 *
 * Si en el futuro necesitamos comparar estructuras más profundas,
 * el llamador puede omitir updateLocal y aceptar los re-renders.
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return shallowArrayEqual(a, b)
  }
  if (typeof a !== 'object' || typeof b !== 'object') return false

  const oa = a as Record<string, unknown>
  const ob = b as Record<string, unknown>

  // Row-like: comparar por id + updated_at si existen
  if ('id' in oa && 'id' in ob && 'updated_at' in oa && 'updated_at' in ob) {
    return oa.id === ob.id && oa.updated_at === ob.updated_at
  }

  // Fallback: shallow key-by-key
  const ka = Object.keys(oa)
  const kb = Object.keys(ob)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (oa[k] !== ob[k]) return false
  }
  return true
}

/* ──────────────────────────────────────────────────────────────────────
   Hook principal
   ────────────────────────────────────────────────────────────────────── */

export function useHybridQuery<T>(opts: HybridQueryOptions<T>): HybridQueryState<T> {
  const { staleTimeMs = DEFAULT_STALE_TIME_MS, enabled = true, key } = opts

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isFresh, setIsFresh] = useState<boolean>(false)
  const [source, setSource] = useState<HybridSource>('none')
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Refs para evitar stale closures en los effects de larga vida
  const mountedRef = useRef<boolean>(true)
  const dataRef = useRef<T | null>(null)
  const lastFetchAtRef = useRef<number>(0)
  const optsRef = useRef<HybridQueryOptions<T>>(opts)
  optsRef.current = opts

  /** Setea data solo si cambió estructuralmente — evita re-renders inútiles */
  const setDataIfChanged = useCallback((next: T) => {
    if (!shallowEqual(dataRef.current, next)) {
      dataRef.current = next
      setData(next)
    }
  }, [])

  /**
   * Fetch remoto + actualización del mirror. Respeta offline: si el
   * monitor dice 'offline', retorna inmediatamente sin error.
   */
  const doRefetch = useCallback(async (): Promise<void> => {
    const current = optsRef.current
    if (!current.remoteFetcher) return
    if (getStatus() === 'offline') return

    try {
      setError(null)
      const remote = await current.remoteFetcher()
      if (!mountedRef.current) return

      setDataIfChanged(remote)
      setSource('remote')
      setIsFresh(true)
      const now = Date.now()
      setLastSyncAt(now)
      lastFetchAtRef.current = now
      setIsLoading(false)

      // Refrescar mirror — fire-and-forget. Un fallo aquí no debe romper la UI.
      if (current.updateLocal) {
        try {
          await current.updateLocal(remote)
        } catch {
          // silent
        }
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err : new Error('remote fetch failed'))
      setIsLoading(false)
      // Mantenemos la data local si existía — no se borra en errores remotos
    }
  }, [setDataIfChanged])

  /* ── Effect 1: mount → local primero, remote después ───────────── */
  useEffect(() => {
    mountedRef.current = true

    if (!enabled) {
      setIsLoading(false)
      return () => {
        mountedRef.current = false
      }
    }

    let cancelled = false

    ;(async () => {
      // Reset de estado al cambiar key
      setIsLoading(true)
      setError(null)
      setIsFresh(false)

      // 1. Lectura local inmediata
      try {
        const local = await optsRef.current.localFetcher()
        if (cancelled || !mountedRef.current) return
        if (local !== null && local !== undefined) {
          dataRef.current = local
          setData(local)
          setSource('local')
          setIsFresh(false)
          setIsLoading(false)
        }
      } catch {
        // silent — seguimos al remote
      }

      // 2. Fetch remoto (si hay red y hay remoteFetcher)
      const hasRemote = !!optsRef.current.remoteFetcher
      if (!hasRemote) {
        if (!cancelled && mountedRef.current) {
          if (dataRef.current === null) setSource('none')
          setIsLoading(false)
        }
        return
      }

      if (getStatus() === 'offline') {
        // Sin red — si no había local, quedamos en 'none'
        if (!cancelled && mountedRef.current) {
          if (dataRef.current === null) setSource('none')
          setIsLoading(false)
        }
        return
      }

      await doRefetch()
    })()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  /* ── Effect 2: suscripción al connectionMonitor → auto-refetch al reconectar ── */
  useEffect(() => {
    if (!enabled || !optsRef.current.remoteFetcher) return

    let prev: ConnectionStatus = getStatus()
    const unsub = subscribe((status) => {
      if (prev === 'offline' && status !== 'offline') {
        // Reconexión → refetch
        void doRefetch()
      }
      prev = status
    })
    return () => {
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  /* ── Effect 3: visibilitychange → refetch si stale ──────────── */
  useEffect(() => {
    if (!enabled || !optsRef.current.remoteFetcher) return
    if (typeof document === 'undefined') return

    const handler = () => {
      if (document.visibilityState !== 'visible') return
      const age = Date.now() - lastFetchAtRef.current
      if (age > staleTimeMs) {
        void doRefetch()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, staleTimeMs])

  return {
    data,
    isLoading,
    isFresh,
    source,
    lastSyncAt,
    error,
    refetch: doRefetch,
  }
}
