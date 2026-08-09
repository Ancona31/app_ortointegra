/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.3 · Receta Médica. **No es la emisión.** No lee
 * la base ni Storage, no toca v1, no toca los formularios ni el flujo del médico: el
 * médico y el paciente son inventados y viven aquí abajo.
 *
 * TRES CASOS, Y LOS TRES HACEN FALTA
 *
 *   completo   LAS CUATRO COMBINACIONES de la entrada, una debajo de otra
 *   mínimo     un medicamento con lo justo, sin recomendaciones y sin alarma
 *   lleno      la hoja al tope, para ver dónde queda el techo de la lista
 *
 * EL CASO COMPLETO SON LAS CUATRO COMBINACIONES, EN ORDEN Y CON SU ALTO MEDIDO
 *
 * Van seguidas a propósito: lo que hay que mirar es que cada ranura que falta se
 * lleve su renglón y NADA MÁS —ni un hueco, ni un rótulo huérfano, ni una línea
 * cruzada—, y eso solo se ve comparando una fila con la de al lado.
 *
 *     01  completa            ancla · genérico · vía · indicación    **75 pt**
 *     02  sin genérico        ancla · vía · indicación               **62 pt**
 *     03  sin indicación      ancla · genérico · vía                 **58 pt**
 *     04  solo el ancla       ancla · vía                            **45 pt**
 *
 * Las cuatro cifras están fijadas en `src/lib/tests/recetaMedica.test.ts`, medidas
 * sobre el PDF: 75 − 13 = 62, 75 − 17 = 58, 75 − 30 = 45. Los 13 son el
 * interlineado del genérico y los 17 el de la indicación más su aire de 3.
 *
 * **La vía no es una de las combinaciones y por eso no aparece en la tabla:** nunca
 * colapsa —sin dato es oral (II.3 §2)— y desde la decisión de Angel las trece van en
 * bloque negativo, así que aporta sus 16.5 pt a las cuatro filas por igual. Lo que sí
 * se ve entre ellas es la regla 1 de 2.H: `VÍA INTRAMUSCULAR` sale visiblemente más
 * ancha que `VÍA ORAL` y ninguna se abrevia.
 *
 * El mínimo enseña el colapso del resto: sin diagnóstico el riel se queda en una
 * fila, sin indicación la entrada baja a tres renglones y sin los dos bloques de
 * cierre la fila de firma sube hasta el contador.
 *
 * SIN GUÍAS, como los otros dos formatos: un documento tiene que verse como un
 * documento.
 *
 * Cada caso es un `Page` propio, que es como se compone un formato (2.M): así la
 * paginación de cada uno se cuenta sola.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { ReactElement } from 'react'
import RecetaMedica, {
  type MedicamentoRecetado,
} from '@/lib/pdf/v2/formatos/RecetaMedica'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import type { ValoresPaciente } from '@/lib/pdf/v2/BloquePaciente'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Paciente del caso completo. INVENTADO. **Cuatro celdas del riel más el
 * diagnóstico**, que son las cinco que esta lámina compone: `fecha` y `hora` no se
 * pasan porque en este formato no viven en el riel — suben a la celda `Emisión` del
 * riel derecho del bloque de título.
 */
const PACIENTE_COMPLETO: ValoresPaciente = {
  paciente: 'María Fernanda Ruiz Ortega',
  edad: '54 años',
  sexo: 'Femenino',
  expediente: 'EXP-004821',
  diagnostico: 'Gonartrosis bilateral grado III con sinovitis reactiva',
}

/** Paciente del caso mínimo: sin diagnóstico, para ver colapsar la fila inferior. */
const PACIENTE_MINIMO: ValoresPaciente = {
  paciente: 'Jorge Alberto Medina Salas',
  edad: '61 años',
}

/**
 * LAS CUATRO COMBINACIONES, EN EL ORDEN DE LA TABLA DE LA CABECERA.
 *
 * Cada una quita UNA ranura respecto de la anterior, para que la diferencia entre dos
 * filas contiguas sea siempre un solo renglón y se pueda leer a ojo.
 *
 * Las indicaciones son de una línea a propósito: con dos, la `01` mediría 89 y la
 * comparación con la `02` dejaría de ser el interlineado del genérico.
 */
const MEDICAMENTOS_COMPLETO: readonly MedicamentoRecetado[] = [
  // 01 · completa — 75 pt
  {
    comercial: 'Meloxicam Zydus',
    presentacion: 'Tabletas 15 mg, caja con 10',
    generico: 'Meloxicam',
    via: 'Oral',
    indicacion: 'Una tableta cada 24 horas, después del desayuno, por 7 días.',
  },
  // 02 · sin genérico — 62 pt. La ranura colapsa entera: sin rótulo y sin línea.
  {
    comercial: 'Diclofenaco Sódico Pisa',
    presentacion: 'Solución inyectable 75 mg / 3 mL',
    via: 'Intramuscular',
    indicacion: 'Una ampolleta cada 12 horas por 3 días, por personal de salud.',
  },
  // 03 · sin indicación — 58 pt
  {
    comercial: 'Voltaren Emulgel',
    presentacion: 'Gel 1 %, tubo con 60 g',
    generico: 'Diclofenaco dietilamonio',
    via: 'Tópica',
  },
  // 04 · solo el ancla — 45 pt. Sin vía declarada: sale oral por defecto (II.3 §2).
  { comercial: 'Tempra', presentacion: 'Tabletas 500 mg, caja con 20' },
]

/** Un solo medicamento con lo justo: la entrada mínima del formato. */
const MEDICAMENTOS_MINIMO: readonly MedicamentoRecetado[] = [
  {
    comercial: 'Naproxeno Sódico Ultra',
    presentacion: 'Tabletas 550 mg, caja con 10',
    generico: 'Naproxeno sódico',
  },
]

