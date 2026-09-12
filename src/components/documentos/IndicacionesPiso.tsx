'use client'

/**
 * Indicaciones de ingreso a piso — control de dos niveles.
 * `GUIA_FORM_INTERNAMIENTO.md` §3.
 *
 * POR QUÉ DEJA DE SER UN TEXTAREA
 *
 * En diez documentos de producción hay cuatro sintaxis distintas —numeración
 * con punto, con punto y guion, prosa corrida y numeradas con guiones
 * colgando—, ninguna coincide con la que el sistema espera, y cuatro de los
 * diez son basura de prueba. Los reales miden entre 97 y 225 caracteres: tres o
 * cuatro indicaciones. El texto libre es lo que produjo las cuatro sintaxis.
 *
 * ⚠ **LOS DOCUMENTOS YA EMITIDOS NO SE CONVIERTEN.** Se quedan con su cadena y
 * el analizador de 2.J (`src/lib/pdf/v2/analizadorBloques.ts`) sigue vivo para
 * leerlos. Este control no lee texto libre: solo lo produce, y lo produce en la
 * única sintaxis que ese analizador reconoce (ver `textoIndicaciones`).
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

export interface GrupoIndicaciones {
  readonly nombre: string
  readonly renglones: readonly string[]
}

/**
 * Los cuatro de siempre, **en orden clínico y no de activación**: enfermería
 * lee siempre en el mismo orden. Los propios —en los datos reales aparece «Al
 * ingreso»— se listan detrás.
 */
export const GRUPOS_FIJOS = [
  'Dieta',
  'Soluciones',
  'Medicamentos',
  'Cuidados de enfermería',
] as const

/**
 * Sugerencia del renglón vacío, una por grupo. **Es texto de ayuda y no se
 * inserta**: nada de esto llega al documento si el médico no lo teclea.
 *
 * Va por grupo y no una sola para los cuatro porque la misma frase —«Ayuno
 * estricto de 8 horas»— en Soluciones o en Medicamentos no orienta: despista.
 * Las cuatro salen de los datos reales de producción.
 */
const EJEMPLO: Record<string, string> = {
  Dieta: 'Ayuno estricto de 8 horas',
  Soluciones: 'Solución Hartmann 1000 ml para 24 horas',
  Medicamentos: 'Cefalotina 1 g IV una hora antes de la cirugía',
  'Cuidados de enfermería': 'Signos vitales cada 8 horas',
}

/**
 * Un grupo propio puede ser cualquier cosa —en los datos reales aparece «Al
 * ingreso»—, así que su sugerencia no puede parecerse a ninguno de los cuatro:
 * cualquier ejemplo con contenido clínico empujaría hacia el grupo del que
 * salió. Dice qué se escribe, no qué escribir.
 */
const EJEMPLO_PROPIO = 'Una indicación por renglón'

/** Posición en el orden clínico. Los propios comparten la última y empatan. */
function orden(nombre: string): number {
  const i = GRUPOS_FIJOS.findIndex(g => g === nombre)
  return i === -1 ? GRUPOS_FIJOS.length : i
}

/**
 * `sort` es estable desde ES2019, así que los grupos propios —todos con la
 * misma clave— conservan su orden de creación, que es lo que §3.1 pide.
 */
function ordenar(grupos: readonly GrupoIndicaciones[]): GrupoIndicaciones[] {
  return [...grupos].sort((a, b) => orden(a.nombre) - orden(b.nombre))
}

/** Renglones con texto. Los vacíos no cuentan: el recuento resume contenido. */
export function contarRenglones(grupos: readonly GrupoIndicaciones[]): number {
  return grupos.reduce((n, g) => n + g.renglones.filter(r => r.trim() !== '').length, 0)
}

/** `1 grupo · 3 renglones`. Sin grupos no hay resumen (§3.4). */
export function resumenIndicaciones(
  grupos: readonly GrupoIndicaciones[], abierta: boolean,
): string | undefined {
  if (grupos.length === 0) return undefined
  const g = `${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'}`
  // Abierta el detalle ya se ve; solo plegada hace falta el recuento fino.
  if (abierta) return g
  const r = contarRenglones(grupos)
  return `${g} · ${r} ${r === 1 ? 'renglón' : 'renglones'}`
}

