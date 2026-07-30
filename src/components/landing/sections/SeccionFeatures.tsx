'use client'

import { Calendar, FileText, Shield, Brain, BarChart3, Pill, MonitorCheck } from 'lucide-react'

const features = [
  {
    icon: <FileText className="w-6 h-6 text-[#1e5fa8]" />,
    title: 'Expedientes electrónicos',
    desc: 'Toda la historia clínica de tu paciente a un clic. Sin papel, sin búsquedas.',
    bg: 'bg-blue-50',
  },
  {
    icon: <Calendar className="w-6 h-6 text-violet-600" />,
    title: 'Agenda inteligente',
    desc: 'Arrastra, suelta y listo. Tu agenda sincronizada con Google Calendar en tiempo real.',
    bg: 'bg-violet-50',
  },
  {
    icon: <Brain className="w-6 h-6 text-emerald-600" />,
    title: 'IA clínica',
    desc: 'Tus notas clínicas listas en segundos, no en minutos. La IA analiza labs por ti.',
    bg: 'bg-emerald-50',
  },
  {
    icon: <Shield className="w-6 h-6 text-amber-600" />,
    title: 'Seguridad de grado médico',
    desc: 'Cifrado AES-256, auditoría completa y cumplimiento con NOM-004 y LFPDPPP.',
    bg: 'bg-amber-50',
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-teal-600" />,
    title: 'Dashboard en tiempo real',
    desc: 'Visualiza tu práctica de un vistazo. Pacientes, citas y estadísticas al instante.',
    bg: 'bg-teal-50',
  },
  {
    icon: <Pill className="w-6 h-6 text-rose-600" />,
    title: 'Recetas con QR',
    desc: 'Recetas digitales verificables. Tu paciente las recibe directo en su correo.',
    bg: 'bg-rose-50',
  },
  {
    icon: <MonitorCheck className="w-6 h-6 text-sky-600" />,
    title: 'Visor DICOM',
    desc: 'Tomografías y resonancias en tu navegador. Sin instalar nada.',
    bg: 'bg-sky-50',
  },
]

/* Features */
export default function SeccionFeatures() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="text-center mb-14 px-4 sm:px-8">
        <h2 className="text-[28px] sm:text-[34px] font-bold text-slate-900 tracking-tight">Todo lo que necesitas</h2>
        <p className="mt-3 text-[15px] text-slate-500">Cada herramienta resuelve un problema real de tu día a día.</p>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <div className="flex flex-wrap justify-center gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="w-[280px] sm:w-[320px] bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm hover:shadow-[0_4px_20px_rgba(30,95,168,0.10)] hover:border-[#1e5fa8]/15 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-default"
            >
              <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                {f.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
