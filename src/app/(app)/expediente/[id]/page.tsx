'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Paciente, Consulta, Laboratorio } from '@/types'
import { differenceInYears, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, Stethoscope, Calendar, ChevronRight,
  FlaskConical, FileText, AlertTriangle,
  Trash2, Loader2, BarChart2, Activity, Search, ChevronDown, ChevronUp,
  Pencil, Pill, ScanLine, ClipboardList, Eye, X,
} from 'lucide-react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

type Tab = 'resumen' | 'consultas' | 'laboratorios' | 'graficas' | 'documentos'

const TIPO_DOC_LABEL: Record<string, string> = {
  receta: 'Receta',
  solicitud_lab: 'Solicitud de Laboratorio',
  solicitud_imagen: 'Solicitud de Imagen',
  plan_suplementacion: 'Plan de Suplementación',
  informe_clinico: 'Informe Clínico',
}
const TIPO_DOC_COLOR: Record<string, string> = {
  receta: 'bg-blue-100 text-blue-700',
  solicitud_lab: 'bg-emerald-100 text-emerald-700',
  solicitud_imagen: 'bg-violet-100 text-violet-700',
  plan_suplementacion: 'bg-amber-100 text-amber-700',
  informe_clinico: 'bg-slate-100 text-slate-600',
}

// Palabras que no distinguen el parámetro clínico (se ignoran al agrupar)
const QUALIFIERS_IGNORAR = new Set([
  'serica','serico','sericas','sericos',
  'basal','en','ayunas','simple','total','completo','completa',
  'plasmatica','plasmatico','venosa','venoso','capilar','capilary',
  'sangre','sanguinea','sanguineo','urinaria','urinario',
  'de','la','el','los','las','y','o',
])

function normalizarKey(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')      // quitar puntuación
    .split(/\s+/)
    .filter(w => w.length >= 2 && !QUALIFIERS_IGNORAR.has(w))
    .join(' ')
    .trim()
}

// Parsea strings como "70-100", "<5.7", ">40", "40-60"
function parseRango(rango?: string): { min: number | null; max: number | null } {
  if (!rango) return { min: null, max: null }
  const rng = rango.trim()
  const entre = rng.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)$/)
  if (entre) return { min: parseFloat(entre[1]), max: parseFloat(entre[2]) }
  const menorQ = rng.match(/^[<≤]\s*(\d+\.?\d*)$/)
  if (menorQ) return { min: null, max: parseFloat(menorQ[1]) }
  const mayorQ = rng.match(/^[>≥]\s*(\d+\.?\d*)$/)
  if (mayorQ) return { min: parseFloat(mayorQ[1]), max: null }
  return { min: null, max: null }
}

type PuntoGrafica = { fechaLabel: string; fechaISO: string; valor: number; estado?: string }
type ParamGrafica = {
  nombre: string          // nombre principal (más frecuente)
  aliases: string[]       // otros nombres detectados para el mismo parámetro
  unidad: string
  rango_ref?: string
  rango_optimo?: string
  puntos: PuntoGrafica[]
}

