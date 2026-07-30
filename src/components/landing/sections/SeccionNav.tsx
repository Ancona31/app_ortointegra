'use client'

import Link from 'next/link'
import Image from 'next/image'

/* Nav — sticky necesita z alto para quedar sobre todo */
export default function SeccionNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-8 h-14">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-spinus.png" alt="Spinus" width={800} height={777} className="object-contain h-9 w-auto" />
          <span className="text-[17px] font-bold text-slate-900 tracking-tight">Spinus</span>
        </div>
        {/* Jerarquía §7·0: el sólido es para el visitante nuevo ("Crear
            cuenta"), no para el que ya tiene cuenta. "Planes" se oculta en
            móvil; los otros dos no, para que el sólido visible ahí sea el
            correcto. */}
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="hidden sm:inline-flex text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            Planes
          </Link>
          <Link
            href="/login"
            className="inline-flex text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="text-[13px] font-semibold text-white bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] px-4 py-2 rounded-xl hover:shadow-[0_4px_24px_rgba(30,95,168,0.3)] active:scale-[0.97] transition-all duration-200"
          >
            Crear cuenta
          </Link>
        </div>
      </nav>
    </header>
  )
}
