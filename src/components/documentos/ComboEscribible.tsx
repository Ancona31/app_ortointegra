'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Portal from '@/components/ui/Portal'

/**
 * Desplegable escribible — patrón de referencia del sistema.
 * `GUIA_FORM_IMAGENOLOGIA.md` §2.2, referenciado por `GUIA_FORMULARIOS_01` §3.3.
 *
 * Sugerencias en el menú, texto libre encima, y el pie del menú diciéndolo con
 * palabras. Lo que cambia entre formularios es la caja y la lista; el gesto es
 * el mismo en los ocho.
 *
 * Sustituye a `AutocompleteEstudio` (menú `absolute` dentro del flujo, sin tope
 * de filas) y al `<datalist>` de imagenología, que no filtra igual en Safari iOS
 * y no se lee como campo con opciones (L-03 · I-04).
 */

/** 8 filas caben en la lista, 4 se ven; el resto se desplaza. */
const MAX_SUGERENCIAS = 8
/** Alto reservado bajo el input para decidir si el menú abre hacia abajo. */
const ALTO_MENU = 200

interface Props {
  id: string
  value: string
  onChange: (valor: string) => void
  sugerencias: readonly string[]
  placeholder: string
  /** Caracteres antes de sugerir. 0 = mostrar la lista al enfocar. */
  minCaracteres?: number
  /** Pie del menú. Nombra qué se escribe cuando ninguna sugerencia encaja. */
  pie: string
  invalido?: boolean
  /** Clase extra sobre el input (señalado de campo faltante). */
  claseExtra?: string
}

type Caja = { left: number; top: number; width: number; abajo: boolean }

export default function ComboEscribible({
  id, value, onChange, sugerencias, placeholder,
  minCaracteres = 0, pie, invalido = false, claseExtra = '',
}: Props) {
  const idMenu = `${useId()}-menu`
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const [caja, setCaja] = useState<Caja | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const texto = value.trim()
  const filtradas = texto.length >= minCaracteres
    ? sugerencias.filter(s => s.toLowerCase().includes(texto.toLowerCase())).slice(0, MAX_SUGERENCIAS)
    : []
  const visible = abierto && filtradas.length > 0

  // Al cambiar lo escrito, la fila activa vuelve a la primera. Ajuste durante
  // el render y no useEffect: el efecto deja pintar un fotograma con la fila
  // activa vieja resaltada sobre una lista ya filtrada.
  const [valorPrevio, setValorPrevio] = useState(value)
  if (valorPrevio !== value) {
    setValorPrevio(value)
    setActivo(0)
  }

  // Posición desde el rectángulo real del input. Abre hacia arriba si no caben
  // 200px por debajo — en un iPad en horizontal el último estudio de la lista
  // está siempre a menos de eso del borde inferior.
  // No se limpia `caja` al ocultar: solo se lee con `visible` en cierto, y al
  // volver a abrir este mismo efecto la recalcula antes de pintar.
  useLayoutEffect(() => {
    if (!visible) return
    function medir() {
      const el = inputRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const abajo = window.innerHeight - r.bottom >= ALTO_MENU
      setCaja({
        left: r.left,
        top: abajo ? r.bottom + 4 : r.top - 4,
        width: r.width,
        abajo,
      })
    }
    medir()
    // capture: el scroller es <main>, no la ventana — sin captura el evento no
    // llega nunca y el menú se queda flotando donde estaba.
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return
    function alPulsarFuera(e: MouseEvent) {
      const t = e.target as Node
      if (inputRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', alPulsarFuera)
    return () => document.removeEventListener('mousedown', alPulsarFuera)
  }, [visible])

  function elegir(valor: string) {
    onChange(valor)
    setAbierto(false)
    // SIN reenfocar el input: el `preventDefault` del mousedown impide que el
    // foco llegue a salir, y por teclado nunca sale. Llamar a focus() aquí
    // dispara onFocus, que vuelve a abrir el menú en el mismo lote de estado —
    // y como la sugerencia elegida se filtra a sí misma, el menú se quedaba
    // abierto justo encima de lo que se acababa de elegir.
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setAbierto(false); return }
    if (!visible) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(i => Math.min(i + 1, filtradas.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(filtradas[activo]) }
  }

  return (
    <div className="sp-doc-combo">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={visible}
        // Solo con el menú montado: apuntar a un id inexistente es un error de
        // accesibilidad, no un apuntador inerte.
        aria-controls={visible ? idMenu : undefined}
        aria-autocomplete="list"
        aria-invalid={invalido || undefined}
        value={value}
        onChange={e => { onChange(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        // Reapertura tras Escape: el foco ya está dentro, así que onFocus no
        // vuelve a dispararse y sin esto el chevron no llevaría a ningún sitio.
        onClick={() => setAbierto(true)}
        onKeyDown={alTeclear}
        placeholder={placeholder}
        className={`sp-input ${claseExtra}`}
      />
      <ChevronDown aria-hidden="true" />

      {visible && caja && (
        <Portal>
          <div
            ref={menuRef}
            id={idMenu}
            role="listbox"
            className="sp-doc-menu"
            style={{
              left: caja.left,
              width: Math.max(caja.width, 260),
              ...(caja.abajo ? { top: caja.top } : { bottom: window.innerHeight - caja.top }),
            }}
          >
            <ul className="sp-doc-menu__list">
              {filtradas.map((s, i) => (
                <li
                  key={s}
                  role="option"
                  aria-selected={i === activo}
                  // La fila recorta con elipsis para no romper los 44px; el
                  // nombre entero se recupera aquí.
                  title={s}
                  // onMouseDown y no onClick: el blur del input llega antes que
                  // el click y cerraría el menú bajo el dedo.
                  onMouseDown={e => { e.preventDefault(); elegir(s) }}
                  onMouseEnter={() => setActivo(i)}
                  className="sp-doc-menu__item"
                >
                  {s}
                </li>
              ))}
            </ul>
            <p className="sp-doc-menu__foot">{pie}</p>
          </div>
        </Portal>
      )}
    </div>
  )
}
