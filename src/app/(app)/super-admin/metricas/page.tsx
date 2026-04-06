'use client'

import { useEffect, useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, UserCheck, FileText,
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

function StatCard({ icon: Icon, label, value, bg, color }: { icon: React.ElementType; label: string; value: number; bg: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className="text-xl font-bold text-[#1d1d1f] tabular-nums">{value.toLocaleString()}</p>
        <p className="text-[11px] text-[#86868b] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  medico: 'Médico',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

const thCls = "text-left px-4 py-3 text-[10px] font-semibold text-[#86868b] uppercase tracking-widest"
const thCenterCls = "text-center px-4 py-3 text-[10px] font-semibold text-[#86868b] uppercase tracking-widest"
const tdCls = "px-4 py-3 text-sm text-[#3d3d3f]"
const tdCenterCls = "px-4 py-3 text-sm text-[#86868b] text-center tabular-nums"

export default function MetricasPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [data, setData] = useState<{ resumen: Resumen; clinicas: ClinicaMetrica[]; usuarios: UsuarioMetrica[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'clinicas' | 'usuarios'>('clinicas')

  useEffect(() => {
    if (!loadingProfile && profile?.role !== 'super_admin') router.push('/dashboard')
  }, [profile, loadingProfile, router])

  async function cargar(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const res = await fetch('/api/super-admin/metricas')
    if (res.ok) setData(await res.json())
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { cargar() }, [])

  if (loadingProfile || loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin text-slate-300" />
    </div>
  )

  if (!data) return (
    <div className="text-center text-[#86868b] py-16 text-sm">Error cargando métricas.</div>
  )

  const { resumen, clinicas, usuarios } = data

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-slide-up">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Super Admin</p>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Métricas del sistema</h1>
        </div>
        <button
          onClick={() => cargar(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#86868b] hover:text-[#3d3d3f] border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Building2}   label="Clínicas"    value={resumen.total_clinicas}   bg="bg-indigo-50"  color="text-indigo-600" />
        <StatCard icon={UserCheck}   label="Médicos"     value={resumen.total_medicos}     bg="bg-blue-50"    color="text-[#1e5fa8]" />
        <StatCard icon={Users}       label="Pacientes"   value={resumen.total_pacientes}   bg="bg-violet-50"  color="text-violet-600" />
        <StatCard icon={Stethoscope} label="Consultas"   value={resumen.total_consultas}   bg="bg-teal-50"    color="text-teal-600" />
        <StatCard icon={FileText}    label="Documentos"  value={resumen.total_documentos}  bg="bg-amber-50"   color="text-amber-600" />
        <StatCard icon={Brain}       label="Llamadas IA" value={resumen.total_ia_calls}    bg="bg-rose-50"    color="text-rose-500" />
      </div>

      {/* Segmented control */}
      <div className="bg-slate-100 p-1 rounded-xl flex gap-0.5 w-fit">
        {(['clinicas', 'usuarios'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
              tab === t ? 'bg-white shadow-sm text-[#1d1d1f] font-semibold' : 'text-[#86868b] hover:text-[#3d3d3f]'
            }`}
          >
            {t === 'clinicas' ? 'Por clínica' : 'Por usuario'}
          </button>
        ))}
      </div>

      {/* Tabla clínicas */}
      {tab === 'clinicas' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={thCls}>Clínica</th>
                <th className={thCenterCls}>Médicos</th>
                <th className={thCenterCls}>Asistentes</th>
                <th className={thCenterCls}>Pacientes</th>
                <th className={thCenterCls}>Consultas</th>
                <th className={thCenterCls}>Docs</th>
                <th className={thCenterCls}>IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clinicas.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-[#86868b] py-10 text-sm">Sin clínicas registradas</td></tr>
              ) : clinicas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className={`${tdCls} font-semibold text-[#1d1d1f]`}>{c.nombre}</td>
                  <td className={tdCenterCls}>{c.medicos}</td>
                  <td className={tdCenterCls}>{c.secretarias}</td>
                  <td className={tdCenterCls}>{c.pacientes}</td>
                  <td className={tdCenterCls}>{c.consultas}</td>
                  <td className={tdCenterCls}>{c.documentos}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.ia_calls > 0 ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-[#86868b]'}`}>
                      <Brain size={9} />{c.ia_calls}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {clinicas.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-100 font-semibold text-[#3d3d3f]">
                  <td className="px-4 py-3 text-xs uppercase tracking-widest text-[#86868b]">Total</td>
                  <td className="px-4 py-3 text-center tabular-nums">{clinicas.reduce((s, c) => s + c.medicos, 0)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{clinicas.reduce((s, c) => s + c.secretarias, 0)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{clinicas.reduce((s, c) => s + c.pacientes, 0)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{clinicas.reduce((s, c) => s + c.consultas, 0)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{clinicas.reduce((s, c) => s + c.documentos, 0)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{clinicas.reduce((s, c) => s + c.ia_calls, 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Tabla usuarios */}
      {tab === 'usuarios' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={thCls}>Usuario</th>
                <th className={thCls}>Clínica</th>
                <th className={thCenterCls}>Pacientes</th>
                <th className={thCenterCls}>Consultas</th>
                <th className={thCenterCls}>Docs</th>
                <th className={thCenterCls}><span className="flex items-center justify-center gap-1"><Brain size={9} /> Nota</span></th>
                <th className={thCenterCls}><span className="flex items-center justify-center gap-1"><Brain size={9} /> Consulta</span></th>
                <th className={thCenterCls}><span className="flex items-center justify-center gap-1"><Brain size={9} /> Labs</span></th>
                <th className={thCenterCls}><TrendingUp size={11} className="inline" /> Total IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-[#86868b] py-10 text-sm">Sin usuarios registrados</td></tr>
              ) : usuarios.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#1d1d1f]">{u.nombre}</p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">{ROLE_LABELS[u.role] ?? u.role}</p>
                  </td>
                  <td className={`${tdCls} text-[#86868b] text-xs`}>{u.clinica}</td>
                  <td className={tdCenterCls}>{u.pacientes}</td>
                  <td className={tdCenterCls}>{u.consultas}</td>
                  <td className={tdCenterCls}>{u.documentos}</td>
                  <td className={tdCenterCls}>{u.ia_nota_medica}</td>
                  <td className={tdCenterCls}>{u.ia_consulta_rapida}</td>
                  <td className={tdCenterCls}>{u.ia_labs_extract}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${u.ia_total > 0 ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-[#86868b]'}`}>
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
