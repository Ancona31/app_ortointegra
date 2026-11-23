'use client'

/**
 * El formulario de un tipo de cita (P5), para el alta y para la edición. Sólo
 * recoge lo escrito: la validación es la de `CrearTipoCitaSchema` /
 * `EditarTipoCitaSchema`, que aplica quien lo monta antes de enviar, y la del
 * servidor. El ámbito (toda la clínica o un médico) sólo se elige en el alta:
 * no se edita (ver `EditarTipoCitaSchema`).
 * Tanda L (puntos 12 y 17): campos, etiquetas y botones de la configuración nueva (`estilosConfig`).
 * B13 · AG9 (maqueta `ag-config`): campos del kit apilados en el teléfono y en dos columnas en ancho; el botón
 * que guarda es el único relleno de la pantalla mientras el formulario está abierto. `enLista`: es una fila de
 * la lista de tipos (con sus rellenos).
 */
import { useId, useState, type FormEvent } from 'react'
import { COLORES_EVENTO, type ColorEvento } from '@/lib/appointments'
import { COLOR_ETIQUETA } from '@/lib/agenda/tarjetasAgenda'
import { LIMITES_TIPO_CITA } from '@/lib/agenda/tiposCita'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { MedicoConfig } from '@/lib/configApp'
import { BOTON_AZUL, BOTON_BLANCO, CAMPO_NUEVO, ERROR, SELECTOR } from '@/components/agenda/configuracion/estilosConfig'

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
  /** Va como una fila de la lista de tipos: con los rellenos de la fila. */
  enLista?: boolean
}

const CAMPO = CAMPO_NUEVO
/** Etiqueta encima de un campo (`.k-etiqueta`: 13 · 600, `--tinta2`). */
const ETIQUETA = 'k-etiqueta flex min-w-0 flex-col gap-[4px]'

export default function FormTipoCita({ inicial, medicos, textoBoton, onGuardar, onCancelar, enLista }: Props) {
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
    <form onSubmit={enviar} noValidate className={`grid grid-cols-1 gap-[12px] ih:grid-cols-2 iv:grid-cols-2 esc:grid-cols-2 ${enLista
      ? 'px-[16px] py-[14px] ih:px-[20px] iv:px-[20px] esc:px-[20px]' : ''}`}>
      <label className={ETIQUETA} htmlFor={`${id}-nombre`}>Nombre
        <input id={`${id}-nombre`} className={CAMPO} value={datos.nombre} maxLength={LIMITES_TIPO_CITA.nombreMax}
          onChange={e => poner({ nombre: e.target.value })} />
      </label>
      <label className={ETIQUETA} htmlFor={`${id}-duracion`}>Duración (min)
        <input id={`${id}-duracion`} className={CAMPO} type="number" inputMode="numeric" value={datos.duracion}
          min={LIMITES_TIPO_CITA.duracionMin} max={LIMITES_TIPO_CITA.duracionMax} step={LIMITES_TIPO_CITA.pasoDuracion}
          onChange={e => poner({ duracion: e.target.value })} />
      </label>
      <label className={ETIQUETA} htmlFor={`${id}-color`}>Color
        <select id={`${id}-color`} className={SELECTOR} value={datos.color}
          onChange={e => poner({ color: COLORES_EVENTO.find(c => c === e.target.value) ?? '' })}>
          <option value="">Sin color</option>
          {COLORES_EVENTO.map(c => <option key={c} value={c}>{COLOR_ETIQUETA[c]}</option>)}
        </select>
      </label>
      {medicos && (
        <label className={ETIQUETA} htmlFor={`${id}-ambito`}>Para
          <select id={`${id}-ambito`} className={SELECTOR} value={datos.medicoId} onChange={e => poner({ medicoId: e.target.value })}>
            <option value="">Toda la clínica</option>
            {medicos.map(m => <option key={m.id} value={m.id}>{componerNombreMedicoCompleto(m)}</option>)}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-[8px] ih:col-span-2 iv:col-span-2 esc:col-span-2">
        <button type="submit" disabled={guardando} className={BOTON_AZUL}>
          {guardando ? 'Guardando…' : textoBoton}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className={BOTON_BLANCO}>
            Cancelar
          </button>
        )}
      </div>
      {error && <p role="alert" className={`${ERROR} ih:col-span-2 iv:col-span-2 esc:col-span-2`}>{error}</p>}
    </form>
  )
}
