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

  const visibles = useMemo(
    () => (formato === 'todos' ? documentos : documentos.filter(d => formatoDe(d.mime_type) === formato)),
    [documentos, formato],
  )

  const hay = documentos.length > 0
  const cargando = docsLoading && !hay

  const deleteFooter = (
    <div className="flex items-center justify-end gap-[var(--sp-2)] px-[var(--sp-5)] py-[var(--sp-3)]">
      <button type="button" onClick={cerrarDelete} disabled={eliminando} className="sp-btn sp-btn--secondary">
        Cancelar
      </button>
      {/* La destructiva, en menor peso visual que cancelar. */}
      <button
        type="button"
        onClick={confirmarDelete}
        disabled={eliminando}
        className="sp-btn"
        style={{ background: 'transparent', color: 'var(--sp-danger)', fontSize: 'var(--sp-fs-btn-sm)', padding: '13px 20px' }}
      >
        {eliminando ? 'Eliminando…' : 'Eliminar'}
      </button>
    </div>
  )

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
      className="flex min-h-[186px] flex-col items-center justify-center gap-[var(--sp-2)] rounded-[14px] border border-dashed px-[var(--sp-3)] text-center transition-colors disabled:opacity-50"
      style={arrastrando
        ? { borderColor: 'var(--sp-primary)', background: 'var(--sp-primary-bg-faint)' }
        : { borderColor: 'var(--sp-line-dash)', background: 'var(--sp-surface)' }}
    >
      <UploadCloud size={26} className="text-[var(--sp-ink-150)]" />
      <span className="text-[12.5px] leading-snug text-[var(--sp-ink-500)]">
        Arrastra archivos aquí o haz clic para subir
      </span>
    </button>
  )

  return (
    <section>
      {/* Encabezado: título, conteo y filtro por formato. La acción de subir
          va aquí y no en una cabecera aparte — `HeroLabs` se retiró con sus dos
          botones muertos y sus conteos vuelven repartidos por sección. */}
      <div className="mb-[var(--sp-3-5)] flex flex-wrap items-center justify-between gap-[var(--sp-2-5)]">
        <div className="flex flex-wrap items-baseline gap-[var(--sp-2-5)]">
          <h2 className="text-[length:var(--sp-fs-vitals)] font-bold text-[var(--sp-ink-800)]">
            Archivos clínicos
          </h2>
          {hay && (
            <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
              {documentos.length} {documentos.length === 1 ? 'archivo' : 'archivos'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-[var(--sp-2-5)]">
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
        <div className="grid grid-cols-2 gap-[var(--sp-2-5)] lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-[92px] rounded-[14px]" />)}
        </div>
      ) : !hay ? (
        /* Sin archivos, SOLO la zona de arrastre: es lo que pide el §6.1 y
           además es la única acción que cabe hacer aquí. */
        <div className="flex flex-col gap-[var(--sp-2-5)]">
          <p className="text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">
            Sin archivos clínicos. Sube resultados de laboratorio o estudios de imagen.
          </p>
          <div className="max-w-[280px]">{zonaArrastre}</div>
        </div>
      ) : visibles.length === 0 ? (
        <p className="rounded-[var(--sp-r-card)] border border-dashed border-[color:var(--sp-line-card)] px-[var(--sp-4)] py-[var(--sp-7)] text-center text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">
          Sin archivos de este formato.
        </p>
      ) : (
        /* ⚠️ ALTO TOPE Y DESPLAZAMIENTO EN LOS DOS ANCHOS, igual que la lista de
           analitos y que la línea de tiempo del Resumen: una galería de treinta
           estudios empuja las mediciones fuera de alcance. */
        <div className="max-h-[420px] overflow-y-auto lg:max-h-[560px]">
          {/* Retícula de relleno automático: dos columnas en móvil, las que
              quepan a partir de 178 px de ancho mínimo en adelante. */}
          <div className="grid grid-cols-2 gap-[var(--sp-3-5)] lg:grid-cols-[repeat(auto-fill,minmax(178px,1fr))]">
            {visibles.map(d => (
              <CardDocumento key={d.id} documento={d} onClick={() => setDocPreview(d)} onDelete={() => setDocDelete(d)} />
            ))}
            {zonaArrastre}
          </div>
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

      {docDelete && (
        <ModalShell
          open
          onClose={cerrarDelete}
          title="Eliminar archivo"
          subtitle={docDelete.nombre_original ?? undefined}
          icon={<AlertTriangle size={16} />}
          iconBg="bg-[var(--sp-danger-bg)] text-[var(--sp-danger)]"
          maxWidth="max-w-sm"
          footer={deleteFooter}
          elevated
        >
          <div className="flex flex-col gap-[var(--sp-2-5)] px-[var(--sp-5)] py-[var(--sp-4)]">
            <p className="text-[length:var(--sp-fs-body-sm)] leading-relaxed text-[var(--sp-ink-700)]">
              ¿Seguro que quieres eliminar{' '}
              <span className="font-semibold">{docDelete.nombre_original ?? 'este archivo'}</span>?
            </p>
            <p className="text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-500)]">Esta acción no se puede deshacer.</p>
            {deleteError && (
              <p className="rounded-[var(--sp-r-field-sm)] border border-[color:var(--sp-danger-border)] bg-[var(--sp-danger-bg)] px-[var(--sp-3)] py-[var(--sp-2)] text-[length:var(--sp-fs-hint)] text-[var(--sp-danger)]">
                {deleteError}
              </p>
            )}
          </div>
        </ModalShell>
      )}
    </section>
  )
}
