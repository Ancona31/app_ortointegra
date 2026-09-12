/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.4 · Plan de Suplementación. **No es la emisión.** No
 * lee la base ni Storage, no toca v1, no toca los formularios ni el flujo del médico:
 * el médico y el paciente son inventados y viven aquí abajo.
 *
 * CINCO CASOS
 *
 *   completo   las dos combinaciones de la entrada y **con peso**
 *   mínimo     un suplemento con lo justo y **SIN PESO**: es la mitad que falta
 *   lleno      la hoja al tope, para ver el corte y la hoja de continuación
 *   catálogo   **los cuatro suplementos reales del formato v1**, con sus textos
 *   marca larga  el mismo, con una marca que no cabe en la columna
 *
 * EL CASO `catálogo` NO ES UNA DEMOSTRACIÓN: ES LA COMPARACIÓN CON v1
 *
 * Los cuatro suplementos y sus textos salen del catálogo del formato vivo, para poner los
 * dos PDF lado a lado y ver qué cambia. Lo que hay que mirar es que **la justificación de
 * v2 ocupa el sitio de la «indicación» de v1** —el beneficio del catálogo, escrito en
 * lenguaje para el paciente— y que ahí el texto real es MUCHO más largo que el de los
 * otros tres casos: cuatro renglones por entrada donde el `completo` compone dos.
 *
 * **Y ES DONDE SE VE LA MARCA COMERCIAL, EN BLOQUE EN NEGATIVO.** Solo el Omega-3 la lleva
 * —`Ultimate Omega · Nordic Naturals`—, así que los otros tres enseñan lo contrario: la
 * ranura `marca` colapsa sin dejar hueco, igual que la vía de Receta cuando no viene.
 *
 * EL QUINTO CASO ES EL LÍMITE DEL NEGATIVO
 *
 * `marca larga` compone la misma lista con una marca de 78 caracteres, que **no cabe en la
 * columna de 453.75 pt**. Lo que hay que mirar es que el bloque NO se sale de la columna ni
 * se recorta: rompe a dos renglones dentro del negro, que es lo que las reglas 1 y 3 de 2.H
 * obligan. Y que a dos renglones **deja de leerse como una etiqueta**.
 *
 * ⚠ **v1 IMPRIME UNA COLUMNA MÁS: LA PRESENTACIÓN** —`100 mcg/cápsula`, `640
 * mg/cápsula`—. Este caso NO la compone, porque el formato de v2 no tiene ranura para
 * ella. Ver el reporte del paso: el hueco está en el FORMATO, no en el chasis.
 *
 * EL MÍNIMO ES LA VERIFICACIÓN VISIBLE DE II.4 §6, Y POR ESO VA SIN PESO
 *
 * «Emitir el mismo plan dos veces, con peso y sin peso.» Con peso, la celda
 * `PESO · BASE DEL CÁLCULO` aparece en el riel —con su filete de acento a la derecha— y
 * el rótulo `Dosis calculada para 72.5 kg` junto al título de la lista. Sin peso
 * **desaparecen los dos**, las celdas que quedan se ensanchan hasta llenar el riel y la
 * regla de acento se va con la celda en vez de quedar dibujada contra el margen. Las
 * dosis impresas son las mismas: se leen en las entradas de los dos casos.
 *
 * EL COMPLETO SON LAS DOS COMBINACIONES DE LA ENTRADA, CON SU ALTO MEDIDO
 *
 *     01  con justificación de dos líneas   **66 pt**
 *     02  con justificación de una línea    **48 pt**
 *     03  solo el ancla                     **28 pt**
 *     04  sin dosis: el ancla se queda con el nombre y no cuelga la raya
 *
 * Las cifras están fijadas en `src/lib/tests/planSuplementacion.test.ts`, medidas sobre
 * el PDF: 48 − 18 = 28, y 18 es el interlineado de `texto.corrido`. **La entrada no
 * tiene más estados que esos**, y eso es lo que hay que mirar: donde Receta tiene
 * cuatro ranuras, esta tiene dos, y las dos que faltan no dejan ni rótulo ni hueco.
 *
 * SIN GUÍAS, como los otros tres formatos: un documento tiene que verse como un
 * documento.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { ReactElement } from 'react'
