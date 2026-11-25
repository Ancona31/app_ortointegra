'use client'

import { useState, useMemo } from 'react'
import { useSWRConfig } from 'swr'
import { AlertTriangle, UploadCloud } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import ModalSubirDocumento from '@/components/labs/ModalSubirDocumento'
import ModalPreviewDocumento from '@/components/labs/ModalPreviewDocumento'
import CardDocumento from '@/components/labs/CardDocumento'
import SelectorSegmentado from '@/components/ui/SelectorSegmentado'
import { useProfile } from '@/hooks/useProfile'
import { useDocumentosLabs } from '@/hooks/useDocumentosLabs'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import type { Documento } from '@/types'

type Props = {
  pacienteId: string
}

/* Filtro por formato, resuelto en cliente sobre lo ya cargado: son los tres
   grupos que `CardDocumento` ya distingue por `mime_type`. */
type Formato = 'todos' | 'imagen' | 'pdf' | 'dicom'

const FORMATOS: readonly { clave: Formato; rotulo: string }[] = [
  { clave: 'todos', rotulo: 'Todos' },
  { clave: 'imagen', rotulo: 'Imágenes' },
  { clave: 'pdf', rotulo: 'PDF' },
  { clave: 'dicom', rotulo: 'DICOM' },
] as const

