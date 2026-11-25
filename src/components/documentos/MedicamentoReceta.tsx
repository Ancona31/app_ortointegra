'use client'

import { useLayoutEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import type { MedicamentoDB } from '@/data/medicamentos'
import BuscadorMedicamento from '@/components/documentos/BuscadorMedicamento'
import SelectorVia from '@/components/documentos/SelectorVia'
import { anadirFrase, FRASES, type Falta, type MedicamentoConVia } from '@/components/documentos/recetaCompacta'

type CampoTexto = 'nombre_comercial' | 'principio_activo' | 'presentacion' | 'via_administracion' | 'indicacion'

interface Props {
  numero: number
  clave: number
  med: MedicamentoConVia
  /** «Dosis sugerida» del catálogo, como ficha insertable. Vacía si no vino del catálogo. */
  dosisSugerida: string
  /** Faltas a señalar (vacío hasta el primer intento de imprimir). */
  faltas: readonly Falta[]
  puedeQuitar: boolean
  onCampo: (campo: CampoTexto, valor: string) => void
  onElegir: (fila: MedicamentoDB) => void
  onQuitar: () => void
  onAgregar: () => void
  onEnfocar: (campo: 'principio' | 'indicacion') => void
}

/** Ajusta el alto del área de texto a su contenido: una línea que crece, sin tirador. */
function ajustarAlto(t: HTMLTextAreaElement | null) {
  if (!t) return
  t.style.height = 'auto'
  t.style.height = `${t.scrollHeight}px`
}

/**
 * Medicamento ABIERTO de la receta compacta. Orden de Tab: buscador →
 * genérico → presentación → vía → indicaciones. La papelera y las fichas están
 * fuera del Tab (tabindex -1): el teclado no tropieza con ellas al capturar.
 * Ctrl/⌘+Enter pliega este y abre uno nuevo (lo hace el formulario).
 */
export default function MedicamentoReceta(p: Props) {
  const { numero, clave, med, dosisSugerida, faltas } = p
  const indRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { ajustarAlto(indRef.current) }, [med.indicacion])
  const falta = (f: Falta) => faltas.includes(f)
  const nombre = med.nombre_comercial.trim()

  function insertar(frase: string) {
    p.onCampo('indicacion', anadirFrase(med.indicacion, frase))
    p.onEnfocar('indicacion')
  }

  return (
    <div className="sp-rx-ed" data-receta-abierto={numero}
      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); p.onAgregar() } }}>
      <div className="sp-rx-cab">
        <span className="sp-rx-num sp-rx-num--on" aria-hidden="true">{numero}</span>
        <h3 className="sp-rx-cab-t">Medicamento {numero}</h3>
        <button type="button" tabIndex={-1} onClick={p.onQuitar} disabled={!p.puedeQuitar}
          aria-label={nombre ? `Eliminar ${nombre}` : `Eliminar medicamento ${numero}`}
          className="k-b k-b-icono sp-rx-quitar">
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <div className={`sp-rx-campo sp-rx-campo--buscar ${falta('comercial') ? 'sp-rx-campo--falta' : ''}`}>
        <label htmlFor={`receta-nombre-${clave}`} className="sp-rx-rot">
          Comercial <span aria-hidden="true">*</span><span className="sr-only">obligatorio</span>
        </label>
        <BuscadorMedicamento id={`receta-nombre-${clave}`} valor={med.nombre_comercial}
          onEscribir={v => p.onCampo('nombre_comercial', v)} onElegir={p.onElegir}
          onLibre={() => p.onEnfocar('principio')} invalido={falta('comercial')} />
      </div>

      <div className="sp-rx-par">
        <div className={`sp-rx-campo ${falta('generico') ? 'sp-rx-campo--falta' : ''}`}>
          <label htmlFor={`receta-principio-${clave}`} className="sp-rx-rot">
            Genérico <span aria-hidden="true">*</span><span className="sr-only">obligatorio</span>
          </label>
          <input id={`receta-principio-${clave}`} type="text" autoComplete="off" value={med.principio_activo ?? ''}
            onChange={e => p.onCampo('principio_activo', e.target.value)} placeholder="Principio activo"
            aria-invalid={falta('generico') || undefined} className="sp-rx-fi" />
        </div>
        <div className="sp-rx-campo">
          <label htmlFor={`receta-presentacion-${clave}`} className="sp-rx-rot">Presentación</label>
          <input id={`receta-presentacion-${clave}`} type="text" autoComplete="off" value={med.presentacion ?? ''}
            onChange={e => p.onCampo('presentacion', e.target.value)} placeholder="p. ej. Tabletas 500 mg"
            className="sp-rx-fi" />
        </div>
      </div>

      <SelectorVia id={`receta-via-${clave}`} valor={med.via_administracion ?? ''} invalido={falta('via')}
        onCambio={v => { p.onCampo('via_administracion', v); p.onEnfocar('indicacion') }} />

      <div className="sp-rx-campo sp-rx-campo--texto">
        <label htmlFor={`receta-indicacion-${clave}`} className="sp-rx-rot">Indicaciones</label>
        <textarea ref={indRef} id={`receta-indicacion-${clave}`} rows={1} value={med.indicacion}
          onChange={e => p.onCampo('indicacion', e.target.value)}
          placeholder="Tomar 1 tableta cada 8 horas por 7 días" className="sp-rx-fi sp-rx-ta" />
      </div>

      <FichasIndicacion dosisSugerida={dosisSugerida} onInsertar={insertar} />
    </div>
  )
}

/** Fichas fuera del Tab: la dosis sugerida del catálogo y las frases frecuentes. */
function FichasIndicacion({ dosisSugerida, onInsertar }: { dosisSugerida: string; onInsertar: (t: string) => void }) {
  return (
    <div className="sp-rx-fichas" role="group" aria-label="Añadir a las indicaciones">
      {dosisSugerida && (
        <button type="button" tabIndex={-1} onClick={() => onInsertar(dosisSugerida)} className="sp-rx-ficha sp-rx-ficha--sug">
          <span><span aria-hidden="true">＋ </span>{dosisSugerida}</span>
        </button>
      )}
      {FRASES.map(f => (
        <button key={f} type="button" tabIndex={-1} onClick={() => onInsertar(f)} className="sp-rx-ficha">
          <span>{f}</span>
        </button>
      ))}
    </div>
  )
}
