'use client'

/**
 * El interruptor del correo A LA CLÍNICA por cada reserva nueva por enlace
 * (tanda I, punto 20 de Angel), en «Plazos y recordatorios», debajo del del
 * recordatorio. APAGADO de fábrica (`agenda_ajustes.correo_reserva_clinica`,
 * migración `20261121150000`). Encendido, cada reserva nueva por enlace (y
 * cada reagendado del paciente) manda un correo a los administradores de la
 * clínica con nombre, fecha, hora, médico y consultorio; nada clínico.
 *
 * ⚠️ COPIA DELIBERADA de `InterruptorRecordatorio` (CLAUDE.md, protocolo 4:
 * dos interruptores no justifican un componente genérico). Mismo contrato: se
 * guarda al pulsarlo (`PATCH /api/me/ajustes-agenda`), sólo lo cambia quien
 * administra la clínica, `inicial === null` = no disponible en esta base.
 */
import { useId, useState } from 'react'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { useToast } from '@/components/ui/Toast'

interface Props {
  inicial: boolean | null
  puedeEditar: boolean
}

async function guardar(valor: boolean): Promise<boolean | string> {
  try {
    const res = await fetch('/api/me/ajustes-agenda', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo_reserva_clinica: valor }),
    })
    if (res.status === 503) return 'Esta opción todavía no está disponible en este servidor'
    if (!res.ok) return await leerMotivoError(res, 'No se pudo guardar el aviso por correo')
    const j: unknown = await res.json().catch(() => null)
    return j && typeof j === 'object' && 'correo_reserva_clinica' in j && typeof j.correo_reserva_clinica === 'boolean'
      ? j.correo_reserva_clinica : valor
  } catch {
    return 'No se pudo guardar el aviso por correo'
  }
}

export default function InterruptorCorreoClinica({ inicial, puedeEditar }: Props) {
  const [encendido, setEncendido] = useState(inicial === true)
  const [guardando, setGuardando] = useState(false)
  const toast = useToast()
  const id = useId()
  const disponible = inicial !== null

  async function cambiar(): Promise<void> {
    setGuardando(true)
    const r = await guardar(!encendido)
    setGuardando(false)
    if (typeof r === 'string') { toast.error(r); return }
    setEncendido(r)
    toast.success(r ? 'Aviso por correo de cada reserva encendido' : 'Aviso por correo de cada reserva apagado')
  }

  return (
    <div data-interruptor-correo-clinica=""
      className="flex items-start justify-between gap-[var(--ag-4)] rounded-[var(--ag-r-btn)] border border-[var(--ag-border-card)] p-[var(--ag-4)]">
      <div className="min-w-0 flex flex-col gap-[var(--ag-1)]">
        <p id={`${id}-t`} className="text-sm font-semibold text-[var(--ag-text)]">Avisar por correo de cada reserva</p>
        <p id={`${id}-d`} className="text-sm text-[var(--ag-muted)]">
          {disponible
            ? 'Si lo enciendes, los administradores de la clínica reciben un correo cada vez que un paciente reserva o reagenda por enlace. Apagado (como viene de fábrica), no se envía ninguno.'
            : 'No disponible todavía en este servidor.'}
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
