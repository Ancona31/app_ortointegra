/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.5 · Recibo de Honorarios / Cotización. **No es la
 * emisión.** No lee la base ni Storage, no toca v1, no toca los formularios ni el flujo
 * del médico: el médico, el paciente y la aseguradora son inventados y viven aquí abajo.
 *
 * TRES CASOS, Y LOS TRES SON LAS TRES HOJAS DE LA LÁMINA
 *
 *   cotizacion  4 conceptos con mezcla de origen, aseguradora, subtotales y QR
 *   recibo      14 conceptos sin mezcla, anticipo, saldo y forma de pago
 *   minimo      un concepto y **el paciente VACÍO**: es lo que enseña la línea de
 *               escritura del riel, que ningún otro formato del sistema compone
 *
 * QUÉ HAY QUE MIRAR EN CADA UNO
 *
 * En la **cotización**, las trece diferencias por el lado que las lleva: tres celdas en
 * el riel con la de vigencia sobre fondo, la caja de aseguradora enmarcada, la columna
 * de origen con sus dos marcas distinguidas por peso y tinta, los dos subtotales sobre
 * el filete, el rótulo `Total estimado`, el QR encima de la firma y el folio con `Q-`.
 *
 * En el **recibo**, las mismas trece por el lado contrario: dos celdas, sin aseguradora,
 * tres columnas, el total arriba con su anticipo y su saldo debajo, la forma de pago
 * sobre la firma, sin QR y con `R-`. Y, como sus 14 conceptos desbordan, la **hoja de
 * continuación con el eco del total** — que es lo único que ese papel dice del dinero.
 *
 * En el **mínimo**, la celda de paciente: rótulo `PACIENTE` y debajo una línea de 16.47
 * pt para llenar a pluma, con la celda creciendo a 33.47. Es el estado «vacío requerido»
 * de 2.E y este es el único formato del sistema que lo usa.
 *
 * SIN GUÍAS, como los otros cuatro formatos: un documento tiene que verse como un
 * documento.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { ReactElement } from 'react'
import ReciboHonorarios, {
  type ConceptoCobrado,
  type ReciboHonorariosProps,
} from '@/lib/pdf/v2/formatos/ReciboHonorarios'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Paciente de los dos casos con nombre. INVENTADO. **Tres celdas y ninguna más**: este
 * riel no lleva edad, ni sexo, ni expediente, ni diagnóstico.
 *
 * La vigencia llega redactada —2.D coloca, no calcula— y solo la lee la cotización: el
 * recibo compone la fila de dos celdas y la ignora.
 */
const PACIENTE = {
  paciente: 'María Fernanda Ruiz Ortega',
  fecha: '8 ago 2026',
  vigencia: '30 días naturales',
}

/**
 * Paciente del caso mínimo: **la cadena vacía, no la ausencia**. Es lo que dispara la
 * línea de escritura en vez del colapso, y es deliberado que se vea aquí: `paciente` es
 * exigible en el tipo de 2.D —el nombre nunca falta en los otros siete formatos— y este
 * es el único que emite sin él.
 */
const PACIENTE_VACIO = { paciente: '', fecha: '8 ago 2026' }

/** El procedimiento, bajo el título y con su rótulo. */
const PROCEDIMIENTO = 'Artrodesis lumbar instrumentada L4-L5'

/** Los cuatro conceptos de la cotización, con mezcla de origen. */
const CONCEPTOS_COTIZACION: readonly ConceptoCobrado[] = [
  {
    concepto: 'Honorarios del cirujano · artrodesis L4-L5',
    origen: 'propio',
    precio: '$45,000.00',
  },
  { concepto: 'Honorarios del anestesiólogo', origen: 'tercero', precio: '$18,000.00' },
  { concepto: 'Estancia hospitalaria · dos noches', origen: 'tercero', precio: '$62,000.00' },
  { concepto: 'Material de osteosíntesis e implantes', origen: 'tercero', precio: '$65,000.00' },
]

/** Los catorce del recibo. Sin origen: en este caso la columna no existe. */
const CONCEPTOS_RECIBO: readonly ConceptoCobrado[] = Array.from(
  { length: 14 },
  (_, i) => ({
    concepto: `Sesión de rehabilitación asistida · control ${i + 1}`,
    precio: '$1,314.29',
  }),
)

/** El único del mínimo. */
const CONCEPTOS_MINIMO: readonly ConceptoCobrado[] = [
  { concepto: 'Consulta de valoración ortopédica', precio: '$1,200.00' },
]

/** Los dos textos de notas, uno por caso. Son DATO, no cadena del formato. */
const NOTAS_COTIZACION =
  'Los importes marcados como estimado de terceros son referencia de costos de hospital, anestesiología y material, sujetos a la tarifa vigente de cada proveedor el día del procedimiento. No se facturan ni se reciben por este consultorio.'
