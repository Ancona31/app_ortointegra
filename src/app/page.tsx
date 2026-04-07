'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, FileText, Shield, Brain, ArrowRight, Stethoscope, BarChart3, Pill, MonitorCheck, Clock, Search, Users, Activity, Zap, Smartphone, Laptop, MousePointerClick, FolderOpen, Share2 } from 'lucide-react'

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

/* Mini representation of the app UI for the macOS window mockup */
function AppMockup() {
  return (
    <div className="flex h-full bg-[#f8fafc] text-left">
      {/* Sidebar */}
      <div className="w-[180px] bg-white/90 border-r border-slate-200/60 p-4 flex-shrink-0 hidden sm:block">
        <div className="flex items-center gap-2 mb-6">
          <Image src="/logo-spinus.png" alt="Spinus" width={24} height={24} className="object-contain" />
          <span className="text-[11px] font-bold text-slate-800">Spinus®</span>
        </div>
        <div className="space-y-1">
          {[
            { icon: <Activity className="w-3 h-3" />, label: 'Dashboard' },
            { icon: <Users className="w-3 h-3" />, label: 'Pacientes', active: false },
            { icon: <Calendar className="w-3 h-3" />, label: 'Agenda', active: true },
            { icon: <FileText className="w-3 h-3" />, label: 'Documentos' },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${
                item.active
                  ? 'bg-[#1e5fa8]/10 text-[#1e5fa8]'
                  : 'text-slate-500'
              }`}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content — agenda preview */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[12px] font-bold text-slate-800">Agenda</h3>
            <p className="text-[9px] text-slate-400">Lunes 7 de abril, 2026</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
              <Search className="w-2.5 h-2.5 text-slate-400" />
              <span className="text-[9px] text-slate-400">Ctrl+K</span>
            </div>
          </div>
        </div>

        {/* Time grid */}
        <div className="space-y-0.5">
          {[
            { time: '09:00', patient: 'Carlos Méndez', type: 'Valoración columna', color: 'bg-blue-500' },
            { time: '09:30', patient: '', type: '', color: '' },
            { time: '10:00', patient: 'María López', type: 'Seguimiento post-qx', color: 'bg-emerald-500' },
            { time: '10:30', patient: 'Roberto Díaz', type: 'Lectura de estudios', color: 'bg-violet-500' },
            { time: '11:00', patient: '', type: '', color: '' },
            { time: '11:30', patient: 'Ana Cervantes', type: 'Primera consulta', color: 'bg-amber-500' },
          ].map((slot) => (
            <div key={slot.time} className="flex items-stretch gap-2 min-h-[28px]">
              <span className="text-[9px] text-slate-400 w-8 pt-1 flex-shrink-0 text-right">{slot.time}</span>
              <div className="flex-1 border-t border-slate-100 relative">
                {slot.patient && (
                  <div className={`absolute inset-x-0 top-0 ${slot.color} rounded-md px-2 py-1 shadow-sm`}>
                    <p className="text-[9px] font-semibold text-white leading-tight">{slot.patient}</p>
                    <p className="text-[8px] text-white/80 leading-tight">{slot.type}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — patient card */}
      <div className="w-[160px] bg-white/90 border-l border-slate-200/60 p-3 flex-shrink-0 hidden lg:block">
        <div className="mb-3">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Próximo paciente</p>
          <div className="bg-blue-50 rounded-xl p-2.5">
            <p className="text-[11px] font-bold text-slate-800">Carlos Méndez</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Valoración columna</p>
            <div className="flex items-center gap-1 mt-1.5">
              <Clock className="w-2.5 h-2.5 text-[#1e5fa8]" />
              <span className="text-[9px] font-semibold text-[#1e5fa8]">09:00 AM</span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Hoy</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-[14px] font-bold text-slate-800">4</p>
              <p className="text-[8px] text-slate-500">Citas</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-[14px] font-bold text-emerald-600">3</p>
              <p className="text-[8px] text-slate-500">Confirmadas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] relative" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      {/* Logo watermark — fixed left side, visible across entire page */}
      <div className="fixed -left-16 sm:-left-6 top-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.07] z-0">
        <Image src="/logo-spinus.png" alt="" width={575} height={575} className="w-[460px] sm:w-[575px] h-auto" aria-hidden="true" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-8 h-14">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-spinus.png" alt="Spinus" width={36} height={36} className="object-contain" />
            <span className="text-[17px] font-bold text-slate-900 tracking-tight">Spinus®</span>
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
            Menos tiempo en la pantalla,
            <br />
            <span className="bg-gradient-to-r from-[#1a3a5c] to-[#4a9fd4] bg-clip-text text-transparent">
              más tiempo con tu paciente
            </span>
          </h1>

          <p className="mt-5 text-[15px] sm:text-[17px] font-semibold text-[#1e5fa8]/80 tracking-wide italic">
            Creada por médicos, para médicos
          </p>

          <p className="mt-4 text-[17px] sm:text-[19px] text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Expedientes, agenda e inteligencia artificial en una sola plataforma.
            <br className="hidden sm:block" />
            Regístrate en segundos y empieza a usarla — sin vendedores, sin trámites.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] text-white px-7 py-3.5 rounded-2xl text-[15px] font-semibold shadow-[0_4px_24px_rgba(30,95,168,0.3)] hover:shadow-[0_8px_32px_rgba(30,95,168,0.4)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
            >
              Crear cuenta — es gratis
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

      {/* App mockup — macOS window */}
      <section className="mx-auto max-w-5xl px-4 sm:px-8 pb-20 sm:pb-28">
        <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(30,95,168,0.15),0_0_0_1px_rgba(0,0,0,0.05)]">
          {/* macOS title bar */}
          <div className="bg-[#f6f6f6] border-b border-slate-200/80 px-4 py-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-white/80 border border-slate-200/60 rounded-md px-3 py-0.5 text-[10px] text-slate-400 font-medium">
                spinus.com.mx/agenda
              </div>
            </div>
            <div className="w-[52px]" /> {/* spacer to center address bar */}
          </div>

          {/* App content */}
          <div className="h-[280px] sm:h-[360px] lg:h-[400px]">
            <AppMockup />
          </div>
        </div>
      </section>

      {/* Features — infinite marquee */}
      <section className="pb-20 sm:pb-28">
        <div className="text-center mb-14 px-4 sm:px-8">
          <h2 className="text-[28px] sm:text-[34px] font-bold text-slate-900 tracking-tight">Todo lo que necesitas</h2>
          <p className="mt-3 text-[15px] text-slate-500">Cada herramienta resuelve un problema real de tu día a día.</p>
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

      {/* Section: Powered by Gemini */}
      <section className="border-t border-slate-200/60 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-20">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 sm:p-14">
            {/* Subtle shine */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
              {/* Gemini logo */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <svg viewBox="0 0 28 28" className="w-12 h-12 sm:w-14 sm:h-14">
                    <defs>
                      <linearGradient id="gemini-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4285F4" />
                        <stop offset="25%" stopColor="#9B72CB" />
                        <stop offset="50%" stopColor="#D96570" />
                        <stop offset="75%" stopColor="#D96570" />
                        <stop offset="100%" stopColor="#9B72CB" />
                      </linearGradient>
                    </defs>
                    <path d="M14 0C14 7.732 7.732 14 0 14c7.732 0 14 6.268 14 14 0-7.732 6.268-14 14-14C20.268 14 14 7.732 14 0Z" fill="url(#gemini-g1)" />
                  </svg>
                </div>
              </div>

              {/* Text */}
              <div className="text-center lg:text-left flex-1">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-3">Potenciado por inteligencia artificial</p>
                <h2 className="text-[24px] sm:text-[30px] font-bold text-white tracking-tight leading-tight">
                  Google Gemini es tu aliado
                  <br className="hidden sm:block" />
                  <span className="bg-gradient-to-r from-[#4285F4] via-[#9B72CB] to-[#D96570] bg-clip-text text-transparent">
                    para cada consulta
                  </span>
                </h2>
                <p className="mt-4 text-[15px] text-white/60 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  La IA analiza laboratorios, estructura notas médicas y te asiste en tiempo real. Tú aportas el criterio clínico — Gemini se encarga del trabajo pesado.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  {['Notas médicas con IA', 'Análisis de laboratorios', 'Consulta rápida'].map((tag) => (
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

      {/* Section: Expediente electrónico */}
      <section className="border-t border-slate-200/60 bg-white">
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

      {/* Section: Portabilidad */}
      <section className="bg-[#f8fafc]">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28">
          <div className="text-center mb-14">
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
          </div>

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

      {/* Section: Interfaz intuitiva */}
      <section className="border-t border-slate-200/60 bg-white">
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
            Tu consultorio merece mejor tecnología
          </h2>
          <p className="relative mt-3 text-[15px] text-white/70 max-w-lg mx-auto">
            Sin pláticas con vendedores. Sin letras chiquitas. Sin trámites.
            <br />
            Crea tu cuenta y empieza a usarla hoy — así de simple.
          </p>
          <Link
            href="/register"
            className="relative inline-flex items-center gap-2 mt-8 bg-white text-[#1a3a5c] px-7 py-3.5 rounded-2xl text-[15px] font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
          >
            Crear cuenta <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Image src="/logo-spinus.png" alt="Spinus" width={28} height={28} className="object-contain" />
              <span className="text-[13px] text-slate-500">&copy; {new Date().getFullYear()} Spinus®. Todos los derechos reservados.</span>
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
