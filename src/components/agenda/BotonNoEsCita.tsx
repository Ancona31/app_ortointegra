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
 *   · `modo="inicio"` (corrección 8 de Angel, SÓLO la tarjeta del inicio): la
 *     ayuda deja de verse en la tarjeta (se encimaba con «Desde Google
 *     Calendar»). En computadora (`esc`) sale como burbuja al pasar el cursor o
 *     al enfocar el botón, y el botón hace lo de siempre; en los táctiles
 *     (`ext`, `tel`, `iv`, `ih`) tocarlo abre la alerta del catálogo
 *     (`ConfirmModal` con verbo) y sólo «Dejar como evento» lo hace. El formato
 *     se lee AL PULSAR (`leerFormato`), nunca en el render; la burbuja es CSS
 *     (`esc:`). Para el lector, la ayuda sigue en `aria-describedby` en todos
 *     los formatos. Sin `modo`, todo como antes (formulario y campana).
 */
import { useId, useState, type CSSProperties, type ReactElement } from 'react'
import ConfirmModal from '@/components/agenda/ConfirmModal'
import { marcarNoEsCita } from '@/lib/agenda/noEsCita'
import { leerFormato } from '@/lib/formatoPantalla'

export const TEXTO_NO_ES_CITA = '¿No es una cita?'
export const AYUDA_NO_ES_CITA = 'Dejarlo como evento sin paciente: deja de pedir que se ligue'
/** La alerta de los táctiles en la tarjeta del inicio: la pregunta es el título (`partirPregunta`). */
export const PREGUNTA_NO_ES_CITA = '¿No es una cita? Se deja como evento sin paciente y deja de pedir que se ligue.'

/** La burbuja de la ayuda en computadora: sólo `esc`, al pasar el cursor o con el foco dentro. Decorativa:
    el lector la tiene en la descripción del botón. Tokens del kit; sólo se anima la opacidad. */
const BURBUJA = 'pointer-events-none absolute right-0 top-full z-10 mt-[4px] hidden w-max max-w-[260px] rounded-[8px] bg-tinta px-[10px] py-[6px] '
  + 'text-left text-[13px] leading-[18px] font-semibold text-sup shadow-[var(--sombra-capa)] opacity-0 transition-opacity duration-[var(--dur-toque)] '
  + 'motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100 esc:block'

interface Props {
  citaId: string
  alHecho: () => void
  className?: string
  style?: CSSProperties
  /** `'inicio'`: la tarjeta del inicio (ver la cabecera). Por omisión, el de siempre. */
  modo?: 'siempre' | 'inicio'
}

export default function BotonNoEsCita({ citaId, alHecho, className, style, modo = 'siempre' }: Props): ReactElement {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState(false)
  const idAyuda = useId()
  async function pulsar(): Promise<void> {
    if (enviando) return
    setEnviando(true)
    setError(null)
    const r = await marcarNoEsCita(citaId)
    setEnviando(false)
    if (r.ok) { alHecho(); return }
    setError(r.motivo)
  }
  /* En la tarjeta del inicio, un táctil pregunta antes; la computadora (y sin sonda) hace lo de siempre. */
  const alPulsar = (): void => {
    const f = leerFormato()
    if (modo === 'inicio' && f !== 'esc' && f !== 'desconocido') setPreguntando(true)
    else void pulsar()
  }
  const boton = (
    <button type="button" onClick={alPulsar} disabled={enviando} aria-busy={enviando}
      aria-describedby={idAyuda} className={className} style={style}>
      {TEXTO_NO_ES_CITA}
    </button>
  )
  const fallo = error && <span role="alert" className="text-[12px] font-semibold text-mal-tinta">{error}</span>
  /* B13 · AG7 (CALMA §29.7): la explicación, que antes sólo vivía en `title`, se ve bajo el botón
     y lo describe (`aria-describedby`). El error, en el rojo del kit. */
  if (modo === 'siempre') return (
    <span className="inline-flex flex-col items-end">
      {boton}
      <span id={idAyuda} className="text-right text-[12px] leading-4 text-tinta2">{AYUDA_NO_ES_CITA}</span>
      {fallo}
    </span>
  )
  return (
    <span className="group relative inline-flex flex-col items-end">
      {boton}
      <span id={idAyuda} className="sr-only">{AYUDA_NO_ES_CITA}</span>
      <span aria-hidden="true" data-ayuda-no-es-cita className={BURBUJA}>{AYUDA_NO_ES_CITA}</span>
      {fallo}
      {preguntando && (
        <ConfirmModal message={PREGUNTA_NO_ES_CITA} verbo="Dejar como evento" secundario="Volver" icono="aviso" apilada
          onCancel={() => setPreguntando(false)} onConfirm={() => { setPreguntando(false); void pulsar() }} />
      )}
    </span>
  )
}
