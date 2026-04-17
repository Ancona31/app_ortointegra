'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertTriangle, Banknote, BedDouble, ClipboardList, Download, Eye, File,
  FileText, FlaskConical, PenLine, Pill, ScanLine, ShieldCheck, Trash2,
} from 'lucide-react'
import Portal from '@/components/ui/Portal'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TIPO_DOC_LABEL: Record<string, string> = {
  receta: 'Receta',
  solicitud_lab: 'Solicitud de Laboratorio',
  solicitud_imagen: 'Solicitud de Imagen',
  plan_suplementacion: 'Plan de Suplementación',
  informe_clinico: 'Informe Clínico',
  escrito_medico: 'Escrito Médico',
  solicitud_internamiento: 'Solicitud de Internamiento',
  consentimiento_informado: 'Consentimiento Informado',
  nota_honorarios: 'Honorarios / Cotización',
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

import { Documento } from '@/types'

interface Props {
  id: string
  documentos: Documento[]
  onVerDocumento: (doc: Documento) => void
  onEliminarDocumento?: (id: string) => void
  hayMas?: boolean
  cargandoMas?: boolean
  onCargarMas?: () => void
}

export default function TabDocumentos({ id, documentos, onVerDocumento, onEliminarDocumento, hayMas, cargandoMas, onCargarMas }: Props) {
  const [docAEliminar, setDocAEliminar] = useState<{ id: string; tipo: string } | null>(null)

  async function descargarPdf(pdfUrl: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('documentos-pdf')
        .createSignedUrl(pdfUrl, 900) // 15 min
      if (error || !data?.signedUrl) {
        console.error('[TabDocumentos] signed URL error:', error?.message)
        return
      }
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      console.error('[TabDocumentos] descargarPdf:', err)
    }
  }

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
            {documentos.map((doc) => (
              <div key={doc.id} className="flex items-center px-3 sm:px-5 py-3 gap-3 sm:gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {(() => {
                    switch (doc.tipo) {
                      case 'receta':                   return <Pill size={16} className="text-blue-600" />
                      case 'solicitud_lab': case 'lab': return <FlaskConical size={16} className="text-emerald-600" />
                      case 'solicitud_imagen': case 'imagen': return <ScanLine size={16} className="text-violet-600" />
                      case 'plan_suplementacion':      return <ClipboardList size={16} className="text-amber-600" />
                      case 'solicitud_internamiento':  return <BedDouble size={16} className="text-rose-600" />
                      case 'escrito_medico':            return <PenLine size={16} className="text-teal-600" />
                      case 'consentimiento_informado': return <ShieldCheck size={16} className="text-indigo-600" />
                      case 'nota_honorarios':          return <Banknote size={16} className="text-orange-600" />
                      case 'informe_clinico':          return <FileText size={16} className="text-slate-600" />
                      default:                          return <File size={16} className="text-slate-400" />
                    }
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_DOC_COLOR[doc.tipo] || 'bg-slate-100 text-slate-600'}`}>
                      {TIPO_DOC_LABEL[doc.tipo] || doc.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {doc.created_at ? format(parseISO(doc.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es }) : ''}
                    {doc.contenido?.diagnostico && ` · ${doc.contenido.diagnostico}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {doc.pdf_url && (
                    <button
                      onClick={() => descargarPdf(doc.pdf_url!)}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                      title="Descargar PDF"
                    >
                      <Download size={14} />
                    </button>
                  )}
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
        {hayMas && onCargarMas && (
          <button onClick={onCargarMas} disabled={cargandoMas}
            className="w-full py-3 text-sm text-[#1e5fa8] font-medium hover:bg-slate-50 transition-colors border-t border-slate-100 disabled:opacity-50">
            {cargandoMas ? 'Cargando...' : 'Cargar más documentos'}
          </button>
        )}
      </div>
    </div>

      {/* Modal confirmar eliminación — macOS alert */}
      {docAEliminar && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-slide-up">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertTriangle size={22} style={{ color: '#EF5350' }} />
              </div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Eliminar documento</h2>
              <p className="text-sm text-[#86868b] mt-1 capitalize">{docAEliminar.tipo}</p>
              <p className="text-[13px] text-[#3d3d3f] mt-3 leading-relaxed">
                El documento será eliminado <span className="font-semibold">permanentemente</span> y no podrá recuperarse.
              </p>
            </div>
            <div className="border-t border-slate-100 grid grid-cols-2">
              <button
                onClick={() => setDocAEliminar(null)}
                className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors border-r border-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => { onEliminarDocumento!(docAEliminar.id); setDocAEliminar(null) }}
                className="px-4 py-3.5 text-sm font-semibold hover:bg-red-50 transition-colors"
                style={{ color: '#EF5350' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  )
}
