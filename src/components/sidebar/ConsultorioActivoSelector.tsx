'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, Check } from 'lucide-react'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import { Consultorio } from '@/types'

/**
 * Selector de "consultorio activo" en el sidebar.
 *
 * Visible solo si:
 * - profile.role === 'medico' (vía useProfile().isDoctor); secretarias no
 *   tienen consultorios propios — al agendar citas eligen el consultorio
 *   del médico desde el modal de agenda (Bloque F3-6).
 * - consultorios.length >= 2.
 *
 * El cambio del activo abre un modal de confirmación (ModalShell) antes
 * de invocar cambiarActivo() del Context.
 */
export default function ConsultorioActivoSelector() {
  const { isDoctor } = useProfile()
  const { consultorios } = useConsultorios()
  const { consultorioActivo, cambiarActivo } = useConsultorioActivo()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [pendingChange, setPendingChange] = useState<Consultorio | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click-outside cierra el dropdown. Desactivado mientras el modal de
  // confirmación está abierto (el modal vive en Portal fuera de containerRef
  // y un click en sus botones cerraría el dropdown indebidamente).
  useEffect(() => {
    if (!open || pendingChange) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, pendingChange])

  // ESC cierra el dropdown (solo si no hay modal de confirmación encima;
  // ModalShell maneja su propio ESC).
  useEffect(() => {
    if (!open || pendingChange) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, pendingChange])

  if (!isDoctor) return null
  if (consultorios.length < 2) return null
  if (!consultorioActivo) return null

  const getDisplayName = (c: Consultorio) => c.nombre_corto || c.nombre

  const handleClick = (c: Consultorio) => {
    if (c.id === consultorioActivo.id) {
      setOpen(false)
      return
    }
    setPendingChange(c)
  }

  const handleConfirm = () => {
    if (!pendingChange) return
    cambiarActivo(pendingChange)
    toast.info(`Consultorio activo: ${getDisplayName(pendingChange)}`)
    setPendingChange(null)
    setOpen(false)
  }

  return (
    <>
      <div ref={containerRef} className="relative px-5 py-3 border-b border-white/10">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-all"
        >
          <div className="flex flex-col items-start text-left min-w-0">
            <span className="text-[10px] font-semibold opacity-50 uppercase tracking-widest">
              Consultorio activo
            </span>
            <span className="text-sm font-medium text-white truncate w-full">
              {getDisplayName(consultorioActivo)}
            </span>
          </div>
          <ChevronRight
            size={14}
            className={`opacity-50 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute left-5 right-5 mt-1 bg-white rounded-xl shadow-lg z-50 py-1 max-h-[50vh] overflow-y-auto">
            {consultorios.map((c) => (
              <button
                key={c.id}
                onClick={() => handleClick(c)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span className="truncate">{getDisplayName(c)}</span>
                {c.id === consultorioActivo.id && (
                  <Check size={14} className="text-[var(--cp)] flex-shrink-0" />
                )}
              </button>
            ))}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <Link
                href="/perfil"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-xs text-[var(--cp)] hover:bg-slate-50 transition-colors"
              >
                Gestionar consultorios →
              </Link>
            </div>
          </div>
        )}
      </div>

      <ModalShell
        open={!!pendingChange}
        onClose={() => setPendingChange(null)}
        title="Cambiar consultorio activo"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2 px-5 py-3.5">
            <button
              onClick={() => setPendingChange(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--cp)] hover:opacity-90 transition-opacity"
            >
              Sí, cambiar
            </button>
          </div>
        }
      >
        <div className="px-5 py-5">
          <p className="text-sm text-slate-700">
            ¿Cambiar a <strong>{pendingChange ? getDisplayName(pendingChange) : ''}</strong>?
          </p>
        </div>
      </ModalShell>
    </>
  )
}
