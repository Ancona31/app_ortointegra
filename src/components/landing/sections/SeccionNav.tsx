'use client'

import Link from 'next/link'
import Image from 'next/image'

/* Nav — sticky necesita z alto para quedar sobre todo

   F1.3·b2: excepción 1 al borde 0.5px/#e6ebf2 — es chrome, no superficie.
   El `bg-white/80` + `backdrop-blur-xl` SÍ se quedan (§4.4): aquí el
   contenido pasa por debajo al hacer scroll, que es justo el caso que el
   blur resuelve. El Footer no, y por eso allí se quitó. No unificarlos. */
export default function SeccionNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b-[0.5px] border-[#e6ebf2]">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-8 h-14">
        {/* F1.3·c3 — `gap-2` (8), no gap-2.5: 10 no está en la escala. Mismo
            cambio en el lockup del Footer, que es el mismo lockup. */}
        <div className="flex items-center gap-2">
          <Image src="/logo-spinus.png" alt="Spinus" width={800} height={777} className="object-contain h-9 w-auto" />
          <span className="text-[17px] font-bold text-slate-900 tracking-tight">Spinus</span>
        </div>
        {/* Jerarquía §7·0: el sólido es para el visitante nuevo ("Crear
            cuenta"), no para el que ya tiene cuenta. "Planes" se oculta en
            móvil; los otros dos no, para que el sólido visible ahí sea el
            correcto. */}
        {/* F1.3·c2 — los tres son CONTROLES: 12px (`rounded-xl`) los tres.
            "Crear cuenta" ya estaba bien; los dos links subieron desde
            rounded-lg (8px), que es el radio de los cuadros de icono de 32px,
            no el de un control. El hover de fondo hace visible el radio de los
            links, así que la diferencia se notaba al pasar el cursor. */}
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="hidden sm:inline-flex text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 px-3 py-1.5 rounded-xl hover:bg-slate-100"
          >
            Planes
          </Link>
          <Link
            href="/login"
            className="inline-flex text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 px-3 py-1.5 rounded-xl hover:bg-slate-100"
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
