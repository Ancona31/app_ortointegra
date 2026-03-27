'use client'

import { Consulta, Laboratorio } from '@/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, ChevronRight, FlaskConical, Stethoscope } from 'lucide-react'
import Link from 'next/link'

interface Props {
  id: string
  consultas: Consulta[]
  labs: Laboratorio[]
  isDoctor: boolean
  onVerConsultas: () => void
  onVerLaboratorios: () => void
  diagnosticos: { codigo_cie10?: string; descripcion: string }[]
}

export default function TabResumen({
  id,
  consultas,
  labs,
  isDoctor,
  onVerConsultas,
  onVerLaboratorios,
  diagnosticos,
}: Props) {
  return (
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
            <button onClick={onVerConsultas} className="text-xs text-[#1e5fa8] hover:underline">Ver todas →</button>
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
        const criticos = lab.analisis_ia?.alertas?.filter((a: any) => a.tipo === 'critica') || []
        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 text-sm">Último laboratorio</h3>
              <button onClick={onVerLaboratorios} className="text-xs text-emerald-600 hover:underline">Ver historial →</button>
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
                  {criticos.slice(0, 2).map((a: any, i: number) => (
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
            {labs[0].analisis_ia!.suplementos_recomendados.map((s: any, i: number) => (
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
  )
}
