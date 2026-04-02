'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, ClipboardList, Eye, FileText, FlaskConical, Pill, ScanLine, Trash2 } from 'lucide-react'
import Link from 'next/link'

const TIPO_DOC_LABEL: Record<string, string> = {
  receta: 'Receta',
  solicitud_lab: 'Solicitud de Laboratorio',
  solicitud_imagen: 'Solicitud de Imagen',
  plan_suplementacion: 'Plan de Suplementación',
  informe_clinico: 'Informe Clínico',
  escrito_medico: 'Escrito Médico',
  solicitud_internamiento: 'Solicitud de Internamiento',
  consentimiento_informado: 'Consentimiento Informado',
  nota_honorarios: 'Nota de Honorarios',
}
const TIPO_DOC_COLOR: Record<string, string> = {
  receta: 'bg-blue-100 text-blue-700',
  solicitud_lab: 'bg-emerald-100 text-emerald-700',
  solicitud_imagen: 'bg-violet-100 text-violet-700',
  plan_suplementacion: 'bg-amber-100 text-amber-700',
  informe_clinico: 'bg-slate-100 text-slate-600',
  escrito_medico: 'bg-teal-100 text-teal-700',
  solicitud_internamiento: 'bg-rose-100 text-rose-700',
  consentimiento_informado: 'bg-indigo-100 text-indigo-700',
  nota_honorarios: 'bg-orange-100 text-orange-700',
}

interface Props {
  id: string
  documentos: any[]
  onVerDocumento: (doc: any) => void
  onEliminarDocumento?: (id: string) => void
}

export default function TabDocumentos({ id, documentos, onVerDocumento, onEliminarDocumento }: Props) {
  const [docAEliminar, setDocAEliminar] = useState<{ id: string; tipo: string } | null>(null)

  return (
    <>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Documentos generados e impresos para este paciente</p>
        <Link href={`/expediente/${id}/documentos`}
          className="text-xs text-[#1e5fa8] hover:underline font-medium">
          + Nuevo documento
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {documentos.length === 0 ? (
          <div className="p-10 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Sin documentos generados</p>
            <Link href={`/expediente/${id}/documentos`} className="text-[#1e5fa8] text-sm mt-2 inline-block hover:underline">
              Crear primera receta o solicitud →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documentos.map((doc: any) => (
              <div key={doc.id} className="flex items-center px-5 py-3 gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {doc.tipo === 'receta' && <Pill size={16} className="text-blue-600" />}
                  {(doc.tipo === 'solicitud_lab' || doc.tipo === 'lab') && <FlaskConical size={16} className="text-emerald-600" />}
                  {(doc.tipo === 'solicitud_imagen' || doc.tipo === 'imagen') && <ScanLine size={16} className="text-violet-600" />}
                  {doc.tipo === 'plan_suplementacion' && <ClipboardList size={16} className="text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_DOC_COLOR[doc.tipo] || 'bg-slate-100 text-slate-600'}`}>
                      {TIPO_DOC_LABEL[doc.tipo] || doc.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                    {doc.contenido?.diagnostico && ` · ${doc.contenido.diagnostico}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onVerDocumento(doc)}
                    className="flex items-center gap-1 text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Eye size={14} /> Ver
                  </button>
                  {onEliminarDocumento && (
                    <button
                      onClick={() => setDocAEliminar({ id: doc.id, tipo: TIPO_DOC_LABEL[doc.tipo] || doc.tipo })}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

      {/* Modal confirmar eliminación */}
      {docAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">¿Eliminar documento?</h2>
                <p className="text-sm text-slate-500">{docAEliminar.tipo}</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
              <p className="font-semibold">Esta acción es irreversible.</p>
              <p>El documento será eliminado permanentemente y no podrá recuperarse nunca.</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDocAEliminar(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { onEliminarDocumento!(docAEliminar.id); setDocAEliminar(null) }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={15} /> Sí, eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
