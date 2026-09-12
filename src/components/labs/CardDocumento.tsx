'use client'

import { FileText, Image as ImageIcon, FileArchive, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Documento } from '@/types'
import { formatearBytes } from '@/lib/labs/upload-utils'

const NOMBRE_MAX = 40

function truncarNombre(nombre: string): string {
  if (nombre.length <= NOMBRE_MAX) return nombre
  return nombre.slice(0, NOMBRE_MAX - 1) + '…'
}

/**
 * Formato del archivo, con su glifo, su insignia y su tinta.
 *
 * ⚠️ LA TINTA SALE DEL TIPO DE DOCUMENTO, NO DEL MIME. Un resultado de
 * laboratorio y un estudio de imagen son dos cosas distintas del expediente
 * aunque los dos lleguen como PDF, y `--sp-doc-laboratorio` y `--sp-doc-imagen`
 * son los colores que la app ya les asigna. El mime solo decide el GLIFO y el
 * rótulo de la insignia.
 */
type Formato = { Icono: typeof FileText; insignia: string; esImagen: boolean }

function formatoDe(doc: Documento): Formato {
  const mime = doc.mime_type ?? ''
  if (mime.startsWith('image/')) return { Icono: ImageIcon, insignia: 'IMG', esImagen: true }
  if (mime === 'application/pdf') return { Icono: FileText, insignia: 'PDF', esImagen: false }
  if (mime === 'application/dicom') return { Icono: FileArchive, insignia: 'DICOM', esImagen: false }
  return { Icono: FileText, insignia: 'ARCHIVO', esImagen: false }
}

function tintaDe(doc: Documento): string {
  return doc.tipo === 'estudio_imagen' ? 'var(--sp-doc-imagen)' : 'var(--sp-doc-laboratorio)'
}

interface Props {
  documento: Documento
  onClick: () => void
  onDelete: () => void
  layout?: 'grid' | 'list'
}

export default function CardDocumento({ documento, onClick, onDelete, layout = 'grid' }: Props) {
  const { Icono, insignia, esImagen } = formatoDe(documento)
  const tinta = tintaDe(documento)
  const nombre = documento.nombre_original ?? 'Archivo'
  const fechaISO = documento.created_at
  const fecha = fechaISO ? format(parseISO(fechaISO), 'd MMM yyyy', { locale: es }) : ''
  const size = documento.tamaño_bytes ? formatearBytes(Number(documento.tamaño_bytes)) : ''

  function manejarDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  if (layout === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="group flex w-full cursor-pointer items-center gap-[var(--sp-3)] rounded-[var(--sp-r-card-inner)] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] px-[var(--sp-3)] py-[var(--sp-2-5)] text-left transition-colors hover:bg-[var(--sp-surface-muted)]"
      >
        <span
          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[var(--sp-r-btn-sm)]"
          style={{ background: `color-mix(in srgb, ${tinta} 12%, var(--sp-surface))`, color: tinta }}
        >
          <Icono size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[length:var(--sp-fs-hint)] font-semibold text-[var(--sp-ink-800)]" title={nombre}>
            {truncarNombre(nombre)}
          </span>
          <span className="block text-[11px] text-[var(--sp-ink-350)]">
            {[fecha, size].filter(Boolean).join(' · ')}
          </span>
        </span>
        <button
          type="button"
          onClick={manejarDelete}
          className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[var(--sp-r-btn-sm)] text-[var(--sp-ink-icon)] transition-colors hover:bg-[var(--sp-danger-bg)] hover:text-[var(--sp-danger)]"
          aria-label="Eliminar archivo"
        >
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[14px] border border-[color:var(--sp-line-card)] bg-[var(--sp-surface)] text-left transition-colors hover:border-[color:var(--sp-line-input)]"
    >
      {/* ── Zona de vista previa, de proporción estable ────────────────────
          ⚠️ EL PATRÓN NO ES UNA MINIATURA, Y ESO ES DELIBERADO. Las miniaturas
          reales son funcionalidad nueva y exigirían firmar una url por archivo
          solo para pintar la galería. Una imagen se distingue por su trama
          diagonal y su insignia `IMG`; un PDF y un DICOM, por su glifo. Ninguno
          finge enseñar el contenido del archivo. */}
      <div
        className="relative flex h-[132px] shrink-0 items-center justify-center"
        style={esImagen
          ? {
              backgroundColor: `color-mix(in srgb, ${tinta} 7%, var(--sp-surface))`,
              backgroundImage: `repeating-linear-gradient(45deg, color-mix(in srgb, ${tinta} 14%, transparent) 0 6px, transparent 6px 14px)`,
            }
          : { background: `color-mix(in srgb, ${tinta} 8%, var(--sp-surface))` }}
      >
        <Icono size={30} style={{ color: tinta, opacity: 0.9 }} />

        <span
          className="absolute left-[8px] top-[8px] rounded-[var(--sp-r-btn-sm)] px-[8px] py-[3px] text-[10px] font-extrabold tracking-[var(--sp-ls-label)]"
          style={{ background: 'var(--sp-surface)', color: tinta }}
        >
          {insignia}
        </span>

        <button
          type="button"
          onClick={manejarDelete}
          className="absolute right-[8px] top-[8px] inline-flex h-[28px] w-[28px] items-center justify-center rounded-[var(--sp-r-btn-sm)] bg-[var(--sp-surface)] text-[var(--sp-ink-icon)] opacity-0 transition-opacity hover:text-[var(--sp-danger)] focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Eliminar archivo"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-[2px] border-t border-[color:var(--sp-line-divider)] px-[12px] py-[10px]">
        <p className="truncate text-[13px] font-semibold text-[var(--sp-ink-800)]" title={nombre}>
          {nombre}
        </p>
        <p className="text-[11.5px] text-[var(--sp-ink-350)]">
          {[fecha, size].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}
