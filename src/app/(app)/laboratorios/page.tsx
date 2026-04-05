'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FlaskConical, Upload, CheckCircle, AlertTriangle, AlertCircle, Loader2, Save, RotateCcw } from 'lucide-react'
import { ValoresLab, AnalisisIA, VALORES_REFERENCIA, ParametroLab } from '@/types'
import { analizarLaboratorios } from '@/lib/analisis'
import { createClient } from '@/lib/supabase/client'

// Tipo explícito para evitar `as any` al acceder a los campos de referencia
type RefValue = {
  ref_min: number | null
  ref_max: number | null
  opt_min: number | null
  opt_max: number | null
  unidad: string
  label: string
}

const PARAMETROS = Object.entries(VALORES_REFERENCIA) as [ParametroLab, RefValue][]

function BadgeEstado({ valor, param }: { valor: number; param: ParametroLab }) {
  const ref = VALORES_REFERENCIA[param] as RefValue

  let estado: 'optimo' | 'suboptimo' | 'bajo' | 'alto' = 'optimo'
  if (ref.opt_max !== null && valor > ref.opt_max) estado = 'suboptimo'
  if (ref.opt_min !== null && valor < ref.opt_min) estado = 'suboptimo'
  if (ref.ref_min !== null && valor < ref.ref_min) estado = 'bajo'
  if (ref.ref_max !== null && valor > ref.ref_max) estado = 'alto'

  if (estado === 'optimo')   return <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Óptimo</span>
  if (estado === 'suboptimo') return <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Sub-óptimo</span>
  return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Fuera de rango</span>
}

export default function LaboratoriosPage() {
  const [valores, setValores] = useState<Partial<ValoresLab>>({})
  const [analisis, setAnalisis] = useState<AnalisisIA | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pdfExtraido, setPdfExtraido] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [pacienteId, setPacienteId] = useState('')
  const [fechaToma, setFechaToma] = useState(new Date().toISOString().split('T')[0])
  const [errorMsg, setErrorMsg] = useState('')
  const [datosClinico, setDatosClinico] = useState({
    diagnostico: '',
    post_operatorio: false,
    dolor_cronico_meses: 0,
    inmovilizacion: false,
  })

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
      if (data.valores.fecha_toma) setFechaToma(data.valores.fecha_toma)
      setPdfExtraido(true)
    } catch (e: any) {
      setErrorMsg('No se pudo extraer los datos del PDF. Verifica que el archivo sea legible e intenta de nuevo.')
    } finally {
      setExtrayendo(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  function handleValor(key: ParametroLab, val: string) {
    setValores(prev => ({ ...prev, [key]: val === '' ? undefined : parseFloat(val) }))
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
    if (!pacienteId) { setErrorMsg('Ingresa el ID del paciente'); return }
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase.from('laboratorios').insert({
      paciente_id: pacienteId,
      fecha_toma: fechaToma,
      valores,
      analisis_ia: analisis,
    })
    setGuardando(false)
    if (error) setErrorMsg('Error al guardar: ' + error.message)
    else setGuardado(true)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
          <FlaskConical size={24} /> Análisis de Laboratorios
        </h1>
        <p className="text-slate-500 text-sm mt-1">Sube un PDF o ingresa los valores manualmente</p>
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

      {/* Datos del paciente */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 mb-4 text-sm">Datos del estudio</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-500 block mb-1">ID Paciente</label>
            <input
              type="text"
              value={pacienteId}
              onChange={e => setPacienteId(e.target.value)}
              placeholder="UUID del paciente"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha de toma</label>
            <input
              type="date"
              value={fechaToma}
              onChange={e => setFechaToma(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
            />
          </div>
        </div>
      </div>

      {/* Tabla de valores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Valores de Laboratorio</h2>
          {pdfExtraido && (
            <button onClick={() => { setValores({}); setPdfExtraido(false) }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <RotateCcw size={12} /> Limpiar
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {PARAMETROS.map(([key, ref]) => (
            <div key={key} className="flex items-center px-5 py-3 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{ref.label}</p>
                <p className="text-xs text-slate-400">
                  Ref: {(ref as RefValue).ref_min ?? '–'}–{(ref as RefValue).ref_max ?? '–'} {ref.unidad} ·
                  Meta: {(ref as RefValue).opt_min ? `${(ref as RefValue).opt_min}–` : '< '}{(ref as RefValue).opt_max ?? (ref as RefValue).opt_min} {ref.unidad}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={valores[key] ?? ''}
                  onChange={e => handleValor(key, e.target.value)}
                  placeholder="—"
                  className="w-24 px-2 py-1.5 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                />
                <span className="text-xs text-slate-400 w-12">{ref.unidad}</span>
                {valores[key] !== undefined && (
                  <BadgeEstado valor={valores[key]!} param={key} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Datos clínicos para suplementación */}
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
              <input
                type="checkbox"
                checked={datosClinico.post_operatorio}
                onChange={e => setDatosClinico(p => ({ ...p, post_operatorio: e.target.checked }))}
                className="w-4 h-4 accent-[#1e5fa8]"
              />
              Paciente post-operatorio / en rehabilitación
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={datosClinico.inmovilizacion}
                onChange={e => setDatosClinico(p => ({ ...p, inmovilizacion: e.target.checked }))}
                className="w-4 h-4 accent-[#1e5fa8]"
              />
              Inmovilización / reposo prolongado
            </label>
          </div>
        </div>
      </div>

      {/* Botón analizar */}
      <button
        onClick={handleAnalizar}
        disabled={analizando || Object.keys(valores).length === 0}
        className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {analizando ? <><Loader2 size={18} className="animate-spin" /> Analizando...</> : '🔬 Analizar y Recomendar Suplementos'}
      </button>

      {/* Resultado del análisis */}
      {analisis && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="bg-[#e8f4fd] border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-[#1a3a5c] font-medium">{analisis.resumen_clinico}</p>
          </div>

          {/* Alertas */}
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

          {/* Suplementos */}
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
                          'bg-slate-100 text-slate-600'}`}
                      >
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

          {/* Guardar */}
          <div className="flex gap-3">
            <button
              onClick={handleGuardar}
              disabled={guardando || guardado}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {guardado ? <><CheckCircle size={16} /> Guardado</> : guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> Guardar en expediente</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
