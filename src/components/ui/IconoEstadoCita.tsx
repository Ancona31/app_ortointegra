/**
 * IconoEstadoCita.tsx — el estado de una cita como icono en un círculo de color
 * (CALMA §24.4 y §27; el mismo en el dashboard y en la agenda).
 *
 * Primitiva del rediseño (B2): dibuja `.k-est` de `sistema.css`. Los iconos son
 * los de la maqueta aprobada (`dashboard-final`, trazo 2,2, 24×24):
 *   Agendada  calendario con reloj, ámbar (`--aviso-*`)
 *   Confirmada palomita, azul (`--tonal` / `--enlace`)
 *   Cancelada tache, rojo (`--mal-*`)
 *   No asistió persona tachada, gris (`--sup2` / `--tinta2`)
 *   Atendida  doble palomita, verde (`--ok-*`)
 *
 * ⚠️ EL TEXTO SALE DE `STATUS_CONFIG` (`lib/agenda/tarjetasAgenda.ts`), el
 * nombre visible de hoy. No escribas aquí otro rótulo: los textos son los de la
 * app (CALMA §10) y las pruebas los buscan literales.
 *
 * `texto`:
 *   'ancho'   (por defecto) icono + texto en `ih`/`iv`/`esc`; en `ext`/`tel`
 *             sólo el icono, y el texto queda para el lector de pantalla.
 *   'siempre' icono + texto en todos los formatos.
 *   'nunca'   sólo el icono, con `role="img"` y el estado en `aria-label`.
 */
import type { ReactElement, ReactNode } from 'react'
import type { Status } from '@/lib/agenda/tiposAgenda'
import { STATUS_CONFIG } from '@/lib/agenda/tarjetasAgenda'

const CLASE: Record<Status, string> = {
  scheduled: 'k-est-ag',
  confirmed: 'k-est-conf',
  cancelled: 'k-est-canc',
  no_show: 'k-est-noas',
  attended: 'k-est-aten',
}

const TRAZO: Record<Status, ReactNode> = {
  scheduled: (
    <>
      <path d="M20 10.5V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4.5" />
      <path d="M4 10h16M8 3v4M16 3v4" />
      <circle cx="17" cy="17" r="4.5" />
      <path d="M17 15v2.2l1.5 1" />
    </>
  ),
  confirmed: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cancelled: <path d="M6 6l12 12M18 6 6 18" />,
  no_show: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M4 4l16 16" />
    </>
  ),
  attended: (
    <>
      <path d="m2.5 12.5 4 4L15 8" />
      <path d="m11.5 16 .5.5L21.5 8" />
    </>
  ),
}

export interface IconoEstadoCitaProps {
  estado: Status
  texto?: 'ancho' | 'siempre' | 'nunca'
  /** Círculo de 24 en lugar de 26 (líneas compactas y cabeceras de capa). */
  compacto?: boolean
  className?: string
}

export default function IconoEstadoCita({ estado, texto = 'ancho', compacto = false, className }: IconoEstadoCitaProps): ReactElement {
  const nombre = STATUS_CONFIG[estado].label
  const clases = ['k-est', CLASE[estado], texto === 'ancho' ? 'k-est-ancho' : '', compacto ? 'k-est-24' : '', className ?? '']
    .filter(Boolean).join(' ')
  const circulo = (
    <span className="k-est-c">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {TRAZO[estado]}
      </svg>
    </span>
  )
  if (texto === 'nunca') return <span className={clases} role="img" aria-label={nombre}>{circulo}</span>
  return <span className={clases}>{circulo}<span className="k-est-t">{nombre}</span></span>
}
