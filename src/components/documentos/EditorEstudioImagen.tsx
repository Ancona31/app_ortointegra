'use client'

import { useLayoutEffect, useRef } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { MODALIDADES_IMAGEN } from '@/lib/estudiosImagen'
import BuscadorImagen from '@/components/documentos/BuscadorImagen'
import {
  conModalidad, conRegion, contrasteImplicito, LADOS, modalidadDe, pideContraste, regionDe,
  type EstudioEditor, type Falta,
} from '@/components/documentos/imagenCompuesta'

interface Props {
  numero: number
  clave: number
  estudio: EstudioEditor
  /** Faltas a señalar (vacío hasta el primer intento de imprimir). */
  faltas: readonly Falta[]
  puedeQuitar: boolean
  /** `seguir`: tras una elección, el formulario lleva el foco a lo siguiente que falta. */
  onCambio: (e: EstudioEditor, seguir: boolean) => void
  onQuitar: () => void
  onAgregar: () => void
}

/** ←/→/↑/↓ mueven el foco entre los botones del grupo (sin elegir); Espacio o Enter eligen. */
const FLECHAS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
function moverFoco(e: React.KeyboardEvent<HTMLElement>) {
  const paso = FLECHAS[e.key]
  if (!paso) return
  const bs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(':scope > button'))
  const i = bs.findIndex(b => b === document.activeElement)
  if (i < 0) return
  e.preventDefault()
  bs[(i + paso + bs.length) % bs.length]?.focus()
}

/** Ajusta el alto del área de texto a su contenido: una línea que crece, sin tirador. */
function ajustarAlto(t: HTMLTextAreaElement | null) {
  if (!t) return
  t.style.height = 'auto'
  t.style.height = `${t.scrollHeight}px`
}

interface Opcion { valor: string; texto: string; titulo?: string }
interface PropsFila {
  id: string
  rotulo: string
  /** Nombre accesible del grupo cuando el rótulo visible es corto. */
  nombre?: string
  opciones: readonly Opcion[]
  valor: string
  invalido: boolean
  error?: string
  onElegir: (v: string) => void
}

/**
 * Grupo de radio en fichas: UNA parada de Tab (tabindex móvil). Nace sin
 * valor cuando es obligatorio y no hay uno por omisión (lado, contraste).
 */
function FilaOpciones({ id, rotulo, nombre, opciones, valor, invalido, error, onElegir }: PropsFila) {
  const hayMarcado = opciones.some(o => o.valor === valor)
  return (
    <div className={`sp-img-blo ${invalido ? 'sp-img-blo--falta' : ''}`}>
      <span className="sp-img-rot" id={`${id}-rot`}>
        {rotulo} <span aria-hidden="true">*</span><span className="sr-only">obligatorio</span>
      </span>
      <div id={id} role="radiogroup" aria-labelledby={nombre ? undefined : `${id}-rot`} aria-label={nombre}
        aria-required="true" aria-invalid={invalido || undefined} onKeyDown={moverFoco} className="sp-img-fichas">
        {opciones.map((o, k) => {
          const marcado = o.valor === valor
          return (
            <button key={o.valor} type="button" role="radio" aria-checked={marcado} title={o.titulo}
              tabIndex={marcado || (!hayMarcado && k === 0) ? 0 : -1}
              onClick={() => onElegir(o.valor)} className="sp-img-tog">
              {o.texto}
            </button>
          )
        })}
      </div>
      {invalido && error && <span className="sp-rx-err" role="alert">{error}</span>}
    </div>
  )
}

const OPCIONES_TIPO: readonly Opcion[] = MODALIDADES_IMAGEN.map(m => ({ valor: m.id, texto: m.corto, titulo: m.nombre }))
const OPCIONES_LADO: readonly Opcion[] = LADOS.map(l => ({ valor: l, texto: l }))

