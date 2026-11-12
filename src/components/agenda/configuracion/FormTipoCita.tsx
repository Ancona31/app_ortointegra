'use client'

/**
 * El formulario de un tipo de cita (P5), para el alta y para la edición. Sólo
 * recoge lo escrito: la validación es la de `CrearTipoCitaSchema` /
 * `EditarTipoCitaSchema`, que aplica quien lo monta antes de enviar, y la del
 * servidor. El ámbito (toda la clínica o un médico) sólo se elige en el alta:
 * no se edita (ver `EditarTipoCitaSchema`).
 */
import { useId, useState, type FormEvent } from 'react'
import { COLORES_EVENTO, type ColorEvento } from '@/lib/appointments'
import { COLOR_ETIQUETA } from '@/lib/agenda/tarjetasAgenda'
import { LIMITES_TIPO_CITA } from '@/lib/agenda/tiposCita'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { MedicoConfig } from '@/lib/configApp'

export interface DatosTipoCita {
  nombre: string
  duracion: string
  color: ColorEvento | ''
  /** `''` = toda la clínica. */
  medicoId: string
}

interface Props {
  inicial: DatosTipoCita
  /** Sólo el alta enseña el selector de ámbito. */
  medicos: readonly MedicoConfig[] | null
  textoBoton: string
  /** Devuelve el motivo si no se pudo guardar, o `null` si se guardó. */
  onGuardar: (datos: DatosTipoCita) => Promise<string | null>
  onCancelar?: () => void
}

const CAMPO = 'px-2 py-1.5 text-sm rounded-lg border border-[var(--ag-border-card)] bg-[var(--ag-surface)] text-[var(--ag-text)]'

export default function FormTipoCita({ inicial, medicos, textoBoton, onGuardar, onCancelar }: Props) {
  const id = useId()
  const [datos, setDatos] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const poner = (cambio: Partial<DatosTipoCita>) => setDatos(d => ({ ...d, ...cambio }))

  async function enviar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setGuardando(true)
    const motivo = await onGuardar(datos)
    setGuardando(false)
    setError(motivo)
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm text-[var(--ag-text)]" htmlFor={`${id}-nombre`}>Nombre
        <input id={`${id}-nombre`} className={`${CAMPO} w-48`} value={datos.nombre} maxLength={LIMITES_TIPO_CITA.nombreMax}
          onChange={e => poner({ nombre: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--ag-text)]" htmlFor={`${id}-duracion`}>Duración (min)
        <input id={`${id}-duracion`} className={`${CAMPO} w-24`} type="number" inputMode="numeric" value={datos.duracion}
          min={LIMITES_TIPO_CITA.duracionMin} max={LIMITES_TIPO_CITA.duracionMax} step={LIMITES_TIPO_CITA.pasoDuracion}
          onChange={e => poner({ duracion: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[var(--ag-text)]" htmlFor={`${id}-color`}>Color
        <select id={`${id}-color`} className={CAMPO} value={datos.color}
          onChange={e => poner({ color: COLORES_EVENTO.find(c => c === e.target.value) ?? '' })}>
          <option value="">Sin color</option>
          {COLORES_EVENTO.map(c => <option key={c} value={c}>{COLOR_ETIQUETA[c]}</option>)}
        </select>
      </label>
      {medicos && (
        <label className="flex flex-col gap-1 text-sm text-[var(--ag-text)]" htmlFor={`${id}-ambito`}>Para
          <select id={`${id}-ambito`} className={CAMPO} value={datos.medicoId} onChange={e => poner({ medicoId: e.target.value })}>
            <option value="">Toda la clínica</option>
            {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={guardando}
          className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50">
          {guardando ? 'Guardando…' : textoBoton}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="px-3 py-2 rounded-xl text-sm font-medium text-[var(--ag-muted)] hover:bg-[var(--ag-bg-app)]">
            Cancelar
          </button>
        )}
      </div>
      {error && <p role="alert" className="basis-full text-sm font-medium text-red-600">{error}</p>}
    </form>
  )
}
