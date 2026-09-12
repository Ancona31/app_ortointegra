'use client'

/**
 * Barra + área de escritura del Escrito médico — GUIA_FORM_ESCRITO_MEDICO §3.
 *
 * Archivo aparte del formulario porque el reparto de la barra es la mitad del
 * trabajo de este formato y mezclarlo con la persistencia dejaba un solo
 * archivo de 700 líneas. NO es una abstracción reutilizable: el escrito es el
 * único de los ocho con cuerpo de texto enriquecido.
 *
 * Dos reglas gobiernan todo lo de aquí:
 *
 * 1. **Primero juntar, luego repartir.** Las cuatro alineaciones eligen UN
 *    valor de uno: son un botón que muestra la actual y abre las cuatro. Trece
 *    controles pasan a diez, y sin eso ningún reparto cabe en una fila a 332 px
 *    de barra útil.
 * 2. **Caben las que caben en una fila de 44 px; el resto va al menú, en el
 *    mismo orden.** El reparto lo decide el CONTENEDOR y lo aplica el CSS
 *    (`.sp-ed-n2/n3` en la barra, `.sp-ed-m2/m3` en el menú): cada control
 *    aparece dos veces en el árbol y la consulta de contenedor apaga una. Sin
 *    medir con JS, que es lo que el sistema evita en todas las demás rejillas.
 *    `CONTROLES` es la única lista, así que barra y menú no pueden divergir.
 */

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, Bold, Check,
  ChevronDown, ChevronRight, Heading2, Heading3, Italic, List, ListOrdered,
  Minus, MoreHorizontal, Pilcrow, Quote, RemoveFormatting, Underline,
} from 'lucide-react'

type Glifo = ComponentType<{ size?: number }>

/**
 * Dos niveles de encabezado y no tres: en un documento de una o dos páginas un
 * tercero no jerarquiza nada.
 */
const BLOQUES = [
  { valor: 'p',  nombre: 'Normal',    Icono: Pilcrow  as Glifo },
  { valor: 'h2', nombre: 'Título',    Icono: Heading2 as Glifo },
  { valor: 'h3', nombre: 'Subtítulo', Icono: Heading3 as Glifo },
] as const

const ALINEACIONES = [
  { valor: 'left',    nombre: 'Izquierda',   Icono: AlignLeft    as Glifo },
  { valor: 'center',  nombre: 'Centro',      Icono: AlignCenter  as Glifo },
  { valor: 'right',   nombre: 'Derecha',     Icono: AlignRight   as Glifo },
  { valor: 'justify', nombre: 'Justificado', Icono: AlignJustify as Glifo },
] as const

interface Control {
  clave: string
  nombre: string
  Icono: Glifo
  /** Nivel a partir del cual el control entra en la barra; por debajo, al menú. */
  nivel: 1 | 2 | 3
  /** Solo los conmutadores lo traen. Su ausencia distingue acción de estado. */
  activo?: boolean
  accion: () => void
}

/** `null` cerrado · `align-mas` es la alineación abierta DESDE el menú. */
type Menu = null | 'bloque' | 'mas' | 'align' | 'align-mas'

interface Props {
  editor: Editor | null
}

