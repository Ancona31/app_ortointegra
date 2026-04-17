import type { ReactNode } from 'react'

export const metadata = {
  title: 'Spinus® — Modo Offline',
}

export default function OfflineLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-amber-50/30">
      {/* Header propio — sin Sidebar, sin AuthProvider, sin SessionGuard */}
      <header className="sticky top-0 z-40 bg-amber-600 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" />
                <path d="m2 2 20 20" strokeOpacity="0.5" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm tracking-wide">Spinus® Offline</p>
              <p className="text-[10px] text-amber-100 font-medium">Captura sin conexión</p>
            </div>
          </div>
          <a
            href="/inicio"
            className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            Volver al sistema
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
