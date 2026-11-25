'use client'

import { useId, useState } from 'react'
import { buscarSuplementos, moverActiva } from '@/components/documentos/suplementosCompacto'

export interface OpcionSuplemento {
  nombre: string
  /** La dosis que entraría con el peso de ahora (o la fija). */
  dosis: string
  beneficio: string
  /** Ya está en el plan: se ve atenuada y no se puede elegir. */
  ya: boolean
}

interface Props {
  id: string
  opciones: readonly OpcionSuplemento[]
  onElegir: (indice: number) => void
  invalido: boolean
}

/**
 * Buscador único del plan de suplementación: los nueve del catálogo, sin
 * acentos. Se abre al enfocarse (son pocos); ↓/↑ recorren en círculo saltando
 * los ya elegidos, Enter añade, Esc cierra. La lista va DENTRO del suplemento
 * abierto (no en un portal): tocarla no cuenta como «salir» y no lo pliega.
 * Ctrl/⌘+Enter no se atiende aquí: sube al suplemento (alta continua).
 */
export default function BuscadorSuplemento({ id, opciones, onElegir, invalido }: Props) {
  const idLista = `${useId()}-lista`
  const [texto, setTexto] = useState('')
  const [abierta, setAbierta] = useState(false)
  const [activa, setActiva] = useState(-1)
  const resultados = buscarSuplementos(texto, opciones.map(o => o.nombre))
  const elegible = (pos: number): boolean => !opciones[resultados[pos]]?.ya
  // La activa por omisión es la primera elegible de lo que se ve.
  const actual = activa >= 0 && activa < resultados.length && elegible(activa)
    ? activa : moverActiva(-1, 1, resultados.length, elegible)

  function elegir(pos: number) {
    const i = resultados[pos]
    if (i === undefined || opciones[i].ya) return
    setAbierta(false)
    onElegir(i)
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAbierta(true)
      setActiva(moverActiva(actual, e.key === 'ArrowDown' ? 1 : -1, resultados.length, elegible))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (abierta) elegir(actual)
      else setAbierta(true)
    } else if (e.key === 'Escape' && abierta) {
      e.preventDefault()
      e.stopPropagation()
      setAbierta(false)
    }
  }

  return (
    <>
      <input id={id} type="text" role="combobox" autoComplete="off"
        aria-expanded={abierta} aria-controls={abierta ? idLista : undefined} aria-autocomplete="list"
        aria-activedescendant={abierta && actual >= 0 ? `${idLista}-${actual}` : undefined}
        aria-invalid={invalido || undefined}
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierta(true); setActiva(-1) }}
        onFocus={() => setAbierta(true)}
        onClick={() => setAbierta(true)}
        onKeyDown={alTeclear}
        onBlur={() => setAbierta(false)}
        placeholder="Busca el suplemento"
        className="sp-rx-fi" />
      {abierta && (
        <ul id={idLista} role="listbox" aria-label="Suplementos del catálogo" className="sp-rx-lista sp-sup-lista">
          {resultados.map((i, pos) => {
            const o = opciones[i]
            return (
              <li key={o.nombre} id={`${idLista}-${pos}`} role="option"
                aria-selected={pos === actual} aria-disabled={o.ya || undefined}
                className={`sp-rx-op sp-sup-op${o.ya ? ' sp-sup-op--ya' : ''}`}
                // onMouseDown y no onClick: el blur del campo llega antes que el clic.
                onMouseDown={e => { e.preventDefault(); elegir(pos) }}
                onMouseEnter={() => { if (!o.ya) setActiva(pos) }}>
                <b>{o.nombre}</b>
                <span>{o.ya ? 'ya está en el plan' : o.dosis}</span>
                <small>{o.beneficio}</small>
              </li>
            )
          })}
          {resultados.length === 0 && (
            <li role="option" aria-selected={false} aria-disabled className="sp-rx-op sp-sup-op sp-sup-op--ya">
              <span>Sin coincidencias</span>
            </li>
          )}
        </ul>
      )}
    </>
  )
}
