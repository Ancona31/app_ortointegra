'use client'

import { Calendar, Zap, MousePointerClick } from 'lucide-react'

/* Section: Interfaz intuitiva */
export default function SeccionInterfaz() {
  return (
    <section className="bg-slate-100/40 backdrop-blur-md border-y border-white/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: visual */}
          <div className="order-2 lg:order-1">
            <div className="bg-[#f8fafc] rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Flujo de trabajo típico</p>
              {[
                { step: '1', label: 'Paciente llega', desc: 'La tarjeta "Próxima cita" te muestra quién sigue', time: '0 clics', color: 'from-[#1a3a5c] to-[#1e5fa8]' },
                { step: '2', label: 'Abrir expediente', desc: 'Un clic desde la cita → expediente completo', time: '1 clic', color: 'from-violet-600 to-violet-500' },
                { step: '3', label: 'Nota médica con IA', desc: 'Describe los hallazgos, la IA estructura la nota', time: '30 seg', color: 'from-emerald-500 to-emerald-600' },
                { step: '4', label: 'Generar receta', desc: 'Selecciona medicamentos, genera PDF con QR', time: '2 clics', color: 'from-amber-500 to-amber-600' },
                { step: '5', label: 'Enviar al paciente', desc: 'Email automático con la receta adjunta', time: '1 clic', color: 'from-rose-500 to-rose-600' },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4 bg-white rounded-xl border border-slate-200/60 px-4 py-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-[12px] font-bold text-white">{item.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: text */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 bg-emerald-50 rounded-full px-3.5 py-1 mb-6">
              <MousePointerClick className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Interfaz intuitiva</span>
            </div>
            <h2 className="text-[28px] sm:text-[38px] font-bold text-slate-900 tracking-tight leading-[1.15]">
              Si sabes usar tu celular,{' '}
              <br className="hidden sm:block" />
              <span className="text-slate-400">ya sabes usar Spinus®</span>
            </h2>
            <p className="mt-5 text-[16px] text-slate-500 leading-relaxed max-w-lg">
              Sin manuales, sin capacitaciones. Cada pantalla está diseñada para que el siguiente paso sea obvio. El flujo completo de una consulta — desde que llega el paciente hasta que se va con su receta — en menos de 5 clics.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { icon: <MousePointerClick className="w-4 h-4 text-emerald-500" />, text: 'Cero curva de aprendizaje — diseñada con las convenciones que ya conoces de tu celular y computadora' },
                { icon: <Zap className="w-4 h-4 text-amber-500" />, text: 'Atajos de teclado para todo — Ctrl+K busca, Escape cierra, Enter confirma' },
                { icon: <Calendar className="w-4 h-4 text-violet-500" />, text: 'Drag & drop en la agenda — arrastra citas como en Google Calendar' },
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
        </div>
      </div>
    </section>
  )
}
