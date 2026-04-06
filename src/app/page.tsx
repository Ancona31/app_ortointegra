import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, FileText, Shield, Brain, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OrtoIntegra — Gestión Clínica Inteligente',
  description: 'Plataforma de gestión clínica para profesionales de la salud. Expedientes, agenda, IA y más.',
}

const features = [
  {
    icon: <FileText className="w-6 h-6" />,
    title: 'Expedientes electrónicos',
    desc: 'Gestión completa de pacientes, notas médicas, recetas y consentimientos informados con PDF profesional.',
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Agenda inteligente',
    desc: 'Calendario integrado con Google Calendar. Crea, arrastra y confirma citas en un solo lugar.',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'IA clínica',
    desc: 'Análisis automático de laboratorios, notas médicas adaptativas y consulta rápida asistida por inteligencia artificial.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Seguridad y privacidad',
    desc: 'Cifrado AES-256, auditoría de acciones, 2FA y cumplimiento con la LFPDPPP y NOM-004-SSA3.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <header className="px-4 sm:px-8 pt-12 pb-6">
        <nav className="mx-auto max-w-5xl flex items-center justify-between">
          <span className="text-xl font-bold text-slate-900 tracking-tight">OrtoIntegra</span>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Planes
            </Link>
            <Link
              href="/login"
              className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </nav>
      </header>

      <section className="px-4 sm:px-8 py-16 sm:py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            Gestión clínica{' '}
            <span className="text-blue-600">inteligente</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            La plataforma que conecta expedientes, agenda y análisis clínicos con inteligencia
            artificial. Diseñada por y para profesionales de la salud en México.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-700 transition-colors"
            >
              Comenzar gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-slate-700 px-6 py-3 rounded-xl text-base font-medium border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-8 py-16 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="grid sm:grid-cols-2 gap-8">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4 p-6 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-8 py-10 border-t border-slate-100">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>&copy; {new Date().getFullYear()} OrtoIntegra. Todos los derechos reservados.</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Aviso de privacidad</Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">Términos de servicio</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
