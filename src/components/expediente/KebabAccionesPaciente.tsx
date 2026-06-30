'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MoreVertical, FileText, Pencil } from 'lucide-react'

// Menú de acciones por paciente en la tabla de /expediente (desktop).
//
// El panel del menú se renderiza vía portal en document.body con position:fixed,
// posicionado desde las coordenadas del botón. Esto evita que el contenedor
// overflow-x-auto de la tabla lo recorte (en las últimas filas el menú absolute
// quedaba cortado y disparaba scroll). El menú flota sobre la pantalla.
//
// Se cierra al: clic fuera (botón o panel), scroll, resize y al navegar.
//
// Visibilidad por rol: este componente NO decide si se muestra — la tabla solo
// lo renderiza cuando mostrarAcciones es true.
export function KebabAccionesPaciente({ pacienteId }: { pacienteId: string }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const cerrar = useCallback(() => setOpen(false), [])

  function abrir() {
    const rect = botonRef.current?.getBoundingClientRect()
    if (!rect) return
    setCoords({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (
        botonRef.current && !botonRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    function onScroll() { setOpen(false) }
    function onResize() { setOpen(false) }

    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <div className="flex justify-end">
      <button
        ref={botonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-label="Acciones del paciente"
        aria-expanded={open}
        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e5fa8] hover:bg-slate-100 transition-colors"
      >
        <MoreVertical size={18} />
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden"
        >
          <Link
            href={`/expediente/${pacienteId}`}
            onClick={cerrar}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#1d1d1f] hover:bg-slate-50 transition-colors"
          >
            <FileText size={15} className="text-[#86868b]" />
            Ir a expediente
          </Link>
          <Link
            href={`/expediente/${pacienteId}/editar`}
            onClick={cerrar}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#1d1d1f] hover:bg-slate-50 transition-colors"
          >
            <Pencil size={15} className="text-[#86868b]" />
            Editar paciente
          </Link>
        </div>,
        document.body,
      )}
    </div>
  )
}
