/**
 * Adaptador de II.4 · **Plan de Suplementación**.
 *
 * Lo que la fila guarda (`PlanSuplementacionForm`, `contenido`):
 *
 *   paciente · diagnostico · pesoKg · notas · seguimiento · fecha
 *   seleccionados: { nombre, dosis, marca?, justificacion? }[]
 *
 * ── EL PESO ─────────────────────────────────────────────────────────────────
 *
 * Se guarda como cifra suelta —`72.5`— y el riel lo compone **ya con su unidad**:
 * 2.D coloca, no rotula ni convierte. Su ausencia colapsa dos cosas a la vez, la
 * celda y el rótulo `Dosis calculada para NN kg` de la cabecera de lista, y eso lo
 * resuelve el formato porque es quien tiene los dos delante.
 *
 * ── `seguimiento`, QUE NO ES UNA CITA ───────────────────────────────────────
 *
 * El formato llevó un objeto `cita` de tres campos que nadie captura. Lo que el
 * formulario guarda —y lo que v1 imprime— es una línea de texto libre, así que la
 * ranura es de texto. Ver `DOCUMENTOS_RANURAS_MUERTAS.md` §1.D.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import PlanSuplementacion, {
  type PlanSuplementacionProps,
  type SuplementoIndicado,
} from '../formatos/PlanSuplementacion'
import {
  comunes, envolver, fechaCorta, filas, numero, rubricaDe, texto, textoOpcional,
  type EntradaAdaptador,
} from './comun'

function suplementoDe(fila: Record<string, unknown>): SuplementoIndicado {
  return {
    nombre: textoOpcional(fila.nombre),
    dosis: textoOpcional(fila.dosis),
    marca: textoOpcional(fila.marca),
    justificacion: textoOpcional(fila.justificacion),
  }
}

/** `72.5` → `72.5 kg`. Sin cifra, sin celda. */
function peso(valor: unknown): string | undefined {
  const kg = numero(valor)
  return kg === undefined || kg <= 0 ? undefined : `${kg} kg`
}

export function propsPlanSuplementacion(entrada: EntradaAdaptador): PlanSuplementacionProps {
  const { data } = entrada
  return {
    ...comunes(entrada),
    paciente: {
      paciente: texto(data.paciente),
      peso: peso(data.pesoKg),
      diagnostico: textoOpcional(data.diagnostico),
    },
    seleccionados: filas(data.seleccionados).map(suplementoDe),
    emision: fechaCorta(data.fecha),
    notas: textoOpcional(data.notas),
    seguimiento: textoOpcional(data.seguimiento),
    /*
     * ⚠ El único formato que puede emitirse SIN FILA: si no hay paciente no hay
     * expediente donde guardarlo, así que no hay folio y el pie compone `Folio`
     * a secas. Es la misma degradación que hoy: v1 imprime ahí una ranura vacía.
     * Se arregla el día que el formulario exija paciente, no desde aquí.
     */
    folio: texto(data.folio),
    rubrica: rubricaDe(entrada.medico),
  }
}

export function renderPlanSuplementacionV2(
  entrada: EntradaAdaptador,
): ReactElement<DocumentProps> {
  return envolver(
    'Plan de suplementación',
    <PlanSuplementacion {...propsPlanSuplementacion(entrada)} />,
  )
}
