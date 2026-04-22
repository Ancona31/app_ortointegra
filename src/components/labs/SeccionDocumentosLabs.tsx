'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { FileText, Plus, AlertTriangle } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import ModalSubirDocumento from '@/components/labs/ModalSubirDocumento'
import ModalPreviewDocumento from '@/components/labs/ModalPreviewDocumento'
import CardDocumento from '@/components/labs/CardDocumento'
import { useProfile } from '@/hooks/useProfile'
import { useDocumentosLabs } from '@/hooks/useDocumentosLabs'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import type { Documento } from '@/types'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

type Props = {
  pacienteId: string
}

export default function SeccionDocumentosLabs({ pacienteId }: Props) {
  const { profile, loading: profileLoading } = useProfile()
  const { documentos, isLoading: docsLoading } = useDocumentosLabs(pacienteId)
  const { mutate } = useSWRConfig()
  const toast = useToast()

  const [modalSubir, setModalSubir] = useState(false)
  const [docPreview, setDocPreview] = useState<Documento | null>(null)
  const [docDelete, setDocDelete] = useState<Documento | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const clinicaId = profile?.clinica_id ?? null
  const userId = profile?.id ?? null
  const sinClinica = !profileLoading && !clinicaId

  function invalidar() {
    mutate(['documentos-labs', pacienteId])
    mutate(['stats-labs', pacienteId])
  }

  async function confirmarDelete() {
    if (!docDelete) return
    setEliminando(true)
    setDeleteError(null)
    try {
      const supabase = createClient()
      const { error: dbErr } = await supabase
        .from('documentos')
        .delete()
        .eq('id', docDelete.id)
      if (dbErr) throw dbErr

      if (docDelete.storage_bucket && docDelete.storage_path) {
        const { error: stErr } = await supabase.storage
          .from(docDelete.storage_bucket)
          .remove([docDelete.storage_path])
        if (stErr) {
          console.warn('[labs-delete] Archivo huérfano en storage:', stErr.message)
        }
      }

      invalidar()
      toast.success('Documento eliminado')
      setDocDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setEliminando(false)
    }
  }

  function cerrarDelete() {
    if (eliminando) return
    setDocDelete(null)
    setDeleteError(null)
  }

  const hay = documentos.length > 0
  const cargando = docsLoading && !hay

  const deleteFooter = (
    <div className="flex items-center justify-end gap-2 px-5 py-3">
      <button
        type="button"
        onClick={cerrarDelete}
        disabled={eliminando}
        className="px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={confirmarDelete}
        disabled={eliminando}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 text-white rounded-xl text-[13px] font-medium hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ transitionTimingFunction: IOS_EASING }}
      >
        {eliminando ? 'Eliminando…' : 'Eliminar'}
      </button>
    </div>
  )

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-slate-900">
          Documentos clínicos
        </h2>
        <button
          type="button"
          onClick={() => setModalSubir(true)}
          disabled={sinClinica}
          title={sinClinica ? 'Configura tu clínica antes de subir documentos' : undefined}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ transitionTimingFunction: IOS_EASING }}
        >
          <Plus size={14} /> Subir documento
        </button>
      </div>

      {cargando ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-[18px]">
          <div className="flex items-center justify-center py-8 text-[12px] text-slate-400">
            Cargando documentos…
          </div>
        </div>
      ) : !hay ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-[18px]">
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
              <FileText size={18} />
            </div>
            <p className="text-[13px] font-medium text-slate-700">
              Sin documentos clínicos.
            </p>
            <p className="text-[12px] text-slate-500 mt-1">
              Sube resultados de laboratorio o estudios de imagen.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            {documentos.map(d => (
              <CardDocumento
                key={d.id}
                documento={d}
                onClick={() => setDocPreview(d)}
                onDelete={() => setDocDelete(d)}
                layout="grid"
              />
            ))}
          </div>
          <div className="md:hidden flex flex-col gap-2">
            {documentos.map(d => (
              <CardDocumento
                key={d.id}
                documento={d}
                onClick={() => setDocPreview(d)}
                onDelete={() => setDocDelete(d)}
                layout="list"
              />
            ))}
          </div>
        </>
      )}

      {modalSubir && clinicaId && userId && (
        <ModalSubirDocumento
          open
          onClose={() => setModalSubir(false)}
          pacienteId={pacienteId}
          clinicaId={clinicaId}
          userId={userId}
          onSuccess={invalidar}
        />
      )}

      <ModalPreviewDocumento documento={docPreview} onClose={() => setDocPreview(null)} />

      {docDelete && (
        <ModalShell
          open
          onClose={cerrarDelete}
          title="Eliminar documento"
          subtitle={docDelete.nombre_original ?? undefined}
          icon={<AlertTriangle size={16} />}
          iconBg="bg-red-50 text-red-600"
          maxWidth="max-w-sm"
          footer={deleteFooter}
          elevated
        >
          <div className="px-5 py-4 space-y-3">
            <p className="text-[13px] text-slate-700 leading-relaxed">
              ¿Seguro que quieres eliminar{' '}
              <span className="font-semibold">{docDelete.nombre_original ?? 'este documento'}</span>?
            </p>
            <p className="text-[12px] text-slate-500">Esta acción no se puede deshacer.</p>
            {deleteError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">
                {deleteError}
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </section>
  )
}
