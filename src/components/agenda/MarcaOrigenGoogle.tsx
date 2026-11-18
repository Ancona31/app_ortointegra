/**
 * src/components/agenda/MarcaOrigenGoogle.tsx — tanda J, punto 11 de Angel:
 * «Las citas y eventos que vienen de Google dejan el color morado. Usan los
 * mismos colores de estado que las de Spinus y conservan el logo de la G para
 * saber que se agendaron en Google.»
 *
 * La «G» de una FILA de Spinus que nació en Google (`origen = 'google'`: el
 * evento importado, por asignar, ya asignado o marcado como evento). Los
 * bloques de sólo lectura de Google (`isGcalBlock`) ya llevaban la suya en el
 * hueco del marcador y no pasan por aquí.
 *
 * SÓLO CON LA V2, Y LO DECIDE LA HOJA DE ESTILOS: `.ag-g-origen` no se ve
 * salvo dentro de `.agenda-raiz[data-agenda-v2="encendida"]` (globals.css).
 * No lee el interruptor: ni un argumento nuevo de `eventContent` (repintaría
 * FullCalendar) ni una suscripción por fila; y sin `useSinAvisoFlotante` no
 * hay import circular con `MemoizedEventContent`, que también la pinta.
 * Apagada, la agenda se ve como antes.
 */
import type { ReactElement } from 'react'
import { GoogleGIcon } from '@/components/agenda/GoogleGIcon'

/** El nombre accesible de la marca (y lo que las cajas añaden a su etiqueta). */
export const ETIQUETA_ORIGEN_GOOGLE = 'Agendada en Google'

/** `decorativa`: la caja ya lo dice en la etiqueta de su grupo (tarjeta de Semana, chip del
 *  Mes); sin ella, el lector de pantalla lo anunciaría dos veces. */
export function MarcaOrigenGoogle({ size, decorativa = false }: { size: number; decorativa?: boolean }): ReactElement {
  if (decorativa) return <span className="ag-g-origen" aria-hidden="true"><GoogleGIcon size={size} /></span>
  return (
    <span className="ag-g-origen" role="img" aria-label={ETIQUETA_ORIGEN_GOOGLE}>
      <GoogleGIcon size={size} />
    </span>
  )
}
