'use client'

/**
 * Card plegable de los formularios de documento — mecánica de
 * `PROPUESTA_DISENO_DOCUMENTOS.md` §3.A.3, estrenada por
 * `GUIA_FORM_INTERNAMIENTO.md` §3.4 y §4.
 *
 * Vive en su propio archivo y no dentro del formulario porque ya nace con dos
 * consumidores —las dos secciones de texto largo del internamiento— y un
 * tercero declarado: las siete secciones del consentimiento
 * (`GUIA_FORM_CONSENTIMIENTO.md` §3), que las quiere con el mismo alto de
 * cabecera, el mismo resumen y el mismo `aria-expanded`.
 *
 * Lo plegado NO se desmonta por ahorro: el estado del contenido vive en el
 * formulario, así que desmontar el cuerpo no pierde nada y evita mantener en el
 * árbol un `<textarea>` de 566 caracteres que nadie está mirando.
 */

import { useState, type ReactElement, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  /** Prefijo de los ids del par cabecera/cuerpo: `internamiento-piso`. */
  id: string
  titulo: string
  /**
   * Resumen de lo que hay dentro, en un `.sp-badge` junto al título. Sin él,
   * plegar esconde información en vez de resumirla (§3.4). Se omite cuando no
   * hay nada que resumir: un badge vacío no informa.
   */
  resumen?: string
  /**
   * Resumen mientras está abierta, que no es el mismo: plegada dice `2 grupos ·
   * 3 renglones` y abierta solo `2 grupos`, porque el detalle ya se ve (§3.4).
   * Sin él, el resumen no cambia al abrir.
   */
  resumenAbierta?: string
  /** Nace plegada salvo que se pida lo contrario. Es la decisión de §3. */
  abiertaInicial?: boolean
  children: ReactNode
}

export default function SeccionPlegable({
  id, titulo, resumen, resumenAbierta, abiertaInicial = false, children,
}: Props): ReactElement {
  const [abierta, setAbierta] = useState(abiertaInicial)
  const badge = abierta ? (resumenAbierta ?? resumen) : resumen

  return (
    <section className="sp-card sp-doc-card sp-section">
      <h2 className="sp-section__title">
        <button
          type="button"
          id={`${id}-cabecera`}
          aria-expanded={abierta}
          aria-controls={`${id}-cuerpo`}
          onClick={() => setAbierta(v => !v)}
          className="sp-doc-cardhead sp-section__head"
        >
          <span className="sp-label">{titulo}</span>
          {badge !== undefined && <span className="sp-badge">{badge}</span>}
          <ChevronDown aria-hidden="true" className="sp-section__chev" />
        </button>
      </h2>

      {abierta && (
        <div
          id={`${id}-cuerpo`}
          role="region"
          aria-labelledby={`${id}-cabecera`}
          className="sp-doc-cardbody"
        >
          {children}
        </div>
      )}
    </section>
  )
}
