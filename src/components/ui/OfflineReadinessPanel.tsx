'use client'

/**
 * OfflineReadinessPanel — panel de estado del sistema offline-first.
 *
 * Verifica 4 dimensiones críticas:
 *  1. Motor: Service Worker v5.1 activo + caché spinus-v5.1 presente
 *  2. Generador PDF: LOGO_BASE64 + ROBOTO_FONTS cargables via dynamic import
 *  3. Expedientes: conteo de pacientes en secureStorage
 *  4. Formularios críticos: los 8 formularios cacheados y listos
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
  FileText,
  HardDrive,
} from 'lucide-react'
import { secureStorage } from '@/lib/secureStorage'
import {
  isStoragePersistent,
  isPersistenceReliable,
  getStorageQuota,
  type StorageQuotaReport,
} from '@/lib/storage-vault'
import { getOutboxStats } from '@/lib/outbox-engine'

/**
 * Detecta dinámicamente el cache actual del Service Worker.
 * El nombre incluye el BUILD_ID de Vercel (ej: 'spinus-abc123def456'),
 * así que lo buscamos por prefijo en lugar de hardcodearlo.
 * Excluye el cache de fuentes PDF que es permanente.
 */
async function findSpinusCache(): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null
    const keys = await caches.keys()
    return keys.find(k =>
      k.startsWith('spinus-') && k !== 'spinus-pdf-fonts-v1'
    ) ?? null
  } catch {
    return null
  }
}

/** Rutas críticas que DEBEN estar precacheadas desde la primera visita.
 *  Sincronizado con PRECACHE de sw.js/route.ts */
const CRITICAL_ROUTES = [
  '/inicio',
  '/dashboard',
  '/agenda',
  '/estadisticas',
  '/documentos',
  '/pacientes',
  '/pacientes/nuevo',
  '/expediente',
  '/expediente/_',
  '/expediente/_/nueva-nota',
  '/expediente/_/editar',
  '/expediente/_/documentos',
  '/expediente/_/laboratorios/nuevo',
  '/expediente/_/laboratorios/_',
  '/expediente/_/consulta/_',
  '/suplementacion',
]

/** Los 8 formularios críticos que deben estar cacheados para modo offline */
const CRITICAL_FORMS = [
  () => import('@/components/documentos/RecetaForm'),
  () => import('@/components/documentos/SolicitudLabForm'),
  () => import('@/components/documentos/SolicitudImagenForm'),
  () => import('@/components/documentos/EscritoMedicoForm'),
  () => import('@/components/documentos/ConsentimientoInformadoForm'),
  () => import('@/components/documentos/SolicitudInternamientoForm'),
  () => import('@/components/documentos/NotaHonorariosForm'),
  () => import('@/components/documentos/PlanSuplementacionForm'),
]

interface ChecksState {
  /** null = verificando, true = OK, false = falla */
  swActive: boolean | null
  pdfReady: boolean | null
  /** null = verificando, número = cantidad real */
  expedientesCount: number | null
  /** null = verificando, true = 8/8 listos, false = alguno falló */
  formsReady: boolean | null
  /** null = verificando, número = rutas cacheadas / total */
  routesCached: { ready: number; total: number } | null
  /** null = verificando, número = chunks JS cacheados */
  chunksCached: { ready: number; threshold: number } | null
  /** null = verificando, true = persistente+confiable, false = volátil/unreliable (INFORMATIVO) */
  storageReliable: boolean | null
  /** null = verificando, reporte de cuota del origen (INFORMATIVO) */
  storageQuota: StorageQuotaReport | null
  /** null = verificando, número de items en la Dead Letter Queue (INFORMATIVO) */
  deadLetterCount: number | null
}

/** Umbral mínimo de chunks para considerar el sistema blindado */
const CHUNKS_THRESHOLD = 20

