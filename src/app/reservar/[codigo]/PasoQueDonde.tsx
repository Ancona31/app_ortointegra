'use client'

import type { ReactElement } from 'react'
import type { ConsultorioPagina, TipoPagina } from './clienteReserva'

interface Props {
  consultorios: ConsultorioPagina[]
  consultorioId: string
  onConsultorio: (id: string) => void
  /** Ya filtrados para el consultorio elegido. El bloque sólo sale con más de uno (punto 7). */
  tipos: TipoPagina[]
  tipoId: string
  onTipo: (id: string) => void
}

interface Opcion { id: string; titulo: string; detalle: string | null; extra?: string }

function Opciones({ nombre, etiqueta, opciones, elegida, onElegir }: { nombre: string; etiqueta: string; opciones: Opcion[]; elegida: string; onElegir: (id: string) => void }): ReactElement {
  return (
    <fieldset className="rp-grupo">
      <legend className="rp-etiqueta">{etiqueta}</legend>
      {opciones.map(o => (
        <label key={o.id} className="rp-op">
          <input type="radio" name={nombre} value={o.id} checked={elegida === o.id} onChange={() => onElegir(o.id)} />
          <span className="rp-op__txt"><b>{o.titulo}</b>{o.detalle && <span>{o.detalle}</span>}</span>
          {o.extra && <span className="rp-op__dur">{o.extra}</span>}
        </label>
      ))}
    </fieldset>
  )
}

/**
 * Paso 1, «Lugar» (tanda H, punto 3 de Angel; antes «Qué y dónde»): tarjetas
 * con la dirección COMPLETA del consultorio (antes era un desplegable que la
 * cortaba) y, si hay más de uno, el tipo con su duración. Con un solo
 * consultorio sale IGUAL que con varios, ya elegido (su radio marcado): la
 * persona ve dónde es antes de elegir la hora.
 */
export default function PasoQueDonde(p: Props): ReactElement {
  return (
    <>
      <Opciones nombre="consultorio" etiqueta="Consultorio" elegida={p.consultorioId} onElegir={p.onConsultorio}
        opciones={p.consultorios.map(c => ({ id: c.id, titulo: c.nombre, detalle: c.direccion }))} />
      {p.tipos.length > 1 && (
        <Opciones nombre="tipo" etiqueta="Tipo de cita" elegida={p.tipoId} onElegir={p.onTipo}
          opciones={p.tipos.map(t => ({ id: t.id, titulo: t.nombre, detalle: null, extra: `${t.duracionMin} min` }))} />
      )}
    </>
  )
}
