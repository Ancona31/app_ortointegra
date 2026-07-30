'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/* CTA
   Lavado de --cs al 4% (§3.1, banda 3–5%) — sustituye al NeuralBackground.
   La <section> es full-bleed para que el lavado no quede como banda centrada;
   la restricción de ancho baja al <div> interior. Hex literal, NO var(--cs):
   el provider que la define solo se monta en (app)/layout.tsx, así que en la
   landing pública var() nunca resolvería. */
export default function SeccionCTA() {
  return (
    <section style={{ background: 'color-mix(in srgb, #1e5fa8 4%, #fff)' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* Degradado VERTICAL (to-b). §7·13 prohíbe izq→der aquí: en un bloque
            de ancho completo el eje horizontal delata la caja y parte el
            titular en dos temperaturas. El par de color no cambia. */}
        {/* F1.3·c2 — 16px (`rounded-2xl`), no 24. Los dos bloques navy de la
            landing (este y el de SeccionIA) eran las dos únicas superficies a
            rounded-3xl: un tercer radio existiendo solo para ellos. 16 es el
            valor de superficie del sistema y aquí no hay motivo para excepción.
            Ver la escala completa en SeccionInterfaz.tsx. */}
        {/* F1.3·c3 — `p-8 sm:p-12` (32/48), no 40/56. Ver SeccionIA.tsx: los
            dos bloques navy comparten padding interior. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#1a3a5c] to-[#1e5fa8] p-8 sm:p-12 text-center shadow-[0_8px_32px_rgba(30,95,168,0.3)]">
          {/* Shine overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

          <h2 className="relative text-[24px] sm:text-[30px] font-bold text-white tracking-tight max-w-2xl mx-auto">
            Tu consultorio merece software hecho para ayudarte, no para cumplir un requisito.
          </h2>
          <p className="relative mt-3 text-[15px] text-white/70 max-w-lg mx-auto">
            Sin pláticas con vendedores. Sin letras chiquitas. Sin trámites.
            <br />
            Crea tu cuenta y empieza a usarla hoy — así de simple.
          </p>
          {/* Mismo par de CTAs que el hero (§7·13), con las mismas etiquetas:
              "Empieza gratis" + "Ver planes". El secundario NO puede copiar el
              del hero (blanco sólido sobre fondo claro) porque aquí competiría
              con el primario blanco sobre navy — va en ghost. El `relative` se
              movió al contenedor: lo necesita para quedar sobre el shine. */}
          <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-[#1a3a5c] px-7 py-3.5 rounded-xl text-[15px] font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Empieza gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center px-7 py-3.5 rounded-xl text-[15px] font-semibold text-white border border-white/30 hover:bg-white/10 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
