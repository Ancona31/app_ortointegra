'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { leerFormato } from '@/lib/formatoPantalla'
import type { MedicamentoDB } from '@/data/medicamentos'
import { buscarEnCatalogo } from '@/components/documentos/recetaCompacta'

interface Props {
  id: string
  valor: string
  onEscribir: (texto: string) => void
  onElegir: (fila: MedicamentoDB) => void
  /** «No está en el catálogo»: se queda lo escrito y el foco va al genérico. */
  onLibre: () => void
  invalido: boolean
}

/**
 * Buscador del nombre comercial de la receta compacta. Busca en el catálogo
 * local (sin red: también sirve en el búnker) por comercial y por genérico,
 * sin acentos. ↓/↑ recorren (en círculo), Enter elige, Esc cierra; la última
 * fila deja lo escrito tal cual y salta al genérico.
 *
 * La lista va DENTRO del medicamento abierto (no en un portal): así tocarla no
 * cuenta como «salir» del medicamento y no lo pliega.
 *
 * Ctrl/⌘+Enter no se atiende aquí: sube al medicamento (alta continua).
 */
export default function BuscadorMedicamento({ id, valor, onEscribir, onElegir, onLibre, invalido }: Props) {
  const idLista = `${useId()}-lista`
  const [abierta, setAbierta] = useState(false)
  const [activo, setActivo] = useState(0)
  const resultados = abierta ? buscarEnCatalogo(valor) : []
  const visible = abierta && valor.trim().length >= 2
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
    setAbierta(false)
    const fila = resultados[k]
    if (fila) onElegir(fila)
    else onLibre()
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!visible || e.ctrlKey || e.metaKey) return
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
    <>
      <input id={id} type="text" role="combobox" autoComplete="off"
        aria-expanded={visible} aria-controls={visible ? idLista : undefined} aria-autocomplete="list"
        aria-activedescendant={visible ? `${idLista}-${activo}` : undefined}
        aria-invalid={invalido || undefined}
        value={valor}
        onChange={e => { onEscribir(e.target.value); setAbierta(true); setActivo(0) }}
        onKeyDown={alTeclear}
        onBlur={() => setAbierta(false)}
        placeholder="Busca por nombre comercial o genérico"
        className="sp-rx-fi" />
      {visible && (
        <ul ref={listaRef} id={idLista} role="listbox" aria-label="Medicamentos del catálogo" className="sp-rx-lista">
          {resultados.map((m, k) => (
            <li key={`${m.nombre_comercial}·${m.presentacion}·${m.principio_activo}`} id={`${idLista}-${k}`}
              role="option" aria-selected={k === activo} className="sp-rx-op"
              // onMouseDown y no onClick: el blur del campo llega antes que el clic.
              onMouseDown={e => { e.preventDefault(); elegir(k) }} onMouseEnter={() => setActivo(k)}>
              <b>{m.nombre_comercial}</b>
              <span>{m.presentacion} · {m.principio_activo} · {m.via ?? 'vía por elegir'}</span>
            </li>
          ))}
          <li id={`${idLista}-${resultados.length}`} role="option" aria-selected={activo === resultados.length}
            className="sp-rx-op sp-rx-op--libre"
            onMouseDown={e => { e.preventDefault(); elegir(resultados.length) }}
            onMouseEnter={() => setActivo(resultados.length)}>
            <span>No está en el catálogo: usar «{valor.trim()}» y escribir el genérico</span>
          </li>
        </ul>
      )}
    </>
  )
}
