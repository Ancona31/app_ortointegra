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
 * Paso 1, «Qué y dónde»: tarjetas con la dirección COMPLETA del consultorio
 * (antes era un desplegable que la cortaba) y, si hay más de uno, el tipo con
 * su duración. Con un solo consultorio se enseña como tarjeta fija.
 */
export default function PasoQueDonde(p: Props): ReactElement {
  const unico = p.consultorios.length === 1 ? p.consultorios[0] : undefined
  return (
    <>
      {unico ? (
        <div className="rp-grupo">
          <span className="rp-etiqueta">Consultorio</span>
          <div className="rp-op rp-fijo"><span className="rp-op__txt"><b>{unico.nombre}</b>{unico.direccion && <span>{unico.direccion}</span>}</span></div>
        </div>
      ) : (
        <Opciones nombre="consultorio" etiqueta="Consultorio" elegida={p.consultorioId} onElegir={p.onConsultorio}
          opciones={p.consultorios.map(c => ({ id: c.id, titulo: c.nombre, detalle: c.direccion }))} />
      )}
      {p.tipos.length > 1 && (
        <Opciones nombre="tipo" etiqueta="Tipo de cita" elegida={p.tipoId} onElegir={p.onTipo}
          opciones={p.tipos.map(t => ({ id: t.id, titulo: t.nombre, detalle: null, extra: `${t.duracionMin} min` }))} />
      )}
    </>
  )
}