/** Grupos como pestañas y regiones como fichas; cada fila es una parada de Tab. */
function BloqueRegion({ clave, estudio, invalido, onCambio }: { clave: number; estudio: EstudioEditor; invalido: boolean; onCambio: Props['onCambio'] }) {
  const m = modalidadDe(estudio.modalidad)
  if (!m) return null
  const grupo = m.grupos[estudio.grupo] ?? m.grupos[0]
  const enGrupo = grupo.regiones.some(r => r.nombre === estudio.region)
  return (
    <div className={`sp-img-blo ${invalido ? 'sp-img-blo--falta' : ''}`}>
      <span className="sp-img-rot" id={`imagen-region-${clave}-rot`}>
        Región <span aria-hidden="true">*</span><span className="sr-only">obligatoria</span>
      </span>
      <div className="sp-img-col">
        {m.grupos.length > 1 && (
          <div role="group" aria-label="Grupos de regiones" onKeyDown={moverFoco} className="sp-img-grupos">
            {m.grupos.map((g, k) => (
              <button key={g.nombre} type="button" aria-pressed={g === grupo} tabIndex={g === grupo ? 0 : -1}
                onClick={() => onCambio({ ...estudio, grupo: k }, false)} className="sp-img-grupo">
                {g.nombre}
              </button>
            ))}
          </div>
        )}
        <div id={`imagen-region-${clave}`} role="group" aria-labelledby={`imagen-region-${clave}-rot`}
          onKeyDown={moverFoco} className="sp-img-fichas sp-img-regiones">
          {grupo.regiones.map((r, k) => {
            const on = enGrupo && r.nombre === estudio.region
            return (
              <button key={r.nombre} type="button" aria-pressed={on} tabIndex={on || (!enGrupo && k === 0) ? 0 : -1}
                onClick={() => onCambio(conRegion(estudio, m.id, m.grupos.indexOf(grupo), r.nombre), true)}
                className="sp-img-tog sp-img-tog--suave">
                {r.nombre}
              </button>
            )
          })}
        </div>
      </div>
      {invalido && <span className="sp-rx-err" role="alert">Falta la región</span>}
    </div>
  )
}

/** Rx y Mx: las de rutina premarcadas, las especiales para añadir y «Otra». */
function BloqueProyecciones({ clave, estudio, onCambio }: { clave: number; estudio: EstudioEditor; onCambio: Props['onCambio'] }) {
  const r = regionDe(estudio)
  if (!r) return null
  const todas = [...(r.rutina ?? []), ...(r.especiales ?? [])]
  const alternar = (p: string) => onCambio({
    ...estudio,
    proyecciones: estudio.proyecciones.includes(p) ? estudio.proyecciones.filter(x => x !== p) : [...estudio.proyecciones, p],
  }, false)
  return (
    <div className="sp-img-blo">
      <span className="sp-img-rot" id={`imagen-proy-${clave}-rot`}>Proyecciones</span>
      <div className="sp-img-col">
        <div role="group" aria-labelledby={`imagen-proy-${clave}-rot`} onKeyDown={moverFoco} className="sp-img-fichas">
          {todas.map((p, k) => {
            const on = estudio.proyecciones.includes(p)
            return (
              <button key={p} type="button" aria-pressed={on} tabIndex={k === 0 ? 0 : -1}
                onClick={() => alternar(p)} className="sp-img-tog sp-img-tog--suave">
                {on && <Check aria-hidden="true" />}{p}
              </button>
            )
          })}
        </div>
        <div className="sp-rx-campo">
          <label htmlFor={`imagen-otra-${clave}`} className="sp-rx-rot">Otra</label>
          <input id={`imagen-otra-${clave}`} type="text" autoComplete="off" value={estudio.otra}
            onChange={e => onCambio({ ...estudio, otra: e.target.value }, false)}
            placeholder="Proyección especial, si hace falta" className="sp-rx-fi" />
        </div>
      </div>
    </div>
  )
}

/** «Otro»: los campos libres de siempre (tipo y región obligatorios). */
function CamposOtro({ clave, estudio, faltas, onCambio }: { clave: number; estudio: EstudioEditor; faltas: readonly Falta[]; onCambio: Props['onCambio'] }) {
  const campo = (c: 'tipoLibre' | 'regionLibre' | 'proyLibre', v: string) => onCambio({ ...estudio, [c]: v }, false)
  return (
    <>
      <div className={`sp-rx-campo ${faltas.includes('tipo') ? 'sp-rx-campo--falta' : ''}`}>
        <label htmlFor={`imagen-tipolibre-${clave}`} className="sp-rx-rot">
          Estudio <span aria-hidden="true">*</span><span className="sr-only">obligatorio</span>
        </label>
        <input id={`imagen-tipolibre-${clave}`} type="text" autoComplete="off" value={estudio.tipoLibre}
          onChange={e => campo('tipoLibre', e.target.value)} placeholder="Nombre del estudio"
          aria-invalid={faltas.includes('tipo') || undefined} className="sp-rx-fi" />
      </div>
      <div className="sp-rx-par">
        <div className={`sp-rx-campo ${faltas.includes('region') ? 'sp-rx-campo--falta' : ''}`}>
          <label htmlFor={`imagen-regionlibre-${clave}`} className="sp-rx-rot">
            Región <span aria-hidden="true">*</span><span className="sr-only">obligatoria</span>
          </label>
          <input id={`imagen-regionlibre-${clave}`} type="text" autoComplete="off" value={estudio.regionLibre}
            onChange={e => campo('regionLibre', e.target.value)} placeholder="Región anatómica"
            aria-invalid={faltas.includes('region') || undefined} className="sp-rx-fi" />
        </div>
        <div className="sp-rx-campo">
          <label htmlFor={`imagen-proylibre-${clave}`} className="sp-rx-rot">Proyecciones</label>
          <input id={`imagen-proylibre-${clave}`} type="text" autoComplete="off" value={estudio.proyLibre}
            onChange={e => campo('proyLibre', e.target.value)} placeholder="Si aplica" className="sp-rx-fi" />
        </div>
      </div>
    </>
  )
}

