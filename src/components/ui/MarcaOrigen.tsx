/**
 * MarcaOrigen.tsx — de dónde vino una cita: reservada por enlace o agendada
 * desde Google Calendar (CALMA §24.5 y §28; dashboard y agenda).
 *
 * Primitiva del rediseño (B2): dibuja `.k-origen` de `sistema.css`, icono +
 * texto en la línea secundaria. Los textos son los UNIFICADOS que aprobó el
 * dueño (CALMA §28) y sustituirán a las variantes de hoy cuando cada pantalla
 * adopte esta pieza (dashboard B5, agenda B13), con sus pruebas en el mismo
 * commit. Mientras tanto nadie la usa.
 *   enlace  «Reservó por enlace»             corto: «Por enlace»
 *   google  «Agendada desde Google Calendar» corto: «Desde Google Calendar»
 *
 * El icono de Google Calendar es el dibujo simplificado de la maqueta
 * (`dashboard-final`, `gcal()`), multicolor, sin recursos externos. Sus
 * colores son los de la marca de Google y no cambian en oscuro.
 *
 * `soloIcono`: el icono con el texto LARGO en `aria-label` (filas estrechas,
 * bloques de la agenda).
 */
import type { ReactElement } from 'react'

export type Origen = 'enlace' | 'google'

const TEXTO: Record<Origen, { largo: string; corto: string }> = {
  enlace: { largo: 'Reservó por enlace', corto: 'Por enlace' },
  google: { largo: 'Agendada desde Google Calendar', corto: 'Desde Google Calendar' },
}

function IconoEnlace(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  )
}

function IconoGoogleCalendar(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="#4285F4" />
      <path d="M17 7h4.5v10H17z" fill="#FBBC04" />
      <path d="M7 17h10v4.5H7z" fill="#34A853" />
      <path d="M2.5 17H7v4.5H6A3.5 3.5 0 0 1 2.5 18z" fill="#188038" />
      <path d="M17 17h4.5L17 21.5z" fill="#EA4335" />
      <rect x="7" y="7" width="10" height="10" fill="#fff" />
      <path d="M9.6 10.2h2.2l-1.2 1.4c.9 0 1.4.5 1.4 1.2s-.6 1.2-1.4 1.2c-.5 0-.9-.2-1.1-.5M13.6 10.6l1-.5v4.2"
        fill="none" stroke="#4285F4" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export interface MarcaOrigenProps {
  origen: Origen
  corto?: boolean
  soloIcono?: boolean
  className?: string
}

export default function MarcaOrigen({ origen, corto = false, soloIcono = false, className }: MarcaOrigenProps): ReactElement {
  const t = TEXTO[origen]
  const clases = ['k-origen', `k-origen-${origen}`, className ?? ''].filter(Boolean).join(' ')
  const icono = origen === 'google' ? <IconoGoogleCalendar /> : <IconoEnlace />
  if (soloIcono) return <span className={clases} role="img" aria-label={t.largo}>{icono}</span>
  return <span className={clases}>{icono}{corto ? t.corto : t.largo}</span>
}
