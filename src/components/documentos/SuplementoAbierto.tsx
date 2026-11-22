'use client'

import { Trash2 } from 'lucide-react'
import BuscadorSuplemento, { type OpcionSuplemento } from '@/components/documentos/BuscadorSuplemento'

type Campo = 'dosis' | 'marca' | 'justificacion'

interface Props {
  numero: number
  clave: number
  /** '' mientras no se ha elegido: entonces se pinta el buscador. */
  nombre: string
  dosis: string
  marca: string
  justificacion: string
  /** Beneficio clínico del catálogo: el «para qué», visible al médico. */
  beneficio: string
  /** Referencia del cálculo por peso; null si el suplemento no dosifica por kilo o no hay peso. */
  calculo: { texto: string; editada: boolean } | null
  conPeso: boolean
  opciones: readonly OpcionSuplemento[]
  invalido: boolean
  puedeQuitar: boolean
  onElegir: (indice: number) => void
  onCampo: (campo: Campo, valor: string) => void
  onUsarSugerida: () => void
  onQuitar: () => void
  onAgregar: () => void
}

const SIGUIENTE: Partial<Record<Campo, Campo>> = { dosis: 'marca', marca: 'justificacion' }

/**
 * Suplemento ABIERTO del plan compacto. Sin elegir, sólo el buscador; elegido,
 * el «para qué», la dosis (calculada por el peso y editable), la marca y la
 * justificación. Enter avanza dosis → marca → justificación; Ctrl/⌘+Enter
 * pliega este y abre uno nuevo (lo hace el formulario). La papelera está fuera
 * del Tab (tabindex −1), como en la receta.
 */
export default function SuplementoAbierto(p: Props) {
  const { numero, clave, nombre } = p
  const id = (c: string) => `suplementacion-${c}-${clave}`

  function alTeclear(campo: Campo, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.shiftKey) return
    e.preventDefault()
    const sig = SIGUIENTE[campo]
    if (sig) document.getElementById(id(sig))?.focus()
  }

  const campo = (c: Campo, rotulo: string, valor: string, placeholder: string) => (
    <div className="sp-rx-campo">
      <label htmlFor={id(c)} className="sp-rx-rot">{rotulo}</label>
      <input id={id(c)} type="text" autoComplete="off" value={valor} placeholder={placeholder}
        onChange={e => p.onCampo(c, e.target.value)} onKeyDown={e => alTeclear(c, e)}
        className={`sp-rx-fi${c === 'dosis' ? ' sp-sup-dosis' : ''}`} />
    </div>
  )

  return (
    <div className="sp-rx-ed" data-suplemento-abierto={numero}
      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); p.onAgregar() } }}>
      <div className="sp-rx-cab">
        <span className="sp-rx-num sp-rx-num--on" aria-hidden="true">{numero}</span>
        <h3 className="sp-rx-cab-t">{nombre || `Suplemento ${numero}`}</h3>
        <button type="button" tabIndex={-1} onClick={p.onQuitar} disabled={!p.puedeQuitar}
          aria-label={nombre ? `Quitar ${nombre}` : `Quitar suplemento ${numero}`}
          className="k-b k-b-icono sp-rx-quitar">
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      {nombre === '' ? (
        <div className={`sp-rx-campo sp-rx-campo--buscar${p.invalido ? ' sp-rx-campo--falta' : ''}`}>
          <label htmlFor={id('buscar')} className="sp-rx-rot">Buscar</label>
          <BuscadorSuplemento id={id('buscar')} opciones={p.opciones} onElegir={p.onElegir} invalido={p.invalido} />
        </div>
      ) : (
        <>
          <p className="sp-sup-benef">{p.beneficio}</p>
          <div className="sp-rx-par">
            {campo('dosis', 'Dosis', p.dosis, p.conPeso ? '' : 'Escribe el peso y se calcula')}
            {campo('marca', 'Marca', p.marca, 'Ej: Nordic Naturals')}
          </div>
          {p.calculo && (
            <p className="sp-sup-calc">
              {p.calculo.texto}
              {p.calculo.editada && (
                <>
                  {' · '}
                  <button type="button" onClick={p.onUsarSugerida} className="sp-link-alt sp-sup-usar">
                    usar la sugerida
                  </button>
                </>
              )}
            </p>
          )}
          {campo('justificacion', 'Justificación', p.justificacion, 'Ej: Vitamina D 18 ng/mL en laboratorio')}
        </>
      )}
    </div>
  )
}
