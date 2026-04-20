'use client'

import Link from 'next/link'
import { Stethoscope, FileText, Calculator } from 'lucide-react'

interface Props {
  pacienteId: string
  onAbrirConsultas: () => void
  onAbrirDocumentos: () => void
}

export default function AccesosRapidos({ pacienteId, onAbrirConsultas, onAbrirDocumentos }: Props) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <button
          onClick={onAbrirConsultas}
          className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
            <Stethoscope size={18} className="text-[#1e5fa8]" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Consultas</p>
            <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">Historial clínico</p>
          </div>
        </button>

        <button
          onClick={onAbrirDocumentos}
          className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
            <FileText size={18} className="text-sky-600" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Documentos</p>
            <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">Recetas y solicitudes</p>
          </div>
        </button>

        <Link
          href={`/calculadoras-clinicas?paciente=${pacienteId}`}
          className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
            <Calculator size={18} className="text-emerald-600" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Calculadoras</p>
            <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">Con contexto del paciente</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
