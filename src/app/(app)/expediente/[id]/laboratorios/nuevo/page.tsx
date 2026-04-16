'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { useAuditAccess } from '@/hooks/useAudit'
import { Paciente, ValoresLab, AnalisisIA, ResultadoLab } from '@/types'
import { analizarLaboratorios } from '@/lib/analisis'
import { calcularEdad } from '@/lib/patientUtils'
import {
  ArrowLeft, FlaskConical, Upload, CheckCircle, AlertTriangle,
  AlertCircle, Loader2, Save, RotateCcw, Plus, Trash2, Clock, WifiOff,
} from 'lucide-react'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS  = 5 * 60 * 1000  // 5 minutos
import Link from 'next/link'

const ESTADOS_OPCIONES = [
  { value: 'optimo',    label: 'Óptimo' },
  { value: 'normal',    label: 'Normal' },
  { value: 'suboptimo', label: 'Sub-óptimo' },
  { value: 'bajo',      label: 'Bajo' },
  { value: 'alto',      label: 'Alto' },
]

function BadgeEstado({ estado }: { estado: ResultadoLab['estado'] }) {
  if (!estado) return null
  const map: Record<string, string> = {
    optimo:    'bg-emerald-100 text-emerald-700',
    normal:    'bg-emerald-100 text-emerald-700',
    suboptimo: 'bg-amber-100 text-amber-700',
    bajo:      'bg-red-100 text-red-700',
    alto:      'bg-red-100 text-red-700',
  }
  const label: Record<string, string> = {
    optimo: 'Óptimo', normal: 'Normal', suboptimo: 'Sub-óptimo', bajo: 'Bajo', alto: 'Alto'
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${map[estado] ?? 'bg-slate-100 text-slate-600'}`}>
      {label[estado] ?? estado}
    </span>
  )
}

export default function NuevoLaboratorioPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  useAuditAccess('laboratorios', id)
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [valores, setValores] = useState<Partial<ValoresLab>>({})
  const [analisis, setAnalisis] = useState<AnalisisIA | null>(null)
  const [resultados, setResultados] = useState<ResultadoLab[]>([])
  const [modo, setModo] = useState<'pdf' | 'manual'>('pdf')
  const [filtro, setFiltro] = useState<'todos' | 'alterados'>('todos')
  const [extrayendo, setExtrayendo] = useState(false)
  const [extrayendoMsg, setExtrayendoMsg] = useState('Subiendo PDF...')
  const [analizando, setAnalizando] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartRef = useRef<number>(0)
  const [guardando, setGuardando] = useState(false)
  const [pdfExtraido, setPdfExtraido] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [fechaToma, setFechaToma] = useState(new Date().toISOString().split('T')[0])
  const [datosClinico, setDatosClinico] = useState({
    diagnostico: '',
    post_operatorio: false,
    dolor_cronico_meses: 0,
    inmovilizacion: false,
  })


  useEffect(() => {
    const supabase = createClient()
    supabase.from('pacientes').select('*').eq('id', id).single().then((res: { data: Paciente | null }) => setPaciente(res.data))
  }, [id])

  // Limpia el intervalo de polling al desmontar el componente
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function startPolling(jobId: string) {
    pollStartRef.current = Date.now()
    setExtrayendoMsg('Analizando con IA...')

    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current

      if (elapsed > POLL_TIMEOUT_MS) {
        stopPolling()
        setExtrayendo(false)
        setErrorMsg('El procesamiento tardó demasiado. Intenta con un PDF más pequeño.')
        return
      }

      try {
        const res = await fetch(`/api/labs-extract/status/${jobId}`)
        const data = await res.json()

        if (data.status === 'completed' && data.result) {
          stopPolling()
          const { valores: v, resultados: r, fecha_toma, } = data.result
          setValores(prev => ({ ...prev, ...v }))
          if (fecha_toma) setFechaToma(fecha_toma)
          if (r) setResultados(r)
          setPdfExtraido(true)
          setExtrayendo(false)
        } else if (data.status === 'error') {
          stopPolling()
          setExtrayendo(false)
          setErrorMsg(data.error || 'No se pudo extraer los datos del PDF. Verifica que el archivo sea legible e intenta de nuevo.')
        } else {
          // pending o processing — actualizar mensaje con tiempo transcurrido
          const seg = Math.floor(elapsed / 1000)
          setExtrayendoMsg(`Analizando con IA... ${seg}s`)
        }
      } catch {
        // Error de red — seguir intentando hasta timeout
      }
    }, POLL_INTERVAL_MS)
  }

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    stopPolling()
    setExtrayendo(true)
    setExtrayendoMsg('Subiendo PDF...')
    setErrorMsg('')
    setPdfExtraido(false)

    const fd = new FormData()
    fd.append('pdf', file)

    try {
      // Paso 1: subir PDF y crear job (rápido, <2s)
      const res = await fetch('/api/labs-extract', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { jobId } = data

      // Paso 2: disparar worker en segundo plano (fire & forget)
      fetch('/api/labs-extract/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      }).catch(() => {/* worker error se detecta via polling */})

      // Paso 3: iniciar polling
      startPolling(jobId)

    } catch (e: unknown) {
      setExtrayendo(false)
      setErrorMsg('No se pudo subir el PDF. Verifica tu conexión e intenta de nuevo.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  function agregarFila() {
    setResultados(prev => [...prev, { nombre: '', valor: '', unidad: '', rango_ref: '', rango_optimo: '', estado: 'normal', nota_clinica: null }])
  }

  function actualizarFila(i: number, campo: keyof ResultadoLab, val: string) {
    setResultados(prev => prev.map((r, idx) => idx === i ? { ...r, [campo]: val } : r))
  }

  function eliminarFila(i: number) {
    setResultados(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleAnalizar() {
    setAnalizando(true)
    setTimeout(() => {
      const resultado = analizarLaboratorios(valores as ValoresLab, datosClinico)
      setAnalisis(resultado)
      setAnalizando(false)
    }, 600)
  }

  async function handleGuardar() {
    setGuardando(true)
    const res = await fetch('/api/laboratorios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paciente_id: id,
        fecha_toma: fechaToma,
        valores,
        resultados: resultados.length > 0 ? resultados : null,
        analisis_ia: analisis,
      }),
    })
    setGuardando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Error desconocido' }))
      setErrorMsg(data.error || 'No se pudo guardar el laboratorio. Verifica tu conexión e intenta de nuevo.')
    } else router.push(`/expediente/${id}?tab=laboratorios`)
  }

  const edad = paciente?.fecha_nacimiento
    ? calcularEdad(paciente.fecha_nacimiento)
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/expediente/${id}`} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
            <FlaskConical size={22} /> Nuevo Laboratorio
          </h1>
          {paciente && (
            <p className="text-slate-500 text-sm mt-0.5">
              {paciente.nombre} {paciente.apellidos}
              {edad !== null ? ` · ${edad.textoElegante}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Modo toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
onClick={() => setModo('pdf')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                modo === 'pdf'
                ? 'bg-white shadow-sm text-[#1a3a5c]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload size={14} /> Subir PDF
          </button>
          <button
            onClick={() => setModo('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'manual' ? 'bg-white shadow-sm text-[#1a3a5c]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Plus size={14} /> Ingreso manual
          </button>
        </div>
      </div>

      {/* Drop Zone PDF */}
      {modo === 'pdf' && (
        <>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-[#1e5fa8] bg-blue-50' : 'border-slate-300 hover:border-[#1e5fa8] hover:bg-slate-50'}
              ${extrayendo ? 'opacity-70 pointer-events-none' : ''}
            `}
          >
            <input {...getInputProps()} />
            {extrayendo ? (
              <div className="flex flex-col items-center gap-2 text-[#1e5fa8]">
                {extrayendoMsg.includes('Subiendo') ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : (
                  <div className="relative">
                    <Clock size={32} />
                    <Loader2 size={16} className="animate-spin absolute -bottom-1 -right-1 text-[#1a3a5c]" />
                  </div>
                )}
                <p className="font-medium">{extrayendoMsg}</p>
                <p className="text-xs text-slate-400">Puedes seguir trabajando — te avisamos cuando termine</p>
              </div>
            ) : pdfExtraido ? (
              <div className="flex flex-col items-center gap-2 text-emerald-600">
                <CheckCircle size={32} />
                <p className="font-medium">PDF procesado — valores extraídos</p>
                <p className="text-sm text-slate-400">Suelta otro PDF para reemplazar</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload size={32} />
                <p className="font-medium text-slate-600">Arrastra el PDF del laboratorio aquí</p>
                <p className="text-sm">o haz clic para seleccionar</p>
              </div>
            )}
          </div>
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}
        </>
      )}

      {/* Ingreso manual */}
      {modo === 'manual' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 text-sm">Parámetros</h2>
            <p className="text-xs text-slate-400 mt-0.5">Ingresa cada resultado del reporte</p>
          </div>
          {/* Encabezados */}
          <div className="grid grid-cols-12 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase tracking-wide">
            <div className="col-span-3">Parámetro</div>
            <div className="col-span-2">Valor / Unidad</div>
            <div className="col-span-2">Ref. lab</div>
            <div className="col-span-2">Óptimo</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-1"></div>
          </div>
          <div className="divide-y divide-slate-100">
            {resultados.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 px-4 py-2 items-center">
                <div className="col-span-3">
                  <input
                    type="text"
                    value={r.nombre}
                    onChange={e => actualizarFila(i, 'nombre', e.target.value)}
                    placeholder="Glucosa, Hemoglobina..."
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/40"
                  />
                </div>
                <div className="col-span-2 flex gap-1">
                  <input
                    type="text"
                    value={String(r.valor)}
                    onChange={e => actualizarFila(i, 'valor', e.target.value)}
                    placeholder="0.0"
                    className="w-14 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/40"
                  />
                  <input
                    type="text"
                    value={r.unidad || ''}
                    onChange={e => actualizarFila(i, 'unidad', e.target.value)}
                    placeholder="mg/dL"
                    className="w-16 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/40"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={r.rango_ref || ''}
                    onChange={e => actualizarFila(i, 'rango_ref', e.target.value)}
                    placeholder="70-100"
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/40"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={r.rango_optimo || ''}
                    onChange={e => actualizarFila(i, 'rango_optimo', e.target.value)}
                    placeholder="80-90"
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/40"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={r.estado || 'normal'}
                    onChange={e => actualizarFila(i, 'estado', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/40 bg-white"
                  >
                    {ESTADOS_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-span-1 flex justify-center">
                  <button onClick={() => eliminarFila(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {resultados.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-slate-400">
                Aún no hay parámetros — agrega el primero
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-slate-100">
            <button
              onClick={agregarFila}
              className="flex items-center gap-2 text-sm text-[#1e5fa8] hover:text-[#1a3a5c] font-medium"
            >
              <Plus size={15} /> Agregar parámetro
            </button>
          </div>
        </div>
      )}

      {/* Fecha */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <label className="text-xs font-medium text-slate-500 block mb-1">Fecha de toma de muestra</label>
        <input
          type="date"
          value={fechaToma}
          onChange={e => setFechaToma(e.target.value)}
          className="w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
        />
      </div>

      {/* Resultados extraídos del PDF (solo en modo PDF) */}
      {modo === 'pdf' && resultados.length > 0 && (() => {
        const alterados = resultados.filter(r => r.estado === 'bajo' || r.estado === 'alto' || r.estado === 'suboptimo')
        const filtrados = filtro === 'alterados' ? alterados : resultados
        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-700 text-sm">Resultados extraídos</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {resultados.length} parámetros · {alterados.length} fuera de rango óptimo
                </p>
              </div>
              <button
                onClick={() => { setResultados([]); setValores({}); setPdfExtraido(false) }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Limpiar
              </button>
            </div>

            {/* Filtros */}
            <div className="px-5 py-2.5 border-b border-slate-100 flex gap-2">
              <button
                onClick={() => setFiltro('todos')}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${filtro === 'todos' ? 'bg-[#1e5fa8] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Todos ({resultados.length})
              </button>
              <button
                onClick={() => setFiltro('alterados')}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${filtro === 'alterados' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Alterados ({alterados.length})
              </button>
            </div>

            {/* Encabezados */}
            <div className="grid grid-cols-12 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <div className="col-span-4">Parámetro</div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-2 text-center">Ref. lab</div>
              <div className="col-span-2 text-center">Óptimo</div>
              <div className="col-span-2 text-center">Estado</div>
            </div>

            <div className="divide-y divide-slate-100">
              {filtrados.map((r, i) => (
                <div key={i} className={`grid grid-cols-12 items-start px-5 py-3 hover:bg-slate-50 ${
                  r.estado === 'bajo' || r.estado === 'alto' ? 'bg-red-50/30' :
                  r.estado === 'suboptimo' ? 'bg-amber-50/30' : ''
                }`}>
                  <div className="col-span-4 min-w-0 pr-2">
                    <p className="text-sm text-slate-800 leading-tight">{r.nombre}</p>
                    {r.nota_clinica && (
                      <p className="text-xs text-amber-600 mt-0.5 leading-tight">{r.nota_clinica}</p>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-semibold text-slate-900">{r.valor}</span>
                    {r.unidad && <span className="text-xs text-slate-400 ml-1">{r.unidad}</span>}
                  </div>
                  <div className="col-span-2 text-center text-xs text-slate-500">{r.rango_ref || '—'}</div>
                  <div className="col-span-2 text-center text-xs text-emerald-700 font-medium">{r.rango_optimo || '—'}</div>
                  <div className="col-span-2 flex justify-center">
                    <BadgeEstado estado={r.estado} />
                  </div>
                </div>
              ))}
              {filtrados.length === 0 && (
                <div className="px-5 py-6 text-center text-sm text-slate-400">No hay parámetros alterados</div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Datos clínicos + analizar suplementos — solo en modo PDF con valores clave */}
      {modo === 'pdf' && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-700 mb-4 text-sm">Datos clínicos adicionales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico principal</label>
                <input
                  type="text"
                  value={datosClinico.diagnostico}
                  onChange={e => setDatosClinico(p => ({ ...p, diagnostico: e.target.value }))}
                  placeholder="Ej: Artrosis de rodilla, hernia discal L4-L5..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Dolor crónico (meses)</label>
                <input
                  type="number"
                  value={datosClinico.dolor_cronico_meses || ''}
                  onChange={e => setDatosClinico(p => ({ ...p, dolor_cronico_meses: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
                />
              </div>
              <div className="flex flex-col gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={datosClinico.post_operatorio}
                    onChange={e => setDatosClinico(p => ({ ...p, post_operatorio: e.target.checked }))}
                    className="w-4 h-4 accent-[#1e5fa8]" />
                  Paciente post-operatorio / en rehabilitación
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={datosClinico.inmovilizacion}
                    onChange={e => setDatosClinico(p => ({ ...p, inmovilizacion: e.target.checked }))}
                    className="w-4 h-4 accent-[#1e5fa8]" />
                  Inmovilización / reposo prolongado
                </label>
              </div>
            </div>
          </div>

          {/* Botón analizar */}
          <button
            onClick={handleAnalizar}
            disabled={analizando || Object.keys(valores).length === 0}
            className={`w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${Object.keys(valores).length === 0 ? 'hidden' : ''}`}
          >
            {analizando ? <><Loader2 size={18} className="animate-spin" /> Analizando...</> : '🔬 Analizar y Recomendar Suplementos'}
          </button>
        </>
      )}

      {/* Resultado del análisis */}
      {analisis && (
        <div className="space-y-4">
          <div className="bg-[#e8f4fd] border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-[#1a3a5c] font-medium">{analisis.resumen_clinico}</p>
          </div>

          {analisis.alertas.length > 0 && (
            <div className="space-y-2">
              {analisis.alertas.map((alerta, i) => (
                <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border text-sm
                  ${alerta.tipo === 'critica' ? 'bg-red-50 border-red-200 text-red-800' :
                    alerta.tipo === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'}`}
                >
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <p>{alerta.mensaje}</p>
                </div>
              ))}
            </div>
          )}

          {analisis.suplementos_recomendados.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700 text-sm">Suplementos Recomendados</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {analisis.suplementos_recomendados.map((sup, i) => (
                  <div key={i} className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-slate-800">{sup.nombre}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
                        ${sup.prioridad === 'alta' ? 'bg-red-100 text-red-700' :
                          sup.prioridad === 'media' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'}`}>
                        {sup.prioridad === 'alta' ? 'Alta prioridad' : sup.prioridad === 'media' ? 'Prioridad media' : 'Complementario'}
                      </span>
                    </div>
                    {sup.dosis && <p className="text-sm text-[#1e5fa8] font-medium mb-1">📋 {sup.dosis}</p>}
                    <p className="text-sm text-slate-500">{sup.justificacion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {guardando
              ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              : <><Save size={16} /> Guardar en expediente</>
            }
          </button>
        </div>
      )}

      {/* Guardar */}
      {!analisis && (Object.keys(valores).length > 0 || resultados.length > 0) && (
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
        >
          {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> Guardar en expediente</>}
        </button>
      )}
    </div>
  )
}
