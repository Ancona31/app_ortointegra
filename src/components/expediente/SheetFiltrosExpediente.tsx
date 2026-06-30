'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ArrowUp, ArrowDown } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { OrdenColumna, OrdenDireccion, MedicoOpcion } from '@/lib/expediente/fetchPacientes'

let sheetStack = 0
let prevBodyOverflow = ''

const OPCIONES_ORDEN: { valor: OrdenColumna; etiqueta: string }[] = [
  { valor: 'apellidos', etiqueta: 'Apellido' },
  { valor: 'nombre', etiqueta: 'Nombre' },
  { valor: 'created_at', etiqueta: 'Fecha de ingreso' },
  { valor: 'fecha_nacimiento', etiqueta: 'Edad' },
  { valor: 'numero_expediente', etiqueta: 'N.º de expediente' },
]

interface Props {
  open: boolean
  onClose: () => void
  medicoId: string
  fechaDesde: string
  fechaHasta: string
  orden: OrdenColumna
  direccion: OrdenDireccion
  medicos: MedicoOpcion[]
  ocultarTodosMedicos: boolean
  medicoPorDefecto: string
  onAplicar: (f: {
    medicoId: string
    fechaDesde: string
    fechaHasta: string
    orden: OrdenColumna
    direccion: OrdenDireccion
  }) => void
}

export function SheetFiltrosExpediente({
  open,
  onClose,
  medicoId,
  fechaDesde,
  fechaHasta,
  orden,
  direccion,
  medicos,
  ocultarTodosMedicos,
  medicoPorDefecto,
  onAplicar,
}: Props) {
  const [montado, setMontado] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const cerrarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [bMedico, setBMedico] = useState(medicoId)
  const [bDesde, setBDesde] = useState(fechaDesde)
  const [bHasta, setBHasta] = useState(fechaHasta)
  const [bOrden, setBOrden] = useState<OrdenColumna>(orden)
  const [bDireccion, setBDireccion] = useState<OrdenDireccion>(direccion)

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Dispara la animación de salida y, tras 300ms, desmonta + notifica al padre.
  function iniciarCierre() {
    if (cerrando) return
    setCerrando(true)
    if (cerrarTimerRef.current) clearTimeout(cerrarTimerRef.current)
    cerrarTimerRef.current = setTimeout(() => {
      setMontado(false)
      setCerrando(false)
      onCloseRef.current()
    }, 300)
  }

  // Apertura/cierre gobernado por la prop open.
  useEffect(() => {
    if (open) {
      if (cerrarTimerRef.current) { clearTimeout(cerrarTimerRef.current); cerrarTimerRef.current = null }
      setCerrando(false)
      setMontado(true)
      setBMedico(medicoId)
      setBDesde(fechaDesde)
      setBHasta(fechaHasta)
      setBOrden(orden)
      setBDireccion(direccion)
    } else if (montado && !cerrando) {
      iniciarCierre()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Lock de scroll + Escape, mientras el sheet esté montado.
  useEffect(() => {
    if (!montado) return
    sheetStack += 1
    if (sheetStack === 1) {
      prevBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') iniciarCierre()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      sheetStack -= 1
      if (sheetStack === 0) document.body.style.overflow = prevBodyOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado])

  // Limpieza del timer al desmontar.
  useEffect(() => {
    return () => { if (cerrarTimerRef.current) clearTimeout(cerrarTimerRef.current) }
  }, [])

  function limpiar() {
    setBMedico(medicoPorDefecto)
    setBDesde('')
    setBHasta('')
    setBOrden('created_at')
    setBDireccion('desc')
  }

  function verResultados() {
    onAplicar({
      medicoId: bMedico,
      fechaDesde: bDesde,
      fechaHasta: bHasta,
      orden: bOrden,
      direccion: bDireccion,
    })
    iniciarCierre()
  }

  if (!montado) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div
          onClick={iniciarCierre}
          style={cerrando ? { animationFillMode: 'forwards' } : undefined}
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm ${cerrando ? 'animate-[fadeOut_0.3s_ease-out]' : 'animate-fade-in'}`}
        />
        <div
          style={cerrando ? { animationFillMode: 'forwards' } : undefined}
          className={`relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col ${
            cerrando
              ? 'animate-[slideDownSheet_0.3s_cubic-bezier(0.32,0.72,0,1)]'
              : 'animate-[slideUpSheet_0.3s_cubic-bezier(0.32,0.72,0,1)]'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <h2 className="text-base font-bold text-[#1d1d1f]">Filtrar y ordenar</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={limpiar}
                className="text-sm text-[#86868b] hover:text-[#1e5fa8] font-medium px-2 py-1 rounded-lg transition-colors"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={iniciarCierre}
                aria-label="Cerrar"
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Médico</label>
              <select
                value={bMedico}
                onChange={e => setBMedico(e.target.value)}
                className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
              >
                {!ocultarTodosMedicos && <option value="">Todos los médicos</option>}
                {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Fecha de ingreso</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={bDesde}
                  onChange={e => setBDesde(e.target.value)}
                  className="flex-1 min-w-0 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
                />
                <span className="text-[#86868b] text-sm flex-shrink-0">—</span>
                <input
                  type="date"
                  value={bHasta}
                  onChange={e => setBHasta(e.target.value)}
                  className="flex-1 min-w-0 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Ordenar por</label>
              <div className="flex flex-wrap gap-2">
                {OPCIONES_ORDEN.map(op => {
                  const activo = bOrden === op.valor
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => setBOrden(op.valor)}
                      className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
                        activo
                          ? 'bg-[#1e5fa8] text-white border-[#1e5fa8]'
                          : 'bg-white text-[#3d3d3f] border-slate-200 hover:border-[#1e5fa8]/40'
                      }`}
                    >
                      {op.etiqueta}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Dirección</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBDireccion('asc')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    bDireccion === 'asc'
                      ? 'bg-[#1e5fa8]/10 text-[#1e5fa8] border-[#1e5fa8]/40'
                      : 'bg-white text-[#3d3d3f] border-slate-200 hover:border-[#1e5fa8]/40'
                  }`}
                >
                  <ArrowUp size={15} /> Ascendente
                </button>
                <button
                  type="button"
                  onClick={() => setBDireccion('desc')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    bDireccion === 'desc'
                      ? 'bg-[#1e5fa8]/10 text-[#1e5fa8] border-[#1e5fa8]/40'
                      : 'bg-white text-[#3d3d3f] border-slate-200 hover:border-[#1e5fa8]/40'
                  }`}
                >
                  <ArrowDown size={15} /> Descendente
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button
              type="button"
              onClick={verResultados}
              className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] transition-colors shadow-sm"
            >
              Ver resultados
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
