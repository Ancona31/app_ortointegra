'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Laboratorio, VALORES_REFERENCIA, ParametroLab } from '@/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, FlaskConical, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const PARAMETROS = Object.entries(VALORES_REFERENCIA) as [ParametroLab, typeof VALORES_REFERENCIA[ParametroLab]][]

function BadgeEstado({ valor, param }: { valor: number; param: ParametroLab }) {
  const ref = VALORES_REFERENCIA[param]
  const optMax = 'opt_max' in ref ? ref.opt_max : null
  const optMin = 'opt_min' in ref ? ref.opt_min : null

  let estado: 'optimo' | 'suboptimo' | 'bajo' = 'optimo'
  if (optMax !== null && valor > optMax) estado = 'suboptimo'
  if (optMin !== null && valor < optMin) estado = 'suboptimo'
  if ((ref as any).ref_min !== null && valor < (ref as any).ref_min) estado = 'bajo'
  if ((ref as any).ref_max !== null && valor > (ref as any).ref_max) estado = 'bajo'

  if (estado === 'optimo') return <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Óptimo</span>
  if (estado === 'suboptimo') return <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Sub-óptimo</span>
  return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Fuera de rango</span>
}

export default function LabDetallePage() {
  const { id, labId } = useParams<{ id: string; labId: string }>()
  const [lab, setLab] = useState<Laboratorio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('laboratorios').select('*').eq('id', labId).single()
      .then(({ data }) => { setLab(data); setLoading(false) })
  }, [labId])

  if (loading) return <div className="text-center py-12 text-slate-400">Cargando...</div>
  if (!lab) return <div className="text-center py-12 text-slate-400">Laboratorio no encontrado</div>

  const v = lab.valores || {}
  const valoresConDatos = PARAMETROS.filter(([k]) => v[k] !== undefined)
  const analisis = lab.analisis_ia

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/expediente/${id}`} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
            <FlaskConical size={22} /> Laboratorios
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {format(parseISO(lab.fecha_toma), "dd 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Resumen clínico */}
      {analisis?.resumen_clinico && (
        <div className="bg-[#e8f4fd] border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-[#1a3a5c] font-medium">{analisis.resumen_clinico}</p>
        </div>
      )}

      {/* Alertas */}
      {analisis?.alertas && analisis.alertas.length > 0 && (
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

      {/* Valores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Valores registrados</h2>
        </div>
        {valoresConDatos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Sin valores registrados</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {valoresConDatos.map(([key, ref]) => (
              <div key={key} className="flex items-center px-5 py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{ref.label}</p>
                  <p className="text-xs text-slate-400">
                    Ref: {(ref as any).ref_min ?? '–'}–{(ref as any).ref_max ?? '–'} {ref.unidad} ·
                    Meta: {(ref as any).opt_min ? `${(ref as any).opt_min}–` : '< '}{(ref as any).opt_max ?? (ref as any).opt_min} {ref.unidad}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-800">{v[key]} <span className="font-normal text-slate-400">{ref.unidad}</span></span>
                  <BadgeEstado valor={v[key]!} param={key} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suplementos recomendados */}
      {analisis?.suplementos_recomendados && analisis.suplementos_recomendados.length > 0 && (
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

      {/* Ir a suplementación */}
      {analisis?.suplementos_recomendados && analisis.suplementos_recomendados.length > 0 && (
        <Link
          href={`/expediente/${id}/documentos?tipo=suplementacion`}
          className="flex items-center justify-center gap-2 w-full py-3 border-2 border-amber-400 text-amber-700 rounded-xl font-medium hover:bg-amber-50 transition-colors text-sm"
        >
          Generar plan de suplementación →
        </Link>
      )}
    </div>
  )
}
