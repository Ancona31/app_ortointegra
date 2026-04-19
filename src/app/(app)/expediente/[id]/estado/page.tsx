'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Ruler, Stethoscope, FlaskConical, BarChart3 } from 'lucide-react'

import DashboardHero from '@/components/expediente/dashboard/DashboardHero'
import DashboardCard from '@/components/expediente/dashboard/DashboardCard'

// TODO: conectar con Supabase en siguiente sesión
const PACIENTE_MOCK = {
  nombre: 'Angel Ancona',
  edad: 35,
  sexo: 'Masculino',
  expediente: '2026-0025',
}

export default function EstadoPacientePage() {
  const { id } = useParams<{ id: string }>()
  const { nombre, edad, sexo, expediente } = PACIENTE_MOCK

  return (
    <div className="max-w-6xl mx-auto">
      <nav className="flex items-center gap-1 text-xs text-slate-500 mb-6">
        <ArrowLeft size={12} className="mr-1 text-slate-400" />
        <Link
          href="/expediente"
          className="hover:text-slate-700 transition-colors duration-200 ease-out"
        >
          Pacientes
        </Link>
        <span className="text-slate-300 mx-1">›</span>
        <Link
          href={`/expediente/${id}`}
          className="hover:text-slate-700 transition-colors duration-200 ease-out"
        >
          {nombre}
        </Link>
        <span className="text-slate-300 mx-1">›</span>
        <span className="text-slate-700 font-medium">Estado</span>
      </nav>

      <DashboardHero
        nombre={nombre}
        edad={edad}
        sexo={sexo}
        expediente={expediente}
      />

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <DashboardCard
          icon={Ruler}
          iconColor="#af52de"
          title="Datos antropométricos"
          summary="Peso, talla, IMC, contacto"
        />
        <DashboardCard
          icon={Stethoscope}
          iconColor="var(--cp)"
          title="Antecedentes médicos"
          summary="Historial clínico"
        />
        <DashboardCard
          icon={FlaskConical}
          iconColor="#14b8a6"
          title="Laboratorios"
          summary="Estudios y resultados"
        />
        <DashboardCard
          icon={BarChart3}
          iconColor="#6366f1"
          title="Gráficas de evolución"
          summary="Tendencias de analitos"
        />
      </div>
    </div>
  )
}