/**
 * SERIALIZA A LA ÚNICA SINTAXIS QUE EL ANALIZADOR DE 2.J RECONOCE.
 *
 *     Dieta
 *     - Ayuno estricto de 8 horas
 *     (línea vacía)
 *     Soluciones
 *     - SSN 0.9% 1000 ml a 60 ml/h
 *
 * Regla del analizador: una línea sin viñeta CON ítems debajo es encabezado de
 * bloque; con la línea vacía delante, el bloque anterior ya está cerrado. Por
 * eso el guion lo pone AQUÍ y no el médico: el renglón se escribe limpio
 * («Ayuno estricto de 8 horas») y la numeración la compone el documento.
 *
 * Un grupo sin renglones con texto no se emite: su nombre quedaría como línea
 * suelta y el analizador lo degradaría a párrafo, que es exactamente el ruido
 * que este control existe para quitar.
 */
export function textoIndicaciones(grupos: readonly GrupoIndicaciones[]): string {
  return grupos
    .map(g => ({
      nombre: g.nombre.trim(),
      renglones: g.renglones.map(r => r.trim()).filter(r => r !== ''),
    }))
    .filter(g => g.nombre !== '' && g.renglones.length > 0)
    .map(g => [g.nombre, ...g.renglones.map(r => `- ${r}`)].join('\n'))
    .join('\n\n')
}

/** Relee lo que guardó una plantilla. El jsonb pudo escribirlo otra versión. */
export function leerGrupos(valor: unknown): GrupoIndicaciones[] {
  if (!Array.isArray(valor)) return []
  const grupos: GrupoIndicaciones[] = []
  for (const g of valor) {
    if (typeof g !== 'object' || g === null) continue
    const { nombre, renglones } = g as Record<string, unknown>
    if (typeof nombre !== 'string' || nombre.trim() === '') continue
    const filas = Array.isArray(renglones)
      ? renglones.filter((r): r is string => typeof r === 'string')
      : []
    grupos.push({ nombre, renglones: filas.length > 0 ? filas : [''] })
  }
  return ordenar(grupos)
}

interface PropsBloque {
  grupo: GrupoIndicaciones
  indice: number
  onRenglon: (ri: number, valor: string) => void
  onAgregar: () => void
  onQuitar: (ri: number) => void
  onBorrarGrupo: () => void
}

/** Un grupo con sus renglones. Privado: solo lo compone el control. */
function BloqueGrupo({
  grupo, indice, onRenglon, onAgregar, onQuitar, onBorrarGrupo,
}: PropsBloque): ReactElement {
  const cuenta = grupo.renglones.filter(r => r.trim() !== '').length
  const ejemplo = EJEMPLO[grupo.nombre] ?? EJEMPLO_PROPIO

  return (
    <div className="sp-doc-grupo">
      <div className="sp-doc-grupohead">
        <span className="sp-label-field">{grupo.nombre}</span>
        {cuenta > 0 && (
          <span className="sp-doc-grupocount">
            {cuenta} {cuenta === 1 ? 'renglón' : 'renglones'}
          </span>
        )}
        <button type="button" onClick={onBorrarGrupo}
          aria-label={`Eliminar grupo ${grupo.nombre}`} className="sp-doc-iconbtn">
          <Trash2 />
        </button>
      </div>

      {grupo.renglones.map((renglon, ri) => (
        <div key={ri} className="sp-doc-listrow">
          <input
            id={`internamiento-renglon-${indice}-${ri}`}
            type="text"
            value={renglon}
            onChange={e => onRenglon(ri, e.target.value)}
            aria-label={`Renglón ${ri + 1} de ${grupo.nombre}`}
            placeholder={`Ej: ${ejemplo}`}
            style={{ flex: 1, minWidth: 0 }}
            className="sp-input"
          />
          {/* Visible y deshabilitada con un solo renglón: ocultarla mueve la
              interfaz al añadir el segundo (spec 01 §3.6). */}
          <button type="button" onClick={() => onQuitar(ri)}
            disabled={grupo.renglones.length === 1}
            aria-label={renglon.trim() ? `Eliminar ${renglon.trim()}` : `Eliminar renglón ${ri + 1}`}
            className="sp-doc-iconbtn">
            <Trash2 />
          </button>
        </div>
      ))}

      <div className="sp-doc-grupofoot">
        <button type="button" onClick={onAgregar} className="sp-btn sp-btn--compact">
          <Plus size={17} /> Agregar renglón
        </button>
      </div>
    </div>
  )
}

