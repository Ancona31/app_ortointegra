'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Pill, FlaskConical, ScanLine, ClipboardList, BedDouble, PenLine, ShieldCheck, Receipt, WifiOff } from 'lucide-react'
import { subscribe, getStatus } from '@/lib/connectionMonitor'

const TIPOS = [
  { tipo: 'receta',         label: 'Receta médica',          icon: Pill,          color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { tipo: 'lab',            label: 'Laboratorio',            icon: FlaskConical,  color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { tipo: 'imagen',         label: 'Imagen',                 icon: ScanLine,      color: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' },
  { tipo: 'suplementacion', label: 'Suplementación',         icon: ClipboardList, color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
  { tipo: 'internamiento',  label: 'Internamiento',          icon: BedDouble,     color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { tipo: 'escrito',        label: 'Escrito médico',         icon: PenLine,       color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
  { tipo: 'consentimiento', label: 'Consentimiento',         icon: ShieldCheck,   color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { tipo: 'honorarios',     label: 'Honorarios',             icon: Receipt,       color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function DocumentoRapidoModal({ open, onClose }: Props) {
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(() => getStatus() !== 'offline')

  useEffect(() => {
    const unsub = subscribe((status) => setIsOnline(status !== 'offline'))
    return unsub
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function seleccionar(tipo: string) {
    onClose()
    router.push(`/documentos?tipo=${tipo}`)
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-800">Documento rapido</p>
            <p className="text-xs text-slate-400 mt-0.5">¿Qué tipo de documento necesitas?</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {!isOnline && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <WifiOff size={13} className="shrink-0" />
            <span>Sin conexion — la busqueda de pacientes no estara disponible. Puedes escribir los datos manualmente.</span>
          </div>
        )}

        <div className="p-4 grid grid-cols-2 gap-2">
          {TIPOS.map(({ tipo, label, icon: Icon, color }) => (
            <button
              key={tipo}
              onClick={() => seleccionar(tipo)}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-colors ${color}`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="text-sm font-medium leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
