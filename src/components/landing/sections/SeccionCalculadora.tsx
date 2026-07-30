'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'

/* Section: Calculadora de Tiempo Ahorrado */
export default function SeccionCalculadora() {
  const [notasPorDia, setNotasPorDia] = useState(15)
  const minutosPorNota = 12
  const horasSemanales = Math.round((notasPorDia * minutosPorNota * 5) / 60)

  return (
    <section className="bg-slate-100/40 backdrop-blur-md border-y border-white/30">
      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-20 sm:py-28">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-50 rounded-full px-3.5 py-1 mb-6">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Beneficio real</span>
          </div>
          <h2 className="text-[28px] sm:text-[38px] font-bold text-slate-900 tracking-tight leading-[1.15]">
            ¿Cuánto tiempo{' '}
            <span className="bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">recuperarías?</span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-500 leading-relaxed max-w-xl mx-auto">
            Cada nota médica que la IA estructura por ti son 12 minutos que recuperas. Mueve el control y ve el impacto en tu semana.
          </p>
        </div>

        {/* Slider */}
        <div className="bg-white/30 backdrop-blur-md rounded-3xl border border-white/30 p-8 sm:p-10 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[14px] font-semibold text-slate-700">Notas médicas al día</label>
            <span className="text-[28px] font-bold bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] bg-clip-text text-transparent">{notasPorDia}</span>
          </div>
          <input
            type="range"
            min={5}
            max={40}
            value={notasPorDia}
            onChange={e => setNotasPorDia(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-[#1e5fa8]"
          />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>5</span>
            <span>40</span>
          </div>

          {/* Resultado */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-baseline gap-2">
              <span className="text-[48px] sm:text-[56px] font-bold bg-gradient-to-r from-[#1a3a5c] to-[#4a9fd4] bg-clip-text text-transparent leading-none">{horasSemanales}</span>
              <span className="text-[18px] font-semibold text-slate-400">horas/semana</span>
            </div>
            <p className="mt-3 text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
              Con la IA de Spinus, podrías recuperar hasta <strong className="text-slate-800">{horasSemanales} horas a la semana</strong> para tu familia, investigación o más consultas.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] text-white px-7 py-3.5 rounded-2xl text-[15px] font-semibold shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Empieza a ahorrar tiempo hoy
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
