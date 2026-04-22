'use client'

import { Activity, Plus } from 'lucide-react'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

type Props = {
  pacienteId: string
}

export default function SeccionMedicionesLabs({ pacienteId: _pacienteId }: Props) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-slate-900">
          Mediciones longitudinales
        </h2>
        <button
          type="button"
          onClick={() => console.log('TODO: sub-fase 3')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm active:scale-[0.98] transition-all duration-200"
          style={{ transitionTimingFunction: IOS_EASING }}
        >
          <Plus size={14} /> Agregar medición
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-[18px]">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
            <Activity size={18} />
          </div>
          <p className="text-[13px] font-medium text-slate-700">
            Sin mediciones registradas.
          </p>
          <p className="text-[12px] text-slate-500 mt-1">
            Agrega tu primer dato para comenzar el seguimiento.
          </p>
        </div>
      </div>
    </section>
  )
}