/** Lado, contraste (o tipo de mastografía) y la nota del contraste implícito: sólo lo que aplica. */
function OpcionesRegion({ clave, estudio, faltas, onCambio }: { clave: number; estudio: EstudioEditor; faltas: readonly Falta[]; onCambio: Props['onCambio'] }) {
  const m = modalidadDe(estudio.modalidad)
  const r = regionDe(estudio)
  if (!m || !r) return null
  const esMx = m.id === 'mx'
  return (
    <>
      {r.lado && (
        <FilaOpciones id={`imagen-lado-${clave}`} rotulo="Lado" opciones={OPCIONES_LADO} valor={estudio.lado}
          invalido={faltas.includes('lado')} error="Falta el lado"
          onElegir={v => onCambio({ ...estudio, lado: LADOS.find(l => l === v) ?? '' }, true)} />
      )}
      {pideContraste(estudio) && (
        <FilaOpciones id={`imagen-contraste-${clave}`} rotulo={esMx ? 'Tipo' : 'Contraste'}
          nombre={esMx ? 'Tipo de mastografía' : undefined}
          opciones={m.contrastes.map(c => ({ valor: c, texto: c }))} valor={estudio.contraste}
          invalido={faltas.includes('contraste')} error="Elige una"
          onElegir={v => onCambio({ ...estudio, contraste: v }, true)} />
      )}
      {contrasteImplicito(estudio) && <p className="sp-img-pista">Estudio con contraste: no hace falta indicarlo.</p>}
      {m.proyecciones && <BloqueProyecciones clave={clave} estudio={estudio} onCambio={onCambio} />}
    </>
  )
}

/**
 * Estudio ABIERTO de la solicitud de imagen. Orden de Tab: buscador → tipo →
 * (grupos → regiones → lado → contraste → proyecciones → otra) → indicación;
 * cada grupo de fichas es una parada (las flechas recorren). Según tipo y
 * región aparece SÓLO lo que aplica. La papelera está fuera del Tab.
 * Ctrl/⌘+Enter pliega este y abre uno nuevo (lo hace el formulario).
 */
export default function EditorEstudioImagen(p: Props) {
  const { numero, clave, estudio, faltas } = p
  const indRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { ajustarAlto(indRef.current) }, [estudio.indicacion])
  const otro = estudio.modalidad === 'otro'

  return (
    <div className="sp-rx-ed sp-img-ed" data-imagen-abierto={numero}
      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); p.onAgregar() } }}>
      <div className="sp-rx-cab">
        <span className="sp-rx-num sp-rx-num--on" aria-hidden="true">{numero}</span>
        <h3 className="sp-rx-cab-t">Estudio {numero}</h3>
        <button type="button" tabIndex={-1} onClick={p.onQuitar} disabled={!p.puedeQuitar}
          aria-label={`Eliminar estudio ${numero}`} className="k-b k-b-icono sp-rx-quitar">
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <div className="sp-rx-campo sp-rx-campo--buscar">
        <label htmlFor={`imagen-buscar-${clave}`} className="sp-rx-rot">Buscar</label>
        <BuscadorImagen id={`imagen-buscar-${clave}`}
          onElegir={r => p.onCambio(conRegion(estudio, r.modalidad, r.grupo, r.region), true)} />
      </div>

      <FilaOpciones id={`imagen-tipo-${clave}`} rotulo="Tipo" nombre="Tipo de estudio" opciones={OPCIONES_TIPO}
        valor={estudio.modalidad} invalido={faltas.includes('tipo') && !otro} error="Falta el tipo de estudio"
        onElegir={v => {
          const id = MODALIDADES_IMAGEN.find(m => m.id === v)?.id
          if (id) p.onCambio(conModalidad(estudio, id), true)
        }} />

      {otro
        ? <CamposOtro clave={clave} estudio={estudio} faltas={faltas} onCambio={p.onCambio} />
        : estudio.modalidad && (
          <>
            <BloqueRegion clave={clave} estudio={estudio} invalido={faltas.includes('region')} onCambio={p.onCambio} />
            <OpcionesRegion clave={clave} estudio={estudio} faltas={faltas} onCambio={p.onCambio} />
          </>
        )}

      <div className="sp-rx-campo sp-rx-campo--texto">
        <label htmlFor={`imagen-indicacion-${clave}`} className="sp-rx-rot">Indicación</label>
        <textarea ref={indRef} id={`imagen-indicacion-${clave}`} rows={1} value={estudio.indicacion}
          onChange={e => p.onCambio({ ...estudio, indicacion: e.target.value }, false)}
          placeholder="Opcional: descartar fractura, valorar menisco…"
          className="sp-rx-fi sp-rx-ta" />
      </div>
    </div>
  )
}
