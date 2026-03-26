'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Consulta, Laboratorio, VALORES_REFERENCIA } from '@/types'
import { differenceInYears, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, Stethoscope, Calendar, ChevronRight,
  FlaskConical, FileText, AlertTriangle,
  Trash2, Loader2, BarChart2, Activity,
} from 'lucide-react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

type Tab = 'resumen' | 'consultas' | 'laboratorios' | 'graficas'

const COLORES = ['#1e5fa8', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#9333ea', '#c2410c']

// Parámetros que graficamos con sus rangos
const PARAMS_GRAFICA = Object.entries(VALORES_REFERENCIA).map(([key, ref]) => ({
  key,
  label: ref.label,
  unidad: ref.unidad,
  refMin: (ref as any).ref_min,
  refMax: (ref as any).ref_max,
  optMin: (ref as any).opt_min,
  optMax: (ref as any).opt_max,
}))

function GraficaParametro({ labs, paramKey, label, unidad, refMin, refMax, optMin, optMax }: {
  labs: Laboratorio[]
  paramKey: string
  label: string
  unidad: string
  refMin: number | null
  refMax: number | null
  optMin: number | null
  optMax: number | null
}) {
  const puntos = labs
    .filter(l => l.valores?.[paramKey] !== undefined)
    .map(l => ({
      fecha: format(parseISO(l.fecha_toma), 'dd/MM/yy'),
      valor: l.valores![paramKey],
    }))
    .reverse()

  if (puntos.length < 1) return null

  const vals = puntos.map(p => p.valor as number)
  const yMin = Math.min(...vals, refMin ?? Infinity, optMin ?? Infinity) * 0.85
  const yMax = Math.max(...vals, refMax ?? 0, optMax ?? 0) * 1.15

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-700 text-sm">{label}</h3>
          <p className="text-xs text-slate-400">{unidad}</p>
        </div>
        {puntos.length === 1 && (
          <span className="text-xs text-slate-400">Solo 1 medición</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={puntos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(v: any) => [`${v} ${unidad}`, label]}
          />
          {/* Banda óptima */}
          {optMin !== null && <ReferenceLine y={optMin} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} label={{ value: `Ópt. mín`, position: 'insideTopRight', fontSize: 9, fill: '#10b981' }} />}
          {optMax !== null && <ReferenceLine y={optMax} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} label={{ value: `Ópt. máx`, position: 'insideBottomRight', fontSize: 9, fill: '#10b981' }} />}
          {refMax !== null && <ReferenceLine y={refMax} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />}
          {refMin !== null && <ReferenceLine y={refMin} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />}
          <Line
            type="monotone"
            dataKey="valor"
            stroke="#1e5fa8"
            strokeWidth={2}
            dot={{ r: 4, fill: '#1e5fa8', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [labs, setLabs] = useState<Laboratorio[]>([])
  const [tab, setTab] = useState<Tab>('resumen')
  const [loading, setLoading] = useState(true)
  const [eliminandoLab, setEliminandoLab] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'laboratorios') setTab('laboratorios')
    else if (t === 'graficas') setTab('graficas')
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

  // Diagnósticos extraídos de consultas
  const diagnosticos = consultas
    .flatMap(c => c.diagnosticos || [])
    .filter((d, i, arr) => arr.findIndex(x => x.descripcion === d.descripcion) === i)
    .slice(0, 6)

  // Params con al menos 2 mediciones para graficar
  const paramsConDatos = PARAMS_GRAFICA.filter(p =>
    labs.filter(l => l.valores?.[p.key] !== undefined).length >= 1
  )

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'consultas', label: 'Consultas', count: consultas.length },
    { key: 'laboratorios', label: 'Laboratorios', count: labs.length },
    { key: 'graficas', label: 'Gráficas' },
  ]

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
        <Link href={`/expediente/${id}/nueva-nota`} className="flex flex-col items-center gap-2 p-4 bg-[#1e5fa8] text-white rounded-xl hover:bg-[#1a3a5c] transition-colors text-center">
          <Stethoscope size={20} />
          <span className="text-xs font-medium">Nueva nota</span>
        </Link>
        <Link href={`/expediente/${id}/laboratorios/nuevo`} className="flex flex-col items-center gap-2 p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-center">
          <FlaskConical size={20} />
          <span className="text-xs font-medium">Agregar resultados de laboratorio</span>
        </Link>
        <Link href={`/expediente/${id}/documentos`} className="flex flex-col items-center gap-2 p-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-center">
          <FileText size={20} />
          <span className="text-xs font-medium text-center leading-tight">Nueva receta<br/>y Solicitudes</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? t.key === 'graficas' ? 'border-violet-600 text-violet-600'
                  : t.key === 'laboratorios' ? 'border-emerald-600 text-emerald-600'
                  : 'border-[#1e5fa8] text-[#1e5fa8]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          {/* Diagnósticos */}
          {diagnosticos.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700 text-sm">Diagnósticos registrados</h3>
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-2">
                {diagnosticos.map((d, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-blue-50 text-[#1a3a5c] border border-blue-100 rounded-full font-medium">
                    {d.codigo_cie10 && <span className="text-blue-400 mr-1">{d.codigo_cie10}</span>}
                    {d.descripcion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Últimas consultas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 text-sm">Últimas consultas</h3>
              {consultas.length > 3 && (
                <button onClick={() => setTab('consultas')} className="text-xs text-[#1e5fa8] hover:underline">
                  Ver todas →
                </button>
              )}
            </div>
            {consultas.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-slate-400">Sin consultas registradas</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {consultas.slice(0, 3).map(c => (
                  <Link key={c.id} href={`/expediente/${id}/consulta/${c.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0">
                      <Stethoscope size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.motivo_consulta}</p>
                      <p className="text-xs text-slate-400">{format(parseISO(c.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-[#1e5fa8] flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Último laboratorio */}
          {labs.length > 0 && (() => {
            const lab = labs[0]
            const alterados = lab.resultados?.filter(r => r.estado === 'bajo' || r.estado === 'alto' || r.estado === 'suboptimo') || []
            const criticos = lab.analisis_ia?.alertas?.filter(a => a.tipo === 'critica') || []
            return (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 text-sm">Último laboratorio</h3>
                  <button onClick={() => setTab('laboratorios')} className="text-xs text-emerald-600 hover:underline">
                    Ver historial →
                  </button>
                </div>
                <Link href={`/expediente/${id}/laboratorios/${lab.id}`}
                  className="block px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <FlaskConical size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {format(parseISO(lab.fecha_toma), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {lab.resultados?.length || 0} parámetros
                          {alterados.length > 0 && <span className="text-red-600 font-medium"> · {alterados.length} alterados</span>}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 flex-shrink-0" />
                  </div>
                  {criticos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {criticos.slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs bg-red-50 border border-red-100 text-red-700 rounded-lg px-2.5 py-1">
                          <AlertTriangle size={11} /> {a.mensaje}
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              </div>
            )
          })()}

          {/* Suplementos activos */}
          {labs.length > 0 && labs[0].analisis_ia?.suplementos_recomendados?.length ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700 text-sm">Suplementos recomendados (último lab)</h3>
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-2">
                {labs[0].analisis_ia!.suplementos_recomendados.map((s, i) => (
                  <span key={i} className={`text-xs px-3 py-1.5 rounded-full font-medium border ${
                    s.prioridad === 'alta' ? 'bg-red-50 border-red-100 text-red-700' :
                    s.prioridad === 'media' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    {s.nombre}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {consultas.length === 0 && labs.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">Sin actividad registrada para este paciente</p>
              <Link href={`/expediente/${id}/nueva-nota`} className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">
                Crear primera nota →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CONSULTAS ── */}
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
                <Link key={c.id} href={`/expediente/${id}/consulta/${c.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 flex-shrink-0">
                      <Stethoscope size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">{c.motivo_consulta}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(parseISO(c.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                        {c.proxima_cita && ` · Próxima: ${c.proxima_cita}`}
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

      {/* ── TAB: LABORATORIOS ── */}
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
                const alterados = lab.resultados?.filter(r => r.estado === 'bajo' || r.estado === 'alto' || r.estado === 'suboptimo').length || 0
                const totalResultados = lab.resultados?.length || 0
                const alertas = lab.analisis_ia?.alertas?.filter(a => a.tipo === 'critica') || []
                const suplementos = lab.analisis_ia?.suplementos_recomendados?.length || 0
                const confirmando = confirmarEliminar === lab.id

                return (
                  <div key={lab.id}>
                    {confirmando && (
                      <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between gap-3">
                        <p className="text-sm text-red-700 font-medium">¿Eliminar este laboratorio?</p>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => setConfirmarEliminar(null)}
                            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                            Cancelar
                          </button>
                          <button onClick={() => eliminarLab(lab.id)} disabled={eliminandoLab === lab.id}
                            className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-1">
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
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {totalResultados > 0 ? (
                              <span className="text-xs text-slate-500">
                                {totalResultados} parámetros
                                {alterados > 0 && <span className="text-red-600 font-medium"> · {alterados} alterados</span>}
                              </span>
                            ) : (
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

      {/* ── TAB: GRÁFICAS ── */}
      {tab === 'graficas' && (
        <div className="space-y-4">
          {paramsConDatos.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <BarChart2 size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Sin datos para graficar</p>
              <p className="text-xs text-slate-400 mt-1">Agrega laboratorios con los parámetros de seguimiento para ver las gráficas</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-[#1a3a5c]">
                <Activity size={14} className="mt-0.5 flex-shrink-0" />
                <p>Las líneas <span className="text-emerald-600 font-semibold">verdes</span> marcan el rango óptimo (medicina funcional) y las <span className="text-amber-500 font-semibold">amarillas</span> el rango de referencia del laboratorio.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paramsConDatos.map(p => (
                  <GraficaParametro
                    key={p.key}
                    labs={labs}
                    paramKey={p.key}
                    label={p.label}
                    unidad={p.unidad}
                    refMin={p.refMin}
                    refMax={p.refMax}
                    optMin={p.optMin}
                    optMax={p.optMax}
                  />
                ))}
              </div>
            </>
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
