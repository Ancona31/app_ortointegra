'use client'

import { Trash2, ChevronRight } from 'lucide-react'
import IconoTipoDocumento from '@/components/ui/IconoTipoDocumento'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Documento } from '@/types'
import { formatearBytes } from '@/lib/labs/upload-utils'

/** Insignia del formato: el mime sólo decide el rótulo («PDF», «IMG»…). */
function insigniaDe(doc: Documento): string {
  const mime = doc.mime_type ?? ''
  if (mime.startsWith('image/')) return 'IMG'
  if (mime === 'application/pdf') return 'PDF'
  if (mime === 'application/dicom') return 'DICOM'
  return 'ARCHIVO'
}

interface Props {
  documento: Documento
  onClick: () => void
  onDelete: () => void
}

export default function CardDocumento({ documento, onClick, onDelete }: Props) {
  const insignia = insigniaDe(documento)
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
