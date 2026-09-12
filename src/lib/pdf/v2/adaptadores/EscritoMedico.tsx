/**
 * Adaptador de II.8 · **Escrito Médico**.
 *
 * Lo que la fila guarda (`EscritoMedicoForm`, `contenido`):
 *
 *   paciente · fecha · asunto · tituloPie
 *   doc: { schema: 'tiptap-doc-v1', content } · cuerpo: HTML
 *
 * ── EL CUERPO NO SE MAPEA AQUÍ ──────────────────────────────────────────────
 *
 * Lo traduce `cuerpoEscritoDesde`, que decide entre el JSON de ProseMirror y el
 * HTML aplanado con el criterio de su cabecera: manda `doc` siempre que exista, y
 * `cuerpo` solo es la copia degradada de los escritos anteriores al editor.
 *
 * ── ESTE FORMATO NO LLEVA FOLIO. NUNCA ──────────────────────────────────────
 *
 * No son documentos seriados: el generador de la base no tiene clase para ellos y
 * su columna queda en NULL. Es el único de los nueve sin folio y está declarado en
 * el spec para que nadie lo reponga por consistencia mal entendida.
 *
 * ── Y NO TIENE RIEL DE PACIENTE ─────────────────────────────────────────────
 *
 * Es una hoja membretada multiuso —certificado, constancia, carta a un colega—, no
 * una orden clínica: el paciente, si sale, lo escribe el médico dentro del cuerpo.
 * Por eso `contenido.paciente` se guarda (nombra el archivo y encabeza la lista del
 * expediente) y no se compone.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { logger } from '@/lib/logger'
import EscritoMedico, { type EscritoMedicoProps } from '../formatos/EscritoMedico'
import { cuerpoEscritoDesde } from '../cuerpoEscrito'
import {
  comunes, envolver, fechaLarga, rubricaDe, textoOpcional, type EntradaAdaptador,
} from './comun'

export function propsEscritoMedico(entrada: EntradaAdaptador): EscritoMedicoProps {
  const { data } = entrada
  const { cuerpo, descartes } = cuerpoEscritoDesde(data)

  /*
   * Lo que el papel NO va a decir se cuenta y se nombra. No es un error —el
   * formato no compone tachado ni código y eso es una decisión— pero una
   * degradación silenciosa no se distingue de un defecto, y esta es la única
   * ventana donde alguien puede verla.
   */
  if (descartes.length > 0) {
    logger.warn(
      'EscritoMedicoV2',
      `marcado sin equivalente en el formato: ${descartes.map(d => `${d.que} ×${d.veces}`).join(', ')}`,
    )
  }

  return {
    ...comunes(entrada),
    // Título variable: lo escribe el médico y colapsa si no lo pone. Sin él, el
    // filete del membrete hace doble trabajo y el cuerpo arranca bajo él.
    asunto: textoOpcional(data.asunto),
    tituloPie: textoOpcional(data.tituloPie),
    // En el encabezado, a la derecha, sin rótulo. La línea de lugar y fecha
    // formal la escribe el médico dentro del cuerpo, según exija el trámite.
    fecha: fechaLarga(data.fecha),
    cuerpo,
    rubrica: rubricaDe(entrada.medico),
  }
}

export function renderEscritoMedicoV2(entrada: EntradaAdaptador): ReactElement<DocumentProps> {
  return envolver('Escrito médico', <EscritoMedico {...propsEscritoMedico(entrada)} />)
}
