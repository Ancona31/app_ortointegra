'use client'

import { Consulta } from '@/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, ChevronRight, PenLine, Stethoscope } from 'lucide-react'
import Link from 'next/link'

interface Props {
  id: string
  consultas: Consulta[]
  isDoctor: boolean
  hayMas?: boolean
  cargandoMas?: boolean
  onCargarMas?: () => void
}

export default function TabConsultas({ id, consultas, isDoctor, hayMas, cargandoMas, onCargarMas }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {consultas.length === 0 ? (
        <div className="p-10 text-center">
          <Calendar size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Sin consultas registradas</p>
          {isDoctor && (
            <Link href={`/expediente/${id}/nueva-nota`} className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">
              Crear primera nota →
            </Link>
          )}
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800 group-hover:text-[#1a3a5c]">{c.motivo_consulta}</p>
                    {c.nota_origen === 'manual' ? (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">
                        <PenLine size={8} />
                        Manual
                      </span>
                    ) : (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#4285F4]/8 text-[#4285F4] border border-[#4285F4]/15">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 13.8 9 19 12C13.8 15 12 22 12 22C12 22 10.2 15 5 12C10.2 9 12 2 12 2Z" fill="currentColor"/></svg>
                        IA
                      </span>
                    )}
                  </div>
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
      {hayMas && onCargarMas && (
        <button onClick={onCargarMas} disabled={cargandoMas}
          className="w-full py-3 text-sm text-[#1e5fa8] font-medium hover:bg-slate-50 transition-colors border-t border-slate-100 disabled:opacity-50">
          {cargandoMas ? 'Cargando...' : 'Cargar más consultas'}
        </button>
      )}
    </div>
  )
}
