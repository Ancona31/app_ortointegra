'use client'

import { Check, X } from 'lucide-react'
import { estaPedido, FRECUENTES_LAB } from '@/components/documentos/estudiosPedidos'

/**
 * «Frecuentes»: diez fichas que se encienden y apagan (`aria-pressed`). El
 * rótulo es corto; lo que piden es el nombre del catálogo (ver
 * `FRECUENTES_LAB`).
 */
export function FrecuentesLab({ pedidos, onAlternar }: { pedidos: readonly string[]; onAlternar: (e: string) => void }) {
  return (
    <div>
      <p className="sp-lab-rot" id="laboratorio-frecuentes">Frecuentes</p>
      <div className="sp-lab-frec" role="group" aria-labelledby="laboratorio-frecuentes">
        {FRECUENTES_LAB.map(f => {
          const on = estaPedido(pedidos, f.estudio)
          return (
            <button key={f.estudio} type="button" aria-pressed={on} title={f.estudio}
              onClick={() => onAlternar(f.estudio)} className="sp-lab-tog">
              {on && <Check aria-hidden="true" />}{f.rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface PropsPedidos {
  pedidos: readonly string[]
  /** El último añadido entra con una animación breve; los demás no. */
  ultimo: string | null
  onQuitar: (e: string) => void
}

/** Lo pedido, como fichas en orden de alta, cada una con su ✕. */
export function PedidosLab({ pedidos, ultimo, onQuitar }: PropsPedidos) {
  return (
    <div>
      <p className="sp-lab-rot" id="laboratorio-solicitados">
        Solicitados{pedidos.length > 0 && ` · ${pedidos.length}`}
      </p>
      {pedidos.length === 0 ? (
        <p className="sp-lab-vacio">Todavía no hay estudios. Busca arriba o toca los frecuentes.</p>
      ) : (
        <ul className="sp-lab-ped" aria-labelledby="laboratorio-solicitados">
          {pedidos.map((p, i) => (
            // Una plantilla vieja puede traer el mismo texto dos veces: la clave lo distingue.
            <li key={`${p}#${pedidos.slice(0, i).filter(x => x === p).length}`} className={`sp-lab-p ${p === ultimo ? 'sp-lab-p--nuevo' : ''}`}>
              <span title={p}>{p}</span>
              <button type="button" aria-label={`Quitar ${p}`} title={`Quitar ${p}`} onClick={() => onQuitar(p)}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* El buscador se vacía al añadir: esto le dice al lector de pantalla qué entró. */}
      <p className="sr-only" role="status">{ultimo ? `Añadido: ${ultimo}` : ''}</p>
    </div>
  )
}
