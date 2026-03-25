'use client'

import { useState } from 'react'
import { FileText, Pill, FlaskConical, ScanLine, ClipboardList } from 'lucide-react'
import RecetaForm from '@/components/documentos/RecetaForm'
import SolicitudLabForm from '@/components/documentos/SolicitudLabForm'
import SolicitudImagenForm from '@/components/documentos/SolicitudImagenForm'
import PlanSuplementacionForm from '@/components/documentos/PlanSuplementacionForm'

const TIPOS = [
  { key: 'receta', label: 'Receta Médica', icon: Pill, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { key: 'lab', label: 'Solicitud de Laboratorio', icon: FlaskConical, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
  { key: 'imagen', label: 'Solicitud de Imagen', icon: ScanLine, color: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100' },
  { key: 'suplementacion', label: 'Plan de Suplementación', icon: ClipboardList, color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
] as const

type TipoDoc = typeof TIPOS[number]['key']

export default function DocumentosPage() {
  const [tipo, setTipo] = useState<TipoDoc | null>(null)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
          <FileText size={24} /> Documentos
        </h1>
        <p className="text-slate-500 text-sm mt-1">Genera e imprime documentos con tu membrete oficial</p>
      </div>

      {/* Selector de tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {TIPOS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTipo(key)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${color} ${tipo === key ? 'ring-2 ring-offset-1 ring-[#1e5fa8]' : ''}`}
          >
            <Icon size={24} />
            <span className="text-xs font-medium text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Formulario según tipo */}
      {tipo === 'receta' && <RecetaForm />}
      {tipo === 'lab' && <SolicitudLabForm />}
      {tipo === 'imagen' && <SolicitudImagenForm />}
      {tipo === 'suplementacion' && <PlanSuplementacionForm />}
      {!tipo && (
        <div className="text-center py-12 text-slate-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p>Selecciona el tipo de documento que deseas generar</p>
        </div>
      )}
    </div>
  )
}