interface Props {
  grupos: readonly GrupoIndicaciones[]
  onChange: (grupos: GrupoIndicaciones[]) => void
}

export default function IndicacionesPiso({ grupos, onChange }: Props): ReactElement {
  /** `null` = la fila de grupo propio no está abierta. */
  const [nuevo, setNuevo] = useState<string | null>(null)
  const nuevoRef = useRef<HTMLInputElement>(null)
  const abriendo = nuevo !== null

  // §3.3: la fila nace «con el foco puesto». preventScroll para no arrastrar la
  // página hasta ella; el chip que la abre ya está a la vista.
  useEffect(() => {
    if (abriendo) nuevoRef.current?.focus({ preventScroll: true })
  }, [abriendo])

  const nombres = grupos.map(g => g.nombre)
  const propios = nombres.filter(n => orden(n) === GRUPOS_FIJOS.length)

  /**
   * El chip no guarda estado: enciende o apaga el grupo en `grupos`, y su
   * `aria-pressed` se deriva de ahí. Apagarlo borra el bloque entero, igual que
   * su papelera — dos caminos con la misma consecuencia y ninguna confirmación,
   * que es el trato del resto del sistema con las listas.
   */
  function alternar(nombre: string): void {
    if (nombres.includes(nombre)) onChange(grupos.filter(g => g.nombre !== nombre))
    else onChange(ordenar([...grupos, { nombre, renglones: [''] }]))
  }

  function conRenglones(gi: number, renglones: string[]): void {
    onChange(grupos.map((g, i) => (i === gi ? { ...g, renglones } : g)))
  }

  function confirmarNuevo(): void {
    const nombre = (nuevo ?? '').trim()
    setNuevo(null)
    // Un nombre repetido no crea un segundo bloque: sería el mismo grupo dos
    // veces en la lámina.
    if (nombre === '' || nombres.some(n => n.toLowerCase() === nombre.toLowerCase())) return
    onChange(ordenar([...grupos, { nombre, renglones: [''] }]))
  }

  return (
    <div className="sp-doc-piso">
      <div className="sp-doc-chips">
        {[...GRUPOS_FIJOS, ...propios].map(nombre => (
          <button key={nombre} type="button" onClick={() => alternar(nombre)}
            aria-pressed={nombres.includes(nombre)} className="sp-chip">
            {nombre}
          </button>
        ))}
        <button type="button" onClick={() => setNuevo('')}
          className="sp-chip sp-doc-chipadd">
          <Plus aria-hidden="true" /> Otro grupo
        </button>
      </div>

      {nuevo !== null && (
        <div className="sp-doc-nuevogrupo">
          <label htmlFor="internamiento-grupo-nuevo" className="sr-only">Nombre del grupo</label>
          <input ref={nuevoRef} id="internamiento-grupo-nuevo" type="text" value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmarNuevo() }
              if (e.key === 'Escape') setNuevo(null)
            }}
            placeholder="Nombre del grupo" className="sp-input" />
          <button type="button" onClick={() => setNuevo(null)}
            aria-label="Cancelar grupo nuevo" className="sp-doc-iconbtn">
            <X />
          </button>
          <button type="button" onClick={confirmarNuevo} className="sp-btn sp-btn--compact">
            Añadir
          </button>
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="sp-doc-dashzone">
          <p className="sp-hint">
            Elige un grupo para empezar. La numeración y los guiones los pone el documento.
          </p>
        </div>
      ) : (
        <div className="sp-doc-grupos">
          {grupos.map((grupo, gi) => (
            <BloqueGrupo
              key={grupo.nombre}
              grupo={grupo}
              indice={gi}
              onRenglon={(ri, valor) => conRenglones(gi, grupo.renglones.map((r, j) => (j === ri ? valor : r)))}
              onAgregar={() => conRenglones(gi, [...grupo.renglones, ''])}
              onQuitar={ri => conRenglones(gi, grupo.renglones.filter((_, j) => j !== ri))}
              onBorrarGrupo={() => alternar(grupo.nombre)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
