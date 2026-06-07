import Image from 'next/image'
import Link from 'next/link'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-8 h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-spinus.png"
              alt="Spinus"
              width={800}
              height={777}
              className="object-contain h-9 w-auto"
              priority
            />
            <span className="text-[17px] font-bold text-slate-900 tracking-tight">Spinus®</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="hidden sm:inline-flex text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Planes
            </Link>
            <Link
              href="/login"
              className="text-[13px] font-semibold text-white bg-gradient-to-r from-[#1a3a5c] to-[#1e5fa8] px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity shadow-sm"
            >
              Iniciar sesión
            </Link>
          </div>
        </nav>
      </header>

      {/* Contenido */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo-spinus.png"
                alt="Spinus"
                width={800}
                height={777}
                className="object-contain h-7 w-auto"
              />
              <span className="text-[13px] text-slate-500">
                &copy; {year} Spinus®. Todos los derechos reservados.
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link
                href="/privacidad"
                className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
              >
                Aviso de privacidad
              </Link>
              <Link
                href="/terms"
                className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
              >
                Términos y condiciones
              </Link>
              <Link
                href="/pricing"
                className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
              >
                Planes
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
