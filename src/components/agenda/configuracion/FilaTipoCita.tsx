/**
 * Un tipo de cita en la lista de la pantalla de configuración (P5). El color
 * es sólo una marca aquí y en el selector: nunca sustituye al color del estado
 * en la tarjeta de la agenda.
 */
import type { TipoCita } from '@/lib/agenda/tiposCita'
import { BOTON_FILA } from '@/components/agenda/configuracion/clasesConfig'

interface Props {
  tipo: TipoCita
  /** «Toda la clínica» o el nombre del médico. */
  ambito: string
  /** `null` = solo lectura: sin botones. */
  acciones: { onEditar: () => void; onActivo: (activo: boolean) => void; ocupado: boolean } | null
}

export default function FilaTipoCita({ tipo, ambito, acciones }: Props) {
  return (
    <li className="flex min-h-11 flex-wrap items-center gap-x-[var(--ag-3)] gap-y-[var(--ag-1)] py-[var(--ag-1-5)]">
      <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border border-[var(--ag-border-card)]"
        style={{ background: tipo.color ? `var(--ag-evento-${tipo.color})` : 'transparent' }} />
      <span className={`text-sm font-medium ${tipo.activo ? 'text-[var(--ag-text)]' : 'text-[var(--ag-muted)] line-through'}`}>{tipo.nombre}</span>
      <span className="text-sm text-[var(--ag-muted)] tabular-nums">{tipo.duracion_min} min</span>
      <span className="text-sm text-[var(--ag-muted)]">· {ambito}</span>
      {!tipo.activo && <span className="rounded-full bg-[var(--ag-bg-app)] px-2 py-0.5 text-xs text-[var(--ag-muted)]">Archivado</span>}
      {acciones && (
        <span className="ml-auto flex gap-[var(--ag-1)]">
          {tipo.activo && (
            <button type="button" onClick={acciones.onEditar} disabled={acciones.ocupado}
              className={BOTON_FILA} aria-label={`Editar ${tipo.nombre}`}>Editar</button>
          )}
          <button type="button" onClick={() => acciones.onActivo(!tipo.activo)} disabled={acciones.ocupado}
            className={BOTON_FILA} aria-label={`${tipo.activo ? 'Archivar' : 'Reactivar'} ${tipo.nombre}`}>
            {tipo.activo ? 'Archivar' : 'Reactivar'}
          </button>
        </span>
      )}
    </li>
  )
}
