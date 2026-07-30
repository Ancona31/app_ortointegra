'use client'

import { Search, Zap, FolderOpen, QrCode, Layers } from 'lucide-react'

/* Section: Expediente electrónico
   Superficie BLANCA (§3.1). El `bg-white` va EXPLÍCITO, no por ausencia de
   clase: la alternancia es un sistema y debe leerse en el código.
   Que sea blanca protege además al panel de la izquierda: su `#f8fafc`
   contra franja `#f5f8fc` daría 1.02:1 e invertido (el panel más claro que
   su fondo). Sobre blanco al menos va en el sentido correcto. */
export default function SeccionExpediente() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        {/* §3.4: dos columnas invertidas — medio a la izquierda, texto a la
            derecha. La inversión va con order-*, NO moviendo el JSX: en móvil
            (una columna) debe seguir leyéndose texto → mockup, para no abrir
            la sección con una UI falsa (LP-DT-13). */}
        {/* F1.3·c3 — `lg:gap-24` (96), no gap-20: 80 no está en la escala de
            §3.3. Las tres secciones de dos columnas (esta, Interfaz e
            Historia) comparten el mismo par `gap-12 lg:gap-24`. */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-3.5 py-1 mb-6">
              <FolderOpen className="w-3.5 h-3.5 text-[#1e5fa8]" />
              {/* F1.3·d1 — rol kicker: 12px · +0.12em · 1.0. Ver SeccionHero.tsx. */}
              <span className="text-[12px] font-semibold text-[#1e5fa8] uppercase tracking-[0.12em] leading-none">Expediente electrónico</span>
            </div>
            {/* F1.3·d2 — rol titular de sección: clamp(30,4vw,46) · -0.03em ·
                1.10. Ver SeccionFeatures.tsx. */}
            <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-slate-900 tracking-[-0.03em] leading-[1.10]">
              El expediente que se adapta a tu ritmo,
              <br className="hidden sm:block" />
              <span className="text-slate-400">no al revés</span>
            </h2>
            <p className="mt-6 text-[16px] text-slate-500 leading-relaxed max-w-lg">
              Diseñado para que captures la información clínica en el menor número de clics posible. Notas médicas, laboratorios, imagen, recetas y consentimientos — todo vinculado al mismo paciente, accesible al instante.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { icon: <Zap className="w-4 h-4 text-amber-500" />, text: 'Nota médica que la IA estructura — tú validas y firmas' },
                { icon: <Search className="w-4 h-4 text-violet-500" />, text: 'Búsqueda rápida — ⌘K / Ctrl+K, encuentra cualquier paciente al instante' },
                { icon: <Layers className="w-4 h-4 text-sky-500" />, text: 'Guarda los cortes clave del estudio y ábrelos con el visor integrado' },
                { icon: <QrCode className="w-4 h-4 text-emerald-500" />, text: 'QR verificable en cada receta' },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  {/* `mt-0.5` = 2px: alineación ÓPTICA del cuadro de icono
                      contra la primera línea de texto, no ritmo. Excluido de
                      §3.3 por decisión de PM (c1) y ratificado en c3. No lo
                      subas a 8 ni lo reportes como fuera de escala. */}
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <p className="text-[14px] text-slate-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mini mockup: patient record — LP-DT-13, se elimina con el Video 1 */}
          <div className="order-2 lg:order-1 bg-[#f8fafc] rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] flex items-center justify-center text-white text-[13px] font-bold">CM</div>
              <div>
                <p className="text-[14px] font-semibold text-slate-800">Carlos Méndez Ríos</p>
                <p className="text-[11px] text-slate-400">Exp. #1042 &middot; 52 años &middot; Masculino</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['Notas (12)', 'Labs (8)', 'Imagen (5)', 'Recetas (15)'].map((tab) => (
                <div key={tab} className="bg-white rounded-xl border border-slate-200/60 px-3 py-2.5 text-center">
                  <p className="text-[12px] font-semibold text-slate-700">{tab}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { date: '05 Abr 2026', type: 'Nota médica', desc: 'Valoración columna lumbar — seguimiento', color: 'bg-blue-500' },
                { date: '28 Mar 2026', type: 'Laboratorio', desc: 'BHC, QS, PCR — análisis IA completado', color: 'bg-emerald-500' },
                { date: '15 Mar 2026', type: 'Imagen', desc: 'RMN columna lumbar L4-L5', color: 'bg-violet-500' },
              ].map((item) => (
                <div key={item.date} className="bg-white rounded-xl border border-slate-200/60 px-4 py-3 flex items-center gap-3">
                  <div className={`w-1.5 h-8 rounded-full ${item.color} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800">{item.type}</p>
                    <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
