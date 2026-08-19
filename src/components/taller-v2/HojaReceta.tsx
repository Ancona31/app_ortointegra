/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.3 · Receta Médica. **No es la emisión.** No lee
 * la base ni Storage, no toca v1, no toca los formularios ni el flujo del médico: el
 * médico y el paciente son inventados y viven aquí abajo.
 *
 * CUATRO CASOS, Y LOS CUATRO HACEN FALTA
 *
 *   completo   LAS CUATRO COMBINACIONES de la entrada, una debajo de otra
 *   mínimo     un medicamento con lo justo, sin recomendaciones y sin alarma
 *   siete      LA COTA DE LA REGRESIÓN: los siete de v1 con recomendaciones
 *   lleno      la hoja al tope, para ver dónde queda el techo de la lista
 *
 * EL CASO COMPLETO SON LAS CUATRO COMBINACIONES, EN ORDEN Y CON SU ALTO MEDIDO
 *
 * Van seguidas a propósito: lo que hay que mirar es que cada ranura que falta se
 * lleve su renglón y NADA MÁS —ni un hueco, ni un rótulo huérfano, ni una línea
 * cruzada—, y eso solo se ve comparando una fila con la de al lado.
 *
 *     01  completa            ancla · genérico · vía · indicación    **58.5 pt**
 *     02  sin genérico        ancla · vía · indicación               **45.5 pt**
 *     03  sin indicación      ancla · genérico · vía                 **41.5 pt**
 *     04  solo el ancla       ancla · vía                            **28.5 pt**
 *
 * Eran 75 · 62 · 58 · 45. Los 16.5 pt que bajan las cuatro son la vía, que dejó de
 * ocupar renglón propio y va a la derecha del ancla. Las cifras están fijadas en
 * `src/lib/tests/recetaMedica.test.ts`, medidas sobre el PDF: 58.5 − 13 = 45.5,
 * 58.5 − 17 = 41.5, 58.5 − 30 = 28.5. Los 13 son el interlineado del genérico y los
 * 17 el de la indicación más su aire de 3.
 *
 * ⚠ **EL GENÉRICO SE PROBÓ EN LA LÍNEA DEL ANCLA Y SE BAJÓ. NO ES UN OLVIDO.**
 * Ahorraba otros 13 pt por entrada, pero con nombres comerciales reales el ancla
 * envuelve y el genérico caía pegado a la indicación, leyéndose como parte de la
 * pauta. La decisión está en `genericoMedicamento` de 2.G, y **este caso de taller es
 * donde se vio**: mira la `02` del caso de siete.
 *
 * **La vía no es una de las combinaciones y por eso no aparece en la tabla:** nunca
 * colapsa —sin dato es oral (II.3 §2)— y las trece van en bloque negativo. Lo que sí
 * se ve entre las filas es la regla 1 de 2.H: `VÍA INTRAMUSCULAR` sale visiblemente
 * más ancha que `VÍA ORAL`, ninguna se abrevia, y **las cuatro cierran a la derecha
 * en el mismo punto** — creciendo hacia la izquierda, no hacia fuera de la caja.
 *
 * ⚠ **Y SU CUERPO BAJÓ DE 8 A 6.5 pt.** Compartiendo renglón con el ancla, el bloque
 * en negativo le disputaba la jerarquía al nombre comercial: la versalita sobre negro
 * suma fondo, tracking y caja al cuerpo. Es una calibración propia de la lámina en
 * 2.H — el badge `URGENTE` de Imagenología comparte componente y no se movió.
 *
 * El mínimo enseña el colapso del resto: sin diagnóstico el riel se queda en una
 * fila, sin indicación la entrada baja a dos renglones y sin bloque de cierre la
 * fila de firma sube hasta el contador.
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
    nombre_comercial: 'Meloxicam Zydus',
    presentacion: 'Tabletas 15 mg, caja con 10',
    principio_activo: 'Meloxicam',
    via_administracion: 'Oral',
    indicacion: 'Una tableta cada 24 horas, después del desayuno, por 7 días.',
  },
  // 02 · sin genérico — 62 pt. La ranura colapsa entera: sin rótulo y sin línea.
  {
    nombre_comercial: 'Diclofenaco Sódico Pisa',
    presentacion: 'Solución inyectable 75 mg / 3 mL',
    via_administracion: 'Intramuscular',
    indicacion: 'Una ampolleta cada 12 horas por 3 días, por personal de salud.',
  },
  // 03 · sin indicación — 58 pt
  {
    nombre_comercial: 'Voltaren Emulgel',
    presentacion: 'Gel 1 %, tubo con 60 g',
    principio_activo: 'Diclofenaco dietilamonio',
    via_administracion: 'Tópica',
  },
  // 04 · solo el ancla — 45 pt. Sin vía declarada: sale oral por defecto (II.3 §2).
  { nombre_comercial: 'Tempra', presentacion: 'Tabletas 500 mg, caja con 20' },
]

/** Un solo medicamento con lo justo: la entrada mínima del formato. */
const MEDICAMENTOS_MINIMO: readonly MedicamentoRecetado[] = [
  {
    nombre_comercial: 'Naproxeno Sódico Ultra',
    presentacion: 'Tabletas 550 mg, caja con 10',
    principio_activo: 'Naproxeno sódico',
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
    nombre_comercial: `Fármaco de control ${i + 1}`,
    presentacion: 'Tabletas 500 mg, caja con 20',
    principio_activo: 'Denominación genérica de control',
    via_administracion: 'Subcutánea',
    indicacion:
      'Una tableta cada 8 horas durante diez días, con alimentos, sin suspender antes de terminar el esquema.',
  }),
)

