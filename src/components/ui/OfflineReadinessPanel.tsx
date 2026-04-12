'use client'

/**
 * OfflineReadinessPanel — panel de estado del sistema offline-first.
 *
 * Verifica 3 dimensiones críticas:
 *  1. Motor: Service Worker v5 activo + caché spinus-v5 presente
 *  2. Generador PDF: LOGO_BASE64 + ROBOTO_FONTS cargables via dynamic import
 *  3. Data local: conteo de expedientes en secureStorage
 *
 * Diseño glassmorphism — se adapta a modo oscuro del launcher.
 * Incluye retry automático durante los primeros 5s para evitar falsos negativos
 * mientras el Service Worker termina de activarse.
 */

import { useEffect, useState, useCallback } from 'react'
import { useSWRConfig } from 'swr'
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileCheck,
  Users,
} from 'lucide-react'
import { secureStorage } from '@/lib/secureStorage'

interface ChecksState {
  /** null = verificando, true = OK, false = falla */
  swActive: boolean | null
  pdfReady: boolean | null
  /** null = verificando, número = cantidad real */
  expedientesCount: number | null
}

interface Props {
  /** Activa paleta oscura para el launcher */
  dark?: boolean
}

type BadgeState = 'autonomous' | 'syncing' | 'warning'

