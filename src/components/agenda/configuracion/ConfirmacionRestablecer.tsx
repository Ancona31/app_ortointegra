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
 *
 * B13 · AG9 (rediseño, maqueta `ag-config`, «Más opciones»): la alerta del catálogo (`ModalShell`, patrón único):
 * icono de reinicio en círculo rojo, la pregunta como título, lo que pasa y lo que no como mensaje, el campo y
 * «Cancelar» · «Restablecer» (rojo suave), que sólo se enciende con la palabra exacta. Mismos textos.
 */
import { useId, useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import { CAMPO_NUEVO } from '@/components/agenda/configuracion/estilosConfig'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'

const PALABRA = 'RESTABLECER'

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
    <ModalShell open onClose={onCancelar} variante="alerta" tono="destruir" icon={<RotateCcw aria-hidden="true" />}
      title="¿Restablecer la configuración de la agenda?"
      footer={(
        <>
          <button type="button" className="k-b k-b-quieto k-b-capa" onClick={onCancelar} autoFocus>Cancelar</button>
          <button type="submit" form={`${id}-f`} data-principal className="k-b k-b-mal k-b-capa" disabled={texto !== PALABRA || enviando}>
            {enviando ? 'Restableciendo…' : 'Restablecer'}
          </button>
        </>
      )}>
      <ul className="m-0 list-disc pl-[20px] text-left">{SE_RESTABLECE.map(l => <li key={l}>{l}</li>)}</ul>
      <p className="m-0 text-left font-semibold text-mal-tinta">Los enlaces que ya compartiste con pacientes dejarán de funcionar.</p>
      <p className="m-0 text-left">Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.</p>
      <form id={`${id}-f`} onSubmit={e => void confirmar(e)} className="flex flex-col gap-[6px] text-left">
        <label htmlFor={`${id}-p`} className="k-etiqueta">Para confirmar, escribe <strong>{PALABRA}</strong></label>
        <input id={`${id}-p`} className={CAMPO_NUEVO} value={texto} onChange={e => setTexto(e.target.value)} autoComplete="off" spellCheck={false} />
        {error && <p role="alert" className="m-0 text-[13px] font-semibold leading-[18px] text-mal-tinta">{error}</p>}
      </form>
    </ModalShell>
  )
}