import PlanSuplementacion, {
  type SuplementoIndicado,
} from '@/lib/pdf/v2/formatos/PlanSuplementacion'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import type { ValoresPaciente } from '@/lib/pdf/v2/BloquePaciente'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Paciente del caso completo. INVENTADO. **Cinco celdas del riel más el peso**, que son
 * las seis que esta lámina compone: `fecha` y `hora` no se pasan porque en este formato
 * no viven en el riel — suben a la celda `Emisión` del riel derecho del bloque de
 * título, igual que en Receta.
 *
 * El peso llega con su unidad: 2.D coloca, no rotula ni convierte.
 */
const PACIENTE_COMPLETO: ValoresPaciente = {
  paciente: 'María Fernanda Ruiz Ortega',
  edad: '54 años',
  sexo: 'Femenino',
  expediente: 'EXP-004821',
  peso: '72.5 kg',
  diagnostico: 'Osteopenia con deficiencia documentada de vitamina D',
}

/** Paciente del caso mínimo: SIN PESO. Es la otra mitad de II.4 §6. */
const PACIENTE_SIN_PESO: ValoresPaciente = {
  paciente: 'Jorge Alberto Medina Salas',
  edad: '61 años',
  sexo: 'Masculino',
  expediente: 'EXP-007133',
  diagnostico: 'Sarcopenia en seguimiento',
}

/**
 * LAS COMBINACIONES DE LA ENTRADA, EN EL ORDEN DE LA TABLA DE LA CABECERA.
 *
 * Cada una quita algo respecto de la anterior, para que la diferencia entre dos filas
 * contiguas se pueda leer a ojo. La última no quita una ranura sino MEDIA: sin dosis,
 * el ancla se reduce al nombre y la raya del sistema no queda colgando.
 */
const SUPLEMENTOS_COMPLETO: readonly SuplementoIndicado[] = [
  // 01 · justificación de dos líneas — 66 pt
  {
    nombre: 'Colecalciferol',
    dosis: '4 000 UI cada 24 horas',
    justificacion:
      'Deficiencia documentada de 25-OH vitamina D en 14 ng/mL, con osteopenia en densitometría de columna lumbar. Se reevalúa a los tres meses.',
  },
  // 02 · justificación de una línea — 48 pt
  {
    nombre: 'Citrato de calcio',
    dosis: '500 mg cada 12 horas con alimentos',
    justificacion: 'Aporte insuficiente en la dieta habitual.',
  },
  // 03 · solo el ancla — 28 pt. La justificación colapsa entera.
  { nombre: 'Magnesio quelado', dosis: '300 mg por la noche' },
  // 04 · sin dosis: el ancla se queda con el nombre, sin raya suelta.
  { nombre: 'Colágeno hidrolizado con vitamina C' },
]

/** Un solo suplemento con lo justo: la entrada mínima del formato. */
const SUPLEMENTOS_MINIMO: readonly SuplementoIndicado[] = [
  { nombre: 'Colecalciferol', dosis: '2 000 UI cada 24 horas' },
]

/**
 * El caso al tope. Los NUEVE del reparto de la lámina, del estado más caro —ancla y
 * justificación de dos líneas—, que es el que reparte 6 y 3 entre las dos hojas.
 */
const SUPLEMENTOS_LLENO: readonly SuplementoIndicado[] = Array.from(
  { length: 9 },
  (_, i) => ({
    nombre: `Suplemento de control ${i + 1}`,
    dosis: '500 mg cada 12 horas',
    justificacion:
      'Aporte insuficiente documentado en la valoración nutricional, con reevaluación programada al terminar el esquema de tres meses.',
  }),
)

/**
 * Cuerpo de las notas adicionales. Entra por 2.J, que lo compone con la raya del
 * sistema. Son dos párrafos: es lo que la lámina compone en ese bloque.
 */
