'use client'

/**
 * Sección numerada de la solicitud de internamiento compacta (maqueta
 * `internamiento.html`, aprobada). A diferencia de `SeccionPlegable` —que es
 * autónoma y la usa también el consentimiento con su propio comportamiento—,
 * esta es CONTROLADA: el formulario decide cuál está abierta (una a la vez) y
 * qué hace Tab al final de cada una.
 *
 * Plegada es una línea: número, título y resumen (truncado). Completa, el
 * número y el título van en verde; con un obligatorio que falta tras intentar
 * imprimir, el resumen va en rojo. En el contenedor estrecho (`ext`/`tel`) el
 * resumen baja a un segundo renglón. El cuerpo plegado no se monta: el estado
 * vive en el formulario.
 */

import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface Props {
  id: string
  /** Prefijo de los ids de cabecera y cuerpo. Internamiento por omisión; el consentimiento pasa el suyo. */
  prefijo?: string
  numero: number
  titulo: string
  resumen: string
  completa: boolean
  /** Hay un obligatorio sin llenar Y ya se intentó imprimir. */
  falta: boolean
  abierta: boolean
  onAlternar: () => void
  onTeclaCuerpo: (e: KeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
}

export default function SeccionPaso(p: Props): ReactElement {
  const estado = p.abierta ? 'abierta' : p.falta ? 'falta' : p.completa ? 'completa' : 'vacia'
  const pre = p.prefijo ?? 'internamiento'
  return (
    <section className="sp-int-sec" data-seccion={p.id} data-estado={estado}>
      <h2 className="sp-int-sec-h">
        <button type="button" id={`${pre}-${p.id}-cabecera`} className="sp-int-sec-b"
          aria-expanded={p.abierta} aria-controls={`${pre}-${p.id}-cuerpo`} onClick={p.onAlternar}>
          <span className="sp-int-n" aria-hidden="true">{p.numero}</span>
          <span className="sp-int-t">{p.titulo}</span>
          {!p.abierta && <span className="sp-int-res">{p.resumen}</span>}
          <ChevronRight aria-hidden="true" className="sp-int-chev" />
        </button>
      </h2>
      {p.abierta && (
        <div id={`${pre}-${p.id}-cuerpo`} role="region" aria-labelledby={`${pre}-${p.id}-cabecera`}
          className="sp-int-cuerpo" onKeyDown={p.onTeclaCuerpo}>
          {p.children}
        </div>
      )}
    </section>
  )
}