function GraficaParametro({ param }: { param: ParamGrafica }) {
  const { min: refMin, max: refMax } = parseRango(param.rango_ref)
  const { min: optMin, max: optMax } = parseRango(param.rango_optimo)

  const vals = param.puntos.map(p => p.valor)
  const allNums = [
    ...vals, refMin, refMax, optMin, optMax,
  ].filter((v): v is number => v !== null && v !== undefined && !isNaN(v))

  const span = Math.max(...allNums) - Math.min(...allNums)
  const pad = span * 0.15 || Math.max(...allNums) * 0.1
  const yMin = Math.min(...allNums) - pad
  const yMax = Math.max(...allNums) + pad

  const data = param.puntos.map(p => ({ fecha: p.fechaLabel, valor: p.valor }))

  const getColor = (estado?: string) => {
    if (estado === 'bajo' || estado === 'alto') return '#dc2626'
    if (estado === 'suboptimo') return '#d97706'
    return '#1e5fa8'
  }
  const lastEstado = param.puntos[param.puntos.length - 1]?.estado
  const lineColor = getColor(lastEstado)

  return (
    <div className="pt-3 pb-1">
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 6, right: 16, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: '#94a3b8' }} width={48} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 10px' }}
            formatter={(v: any) => [`${v} ${param.unidad}`, param.nombre]}
          />
          {optMin !== null && (
            <ReferenceLine y={optMin} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: 'Ópt. mín', position: 'insideTopRight', fontSize: 9, fill: '#10b981' }} />
          )}
          {optMax !== null && (
            <ReferenceLine y={optMax} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: 'Ópt. máx', position: 'insideBottomRight', fontSize: 9, fill: '#10b981' }} />
          )}
          {refMin !== null && (
            <ReferenceLine y={refMin} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />
          )}
          {refMax !== null && (
            <ReferenceLine y={refMax} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={1} />
          )}
          <Line
            type="monotone"
            dataKey="valor"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={(props: any) => {
              const est = param.puntos[props.index]?.estado
              const c = getColor(est)
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill={c} stroke="#fff" strokeWidth={1.5} />
            }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {param.puntos.length === 1 && (
        <p className="text-center text-xs text-slate-400 mt-1">Solo 1 medición — agrega más laboratorios para ver la tendencia</p>
      )}
    </div>
  )
}

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const { isDoctor } = useProfile()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [labs, setLabs] = useState<Laboratorio[]>([])
  const [tab, setTab] = useState<Tab>('resumen')
  const [loading, setLoading] = useState(true)
  const [eliminandoLab, setEliminandoLab] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [graficasAbiertas, setGraficasAbiertas] = useState<Record<string, boolean>>({})
  const [busquedaParam, setBusquedaParam] = useState('')
  const [documentos, setDocumentos] = useState<any[]>([])
  const [docSeleccionado, setDocSeleccionado] = useState<any>(null)

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'laboratorios') setTab('laboratorios')
    else if (t === 'graficas') setTab('graficas')
    else if (t === 'documentos') setTab('documentos')
  }, [searchParams])

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const [{ data: p }, { data: c }, { data: l }, { data: d }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase.from('consultas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
        supabase.from('laboratorios').select('*').eq('paciente_id', id).order('fecha_toma', { ascending: false }),
        supabase.from('documentos').select('id, tipo, contenido, created_at').eq('paciente_id', id).order('created_at', { ascending: false }),
      ])
      setPaciente(p)
      setConsultas(c || [])
      setLabs(l || [])
      setDocumentos(d || [])
      setLoading(false)
    }
    cargar()
  }, [id])

  // Recolecta todos los parámetros de todos los labs agrupando nombres equivalentes
  const todosLosParams = useMemo((): ParamGrafica[] => {
    // map key = nombre normalizado; value = grupo acumulado
    const map = new Map<string, {
      nombres: Map<string, number>   // nombre original → frecuencia
      unidad: string
      rango_ref?: string
      rango_optimo?: string
      puntos: PuntoGrafica[]
    }>()

    const labsOrdenados = [...labs].sort((a, b) => a.fecha_toma.localeCompare(b.fecha_toma))

    labsOrdenados.forEach(lab => {
      ;(lab.resultados || []).forEach(r => {
        const val = typeof r.valor === 'number' ? r.valor : parseFloat(String(r.valor))
        if (isNaN(val)) return

        const nombreOriginal = r.nombre.trim()
        const key = normalizarKey(nombreOriginal)
        if (!key) return

        if (!map.has(key)) {
          map.set(key, {
            nombres: new Map(),
            unidad: r.unidad || '',
            rango_ref: r.rango_ref,
            rango_optimo: r.rango_optimo,
            puntos: [],
          })
        }
        const grupo = map.get(key)!
        grupo.nombres.set(nombreOriginal, (grupo.nombres.get(nombreOriginal) || 0) + 1)
        // Preferir el rango más completo (no vacío)
        if (!grupo.rango_ref && r.rango_ref) grupo.rango_ref = r.rango_ref
        if (!grupo.rango_optimo && r.rango_optimo) grupo.rango_optimo = r.rango_optimo
        grupo.puntos.push({
          fechaLabel: format(parseISO(lab.fecha_toma), 'dd/MM/yy'),
          fechaISO: lab.fecha_toma,
          valor: val,
          estado: r.estado,
        })
      })
    })

    return Array.from(map.values())
      .map(g => {
        // Nombre principal = el más frecuente (y más largo si hay empate)
        const nombrePrincipal = Array.from(g.nombres.entries())
          .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]
        const aliases = Array.from(g.nombres.keys()).filter(n => n !== nombrePrincipal)
        return {
          nombre: nombrePrincipal,
          aliases,
          unidad: g.unidad,
          rango_ref: g.rango_ref,
          rango_optimo: g.rango_optimo,
          puntos: g.puntos,
        }
      })
      .sort((a, b) => {
        if (b.puntos.length !== a.puntos.length) return b.puntos.length - a.puntos.length
        return a.nombre.localeCompare(b.nombre)
      })
  }, [labs])

  async function eliminarLab(labId: string) {
    setEliminandoLab(labId)
    const supabase = createClient()
    await supabase.from('laboratorios').delete().eq('id', labId)
    setLabs(prev => prev.filter(l => l.id !== labId))
    setEliminandoLab(null)
    setConfirmarEliminar(null)
  }

  function toggleGrafica(nombre: string) {
    setGraficasAbiertas(prev => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Cargando expediente...</div>
  if (!paciente) return <div className="text-center py-12 text-slate-400">Paciente no encontrado</div>

  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null

  const diagnosticos = consultas
    .flatMap(c => c.diagnosticos || [])
    .filter((d, i, arr) => arr.findIndex(x => x.descripcion === d.descripcion) === i)
    .slice(0, 6)

  const paramsFiltrados = todosLosParams.filter(p =>
    !busquedaParam || p.nombre.toLowerCase().includes(busquedaParam.toLowerCase())
  )

  const conTendencia = todosLosParams.filter(p => p.puntos.length > 1).length

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'consultas', label: 'Consultas', count: consultas.length },
    { key: 'laboratorios', label: 'Laboratorios', count: labs.length },
    { key: 'graficas', label: 'Gráficas', count: todosLosParams.length || undefined },
    ...(isDoctor ? [{ key: 'documentos' as Tab, label: 'Documentos', count: documentos.length || undefined }] : []),
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Modal visor de documento ── */}
      {docSeleccionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_DOC_COLOR[docSeleccionado.tipo] || 'bg-slate-100 text-slate-600'}`}>
                  {TIPO_DOC_LABEL[docSeleccionado.tipo] || docSeleccionado.tipo}
                </span>
                <span className="text-xs text-slate-400">
                  {format(parseISO(docSeleccionado.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </span>
              </div>
              <button onClick={() => setDocSeleccionado(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Contenido */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 text-sm text-slate-700">
              {/* Datos comunes */}
              {docSeleccionado.contenido?.paciente && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Paciente:</span>
                  <span>{docSeleccionado.contenido.paciente}</span>
                </div>
              )}
              {docSeleccionado.contenido?.diagnostico && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Diagnóstico:</span>
                  <span>{docSeleccionado.contenido.diagnostico}</span>
                </div>
              )}
              {docSeleccionado.contenido?.fecha && (
                <div className="flex gap-2">
                  <span className="font-medium text-slate-500 min-w-[90px]">Fecha doc.:</span>
                  <span>{docSeleccionado.contenido.fecha}</span>
                </div>
              )}

              <div className="border-t border-slate-100 pt-3" />

              {/* RECETA */}
              {docSeleccionado.tipo === 'receta' && docSeleccionado.contenido?.medicamentos?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-2">Medicamentos</p>
                  <div className="space-y-3">
                    {docSeleccionado.contenido.medicamentos.filter((m: any) => m.nombre_comercial).map((m: any, i: number) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3">
                        <p className="font-medium text-[#1a3a5c]">
                          {i + 1}. {m.nombre_comercial.toUpperCase()}
                          {m.presentacion && ` ${m.presentacion}`}
                          {m.principio_activo && <span className="font-normal text-slate-500 text-xs"> ({m.principio_activo})</span>}
                        </p>
                        {m.indicacion && <p className="text-xs text-slate-600 mt-1 ml-3">{m.indicacion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {docSeleccionado.tipo === 'receta' && docSeleccionado.contenido?.recomendaciones && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Recomendaciones</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{docSeleccionado.contenido.recomendaciones}</p>
                </div>
              )}

              {/* SOLICITUD LAB */}
              {(docSeleccionado.tipo === 'lab' || docSeleccionado.tipo === 'solicitud_lab') && docSeleccionado.contenido?.estudios?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-2">Estudios solicitados</p>
                  <ul className="space-y-1">
                    {docSeleccionado.contenido.estudios.map((e: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-emerald-600 font-bold">✓</span> {e}
                      </li>
                    ))}
                  </ul>
                  {docSeleccionado.contenido.notas && (
                    <div className="mt-3">
                      <p className="font-semibold text-slate-700 mb-1">Indicaciones</p>
                      <p className="text-sm text-slate-600">{docSeleccionado.contenido.notas}</p>
                    </div>
                  )}
                </div>
              )}

              {/* SOLICITUD IMAGEN */}
              {(docSeleccionado.tipo === 'imagen' || docSeleccionado.tipo === 'solicitud_imagen') && docSeleccionado.contenido?.estudios?.length > 0 && (
                <div>
                  {docSeleccionado.contenido.urgente && (
                    <p className="text-xs font-bold text-red-600 mb-2">⚠ URGENTE</p>
                  )}
                  <p className="font-semibold text-slate-700 mb-2">Estudios de imagen</p>
                  <div className="space-y-2">
                    {docSeleccionado.contenido.estudios.map((e: any, i: number) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3 border-l-4 border-violet-400">
                        <p className="font-medium text-[#1a3a5c]">
                          {e.tipo} de {e.region}
                          {e.proyecciones && <span className="font-normal text-slate-500"> ({e.proyecciones})</span>}
                        </p>
                        {e.indicacion && <p className="text-xs text-slate-600 mt-1">{e.indicacion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PLAN SUPLEMENTACIÓN */}
              {docSeleccionado.tipo === 'plan_suplementacion' && docSeleccionado.contenido?.suplementos?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-2">Suplementos</p>
                  <div className="space-y-2">
                    {docSeleccionado.contenido.suplementos.map((s: any, i: number) => (
                      <div key={i} className="bg-amber-50 rounded-lg p-3">
                        <p className="font-medium text-amber-900">{i + 1}. {s.nombre}</p>
                        {s.dosis && <p className="text-xs text-amber-700 mt-0.5">Dosis: {s.dosis}</p>}
                        {s.justificacion && <p className="text-xs text-slate-600 mt-0.5">{s.justificacion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          {isDoctor && (
            <Link href={`/expediente/${id}/editar`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors flex-shrink-0">
              <Pencil size={13} /> Editar
            </Link>
          )}
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

      {/* Acciones rápidas — solo médico */}
      {isDoctor && (
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
      )}

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

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 text-sm">Últimas consultas</h3>
              {consultas.length > 3 && (
                <button onClick={() => setTab('consultas')} className="text-xs text-[#1e5fa8] hover:underline">Ver todas →</button>
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

          {labs.length > 0 && (() => {
            const lab = labs[0]
            const alterados = lab.resultados?.filter(r => r.estado === 'bajo' || r.estado === 'alto' || r.estado === 'suboptimo') || []
            const criticos = lab.analisis_ia?.alertas?.filter(a => a.tipo === 'critica') || []
            return (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 text-sm">Último laboratorio</h3>
                  <button onClick={() => setTab('laboratorios')} className="text-xs text-emerald-600 hover:underline">Ver historial →</button>
                </div>
                <Link href={`/expediente/${id}/laboratorios/${lab.id}`} className="block px-5 py-4 hover:bg-slate-50 transition-colors group">
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
                  }`}>{s.nombre}</span>
                ))}
              </div>
            </div>
          ) : null}

          {consultas.length === 0 && labs.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">Sin actividad registrada para este paciente</p>
              {isDoctor && (
                <Link href={`/expediente/${id}/nueva-nota`} className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">
                  Crear primera nota →
                </Link>
              )}
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
              {isDoctor && <Link href={`/expediente/${id}/nueva-nota`} className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">Crear primera nota →</Link>}
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
              {isDoctor && <Link href={`/expediente/${id}/laboratorios/nuevo`} className="text-emerald-600 text-sm mt-2 inline-block hover:underline">Subir primer laboratorio →</Link>}
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
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmarEliminar(null)} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
                          <button onClick={() => eliminarLab(lab.id)} disabled={eliminandoLab === lab.id}
                            className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-1">
                            {eliminandoLab === lab.id ? <Loader2 size={12} className="animate-spin" /> : null} Sí, eliminar
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
                          <div className="flex items-center gap-2 mt-0.5">
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
                            {alertas.length > 0 && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{alertas.length} alerta{alertas.length > 1 ? 's' : ''} crítica{alertas.length > 1 ? 's' : ''}</span>}
                            {suplementos > 0 && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{suplementos} suplemento{suplementos > 1 ? 's' : ''}</span>}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {isDoctor && (
                          <button onClick={() => setConfirmarEliminar(confirmando ? null : lab.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                            <Trash2 size={15} />
                          </button>
                        )}
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
        <div className="space-y-3">
          {todosLosParams.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <BarChart2 size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Sin datos para graficar</p>
              <p className="text-xs text-slate-400 mt-1">Agrega laboratorios para ver la evolución de los parámetros</p>
            </div>
          ) : (
            <>
              {/* Info + stats */}
              <div className="flex items-start gap-3">
                <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-[#1a3a5c]">
                  <Activity size={14} className="mt-0.5 flex-shrink-0" />
                  <p>
                    <span className="font-semibold">{todosLosParams.length} parámetros</span> detectados en todos los laboratorios ·{' '}
                    <span className="text-emerald-700 font-semibold">{conTendencia} con tendencia</span> (2+ mediciones).
                    Las líneas <span className="text-emerald-600 font-semibold">verdes</span> = rango óptimo,{' '}
                    <span className="text-amber-500 font-semibold">amarillas</span> = rango de referencia.
                  </p>
                </div>
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busquedaParam}
                  onChange={e => setBusquedaParam(e.target.value)}
                  placeholder="Buscar parámetro..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 bg-white"
                />
              </div>

              {/* Lista de parámetros */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {paramsFiltrados.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">Sin resultados para "{busquedaParam}"</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {paramsFiltrados.map(param => {
                      const abierto = !!graficasAbiertas[param.nombre]
                      const ultimo = param.puntos[param.puntos.length - 1]
                      const estadoColor: Record<string, string> = {
                        optimo: 'bg-emerald-100 text-emerald-700',
                        normal: 'bg-emerald-100 text-emerald-700',
                        suboptimo: 'bg-amber-100 text-amber-700',
                        bajo: 'bg-red-100 text-red-700',
                        alto: 'bg-red-100 text-red-700',
                      }
                      const estadoLabel: Record<string, string> = {
                        optimo: 'Óptimo', normal: 'Normal', suboptimo: 'Sub-óptimo', bajo: 'Bajo', alto: 'Alto'
                      }
                      const est = ultimo?.estado || ''

                      return (
                        <div key={param.nombre}>
                          <div className="flex items-center px-5 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-slate-800">{param.nombre}</p>
                                {est && estadoColor[est] && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[est]}`}>
                                    {estadoLabel[est]}
                                  </span>
                                )}
                                {param.puntos.length > 1 && (
                                  <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
                                    {param.puntos.length} mediciones
                                  </span>
                                )}
                                {param.aliases.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full" title={`También encontrado como: ${param.aliases.join(', ')}`}>
                                    ~agrupado
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Último: <span className="font-medium text-slate-600">{ultimo.valor} {param.unidad}</span>
                                {' · '}{format(parseISO(ultimo.fechaISO), "dd/MM/yyyy")}
                                {param.aliases.length > 0 && (
                                  <span className="italic"> · también: {param.aliases.join(', ')}</span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleGrafica(param.nombre)}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                                abierto
                                  ? 'bg-[#1e5fa8] text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              <BarChart2 size={12} />
                              {abierto ? 'Ocultar' : 'Ver gráfica'}
                              {abierto ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          </div>

                          {abierto && (
                            <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                              <GraficaParametro param={param} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: DOCUMENTOS ── */}
      {tab === 'documentos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Documentos generados e impresos para este paciente</p>
            <Link href={`/expediente/${id}/documentos`}
              className="text-xs text-[#1e5fa8] hover:underline font-medium">
              + Nuevo documento
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {documentos.length === 0 ? (
              <div className="p-10 text-center">
                <FileText size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Sin documentos generados</p>
                <Link href={`/expediente/${id}/documentos`} className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">
                  Crear primera receta o solicitud →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documentos.map((doc: any) => (
                  <div key={doc.id} className="flex items-center px-5 py-3 gap-4">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      {doc.tipo === 'receta' && <Pill size={16} className="text-blue-600" />}
                      {(doc.tipo === 'solicitud_lab' || doc.tipo === 'lab') && <FlaskConical size={16} className="text-emerald-600" />}
                      {(doc.tipo === 'solicitud_imagen' || doc.tipo === 'imagen') && <ScanLine size={16} className="text-violet-600" />}
                      {doc.tipo === 'plan_suplementacion' && <ClipboardList size={16} className="text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_DOC_COLOR[doc.tipo] || 'bg-slate-100 text-slate-600'}`}>
                          {TIPO_DOC_LABEL[doc.tipo] || doc.tipo}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                        {doc.contenido?.diagnostico && ` · ${doc.contenido.diagnostico}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setDocSeleccionado(doc)}
                      className="flex items-center gap-1 text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0"
                    >
                      <Eye size={14} /> Ver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
