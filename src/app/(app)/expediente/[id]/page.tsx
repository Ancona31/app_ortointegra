'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta, Laboratorio, VALORES_REFERENCIA } from '@/types'
import { differenceInYears, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, Plus, Stethoscope, Calendar, ChevronRight,
  FlaskConical, FileText, AlertTriangle, User, Phone, Mail,
  Trash2, Loader2,
} from 'lucide-react'
import Link from 'next/link'

type Tab = 'consultas' | 'laboratorios'

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [labs, setLabs] = useState<Laboratorio[]>([])
  const [tab, setTab] = useState<Tab>('consultas')
  const [loading, setLoading] = useState(true)
  const [eliminandoLab, setEliminandoLab] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('tab') === 'laboratorios') setTab('laboratorios')
  }, [searchParams])

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const [{ data: p }, { data: c }, { data: l }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase.from('consultas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
        supabase.from('laboratorios').select('*').eq('paciente_id', id).order('fecha_toma', { ascending: false }),
      ])
      setPaciente(p)
      setConsultas(c || [])
      setLabs(l || [])
      setLoading(false)
    }
    cargar()
  }, [id])

  async function eliminarLab(labId: string) {
    setEliminandoLab(labId)
    const supabase = createClient()
    await supabase.from('laboratorios').delete().eq('id', labId)
    setLabs(prev => prev.filter(l => l.id !== labId))
    setEliminandoLab(null)
    setConfirmarEliminar(null)
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Cargando expediente...</div>
  if (!paciente) return <div className="text-center py-12 text-slate-400">Paciente no encontrado</div>

  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/expediente" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Expediente Clínico</h1>
      </div>

      {/* Tarjeta del paciente */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="bg-[#1a3a5c] px-6 py-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {paciente.nombre.charAt(0)}{paciente.apellidos.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg leading-tight">{paciente.nombre} {paciente.apellidos}</h2>
            <p className="text-blue-200 text-sm mt-0.5">
              {edad !== null && `${edad} años · `}
              {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : 'Otro'}
              {paciente.numero_expediente && ` · Exp. ${paciente.numero_expediente}`}
            </p>
          </div>
        </div>

        {/* Métricas rápidas */}
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

        {/* Antecedentes relevantes */}
        {(paciente.ant_patologicos || paciente.alergias || paciente.medicamentos_actuales || paciente.ant_quirurgicos) && (
          <div className="px-5 py-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paciente.alergias && (
              <div className="sm:col-span-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-600">Alergias</p>
                  <p className="text-sm text-red-700">{paciente.alergias}</p>
                </div>
              </div>
            )}
            {paciente.ant_patologicos && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Antecedentes patológicos</p>
                <p className="text-sm text-slate-600">{paciente.ant_patologicos}</p>
              </div>
            )}
            {paciente.ant_quirurgicos && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Antecedentes quirúrgicos</p>
                <p className="text-sm text-slate-600">{paciente.ant_quirurgicos}</p>
              </div>
            )}
            {paciente.medicamentos_actuales && (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-400 mb-1">Medicamentos actuales</p>
                <p className="text-sm text-slate-600">{paciente.medicamentos_actuales}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href={`/expediente/${id}/nueva-nota`}
          className="flex flex-col items-center gap-2 p-4 bg-[#1e5fa8] text-white rounded-xl hover:bg-[#1a3a5c] transition-colors text-center"
        >
          <Stethoscope size={20} />
          <span className="text-xs font-medium">Nueva nota</span>
        </Link>
        <Link
          href={`/expediente/${id}/laboratorios/nuevo`}
          className="flex flex-col items-center gap-2 p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-center"
        >
          <FlaskConical size={20} />
          <span className="text-xs font-medium">Agregar resultados de laboratorio</span>
        </Link>
        <Link
          href={`/expediente/${id}/documentos`}
          className="flex flex-col items-center gap-2 p-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-center"
        >
          <FileText size={20} />
          <span className="text-xs font-medium text-center leading-tight">Nueva receta<br/>y Solicitudes</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('consultas')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'consultas'
              ? 'border-[#1e5fa8] text-[#1e5fa8]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Consultas ({consultas.length})
        </button>
        <button
          onClick={() => setTab('laboratorios')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'laboratorios'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Laboratorios ({labs.length})
        </button>
      </div>

      {/* Tab: Consultas */}
      {tab === 'consultas' && (
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
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 flex-shrink-0">
                      <Stethoscope size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">
                        {c.motivo_consulta}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(parseISO(c.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                        {c.proxima_cita && ` · Próxima cita: ${c.proxima_cita}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-[#1e5fa8] flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Labs */}
      {tab === 'laboratorios' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {labs.length === 0 ? (
            <div className="p-10 text-center">
              <FlaskConical size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Sin laboratorios registrados</p>
              <Link href={`/expediente/${id}/laboratorios/nuevo`} className="text-emerald-600 text-sm mt-2 inline-block hover:underline">
                Subir primer laboratorio →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {labs.map(lab => {
                const v = lab.valores || {}
                const alertas = lab.analisis_ia?.alertas?.filter(a => a.tipo === 'critica') || []
                const suplementos = lab.analisis_ia?.suplementos_recomendados?.length || 0
                const totalResultados = lab.resultados?.length || 0
                const alterados = lab.resultados?.filter(r => r.estado === 'bajo' || r.estado === 'alto' || r.estado === 'suboptimo').length || 0
                const valoresMostrar = Object.entries(VALORES_REFERENCIA)
                  .filter(([k]) => v[k] !== undefined)
                  .slice(0, 3)
                const confirmando = confirmarEliminar === lab.id

                return (
                  <div key={lab.id} className="relative">
                    {/* Confirmación eliminar */}
                    {confirmando && (
                      <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between gap-3">
                        <p className="text-sm text-red-700 font-medium">¿Eliminar este laboratorio?</p>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => setConfirmarEliminar(null)}
                            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => eliminarLab(lab.id)}
                            disabled={eliminandoLab === lab.id}
                            className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-1"
                          >
                            {eliminandoLab === lab.id ? <Loader2 size={12} className="animate-spin" /> : null}
                            Sí, eliminar
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center px-5 py-4 hover:bg-slate-50 transition-colors group">
                      <Link href={`/expediente/${id}/laboratorios/${lab.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
                          <FlaskConical size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">
                            {format(parseISO(lab.fecha_toma), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {totalResultados > 0 ? (
                              <span className="text-xs text-slate-500">
                                {totalResultados} parámetros
                                {alterados > 0 && <span className="text-red-600 font-medium"> · {alterados} alterados</span>}
                              </span>
                            ) : (
                              valoresMostrar.map(([k, ref]) => (
                                <span key={k} className="text-xs text-slate-500">
                                  {ref.label}: <span className="font-medium text-slate-700">{v[k]} {ref.unidad}</span>
                                </span>
                              ))
                            )}
                            {totalResultados === 0 && valoresMostrar.length === 0 && (
                              <span className="text-xs text-slate-400">Sin valores registrados</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {alertas.length > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                {alertas.length} alerta{alertas.length > 1 ? 's' : ''} crítica{alertas.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {suplementos > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                {suplementos} suplemento{suplementos > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <button
                          onClick={() => setConfirmarEliminar(confirmando ? null : lab.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ExpedientePacientePage() {
  return (
    <Suspense>
      <ExpedientePacienteContent />
    </Suspense>
  )
}