const NOTAS = [
  'Tome los suplementos con alimentos y separados al menos dos horas de cualquier antibiótico o de la levotiroxina.',
  'No duplique la dosis si olvida una toma. Suspenda y avise al consultorio si aparece náusea persistente, estreñimiento marcado o sed excesiva.',
].join('\n\n')

/**
 * La cita de control. Colapsa entera en el caso mínimo.
 *
 * TEXTO LIBRE, que es lo que el formulario guarda en `seguimiento` y lo que v1 imprime.
 * Se redacta largo a propósito: es el caso que enseña que la caja crece con su contenido.
 */
const CITA =
  'Control a 3 meses, el 4 de noviembre de 2026. Traer 25-OH vitamina D y calcio sérico tomados la semana previa.'

/**
 * LOS CUATRO SUPLEMENTOS DEL CATÁLOGO DE v1, con sus textos REALES.
 *
 * No son datos inventados como los de los otros tres casos: son las cadenas del formato
 * vivo, y por eso este caso sirve de comparación. **La «indicación» de v1 entra por la
 * ranura de justificación de v2**, que es la que ocupa su sitio.
 *
 * ⚠ **FALTA LA PRESENTACIÓN.** v1 imprime una cuarta columna —`100 mcg/cápsula`, `640
 * mg/cápsula`, derivada del catálogo— que aquí no aparece: `SuplementoIndicado` no tiene
 * ese campo. No se añade por su cuenta; queda reportado.
 */
const SUPLEMENTOS_CATALOGO: readonly SuplementoIndicado[] = [
  {
    nombre: 'Vitamina D3',
    dosis: '5,000 UI/día',
    justificacion:
      'Ayuda a que tus huesos absorban el calcio correctamente y se mantengan fuertes. Es especialmente importante después de una cirugía de columna o articulaciones para que la recuperación sea más rápida y sólida.',
  },
  {
    nombre: 'Vitamina K2 (MK-7)',
    dosis: '100 mcg/día',
    justificacion:
      'Trabaja en equipo con la Vitamina D3 para que el calcio llegue exactamente a donde debe estar: tus huesos. Evita que ese calcio se acumule en lugares donde puede hacer daño, como las arterias o los ligamentos.',
  },
  {
    nombre: 'Colágeno Hidrolizado + Vitamina C',
    dosis: '10–15 g + 500 mg en ayunas',
    justificacion:
      'El colágeno es el material de construcción natural de tus tendones, ligamentos y los discos que amortiguan tu columna. Tomarlo en ayunas con vitamina C ayuda a reparar y fortalecer esos tejidos desde adentro.',
  },
  {
    nombre: 'Omega-3 (EPA/DHA)',
    dosis: '2–3 g/día con alimentos',
    // El único con marca: los otros tres colapsan la ranura sin dejar hueco.
    marca: 'Ultimate Omega · Nordic Naturals',
    justificacion:
      'Reduce la inflamación de forma natural en articulaciones, nervios y discos de la columna. A dosis terapéuticas ayuda a controlar el dolor crónico sin irritar el estómago como lo hacen algunos antiinflamatorios convencionales.',
  },
]

/**
 * LA MISMA LISTA CON UNA MARCA QUE NO CABE. 78 caracteres contra los ~60 que entran en la
 * columna: es el caso que enseña el techo del bloque en negativo. INVENTADA.
 */
const SUPLEMENTOS_MARCA_LARGA: readonly SuplementoIndicado[] = SUPLEMENTOS_CATALOGO.map(
  (suplemento, i) =>
    i === 3
      ? {
          ...suplemento,
          marca:
            'Ultimate Omega Professional Formula · Nordic Naturals Laboratories Norway',
        }
      : suplemento,
)

/** Folios INVENTADOS, con el prefijo `S-` que la lámina compone. */
const FOLIO_COMPLETO = 'S-C9174B2E60A5'
const FOLIO_MINIMO = 'S-3A80F5C1D742'
const FOLIO_LLENO = 'S-71E6D4A08B39'
const FOLIO_CATALOGO = 'S-4D82F0B93E17'
const FOLIO_MARCA_LARGA = 'S-6C09A1E45D82'

