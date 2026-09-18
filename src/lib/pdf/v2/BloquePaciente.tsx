/**
 * Sistema de documentos v3 — 2.D · **BloquePaciente**. «Identificar al paciente en la
 * hoja. Es un requisito de SEGURIDAD, no de maquetación.»
 *
 * Se compone sobre 2.F: este archivo no dibuja ninguna celda. Lo que aporta es **qué
 * dato va en qué celda y con qué rótulo**, que es lo único que los nueve formatos
 * necesitan declarar distinto.
 *
 * ── CAMBIOS v3 ──────────────────────────────────────────────────────────────
 *
 * 1. **LA FICHA LA DECLARA EL FORMATO, FILA A FILA.** En v2 este componente tenía una
 *    rama por lámina —siete rieles distintos cableados aquí dentro— y el formato
 *    elegía con `lamina`. Ahora el formato pasa sus filas y este archivo resuelve el
 *    rótulo por defecto de cada campo. Es el mismo reparto que 2.G ya tenía con sus
 *    ranuras, y borra las siete ramas.
 *
 * 2. **EL DIAGNÓSTICO SE IMPRIME UNA SOLA VEZ POR DOCUMENTO** (brief 00 §5.2), en su
 *    celda de la ficha, con `maxLines: 3`. En Consentimiento y Denegación **no se
 *    repite en la declaración**, que cita el procedimiento. Era la redundancia más
 *    visible del sistema: el mismo texto clínico dos y tres veces en la misma hoja.
 *
 * 3. **LA VARIANTE `reducido` SE RETIRA.** Era la línea de paciente de las hojas de
 *    continuación, y en v3 la compone `EncabezadoHoja` con su propio rol. Lo que este
 *    archivo conserva es `resumenPaciente()`, que **redacta** esa línea: la cadena
 *    tiene que salir de un solo sitio o la hoja 2 dejará de decir lo que dice la 1.
 */

import type { ReactElement } from 'react'
import RielDatos, { type CalibracionFicha, type CeldaRiel } from './RielDatos'

/**
 * Los datos que la ficha puede imprimir. **Todos opcionales salvo el paciente**: lo
 * que no viene colapsa su celda, y eso es el contrato de 2.E aplicado al riel.
 *
 * Los valores llegan **ya compuestos y con su unidad** —`54 años`, `72.5 kg`, `2
 * días`, `12 de agosto de 2026`, `30 días naturales`—. Este componente coloca; no
 * rotula, no convierte y no calcula.
 */
export interface ValoresPaciente {
  readonly paciente: string
  readonly edad?: string
  readonly sexo?: string
  readonly expediente?: string
  readonly peso?: string
  readonly diagnostico?: string
  readonly fecha?: string
  readonly hora?: string
  /** Vigencia de la cotización. Un recibo no caduca: ahí no existe. */
  readonly vigencia?: string
  /** Hospital o lugar. **Bloquea emisión** en Internamiento, como el paciente. */
  readonly hospital?: string
  readonly tipoInternamiento?: string
  readonly diasEstimados?: string
  /** Clasificación ASA, en romanos. */
  readonly asa?: string
  readonly fechaIngreso?: string
  /** Familiar o responsable. **Campo vacío requerido**: sin dato deja la línea. */
  readonly familiar?: string
  readonly lugar?: string
}

export type CampoPaciente = keyof ValoresPaciente

/**
 * El rótulo por defecto de cada campo, en capitalización de oración: 2.F los compone
 * en versalita. Están aquí y no en el formato para que dos documentos no rotulen el
 * mismo dato distinto — que es lo que pasaba con `Hospital o lugar` y `Hospital o
 * clínica` en las dos láminas que lo componían.
 */
