'use client'

import { FileText, Image as ImageIcon, FileArchive, Trash2, ChevronRight } from 'lucide-react'
import IconoTipoDocumento from '@/components/ui/IconoTipoDocumento'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Documento } from '@/types'
import { formatearBytes } from '@/lib/labs/upload-utils'


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
    /* Rediseño B7 (CALMA §2, §11; maqueta `final-expediente`): una fila de
       lista. El icono del TIPO en su color, sin fondo —estudio de imagen en
       `--d-imagen`, resultado de laboratorio en `--d-laboratorio`, «otro» en
       `--tinta2`—; el nombre entero (envuelve, no se recorta) y debajo «tipo ·
       formato · fecha · tamaño». La fila abre la vista previa; la papelera es
       su segundo destino, siempre visible (en táctil no hay hover). */
    const tipo = documento.tipo === 'estudio_imagen' ? 'Estudio de imagen'
      : documento.tipo === 'resultado_laboratorio' ? 'Resultado de laboratorio' : null
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 py-1.5 text-left transition-opacity active:opacity-70 focus-visible:rounded-[var(--r-control)] focus-visible:outline-3 focus-visible:outline-enlace ih:min-h-[52px] esc:min-h-[52px]"
      >
        <IconoTipoDocumento tipo={documento.tipo} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-5 text-tinta [overflow-wrap:anywhere]" title={nombre}>
            {nombre}
          </span>
          <span className="k-num block text-[13px] leading-[18px] text-tinta2">
            {[tipo, insignia, fecha, size].filter(Boolean).join(' · ')}
          </span>
        </span>
        <button type="button" onClick={manejarDelete} className="k-b k-b-icono shrink-0" aria-label="Eliminar archivo">
          <Trash2 aria-hidden="true" />
        </button>
        <ChevronRight className="k-fila-chev" aria-hidden="true" />
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
