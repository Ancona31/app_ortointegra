'use client'

import { useState } from 'react'
import { Crown } from 'lucide-react'
import type { ReactElement } from 'react'
import { useToast } from '@/components/ui/Toast'

interface Props {
  clinicaId: string
  esVip: boolean
  onChange: (esVip: boolean) => void
}

export default function VipToggle({ clinicaId, esVip, onChange }: Props): ReactElement {
  const [pending, setPending] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const handleClick = async (): Promise<void> => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/clinicas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clinicaId,
          es_vip_grant: !esVip,
        }),
      })

      const json: unknown = await res.json().catch(() => ({}))
      const obj = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>
      const msg =
        typeof obj.message === 'string'
          ? obj.message
          : typeof obj.error === 'string'
            ? obj.error
            : 'Error desconocido'

      if (res.ok) {
        onChange(!esVip)
        return
      }

      if (res.status === 409) {
        setError(msg)
        toast.warning(msg)
        return
      }

      setError(msg)
      toast.error(`Error: ${msg}`)
    } catch {
      const networkMsg = 'Error de red. Intenta de nuevo.'
      setError(networkMsg)
      toast.error(networkMsg)
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
