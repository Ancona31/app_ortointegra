'use client'

import type { ReactNode } from 'react'
import { Calendar, FileText, Brain, Pill, MonitorCheck } from 'lucide-react'

interface Feature {
  icon: ReactNode
  title: string
  desc: string
  /** Borde de la card (§3.1: 0.5px). #1e5fa8 marca la card DICOM. */
  border: string
  /** Columnas que ocupa en la retícula de 3. Ausente = 1. */
  span?: 2
  /** Reserva la zona de medio a sangre. F2.b inserta ahí el video DICOM
   *  con scrub por scroll + contador n/N (§5.3). Vacía por ahora. */
  media?: boolean
}

/* El orden del array ES el orden de la retícula (§3.4: bento asimétrico):
   fila 1 → DICOM (2 col) · Expedientes
   fila 2 → Recetas · Documentación con IA · Agenda
   DICOM arriba-izquierda no es estético: la cascada diagonal de F2.a nace
   de esa card (§5.3). No reordenar sin releer esa ficha. */
const features: Feature[] = [
  {
    icon: <MonitorCheck className="w-6 h-6 text-[#1e5fa8]" />,
    title: 'Visor DICOM',
    desc: 'Abre el estudio completo desde el disco, sin instalar nada y sin costo extra. Guarda en el expediente los cortes que importan — hasta 100 por paciente.',
    border: 'border-[#1e5fa8]',
    span: 2,
    media: true,
  },
  {
    icon: <FileText className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Expedientes electrónicos',
    desc: 'Toda la historia clínica de tu paciente a un clic. Sin papel, sin búsquedas.',
    border: 'border-[#e6ebf2]',
  },
  {
    icon: <Pill className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Recetas con QR',
    desc: 'Membretadas, con QR verificable. Envíalas por correo o entrégalas impresas.',
    border: 'border-[#e6ebf2]',
  },
  {
    icon: <Brain className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Documentación con IA',
    desc: 'Describe los hallazgos y la IA estructura la nota. Tú validas y firmas.',
    border: 'border-[#e6ebf2]',
  },
  {
    icon: <Calendar className="w-6 h-6 text-[#8a99ac]" />,
    title: 'Agenda',
    desc: 'Arrastra, suelta y listo. Sincronizada con Google Calendar.',
    border: 'border-[#e6ebf2]',
  },
]

/* Features — grid bento
   Sin padding-top: los 96px de aire de §3.3 los aporta ahora el pb-24 de
   SeccionProblema.tsx, la sección inmediatamente anterior (antes venía del
   hero, antes de que la franja se insertara en medio). La cadena completa:
     Hero (pb-24, SeccionHero.tsx:30) → [96px] → Franja (sin pt … pb-24)
     → [96px] → Features (sin pt)
   Dos costuras de 96px exactos, el mínimo de §3.3, iguales en todos los
   breakpoints. No añadir pt aquí. */
export default function SeccionFeatures() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <div className="max-w-2xl mb-14">
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold text-slate-900 tracking-[-0.03em] leading-[1.10]">
            Lo que resuelve desde el primer día
          </h2>
          <p className="mt-3 text-[15px] text-slate-500">Cada herramienta resuelve un problema real de tu día a día.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className={`flex flex-col bg-white rounded-2xl border-[0.5px] ${f.border} ${f.span === 2 ? 'sm:col-span-2' : ''} shadow-sm hover:shadow-[0_4px_20px_rgba(30,95,168,0.10)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-default`}
            >
              <div className="p-6">
                <div className="mb-4">{f.icon}</div>
                <h3 className="text-[15px] font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
              {f.media ? <div className="mt-auto overflow-hidden rounded-b-2xl" /> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
