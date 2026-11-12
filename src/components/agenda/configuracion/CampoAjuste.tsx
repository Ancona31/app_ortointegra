/**
 * Un ajuste de la agenda (§2) en la pantalla de configuración: etiqueta,
 * número y unidad, con los límites a la vista. En solo lectura (P7) el campo
 * va deshabilitado, no escondido: quien no administra ve el valor vigente.
 */
import { ETIQUETAS_AJUSTES_AGENDA, LIMITES_AJUSTES_AGENDA, type CampoAjusteAgenda } from '@/lib/agenda/ajustesAgenda'

interface Props {
  campo: CampoAjusteAgenda
  valor: string
  deshabilitado: boolean
  onCambio: (valor: string) => void
}

export default function CampoAjuste({ campo, valor, deshabilitado, onCambio }: Props) {
  const { nombre, unidad } = ETIQUETAS_AJUSTES_AGENDA[campo]
  const { min, max } = LIMITES_AJUSTES_AGENDA[campo]
  const id = `ajuste-${campo}`
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--ag-text)]">{nombre}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={valor}
          disabled={deshabilitado}
          onChange={e => onCambio(e.target.value)}
          aria-describedby={`${id}-rango`}
          className="w-24 px-2 py-1.5 text-sm rounded-lg border border-[var(--ag-border-card)] bg-[var(--ag-surface)] text-[var(--ag-text)] disabled:opacity-60"
        />
        <span className="text-sm text-[var(--ag-muted)]">{unidad}</span>
      </div>
      <p id={`${id}-rango`} className="text-xs text-[var(--ag-muted)]">De {min} a {max}.</p>
    </div>
  )
}
