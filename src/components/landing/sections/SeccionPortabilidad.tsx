'use client'

import { Smartphone, Laptop, Share2 } from 'lucide-react'
import Reveal from '@/components/landing/motion/Reveal'

/* Section: Portabilidad */
export default function SeccionPortabilidad() {
  return (
    <section className="bg-slate-100/40 backdrop-blur-md border-y border-white/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28">
        {/* Prueba de humo F0 del sistema de movimiento — único uso de <Reveal> por ahora */}
        <Reveal className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-violet-50 rounded-full px-3.5 py-1 mb-6">
            <Smartphone className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider">Portabilidad máxima</span>
          </div>
          <h2 className="text-[28px] sm:text-[38px] font-bold text-slate-900 tracking-tight leading-[1.15]">
            Tu consultorio en cualquier lugar
          </h2>
          <p className="mt-4 text-[16px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Accede desde tu computadora, tablet o celular. La misma experiencia fluida en cualquier pantalla — sin instalar nada, sin actualizaciones manuales.
          </p>
        </Reveal>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Laptop className="w-7 h-7 text-[#1e5fa8]" />,
              title: 'Desktop',
              desc: 'La experiencia completa con sidebar, atajos de teclado y vista expandida del expediente.',
              bg: 'bg-blue-50',
            },
            {
              icon: <Smartphone className="w-7 h-7 text-violet-600" />,
              title: 'Tablet y celular',
              desc: 'Interfaz adaptada al tacto. Revisa citas, consulta expedientes y genera documentos sobre la marcha.',
              bg: 'bg-violet-50',
            },
            {
              icon: <Share2 className="w-7 h-7 text-emerald-600" />,
              title: '100% en la nube',
              desc: 'Tus datos sincronizados en tiempo real. Si un dispositivo falla, accede desde otro sin perder nada.',
              bg: 'bg-emerald-50',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-slate-200/60 p-8 shadow-sm text-center hover:shadow-[0_4px_20px_rgba(30,95,168,0.10)] hover:border-[#1e5fa8]/15 hover:-translate-y-1 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center mx-auto mb-5`}>
                {item.icon}
              </div>
              <h3 className="text-[16px] font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
