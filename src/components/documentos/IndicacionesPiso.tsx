'use client'

/**
 * Indicaciones de ingreso a piso — HOJA DE ÓRDENES (maqueta
 * `internamiento.html`, aprobada por el dueño; `GUIA_FORM_INTERNAMIENTO.md` §3).
 *
 * POR QUÉ DEJA DE SER UN TEXTAREA (y sigue sin serlo)
 *
 * En diez documentos de producción hay cuatro sintaxis distintas —numeración
 * con punto, con punto y guion, prosa corrida y numeradas con guiones
 * colgando—, ninguna coincide con la que el sistema espera, y cuatro de los
 * diez son basura de prueba. Los reales miden entre 97 y 225 caracteres: tres o
 * cuatro indicaciones. El texto libre es lo que produjo las cuatro sintaxis.
 *
 * POR QUÉ DEJA DE TENER FICHAS PARA «ENCENDER» GRUPOS
 *
 * La queja del dueño: mostrar cada parte (dieta, soluciones…) a golpe de ficha
 * era torpe y lento. Ahora los cuatro grupos fijos están SIEMPRE, en su orden
 * clínico, con su renglón listo; se escribe como en una hoja: Enter crea el
 * siguiente renglón del grupo, Tab salta al siguiente grupo, Retroceso en un
 * renglón vacío lo quita, ↑/↓ recorren y pegar varias líneas las reparte.
 * Lo guardado NO cambia: un grupo sin texto no se guarda ni se imprime (eso lo
 * hace `gruposDeHoja`, en `internamientoCompacto.ts`).
 *
 * ⚠ **LOS DOCUMENTOS YA EMITIDOS NO SE CONVIERTEN.** Se quedan con su cadena y
 * el analizador de 2.J (`src/lib/pdf/v2/analizadorBloques.ts`) sigue vivo para
 * leerlos. Este control no lee texto libre: solo lo produce, y lo produce en la
 * única sintaxis que ese analizador reconoce (ver `textoIndicaciones`).
 */

