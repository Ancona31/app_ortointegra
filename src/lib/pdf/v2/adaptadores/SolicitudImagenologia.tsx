/**
 * Adaptador de II.2 · **Solicitud de Imagenología**.
 *
 * Lo que la fila guarda (`SolicitudImagenForm`, `contenido`):
 *
 *   paciente · diagnostico · estudios: { tipo, region, proyecciones?, indicacion? }[]
 *   urgente · fecha
 *
 * Los cuatro campos de la entrada llegan con el mismo nombre que la ranura del
 * formato, así que el mapeo es directo. La `indicacion` es **por estudio** y va en
 * su entrada; el diagnóstico va una sola vez, en el riel.
 *
 * `urgente` marca el DOCUMENTO y no el estudio: se pasa al formato, que lo compone
 * bajo el título y lo repite reducido en las hojas de continuación —pueden llegar
 * separadas al servicio de imagen—.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import SolicitudImagenologia, {
  type EstudioSolicitado,
  type SolicitudImagenologiaProps,
} from '../formatos/SolicitudImagenologia'
import {
  bandera, comunes, envolver, fechaCorta, filas, rubricaDe, texto, textoOpcional,
  type EntradaAdaptador,
} from './comun'

/**
 * El par tipo + región es lo que hace que un estudio EXISTA — el formulario ya
 * descarta los que van a medias antes de guardar, así que aquí no se vuelve a
 * filtrar: lo que está en la fila es lo que se pidió.
 */
function estudioDe(fila: Record<string, unknown>): EstudioSolicitado {
  return {
    tipo: texto(fila.tipo),
    region: texto(fila.region),
    proyecciones: textoOpcional(fila.proyecciones),
    indicacion: textoOpcional(fila.indicacion),
  }
}

export function propsSolicitudImagenologia(
  entrada: EntradaAdaptador,
): SolicitudImagenologiaProps {
  const { data } = entrada
  return {
    ...comunes(entrada),
    paciente: {
      paciente: texto(data.paciente),
      diagnostico: textoOpcional(data.diagnostico),
    },
    estudios: filas(data.estudios).map(estudioDe),
    // La fecha va en el riel derecho del bloque de título, no en el de paciente:
    // este formato compone `emision`. Ver `fechaCorta`.
    emision: fechaCorta(data.fecha),
    urgente: bandera(data.urgente),
    folio: texto(data.folio),
    rubrica: rubricaDe(entrada.medico),
  }
}

export function renderSolicitudImagenologiaV2(
  entrada: EntradaAdaptador,
): ReactElement<DocumentProps> {
  return envolver(
    'Solicitud de imagenología',
    <SolicitudImagenologia {...propsSolicitudImagenologia(entrada)} />,
  )
}
