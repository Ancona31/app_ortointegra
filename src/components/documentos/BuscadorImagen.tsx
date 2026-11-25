'use client'

import { useId, useState } from 'react'
import { buscarImagen, type ResultadoImagen } from '@/components/documentos/imagenCompuesta'

interface Props {
  id: string
  onElegir: (r: ResultadoImagen) => void
}

/**
 * Buscador único «tipo + región» del estudio abierto («rm rod», «rx col lum»).
 * Busca en el catálogo local (sin red: también sirve en el búnker), sin
 * acentos. ↓/↑ recorren (en círculo), Enter elige, Esc cierra. Elegir llena
 * tipo y región; lo escrito aquí no se guarda: se vacía al elegir.
 *
 * La lista va DENTRO del estudio abierto (no en un portal): así tocarla no
 * cuenta como «salir» y no lo pliega. Ctrl/⌘+Enter sube al estudio.
 */
export default function BuscadorImagen({ id, onElegir }: Props) {
  const idLista = `${useId()}-lista`
  const [texto, setTexto] = useState('')
  const [abierta, setAbierta] = useState(false)
  const [activo, setActivo] = useState(0)
  const resultados = abierta ? buscarImagen(texto) : []
  const visible = abierta && texto.trim().length >= 2

  function elegir(k: number) {
    const r = resultados[k]
    if (!r) return
    setAbierta(false)
    setTexto('')
    onElegir(r)
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!visible || e.ctrlKey || e.metaKey) return
    const n = Math.max(resultados.length, 1)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo(a => (a + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      elegir(activo)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setAbierta(false)
    }
  }

  return (
    <>
      <input id={id} type="text" role="combobox" autoComplete="off" value={texto}
        aria-expanded={visible} aria-controls={visible ? idLista : undefined} aria-autocomplete="list"
        aria-activedescendant={visible && resultados.length > 0 ? `${idLista}-${activo}` : undefined}
        onChange={e => { setTexto(e.target.value); setAbierta(true); setActivo(0) }}
        onKeyDown={alTeclear} onBlur={() => setAbierta(false)}
        placeholder="Tipo y región: «rm rodilla», «rx columna lumbar»…" className="sp-rx-fi" />
      {visible && (
        <ul id={idLista} role="listbox" aria-label="Estudios del catálogo" className="sp-rx-lista">
          {resultados.map((r, k) => (
            <li key={`${r.modalidad}·${r.grupo}·${r.region}`} id={`${idLista}-${k}`} role="option"
              aria-selected={k === activo} className="sp-rx-op"
              // onMouseDown y no onClick: el blur del campo llega antes que el clic.
              onMouseDown={e => { e.preventDefault(); elegir(k) }} onMouseEnter={() => setActivo(k)}>
              <b>{r.corto} · {r.region}</b>
              <span>{r.nombreModalidad} · {r.nombreGrupo}</span>
            </li>
          ))}
          {resultados.length === 0 && (
            <li role="option" aria-selected="false" aria-disabled="true" className="sp-rx-op">
              <span>Sin coincidencias. Elige «Otro» para escribirlo a mano.</span>
            </li>
          )}
        </ul>
      )}
    </>
  )
}
