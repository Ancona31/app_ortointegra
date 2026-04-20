'use client'

import { useState } from 'react'
import { Save, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Calculadora, ResultadoInterpretacion } from '@/lib/calculadoras/types'

type Estado = 'idle' | 'saving' | 'saved' | 'error'

type Props = {
  pacienteId: string
  calculadora: Calculadora
  inputs: Record<string, unknown>
  resultado: ResultadoInterpretacion
}

export default function GuardarExpedienteBtn({ pacienteId, calculadora, inputs, resultado }: Props) {
  const { profile } = useProfile()
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function handleGuardar() {
    if (estado === 'saving' || estado === 'saved') return
    if (!profile?.id || !profile?.clinica_id) {
      setEstado('error')
      setMensaje('No se pudo identificar al médico o la clínica.')
      return
    }

    setEstado('saving')
    setMensaje(null)
    const supabase = createClient()
    const { error } = await supabase.from('calculadora_resultados').insert({
      paciente_id: pacienteId,
      medico_id: profile.id,
      clinica_id: profile.clinica_id,
      calculadora_slug: calculadora.slug,
      calculadora_nombre: calculadora.nombre,
      inputs,
      resultado,
    })

    if (error) {
      setEstado('error')
      setMensaje(error.message || 'Error al guardar.')
      return
    }

    setEstado('saved')
    setTimeout(() => {
      setEstado('idle')
      setMensaje(null)
    }, 3000)
  }

  const saved = estado === 'saved'
  const saving = estado === 'saving'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGuardar}
        disabled={saving || saved}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[15px] text-white transition-all duration-200 disabled:cursor-default active:scale-[0.98]"
        style={{
          background: saved ? '#16a34a' : 'var(--cp)',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: saved
            ? '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(22,163,74,0.25)'
            : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px color-mix(in srgb, var(--cp) 25%, transparent)',
        }}
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
        {saved && <Check size={16} />}
        {!saving && !saved && <Save size={16} />}
        <span>
          {saving ? 'Guardando…' : saved ? 'Guardado en expediente' : 'Guardar en expediente'}
        </span>
      </button>
      {estado === 'error' && mensaje && (
        <p className="text-xs text-red-600 text-center">{mensaje}</p>
      )}
    </div>
  )
}