/** Formatea bytes a string legible: 1234 → "1.2 KB" */
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
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
    formsReady: null,
    routesCached: null,
    chunksCached: null,
    storageReliable: null,
    storageQuota: null,
    deadLetterCount: null,
  })
  const [refreshing, setRefreshing] = useState(false)
  const { mutate } = useSWRConfig()

  /** Ejecuta los 4 chequeos en paralelo */
  const runChecks = useCallback(async () => {
    // Resolver el nombre del cache actual (incluye BUILD_ID del deploy)
    const cacheName = await findSpinusCache()

    // ── 1. Motor activo — controller + cache del deploy actual ──
    let swActive = false
    try {
      if (typeof navigator !== 'undefined') {
        const hasController = !!navigator.serviceWorker?.controller
        swActive = hasController && cacheName !== null
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

    // ── 4. Rutas críticas — verificar las 16 rutas del PRECACHE ──
    let routesCached: { ready: number; total: number } = {
      ready: 0,
      total: CRITICAL_ROUTES.length,
    }
    try {
      if (typeof caches !== 'undefined' && cacheName) {
        const cache = await caches.open(cacheName)
        const matches = await Promise.all(
          CRITICAL_ROUTES.map(route => cache.match(route, { ignoreSearch: true }))
        )
        routesCached = {
          ready: matches.filter(Boolean).length,
          total: CRITICAL_ROUTES.length,
        }
      }
    } catch {
      routesCached = { ready: 0, total: CRITICAL_ROUTES.length }
    }

    // ── 5. Formularios críticos — los 8 dynamic imports ──
    let formsReady = false
    try {
      // Intentar importar los 8 formularios — si algún chunk no está
      // cacheado, el SW lo descargará ahora (warm-up adicional)
      await Promise.all(CRITICAL_FORMS.map(loader => loader()))
      formsReady = true
    } catch {
      formsReady = false
    }

    // ── 6. Chunks JS precacheados — contar /_next/static/chunks/ en el cache ──
    let chunksCached: { ready: number; threshold: number } = {
      ready: 0,
      threshold: CHUNKS_THRESHOLD,
    }
    try {
      if (cacheName) {
        const cache = await caches.open(cacheName)
        const keys = await cache.keys()
        const chunkCount = keys.filter(req => {
          try {
            const u = new URL(req.url)
            return (
              u.pathname.startsWith('/_next/static/chunks/') ||
              /\/_next\/static\/.*\.(js|css)$/.test(u.pathname)
            )
          } catch {
            return false
          }
        }).length
        chunksCached = { ready: chunkCount, threshold: CHUNKS_THRESHOLD }
      }
    } catch {
      chunksCached = { ready: 0, threshold: CHUNKS_THRESHOLD }
    }

    // ── 7. Persistencia de storage (INFORMATIVO — no bloquea badge) ──
    let storageReliable = false
    let storageQuota: StorageQuotaReport | null = null
    try {
      const reliable = isPersistenceReliable()
      const persistent = await isStoragePersistent()
      storageReliable = reliable && persistent
      storageQuota = await getStorageQuota()
    } catch {
      storageReliable = false
      storageQuota = null
    }

    // ── 8. Dead Letter Queue count (INFORMATIVO — no bloquea badge) ──
    let deadLetterCount = 0
    try {
      const stats = await getOutboxStats()
      deadLetterCount = stats.failed
    } catch {
      deadLetterCount = 0
    }

    setChecks({
      swActive,
      pdfReady,
      expedientesCount,
      formsReady,
      routesCached,
      chunksCached,
      storageReliable,
      storageQuota,
      deadLetterCount,
    })
  }, [])

  // Mount + chequeos iniciales con retry escalonado
  useEffect(() => {
    setMounted(true)
    runChecks()

    // Retry durante los primeros 5s para dar tiempo al SW de activarse,
    // a precachePatients de poblar el cache y al warm-up de formularios
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
          relative z-[2] rounded-2xl border p-5 h-[410px]
          backdrop-blur-md shadow-lg
          ${dark
            ? 'bg-slate-900/40 border-white/10'
            : 'bg-white/30 border-white/30'}
        `}
        aria-hidden="true"
      />
    )
  }

  // Estado global derivado — Sistema Autónomo requiere los 6 checks verdes
  const routesAllCached =
    checks.routesCached !== null &&
    checks.routesCached.ready === checks.routesCached.total

  const chunksOk =
    checks.chunksCached !== null &&
    checks.chunksCached.ready >= checks.chunksCached.threshold

  const anyChecking =
    checks.swActive === null ||
    checks.pdfReady === null ||
    checks.expedientesCount === null ||
    checks.formsReady === null ||
    checks.routesCached === null ||
    checks.chunksCached === null

  const anyFailed =
    checks.swActive === false ||
    checks.pdfReady === false ||
    checks.formsReady === false ||
    (checks.routesCached !== null && !routesAllCached) ||
    (checks.chunksCached !== null && !chunksOk)

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

      {/* Checks list — 5 verificaciones */}
      <div className="space-y-2.5">
        <CheckRow
          state={checks.swActive}
          label="Motor Activo"
          dark={dark}
        />
        <CheckRow
          state={checks.pdfReady}
          label="Generador de PDFs: Listo"
          dark={dark}
          trailingIcon={<FileCheck size={13} />}
        />
        <CheckRow
          state={
            checks.routesCached === null
              ? null
              : routesAllCached
          }
          label={
            checks.routesCached === null
              ? 'Rutas precacheadas: verificando...'
              : routesAllCached
                ? `Rutas precacheadas: ${checks.routesCached.total}/${checks.routesCached.total} listas`
                : `Rutas NO disponibles: ${checks.routesCached.total - checks.routesCached.ready} de ${checks.routesCached.total} faltan`
          }
          dark={dark}
          trailingIcon={<FileText size={13} />}
        />
        <CheckRow
          state={checks.formsReady}
          label="Formularios críticos: 8/8 listos"
          dark={dark}
          trailingIcon={<FileText size={13} />}
        />
        <CheckRow
          state={
            checks.chunksCached === null
              ? null
              : chunksOk
          }
          label={
            checks.chunksCached === null
              ? 'Chunks JS: verificando...'
              : chunksOk
                ? `Chunks JS: ${checks.chunksCached.ready} blindados`
                : `Chunks JS: solo ${checks.chunksCached.ready}, insuficiente`
          }
          dark={dark}
          trailingIcon={<FileCheck size={13} />}
        />
        {/* ── Fila INFORMATIVA: persistencia de storage (no bloquea badge) ── */}
        <CheckRow
          state={
            checks.storageReliable === null
              ? null
              : checks.storageReliable
          }
          label={
            checks.storageReliable === null
              ? 'Persistencia: verificando...'
              : checks.storageReliable
                ? 'Almacenamiento persistente'
                : 'Almacenamiento volátil (informativo)'
          }
          dark={dark}
          trailingIcon={<Shield size={13} />}
        />
        {/* ── Fila INFORMATIVA: cuota de storage (solo si API disponible) ── */}
        {checks.storageQuota && checks.storageQuota.totalQuota > 0 && (
          <CheckRow
            state={true}
            label={`Espacio: ${formatBytes(checks.storageQuota.totalUsed)} / ${formatBytes(checks.storageQuota.totalQuota)} (${checks.storageQuota.percentUsed.toFixed(1)}%)`}
            dark={dark}
            trailingIcon={<HardDrive size={13} />}
          />
        )}
        {/* ── Fila INFORMATIVA: DLQ count (solo si hay items fallados) ── */}
        {checks.deadLetterCount !== null && checks.deadLetterCount > 0 && (
          <CheckRow
            state={false}
            label={`${checks.deadLetterCount} item${checks.deadLetterCount > 1 ? 's' : ''} con error permanente`}
            dark={dark}
            trailingIcon={<AlertCircle size={13} />}
          />
        )}
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
