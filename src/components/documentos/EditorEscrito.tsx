'use client'

/**
 * Barra + área de escritura del Escrito médico (maqueta `escrito.html`, aprobada).
 *
 * Archivo aparte del formulario porque el reparto de la barra es la mitad del
 * trabajo de este formato. NO es una abstracción reutilizable: el escrito es el
 * único de los ocho con cuerpo de texto enriquecido.
 *
 * Reglas que gobiernan todo lo de aquí:
 *
 * 1. **Todo lo que el editor YA sabe hacer, a la vista** (decisión del dueño):
 *    Deshacer · Rehacer | Texto / Título / Subtítulo | Negrita · Cursiva ·
 *    Subrayado | Viñetas · Numerada · Aumentar · Reducir sangría | Alineación ·
 *    Cita · Separador · Quitar formato | «?» Atajos. Sin tachado ni código: el
 *    PDF los descarta a propósito.
 * 2. **El reparto lo decide el CONTENEDOR y lo aplica el CSS**, sin medir con JS:
 *    ancho, una fila; medio, dos renglones; estrecho (`tel`/`ext`), lo marcado
 *    `estrecho` baja al «⋯» con su nombre escrito. Cada uno de esos controles está
 *    dos veces en el árbol (barra y menú) y la consulta de contenedor apaga uno
 *    (`.sp-esc-ocu` / `.sp-esc-solo-estrecho`). `CONTROLES` es la única lista.
 * 3. **`preventDefault` en `mousedown`**: sin eso el botón se lleva el foco y la
 *    selección del editor se pierde antes del comando. El clic sigue llegando.
 * 4. **El desplazamiento es del CUERPO** (`.sp-esc-cuerpo`), no de la página: la
 *    barra y el título quedan siempre a la vista. Lo da la hoja del formulario.
 */

import { useEffect, useRef, useState, type ComponentType, type MouseEvent as ReactMouseEvent } from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, Bold, Check, ChevronRight, CircleHelp,
  IndentDecrease, IndentIncrease, Italic, List, ListOrdered, Minus, MoreHorizontal, Quote, Redo2,
  RemoveFormatting, Underline, Undo2,
} from 'lucide-react'

type Glifo = ComponentType<{ size?: number }>

/** Dos niveles de encabezado: en un documento de una o dos páginas un tercero no jerarquiza nada. */
const BLOQUES = [
  { valor: 'p', nombre: 'Texto', titulo: 'Texto normal (Ctrl+Alt+0)' },
  { valor: 'h2', nombre: 'Título', titulo: 'Título (Ctrl+Alt+2)' },
  { valor: 'h3', nombre: 'Subtítulo', titulo: 'Subtítulo (Ctrl+Alt+3)' },
] as const

const ALINEACIONES = [
  { valor: 'left', nombre: 'Izquierda', Icono: AlignLeft as Glifo, atajo: 'Ctrl+Mayús+L' },
  { valor: 'center', nombre: 'Centrado', Icono: AlignCenter as Glifo, atajo: 'Ctrl+Mayús+E' },
  { valor: 'right', nombre: 'Derecha', Icono: AlignRight as Glifo, atajo: 'Ctrl+Mayús+R' },
  { valor: 'justify', nombre: 'Justificado', Icono: AlignJustify as Glifo, atajo: 'Ctrl+Mayús+J' },
] as const

/**
 * Los atajos de escritura que YA funcionan (comprobados contra las reglas de
 * entrada de StarterKit y en el navegador): no se lista ninguno que no exista.
 */
const ATAJOS: readonly [string, string][] = [
  ['## + espacio', 'Título'],
  ['### + espacio', 'Subtítulo'],
  ['- + espacio', 'Viñeta'],
  ['1. + espacio', 'Lista numerada'],
  ['> + espacio', 'Cita'],
  ['---', 'Separador'],
  ['**texto**', 'Negrita'],
  ['*texto*', 'Cursiva'],
  ['Tab / Mayús+Tab', 'Sangría en listas'],
  ['Mayús+Enter', 'Salto de línea'],
  ['Ctrl+Mayús+V', 'Pegar sin formato'],
]

