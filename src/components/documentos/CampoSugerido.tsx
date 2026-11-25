'use client'

/**
 * Campo de texto libre con sugerencias, para las líneas compactas de honorarios
 * (origen del cobro) y la aseguradora (maqueta `honorarios.html`, aprobada).
 *
 * Es el gesto de `ComboEscribible` —sugerencias al enfocar, escribir filtra,
 * ↓/↑ y Enter eligen, el texto libre vale tal cual y el pie lo dice— con dos
 * diferencias que la línea necesita y que por eso no se meten en aquél, que
 * usan otros formularios: la lista va `absolute` bajo el campo (no en un
 * portal: sigue a la línea al desplazar y nada queda `fixed`), y Enter, elija o
 * no, llama a `onSiguiente` para que el formulario lleve el foco al precio (o a
 * la póliza). Lista propia con `role="listbox"`: no es `<datalist>`, que no
 * filtra igual en Safari iOS.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { leerFormato } from '@/lib/formatoPantalla'
import { filtrarSugerencias } from '@/components/documentos/honorariosLineas'

interface Props {
  id: string
  value: string
  onChange: (valor: string) => void
  sugerencias: readonly string[]
  placeholder: string
  etiqueta: string
  /** Pie de la lista: qué pasa cuando ninguna sugerencia encaja. */
  pie: string
  onSiguiente?: () => void
  className?: string
}

export default function CampoSugerido(p: Props): ReactElement {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(-1)
  const filtradas = filtrarSugerencias(p.sugerencias, p.value)
  const visible = abierto && filtradas.length > 0
  const idLista = `${p.id}-lista`
  const listaRef = useRef<HTMLDivElement>(null)
  // Cerca del pie, la lista cae bajo él (en `ih`/`esc` el pie va encima del
  // formulario, `.sp-doc-formbody--pie-encima`): al abrirse se trae entera,
  // como `MenuRequerimientos`. `tel`/`ext`/`iv`, como estaban.
  useEffect(() => {
    const f = leerFormato()
    if (visible && (f === 'ih' || f === 'esc')) listaRef.current?.scrollIntoView({ block: 'nearest' })
  }, [visible])

  function elegir(valor: string): void {
    p.onChange(valor)
    setAbierto(false)
    setActivo(-1)
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape' && visible) { e.preventDefault(); e.stopPropagation(); setAbierto(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!visible) { setAbierto(true); setActivo(0); return }
      const n = filtradas.length
      setActivo(a => (e.key === 'ArrowDown' ? (a + 1) % n : (a <= 0 ? n - 1 : a - 1)))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (visible && activo >= 0 && filtradas[activo]) elegir(filtradas[activo])
      else setAbierto(false)
      p.onSiguiente?.()
    } else if (e.key === 'Tab') {
      setAbierto(false)
    }
  }

  return (
    <div className="sp-hon-sug">
      <input id={p.id} type="text" role="combobox" autoComplete="off"
        aria-expanded={visible} aria-controls={visible ? idLista : undefined} aria-autocomplete="list"
        aria-activedescendant={visible && activo >= 0 ? `${idLista}-${activo}` : undefined}
        aria-label={p.etiqueta} value={p.value} placeholder={p.placeholder}
        onChange={e => { p.onChange(e.target.value); setAbierto(true); setActivo(-1) }}
        onFocus={() => setAbierto(true)} onClick={() => setAbierto(true)}
        onBlur={() => setAbierto(false)} onKeyDown={tecla}
        className={p.className} />
      {visible && (
        <div ref={listaRef} id={idLista} role="listbox" aria-label={p.etiqueta} className="sp-hon-lista">
          {filtradas.map((s, i) => (
            <div key={s} id={`${idLista}-${i}`} role="option" aria-selected={i === activo} className="sp-hon-op"
              // onMouseDown y no onClick: el blur del campo llega antes que el
              // click y cerraría la lista bajo el dedo.
              onMouseDown={e => { e.preventDefault(); elegir(s); p.onSiguiente?.() }}
              onMouseEnter={() => setActivo(i)}>
              {s}
            </div>
          ))}
          <p className="sp-hon-pie">{p.pie}</p>
        </div>
      )}
    </div>
  )
}
