'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta } from '@/types'
import { differenceInYears, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Plus, Stethoscope, Calendar, ChevronRight, User } from 'lucide-react'
import Link from 'next/link'

export default function ExpedientePacientePage() {
  const { id } = useParams<{ id: string }>()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase.from('consultas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
      ])
      setPaciente(p)
      setConsultas(c || [])
      setLoading(false)
    }
    cargar()
  }, [id])

  if (loading) return <div className="text-center py-12 text-slate-400">Cargando expediente...</div>
  if (!paciente) return <div className="text-center py-12 text-slate-400">Paciente no encontrado</div>

  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/expediente" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
          <Stethoscope size={24} /> Expediente Clínico
        </h1>
      </div>

      {/* Datos del paciente */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-[#1a3a5c] px-6 py-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
            {paciente.nombre.charAt(0)}{paciente.apellidos.charAt(0)}
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">{paciente.nombre} {paciente.apellidos}</h2>
            <p className="text-blue-200 text-sm">
              {edad !== null && `${edad} años · `}
              {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : 'Otro'}
              {paciente.numero_expediente && ` · Exp. ${paciente.numero_expediente}`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
          {[
            { label: 'Peso', value: paciente.peso_kg ? `${paciente.peso_kg} kg` : '—' },
            { label: 'Talla', value: paciente.talla_cm ? `${paciente.talla_cm} cm` : '—' },
            { label: 'IMC', value: paciente.imc ? `${paciente.imc} kg/m²` : '—' },
            { label: 'Teléfono', value: paciente.telefono || '—' },
          ].map(item => (
            <div key={item.label} className="px-4 py-3">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="text-sm font-medium text-slate-700 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
        {(paciente.ant_patologicos || paciente.alergias || paciente.medicamentos_actuales) && (
          <div className="px-5 py-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {paciente.ant_patologicos && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Antecedentes patológicos</p>
                <p className="text-sm text-slate-600">{paciente.ant_patologicos}</p>
              </div>
            )}
            {paciente.alergias && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Alergias</p>
                <p className="text-sm text-red-600 font-medium">{paciente.alergias}</p>
              </div>
            )}
            {paciente.medicamentos_actuales && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Medicamentos actuales</p>
                <p className="text-sm text-slate-600">{paciente.medicamentos_actuales}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Consultas */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">Historial de consultas</h3>
        <Link
          href={`/expediente/${id}/nueva-nota`}
          className="flex items-center gap-2 bg-[#1e5fa8] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors"
        >
          <Plus size={16} /> Nueva nota del día
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {consultas.length === 0 ? (
          <div className="p-10 text-center">
            <Calendar size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Sin consultas registradas</p>
            <Link href={`/expediente/${id}/nueva-nota`} className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">
              Crear primera nota →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {consultas.map(c => (
              <Link
                key={c.id}
                href={`/expediente/${id}/consulta/${c.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700">
                    <Stethoscope size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">
                      {c.motivo_consulta}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(parseISO(c.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-[#1e5fa8]" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
