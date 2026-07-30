'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/* CTA */
export default function SeccionCTA() {
  return (
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
  )
}