const ROTULO: Record<CampoPaciente, string> = {
  paciente: 'Paciente',
  edad: 'Edad',
  sexo: 'Sexo',
  expediente: 'Expediente',
  peso: 'Peso',
  diagnostico: 'Diagnóstico',
  fecha: 'Fecha',
  hora: 'Hora',
  vigencia: 'Vigencia',
  hospital: 'Hospital o lugar',
  tipoInternamiento: 'Tipo de internamiento',
  diasEstimados: 'Días est.',
  asa: 'ASA',
  fechaIngreso: 'Ingreso',
  familiar: 'Familiar o responsable',
  lugar: 'Lugar',
}

/** Techo de renglones por campo. Uno declarado: el diagnóstico, a 3 (brief 00 §5.2). */
const MAX_LINEAS: Partial<Record<CampoPaciente, number>> = {
  diagnostico: 3,
}

/** Los dos campos vacíos requeridos del sistema. Ver `requerido` en `CeldaRiel`. */
const REQUERIDO: Partial<Record<CampoPaciente, boolean>> = {
  familiar: true,
}

export interface CeldaPaciente {
  readonly campo: CampoPaciente
  /** Columnas de `RIEL_CELDA`. Doce por fila llenan la caja. */
  readonly columnas: number
  /**
   * Rótulo propio, cuando el documento nombra el dato de otra forma. Uno lo usa: la
   * Cotización, que rotula `fecha` como `Fecha de emisión`.
   */
  readonly etiqueta?: string
  /** Fuerza el campo vacío requerido en un campo que por defecto colapsa. */
  readonly requerido?: boolean
}

export interface BloquePacienteProps {
  readonly valores: ValoresPaciente
  /**
   * Las filas de la ficha, declaradas por el formato. Cada fila debería sumar 12
   * columnas: con menos, la ficha no llega al borde derecho.
   */
  readonly filas: readonly (readonly CeldaPaciente[])[]
  /** `declaracion` en Consentimiento y Denegación. Sin ella, la del chasis. */
  readonly calibracion?: CalibracionFicha
}

function aCelda(celda: CeldaPaciente, valores: ValoresPaciente): CeldaRiel {
  return {
    clave: celda.campo,
    etiqueta: celda.etiqueta ?? ROTULO[celda.campo],
    valor: valores[celda.campo],
    columnas: celda.columnas,
    requerido: celda.requerido ?? REQUERIDO[celda.campo],
    maxLineas: MAX_LINEAS[celda.campo],
  }
}

/** 2.D · `BloquePaciente`. */
export default function BloquePaciente({
  valores,
  filas,
  calibracion,
}: BloquePacienteProps): ReactElement {
  return (
    <RielDatos
      variante="celdas"
      calibracion={calibracion}
      filas={filas.map((fila) => fila.map((celda) => aCelda(celda, valores)))}
    />
  )
}

/**
 * LA LÍNEA DE PACIENTE DE LAS HOJAS DE CONTINUACIÓN, redactada aquí.
 *
 * `Paciente · María Fernanda Ruiz Ortega · 54 años · Exp. EXP-004821`
 *
 * Vive en este archivo y no en 2.V por la razón de siempre: es la misma
 * identificación que imprime la ficha de la hoja 1, y con dos sitios de redacción
 * bastaría tocar uno para que las dos hojas del mismo documento dijeran cosas
 * distintas del mismo paciente.
 *
 * `extra` es lo que un formato añade al final. Hoy dos lo usan: Internamiento cuelga
 * el hospital —es el único con una quinta pieza— y Suplementación el peso, porque en
 * ese documento la dosis se calcula contra él y la hoja 2 lo necesita a la vista.
 */
export function resumenPaciente(
  valores: ValoresPaciente,
  extra: readonly string[] = [],
): string {
  const expediente =
    valores.expediente === undefined || valores.expediente.trim() === ''
      ? undefined
      : `Exp. ${valores.expediente}`

  return [ROTULO.paciente, valores.paciente, valores.edad, expediente, ...extra]
    .filter((pieza): pieza is string => pieza !== undefined && pieza.trim() !== '')
    .join(' · ')
}
