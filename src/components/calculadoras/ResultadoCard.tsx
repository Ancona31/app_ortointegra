'use client'

import { CheckCircle2, AlertTriangle, AlertCircle, Info, type LucideIcon } from 'lucide-react'
import type { Calculadora, ResultadoInterpretacion } from '@/lib/calculadoras/types'

type Props = {
  resultado: ResultadoInterpretacion
  calculadora: Calculadora
}

type Paleta = {
  bg: string
  border: string
  text: string
  accent: string
  icon: LucideIcon
}

const PALETAS: Record<ResultadoInterpretacion['color'], Paleta> = {
  verde:    { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-900',  accent: 'text-green-600',  icon: CheckCircle2 },
  amarillo: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-900',  accent: 'text-amber-600',  icon: AlertTriangle },
  rojo:     { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-900',    accent: 'text-red-600',    icon: AlertCircle },
  gris:     { bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-900',  accent: 'text-slate-600',  icon: Info },
}

export default function ResultadoCard({ resultado, calculadora }: Props) {
  const paleta = PALETAS[resultado.color]
  const Icon = paleta.icon

  return (
    <section
      className={`rounded-2xl border p-6 ${paleta.bg} ${paleta.border}`}
      style={{ animation: 'slideUp 0.32s cubic-bezier(0.32, 0.72, 0, 1) both' }}
      aria-live="polite"
    >
      <div className="flex items-start gap-3 mb-4">
        <Icon size={22} className={paleta.accent} strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase ${paleta.accent}`} style={{ letterSpacing: '0.06em' }}>
            Resultado · {calculadora.nombre}
          </p>
          {resultado.categoria && (
            <p className={`text-lg font-semibold mt-1 ${paleta.text}`}>{resultado.categoria}</p>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className={`font-bold ${paleta.text}`} style={{ fontSize: '52px', letterSpacing: '-1.5px' }}>
          {resultado.valor}
        </span>
        {resultado.unidad && (
          <span className={`text-lg font-medium ${paleta.accent}`}>{resultado.unidad}</span>
        )}
      </div>

      <p className={`text-sm leading-relaxed ${paleta.text} opacity-85`}>{resultado.texto}</p>

      {resultado.observaciones && resultado.observaciones.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {resultado.observaciones.map((obs, i) => (
            <li key={i} className={`text-sm leading-relaxed ${paleta.text} opacity-80 flex gap-2`}>
              <span className={`${paleta.accent} mt-0.5`}>•</span>
              <span>{obs}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