export default function EditorEscrito({ editor }: Props) {
  const [menu, setMenu] = useState<Menu>(null)
  const barraRef = useRef<HTMLDivElement>(null)

  // Cierra al pulsar fuera y con Escape. El `mousedown` de los propios botones
  // burbujea hasta aquí, pero `contains` lo reconoce como dentro.
  //
  // Y al cambiar de tamaño: girar el iPad cambia de nivel, y con él qué botones
  // existen. Un menú abierto por un botón que acaba de desaparecer se quedaría
  // colgando sin ancla — pasa sobre todo con el de «más», que en nivel 3 no se
  // renderiza.
  useEffect(() => {
    if (!menu) return
    function fuera(e: MouseEvent) {
      if (!barraRef.current?.contains(e.target as Node)) setMenu(null)
    }
    function tecla(e: KeyboardEvent) { if (e.key === 'Escape') setMenu(null) }
    function cerrar() { setMenu(null) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('resize', cerrar)
    }
  }, [menu])

  /**
   * `h1` ya no se ofrece, pero puede llegar pegado de fuera: se muestra como
   * «Título» para que quien lo reciba pueda convertirlo, en vez de dejarlo como
   * un bloque que la barra no sabe nombrar.
   */
  const bloqueActual =
    editor?.isActive('heading', { level: 3 }) ? 'h3'
    : editor?.isActive('heading', { level: 2 }) || editor?.isActive('heading', { level: 1 }) ? 'h2'
    : 'p'
  const bloque = BLOQUES.find(b => b.valor === bloqueActual) ?? BLOQUES[0]
  const GlifoBloque = bloque.Icono

  const alineacion = ALINEACIONES.find(a => editor?.isActive({ textAlign: a.valor })) ?? ALINEACIONES[0]

  function aplicarBloque(valor: string): void {
    const cadena = editor?.chain().focus()
    if (!cadena) return
    if (valor === 'h2')      cadena.setHeading({ level: 2 }).run()
    else if (valor === 'h3') cadena.setHeading({ level: 3 }).run()
    else                     cadena.setParagraph().run()
  }

  const CONTROLES: Control[] = [
    { clave: 'bold',      nombre: 'Negrita',        Icono: Bold             as Glifo, nivel: 1, activo: !!editor?.isActive('bold'),        accion: () => editor?.chain().focus().toggleBold().run() },
    { clave: 'italic',    nombre: 'Cursiva',        Icono: Italic           as Glifo, nivel: 1, activo: !!editor?.isActive('italic'),      accion: () => editor?.chain().focus().toggleItalic().run() },
    { clave: 'ul',        nombre: 'Viñetas',        Icono: List             as Glifo, nivel: 1, activo: !!editor?.isActive('bulletList'),  accion: () => editor?.chain().focus().toggleBulletList().run() },
    { clave: 'ol',        nombre: 'Numerada',       Icono: ListOrdered      as Glifo, nivel: 1, activo: !!editor?.isActive('orderedList'), accion: () => editor?.chain().focus().toggleOrderedList().run() },
    { clave: 'underline', nombre: 'Subrayado',      Icono: Underline        as Glifo, nivel: 2, activo: !!editor?.isActive('underline'),   accion: () => editor?.chain().focus().toggleUnderline().run() },
    // La alineación no ejecuta: abre su hoja. Lo gobierna `pulsar`, que necesita
    // saber desde dónde se pulsó para saber si hay vuelta atrás.
    { clave: 'align',     nombre: 'Alineación',     Icono: alineacion.Icono,          nivel: 2,                                            accion: () => {} },
    { clave: 'quote',     nombre: 'Cita',           Icono: Quote            as Glifo, nivel: 3, activo: !!editor?.isActive('blockquote'),  accion: () => editor?.chain().focus().toggleBlockquote().run() },
    { clave: 'hr',        nombre: 'Separador',      Icono: Minus            as Glifo, nivel: 3,                                            accion: () => editor?.chain().focus().setHorizontalRule().run() },
    { clave: 'clear',     nombre: 'Quitar formato', Icono: RemoveFormatting as Glifo, nivel: 3,                                            accion: () => editor?.chain().focus().clearNodes().unsetAllMarks().run() },
  ]

  function pulsar(c: Control, desdeMenu: boolean): void {
    if (c.clave === 'align') {
      setMenu(desdeMenu ? 'align-mas' : menu === 'align' ? null : 'align')
      return
    }
    c.accion()
    setMenu(null)
  }

  // `preventDefault` en mousedown: sin esto el botón se lleva el foco y la
  // selección del editor se pierde antes de que el comando se ejecute. El click
  // sigue disparando, así que el teclado no pierde nada.
  const sinRobarFoco = (e: React.MouseEvent) => e.preventDefault()

  return (
    <>
      {/* `group` y no `toolbar`: el rol de barra promete navegación con flechas
          y aquí cada control es un objetivo de tabulación normal. */}
      <div ref={barraRef} className="sp-ed-bar" role="group" aria-label="Formato del escrito">

        <button type="button" className="sp-ed-btn sp-ed-block"
          aria-haspopup="menu" aria-expanded={menu === 'bloque'} aria-label={`Bloque: ${bloque.nombre}`}
          onMouseDown={sinRobarFoco} onClick={() => setMenu(m => (m === 'bloque' ? null : 'bloque'))}>
          <GlifoBloque /><ChevronDown />
        </button>

        {/* Nativo a propósito: en el iPad abre la rueda del sistema. */}
        <select className="sp-input sp-ed-select" aria-label="Bloque"
          value={bloqueActual} onChange={e => aplicarBloque(e.target.value)}>
          {BLOQUES.map(b => <option key={b.valor} value={b.valor}>{b.nombre}</option>)}
        </select>

        {CONTROLES.map(c => (
          <button key={c.clave} type="button"
            className={`sp-ed-btn${c.nivel === 1 ? '' : c.nivel === 2 ? ' sp-ed-n2' : ' sp-ed-n3'}`}
            title={c.nombre}
            aria-label={c.clave === 'align' ? `Alineación: ${alineacion.nombre}` : c.nombre}
            aria-pressed={c.activo}
            aria-haspopup={c.clave === 'align' ? 'menu' : undefined}
            aria-expanded={c.clave === 'align' ? menu === 'align' : undefined}
            onMouseDown={sinRobarFoco} onClick={() => pulsar(c, false)}>
            <c.Icono />
          </button>
        ))}

        <button type="button" className="sp-ed-btn sp-ed-more"
          aria-haspopup="menu" aria-expanded={menu === 'mas'} aria-label="Más opciones de formato"
          onMouseDown={sinRobarFoco} onClick={() => setMenu(m => (m === 'mas' ? null : 'mas'))}>
          <MoreHorizontal />
        </button>

        {menu === 'bloque' && (
          <div className="sp-ed-menu sp-ed-menu--left" role="menu">
            {BLOQUES.map(b => (
              <button key={b.valor} type="button" className="sp-ed-row" role="menuitemradio"
                aria-checked={b.valor === bloqueActual}
                onMouseDown={sinRobarFoco}
                onClick={() => { aplicarBloque(b.valor); setMenu(null) }}>
                <b.Icono />{b.nombre}
                {b.valor === bloqueActual && <span className="sp-ed-row__cue"><Check /></span>}
              </button>
            ))}
          </div>
        )}

        {menu === 'mas' && (
          <div className="sp-ed-menu" role="menu">
            {/* Mismo orden que la barra, y con el nombre escrito: en un menú no
                hay que adivinar qué hace un glifo de 20 px. */}
            {CONTROLES.filter(c => c.nivel > 1).map(c => (
              <button key={c.clave} type="button"
                className={`sp-ed-row${c.nivel === 2 ? ' sp-ed-m2' : ' sp-ed-m3'}`}
                // Conmutador o acción: `aria-checked` solo lo admite el primero,
                // y `activo` es justo lo que distingue a los dos.
                role={c.activo === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={c.activo}
                aria-haspopup={c.clave === 'align' ? 'menu' : undefined}
                // Siempre colapsada: al abrir la hoja de alineación, esta se va.
                aria-expanded={c.clave === 'align' ? false : undefined}
                onMouseDown={sinRobarFoco} onClick={() => pulsar(c, true)}>
                <c.Icono />{c.nombre}
                {c.clave === 'align' && <span className="sp-ed-row__cue"><ChevronRight /></span>}
              </button>
            ))}
          </div>
        )}

        {(menu === 'align' || menu === 'align-mas') && (
          <div className="sp-ed-menu" role="menu">
            {menu === 'align-mas' && (
              <div className="sp-ed-menuhead">
                <button type="button" className="sp-ed-btn" aria-label="Volver"
                  onMouseDown={sinRobarFoco} onClick={() => setMenu('mas')}>
                  <ArrowLeft />
                </button>
                <span className="sp-label">Alineación</span>
              </div>
            )}
            {ALINEACIONES.map(a => (
              <button key={a.valor} type="button" className="sp-ed-row" role="menuitemradio"
                aria-checked={a.valor === alineacion.valor}
                onMouseDown={sinRobarFoco}
                onClick={() => { editor?.chain().focus().setTextAlign(a.valor).run(); setMenu(null) }}>
                <a.Icono />{a.nombre}
                {a.valor === alineacion.valor && <span className="sp-ed-row__cue"><Check /></span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* El scroll es el del formulario: el área crece y no abre uno propio. */}
      <EditorContent editor={editor} />
    </>
  )
}