function formatoDe(mime: string | null | undefined): Exclude<Formato, 'todos'> | 'otro' {
  if (!mime) return 'otro'
  if (mime.startsWith('image/')) return 'imagen'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'application/dicom') return 'dicom'
  return 'otro'
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
  const [formato, setFormato] = useState<Formato>('todos')
  const [arrastrando, setArrastrando] = useState(false)
  const [soltados, setSoltados] = useState<File[]>([])

  const clinicaId = profile?.clinica_id ?? null
  const userId = profile?.id ?? null
  const sinClinica = !profileLoading && !clinicaId

  function invalidar() {
    mutate(['documentos-labs', pacienteId])
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

  const visibles = useMemo(
    () => (formato === 'todos' ? documentos : documentos.filter(d => formatoDe(d.mime_type) === formato)),
    [documentos, formato],
  )

  const hay = documentos.length > 0
  const cargando = docsLoading && !hay

  /**
   * ⚠️ LA ZONA DE ARRASTRE SUSTITUYE AL BOTÓN SUELTO DEL ENCABEZADO, y por eso
   * allí arriba ya no hay ninguno: dos entradas a lo mismo en la misma pantalla
   * son una de más. Es el último tile de la retícula, con borde discontinuo.
   *
   * ⚠️ Y SOLTAR AQUÍ SÍ HACE ALGO. El texto promete arrastrar, así que los
   * archivos soltados viajan al modal por `archivosIniciales` y éste abre con
   * ellos dentro; sin eso, la promesa sería falsa y habría que volver a
   * elegirlos. Pulsar abre el mismo modal vacío.
   */
  function alSoltar(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setArrastrando(false)
    if (sinClinica) return
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length === 0) return
    setSoltados(files)
    setModalSubir(true)
  }

  const zonaArrastre = (
    <button
      type="button"
      onClick={() => { setSoltados([]); setModalSubir(true) }}
      onDragOver={e => { e.preventDefault(); if (!sinClinica) setArrastrando(true) }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={alSoltar}
      disabled={sinClinica}
      title={sinClinica ? 'Configura tu clínica antes de subir archivos' : undefined}
      /* La zona de arrastre como fila punteada al pie de la lista (maqueta).
         Sólo cambia color y borde al arrastrar: nada se mueve. */
      className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[12px] border border-dashed px-3 py-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${arrastrando ? 'border-accion bg-tonal' : 'border-borde bg-transparent hover:bg-sup2'}`}
    >
      <UploadCloud size={20} aria-hidden="true" className="shrink-0 text-tinta2" />
      <span className="text-[14px] leading-5 text-tinta2">
        Arrastra archivos aquí o haz clic para subir
      </span>
    </button>
  )

  return (
    <section>
      {/* Encabezado: título, conteo y filtro por formato. La acción de subir
          va aquí y no en una cabecera aparte — `HeroLabs` se retiró con sus dos
          botones muertos y sus conteos vuelven repartidos por sección. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="k-t-tarjeta">
            Archivos clínicos
          </h2>
          {hay && (
            <p className="k-t-sec">
              {documentos.length} {documentos.length === 1 ? 'archivo' : 'archivos'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hay && (
            <SelectorSegmentado
              opciones={FORMATOS.map(f => ({ valor: f.clave, rotulo: f.rotulo }))}
              valor={formato}
              onChange={setFormato}
              etiqueta="Filtrar archivos por formato"
            />
          )}
        </div>
      </div>

      {cargando ? (
        <div className="k-tarjeta flex flex-col gap-2" aria-busy="true">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-[44px] rounded-[8px]" />)}
        </div>
      ) : !hay ? (
        /* Sin archivos, SOLO la zona de arrastre: es lo que pide el §6.1 y
           además es la única acción que cabe hacer aquí. */
        <div className="k-tarjeta flex flex-col gap-3">
          <p className="text-[14px] leading-5 text-tinta2">
            Sin archivos clínicos. Sube resultados de laboratorio o estudios de imagen.
          </p>
          {zonaArrastre}
        </div>
      ) : visibles.length === 0 ? (
        <div className="k-tarjeta flex flex-col gap-3">
          <p className="k-t-sec py-3 text-center">Sin archivos de este formato.</p>
          {zonaArrastre}
        </div>
      ) : (
        /* ⚠️ ALTO TOPE Y DESPLAZAMIENTO EN LOS DOS ANCHOS, igual que la lista de
           analitos y que la línea de tiempo del Resumen: una galería de treinta
           estudios empuja las mediciones fuera de alcance. */
        <div className="k-tarjeta max-h-[420px] overflow-y-auto esc:max-h-[560px]">
          {/* Rediseño B7: lista (ver lo ya creado = lista, CALMA §9) con la
              zona de arrastre al pie. */}
          <div className="k-lista">
            {visibles.map(d => (
              <CardDocumento key={d.id} documento={d} onClick={() => setDocPreview(d)} onDelete={() => setDocDelete(d)} />
            ))}
          </div>
          <div className="pt-2">{zonaArrastre}</div>
        </div>
      )}

      {modalSubir && clinicaId && userId && (
        <ModalSubirDocumento
          open
          archivosIniciales={soltados}
          onClose={() => { setModalSubir(false); setSoltados([]) }}
          pacienteId={pacienteId}
          clinicaId={clinicaId}
          userId={userId}
          onSuccess={invalidar}
        />
      )}

      <ModalPreviewDocumento documento={docPreview} onClose={() => setDocPreview(null)} />

      {/* Alerta destructiva del catálogo (CALMA §13): el foco entra en «Cancelar». */}
      <ModalShell
        open={!!docDelete}
        onClose={cerrarDelete}
        variante="alerta"
        tono="destruir"
        icon={<AlertTriangle aria-hidden="true" />}
        title="Eliminar archivo"
        subtitle={docDelete?.nombre_original ?? undefined}
        elevated
        footer={
          <>
            <button type="button" autoFocus onClick={cerrarDelete} disabled={eliminando} className="k-b k-b-capa k-b-quieto">
              Cancelar
            </button>
            <button type="button" data-principal onClick={confirmarDelete} disabled={eliminando} className="k-b k-b-capa k-b-mal">
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        <p>
          ¿Seguro que quieres eliminar{' '}
          <span className="font-semibold">{docDelete?.nombre_original ?? 'este archivo'}</span>?
        </p>
        <p className="mt-2">Esta acción no se puede deshacer.</p>
        {deleteError && <p role="alert" className="k-campo-error mt-3">{deleteError}</p>}
      </ModalShell>
    </section>
  )
}
