'use client'

/**
 * src/components/agenda/BotonBloquearHorario.tsx
 *
 * Tanda L (L1, punto 8 de Angel) · La ÚNICA entrada para crear un bloqueo de
 * horario: un candado junto a la campana, en la barra de escritorio y en la
 * banda del teléfono. Abre el modal de bloqueo que ya existía (`ModalBloqueo`).
 * Sólo con la v2 (quien lo pinta lo decide). Va HERMANO de la campana, no
 * dentro: `CampanaAgenda` no se toca (L5 le añade su globo de cuenta). Las
 * clases son las mismas que las de la campana para que los dos botones midan
 * y se vean igual en cada sitio.
 */
import type { ReactElement } from 'react'
import { Lock } from 'lucide-react'

interface Props {
  /** En la banda del teléfono (`true`) o en la barra de escritorio. */
  enBanda: boolean
  alPulsar: () => void
}

export default function BotonBloquearHorario({ enBanda, alPulsar }: Props): ReactElement {
  return (
    <button type="button" data-bloquear-horario=""
      className={enBanda ? 'ag-banda-movil-ctrl ag-banda-movil-ctrl--marco' : 'ag-herramienta'}
      aria-label="Bloquear horario" title="Bloquear horario" aria-haspopup="dialog" onClick={alPulsar}>
      <Lock size={enBanda ? 18 : 16} aria-hidden="true" />
    </button>
  )
}
