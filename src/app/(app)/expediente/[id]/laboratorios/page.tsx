'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useAuditAccess } from '@/hooks/useAudit'
import { useStatsLabs } from '@/hooks/useStatsLabs'
import type { Paciente } from '@/types'

import HeroLabs from '@/components/labs/HeroLabs'
import SeccionDocumentosLabs from '@/components/labs/SeccionDocumentosLabs'
import SeccionMedicionesLabs from '@/components/labs/SeccionMedicionesLabs'

function LaboratoriosContent() {
  const { id } = useParams<{ id: string }>()
  const { isDoctor } = useProfile()
  useAuditAccess('pacientes', id)

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loadingPaciente, setLoadingPaciente] = useState(true)

  const { stats, isLoading: isStatsLoading } = useStatsLabs(id)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    supabase.from('pacientes').select('*').eq('id', id).single()
      .then((res: { data: Paciente | null; error: unknown }) => {
        if (cancelled) return
        if (!res.error && res.data) setPaciente(res.data)
        setLoadingPaciente(false)
      })

    return () => { cancelled = true }
  }, [id])

  if (loadingPaciente) {
    return <div className="text-center py-12 text-slate-400">Cargando expediente...</div>
  }
  if (!paciente) {
    return <div className="text-center py-12 text-slate-400">Paciente no encontrado</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      <HeroLabs
        paciente={paciente}
        stats={stats}
        isStatsLoading={isStatsLoading}
        isDoctor={isDoctor}
        onEditar={() => console.log('TODO: placeholder hasta integrar edit flow')}
        onExportar={() => console.log('TODO: placeholder hasta integrar export flow')}
      />

      <SeccionDocumentosLabs pacienteId={id} />

      <SeccionMedicionesLabs pacienteId={id} sexoPaciente={paciente.sexo} />
    </div>
  )
}

export default function LaboratoriosPage() {
  return (
    <Suspense>
      <LaboratoriosContent />
    </Suspense>
  )
}