/**
 * El caso al tope. Doce entradas del estado más caro —los cinco datos con la vía en
 * negativo y una indicación de dos líneas— para ver a ojo dónde queda el techo que
 * la medición calcula, y si el corte llega con el hueco que la cabecera del formato
 * reporta (sin 2.N no hay encabezado de continuación).
 */
const MEDICAMENTOS_LLENO: readonly MedicamentoRecetado[] = Array.from(
  { length: 12 },
  (_, i) => ({
    comercial: `Fármaco de control ${i + 1}`,
    presentacion: 'Tabletas 500 mg, caja con 20',
    generico: 'Denominación genérica de control',
    via: 'Subcutánea',
    indicacion:
      'Una tableta cada 8 horas durante diez días, con alimentos, sin suspender antes de terminar el esquema.',
  }),
)

/** Cuerpo del bloque de recomendaciones generales. Un solo párrafo, sin viñetas. */
const RECOMENDACIONES =
  'Mantenga reposo relativo durante las primeras 48 horas y aplique frío local tres veces al día por 15 minutos. No suspenda el tratamiento antes de terminarlo aunque el dolor ceda, y acuda a su cita de control con los estudios solicitados.'

/**
 * Cuerpo del bloque de alarma. Entra por 2.J, que lo compone con la raya del
 * sistema: son signos que se enumeran sin orden, no una secuencia.
 */
const SIGNOS_DE_ALARMA = [
  '- Fiebre mayor de 38.5 °C que no cede con el antipirético.',
  '- Aumento súbito del dolor, del enrojecimiento o de la temperatura de la articulación.',
  '- Pérdida de fuerza, hormigueo persistente o incapacidad para apoyar la extremidad.',
].join('\n')

/** Folios INVENTADOS, con el prefijo `P-` que la lámina compone. */
const FOLIO_COMPLETO = 'P-B8570E3FA164'
const FOLIO_MINIMO = 'P-6C41A9D2E870'
const FOLIO_LLENO = 'P-4F1D0A9C7B23'

/** Emisión ya compuesta: token corto de fecha + hora, con la raya del sistema. */
const EMISION = '7 ago 2026 · 10:45'

/**
 * Token de verificación INVENTADO, y lo que va dentro del QR.
 *
 * Regla 3 de 2.R: **solo el token de acceso**, nunca el folio ni datos del paciente.
 * Se genera aquí, fuera del componente, que es donde la regla se puede vigilar.
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

/**
 * ⚠️ **UN CASO POR PDF, Y ANTES ERAN LOS TRES EN UNO.**
 *
 * Cada caso es un **documento entero**, no una hoja de un documento común. No es una
 * comodidad del taller: es lo que ocurre en emisión real —un documento es un formato,
 * un `Document` con un `Page`— y componer tres `Page` en un `Document` **produce un
 * resultado que no existe en producción**.
 *
 * Y no solo mentía: rompía. En la pasada de reparto el renderer entrega `pageNumber`
 * ABSOLUTO del documento y no `subPageNumber`, así que la primera hoja del segundo
 * caso se repartía como si fuera una continuación y luego se pintaba con el
 * encabezado completo. Medido: 13 ítems donde caben 10, con el paso de fila
 * comprimido de 50 a 40.99 pt — una violación de I.3.4 sin un solo aviso. Ver la
 * cabecera de 2.N.
 */
export type CasoReceta = 'completo' | 'minimo' | 'lleno'

const CASOS: Record<CasoReceta, { medicamentos: readonly MedicamentoRecetado[]; paciente: ValoresPaciente; folio: string; cierre: boolean }> = {
  completo: { medicamentos: MEDICAMENTOS_COMPLETO, paciente: PACIENTE_COMPLETO, folio: FOLIO_COMPLETO, cierre: true },
  minimo: { medicamentos: MEDICAMENTOS_MINIMO, paciente: PACIENTE_MINIMO, folio: FOLIO_MINIMO, cierre: false },
  lleno: { medicamentos: MEDICAMENTOS_LLENO, paciente: PACIENTE_COMPLETO, folio: FOLIO_LLENO, cierre: true },
}

function HojaReceta({
  medico,
  acentoHex,
  qr,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  qr: string
  caso: CasoReceta
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const comun = {
    medico: medicoMembrete(medico),
    // El teléfono llega YA ROTULADO: 2.B coloca, no rotula.
    consultorio: { domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` },
    panel: { variante: 'logo', acento, logo: medico.logo } as const,
    acento,
  }

  const c = CASOS[caso]

  return (
    <Document title={`Receta médica — taller · ${caso}`}>
      <RecetaMedica
        {...comun}
        paciente={c.paciente}
        medicamentos={c.medicamentos}
        emision={EMISION}
        recomendaciones={c.cierre ? RECOMENDACIONES : undefined}
        signosDeAlarma={c.cierre ? SIGNOS_DE_ALARMA : undefined}
        folio={c.folio}
        qr={qr}
      />
    </Document>
  )
}

/** Genera el blob de los tres casos. Se llama desde el cliente. */
export async function generarPdfReceta(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  // PNG y sin margen: `<Image>` de react-pdf solo acepta JPG, PNG o base64 (I.3.8),
  // y el aire alrededor del código lo pone la fila de cierre, no el ráster.
  const qr = await QRCode.toDataURL(TOKEN_VERIFICACION, { margin: 0, width: 224 })
  const elemento: ReactElement<DocumentProps> = (
    <HojaReceta
      medico={medico}
      acentoHex={acentoHex}
      qr={qr}
      caso={caso in CASOS ? (caso as CasoReceta) : 'completo'}
    />
  )
  return pdf(elemento).toBlob()
}
