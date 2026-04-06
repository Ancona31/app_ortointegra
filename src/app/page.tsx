'use client'

import Link from 'next/link'
import { Calendar, FileText, Shield, Brain, ArrowRight, Stethoscope, BarChart3, Pill, MonitorCheck } from 'lucide-react'

const features = [
  {
    icon: <FileText className="w-6 h-6 text-[#1e5fa8]" />,
    title: 'Expedientes electrónicos',
    desc: 'Notas médicas, recetas, consentimientos informados y laboratorios con PDF profesional y membrete personalizado.',
    bg: 'bg-blue-50',
  },
  {
    icon: <Calendar className="w-6 h-6 text-violet-600" />,
    title: 'Agenda inteligente',
    desc: 'Calendario con drag & drop, sincronización bidireccional con Google Calendar y confirmación de citas.',
    bg: 'bg-violet-50',
  },
  {
    icon: <Brain className="w-6 h-6 text-emerald-600" />,
    title: 'IA clínica',
    desc: 'Análisis automático de laboratorios, notas adaptativas y consulta rápida asistida por inteligencia artificial.',
    bg: 'bg-emerald-50',
  },
  {
    icon: <Shield className="w-6 h-6 text-amber-600" />,
    title: 'Seguridad total',
    desc: 'Cifrado AES-256-GCM, auditoría completa, 2FA y cumplimiento con LFPDPPP y NOM-004-SSA3.',
    bg: 'bg-amber-50',
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-teal-600" />,
    title: 'Dashboard y estadísticas',
    desc: 'KPIs de tu práctica, gráficas de evolución, próxima cita y búsqueda global con Ctrl+K.',
    bg: 'bg-teal-50',
  },
  {
    icon: <Pill className="w-6 h-6 text-rose-600" />,
    title: 'Recetas con QR',
    desc: 'Recetas digitales con código QR verificable públicamente. Envío directo al paciente por email.',
    bg: 'bg-rose-50',
  },
  {
    icon: <MonitorCheck className="w-6 h-6 text-sky-600" />,
    title: 'Visor DICOM',
    desc: 'Visualiza tomografías y resonancias directamente en el navegador. Sin instalar software externo.',
    bg: 'bg-sky-50',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-8 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] flex items-center justify-center shadow-sm">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-[17px] font-bold text-slate-900 tracking-tight">OrtoIntegra</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="hidden sm:inline-flex text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-slate-100"
            >
              Planes
            </Link>
            <Link
              href="/login"
              className="text-[13px] font-semibold text-white bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] px-4 py-2 rounded-xl hover:shadow-[0_4px_24px_rgba(30,95,168,0.3)] active:scale-[0.97] transition-all duration-200"
            >
              Iniciar sesión
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#1e5fa8]/8 via-violet-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-8 pt-20 sm:pt-28 pb-10 sm:pb-14 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[12px] font-semibold text-slate-600 tracking-wide uppercase">Plataforma verificada por Google</span>
          </div>

          <h1 className="text-[40px] sm:text-[56px] font-bold text-slate-900 tracking-tight leading-[1.1]">
            Gestión clínica
            <br />
            <span className="bg-gradient-to-r from-[#1a3a5c] to-[#4a9fd4] bg-clip-text text-transparent">
              inteligente
            </span>
          </h1>

          <p className="mt-5 text-[15px] sm:text-[17px] font-semibold text-[#1e5fa8]/80 tracking-wide italic">
            Creada por médicos, para médicos
          </p>

          <p className="mt-4 text-[17px] sm:text-[19px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Expedientes, agenda e inteligencia artificial en una sola plataforma.
            <br className="hidden sm:block" />
            Diseñada para profesionales de la salud en México.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] text-white px-7 py-3.5 rounded-2xl text-[15px] font-semibold shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Comenzar gratis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-slate-700 px-7 py-3.5 rounded-2xl text-[15px] font-semibold bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </section>

      {/* Features — infinite marquee */}
      <section className="pb-20 sm:pb-28">
        <div className="text-center mb-14 px-4 sm:px-8">
          <h2 className="text-[28px] sm:text-[34px] font-bold text-slate-900 tracking-tight">Todo lo que necesitas</h2>
          <p className="mt-3 text-[15px] text-slate-500">Herramientas diseñadas para el flujo real de una consulta médica.</p>
        </div>

        <div className="relative overflow-hidden group/marquee">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-[#f8fafc] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-[#f8fafc] to-transparent z-10 pointer-events-none" />

          <div className="flex gap-4 animate-[marquee_35s_linear_infinite] group-hover/marquee:[animation-play-state:paused] w-max">
            {/* Render cards twice for seamless loop */}
            {[...features, ...features].map((f, i) => (
              <div
                key={`${f.title}-${i}`}
                className="flex-shrink-0 w-[280px] sm:w-[320px] bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm hover:shadow-[0_4px_20px_rgba(30,95,168,0.10)] hover:border-[#1e5fa8]/15 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-default"
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

      {/* Social proof / trust */}
      <section className="border-t border-slate-200/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-20">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-[34px] font-bold bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] bg-clip-text text-transparent">256-bit</div>
              <p className="mt-1 text-[13px] text-slate-500 font-medium">Cifrado AES-GCM</p>
            </div>
            <div>
              <div className="text-[34px] font-bold bg-gradient-to-r from-violet-600 to-violet-500 bg-clip-text text-transparent">NOM-004</div>
              <p className="mt-1 text-[13px] text-slate-500 font-medium">Cumplimiento normativo</p>
            </div>
            <div>
              <div className="text-[34px] font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">99.9%</div>
              <p className="mt-1 text-[13px] text-slate-500 font-medium">Disponibilidad en Vercel</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] p-10 sm:p-14 text-center shadow-[0_8px_32px_rgba(30,95,168,0.3)]">
          {/* Shine overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

          <h2 className="relative text-[24px] sm:text-[30px] font-bold text-white tracking-tight">
            Comienza a gestionar tu consultorio hoy
          </h2>
          <p className="relative mt-3 text-[15px] text-white/70 max-w-lg mx-auto">
            Plan gratuito disponible. Sin tarjeta de crédito. Configura tu cuenta en menos de 2 minutos.
          </p>
          <Link
            href="/register"
            className="relative inline-flex items-center gap-2 mt-8 bg-white text-[#1a3a5c] px-7 py-3.5 rounded-2xl text-[15px] font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
          >
            Crear cuenta gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1a3a5c] to-[#1e5fa8] flex items-center justify-center">
                <Stethoscope className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] text-slate-500">&copy; {new Date().getFullYear()} OrtoIntegra. Todos los derechos reservados.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors duration-200">
                Aviso de privacidad
              </Link>
              <Link href="/terms" className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors duration-200">
                Términos de servicio
              </Link>
              <Link href="/pricing" className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors duration-200">
                Planes
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
