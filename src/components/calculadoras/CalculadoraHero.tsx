'use client'

import type { Calculadora } from '@/lib/calculadoras/types'
import { getEspecialidad } from '@/lib/calculadoras/categorias'

type Props = { calculadora: Calculadora }

export default function CalculadoraHero({ calculadora }: Props) {
  const esp = getEspecialidad(calculadora.especialidad)
  const Icon = esp.icon

  return (
    <header className="flex items-start gap-4 mb-8">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${esp.color}14`, color: esp.color }}
      >
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[11px] font-semibold uppercase mb-1.5"
          style={{ letterSpacing: '0.08em', color: esp.color }}
        >
          {esp.nombre}
        </p>
        <h1
          className="text-slate-900 font-bold leading-tight"
          style={{ fontSize: '36px', letterSpacing: '-1px' }}
        >
          {calculadora.nombre}
        </h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {calculadora.descripcion}
        </p>
        {calculadora.fuente && (
          <p className="text-xs text-slate-400 italic mt-1.5">
            Basado en: {calculadora.fuente}
          </p>
        )}
      </div>
    </header>
  )
}