export default function OfflineReadinessPanel({ dark = false }: Props) {
  const [mounted, setMounted] = useState(false)
  const [checks, setChecks] = useState<ChecksState>({
    swActive: null,
    pdfReady: null,
    expedientesCount: null,
  })
  const [refreshing, setRefreshing] = useState(false)
  const { mutate } = useSWRConfig()

  /** Ejecuta los 3 chequeos en paralelo */
  const runChecks = useCallback(async () => {
    // ── 1. Motor v5 — doble verificación ──
    let swActive = false
    try {
      if (typeof navigator !== 'undefined' && typeof caches !== 'undefined') {
        const hasController = !!navigator.serviceWorker?.controller
        const hasV5Cache = await caches.has('spinus-v5')
        swActive = hasController && hasV5Cache
      }
    } catch {
      swActive = false
    }

    // ── 2. Generador PDF — dynamic imports ──
    let pdfReady = false
    try {
      const [logoMod, fontsMod] = await Promise.all([
        import('@/lib/pdf/logo'),
        import('@/lib/pdf/fonts'),
      ])
      const logoOk =
        typeof logoMod.LOGO_BASE64 === 'string' &&
        logoMod.LOGO_BASE64.startsWith('data:image/png;base64,')
      const fontsOk =
        Array.isArray(fontsMod.ROBOTO_FONTS) && fontsMod.ROBOTO_FONTS.length >= 4
      pdfReady = logoOk && fontsOk
    } catch {
      pdfReady = false
    }

    // ── 3. Expedientes offline ──
    let expedientesCount: number | null = 0
    try {
      const patients = await secureStorage.get<unknown[]>('offline_patients_cache')
      expedientesCount = Array.isArray(patients) ? patients.length : 0
    } catch {
      expedientesCount = 0
    }

    setChecks({ swActive, pdfReady, expedientesCount })
  }, [])

  // Mount + chequeos iniciales con retry escalonado
  useEffect(() => {
    setMounted(true)
    runChecks()

    // Retry durante los primeros 5s para dar tiempo al SW de activarse
    // y a precachePatients de poblar el cache
    const retries = [1500, 3000, 5000]
    const timers = retries.map((delay) =>
      setTimeout(() => {
        runChecks()
      }, delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [runChecks])

  /** Fuerza re-fetch de médico + clínica vía SWR mutate */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        mutate('/api/me/perfil-medico'),
        mutate('/api/me/clinica'),
      ])
      await runChecks()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[OfflineReadinessPanel] refresh falló:', err)
    } finally {
      setRefreshing(false)
    }
  }, [mutate, runChecks])

  // Hydration fix: placeholder idéntico en SSR y primer render del cliente
  if (!mounted) {
    return (
      <div
        className={`
          relative z-[2] rounded-2xl border p-5 h-[180px]
          backdrop-blur-md shadow-lg
          ${dark
            ? 'bg-slate-900/40 border-white/10'
            : 'bg-white/30 border-white/30'}
        `}
        aria-hidden="true"
      />
    )
  }

  // Estado global derivado
  const anyChecking =
    checks.swActive === null ||
    checks.pdfReady === null ||
    checks.expedientesCount === null

  const anyFailed =
    checks.swActive === false ||
    checks.pdfReady === false

  const badgeState: BadgeState = anyChecking
    ? 'syncing'
    : anyFailed
      ? 'warning'
      : 'autonomous'

  return (
    <div
      className={`
        relative z-[2] rounded-2xl border p-5
        backdrop-blur-md shadow-lg
        animate-in fade-in duration-500
        ${dark
          ? 'bg-slate-900/40 border-white/10'
          : 'bg-white/30 border-white/30'}
      `}
    >
      {/* Header con badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield
            size={16}
            className={dark ? 'text-slate-300' : 'text-slate-600'}
          />
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              dark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            Estado del sistema
          </span>
        </div>

        <span
          className={`
            inline-flex items-center gap-1.5 px-3 py-1 rounded-full
            text-[10px] font-bold uppercase tracking-wider border
            transition-all duration-500 ease-out
            ${badgeState === 'autonomous'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : badgeState === 'syncing'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                : 'bg-orange-500/10 text-orange-600 border-orange-500/30'}
          `}
        >
          <span
            className={`
              w-1.5 h-1.5 rounded-full transition-colors duration-500
              ${badgeState === 'autonomous'
                ? 'bg-emerald-500'
                : badgeState === 'syncing'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-orange-500'}
            `}
          />
          {badgeState === 'autonomous' && 'Sistema Autónomo'}
          {badgeState === 'syncing' && 'Sincronizando...'}
          {badgeState === 'warning' && 'Atención Requerida'}
        </span>
      </div>

      {/* Checks list */}
      <div className="space-y-2.5">
        <CheckRow
          state={checks.swActive}
          label="Motor v5 Activo"
          dark={dark}
        />
        <CheckRow
          state={checks.pdfReady}
          label="Generador de PDFs: Listo"
          dark={dark}
          trailingIcon={<FileCheck size={13} />}
        />
        <CheckRow
          state={checks.expedientesCount !== null ? true : null}
          label={
            checks.expedientesCount === null
              ? 'Expedientes Offline: verificando...'
              : `Expedientes Offline: ${checks.expedientesCount}`
          }
          dark={dark}
          trailingIcon={<Users size={13} />}
        />
      </div>

      {/* Botón refresh */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className={`
          mt-5 w-full inline-flex items-center justify-center gap-2
          px-4 py-2 rounded-xl text-[12px] font-semibold
          border transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${dark
            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            : 'bg-white/40 border-white/40 text-slate-700 hover:bg-white/60'}
        `}
      >
        <RefreshCw
          size={13}
          className={refreshing ? 'animate-spin' : ''}
        />
        {refreshing ? 'Sincronizando...' : 'Refrescar Sincronización'}
      </button>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   Subcomponente: fila de check con transición suave entre estados
   ──────────────────────────────────────────────────────────────── */

interface CheckRowProps {
  state: boolean | null
  label: string
  dark: boolean
  trailingIcon?: React.ReactNode
}

function CheckRow({ state, label, dark, trailingIcon }: CheckRowProps) {
  return (
    <div
      className={`flex items-center gap-2.5 text-[13px] transition-colors duration-300 ${
        dark ? 'text-slate-300' : 'text-slate-600'
      }`}
    >
      {/* Wrapper con key para re-mount en cambio de estado — animate-in */}
      <div
        key={String(state)}
        className="animate-in fade-in duration-300 flex-shrink-0"
      >
        {state === null && (
          <Loader2 size={14} className="animate-spin text-slate-400" />
        )}
        {state === true && (
          <CheckCircle2 size={14} className="text-emerald-500" />
        )}
        {state === false && (
          <AlertCircle size={14} className="text-amber-500" />
        )}
      </div>
      <span className="flex-1">{label}</span>
      {trailingIcon && (
        <span className={dark ? 'text-slate-500' : 'text-slate-400'}>
          {trailingIcon}
        </span>
      )}
    </div>
  )
}
