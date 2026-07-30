'use client'

import Link from 'next/link'
import Image from 'next/image'

/* Footer */
export default function SeccionFooter() {
  return (
    <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-spinus.png" alt="Spinus" width={800} height={777} className="object-contain h-7 w-auto" />
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
  )
}
