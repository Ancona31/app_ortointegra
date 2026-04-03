'use client'

import { useEffect, useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, Stethoscope, Pill, Users, RefreshCw, Loader2 } from 'lucide-react'

type Datos = {
  consultasPorMes: { mes: string; total: number }[]
  topDiagnosticos: { nombre: string; total: number }[]
  topMedicamentos: { nombre: string; total: number }[]
  distribucionSexo: { nombre: string; total: number; color: string }[]
  distribucionEdad: { rango: string; total: number }[]
}

const CP = '#1e5fa8'
const CS = '#1a3a5c'

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon size={14} className="text-[#1e5fa8]" />
        </div>
        <h2 className="text-sm font-semibold text-[#1d1d1f]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-center text-[#86868b] text-sm py-8">Sin datos suficientes aún</p>
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-[#3d3d3f]">{label}</p>
      <p className="text-[#1e5fa8] font-bold mt-0.5">{payload[0].value} {payload[0].value === 1 ? 'vez' : 'veces'}</p>
    </div>
  )
}

export default function EstadisticasPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!loadingProfile && profile?.role === 'secretaria') router.push('/dashboard')
  }, [profile, loadingProfile, router])

  async function cargar(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const res = await fetch('/api/me/estadisticas')
    if (res.ok) setDatos(await res.json())
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { cargar() }, [])

  if (loadingProfile || loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin text-slate-300" />
    </div>
  )

  if (!datos) return (
    <div className="text-center text-[#86868b] py-16 text-sm">Error cargando estadísticas.</div>
  )

  const { consultasPorMes, topDiagnosticos, topMedicamentos, distribucionSexo, distribucionEdad } = datos
  const totalPacientes = distribucionSexo.reduce((s, d) => s + d.total, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-slide-up">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Clínica</p>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Estadísticas clínicas</h1>
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

      {/* Consultas por mes */}
      <SectionCard title="Consultas por mes — últimos 6 meses" icon={TrendingUp}>
        {consultasPorMes.every(c => c.total === 0) ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={consultasPorMes} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#86868b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#86868b' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke={CP}
                strokeWidth={2.5}
                dot={{ fill: CP, r: 4 }}
                activeDot={{ r: 6, fill: CP }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Top diagnósticos + Medicamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Top 10 diagnósticos" icon={Stethoscope}>
          {topDiagnosticos.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDiagnosticos} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#86868b' }} allowDecimals={false} />
                <YAxis
                  type="category" dataKey="nombre" width={140}
                  tick={{ fontSize: 10, fill: '#3d3d3f' }}
                  tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                />
                <Tooltip formatter={(value) => [value, 'consultas']} labelStyle={{ color: '#1d1d1f', fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="total" fill={CP} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Top 10 medicamentos recetados" icon={Pill}>
          {topMedicamentos.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topMedicamentos} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#86868b' }} allowDecimals={false} />
                <YAxis
                  type="category" dataKey="nombre" width={140}
                  tick={{ fontSize: 10, fill: '#3d3d3f' }}
                  tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                />
                <Tooltip formatter={(value) => [value, 'recetas']} labelStyle={{ color: '#1d1d1f', fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="total" fill="#7c3aed" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Demografía */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title={`Distribución por sexo — ${totalPacientes} pacientes`} icon={Users}>
          {totalPacientes === 0 ? <Empty /> : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={distribucionSexo} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="total">
                    {distribucionSexo.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'pacientes']} contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {distribucionSexo.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#1d1d1f]">{s.nombre}</p>
                      <p className="text-[10px] text-[#86868b]">
                        {s.total} · {totalPacientes > 0 ? Math.round(s.total / totalPacientes * 100) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Distribución por grupo de edad" icon={Users}>
          {distribucionEdad.every(e => e.total === 0) ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribucionEdad} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="rango" tick={{ fontSize: 11, fill: '#86868b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#86868b' }} allowDecimals={false} />
                <Tooltip formatter={(value) => [value, 'pacientes']} contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="total" fill={CS} radius={[5, 5, 0, 0]}>
                  {distribucionEdad.map((_, i) => (
                    <Cell key={i} fill={`hsl(${210 + i * 8}, 60%, ${45 + i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

    </div>
  )
}
