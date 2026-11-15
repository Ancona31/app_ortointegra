'use client'

/**
 * El interruptor del recordatorio automático por correo (tanda H, punto 9 de
 * Angel), en «Plazos y recordatorios». APAGADO de fábrica
 * (`agenda_ajustes.recordatorio_encendido`, migración `20261120120000`).
 * Encendido, la tarea programada manda un correo a cada paciente con correo
 * registrado, las horas antes de su cita que diga el ajuste. Apagado, no
 * manda ninguno. El código y el comprobante de la reserva por enlace y la
 * confirmación que el personal manda con su botón NO dependen de esto.
 *
 * Se guarda al pulsarlo (`PATCH /api/me/ajustes-agenda`), no con «Guardar
 * ajustes»: es un interruptor. Sólo lo cambia quien administra la clínica
 * (lo decide el servidor y la RLS; aquí sólo se deshabilita). `inicial ===
 * null` = no se pudo leer (p. ej. la base aún no tiene la columna): se enseña
 * apagado y deshabilitado, con la razón.
 */
import { useId, useState } from 'react'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { useToast } from '@/components/ui/Toast'

interface Props {
  inicial: boolean | null
  puedeEditar: boolean
  /** Las horas del ajuste, para decirlas en la frase. */
  horas: number | null
}

async function guardar(valor: boolean): Promise<boolean | string> {
  try {
    const res = await fetch('/api/me/ajustes-agenda', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordatorio_encendido: valor }),
    })
    if (res.status === 503) return 'Esta opción todavía no está disponible en este servidor'
    if (!res.ok) return await leerMotivoError(res, 'No se pudo guardar el recordatorio')
    const j: unknown = await res.json().catch(() => null)
    return j && typeof j === 'object' && 'recordatorio_encendido' in j && typeof j.recordatorio_encendido === 'boolean'
      ? j.recordatorio_encendido : valor
  } catch {
    return 'No se pudo guardar el recordatorio'
  }
}

export default function InterruptorRecordatorio({ inicial, puedeEditar, horas }: Props) {
  const [encendido, setEncendido] = useState(inicial === true)
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()
  const id = useId()
  const disponible = inicial !== null
  const cuando = horas === null ? 'las horas que digas abajo' : `${horas} ${horas === 1 ? 'hora' : 'horas'}`

  async function cambiar(): Promise<void> {
    setGuardando(true)
    const r = await guardar(!encendido)
    setGuardando(false)
    if (typeof r === 'string') { toast.error(r); return }
    setEncendido(r)
    toast.success(r ? 'Recordatorio automático encendido' : 'Recordatorio automático apagado')
  }

  return (
    <div className="flex items-start justify-between gap-[var(--ag-4)] rounded-[var(--ag-r-btn)] border border-[var(--ag-border-card)] p-[var(--ag-4)]">
      <div className="min-w-0 flex flex-col gap-[var(--ag-1)]">
        <p id={`${id}-t`} className="text-sm font-semibold text-[var(--ag-text)]">Recordatorio automático por correo</p>
        <p id={`${id}-d`} className="text-sm text-[var(--ag-muted)]">
          {disponible
            ? `Si lo enciendes, se enviará un correo a cada paciente con correo registrado, ${cuando} antes de su cita. Apagado (como viene de fábrica), no se envía ninguno.`
            : 'No disponible todavía en este servidor.'}
        </p>
        <p className="text-sm text-[var(--ag-muted)]">
          No cambia los demás correos: el código y el comprobante de la reserva por enlace, y la confirmación que se manda con su botón, salen siempre.
        </p>
      </div>
      <button type="button" role="switch" aria-checked={encendido} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}
        disabled={!puedeEditar || !disponible || guardando} onClick={() => void cambiar()}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border disabled:opacity-50 ${encendido
          ? 'border-[var(--ag-control-primario-border)] bg-[#1e5fa8]'
          : 'border-[var(--ag-control-border)] bg-[var(--ag-control-bg)]'}`}>
        <span aria-hidden="true" className={`absolute left-0.5 h-5 w-5 rounded-full shadow transition-transform duration-[var(--ag-dur-micro)] ease-[var(--ag-ease)] motion-reduce:transition-none ${encendido
          ? 'translate-x-5 bg-white' : 'translate-x-0 bg-[var(--ag-control-border)]'}`} />
      </button>
    </div>
  )
}
