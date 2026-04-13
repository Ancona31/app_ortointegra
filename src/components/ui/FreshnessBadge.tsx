'use client'

/**
 * FreshnessBadge — Indicador visual discreto del origen de los datos.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Consume el estado de `useHybridQuery` y muestra un pill pequeño con
 * 3 variantes de color:
 *
 *   🟢 Verde   — Datos recién bajados de Supabase (< 5 min)
 *   🟡 Ámbar   — Datos locales relativamente frescos (< 1 h)
 *   ⚪ Gris    — Datos locales antiguos (≥ 1 h) o sin datos
 *
 * Auto-tick interno: re-renderiza cada 30s para que el texto relativo
 * ("hace 2m" → "hace 3m") se mantenga vivo sin depender del parent.
 *
 * Integración:
 *   ```tsx
 *   const q = useHybridQuery<PacienteLocal[]>({...})
 *   <FreshnessBadge state={q} />
 *   ```
 *
 * Tamaño: text-[10px] + px-2 py-0.5 — lo más pequeño posible para
 * integrarse junto al título de una página sin competir con la UI.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, CloudOff } from 'lucide-react'
import type { HybridSource } from '@/hooks/useHybridQuery'

export interface FreshnessBadgeProps {
  state: {
    source: HybridSource
    isFresh: boolean
    lastSyncAt: number | null
  }
  className?: string
}

interface BadgeVisual {
  Icon: typeof CheckCircle2
  container: string
  label: string
}

/** Convierte un delta en ms a un string corto en español */
function ageToRelative(ageMs: number): string {
  if (ageMs < 60_000) return 'ahora'
  const mins = Math.floor(ageMs / 60_000)
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

function resolveVisual(
  source: HybridSource,
  isFresh: boolean,
  lastSyncAt: number | null,
  now: number,
): BadgeVisual {
  // Sin datos
  if (source === 'none' || lastSyncAt === null) {
    return {
      Icon: CloudOff,
      container: 'bg-slate-50 text-slate-500 border-slate-200',
      label: 'Sin datos',
    }
  }

  const age = now - lastSyncAt

  // Verde: remote fresco (<5 min)
  if (source === 'remote' && isFresh && age < 5 * 60_000) {
    return {
      Icon: CheckCircle2,
      container: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: age < 60_000 ? 'Actualizado ahora' : `Actualizado ${ageToRelative(age)}`,
    }
  }

  // Ámbar: local fresco (<1h)
  if (age < 60 * 60_000) {
    return {
      Icon: Clock,
      container: 'bg-amber-50 text-amber-700 border-amber-200',
      label: `Datos locales · ${ageToRelative(age)}`,
    }
  }

  // Gris: local viejo (≥1h)
  return {
    Icon: CloudOff,
    container: 'bg-slate-50 text-slate-500 border-slate-200',
    label: `Datos locales · ${ageToRelative(age)}`,
  }
}

export default function FreshnessBadge({ state, className = '' }: FreshnessBadgeProps) {
  // Auto-tick: fuerza re-render cada 30s para refrescar el texto relativo.
  // El valor del tick no se usa — solo el setState dispara el re-render
  // que re-computa Date.now() dentro del render.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const { Icon, container, label } = resolveVisual(
    state.source,
    state.isFresh,
    state.lastSyncAt,
    Date.now(),
  )

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap ${container} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon size={10} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
