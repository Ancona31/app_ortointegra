/**
 * Adaptador de II.3 · **Receta Médica**.
 *
 * Lo que la fila guarda (`RecetaForm`, `contenido`):
 *
 *   folio · paciente · diagnostico · recomendaciones · fecha
 *   medicamentos: { nombre_comercial, presentacion?, principio_activo?,
 *                   via_administracion?, indicacion }[]
 *
 * ── EL FOLIO DE ESTE FORMATO ES EL DE LA SERIE ──────────────────────────────
 *
 * `RX-2026-0001`, el de la columna, y es el mismo que codifica el QR de
 * verificación pública. Aquí eso no se decide ni se comprueba: `data.folio` llega
 * ya filtrado por `folioImpreso()` —desde el formulario al emitir y desde
 * `ModalDocumentos` al regenerar—, que es donde está escrito qué formatos lo
 * imprimen.
 *
 * ⚠ Una receta ANTERIOR a agosto de 2026 llega por aquí con el `R-a3f9…` que
 * guardó en `contenido`, porque ese es el que lleva su papel. No lo «corrijas» a
 * la serie: el documento regenerado dejaría de ser el entregado.
 *
 * ── LO QUE NO ESTÁ EN `contenido` Y AUN ASÍ SE LEE ──────────────────────────
 *
 * `edad`, `sexo` y `qrDataUrl` los pone el formulario al emitir y no se persisten.
 * Al regenerar llegan ausentes: las dos celdas del riel colapsan y el documento
 * sale sin QR, que es exactamente lo que hace hoy el renderizador v1 en ese mismo
 * camino. Se leen igual porque tenerlos en el papel recién emitido es mejor que no
 * tenerlos, y su ausencia no descompone nada.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import RecetaMedica, {
  type MedicamentoRecetado,
  type RecetaMedicaProps,
} from '../formatos/RecetaMedica'
import {
  comunes, envolver, fechaCorta, filas, rubricaDe, texto, textoOpcional,
  type EntradaAdaptador,
} from './comun'

/**
 * Las cinco ranuras de la entrada, con el nombre que ya usa el formulario.
 *
 * **No hay ranura de dosis**, y no es un olvido: el formulario no la captura —los
 * miligramos van en `presentacion` y la pauta en `indicacion`—. Ver la nota en
 * `MedicamentoRecetado`.
 */
function medicamentoDe(fila: Record<string, unknown>): MedicamentoRecetado {
  return {
    nombre_comercial: textoOpcional(fila.nombre_comercial),
    presentacion: textoOpcional(fila.presentacion),
    principio_activo: textoOpcional(fila.principio_activo),
    via_administracion: textoOpcional(fila.via_administracion),
    indicacion: textoOpcional(fila.indicacion),
  }
}

export function propsRecetaMedica(entrada: EntradaAdaptador): RecetaMedicaProps {
  const { data } = entrada
  return {
    ...comunes(entrada),
    paciente: {
      paciente: texto(data.paciente),
      edad: textoOpcional(data.edad),
      sexo: textoOpcional(data.sexo),
      diagnostico: textoOpcional(data.diagnostico),
    },
    medicamentos: filas(data.medicamentos).map(medicamentoDe),
    emision: fechaCorta(data.fecha),
    recomendaciones: textoOpcional(data.recomendaciones),
    folio: texto(data.folio),
    qr: textoOpcional(data.qrDataUrl),
    rubrica: rubricaDe(entrada.medico),
  }
}

export function renderRecetaMedicaV2(entrada: EntradaAdaptador): ReactElement<DocumentProps> {
  return envolver('Receta médica', <RecetaMedica {...propsRecetaMedica(entrada)} />)
}
