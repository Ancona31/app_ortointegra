'use client'

/**
 * «Restablecer configuración de la agenda» (tanda H, punto 10 de Angel): la
 * zona de peligro, última pestaña de la configuración, SÓLO para quien
 * administra la clínica (la monta `ConfiguracionCalendario` sólo con
 * `puedeAdministrar`; quien decide es `POST /api/agenda/restablecer`).
 *
 * Confirmación fuerte: un diálogo que dice qué se borra y qué NO, avisa de que
 * los enlaces ya compartidos con pacientes dejarán de funcionar, y no deja
 * seguir hasta escribir la palabra `RESTABLECER` (la misma que exige la ruta).
 * Al terminar, `alRestablecer` relee todo: «Primeros pasos» vuelve al paso 1.
 */
import { useId, useState, type FormEvent } from 'react'
import Portal from '@/components/ui/Portal'
import { useDialogoModal } from '@/hooks/useDialogoModal'
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'
import { BOTON_PELIGRO, BOTON_SECUNDARIO, CAMPO } from '@/components/agenda/configuracion/clasesConfig'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { useToast } from '@/components/ui/Toast'

const PALABRA = 'RESTABLECER'

const SE_RESTABLECE = [
  'El horario de cada consultorio vuelve al de fábrica: sin horario propio.',
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
function Confirmacion({ onCancelar, onHecho }: { onCancelar: () => void; onHecho: () => void }) {
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
          <h2 id={`${id}-t`} className="text-base font-semibold text-[var(--ag-text)]">¿Restablecer la configuración de la agenda?</h2>
          <div id={`${id}-d`} className="flex flex-col gap-[var(--ag-2)] text-sm text-[var(--ag-text)]">
            <ul className="list-disc pl-5">{SE_RESTABLECE.map(l => <li key={l}>{l}</li>)}</ul>
            <p className="font-semibold text-[var(--ag-status-cancelled-text)]">Los enlaces que ya compartiste con pacientes dejarán de funcionar.</p>
            <p>Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.</p>
          </div>
          <form onSubmit={e => void confirmar(e)} className="flex flex-col gap-[var(--ag-3)]">
            <label htmlFor={`${id}-p`} className="text-sm text-[var(--ag-text)]">Para confirmar, escribe <strong>{PALABRA}</strong></label>
            <input id={`${id}-p`} className={CAMPO} value={texto} onChange={e => setTexto(e.target.value)} autoComplete="off" spellCheck={false} />
            {error && <p role="alert" className="text-sm font-medium text-[var(--ag-status-cancelled-text)]">{error}</p>}
            <div className="flex flex-wrap justify-end gap-[var(--ag-2)]">
              <button type="button" className={BOTON_SECUNDARIO} onClick={onCancelar}>Cancelar</button>
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

export default function ZonaRestablecer({ alRestablecer }: { alRestablecer: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const toast = useToast()
  return (
    <TarjetaSeccion id="config-restablecer" titulo="Restablecer configuración de la agenda"
      ayuda="Deja la configuración de la agenda como si nunca se hubiera configurado. Sólo lo puede hacer quien administra la clínica.">
      <ul className="list-disc pl-5 text-sm text-[var(--ag-text)]">{SE_RESTABLECE.map(l => <li key={l}>{l}</li>)}</ul>
      <p className="text-sm text-[var(--ag-muted)]">Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.</p>
      <button type="button" className={`${BOTON_PELIGRO} self-start`} onClick={() => setAbierto(true)}>
        Restablecer configuración de la agenda
      </button>
      {abierto && (
        <Confirmacion onCancelar={() => setAbierto(false)}
          onHecho={() => { setAbierto(false); toast.success('Configuración de la agenda restablecida'); alRestablecer() }} />
      )}
    </TarjetaSeccion>
  )
}
