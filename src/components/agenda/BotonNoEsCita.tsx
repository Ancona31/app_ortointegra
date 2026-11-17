'use client'

/**
 * src/components/agenda/BotonNoEsCita.tsx — «¿No es una cita?» (tanda I, punto
 * 10 de Angel), el botón que se pinta FUERA de la tarjeta de la agenda: en la
 * fila de «Próximas citas», en el formulario completo y en el aviso de la
 * campana (agente I5). En la tarjeta de la agenda es una acción más de su
 * rejilla (`accionesTarjeta.ts`), con la misma función `marcarNoEsCita`.
 *
 * CONTRATO (para quien lo monte, I5 incluido):
 *   · Móntalo SÓLO para una fila «por asignar» (`esPorAsignar` de
 *     `tarjetasAgenda.ts`: sin paciente, sin `reserva_canal` y
 *     `google_asignacion === 'por_asignar'`). La regla final la pone la ruta
 *     (`POST /api/appointments/[id]/no-es-cita`): 409 si ya no lo está, 200 si
 *     ya era evento, 403 si quien pulsa no gestiona a ese médico.
 *   · `citaId`: el id de la cita. `alHecho`: se llama UNA vez tras el 200, para
 *     que quien lo monta quite la fila (no vuelve a preguntar).
 *   · `className` / `style`: la pinta la pone quien lo monta, con sus clases de
 *     siempre (la tanda no toca la estética).
 *   · Un clic: sin confirmación, en el momento (lo pidió Angel). El error se
 *     dice debajo, en `role="alert"`.
 */
import { useState, type CSSProperties, type ReactElement } from 'react'
import { marcarNoEsCita } from '@/lib/agenda/noEsCita'

export const TEXTO_NO_ES_CITA = '¿No es una cita?'

interface Props {
  citaId: string
  alHecho: () => void
  className?: string
  style?: CSSProperties
}

export default function BotonNoEsCita({ citaId, alHecho, className, style }: Props): ReactElement {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function pulsar(): Promise<void> {
    if (enviando) return
    setEnviando(true)
    setError(null)
    const r = await marcarNoEsCita(citaId)
    setEnviando(false)
    if (r.ok) { alHecho(); return }
    setError(r.motivo)
  }
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={() => void pulsar()} disabled={enviando} aria-busy={enviando}
        title="Dejarlo como evento sin paciente: deja de pedir que se ligue" className={className} style={style}>
        {TEXTO_NO_ES_CITA}
      </button>
      {error && <span role="alert" className="text-[12px] text-red-600">{error}</span>}
    </span>
  )
}
