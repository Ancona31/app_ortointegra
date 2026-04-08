'use client'

import { Consulta, Laboratorio, Alerta, SuplementoRec } from '@/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertTriangle, ChevronRight, FlaskConical, Stethoscope,
  Calendar, ArrowRight, Pill,
} from 'lucide-react'
import Link from 'next/link'

interface Props {
  id: string
  consultas: Consulta[]
  labs: Laboratorio[]
  isDoctor: boolean
  onVerConsultas: () => void
  onVerLaboratorios: () => void
}

export default function TabResumen({
  id,
  consultas,
  labs,
  isDoctor,
  onVerConsultas,
  onVerLaboratorios,
}: Props) {
  const ultima = consultas[0] ?? null

  /* ── Estado vacío ── */
  if (consultas.length === 0 && labs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <Stethoscope size={24} className="text-slate-400" />
        </div>
        <p className="text-[#1d1d1f] font-semibold text-sm">Sin actividad registrada</p>
        <p className="text-[#86868b] text-xs">Aún no hay consultas ni laboratorios para este paciente</p>
        {isDoctor && (
          <Link
            href={`/expediente/${id}/nueva-nota`}
            className="mt-2 px-4 py-2 bg-[#1e5fa8] text-white text-xs font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
          >
            Crear primera nota
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* ── Última visita ── */}
      {ultima && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Encabezado */}
          <div className="px-4 sm:px-6 pt-5 pb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1e5fa8] to-[#1a3a5c] flex items-center justify-center flex-shrink-0">
                <Stethoscope size={16} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Última visita</p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">
                  {format(parseISO(ultima.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
            </div>
            {ultima.proxima_cita && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-semibold text-emerald-700 flex-shrink-0">
                <Calendar size={11} />
                {ultima.proxima_cita}
              </div>
            )}
          </div>

          {/* Separador */}
          <div className="mx-4 sm:mx-6 border-t border-slate-100" />

          {/* Cuerpo */}
          <div className="px-4 sm:px-6 py-4 space-y-4">

            {/* Motivo */}
            <div>
              <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">Motivo</p>
              <p className="text-sm text-[#1d1d1f] font-medium">{ultima.motivo_consulta}</p>
            </div>

            {/* Diagnósticos */}
            {ultima.diagnosticos && ultima.diagnosticos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Diagnóstico</p>
                <div className="flex flex-wrap gap-1.5">
                  {ultima.diagnosticos.map((d, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-blue-50 text-[#1a3a5c] border border-blue-100 rounded-full font-medium">
                      {d.codigo_cie10 && <span className="text-[#4a9fd4] font-semibold">{d.codigo_cie10}</span>}
                      {d.descripcion}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Plan */}
            {ultima.plan_tratamiento && (
              <div>
                <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">Plan</p>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{ultima.plan_tratamiento}</p>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex justify-end">
            <Link
              href={`/expediente/${id}/consulta/${ultima.id}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors"
            >
              Ver nota completa <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* ── Consultas recientes ── */}
      {consultas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1d1d1f]">Consultas recientes</p>
            {consultas.length > 3 && (
              <button
                onClick={onVerConsultas}
                className="text-xs font-semibold text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors"
              >
                Ver todas ({consultas.length})
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {consultas.slice(0, 3).map((c, idx) => (
              <Link
                key={c.id}
                href={`/expediente/${id}/consulta/${c.id}`}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 transition-colors group"
              >
                {/* Línea de tiempo */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-[#1e5fa8]' : 'bg-slate-300'}`} />
                  {idx < Math.min(consultas.length, 3) - 1 && (
                    <div className="w-px h-8 bg-slate-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-sm font-medium text-[#1d1d1f] truncate">{c.motivo_consulta}</p>
                  <p className="text-xs text-[#86868b] mt-0.5">
                    {format(parseISO(c.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                    {c.diagnosticos && c.diagnosticos.length > 0 && (
                      <span className="text-slate-400"> · {c.diagnosticos[0].descripcion}</span>
                    )}
                  </p>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-[#1e5fa8] transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Último laboratorio ── */}
      {labs.length > 0 && (() => {
        const lab = labs[0]
        const alterados = lab.resultados?.filter(r => r.estado === 'bajo' || r.estado === 'alto' || r.estado === 'suboptimo') || []
        const criticos = lab.analisis_ia?.alertas?.filter((a: Alerta) => a.tipo === 'critica') || []
        return (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1d1d1f]">Último laboratorio</p>
              <button
                onClick={onVerLaboratorios}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Ver historial
              </button>
            </div>
            <Link
              href={`/expediente/${id}/laboratorios/${lab.id}`}
              className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-t border-slate-100 hover:bg-slate-50/80 transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <FlaskConical size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {format(parseISO(lab.fecha_toma), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                <p className="text-xs text-[#86868b] mt-0.5">
                  {lab.resultados?.length || 0} parámetros
                  {alterados.length > 0 && (
                    <span className="text-red-500 font-semibold"> · {alterados.length} alterados</span>
                  )}
                </p>
                {criticos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {criticos.slice(0, 2).map((a: Alerta, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-red-50 border border-red-100 text-red-600 rounded-lg px-2 py-0.5 font-medium">
                        <AlertTriangle size={10} /> {a.mensaje}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
            </Link>
          </div>
        )
      })()}

      {/* ── Suplementos recomendados ── */}
      {labs.length > 0 && labs[0].analisis_ia?.suplementos_recomendados?.length ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 pt-5 pb-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center">
              <Pill size={13} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-[#1d1d1f]">Suplementos recomendados</p>
            <span className="text-[10px] text-[#86868b] ml-auto">Basado en último lab</span>
          </div>
          <div className="px-4 sm:px-6 pb-5 pt-1 flex flex-wrap gap-2">
            {labs[0].analisis_ia!.suplementos_recomendados.map((s: SuplementoRec, i: number) => (
              <span key={i} className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
                s.prioridad === 'alta'  ? 'bg-red-50 border-red-100 text-red-600'   :
                s.prioridad === 'media' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                         'bg-slate-50 border-slate-200 text-slate-600'
              }`}>{s.nombre}</span>
            ))}
          </div>
        </div>
      ) : null}

    </div>
  )
}
