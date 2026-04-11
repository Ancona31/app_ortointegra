'use client'

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
          <WifiOff size={36} className="text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Sin conexion</h1>
        <p className="text-sm text-slate-500 mb-8">
          Vuelve a intentar cuando tengas internet.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
