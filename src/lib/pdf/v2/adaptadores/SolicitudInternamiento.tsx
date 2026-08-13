/**
 * Adaptador de II.6 · **Solicitud de Internamiento**.
 *
 * Lo que la fila guarda (`SolicitudInternamientoForm`, `contenido`):
 *
 *   paciente · fecha · fechaIngreso · lugar · diagnostico · diagnosticosSecundarios
 *   tipoInternamiento · procedimiento · diasEstimados · asa · urgente
 *   requerimientos: string[] · requerimientosExtra · justificacion
 *   instruccionesPaciente · indicacionesPiso
 *
 * ── EL FOLIO NO SE COMPONE, Y ESO ES UNA DECISIÓN ───────────────────────────
 *
 * La fila lleva `INT-AAAA-NNNN` y el papel no lo dice. El expediente numera todo
 * lo que emite porque una serie con huecos no se audita; nadie va a citar ese
 * número desde el hospital. Por eso este formato no tiene prop `folio` y por eso
 * `folioImpreso()` devuelve `undefined` para él. **No se «arregla» por ninguno de
 * los dos lados** — `DOCUMENTOS_RANURAS_MUERTAS.md` §2.
 *
 * ── TRES DATOS QUE CAMBIAN DE NOMBRE O DE FORMA ─────────────────────────────
 *
 *   `lugar` → `hospital`   El formulario lo rotula «Hospital / lugar de
 *                          internamiento»; en el riel de 2.D la celda se llama
 *                          `hospital`. Es el mismo dato con el nombre de su celda.
 *   `asa`                  Se guarda como `ASA II` y la celda ya rotula `ASA`:
 *                          sin quitar el prefijo el papel diría `ASA ASA II`.
 *   `fecha` → `emision`    Al riel derecho del bloque de título, en forma corta.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import SolicitudInternamiento, {
  type SolicitudInternamientoProps,
} from '../formatos/SolicitudInternamiento'
import {
  bandera, comunes, envolver, fechaCorta, fechaLarga, rubricaDe, texto,
  textoOpcional, textos, type EntradaAdaptador,
} from './comun'

/** `ASA II` → `II`. La celda pone el rótulo; el dato es la clase. */
function claseAsa(valor: unknown): string | undefined {
  const bruto = texto(valor)
  if (bruto === '') return undefined
  const sinPrefijo = bruto.replace(/^ASA\s+/i, '').trim()
  return sinPrefijo === '' ? undefined : sinPrefijo
}

export function propsSolicitudInternamiento(
  entrada: EntradaAdaptador,
): SolicitudInternamientoProps {
  const { data } = entrada
  return {
    ...comunes(entrada),
    paciente: {
      paciente: texto(data.paciente),
      // Ya con su unidad tal como la escribió el médico —`3-5 días`—: 2.D coloca
      // y no convierte, y añadir «días» a ciegas produciría `3-5 días días`.
      diasEstimados: textoOpcional(data.diasEstimados),
      asa: claseAsa(data.asa),
      hospital: textoOpcional(data.lugar),
      tipoInternamiento: textoOpcional(data.tipoInternamiento),
      fechaIngreso: fechaLarga(data.fechaIngreso),
    },
    emision: fechaCorta(data.fecha),
    urgente: bandera(data.urgente),
    diagnostico: texto(data.diagnostico),
    diagnosticosSecundarios: textos(data.diagnosticosSecundarios),
    procedimiento: textoOpcional(data.procedimiento),
    // Los dos van por separado y el formato los compone en el mismo riel: el
    // catálogo cerrado primero, lo que el médico añadió después.
    requerimientos: textos(data.requerimientos),
    requerimientosExtra: textoOpcional(data.requerimientosExtra),
    justificacion: textoOpcional(data.justificacion),
    instruccionesPaciente: textoOpcional(data.instruccionesPaciente),
    indicacionesPiso: textoOpcional(data.indicacionesPiso),
    rubrica: rubricaDe(entrada.medico),
  }
}

export function renderSolicitudInternamientoV2(
  entrada: EntradaAdaptador,
): ReactElement<DocumentProps> {
  return envolver(
    'Solicitud de internamiento',
    <SolicitudInternamiento {...propsSolicitudInternamiento(entrada)} />,
  )
}