import { useState, type ClipboardEvent, type KeyboardEvent, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { Plus, X } from 'lucide-react'
import {
  ejemploDe, esFijo, lineasPegadas, pegarEnRenglones, validarNombreGrupo,
  type GrupoIndicaciones,
} from '@/components/documentos/internamientoCompacto'

export type { GrupoIndicaciones } from '@/components/documentos/internamientoCompacto'

const idRenglon = (gi: number, ri: number): string => `internamiento-renglon-${gi}-${ri}`
const idNombre = (gi: number): string => `internamiento-grupo-${gi}`

/** Enfoca un campo ya pintado y deja el cursor al final. */
function enfocar(id: string): void {
  const el = document.getElementById(id)
  if (!(el instanceof HTMLInputElement)) return
  el.focus()
  el.setSelectionRange(el.value.length, el.value.length)
}

interface Props {
  /** La hoja: los cuatro fijos siempre, y los propios detrás. */
  hoja: readonly GrupoIndicaciones[]
  onChange: (hoja: GrupoIndicaciones[]) => void
}

export default function IndicacionesPiso({ hoja, onChange }: Props): ReactElement {
  /** Nombre de grupo propio que se está escribiendo; se confirma al salir. */
  const [editando, setEditando] = useState<{ gi: number; texto: string } | null>(null)

  /** Cambia la hoja y, ya pintada, enfoca. */
  function cambiar(nueva: GrupoIndicaciones[], foco?: string): void {
    flushSync(() => onChange(nueva))
    if (foco) enfocar(foco)
  }
  const conRenglones = (gi: number, renglones: string[]): GrupoIndicaciones[] =>
    hoja.map((g, i) => (i === gi ? { ...g, renglones } : g))

  /** El primer campo de un grupo: el nombre si aún no lo tiene, si no su último renglón. */
  function entrarEn(gi: number): string {
    const g = hoja[gi]
    return g.nombre === '' ? idNombre(gi) : idRenglon(gi, g.renglones.length - 1)
  }

  function teclaRenglon(e: KeyboardEvent<HTMLInputElement>, gi: number, ri: number): void {
    const g = hoja[gi]
    const valor = e.currentTarget.value
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      // Sobre un renglón vacío no nace otro: no se apilan renglones en blanco.
      if (valor.trim() === '') return
      const rs = [...g.renglones]
      rs.splice(ri + 1, 0, '')
      cambiar(conRenglones(gi, rs), idRenglon(gi, ri + 1))
    } else if (e.key === 'Backspace' && valor === '' && g.renglones.length > 1) {
      e.preventDefault()
      cambiar(conRenglones(gi, g.renglones.filter((_, j) => j !== ri)), idRenglon(gi, Math.max(0, ri - 1)))
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const abajo = e.key === 'ArrowDown'
      if (abajo ? ri < g.renglones.length - 1 : ri > 0) { e.preventDefault(); enfocar(idRenglon(gi, ri + (abajo ? 1 : -1))) }
      else if (abajo && gi < hoja.length - 1) { e.preventDefault(); enfocar(entrarEn(gi + 1)) }
      else if (!abajo && gi > 0) { e.preventDefault(); enfocar(idRenglon(gi - 1, hoja[gi - 1].renglones.length - 1)) }
    } else if (e.key === 'Tab' && !e.shiftKey && !e.altKey && gi < hoja.length - 1) {
      // Tab salta al siguiente grupo; un renglón vacío que sobra se va.
      e.preventDefault()
      const sobra = valor.trim() === '' && g.renglones.length > 1
      const nueva = sobra ? conRenglones(gi, g.renglones.filter((_, j) => j !== ri)) : [...hoja]
      cambiar(nueva, entrarEn(gi + 1))
    }
  }

  function pegar(e: ClipboardEvent<HTMLInputElement>, gi: number, ri: number): void {
    const lineas = lineasPegadas(e.clipboardData.getData('text'))
    if (lineas.length < 2) return
    e.preventDefault()
    const { renglones, ultimo } = pegarEnRenglones(hoja[gi].renglones, ri, lineas)
    cambiar(conRenglones(gi, renglones), idRenglon(gi, ultimo))
  }

  // ── Grupos propios ──────────────────────────────────────────────────────
  function otroGrupo(): void {
    const vacio = hoja.findIndex(g => g.nombre === '')
    if (vacio !== -1) { enfocar(idNombre(vacio)); return }
    setEditando({ gi: hoja.length, texto: '' })
    cambiar([...hoja, { nombre: '', renglones: [''] }], idNombre(hoja.length))
  }

  function quitarGrupo(gi: number): void {
    setEditando(null)
    cambiar(hoja.filter((_, i) => i !== gi))
  }

  /**
   * Confirma el nombre que se escribe. Vacío o repetido no se acepta —un nombre
   * repetido sería el mismo grupo dos veces en la lámina, como hoy—: con el
   * teclado se queda en el campo; al salir con el puntero vuelve al anterior, y
   * un grupo nuevo sin nombre ni renglones desaparece.
   */
  function confirmarNombre(gi: number, alSalir: boolean): boolean {
    if (!editando || editando.gi !== gi) return true
    const estado = validarNombreGrupo(hoja, gi, editando.texto)
    if (estado === 'ok') {
      setEditando(null)
      cambiar(hoja.map((g, i) => (i === gi ? { ...g, nombre: editando.texto.trim() } : g)))
      return true
    }
    if (!alSalir) return false
    setEditando(null)
    const g = hoja[gi]
    if (g.nombre === '' && g.renglones.every(r => r.trim() === '')) quitarGrupo(gi)
    return false
  }

  function teclaNombre(e: KeyboardEvent<HTMLInputElement>, gi: number): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      const g = hoja[gi]
      if (g.nombre === '' && g.renglones.every(r => r.trim() === '')) { quitarGrupo(gi); return }
      setEditando(null)
      return
    }
    if (e.key !== 'Enter' && !(e.key === 'Tab' && !e.shiftKey)) return
    e.preventDefault()
    if (confirmarNombre(gi, false)) enfocar(idRenglon(gi, 0))
  }

  const errorNombre = editando && editando.texto.trim() !== ''
    && validarNombreGrupo(hoja, editando.gi, editando.texto) === 'repetido'

  return (
    <div className="sp-int-piso">
      {hoja.map((g, gi) => {
        const cuenta = g.renglones.filter(r => r.trim() !== '').length
        const fijo = esFijo(g.nombre)
        const nombreVisible = g.nombre || 'grupo nuevo'
        const conError = errorNombre && editando?.gi === gi
        return (
          <div key={gi} className="sp-int-gp" data-grupo={g.nombre || undefined}>
            <div className="sp-int-gn">
              {fijo ? (
                <span className="sp-int-gn-t">
                  {g.nombre}
                  {cuenta > 0 && <span className="sp-int-gn-c" aria-label={`${cuenta} ${cuenta === 1 ? 'renglón' : 'renglones'}`}>{cuenta}</span>}
                </span>
              ) : (
                <input id={idNombre(gi)} type="text" autoComplete="off"
                  value={editando?.gi === gi ? editando.texto : g.nombre}
                  onFocus={() => setEditando({ gi, texto: g.nombre })}
                  onChange={e => setEditando({ gi, texto: e.target.value })}
                  onBlur={() => confirmarNombre(gi, true)}
                  onKeyDown={e => teclaNombre(e, gi)}
                  aria-label="Nombre del grupo" placeholder="Nombre del grupo"
                  aria-invalid={conError || undefined}
                  aria-describedby={conError ? 'internamiento-grupo-error' : undefined}
                  className="sp-int-gn-fi" />
              )}
              {!fijo && cuenta > 0 && <span className="sp-int-gn-c" aria-label={`${cuenta} ${cuenta === 1 ? 'renglón' : 'renglones'}`}>{cuenta}</span>}
              {!fijo && (
                <button type="button" onClick={() => quitarGrupo(gi)}
                  aria-label={`Quitar grupo ${nombreVisible}`} className="k-b k-b-icono sp-int-gn-x">
                  <X aria-hidden="true" />
                </button>
              )}
              {conError && (
                <p id="internamiento-grupo-error" role="alert" className="sp-int-gn-err">Ya hay un grupo con ese nombre.</p>
              )}
            </div>
            <div className="sp-int-rs">
              {g.renglones.map((r, ri) => (
                <div key={ri} className="sp-int-rg">
                  <input id={idRenglon(gi, ri)} type="text" value={r} autoComplete="off"
                    onChange={e => onChange(conRenglones(gi, g.renglones.map((x, j) => (j === ri ? e.target.value : x))))}
                    onKeyDown={e => teclaRenglon(e, gi, ri)}
                    onPaste={e => pegar(e, gi, ri)}
                    aria-label={`Renglón ${ri + 1} de ${nombreVisible}`}
                    placeholder={ejemploDe(g.nombre, ri)}
                    className="sp-int-rg-fi" />
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div className="sp-int-pisopie">
        <button type="button" onClick={otroGrupo} className="k-b k-b-texto">
          <Plus aria-hidden="true" size={16} /> Otro grupo
        </button>
        <span className="sp-int-ayuda">La numeración y los guiones los pone el documento.</span>
      </div>
    </div>
  )
}
