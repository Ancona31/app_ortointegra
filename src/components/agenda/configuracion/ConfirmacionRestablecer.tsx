'use client'

/**
 * El diálogo que confirma «Restablecer configuración de la agenda» (tanda H,
 * punto 10 de Angel): qué se borra, qué NO, y la palabra `RESTABLECER` escrita
 * (la misma que exige `POST /api/agenda/restablecer`, que decide el rol: sólo
 * quien administra la clínica).
 *
 * Tanda J (J5, punto 17): «Empezar de nuevo» de la configuración nueva ES este
 * restablecer —mismas condiciones, misma confirmación—, así que el diálogo se
 * sacó de `ZonaRestablecer` a este archivo, sin cambiarle una letra, para que
 * lo monten las dos pantallas.
 */
import { useId, useState, type FormEvent } from 'react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import { BOTON_BLANCO, CAMPO_NUEVO } from '@/components/agenda/configuracion/estilosConfig'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'

const PALABRA = 'RESTABLECER'

/** El botón rojo de contorno, al alto y la letra de los botones de la configuración nueva (tanda L, punto 12: 48 px, 16 · 700). */
const BOTON_PELIGRO =
  'inline-flex min-h-[48px] sm:min-h-[40px] cursor-pointer items-center justify-center gap-[8px] rounded-[10px] border border-[var(--ag-status-cancelled-text)] bg-[var(--ag-surface)] px-[22px] sm:px-[18px] text-[16px] sm:text-[13px] font-bold text-[var(--ag-status-cancelled-text)] hover:bg-[var(--ag-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'

export const SE_RESTABLECE = [
  'El horario de cada consultorio vuelve al de partida: el horario de la clínica, copiado a cada consultorio.',
  'La duración de la consulta y los tipos de cita se archivan.',
  'Los plazos vuelven a sus valores de fábrica y el recordatorio por correo se apaga.',
  'Los enlaces de reserva se revocan.',
] as const

async function restablecer(): Promise<string | null> {
  try {
    const res = await fetch('/api/agenda/restablecer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmacion: PALABRA }),
    })
    if (res.status === 503) return 'Esta opción todavía no está disponible en este servidor'
    return res.ok ? null : await leerMotivoError(res, 'No se pudo restablecer la configuración')
  } catch {
    return 'No se pudo restablecer la configuración'
  }
}

/** El diálogo de confirmación: qué pasa, qué no, y la palabra escrita. */
export default function ConfirmacionRestablecer({ onCancelar, onHecho }: { onCancelar: () => void; onHecho: () => void }) {
  const { montarPanel, alPulsarTecla } = useDialogoModal(onCancelar)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  async function confirmar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (texto !== PALABRA) return
    setEnviando(true)
    const motivo = await restablecer()
    setEnviando(false)
    if (motivo) { setError(motivo); return }
    onHecho()
  }
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="ag-modal-velo absolute inset-0 bg-black/40" onClick={onCancelar} />
        <div ref={montarPanel} onKeyDown={alPulsarTecla} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`}
          aria-describedby={`${id}-d`} tabIndex={-1}
          className="ag-modal-panel relative flex w-full max-w-md flex-col gap-[var(--ag-3)] rounded-[var(--ag-r-card)] bg-[var(--ag-modal-bg)] p-[var(--ag-5)] focus:outline-none">
          <h2 id={`${id}-t`} className="text-[16px] font-bold text-[var(--ag-text)]">¿Restablecer la configuración de la agenda?</h2>
          <div id={`${id}-d`} className="flex flex-col gap-[var(--ag-2)] text-[14px] text-[var(--ag-text)]">
            <ul className="list-disc pl-5">{SE_RESTABLECE.map(l => <li key={l}>{l}</li>)}</ul>
            <p className="font-semibold text-[var(--ag-status-cancelled-text)]">Los enlaces que ya compartiste con pacientes dejarán de funcionar.</p>
            <p>Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.</p>
          </div>
          <form onSubmit={e => void confirmar(e)} className="flex flex-col gap-[var(--ag-3)]">
            <label htmlFor={`${id}-p`} className="text-[13.5px] sm:text-[13px] font-semibold text-[var(--ag-text)]">Para confirmar, escribe <strong>{PALABRA}</strong></label>
            <input id={`${id}-p`} className={CAMPO_NUEVO} value={texto} onChange={e => setTexto(e.target.value)} autoComplete="off" spellCheck={false} />
            {error && <p role="alert" className="text-[14px] font-semibold text-[var(--ag-status-cancelled-text)]">{error}</p>}
            <div className="flex flex-wrap justify-end gap-[var(--ag-2)]">
              <button type="button" className={BOTON_BLANCO} onClick={onCancelar}>Cancelar</button>
              <button type="submit" className={BOTON_PELIGRO} disabled={texto !== PALABRA || enviando}>
                {enviando ? 'Restableciendo…' : 'Restablecer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}
