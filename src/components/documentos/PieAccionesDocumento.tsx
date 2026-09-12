'use client'

import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'

/**
 * Barra de acciones al pie de un formulario de documento.
 *
 * Estuvo copiada carácter por carácter en los SIETE formularios de dos botones
 * —receta, laboratorio, imagenología, suplementación, internamiento, escrito y
 * honorarios—, y lo único que las distinguía era el rótulo largo del primario,
 * que se retiró en el ítem 2 del pulido de flujo. Sin esa diferencia los siete
 * bloques quedaban idénticos, así que aquí hay uno.
 *
 * ⚠️ EL CONSENTIMIENTO NO LA USA, Y NO ES UN OLVIDO. Su barra tiene tres
 * botones —borrador, imprimir sin firma y firmado electrónico— y su «Guardar
 * como plantilla» vive arriba, junto al selector. Es otra barra, no una
 * variante de ésta; parametrizar las dos en un solo componente pedía tres
 * banderas para un único llamador. Comparten el CSS de `.sp-doc-actions`, que
 * es donde vive de verdad la disposición.
 *
 * La geometría —sticky, área segura, apilado por debajo de 380 px de
 * CONTENEDOR— la pone `.sp-doc-actions` en `spinus-tokens.css:1510`. Aquí no
 * hay ni una clase de color.
 */
interface Props {
  /**
   * El «Guardar como plantilla», que lo fabrica `usePlantillas` y llega ya
   * montado: sabe si está vacío el formulario y si se llegó al tope, y eso vive
   * en el formulario, no aquí.
   *
   * Es `ReactNode` y no un booleano porque puede ser `null` —los documentos con
   * plantillas desactivadas no lo traen— y entonces el primario se queda solo
   * en la fila, que es exactamente lo que debe pasar.
   */
  botonGuardar: ReactNode
  onImprimir: () => void
  /** Generando el PDF. */
  imprimiendo: boolean
  /** El perfil del médico aún no ha resuelto: imprimir ahora saldría sin membrete. */
  perfilPendiente: boolean
}

export default function PieAccionesDocumento({
  botonGuardar,
  onImprimir,
  imprimiendo,
  perfilPendiente,
}: Props) {
  return (
    <div className="sp-doc-actions">
      {botonGuardar}
      {/* ⚠️ EL RÓTULO ES «IMPRIMIR» A SECAS EN LOS OCHO FORMATOS Y EN TODOS LOS
          ANCHOS. Antes decía el tipo —«Imprimir solicitud de imagenología»— con
          el par `sp-doc-long`/`sp-doc-short`, que sólo lo acortaba por debajo de
          380 px de contenedor; entre 380 y 480 la fila seguía en horizontal con
          el rótulo entero y el texto partía en dos renglones. Dentro del
          formulario el documento ya está dicho por la cabecera y por el selector
          de tipo, así que repetirlo aquí sólo costaba ancho. */}
      <button
        type="button"
        onClick={onImprimir}
        disabled={imprimiendo || perfilPendiente}
        className="sp-btn sp-btn--primary"
      >
        {imprimiendo ? <><span className="sp-spinner" /> Generando PDF…</>
          : perfilPendiente ? <><span className="sp-spinner" /> Cargando tu perfil…</>
          : <><Printer size={17} /> Imprimir</>}
      </button>
    </div>
  )
}
