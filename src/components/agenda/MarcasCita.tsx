/**
 * src/components/agenda/MarcasCita.tsx — tanda K, sección E (puntos 17, 18 y 20 de Angel):
 *
 *   · 17: «Desaparecen los chips "Por ligar" y "Por asignar". En su lugar, un solo icono:
 *     un expediente tachado en rojo, que significa "sin expediente", venga de Google o de
 *     enlace. Con su nombre accesible.»
 *   · 18: «Las citas reservadas por enlace llevan un icono de eslabón, permanente, también
 *     después de ligarlas.»
 *
 * Dibujo propio (sin librería), con los trazos de la maqueta `docs/spec/Burbuja.dc.html`. Los
 * colores son tokens: el documento en `--ag-ink-600`, la raya en el rojo de error de la agenda
 * (`--ag-status-cancelled-text`, el de `.ag-capa-error` y `.ag-lectura-peligro`), y el eslabón
 * en `--ag-brand-legible`.
 *
 * Quién decide si se pintan: `marcasDeCita` (`tarjetasAgenda.ts`). El eslabón depende de
 * `reserva_canal`, NUNCA de si ya está ligada. Sólo con la v2: en la rejilla y el Mes lo decide
 * `useSinAvisoFlotante` (ya lo leían); en listas, banda y panel del Mes, la hoja de estilos
 * (`.ag-marcas-v2`, como la «G» de `MarcaOrigenGoogle`), sin una suscripción por fila.
 */
import type { ReactElement } from 'react'

/** El nombre accesible de cada marca (y lo que las cajas añaden a su etiqueta de grupo). */
export const ETIQUETA_SIN_EXPEDIENTE = 'Sin expediente'
export const ETIQUETA_ENLACE = 'Agendada por enlace'

/** El expediente tachado (decorativo: quien lo usa le da el nombre). */
export function IconoSinExpediente({ size }: { size: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className="ag-icono-sin-exp">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke="var(--ag-ink-600)" strokeWidth="1.8" />
      <path d="M14 3v5h5" stroke="var(--ag-ink-600)" strokeWidth="1.8" />
      <path d="M3.5 3.5l17 17" stroke="var(--ag-status-cancelled-text)" strokeWidth="2.4" />
    </svg>
  )
}

/** El eslabón (decorativo: quien lo usa le da el nombre). */
export function IconoEnlace({ size }: { size: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--ag-brand-legible)" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="ag-icono-enlace">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  )
}

interface Props {
  enlace: boolean
  sinExpediente: boolean
  size: number
  /** La caja ya lo dice en la etiqueta de su grupo (tarjeta de Semana, chip del Mes). */
  decorativa?: boolean
  /** Sólo con la v2 por la hoja de estilos (listas, banda, panel del Mes). */
  soloV2?: boolean
}

/** Las dos marcas juntas, en el orden eslabón → expediente tachado. `null` si no hay ninguna. */
export function MarcasCita({ enlace, sinExpediente, size, decorativa = false, soloV2 = false }: Props): ReactElement | null {
  if (!enlace && !sinExpediente) return null
  const rol = (nombre: string) => (decorativa ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': nombre })
  return (
    <span className={soloV2 ? 'ag-marcas ag-marcas-v2' : 'ag-marcas'}>
      {enlace && <span className="ag-marca" {...rol(ETIQUETA_ENLACE)}><IconoEnlace size={size} /></span>}
      {sinExpediente && <span className="ag-marca" {...rol(ETIQUETA_SIN_EXPEDIENTE)}><IconoSinExpediente size={size} /></span>}
    </span>
  )
}
