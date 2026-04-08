'use client'

import { Laboratorio, Alerta } from '@/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronRight, FlaskConical, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  id: string
  labs: Laboratorio[]
  isDoctor: boolean
  confirmarEliminar: string | null
  eliminandoLab: string | null
  onConfirmarEliminar: (labId: string | null) => void
  onEliminarLab: (labId: string) => void
}

export default function TabLaboratorios({
  id,
  labs,
  isDoctor,
  confirmarEliminar,
  eliminandoLab,
  onConfirmarEliminar,
  onEliminarLab,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {labs.length === 0 ? (
        <div className="p-10 text-center">
          <FlaskConical size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Sin laboratorios registrados</p>
          {isDoctor && (
            <Link href={`/expediente/${id}/laboratorios/nuevo`} className="text-emerald-600 text-sm mt-2 inline-block hover:underline">
              Subir primer laboratorio →
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {labs.map(lab => {
            const alterados = lab.resultados?.filter(r => r.estado === 'bajo' || r.estado === 'alto' || r.estado === 'suboptimo').length || 0
            const totalResultados = lab.resultados?.length || 0
            const alertas = lab.analisis_ia?.alertas?.filter((a: Alerta) => a.tipo === 'critica') || []
            const suplementos = lab.analisis_ia?.suplementos_recomendados?.length || 0
            const confirmando = confirmarEliminar === lab.id
            return (
              <div key={lab.id}>
                {confirmando && (
                  <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between gap-3">
                    <p className="text-sm text-red-700 font-medium">¿Eliminar este laboratorio?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onConfirmarEliminar(null)}
                        className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => onEliminarLab(lab.id)}
                        disabled={eliminandoLab === lab.id}
                        className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-1"
                      >
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
                    {isDoctor && (
                      <button
                        onClick={() => onConfirmarEliminar(confirmando ? null : lab.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      >
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
  )
}
