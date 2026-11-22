'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { OrdenColumna, OrdenDireccion, MedicoOpcion } from '@/lib/expediente/fetchPacientes'

/* Rediseño B6 (maqueta `final-lista`, «hoja-filtros»): la hoja de filtros de
   `ext`/`tel` es ahora una capa del catálogo (`ModalShell`): hoja arrastrable
   en `tel`, tarjeta centrada en `ext` (CALMA §26). La capa pone el velo, Esc,
   el foco atrapado, el bloqueo del desplazamiento y la salida animada; aquí
   sólo queda el BORRADOR, que se promueve con «Ver resultados» en una sola
   recarga (como siempre). En `ih`/`iv`/`esc` la página abre otra capa, con
   los filtros de aplicación inmediata de escritorio. */

const OPCIONES_ORDEN: { valor: OrdenColumna; etiqueta: string }[] = [
  { valor: 'apellidos', etiqueta: 'Apellido' },
  { valor: 'nombre', etiqueta: 'Nombre' },
  { valor: 'created_at', etiqueta: 'Fecha de ingreso' },
  { valor: 'fecha_nacimiento', etiqueta: 'Edad' },
  { valor: 'numero_expediente', etiqueta: 'N.º de expediente' },
]

/* Píldora de opción: contorno fino en reposo, tonal elegida (CALMA §11). */
function clasePildora(activa: boolean): string {
  return `k-b h-9 px-3 text-[14px] rounded-full ${activa
    ? 'bg-tonal text-tonal-tinta font-semibold'
    : 'font-normal text-tinta shadow-[inset_0_0_0_1px_var(--borde)]'}`
}

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
  const [bMedico, setBMedico] = useState(medicoId)
  const [bDesde, setBDesde] = useState(fechaDesde)
  const [bHasta, setBHasta] = useState(fechaHasta)
  const [bOrden, setBOrden] = useState<OrdenColumna>(orden)
  const [bDireccion, setBDireccion] = useState<OrdenDireccion>(direccion)

  // Al abrir, el borrador parte de los filtros vigentes. Se ajusta DURANTE el
  // render (el patrón de React para reaccionar a una prop), no en un efecto.
  const [abiertoPrevio, setAbiertoPrevio] = useState(open)
  if (abiertoPrevio !== open) {
    setAbiertoPrevio(open)
    if (open) {
      setBMedico(medicoId)
      setBDesde(fechaDesde)
      setBHasta(fechaHasta)
      setBOrden(orden)
      setBDireccion(direccion)
    }
  }

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
    onClose()
  }

  const pie = (
    <div className="flex gap-2.5 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] [&>.k-b]:flex-1">
      <button type="button" onClick={limpiar} className="k-b k-b-capa k-b-tonal">
        Limpiar
      </button>
      <button type="button" onClick={verResultados} className="k-b k-b-capa k-b-prim">
        Ver resultados
      </button>
    </div>
  )

  return (
    <ModalShell open={open} onClose={onClose} title="Filtrar y ordenar" maxWidth="max-w-lg" footer={pie} cierraConVelo={false}>
      <div className="space-y-5 px-5 pt-1 pb-5">
        <label className="k-campo-g">
          <span className="k-etiqueta">Médico</span>
          <select value={bMedico} onChange={e => setBMedico(e.target.value)} className="k-campo">
            {!ocultarTodosMedicos && <option value="">Todos los médicos</option>}
            {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
          </select>
        </label>

        <fieldset className="k-campo-g">
          <legend className="k-etiqueta mb-1">Fecha de ingreso</legend>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={bDesde} onChange={e => setBDesde(e.target.value)} aria-label="Ingreso desde" className="k-campo" />
            <input type="date" value={bHasta} onChange={e => setBHasta(e.target.value)} aria-label="Ingreso hasta" className="k-campo" />
          </div>
        </fieldset>

        <fieldset>
          <legend className="k-etiqueta mb-2">Ordenar por</legend>
          <div className="flex flex-wrap gap-2">
            {OPCIONES_ORDEN.map(op => (
              <button key={op.valor} type="button" aria-pressed={bOrden === op.valor}
                onClick={() => setBOrden(op.valor)} className={clasePildora(bOrden === op.valor)}>
                {op.etiqueta}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="k-etiqueta mb-2">Dirección</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={bDireccion === 'asc'} onClick={() => setBDireccion('asc')} className={clasePildora(bDireccion === 'asc')}>
              <ArrowUp size={15} aria-hidden="true" /> Ascendente
            </button>
            <button type="button" aria-pressed={bDireccion === 'desc'} onClick={() => setBDireccion('desc')} className={clasePildora(bDireccion === 'desc')}>
              <ArrowDown size={15} aria-hidden="true" /> Descendente
            </button>
          </div>
        </fieldset>
      </div>
    </ModalShell>
  )
}