interface Control {
  clave: string
  nombre: string
  /** Lo que dice el `title`: el nombre y su atajo. */
  titulo: string
  Icono: Glifo
  /** Sólo los conmutadores lo traen. Su ausencia distingue acción de estado. */
  activo?: boolean
  deshabilitado?: boolean
  /** En el contenedor estrecho baja al «⋯». */
  estrecho?: boolean
  /** Filete antes del control: separa los grupos. */
  grupo?: boolean
  accion: () => void
}

/** `null` cerrado · `align-mas` es la alineación abierta DESDE el menú «⋯». */
type Menu = null | 'mas' | 'align' | 'align-mas' | 'ayuda'

interface Props {
  editor: Editor | null
}

export default function EditorEscrito({ editor }: Props) {
  const [menu, setMenu] = useState<Menu>(null)
  const barraRef = useRef<HTMLDivElement>(null)

  // Cierra al pulsar fuera, con Escape y al cambiar de tamaño (girar el iPad
  // cambia qué controles existen y un menú se quedaría sin ancla).
  useEffect(() => {
    if (!menu) return
    function fuera(e: MouseEvent) {
      if (e.target instanceof Node && !barraRef.current?.contains(e.target)) setMenu(null)
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

  /** `h1` no se ofrece, pero puede llegar pegado: se muestra como «Título». */
  const bloqueActual =
    editor?.isActive('heading', { level: 3 }) ? 'h3'
    : editor?.isActive('heading', { level: 2 }) || editor?.isActive('heading', { level: 1 }) ? 'h2'
    : 'p'
  const alineacion = ALINEACIONES.find(a => editor?.isActive({ textAlign: a.valor })) ?? ALINEACIONES[0]

  function aplicarBloque(valor: string): void {
    const cadena = editor?.chain().focus()
    if (!cadena) return
    if (valor === 'h2') cadena.setHeading({ level: 2 }).run()
    else if (valor === 'h3') cadena.setHeading({ level: 3 }).run()
    else cadena.setParagraph().run()
  }

  const c = () => editor?.chain().focus()
  const CONTROLES: Control[] = [
    { clave: 'undo', nombre: 'Deshacer', titulo: 'Deshacer (Ctrl+Z)', Icono: Undo2, deshabilitado: !editor?.can().undo(), accion: () => c()?.undo().run() },
    { clave: 'redo', nombre: 'Rehacer', titulo: 'Rehacer (Ctrl+Mayús+Z)', Icono: Redo2, estrecho: true, deshabilitado: !editor?.can().redo(), accion: () => c()?.redo().run() },
    { clave: 'bold', nombre: 'Negrita', titulo: 'Negrita (Ctrl+B)', Icono: Bold, grupo: true, activo: !!editor?.isActive('bold'), accion: () => c()?.toggleBold().run() },
    { clave: 'italic', nombre: 'Cursiva', titulo: 'Cursiva (Ctrl+I)', Icono: Italic, activo: !!editor?.isActive('italic'), accion: () => c()?.toggleItalic().run() },
    { clave: 'underline', nombre: 'Subrayado', titulo: 'Subrayado (Ctrl+U)', Icono: Underline, activo: !!editor?.isActive('underline'), accion: () => c()?.toggleUnderline().run() },
    { clave: 'ul', nombre: 'Viñetas', titulo: 'Viñetas (Ctrl+Mayús+8)', Icono: List, grupo: true, activo: !!editor?.isActive('bulletList'), accion: () => c()?.toggleBulletList().run() },
    { clave: 'ol', nombre: 'Lista numerada', titulo: 'Lista numerada (Ctrl+Mayús+7)', Icono: ListOrdered, activo: !!editor?.isActive('orderedList'), accion: () => c()?.toggleOrderedList().run() },
    { clave: 'sink', nombre: 'Aumentar sangría', titulo: 'Aumentar sangría (Tab)', Icono: IndentIncrease, deshabilitado: !editor?.can().sinkListItem('listItem'), accion: () => c()?.sinkListItem('listItem').run() },
    { clave: 'lift', nombre: 'Reducir sangría', titulo: 'Reducir sangría (Mayús+Tab)', Icono: IndentDecrease, deshabilitado: !editor?.can().liftListItem('listItem'), accion: () => c()?.liftListItem('listItem').run() },
    // La alineación no ejecuta: abre su hoja. Lo gobierna `pulsar`.
    { clave: 'align', nombre: 'Alineación', titulo: `Alineación: ${alineacion.nombre}`, Icono: alineacion.Icono, grupo: true, estrecho: true, accion: () => {} },
    { clave: 'quote', nombre: 'Cita', titulo: 'Cita (Ctrl+Mayús+B)', Icono: Quote, estrecho: true, activo: !!editor?.isActive('blockquote'), accion: () => c()?.toggleBlockquote().run() },
    { clave: 'hr', nombre: 'Separador', titulo: 'Separador (---)', Icono: Minus, estrecho: true, accion: () => c()?.setHorizontalRule().run() },
    { clave: 'clear', nombre: 'Quitar formato', titulo: 'Quitar formato', Icono: RemoveFormatting, estrecho: true, accion: () => c()?.clearNodes().unsetAllMarks().run() },
  ]

  function pulsar(ctl: Control, desdeMenu: boolean): void {
    if (ctl.clave === 'align') {
      setMenu(desdeMenu ? 'align-mas' : menu === 'align' ? null : 'align')
      return
    }
    ctl.accion()
    setMenu(null)
  }

  const sinRobarFoco = (e: ReactMouseEvent) => e.preventDefault()

  return (
    <>
      {/* `group` y no `toolbar`: el rol de barra promete foco itinerante con
          flechas, y aquí cada control es un objetivo de tabulación normal. */}
      <div ref={barraRef} className="sp-esc-bar" role="group" aria-label="Formato del escrito">
        {CONTROLES.slice(0, 2).map(ctl => (
          <BotonBarra key={ctl.clave} ctl={ctl} menu={menu} onPulsar={() => pulsar(ctl, false)} sinRobarFoco={sinRobarFoco} />
        ))}
        <span className="sp-esc-sep" aria-hidden="true" />
        <div className="k-seg sp-esc-bloque" role="group" aria-label="Tipo de bloque">
          {BLOQUES.map(b => (
            <button key={b.valor} type="button" className="k-seg-op" title={b.titulo}
              aria-pressed={bloqueActual === b.valor} onMouseDown={sinRobarFoco} onClick={() => aplicarBloque(b.valor)}>
              {b.nombre}
            </button>
          ))}
        </div>
        {CONTROLES.slice(2).map(ctl => (
          <BotonBarra key={ctl.clave} ctl={ctl} menu={menu} onPulsar={() => pulsar(ctl, false)} sinRobarFoco={sinRobarFoco} />
        ))}
        <span className="sp-esc-fin" />
        <button type="button" className="k-b k-b-icono sp-esc-btn sp-esc-solo-estrecho"
          aria-haspopup="menu" aria-expanded={menu === 'mas'} aria-label="Más formato" title="Más formato"
          onMouseDown={sinRobarFoco} onClick={() => setMenu(m => (m === 'mas' ? null : 'mas'))}>
          <MoreHorizontal />
        </button>
        <button type="button" className="k-b k-b-icono sp-esc-btn"
          aria-haspopup="dialog" aria-expanded={menu === 'ayuda'} aria-label="Atajos de escritura" title="Atajos de escritura"
          onMouseDown={sinRobarFoco} onClick={() => setMenu(m => (m === 'ayuda' ? null : 'ayuda'))}>
          <CircleHelp />
        </button>

        {menu === 'mas' && (
          <div className="sp-ed-menu" role="menu">
            {/* Con el nombre escrito: en un menú no hay que adivinar un glifo. */}
            {CONTROLES.filter(ctl => ctl.estrecho).map(ctl => (
              <button key={ctl.clave} type="button" className="sp-ed-row"
                role={ctl.activo === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={ctl.activo} disabled={ctl.deshabilitado}
                aria-haspopup={ctl.clave === 'align' ? 'menu' : undefined}
                onMouseDown={sinRobarFoco} onClick={() => pulsar(ctl, true)}>
                <ctl.Icono />{ctl.clave === 'align' ? `Alineación: ${alineacion.nombre}` : ctl.nombre}
                {ctl.clave === 'align' && <span className="sp-ed-row__cue"><ChevronRight /></span>}
              </button>
            ))}
          </div>
        )}

        {(menu === 'align' || menu === 'align-mas') && (
          <div className="sp-ed-menu sp-esc-menu-align" role="menu">
            {menu === 'align-mas' && (
              <div className="sp-ed-menuhead">
                <button type="button" className="k-b k-b-icono" aria-label="Volver"
                  onMouseDown={sinRobarFoco} onClick={() => setMenu('mas')}>
                  <ArrowLeft />
                </button>
                <span className="sp-label">Alineación</span>
              </div>
            )}
            {ALINEACIONES.map(a => (
              <button key={a.valor} type="button" className="sp-ed-row" role="menuitemradio"
                aria-checked={a.valor === alineacion.valor} title={`${a.nombre} (${a.atajo})`}
                onMouseDown={sinRobarFoco}
                onClick={() => { editor?.chain().focus().setTextAlign(a.valor).run(); setMenu(null) }}>
                <a.Icono />{a.nombre}
                {a.valor === alineacion.valor && <span className="sp-ed-row__cue"><Check /></span>}
              </button>
            ))}
          </div>
        )}

        {menu === 'ayuda' && (
          <div className="sp-ed-menu sp-esc-ayuda" role="dialog" aria-label="Atajos de escritura">
            <p className="sp-esc-ayuda-t">Escribe y se da formato solo</p>
            <dl>
              {ATAJOS.map(([k, v]) => (
                <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
              ))}
            </dl>
            <p className="sp-esc-ayuda-n">
              Al pegar un texto de un asistente de IA se conserva su jerarquía, aunque venga con estos signos.
            </p>
          </div>
        )}
      </div>

      {/* El desplazamiento es SÓLO del cuerpo: título y barra quedan a la vista. */}
      <div className="sp-esc-cuerpo">
        <EditorContent editor={editor} />
      </div>
    </>
  )
}

/** Un control de la barra: icono de 20 con su nombre accesible y su atajo en el `title`. */
function BotonBarra({ ctl, menu, onPulsar, sinRobarFoco }: {
  ctl: Control; menu: Menu; onPulsar: () => void; sinRobarFoco: (e: ReactMouseEvent) => void
}) {
  const esAlign = ctl.clave === 'align'
  return (
    <>
      {ctl.grupo && <span className={`sp-esc-sep${ctl.estrecho ? ' sp-esc-ocu' : ''}`} aria-hidden="true" />}
      <button type="button"
        className={`k-b k-b-icono sp-esc-btn${ctl.estrecho ? ' sp-esc-ocu' : ''}`}
        title={ctl.titulo}
        aria-label={esAlign ? ctl.titulo : ctl.nombre}
        aria-pressed={ctl.activo}
        aria-haspopup={esAlign ? 'menu' : undefined}
        aria-expanded={esAlign ? menu === 'align' : undefined}
        disabled={ctl.deshabilitado}
        onMouseDown={sinRobarFoco} onClick={onPulsar}>
        <ctl.Icono />
      </button>
    </>
  )
}
