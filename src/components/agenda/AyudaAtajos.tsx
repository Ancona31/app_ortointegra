'use client'

/**
 * src/components/agenda/AyudaAtajos.tsx
 *
 * La ayuda de los atajos de teclado (bloque F, F3.5, detrás del interruptor):
 * la tabla de `atajosAgenda.ts` y el interruptor «Usar atajos de una tecla»
 * que pide WCAG 2.1.4. Se abre con `?`. Archivo nuevo de F3, sin enchufar
 * todavía: lo monta `AgendaCliente` en la ronda de después de E.
 *
 * Accesibilidad: `role="dialog"` con `aria-modal`, nombre por su título, foco
 * atrapado, Escape y devolución del foco — todo de `useDialogoModal`, el mismo
 * de los modales de la agenda. El foco entra en el interruptor, que es lo único
 * que se puede cambiar aquí.
 */
import { useId, type ReactElement } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { ATAJOS, type Atajo } from '@/lib/agenda/atajosAgenda'

interface Props {
  encendidos: boolean
  alCambiarEncendidos: (encendidos: boolean) => void
  alCerrar: () => void
}

function FilaAtajo({ atajo }: { atajo: Atajo }): ReactElement {
  return (
    <>
      <dt>
        {atajo.teclas.map((t, i) => (
          <span key={t}>{i > 0 && ' o '}<kbd>{t}</kbd></span>
        ))}
      </dt>
      <dd>{atajo.descripcion}</dd>
    </>
  )
}

export default function AyudaAtajos({ encendidos, alCambiarEncendidos, alCerrar }: Props): ReactElement {
  const { montarPanel, alPulsarTecla } = useDialogoModal(alCerrar)
  const idTitulo = useId()
  return (
    <Portal>
      <div className="ag-capa-velo" aria-hidden="true" onClick={alCerrar} />
      <div
        ref={montarPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alPulsarTecla}
        className="ag-capa ag-capa--centro"
      >
        <div className="ag-capa-cab">
          <h2 id={idTitulo} className="ag-capa-titulo">Atajos de teclado</h2>
          <button type="button" className="ag-capa-cerrar" aria-label="Cerrar" onClick={alCerrar}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <dl className="ag-atajos">
          {ATAJOS.map(a => <FilaAtajo key={a.accion} atajo={a} />)}
        </dl>
        <label className="ag-capa-interruptor">
          <input
            type="checkbox"
            role="switch"
            checked={encendidos}
            aria-checked={encendidos}
            autoFocus
            onChange={e => alCambiarEncendidos(e.target.checked)}
          />
          Usar atajos de una tecla
        </label>
      </div>
    </Portal>
  )
}
