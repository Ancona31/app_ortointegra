'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/* Hero */
export default function SeccionHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#1e5fa8]/8 via-violet-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />


      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 pt-20 sm:pt-28 pb-10 sm:pb-14 text-center">
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
  )
}
