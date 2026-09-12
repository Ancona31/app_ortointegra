/**
 * Adaptador de II.1 · **Solicitud de Laboratorio**.
 *
 * Lo que la fila guarda (`SolicitudLabForm`, `contenido`):
 *
 *   paciente · diagnostico · estudios: string[] · notas · fecha
 *
 * Y el folio, que no está en `contenido`: es columna de la base y lo pasa quien
 * emite o quien regenera, ya filtrado por `folioImpreso()`.
 *
 * ⚠ `estudios` son **cadenas sueltas**, no objetos. La entrada de 2.G tiene una
 * sola ranura ocupada en este formato y por eso el mapeo es a `{ nombre }` y no a
 * un objeto con ranuras vacías: ver `EstudioSolicitado` en el formato.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import SolicitudLaboratorio, {
  type SolicitudLaboratorioProps,
} from '../formatos/SolicitudLaboratorio'
import {
  comunes, envolver, fechaLarga, rubricaDe, texto, textoOpcional, textos,
  type EntradaAdaptador,
} from './comun'

export function propsSolicitudLaboratorio(
  entrada: EntradaAdaptador,
): SolicitudLaboratorioProps {
  const { data } = entrada
  return {
    ...comunes(entrada),
    /*
     * Cuatro de las siete celdas del riel, que son las que este formulario tiene.
     * `sexo`, `expediente` y `hora` colapsan y 2.F reparte el ancho entre las
     * vivas: es comportamiento declarado del chasis, no una ranura pendiente.
     * Cablearlas exige cambiar la firma pública de los nueve formularios y las
     * páginas que los montan, que es otro trabajo.
     */
    paciente: {
      paciente: texto(data.paciente),
      diagnostico: textoOpcional(data.diagnostico),
      fecha: fechaLarga(data.fecha),
    },
    estudios: textos(data.estudios).map(nombre => ({ nombre })),
    notas: textoOpcional(data.notas),
    // Vacío solo si la fila no llegó a existir. Hoy no ocurre: este formulario
    // escribe la fila antes de renderizar, precisamente para tener el número.
    folio: texto(data.folio),
    rubrica: rubricaDe(entrada.medico),
  }
}

export function renderSolicitudLaboratorioV2(
  entrada: EntradaAdaptador,
): ReactElement<DocumentProps> {
  return envolver(
    'Solicitud de laboratorio',
    <SolicitudLaboratorio {...propsSolicitudLaboratorio(entrada)} />,
  )
}
