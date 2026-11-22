'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CATEGORIAS_LAB } from '@/lib/estudiosLab'
import { estaPedido, pedidosEn } from '@/components/documentos/estudiosPedidos'

interface Props {
  pedidos: readonly string[]
  onAlternar: (estudio: string) => void
}

/**
 * «Ver el catálogo por categoría», plegado por omisión. Cada categoría es una
 * sección plegable con casillas y dice cuántos de los suyos van pedidos. Las
 * casillas sólo se pintan con la sección abierta: 291 casillas ocultas no le
 * sirven a nadie. Marcar o desmarcar añade o quita la ficha.
 */
export default function CatalogoEstudios({ pedidos, onAlternar }: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <details className="sp-card sp-doc-card sp-lab-catalogo" onToggle={e => setAbierto(e.currentTarget.open)}>
      <summary className="sp-lab-catalogo-t">
        <span>Ver el catálogo por categoría</span>
        <ChevronDown aria-hidden="true" className="sp-lab-flecha" />
      </summary>
      {abierto && (
        <div className="sp-lab-cats">
          {CATEGORIAS_LAB.map(c => <CategoriaEstudios key={c.nombre} nombre={c.nombre} estudios={c.estudios}
            pedidos={pedidos} onAlternar={onAlternar} />)}
        </div>
      )}
    </details>
  )
}

interface PropsCategoria extends Props {
  nombre: string
  estudios: readonly string[]
}

function CategoriaEstudios({ nombre, estudios, pedidos, onAlternar }: PropsCategoria) {
  const [abierta, setAbierta] = useState(false)
  const n = pedidosEn(pedidos, estudios)
  return (
    <details className="sp-lab-cat" onToggle={e => setAbierta(e.currentTarget.open)}>
      <summary>
        <span className="sp-lab-cat-n">{nombre}</span>
        <span className="sp-lab-cat-c">
          {n > 0 ? <><b>{n}</b> de {estudios.length}</> : estudios.length}
          <span className="sr-only">{n > 0 ? ' pedidos' : ' estudios'}</span>
        </span>
        <ChevronDown aria-hidden="true" className="sp-lab-flecha" />
      </summary>
      {abierta && (
        <div className="sp-lab-its">
          {estudios.map(e => (
            <label key={e} className="sp-lab-it">
              <input type="checkbox" checked={estaPedido(pedidos, e)} onChange={() => onAlternar(e)} />
              <span>{e}</span>
            </label>
          ))}
        </div>
      )}
    </details>
  )
}
