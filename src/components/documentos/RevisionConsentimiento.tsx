'use client'

/**
 * La revisión antes de firmar (maqueta `consentimiento.html`, aprobada): todo el
 * documento en pares «rótulo — valor», lo que falte en rojo, el orden de
 * quienes firmarán y las dos vías al mismo nivel. Sólo presenta: las acciones
 * —guardar, firmar en el dispositivo, imprimir para papel— viven en el pie del
 * formulario, que es quien conoce la fila.
 */

import type { ReactElement } from 'react'
import { ChevronLeft } from 'lucide-react'

export interface FilaRevision { etiqueta: string; valor: string; nota?: string }
export interface FirmanteRevision { nombre: string; rol: string }

interface Props {
  filas: readonly FilaRevision[]
  firmantes: readonly FirmanteRevision[]
  /** Sin conexión no se firma en el dispositivo: la segunda vía no se ofrece. */
  conDispositivo: boolean
  aviso: string
  onVolver: () => void
  onEditarFirmantes: () => void
}

export default function RevisionConsentimiento(p: Props): ReactElement {
  return (
    <div className="sp-ci-rev">
      <button type="button" onClick={p.onVolver} className="k-b k-b-texto sp-ci-volver">
        <ChevronLeft size={16} aria-hidden="true" /> Seguir editando
      </button>
      <h2 id="consentimiento-revision" tabIndex={-1} className="sp-ci-sec">Revisión antes de firmar</h2>
      <dl className="sp-ci-dl">
        {p.filas.map(f => (
          <div key={f.etiqueta} className="sp-ci-dl-f">
            <dt>{f.etiqueta}</dt>
            <dd data-falta={f.valor.trim() === '' || undefined}>
              {f.valor.trim() || 'Falta'}
              {f.nota && <span className="sp-ci-dl-nota">{f.nota}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <h2 className="sp-ci-sec">Firmarán, en este orden</h2>
      <div className="sp-ci-orden">
        <ol>
          {p.firmantes.map((f, i) => (
            <li key={`${f.rol}-${i}`}><b>{i + 1}. {f.nombre}</b><span>{f.rol}</span></li>
          ))}
        </ol>
        <p className="sp-ci-ayuda">
          ¿Cambió alguien?{' '}
          <button type="button" onClick={p.onEditarFirmantes} className="sp-ci-enlace">Editar quién firma y los testigos</button>.
          {' '}A cada uno se le preguntará si trae su identificación.
        </p>
      </div>
      {p.aviso && <p className="sp-ci-aviso" role="status">{p.aviso}</p>}
      <h2 className="sp-ci-sec">Cómo se va a firmar</h2>
      <div className="sp-ci-orden">
        <ul>
          {p.conDispositivo && (
            <li><b>En este dispositivo</b><span>Con el dedo, uno por uno. Queda sellado con las firmas.</span></li>
          )}
          <li><b>En papel</b><span>Se imprime sin firmas y se firma a mano, como hoy.</span></li>
        </ul>
      </div>
    </div>
  )
}
