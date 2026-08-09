/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.4 · Plan de Suplementación. **No es la emisión.** No
 * lee la base ni Storage, no toca v1, no toca los formularios ni el flujo del médico:
 * el médico y el paciente son inventados y viven aquí abajo.
 *
 * TRES CASOS, Y LOS TRES HACEN FALTA
 *
 *   completo   las dos combinaciones de la entrada y **con peso**
 *   mínimo     un suplemento con lo justo y **SIN PESO**: es la mitad que falta
 *   lleno      la hoja al tope, para ver el corte y la hoja de continuación
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
  type CitaDeControl,
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

/** La cita de control. Colapsa entera en el caso mínimo. */
const CITA: CitaDeControl = {
  fecha: '4 de noviembre de 2026',
  plazo: 'a 3 meses',
  nota: 'Traer control de 25-OH vitamina D y calcio sérico tomados la semana previa.',
}

/** Folios INVENTADOS, con el prefijo `S-` que la lámina compone. */
const FOLIO_COMPLETO = 'S-C9174B2E60A5'
const FOLIO_MINIMO = 'S-3A80F5C1D742'
const FOLIO_LLENO = 'S-71E6D4A08B39'

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
export type CasoSuplementacion = 'completo' | 'minimo' | 'lleno'

const CASOS: Record<
  CasoSuplementacion,
  {
    suplementos: readonly SuplementoIndicado[]
    paciente: ValoresPaciente
    folio: string
    cierre: boolean
  }
> = {
  completo: { suplementos: SUPLEMENTOS_COMPLETO, paciente: PACIENTE_COMPLETO, folio: FOLIO_COMPLETO, cierre: true },
  minimo: { suplementos: SUPLEMENTOS_MINIMO, paciente: PACIENTE_SIN_PESO, folio: FOLIO_MINIMO, cierre: false },
  lleno: { suplementos: SUPLEMENTOS_LLENO, paciente: PACIENTE_COMPLETO, folio: FOLIO_LLENO, cierre: true },
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
        suplementos={c.suplementos}
        emision={EMISION}
        notas={c.cierre ? NOTAS : undefined}
        cita={c.cierre ? CITA : undefined}
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
