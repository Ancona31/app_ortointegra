'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PacienteContexto } from '@/lib/calculadoras/types'

export function useCalculadoraContextual(pacienteId: string | null) {
  const [paciente, setPaciente] = useState<PacienteContexto | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pacienteId) {
      setPaciente(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const supabase = createClient()

    supabase
      .from('pacientes')
      .select('id, nombre, apellidos, sexo, fecha_nacimiento, peso_kg, talla_cm')
      .eq('id', pacienteId)
      .single()
      .then((res: { data: Record<string, unknown> | null }) => {
        if (cancelled) return
        setPaciente((res.data as PacienteContexto | null) ?? null)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [pacienteId])

  return { paciente, loading }
}
