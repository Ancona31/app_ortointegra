'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Ruler, Stethoscope } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { calcularEdad } from '@/lib/patientUtils'
import type { Paciente } from '@/types'

import DashboardHero from '@/components/expediente/dashboard/DashboardHero'
import DashboardCard from '@/components/expediente/dashboard/DashboardCard'
import CardContentDatos from '@/components/expediente/dashboard/CardContentDatos'
import CardContentAntecedentes from '@/components/expediente/dashboard/CardContentAntecedentes'

const SEXO_LABEL: Record<Paciente['sexo'], string> = {
  M: 'Masculino',
  F: 'Femenino',
  Otro: 'Otro',
}

export default function EstadoPacientePage() {
  const { id } = useParams<{ id: string }>()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .single()
      .then((res: { data: Paciente | null; error: unknown }) => {
        if (cancelled) return
        if (res.error || !res.data) setError(true)
        else setPaciente(res.data)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-3 w-40 bg-slate-100 rounded mb-6 animate-pulse" />
        <div className="h-10 w-72 bg-slate-100 rounded mb-2 animate-pulse" />
        <div className="h-4 w-56 bg-slate-100 rounded mb-8 animate-pulse" />
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !paciente) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center">
        <p className="text-sm text-slate-500 mb-3">No se pudo cargar el paciente.</p>
        <Link href="/expediente" className="text-sm text-[#1e5fa8] hover:underline">
          Volver a pacientes
        </Link>
      </div>
    )
  }

  const nombreCompleto = `${paciente.nombre} ${paciente.apellidos}`.trim()
  const edad = paciente.fecha_nacimiento
    ? calcularEdad(paciente.fecha_nacimiento).anios
    : null
  const sexoLabel = SEXO_LABEL[paciente.sexo]
  const expediente = paciente.numero_expediente ?? '—'

  return (
    <div className="max-w-6xl mx-auto">
      <nav className="flex items-center gap-1 text-xs text-slate-500 mb-6">
        <ArrowLeft size={12} className="mr-1 text-slate-400" />
        <Link href="/expediente" className="hover:text-slate-700 transition-colors duration-200 ease-out">
          Pacientes
        </Link>
        <span className="text-slate-300 mx-1">›</span>
        <Link href={`/expediente/${id}`} className="hover:text-slate-700 transition-colors duration-200 ease-out">
          {nombreCompleto}
        </Link>
        <span className="text-slate-300 mx-1">›</span>
        <span className="text-slate-700 font-medium">Estado</span>
      </nav>

      <DashboardHero
        nombre={nombreCompleto}
        edad={edad}
        sexo={sexoLabel}
        expediente={expediente}
      />

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <DashboardCard icon={Ruler} iconColor="#af52de" title="Datos antropométricos" summary="Peso, talla, IMC, contacto">
          <CardContentDatos paciente={paciente} />
        </DashboardCard>
        <DashboardCard icon={Stethoscope} iconColor="var(--cp)" title="Antecedentes médicos" summary="Historial clínico">
          <CardContentAntecedentes paciente={paciente} />
        </DashboardCard>
      </div>
    </div>
  )
}
