'use client'

import { useRef } from 'react'
import { VIAS } from '@/data/medicamentos'
import { VIAS_OTRAS, VIAS_RAPIDAS } from '@/components/documentos/recetaCompacta'

interface Props {
  /** Id del grupo (`receta-via-<clave>`): el foco va a su botón con tabindex 0. */
  id: string
  valor: string
  onCambio: (via: string) => void
  invalido: boolean
}

/**
 * Vía de administración de la receta compacta: cuatro botones rápidos (Oral,
 * IM, IV, Tópica) como grupo de radio y «Otra…» con las ocho restantes. Nace
 * VACÍA y es obligatoria. Los valores guardados son los de siempre
 * («Intramuscular», «Intravenosa»…); los rótulos cortos son sólo de pantalla.
 *
 * Teclado: el grupo es UNA parada de Tab (tabindex móvil); ←/→ mueven el foco
 * entre los botones sin elegir, y Espacio o Enter eligen. Elegir con la flecha
 * no sirve aquí: elegir lleva el foco a las indicaciones.
 */
export default function SelectorVia({ id, valor, onCambio, invalido }: Props) {
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const enRapidas = VIAS_RAPIDAS.some(r => r.via === valor)
  // Un valor fuera de las doce (una plantilla escrita a mano en otra versión)
  // se conserva como opción: no se pierde al abrir el medicamento.
  const extra = valor && !(VIAS as readonly string[]).includes(valor) ? valor : null
  const idError = `${id}-error`

  function alTeclear(e: React.KeyboardEvent<HTMLButtonElement>, k: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
    botones.current[(k + paso + VIAS_RAPIDAS.length) % VIAS_RAPIDAS.length]?.focus()
  }

  return (
    <div className={`sp-rx-viafila ${invalido ? 'sp-rx-viafila--falta' : ''}`}>
      <span className="sp-rx-rot" id={`${id}-rot`}>
        Vía <span aria-hidden="true">*</span><span className="sr-only">obligatoria</span>
      </span>
      <div id={id} role="radiogroup" aria-labelledby={`${id}-rot`} aria-required="true"
        aria-invalid={invalido || undefined} aria-describedby={invalido ? idError : undefined}
        className="sp-rx-viagrupo">
        {VIAS_RAPIDAS.map((r, k) => {
          const marcado = r.via === valor
          const enfocable = marcado || (!enRapidas && k === 0)
          return (
            <button key={r.via} ref={el => { botones.current[k] = el }} type="button" role="radio"
              aria-checked={marcado} tabIndex={enfocable ? 0 : -1} aria-label={r.via === r.corta ? undefined : r.via}
              onClick={() => onCambio(r.via)} onKeyDown={e => alTeclear(e, k)}
              className="sp-rx-viabtn">
              {r.corta}
            </button>
          )
        })}
      </div>
      <select aria-label="Otra vía de administración" value={enRapidas ? '' : valor}
        onChange={e => { if (e.target.value) onCambio(e.target.value) }}
        className={`sp-rx-viaotra ${!enRapidas && valor ? 'sp-rx-viaotra--on' : ''}`}>
        <option value="">Otra…</option>
        {extra && <option value={extra}>{extra}</option>}
        {VIAS_OTRAS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      {invalido && <span id={idError} className="sp-rx-err" role="alert">Falta la vía de administración</span>}
    </div>
  )
}
