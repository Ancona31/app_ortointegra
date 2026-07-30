'use client'

import { Calendar, Zap, MousePointerClick } from 'lucide-react'

/* Section: Interfaz intuitiva
   Superficie BLANCA (§3.1), explícita. Mismo motivo que en Expediente: el
   panel `#f8fafc` de la izquierda quedaría invertido sobre franja. */
export default function SeccionInterfaz() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: visual */}
          <div className="order-2 lg:order-1">
            <div className="bg-[#f8fafc] rounded-2xl border border-slate-200/60 p-6 shadow-sm space-y-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Flujo de trabajo típico</p>
              {/* `tone`: gradación de UN solo azul, del más claro (#1e5fa8, paso 1)
                  al más profundo (#1a3a5c, paso 5) — refuerza el avance del flujo.
                  Los 5 pasos interpolan SOLO entre esos dos valores de §3.1 con
                  color-mix; inventar azules intermedios sería color fuera de
                  tabla (§12). Los 5 tonos pasan AA con texto blanco. */}
              {[
                { step: '1', label: 'Paciente llega', desc: 'La tarjeta "Próxima cita" te muestra quién sigue', tone: '#1e5fa8' },
                { step: '2', label: 'Abrir expediente', desc: 'Un clic desde la cita', tone: 'color-mix(in srgb, #1e5fa8 75%, #1a3a5c)' },
                { step: '3', label: 'Nota médica con IA', desc: 'Describe los hallazgos, la IA estructura la nota', tone: 'color-mix(in srgb, #1e5fa8 50%, #1a3a5c)' },
                { step: '4', label: 'Generar receta', desc: 'Selecciona medicamentos, sale membretada y con QR', tone: 'color-mix(in srgb, #1e5fa8 25%, #1a3a5c)' },
                { step: '5', label: 'Enviar al paciente', desc: 'Email automático con la receta adjunta', tone: '#1a3a5c' },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4 bg-white rounded-xl border border-slate-200/60 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.tone }}>
                    <span className="text-[12px] font-bold text-white">{item.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
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
              <span className="text-slate-400">ya sabes usar Spinus</span>
            </h2>
            <p className="mt-5 text-[16px] text-slate-500 leading-relaxed max-w-lg">
              Sin configuraciones, sin formatos rígidos, sin capacitación. Cada pantalla está diseñada para que el siguiente paso sea obvio — desde que llega el paciente hasta que se va con su receta.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { icon: <MousePointerClick className="w-4 h-4 text-emerald-500" />, text: 'No necesitas capacitación para empezar' },
                { icon: <Zap className="w-4 h-4 text-amber-500" />, text: 'Búsqueda rápida — ⌘K / Ctrl+K' },
                { icon: <Calendar className="w-4 h-4 text-violet-500" />, text: 'Arrastra y suelta las citas en la agenda' },
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