const NOTAS_RECIBO =
  'Todos los conceptos de esta relación corresponden a honorarios del médico que suscribe. No incluye costos de hospital, anestesiología ni material.'
const NOTAS_MINIMO = 'Honorarios del médico que suscribe.'

/** Folios INVENTADOS, con los dos prefijos que compone la lámina. */
const FOLIO_COTIZACION = 'Q-4F17A20C93B6'
const FOLIO_RECIBO = 'R-B8570E3FA164'
const FOLIO_MINIMO = 'R-2C60D419E7A5'

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
export type CasoHonorarios = 'cotizacion' | 'recibo' | 'minimo'

/** Guarda de tipo, para no aseverar con `as` lo que llega como cadena del selector. */
function esCaso(valor: string): valor is CasoHonorarios {
  return valor === 'cotizacion' || valor === 'recibo' || valor === 'minimo'
}

/**
 * Lo que cada caso declara de propio, sin el médico ni el acento.
 *
 * El `Omit` va DISTRIBUIDO sobre la unión —`T extends unknown ? … : never`— y no
 * aplicado a ella: un `Omit` normal sobre una unión discriminada la aplana y se queda
 * solo con las claves comunes, así que `aseguradora`, `anticipo` y `formaPago`
 * desaparecerían. Es el mecanismo del tipo del formato: las trece diferencias viven en
 * las dos ramas y hay que conservarlas.
 */
type SinChasis<T> = T extends unknown
  ? Omit<T, 'medico' | 'consultorio' | 'panel' | 'acento'>
  : never
type DatosCaso = SinChasis<ReciboHonorariosProps>

function datosDelCaso(caso: CasoHonorarios, qr: string): DatosCaso {
  if (caso === 'cotizacion') {
    return {
      tipo: 'cotizacion',
      paciente: PACIENTE,
      procedimiento: PROCEDIMIENTO,
      conceptos: CONCEPTOS_COTIZACION,
      aseguradora: {
        nombre: 'Grupo Nacional Provincial',
        poliza: 'GNP-4471-882301',
        cobertura: 'Gastos mayores',
      },
      subtotales: [
        { etiqueta: 'Honorarios del médico', importe: '$45,000.00' },
        { etiqueta: 'Estimado de terceros', importe: '$145,000.00' },
      ],
      total: '$190,000.00',
      divisa: { codigo: 'MXN', nombre: 'Pesos mexicanos' },
      notas: NOTAS_COTIZACION,
      folio: FOLIO_COTIZACION,
      qr,
    }
  }

  if (caso === 'recibo') {
    return {
      tipo: 'recibo',
      paciente: PACIENTE,
      procedimiento: 'Programa de rehabilitación de rodilla derecha',
      conceptos: CONCEPTOS_RECIBO,
      total: '$18,400.00',
      divisa: { codigo: 'USD', nombre: 'Dólares estadounidenses' },
      anticipo: {
        etiqueta: 'Anticipo recibido',
        importe: '−$6,000.00',
        fecha: '12 jul 2026',
        saldo: { etiqueta: 'Saldo pendiente', importe: '$12,400.00' },
      },
      formaPago: 'Transferencia electrónica',
      notas: NOTAS_RECIBO,
      folio: FOLIO_RECIBO,
    }
  }

  return {
    tipo: 'recibo',
    paciente: PACIENTE_VACIO,
    conceptos: CONCEPTOS_MINIMO,
    total: '$1,200.00',
    divisa: { codigo: 'MXN', nombre: 'Pesos mexicanos' },
    formaPago: 'Efectivo',
    notas: NOTAS_MINIMO,
    folio: FOLIO_MINIMO,
  }
}

function HojaHonorarios({
  medico,
  acentoHex,
  qr,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  qr: string
  caso: CasoHonorarios
}): ReactElement {
  const acento = resolverAcento(acentoHex)

  return (
    <Document title={`Honorarios — taller · ${caso}`}>
      <ReciboHonorarios
        medico={medicoMembrete(medico)}
        // El teléfono llega YA ROTULADO: 2.B coloca, no rotula.
        consultorio={{ domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` }}
        panel={{ variante: 'logo', acento, logo: medico.logo }}
        acento={acento}
        {...datosDelCaso(caso, qr)}
      />
    </Document>
  )
}

/** Genera el blob del caso pedido. Se llama desde el cliente. */
export async function generarPdfHonorarios(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  // PNG y sin margen: `<Image>` de react-pdf solo acepta JPG, PNG o base64 (I.3.8),
  // y el aire alrededor del código lo pone la fila de cierre, no el ráster.
  const qr = await QRCode.toDataURL(TOKEN_VERIFICACION, { margin: 0, width: 224 })
  const elemento: ReactElement<DocumentProps> = (
    <HojaHonorarios
      medico={medico}
      acentoHex={acentoHex}
      qr={qr}
      caso={esCaso(caso) ? caso : 'cotizacion'}
    />
  )
  return pdf(elemento).toBlob()
}
