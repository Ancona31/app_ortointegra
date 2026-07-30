'use client'

import { Search, Zap, FolderOpen, Share2 } from 'lucide-react'

/* Section: Expediente electrónico */
export default function SeccionExpediente() {
  return (
    <section className="bg-slate-100/40 backdrop-blur-md border-y border-white/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-3.5 py-1 mb-6">
              <FolderOpen className="w-3.5 h-3.5 text-[#1e5fa8]" />
              <span className="text-[11px] font-semibold text-[#1e5fa8] uppercase tracking-wider">Expediente electrónico</span>
            </div>
            <h2 className="text-[28px] sm:text-[38px] font-bold text-slate-900 tracking-tight leading-[1.15]">
              El expediente que se adapta a tu ritmo,
              <br className="hidden sm:block" />
              <span className="text-slate-400">no al revés</span>
            </h2>
            <p className="mt-5 text-[16px] text-slate-500 leading-relaxed max-w-lg">
              Diseñado para que captures la información clínica en el menor número de clics posible. Notas médicas, laboratorios, imagen, recetas y consentimientos — todo vinculado al mismo paciente, accesible al instante.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { icon: <Zap className="w-4 h-4 text-amber-500" />, text: 'Nota médica generada con IA en segundos — tú solo validas y firmas' },
                { icon: <Search className="w-4 h-4 text-violet-500" />, text: 'Búsqueda global con Ctrl+K — encuentra cualquier paciente al instante' },
                { icon: <Share2 className="w-4 h-4 text-emerald-500" />, text: 'Envía documentos por email o genera QR verificable para recetas' },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <p className="text-[14px] text-slate-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mini mockup: patient record */}
          <div className="bg-[#f8fafc] rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
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
