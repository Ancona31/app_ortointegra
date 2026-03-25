'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { Paciente, ValoresLab, AnalisisIA, ResultadoLab } from '@/types'
import { analizarLaboratorios } from '@/lib/analisis'
import { differenceInYears, parseISO } from 'date-fns'
import {
  ArrowLeft, FlaskConical, Upload, CheckCircle, AlertTriangle,
  AlertCircle, Loader2, Save, RotateCcw
} from 'lucide-react'
import Link from 'next/link'

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
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [valores, setValores] = useState<Partial<ValoresLab>>({})
  const [analisis, setAnalisis] = useState<AnalisisIA | null>(null)
  const [resultados, setResultados] = useState<ResultadoLab[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'alterados'>('todos')
  const [extrayendo, setExtrayendo] = useState(false)
  const [analizando, setAnalizando] = useState(false)
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
    supabase.from('pacientes').select('*').eq('id', id).single().then(({ data }) => setPaciente(data))
  }, [id])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setExtrayendo(true)
    setErrorMsg('')
    setPdfExtraido(false)

    const fd = new FormData()
    fd.append('pdf', file)

    try {
      const res = await fetch('/api/labs-extract', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setValores(prev => ({ ...prev, ...data.valores }))
      if (data.fecha_toma) setFechaToma(data.fecha_toma)
      if (data.resultados) setResultados(data.resultados)
      setPdfExtraido(true)
    } catch (e: any) {
      setErrorMsg('No se pudo extraer el PDF: ' + e.message)
    } finally {
      setExtrayendo(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

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
    const supabase = createClient()
    const { error } = await supabase.from('laboratorios').insert({
      paciente_id: id,
      fecha_toma: fechaToma,
      valores,
      resultados: resultados.length > 0 ? resultados : null,
      analisis_ia: analisis,
    })
    setGuardando(false)
    if (error) setErrorMsg('Error al guardar: ' + error.message)
    else router.push(`/expediente/${id}?tab=laboratorios`)
  }

  const edad = paciente?.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
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
              {edad !== null ? ` · ${edad} años` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Drop Zone PDF */}
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
            <Loader2 size={32} className="animate-spin" />
            <p className="font-medium">Extrayendo valores con IA...</p>
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

      {/* Resultados extraídos del PDF */}
      {resultados.length > 0 && (() => {
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

      {/* Datos clínicos */}
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
