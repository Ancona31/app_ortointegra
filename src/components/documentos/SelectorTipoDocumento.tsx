'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  Pill, FlaskConical, ScanLine, ClipboardList,
  BedDouble, PenLine, ShieldCheck, Receipt, ChevronDown,
} from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
// Misma búsqueda de scroller que usan los formularios: el scroller de esta app
// no es la ventana. Una sola definición para que no diverjan.
import { scrollerDe } from '@/lib/scrollDoc'

/**
 * Selector de tipo de documento — GUIA_FORMULARIOS_04_TARJETAS_TIPO.md.
 *
 * Sustituye a la barra 3×3 de la propuesta y a las tres barras de tipo que
 * había vivas (chips del expediente, rejilla de /documentos, fila de iconos
 * del overlay de nueva-nota, que muere con él).
 *
 * El formulario va DENTRO, como children: el selector es quien pliega, quien
 * compensa el scroll y quien pregunta antes de descartar, y las tres cosas
 * necesitan al formulario montado debajo, no al lado.
 */

export type TipoDocumento =
  | 'receta' | 'lab' | 'imagen' | 'suplementacion'
  | 'internamiento' | 'escrito' | 'consentimiento' | 'honorarios'

type Tipo = {
  key: TipoDocumento
  /** Completa en los cuatro anchos: la tarjeta admite 2 líneas, no se acorta. */
  label: string
  icon: typeof Pill
  /** Sufijo de --sp-doc-*. NUNCA un literal de color en el componente. */
  token: string
  /**
   * Copia de los dos diálogos. Frases enteras y no piezas: el género del
   * artículo y el del participio los resuelve la tabla, no una función que
   * intente concordarlos en tiempo de render.
   *   def       → «Se descarta {def} que estás llenando.»       (§6.1)
   *   pendiente → «Tienes {pendiente} y sin imprimir.»           (§6.2)
   */
  def: string
  pendiente: string
}

/** Orden fijo, leído en filas. Posición constante en todos los anchos. */
export const TIPOS_DOCUMENTO: readonly Tipo[] = [
  { key: 'receta',         label: 'Receta',                  icon: Pill,          token: 'receta',         def: 'la receta',                     pendiente: 'una receta empezada' },
  { key: 'lab',            label: 'Laboratorio',             icon: FlaskConical,  token: 'laboratorio',    def: 'la solicitud de laboratorio',   pendiente: 'una solicitud de laboratorio empezada' },
  // `key` y `token` siguen diciendo `imagen` y no son un descuido: el primero
  // viaja en la URL (`?tipo=imagen`) y el segundo nombra una variable de CSS.
  // Lo que cambia es lo que LEE el médico. Ver el cambio 4 de `DOCUMENTOS_HANDOFF.md` §8.
  { key: 'imagen',         label: 'Imagenología',            icon: ScanLine,      token: 'imagen',         def: 'la solicitud de imagenología',  pendiente: 'una solicitud de imagenología empezada' },
  { key: 'suplementacion', label: 'Suplementación',          icon: ClipboardList, token: 'suplementacion', def: 'el plan de suplementación',     pendiente: 'un plan de suplementación empezado' },
  { key: 'internamiento',  label: 'Internamiento',           icon: BedDouble,     token: 'internamiento',  def: 'la solicitud de internamiento', pendiente: 'una solicitud de internamiento empezada' },
  { key: 'escrito',        label: 'Escrito médico',          icon: PenLine,       token: 'escrito',        def: 'el escrito médico',             pendiente: 'un escrito médico empezado' },
  { key: 'consentimiento', label: 'Consentimiento',          icon: ShieldCheck,   token: 'consentimiento', def: 'el consentimiento',             pendiente: 'un consentimiento empezado' },
  { key: 'honorarios',     label: 'Honorarios / Cotización', icon: Receipt,       token: 'honorarios',     def: 'la nota de honorarios',         pendiente: 'una nota de honorarios empezada' },
] as const

/**
 * `?? null` y NO el `undefined` que devuelve Array.find: en este archivo todo
 * lo ausente es `null` (`value`, `pendiente`, `destino`), y una función que
 * devolvía el otro nulo hizo que `entrante !== null` fuera SIEMPRE cierto —
 * el diálogo de cambio de tipo nacía abierto y no había forma de cerrarlo.
 * TypeScript no lo atrapa: comparar `Tipo | undefined` contra `null` es legal.
 * Un solo nulo en la superficie del módulo es lo que impide que se repita.
 */
export function tipoDocumento(key: TipoDocumento | null): Tipo | null {
  return TIPOS_DOCUMENTO.find(t => t.key === key) ?? null
}

/** React.CSSProperties no admite custom properties. Se ensancha el tipo en vez
 *  de silenciarlo con `as`: --doc-color es una propiedad real del elemento. */
type EstiloDoc = React.CSSProperties & { '--doc-color': string }

function estiloDe(t: Tipo): EstiloDoc {
  return { '--doc-color': `var(--sp-doc-${t.token})` }
}

/** Columnas vigentes de la rejilla. Se leen del CSS resuelto porque el umbral
 *  es de CONTENEDOR: ningún cálculo en JS sobre el viewport lo acertaría. */
