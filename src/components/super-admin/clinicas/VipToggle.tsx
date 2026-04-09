'use client'

import { useState } from 'react'
import { Crown } from 'lucide-react'
import type { ReactElement } from 'react'

interface Props {
  clinicaId: string
  esVip: boolean
  onChange: (esVip: boolean) => void
}

export default function VipToggle({ clinicaId, esVip, onChange }: Props): ReactElement {
  const [pending, setPending] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async (): Promise<void> => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/clinicas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clinicaId,
          // VIP = max_pacientes null (ilimitado); no-VIP = 15 (default original)
          max_pacientes: esVip ? 15 : null,
        }),
      })
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => ({}))
        const msg =
          typeof json === 'object' && json !== null && 'error' in json
            ? String((json as { error: unknown }).error)
            : 'Error al actualizar VIP'
        throw new Error(msg)
      }
      onChange(!esVip)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={error ?? (esVip ? 'Quitar VIP (volver a límite)' : 'Marcar como VIP (ilimitado)')}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10.5px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        esVip
          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-purple-300 hover:border-purple-500/30'
      }`}
    >
      <Crown size={11} />
      VIP
    </button>
  )
}