/** Emisión ya compuesta: token corto de fecha + hora, con la raya del sistema. */
const EMISION = '4 ago 2026 · 10:15'

/**
 * Token de verificación INVENTADO, y lo que va dentro del QR.
 *
 * Regla 3 de 2.R: **solo el token de acceso**, nunca el folio ni datos del paciente. Se
 * genera aquí, fuera del componente, que es donde la regla se puede vigilar.
 */
const TOKEN_VERIFICACION = 'https://spinus.com.mx/v/DEMOSTRACION-DE-TALLER'

/** Las dos líneas de cédula, redactadas por quien llama (2.B no las inventa). */
function medicoMembrete(medico: MedicoFicticio): MedicoMembrete {
  return {
    nombre: medico.nombre,
    especialidad: medico.especialidad,
    universidad: medico.universidad,
    cedulas: [
      `Céd. Prof. ${medico.cedulaProfesional}`,
      `Céd. Esp. ${medico.cedulaEspecialidad}`,
    ],
  }
}

/** Un caso es un documento entero, no una hoja de un documento común (ver 2.N). */
export type CasoSuplementacion =
  | 'completo'
  | 'minimo'
  | 'lleno'
  | 'catalogo'
  | 'marcaLarga'

const CASOS: Record<
  CasoSuplementacion,
  {
    seleccionados: readonly SuplementoIndicado[]
    paciente: ValoresPaciente
    folio: string
    cierre: boolean
  }
> = {
  completo: { seleccionados: SUPLEMENTOS_COMPLETO, paciente: PACIENTE_COMPLETO, folio: FOLIO_COMPLETO, cierre: true },
  minimo: { seleccionados: SUPLEMENTOS_MINIMO, paciente: PACIENTE_SIN_PESO, folio: FOLIO_MINIMO, cierre: false },
  lleno: { seleccionados: SUPLEMENTOS_LLENO, paciente: PACIENTE_COMPLETO, folio: FOLIO_LLENO, cierre: true },
  catalogo: { seleccionados: SUPLEMENTOS_CATALOGO, paciente: PACIENTE_COMPLETO, folio: FOLIO_CATALOGO, cierre: true },
  marcaLarga: { seleccionados: SUPLEMENTOS_MARCA_LARGA, paciente: PACIENTE_COMPLETO, folio: FOLIO_MARCA_LARGA, cierre: true },
}

function HojaSuplementacion({
  medico,
  acentoHex,
  qr,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  qr: string
  caso: CasoSuplementacion
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const c = CASOS[caso]

  return (
    <Document title={`Plan de suplementación — taller · ${caso}`}>
      <PlanSuplementacion
        medico={medicoMembrete(medico)}
        // El teléfono llega YA ROTULADO: 2.B coloca, no rotula.
        consultorio={{ domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` }}
        panel={{ variante: 'logo', acento, logo: medico.logo }}
        acento={acento}
        paciente={c.paciente}
        seleccionados={c.seleccionados}
        emision={EMISION}
        notas={c.cierre ? NOTAS : undefined}
        seguimiento={c.cierre ? CITA : undefined}
        folio={c.folio}
        qr={qr}
      />
    </Document>
  )
}

/** Genera el blob del caso pedido. Se llama desde el cliente. */
export async function generarPdfSuplementacion(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  // PNG y sin margen: `<Image>` de react-pdf solo acepta JPG, PNG o base64 (I.3.8),
  // y el aire alrededor del código lo pone la fila de cierre, no el ráster.
  const qr = await QRCode.toDataURL(TOKEN_VERIFICACION, { margin: 0, width: 224 })
  const elemento: ReactElement<DocumentProps> = (
    <HojaSuplementacion
      medico={medico}
      acentoHex={acentoHex}
      qr={qr}
      caso={caso in CASOS ? (caso as CasoSuplementacion) : 'completo'}
    />
  )
  return pdf(elemento).toBlob()
}