function columnasDe(grid: HTMLElement | null): number {
  if (!grid) return 2
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
  return cols > 0 ? cols : 2
}

interface Props {
  value: TipoDocumento | null
  onChange: (tipo: TipoDocumento) => void
  /**
   * El formulario montado tiene algo escrito. Gobierna la confirmación previa
   * al cambiar de tipo. Lo calcula el formulario, no el host: es el predicado
   * único de «formulario vacío», negado.
   */
  conDatos?: boolean
  /**
   * El formulario montado abrió su panel de plantillas (spec 02 §3.1). El
   * selector se apaga —no se desmonta: el pliegue mide su ranura— porque el
   * panel opera sobre el formulario que sigue vivo debajo, y elegir otro tipo
   * desde aquí lo tiraría.
   */
  oculto?: boolean
  children: ReactNode
}

export default function SelectorTipoDocumento({ value, onChange, conDatos = false, oculto = false, children }: Props) {
  const idBase = useId()
  const idPanel = `${idBase}-panel`

  const [abierto, setAbierto] = useState(value === null)
  // Solo se anima cuando pliega o despliega el MÉDICO. El pliegue automático
  // va sin animación: arrastrar 346px de alto durante 240ms se lleva el campo
  // de debajo del dedo, que es justo lo que el §5 evita.
  const [anim, setAnim] = useState(false)
  const [pendiente, setPendiente] = useState<TipoDocumento | null>(null)

  const slotRef  = useRef<HTMLDivElement>(null)   // tarjetas o línea: la ranura que cambia de alto
  const gridRef  = useRef<HTMLDivElement>(null)
  const lineaRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // El tipo puede cambiar SIN pasar por una tarjeta: `?tipo=` en la URL, o el
  // CTA «Generar receta» del Estado Éxito de la nota. Con tipo elegido las
  // tarjetas están plegadas, venga la elección de donde venga.
  // Ajuste durante el render (el patrón documentado de React para reaccionar
  // al cambio de una prop) y no un useEffect: el efecto llega tarde y pinta un
  // fotograma con las ocho abiertas antes de plegarlas. El valor previo va en
  // estado y no en un ref: leer un ref en render es justo lo que hace que un
  // componente no se actualice cuando debe.
  const [valuePrevio, setValuePrevio] = useState(value)
  if (valuePrevio !== value) {
    setValuePrevio(value)
    if (value && abierto) setAbierto(false)
  }

  // Leídos desde el listener de focusin, que se suscribe una sola vez.
  const abiertoRef = useRef(abierto)
  const valueRef   = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  // Compensación pendiente: alto de la ranura ANTES de plegar + su scroller.
  const medidaRef = useRef<{ scroller: HTMLElement; alto: number } | null>(null)
  // Dónde dejar el foco tras la transición. null = no tocarlo (pliegue
  // automático: el médico está escribiendo en un campo).
  const focoRef = useRef<'linea' | 'tarjeta' | 'panel' | null>(null)

  const activo = tipoDocumento(value)

  // ── Pliegue automático, sin salto (§5) ──────────────────────────
  // focusin y no click: cubre el toque, el tabulador y el foco que da el
  // navegador al aparecer el teclado. Va en el panel, así que las tarjetas
  // quedan fuera por construcción.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    function alEnfocar() {
      if (!abiertoRef.current || !valueRef.current) return
      const slot = slotRef.current
      if (slot) medidaRef.current = { scroller: scrollerDe(slot), alto: slot.offsetHeight }
      focoRef.current = null
      setAnim(false)
      setAbierto(false)
    }
    panel.addEventListener('focusin', alEnfocar)
    return () => panel.removeEventListener('focusin', alEnfocar)
  }, [])

  // useLayoutEffect y NUNCA useEffect: useEffect deja pintar el estado
  // intermedio y el salto se ve. El criterio es que el campo recién enfocado
  // quede en la misma posición de pantalla antes y después del pliegue.
  useLayoutEffect(() => {
    abiertoRef.current = abierto
    const medida = medidaRef.current
    medidaRef.current = null
    if (!medida) return
    const delta = medida.alto - (slotRef.current?.offsetHeight ?? 0)
    if (delta <= 0) return
    // Donde scrollTop < delta el contenido sube lo que falte: solo ocurre con
    // las tarjetas a la vista, así que el médico ve desaparecer lo que
    // desaparece. Es el único caso y es el aceptable (§5).
    medida.scroller.scrollTop = Math.max(0, medida.scroller.scrollTop - delta)
  }, [abierto])

  useEffect(() => {
    const destino = focoRef.current
    focoRef.current = null
    if (destino === 'linea') lineaRef.current?.focus()
    // preventScroll: al elegir tipo el formulario aún no ha llegado (import
    // dinámico) y el panel solo tiene el spinner. Llevar la vista hasta ahí
    // sería un salto para enseñar un «Cargando…».
    // NO DEFINIDO en 5.1: §7 pide el primer campo editable vacío. Ese campo no
    // existe todavía cuando este efecto corre; se cablea en el paso del
    // acabado, que es quien monta los campos.
    if (destino === 'panel') panelRef.current?.focus({ preventScroll: true })
    if (destino === 'tarjeta') {
      gridRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    }
  }, [abierto, value])

  // ── Elección y cambio de tipo (§6) ──────────────────────────────
  function aplicar(tipo: TipoDocumento) {
    setPendiente(null)
    onChange(tipo)
    focoRef.current = 'panel'
    setAnim(true)
    setAbierto(false)
  }

  function elegir(tipo: TipoDocumento) {
    if (tipo === value) { focoRef.current = 'linea'; setAnim(true); setAbierto(false); return }
    if (value && conDatos) { setPendiente(tipo); return }
    aplicar(tipo)
  }

  function plegar() {
    if (!value) return
    focoRef.current = 'linea'
    setAnim(true)
    setAbierto(false)
  }

  function alTeclearRejilla(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { plegar(); return }
    const paso: Record<string, number> = {
      ArrowRight: 1, ArrowLeft: -1,
      ArrowDown: columnasDe(gridRef.current), ArrowUp: -columnasDe(gridRef.current),
    }
    const ultimo = TIPOS_DOCUMENTO.length - 1
    const desde = TIPOS_DOCUMENTO.findIndex(t => t.key === document.activeElement?.getAttribute('data-tipo'))
    let destino: number | null = null
    if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = ultimo
    else if (paso[e.key] !== undefined && desde >= 0) destino = desde + paso[e.key]
    if (destino === null || destino < 0 || destino > ultimo) return
    e.preventDefault()
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-tipo="${TIPOS_DOCUMENTO[destino].key}"]`)?.focus()
  }

  // Índice tabulable de la rejilla (roving tabindex): el activo, o el primero.
  const idxTab = Math.max(0, TIPOS_DOCUMENTO.findIndex(t => t.key === value))
  const entrante = tipoDocumento(pendiente)

  return (
    <>
      {/* La ranura: tarjetas o línea, nunca las dos. Es lo que se mide para
          compensar el scroll, así que el ref va aquí y no en cada hijo. */}
      <div ref={slotRef} style={oculto ? { display: 'none' } : undefined}>
        {abierto || !activo ? (
          <div
            ref={gridRef}
            role="tablist"
            aria-label="Tipo de documento"
            onKeyDown={alTeclearRejilla}
            className={`sp-doc-typecards${anim ? ' animate-fade-in' : ''}`}
          >
            {TIPOS_DOCUMENTO.map((t, i) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                data-tipo={t.key}
                aria-selected={t.key === value}
                aria-controls={idPanel}
                tabIndex={i === idxTab ? 0 : -1}
                onClick={() => elegir(t.key)}
                style={estiloDe(t)}
                className="sp-doc-typecard"
              >
                <t.icon />
                <span className="sp-doc-typecard__label">{t.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <button
            ref={lineaRef}
            type="button"
            aria-expanded={false}
            aria-controls={idPanel}
            onClick={() => { focoRef.current = 'tarjeta'; setAnim(true); setAbierto(true) }}
            style={estiloDe(activo)}
            className={`sp-doc-typecollapsed${anim ? ' animate-fade-in' : ''}`}
          >
            <activo.icon />
            <span className="min-w-0">
              <span className="sp-doc-typecollapsed__eyebrow">Documento</span>
              <span className="sp-doc-typecollapsed__name">{activo.label}</span>
            </span>
            <span className="sp-doc-typecollapsed__cta">
              Cambiar
              <ChevronDown />
            </span>
          </button>
        )}
      </div>

      {/* Abrir NO toca el formulario: sigue montado con todo lo escrito. */}
      <div ref={panelRef} id={idPanel} role="tabpanel" tabIndex={-1} className="focus:outline-none">
        {children}
      </div>

      {/* Confirmación PREVIA y no Deshacer: cambiar de tipo hace desaparecer el
          formulario entero, y un aviso posterior es una franja pequeña que se
          pierde, sobre todo en móvil. */}
      <ModalShell
        /* !!entrante y no una comparación contra un nulo concreto: es cierto
           solo cuando hay un tipo destino real, sea cual sea el nulo que
           devuelva tipoDocumento. Aquí es donde se decidía la visibilidad y
           donde el diálogo se quedaba abierto para siempre. */
        open={!!entrante}
        onClose={() => setPendiente(null)}
        spinusGeometry="decide"
        title={entrante ? `¿Cambiar a ${entrante.label}?` : ''}
        footer={
          <div className="flex items-center gap-2 p-4 md:px-6">
            <button onClick={() => setPendiente(null)} className="sp-btn sp-btn--ghost">
              Cancelar
            </button>
            <div className="flex-1" />
            <button
              onClick={() => entrante && aplicar(entrante.key)}
              className="sp-btn sp-btn--primary">
              Cambiar a {entrante?.label}
            </button>
          </div>
        }
      >
        <div className="p-4 md:p-6">
          <p className="sp-banner sp-banner--danger">
            Se descarta {activo?.def ?? 'el documento'} que estás llenando. No se puede deshacer.
          </p>
        </div>
      </ModalShell>
    </>
  )
}