/**
 * EL CASO DE LA REGRESIÓN — **siete medicamentos con recomendaciones, en una hoja.**
 *
 * No es un cuarto caso de demostración: es la COTA que los betatesters reportaron.
 * La receta de v1 metía estos siete con sus recomendaciones, la firma y el código de
 * verificación en una sola hoja, y la de v2 no llegaba. Este caso existe para poder
 * mirar si llega, sin teclear siete medicamentos a mano cada vez.
 *
 * Son siete entradas del estado NORMAL —los cinco datos con indicación de una línea—,
 * no del estado caro que compone el `lleno`: lo que se mide aquí es la receta que se
 * emite todos los días, no el techo del formato. Con la indicación a dos líneas cada
 * entrada sube un interlineado y entran seis.
 *
 * **QUÉ SE VE HOY, MEDIDO:** los siete caben en la hoja 1. Lo que se va a la hoja 2 es
 * el cierre —recomendaciones, firma y código—, y eso **ya no se persigue**: cerrarlo
 * pedía recortar el hueco de la rúbrica, y Angel decidió que ese hueco no se toca.
 *
 * Los fármacos son los de un esquema postoperatorio de ortopedia, con las vías
 * variadas a propósito: la regla 1 de 2.H dice que el bloque en negativo crece con la
 * palabra y no se abrevia, así que `VÍA INTRAMUSCULAR` tiene que salir visiblemente
 * más ancha que `VÍA ORAL` — y desde la densificación las dos comparten renglón con
 * el ancla, que es justo donde eso se puede ver de un vistazo.
 */
const MEDICAMENTOS_SIETE: readonly MedicamentoRecetado[] = [
  {
    nombre_comercial: 'Meloxicam Zydus',
    presentacion: 'Tabletas 15 mg, caja con 10',
    principio_activo: 'Meloxicam',
    via_administracion: 'Oral',
    indicacion: 'Una tableta cada 24 horas por 7 días.',
  },
  {
    nombre_comercial: 'Omeprazol Ultra',
    presentacion: 'Cápsulas 20 mg, caja con 14',
    principio_activo: 'Omeprazol',
    via_administracion: 'Oral',
    indicacion: 'Una cápsula en ayunas por 14 días.',
  },
  {
    nombre_comercial: 'Tempra Forte',
    presentacion: 'Tabletas 500 mg, caja con 20',
    principio_activo: 'Paracetamol',
    via_administracion: 'Oral',
    indicacion: 'Una tableta cada 8 horas si hay dolor.',
  },
  {
    nombre_comercial: 'Dolac Sublingual',
    presentacion: 'Tabletas 30 mg, caja con 10',
    principio_activo: 'Ketorolaco trometamina',
    via_administracion: 'Sublingual',
    indicacion: 'Una tableta cada 8 horas por 3 días.',
  },
  {
    nombre_comercial: 'Bedoyecta Tri',
    presentacion: 'Solución inyectable, caja con 3 ampolletas',
    principio_activo: 'Tiamina, piridoxina y cianocobalamina',
    via_administracion: 'Intramuscular',
    indicacion: 'Una ampolleta cada 24 horas por 3 días.',
  },
  {
    nombre_comercial: 'Caltrate 600 + D',
    presentacion: 'Tabletas 600 mg, frasco con 60',
    principio_activo: 'Carbonato de calcio y colecalciferol',
    via_administracion: 'Oral',
    indicacion: 'Una tableta cada 12 horas con alimentos.',
  },
  {
    nombre_comercial: 'Voltaren Emulgel',
    presentacion: 'Gel 1 %, tubo con 60 g',
    principio_activo: 'Diclofenaco dietilamonio',
    via_administracion: 'Tópica',
    indicacion: 'Aplicar en la zona cada 8 horas por 10 días.',
  },
]

/** Cuerpo del bloque de recomendaciones generales. Un solo párrafo, sin viñetas. */
const RECOMENDACIONES =
  'Mantenga reposo relativo durante las primeras 48 horas y aplique frío local tres veces al día por 15 minutos. No suspenda el tratamiento antes de terminarlo aunque el dolor ceda, y acuda a su cita de control con los estudios solicitados.'

/** Folios INVENTADOS, con el prefijo `P-` que la lámina compone. */
const FOLIO_COMPLETO = 'P-B8570E3FA164'
const FOLIO_MINIMO = 'P-6C41A9D2E870'
const FOLIO_LLENO = 'P-4F1D0A9C7B23'
const FOLIO_SIETE = 'P-2E7B5C0F91A4'

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
export type CasoReceta = 'completo' | 'minimo' | 'siete' | 'lleno'

const CASOS: Record<CasoReceta, { medicamentos: readonly MedicamentoRecetado[]; paciente: ValoresPaciente; folio: string; cierre: boolean }> = {
  completo: { medicamentos: MEDICAMENTOS_COMPLETO, paciente: PACIENTE_COMPLETO, folio: FOLIO_COMPLETO, cierre: true },
  minimo: { medicamentos: MEDICAMENTOS_MINIMO, paciente: PACIENTE_MINIMO, folio: FOLIO_MINIMO, cierre: false },
  siete: { medicamentos: MEDICAMENTOS_SIETE, paciente: PACIENTE_COMPLETO, folio: FOLIO_SIETE, cierre: true },
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
