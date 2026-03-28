'use client'

import { useEffect, useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import {
  BarChart2, Building2, Users, UserCheck, FileText,
  Stethoscope, Brain, Loader2, RefreshCw, TrendingUp,
} from 'lucide-react'

type Resumen = {
  total_clinicas: number
  total_medicos: number
  total_pacientes: number
  total_consultas: number
  total_documentos: number
  total_ia_calls: number
}

type ClinicaMetrica = {
  id: string
  nombre: string
  medicos: number
  secretarias: number
  pacientes: number
  consultas: number
  documentos: number
  ia_calls: number
}

type UsuarioMetrica = {
  id: string
  nombre: string
  clinica: string
  role: string
  pacientes: number
  consultas: number
  documentos: number
  ia_nota_medica: number
  ia_consulta_rapida: number
  ia_labs_extract: number
  ia_total: number
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  medico: 'Médico',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export default function MetricasPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [data, setData] = useState<{ resumen: Resumen; clinicas: ClinicaMetrica[]; usuarios: UsuarioMetrica[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'clinicas' | 'usuarios'>('clinicas')

  useEffect(() => {
    if (!loadingProfile && profile?.role !== 'super_admin') router.push('/dashboard')
  }, [profile, loadingProfile, router])

  async function cargar() {
    setLoading(true)
    const res = await fetch('/api/super-admin/metricas')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  if (loadingProfile || loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-slate-300" />
    </div>
  )

  if (!data) return (
    <div className="text-center text-slate-400 py-16">Error cargando métricas.</div>
  )

  const { resumen, clinicas, usuarios } = data

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 size={24} className="text-[#1a3a5c]" />
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Métricas</h1>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Building2}    label="Clínicas"     value={resumen.total_clinicas}   color="bg-indigo-500" />
        <StatCard icon={UserCheck}    label="Médicos"      value={resumen.total_medicos}     color="bg-blue-500" />
        <StatCard icon={Users}        label="Pacientes"    value={resumen.total_pacientes}   color="bg-violet-500" />
        <StatCard icon={Stethoscope}  label="Consultas"    value={resumen.total_consultas}   color="bg-teal-500" />
        <StatCard icon={FileText}     label="Documentos"   value={resumen.total_documentos}  color="bg-amber-500" />
        <StatCard icon={Brain}        label="Llamadas IA"  value={resumen.total_ia_calls}    color="bg-rose-500" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('clinicas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'clinicas' ? 'border-[#1e5fa8] text-[#1e5fa8]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Por clínica
        </button>
        <button
          onClick={() => setTab('usuarios')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'usuarios' ? 'border-[#1e5fa8] text-[#1e5fa8]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Por usuario
        </button>
      </div>

      {/* Tabla clínicas */}
      {tab === 'clinicas' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clínica</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Médicos</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Secretarias</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pacientes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Consultas</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Documentos</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">IA calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clinicas.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-400 py-8">Sin clínicas registradas</td></tr>
              ) : clinicas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.medicos}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.secretarias}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.pacientes}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.consultas}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.documentos}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.ia_calls > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Brain size={10} />
                      {c.ia_calls}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {clinicas.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
                  <td className="px-4 py-3 text-xs uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3 text-center">{clinicas.reduce((s, c) => s + c.medicos, 0)}</td>
                  <td className="px-4 py-3 text-center">{clinicas.reduce((s, c) => s + c.secretarias, 0)}</td>
                  <td className="px-4 py-3 text-center">{clinicas.reduce((s, c) => s + c.pacientes, 0)}</td>
                  <td className="px-4 py-3 text-center">{clinicas.reduce((s, c) => s + c.consultas, 0)}</td>
                  <td className="px-4 py-3 text-center">{clinicas.reduce((s, c) => s + c.documentos, 0)}</td>
                  <td className="px-4 py-3 text-center">{clinicas.reduce((s, c) => s + c.ia_calls, 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Tabla usuarios */}
      {tab === 'usuarios' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clínica</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pacientes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Consultas</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Documentos</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                  <span className="flex items-center justify-center gap-1"><Brain size={10} /> Nota</span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                  <span className="flex items-center justify-center gap-1"><Brain size={10} /> Consulta</span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                  <span className="flex items-center justify-center gap-1"><Brain size={10} /> Labs</span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <TrendingUp size={12} className="inline" /> Total IA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-slate-400 py-8">Sin usuarios registrados</td></tr>
              ) : usuarios.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{u.nombre}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{ROLE_LABELS[u.role] ?? u.role}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.clinica}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{u.pacientes}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{u.consultas}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{u.documentos}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{u.ia_nota_medica}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{u.ia_consulta_rapida}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{u.ia_labs_extract}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${u.ia_total > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                      {u.ia_total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
