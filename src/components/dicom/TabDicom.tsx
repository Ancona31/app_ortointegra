'use client'

import dynamic from 'next/dynamic'
import { Monitor } from 'lucide-react'
import { Loader2 } from 'lucide-react'

const DicomViewer = dynamic(() => import('./DicomViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />
      <span className="text-sm">Inicializando visor DICOM...</span>
    </div>
  ),
})

export default function TabDicom() {
  return (
    <>
      {/* Desktop: visor completo */}
      <div className="hidden lg:flex flex-col gap-4 h-[75vh]">
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-600">Visor DICOM</h2>
          <span className="text-xs text-slate-400">— Los archivos no se suben al servidor</span>
        </div>
        <DicomViewer />
      </div>

      {/* Móvil: mensaje informativo */}
      <div className="flex lg:hidden flex-col items-center justify-center py-16 text-center gap-3 text-slate-400">
        <Monitor size={40} className="opacity-30" />
        <p className="text-sm font-medium text-slate-500">El visor DICOM está disponible solo en computadora</p>
        <p className="text-xs max-w-xs">Abre la app desde tu PC o laptop para visualizar estudios de imagen médica.</p>
      </div>
    </>
  )
}
