'use client'

import { Sparkles } from 'lucide-react'

/* Section: Powered by AI
   Superficie FRANJA (§3.1). Alternancia de F1.3·b1: Features blanca →
   IA franja → Expediente blanca. El `border-y border-white/30` del glass
   anterior NO se sustituye: con alternancia, filete y escalón de color son
   el mismo separador dicho dos veces, y el filete (1.20:1) tapa al escalón
   (1.065:1) dejándolo decorativo. Separa la superficie, no el borde. */
export default function SeccionIA() {
  return (
    <section className="bg-[#f5f8fc]">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 sm:p-14">
          {/* Subtle shine */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
            {/* AI logo */}
            <div className="flex-shrink-0">
              {/* `bg-white/10` se queda: es un tinte sobre navy opaco, misma
                  familia que los chips de abajo y que el ghost del CTA — no es
                  glassmorphism. El `backdrop-blur-sm` sí salió: desenfocar un
                  degradado opaco no produce nada visible, solo coste. */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 flex items-center justify-center">
                <Sparkles className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
              </div>
            </div>

            {/* Text */}
            <div className="text-center lg:text-left flex-1">
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-3">Potenciado por inteligencia artificial</p>
              {/* §7·4: el subtitular ES el titular. El h2 anterior ("Spinus es
                  tu aliado / para cada consulta") no salía del maestro, y la
                  primera oración del párrafo que vivía aquí se eliminó por dos
                  motivos: afirmaba "te asiste en tiempo real" (prohibido
                  mientras el bug de sync siga abierto, §11) y su contenido
                  —analiza laboratorios, estructura notas— ya lo dicen los
                  chips. */}
              <h2 className="text-[24px] sm:text-[30px] font-bold text-white tracking-tight leading-tight">
                Tú aportas el criterio clínico — Spinus se encarga del trabajo pesado.
              </h2>
              {/* Chips: HOY son etiquetas, no controles. En F4 se vuelven el
                  selector del Teaser 1 (§5.4) y ahí pasan a <button>; mientras
                  tanto siguen siendo <span> a propósito. El de búsqueda salió
                  en c2: Ctrl+K no es IA (§7·4). */}
              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                {['Notas médicas con IA', 'Análisis de laboratorios'].map((tag) => (
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
