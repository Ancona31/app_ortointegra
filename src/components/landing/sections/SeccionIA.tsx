'use client'

import { Sparkles } from 'lucide-react'

/* Section: Powered by AI */
export default function SeccionIA() {
  return (
    <section className="bg-slate-100/40 backdrop-blur-md border-y border-white/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 sm:p-14">
          {/* Subtle shine */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
            {/* AI logo */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
              </div>
            </div>

            {/* Text */}
            <div className="text-center lg:text-left flex-1">
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-3">Potenciado por inteligencia artificial</p>
              <h2 className="text-[24px] sm:text-[30px] font-bold text-white tracking-tight leading-tight">
                Spinus es tu aliado
                <br className="hidden sm:block" />
                <span className="text-[#4a9fd4]">
                  para cada consulta
                </span>
              </h2>
              <p className="mt-4 text-[15px] text-white/60 leading-relaxed max-w-lg mx-auto lg:mx-0">
                La IA analiza laboratorios, estructura notas médicas y te asiste en tiempo real. Tú aportas el criterio clínico — Spinus se encarga del trabajo pesado.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                {['Notas médicas con IA', 'Análisis de laboratorios', 'Consulta rápida'].map((tag) => (
                  <span key={tag} className="text-[11px] font-medium text-white/70 bg-white/10 px-3 py-1.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
