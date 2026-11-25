'use client'

import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { leerFormato } from '@/lib/formatoPantalla'
import { Search } from 'lucide-react'
import { buscarEstudios } from '@/components/documentos/estudiosPedidos'

interface Props {
  id: string
  pedidos: readonly string[]
  onAnadir: (estudio: string) => void
  /** Retroceso con el buscador vacío: quita el último pedido. */
  onQuitarUltimo: () => void
  invalido: boolean
  ref?: Ref<HTMLInputElement>
}

/**
 * El buscador ÚNICO de la solicitud de laboratorio. Busca en el catálogo local
 * (sin red: también sirve en el búnker) desde 2 letras, sin acentos y sin
 * ofrecer lo ya pedido. ↓/↑ recorren en círculo, Enter añade y deja el campo
 * vacío y con el foco para el siguiente, Esc cierra. La última opción añade lo
 * escrito tal cual. Retroceso con el campo vacío quita el último pedido.
 *
 * La lista va en la misma tarjeta (no en un portal), con `onMouseDown` y
 * `preventDefault`: el blur del campo llega antes que un clic.
 */
export default function BuscadorEstudio({ id, pedidos, onAnadir, onQuitarUltimo, invalido, ref }: Props) {
  const idLista = `${useId()}-lista`
  const [texto, setTexto] = useState('')
  const [abierta, setAbierta] = useState(false)
  const [activo, setActivo] = useState(0)
  const visible = abierta && texto.trim().length >= 2
  const resultados = visible ? buscarEstudios(texto, pedidos) : []
  const total = resultados.length + 1
  const listaRef = useRef<HTMLUListElement>(null)
  // Cerca del pie, la lista cae bajo él (en `ih`/`esc` el pie va encima del
  // formulario, `.sp-doc-formbody--pie-encima`): al abrirse se trae entera,
  // como `MenuRequerimientos`. `tel`/`ext`/`iv`, como estaban.
  useEffect(() => {
    const f = leerFormato()
    if (visible && (f === 'ih' || f === 'esc')) listaRef.current?.scrollIntoView({ block: 'nearest' })
  }, [visible])

  function elegir(k: number) {
    onAnadir(resultados[k] ?? texto.trim())
    setTexto('')
    setAbierta(false)
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && texto === '' && pedidos.length > 0) { onQuitarUltimo(); return }
    if (!visible) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo(a => (a + (e.key === 'ArrowDown' ? 1 : total - 1)) % total)
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
    <div className={`sp-lab-bus ${invalido ? 'sp-lab-bus--falta' : ''}`}>
      <Search aria-hidden="true" />
      <input ref={ref} id={id} type="text" role="combobox" autoComplete="off" enterKeyHint="enter"
        aria-label="Buscar estudio" aria-expanded={visible} aria-autocomplete="list"
        aria-controls={visible ? idLista : undefined}
        aria-activedescendant={visible ? `${idLista}-${activo}` : undefined}
        aria-invalid={invalido || undefined}
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierta(true); setActivo(0) }}
        onKeyDown={alTeclear}
        onBlur={() => setAbierta(false)}
        placeholder="Busca un estudio o escribe uno y pulsa Enter"
        className="sp-rx-fi" />
      {visible && (
        <ul ref={listaRef} id={idLista} role="listbox" aria-label="Estudios del catálogo" className="sp-rx-lista">
          {resultados.map((r, k) => (
            <li key={r} id={`${idLista}-${k}`} role="option" aria-selected={k === activo} className="sp-rx-op"
              onMouseDown={e => { e.preventDefault(); elegir(k) }} onMouseEnter={() => setActivo(k)}>
              <b>{r}</b>
            </li>
          ))}
          <li id={`${idLista}-${resultados.length}`} role="option" aria-selected={activo === resultados.length}
            className="sp-rx-op"
            onMouseDown={e => { e.preventDefault(); elegir(resultados.length) }}
            onMouseEnter={() => setActivo(resultados.length)}>
            <span>Añadir «{texto.trim()}» tal cual</span>
          </li>
        </ul>
      )}
    </div>
  )
}
