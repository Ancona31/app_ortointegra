'use client'

import { FileText, Image as ImageIcon, FileArchive, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Documento } from '@/types'
import { formatearBytes } from '@/lib/labs/upload-utils'

const IOS_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'
const NOMBRE_MAX = 40

function truncarNombre(nombre: string): string {
  if (nombre.length <= NOMBRE_MAX) return nombre
  return nombre.slice(0, NOMBRE_MAX - 1) + '…'
}

type IconoInfo = {
  Icono: typeof FileText
  bg: string
  color: string
}

function iconoInfo(doc: Documento): IconoInfo {
  const mime = doc.mime_type ?? ''
  if (mime === 'application/pdf') {
    return doc.tipo === 'estudio_imagen'
      ? { Icono: FileText, bg: 'bg-violet-50', color: 'text-violet-600' }
      : { Icono: FileText, bg: 'bg-teal-50', color: 'text-teal-600' }
  }
  if (mime.startsWith('image/')) {
    return { Icono: ImageIcon, bg: 'bg-violet-50', color: 'text-violet-600' }
  }
  if (mime === 'application/dicom') {
    return { Icono: FileArchive, bg: 'bg-teal-50', color: 'text-teal-600' }
  }
  return { Icono: FileText, bg: 'bg-slate-50', color: 'text-slate-500' }
}

interface Props {
  documento: Documento
  onClick: () => void
  onDelete: () => void
  layout?: 'grid' | 'list'
}

export default function CardDocumento({ documento, onClick, onDelete, layout = 'grid' }: Props) {
  const { Icono, bg, color } = iconoInfo(documento)
  const nombre = documento.nombre_original ?? 'Documento'
  const fechaISO = documento.created_at
  const fecha = fechaISO ? format(parseISO(fechaISO), "d MMM yyyy", { locale: es }) : ''
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
        className="group w-full flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm active:scale-[0.99] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
        style={{ transitionTimingFunction: IOS_EASING }}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
          <Icono size={16} className={color} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-slate-800 truncate" title={nombre}>
            {truncarNombre(nombre)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {fecha && <span>{fecha}</span>}
            {fecha && size && <span className="text-slate-300">·</span>}
            {size && <span>{size}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={manejarDelete}
          className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          aria-label="Eliminar documento"
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
      className="group relative flex flex-col items-start gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-md active:scale-[0.98] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
      style={{ transitionTimingFunction: IOS_EASING }}
    >
      <div className="flex items-start justify-between w-full">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
          <Icono size={18} className={color} />
        </div>
        <button
          type="button"
          onClick={manejarDelete}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Eliminar documento"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <p className="text-[12.5px] font-medium text-slate-800 line-clamp-2 w-full" title={nombre}>
        {truncarNombre(nombre)}
      </p>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-auto">
        {fecha && <span>{fecha}</span>}
        {fecha && size && <span className="text-slate-300">·</span>}
        {size && <span>{size}</span>}
      </div>
    </div>
  )
}
