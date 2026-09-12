/**
 * Adaptador de II.9 · **Denegación / Revocación de Consentimiento**.
 *
 * Lo que la fila guarda (`ConsentimientoInformadoForm` en su rama de denegación,
 * `contenido`):
 *
 *   paciente · lugar · fecha · edad · procedimiento · diagnostico · familiar
 *   pacienteNoPuedeFirmar
 *
 * Son seis campos y ninguna sección: la denegación no informa, hace constar. Lo
 * que el consentimiento lleva y este no —secciones, transfusión, fotografías,
 * testigos— se conserva en pantalla y se declara en la franja del formulario,
 * pero **no viaja a la fila**: allí significaría que este papel lo lleva.
 *
 * ── `pacienteNoPuedeFirmar` → `sustitucion` ─────────────────────────────────
 *
 * Es el mismo dato con el nombre de lo que enciende: la declaración en la que el
 * familiar deniega EN LUGAR del paciente, la nota bajo su celda y la retícula de
 * dos columnas. Es dato del documento y no del flujo —sin él en la fila, un papel
 * reimpreso diría que el paciente denegó por sí mismo—, y por eso se guarda.
 *
 * ── ESTE DOCUMENTO NO SE FIRMA DIGITALMENTE, Y POR ESO NO LLEVA NINGUNA RÚBRICA
 *
 * No tiene borrador ni sellado: se emite en el momento, con el paciente delante, y
 * **las tres celdas salen para la pluma, la del médico incluida**. Estampar ahí la
 * rúbrica del perfil pondría la firma del médico en un papel que se imprime
 * justamente para que lo firmen delante, y antes de que nadie lo haya hecho.
 *
 * Es la regla de v1, que compone esta hoja con el mismo bloque de firmas del
 * consentimiento y solo estampa al médico en los sellados —y una denegación no se
 * sella nunca—. Distinto de los otros siete formatos, donde firma el médico y
 * nadie más.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import DenegacionConsentimiento, {
  type DenegacionConsentimientoProps,
} from '../formatos/DenegacionConsentimiento'
import {
  bandera, comunes, envolver, fechaCorta, texto, textoOpcional,
  type EntradaAdaptador,
} from './comun'

export function propsDenegacionConsentimiento(
  entrada: EntradaAdaptador,
): DenegacionConsentimientoProps {
  const { data } = entrada
  return {
    ...comunes(entrada),
    paciente: {
      paciente: texto(data.paciente),
      edad: textoOpcional(data.edad),
      // No sale en el riel: sale DENTRO de la declaración, y por eso se guarda
      // aunque el documento no lo rotule por separado.
      diagnostico: textoOpcional(data.diagnostico),
      familiar: textoOpcional(data.familiar),
      lugar: textoOpcional(data.lugar),
      fecha: fechaCorta(data.fecha),
    },
    procedimiento: texto(data.procedimiento),
    firmantes: {
      // Sin nombre —el formato cae al del membrete— y sin rúbrica. Ver la
      // cabecera: las tres celdas de este documento son para la pluma.
      medico: {},
      paciente: { nombre: textoOpcional(data.paciente) },
      familiar: { nombre: textoOpcional(data.familiar) },
    },
    sustitucion: bandera(data.pacienteNoPuedeFirmar),
    folio: texto(data.folio),
  }
}

export function renderDenegacionConsentimientoV2(
  entrada: EntradaAdaptador,
): ReactElement<DocumentProps> {
  return envolver(
    'Denegación de consentimiento',
    <DenegacionConsentimiento {...propsDenegacionConsentimiento(entrada)} />,
  )
}
