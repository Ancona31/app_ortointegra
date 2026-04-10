'use client'

import { WifiOff } from 'lucide-react'
import Link from 'next/link'

export default function OfflineFallbackPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
        <WifiOff size={36} className="text-slate-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">
        Esta seccion requiere conexion a internet
      </h1>
      <p className="text-sm text-slate-500 max-w-md mb-8">
        Mientras tanto puedes crear notas medicas o generar documentos.
        Cuando la conexion se restablezca, podras acceder a esta seccion normalmente.
      </p>
      <div className="flex gap-3">
        <Link
          href="/inicio"
          className="px-5 py-2.5 bg-[#1e5fa8] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] transition-colors"
        >
          Volver al inicio
        </Link>
        <Link
          href="/documentos"
          className="px-5 py-2.5 bg-white text-[#1a3a5c] text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Generar documento
        </Link>
      </div>
    </div>
  )
}
