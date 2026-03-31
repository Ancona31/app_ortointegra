'use client'

import dynamic from 'next/dynamic'
import { Monitor, Loader2 } from 'lucide-react'

const DicomViewer = dynamic(() => import('@/components/dicom/DicomViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />
      <span className="text-sm">Inicializando visor DICOM...</span>
    </div>
  ),
})

export default function DicomPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Monitor size={20} className="text-[#1e5fa8]" />
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Visor DICOM</h1>
          <p className="text-xs text-slate-400">Los archivos se procesan localmente — no se suben al servidor</p>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-140px)] min-h-[600px]">
        <DicomViewer />
      </div>

      {/* Móvil */}
      <div className="flex lg:hidden flex-col items-center justify-center py-20 text-center gap-3 text-slate-400">
        <Monitor size={48} className="opacity-30" />
        <p className="text-sm font-medium text-slate-500">El visor DICOM está disponible solo en computadora</p>
        <p className="text-xs max-w-xs">Abre la app desde tu PC o laptop para visualizar estudios de imagen médica.</p>
      </div>
    </div>
  )
}
