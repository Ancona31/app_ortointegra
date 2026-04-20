'use client'

import { useMemo, useState } from 'react'
import type {
  Calculadora,
  CalculadoraInput,
  ResultadoInterpretacion,
} from '@/lib/calculadoras/types'

type Valores = Record<string, string | number | boolean>

type Props = {
  calculadora: Calculadora
  valoresIniciales?: Valores
  camposAutocompletados?: Set<string>
  onCalcular: (resultado: ResultadoInterpretacion, inputs: Record<string, unknown>) => void
}

function inicializar(inputs: CalculadoraInput[], iniciales?: Valores): Valores {
  const out: Valores = {}
  for (const i of inputs) {
    if (iniciales && iniciales[i.key] !== undefined && iniciales[i.key] !== null) {
      out[i.key] = iniciales[i.key]
    } else if (i.tipo === 'checkbox') {
      out[i.key] = false
    } else {
      out[i.key] = ''
    }
  }
  return out
}

export default function CalculadoraForm({
  calculadora,
  valoresIniciales,
  camposAutocompletados,
  onCalcular,
}: Props) {
  const [valores, setValores] = useState<Valores>(() =>
    inicializar(calculadora.inputs, valoresIniciales),
  )

  const invalido = useMemo(() => {
    for (const i of calculadora.inputs) {
      if (i.tipo === 'checkbox') continue
      const requerido = (i as { requerido?: boolean }).requerido
      if (!requerido) continue
      const v = valores[i.key]
      if (v === '' || v === undefined || v === null) return true
      if (i.tipo === 'number' && Number.isNaN(Number(v))) return true
    }
    return false
  }, [valores, calculadora.inputs])

  function handleCalcular() {
    if (invalido) return
    const inputs: Record<string, unknown> = {}
    for (const i of calculadora.inputs) {
      const raw = valores[i.key]
      if (i.tipo === 'number') inputs[i.key] = Number(raw)
      else if (i.tipo === 'checkbox') inputs[i.key] = Boolean(raw)
      else inputs[i.key] = raw
    }
    const cruda = calculadora.calcular(inputs as never)
    const interp = calculadora.interpretar(cruda, inputs as never)
    onCalcular(interp, inputs)
  }

  return (
    <div className="space-y-5">
      {calculadora.inputs.map(input => {
        const autocompletado = camposAutocompletados?.has(input.key)

        if (input.tipo === 'number') {
          return (
            <div key={input.key}>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                <span>{input.label}</span>
                {input.unidad && <span className="text-xs text-slate-400">({input.unidad})</span>}
                {autocompletado && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    Del paciente
                  </span>
                )}
              </label>
              <input
                type="number"
                value={valores[input.key] as string | number}
                min={input.min}
                max={input.max}
                step={input.step}
                placeholder={input.placeholder}
                onChange={e => setValores(prev => ({ ...prev, [input.key]: e.target.value }))}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] text-slate-900 outline-none transition-all duration-200"
                style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--cp)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--cp) 18%, transparent)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = ''
                  e.currentTarget.style.boxShadow = ''
                }}
              />
            </div>
          )
        }

        if (input.tipo === 'select') {
          return (
            <div key={input.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {input.label}
              </label>
              <select
                value={valores[input.key] as string}
                onChange={e => setValores(prev => ({ ...prev, [input.key]: e.target.value }))}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] text-slate-900 outline-none appearance-none cursor-pointer transition-all duration-200"
                style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
              >
                <option value="">Selecciona…</option>
                {input.opciones.map(o => (
                  <option key={o.valor} value={o.valor}>{o.label}</option>
                ))}
              </select>
            </div>
          )
        }

        return (
          <label key={input.key} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={Boolean(valores[input.key])}
              onChange={e => setValores(prev => ({ ...prev, [input.key]: e.target.checked }))}
              className="mt-0.5 w-5 h-5 rounded-md border-slate-300 cursor-pointer"
              style={{ accentColor: 'var(--cp)' }}
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                {input.label}
              </span>
              {input.descripcion && (
                <p className="text-xs text-slate-500 mt-0.5">{input.descripcion}</p>
              )}
            </div>
          </label>
        )
      })}

      <button
        type="button"
        onClick={handleCalcular}
        disabled={invalido}
        className="w-full py-3 rounded-xl font-semibold text-white text-[15px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        style={{
          background: 'var(--cp)',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: invalido ? 'none' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px color-mix(in srgb, var(--cp) 25%, transparent)',
        }}
      >
        Calcular
      </button>
    </div>
  )
}
