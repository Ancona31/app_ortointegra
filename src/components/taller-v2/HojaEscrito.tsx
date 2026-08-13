/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.8 · Escrito Médico. **No es la emisión.** No lee la base
 * ni Storage, no toca v1, no toca los formularios ni el flujo del médico: el médico es
 * inventado y el cuerpo está aquí abajo.
 *
 * CUATRO CASOS, Y LOS CUATRO SON EL MISMO EJE: EL TÍTULO
 *
 *   corto     `Certificado médico`         1 renglón
 *   medio     `Carta de recomendación`     1 renglón
 *   largo     la constancia de 105 caracteres, **3 renglones**
 *   sin       sin título: el bloque deja 20 pt con la fecha sola
 *
 * **Es el único formato cuyo título lo escribe el médico**, así que su verificación no es
 * cuántos datos trae sino qué pasa cuando el dato crece. En los cuatro hay que mirar lo
 * mismo:
 *
 * 1. **La fecha se alinea con la PRIMERA línea del título**, nunca con la última ni con el
 *    centro. Con tres renglones sigue arriba del todo.
 * 2. **El caso sin título deja su hueco de 20 pt**, no cero, y conserva el filete. Si el
 *    cuerpo arranca pegado al filete del membrete, la variante `ausente` colapsó y eso es lo
 *    que esta hoja existe para detectar.
 * 3. **El pie no lleva folio en ninguna hoja**, la paginación va a la izquierda y el nombre
 *    del documento al centro. En el caso largo, el pie imprime `Constancia de atención
 *    médica` y el encabezado la cadena entera: son dos campos, no un truncado.
 *
 * EL CUERPO ES EL MISMO EN LOS CUATRO, Y EJERCITA LOS SEIS NODOS
 *
 * Párrafo, encabezado 1 y 2, lista con viñeta, lista numerada, cita y separador, más negrita
 * y cursiva dentro de un párrafo. Es largo a propósito: con este texto el documento desborda
 * a una segunda hoja y se ve la cabecera de continuación, que es la menor del sistema.
 *
 * SIN GUÍAS, como los otros siete formatos: un documento tiene que verse como un documento.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import EscritoMedico, {
  type NodoEscrito,
} from '@/lib/pdf/v2/formatos/EscritoMedico'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import { cuerpoEscritoDesde } from '@/lib/pdf/v2/cuerpoEscrito'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/** Los cuatro títulos instanciados en la lámina. El largo es el que rompe a tres renglones. */
const TITULOS = {
  corto: 'Certificado médico',
  medio: 'Carta de recomendación',
  largo:
    'Constancia de atención médica y valoración ortopédica para trámite escolar ante la Secretaría de Educación',
} as const

/** El nombre corto del caso largo. **Es un segundo campo, no un truncado.** */
const TITULO_PIE_LARGO = 'Constancia de atención médica'

const FECHA = '4 ago 2026'

/**
 * EL CUERPO, con los seis nodos que el editor produce. Texto INVENTADO sobre un paciente
 * inventado: el formato no lo interpreta, solo lo compone.
 */
const CUERPO: readonly NodoEscrito[] = [
  {
    tipo: 'parrafo',
    tramos: [
      { texto: 'A quien corresponda: por medio del presente hago constar que ' },
      { texto: 'Renata Bustamante Oceguera', negrita: true },
      {
        texto:
          ', de 25 años de edad, acudió a consulta en este consultorio el día 4 de agosto de 2026 por dolor lumbar de tres semanas de evolución.',
      },
    ],
  },
  { tipo: 'encabezado1', texto: 'Valoración' },
  {
    tipo: 'parrafo',
    tramos: [
      {
        texto:
          'A la exploración física se encuentra contractura paravertebral bilateral, sin déficit neurológico ni datos de radiculopatía. La maniobra de Lasègue resulta ',
      },
      { texto: 'negativa', cursiva: true },
      { texto: ' de forma bilateral.' },
    ],
  },
  { tipo: 'encabezado2', texto: 'Estudios revisados' },
  {
    tipo: 'lista',
    marca: 'vineta',
    items: [
      [{ texto: 'Radiografía simple de columna lumbar en dos proyecciones.' }],
      [{ texto: 'Biometría hemática completa dentro de parámetros normales.' }],
      [
        {
          texto:
            'Resonancia magnética de columna lumbosacra, sin evidencia de hernia discal ni compromiso radicular.',
        },
      ],
    ],
  },
  { tipo: 'encabezado1', texto: 'Indicaciones' },
  {
    tipo: 'lista',
    marca: 'numero',
    items: [
      [{ texto: 'Reposo relativo durante siete días, sin reposo absoluto en cama.' }],
      [{ texto: 'Analgesia con paracetamol de 1 g cada ocho horas por cinco días.' }],
      [{ texto: 'Aplicación de calor local veinte minutos, dos veces al día.' }],
      [{ texto: 'Inicio de fisioterapia dirigida a partir de la segunda semana.' }],
    ],
  },
  { tipo: 'separador' },
  {
    tipo: 'cita',
    tramos: [
      {
        texto:
          'Se recomienda evitar el levantamiento de cargas superiores a cinco kilogramos y la permanencia sentada por más de una hora sin pausa durante las próximas cuatro semanas.',
      },
    ],
  },
  {
    tipo: 'parrafo',
    tramos: [
      {
        texto:
          'Se extiende la presente constancia a petición de la interesada, para los fines legales y administrativos que estime convenientes, sin que ello implique valoración de aptitud laboral ni certificación de incapacidad.',
      },
    ],
  },
]

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
 * EL CASO `editor` — y es el único que NO escribe sus nodos a mano.
 *
 * ⚠ **ESTE CASO EXISTE PORQUE EL DE ARRIBA NO PRUEBA LO QUE PARECE.** `CUERPO` está
 * redactado directamente en `NodoEscrito[]`, o sea en la forma que el formato quiere, y por
 * eso siempre se vio bien: lo que nunca se comprobó es que el editor del médico SEPA
 * producir eso. No sabía —faltaban el subrayado y las alineaciones— y la traducción no
 * existía.
 *
 * Aquí el cuerpo entra como el JSON de ProseMirror que TipTap guarda en
 * `documentos.contenido` y pasa por `cuerpoEscritoDesde`, que es el camino real. Si algún
 * día el conversor se rompe, este caso sale vacío o a medias y se ve en el papel.
 *
 * Ejercita lo que la barra ofrece y `CUERPO` no toca: las cuatro alineaciones, el
 * subrayado, la lista numerada y el salto de línea de Shift+Enter.
 */
const DOC_EDITOR = {
  schema: 'tiptap-doc-v1',
  content: {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2, textAlign: 'center' },
        content: [{ type: 'text', text: 'Constancia médica' }],
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'justify' },
        content: [
          { type: 'text', text: 'A quien corresponda: hago constar que ' },
          { type: 'text', text: 'Renata Bustamante Oceguera', marks: [{ type: 'bold' }] },
          {
            type: 'text',
            text: ' acudió a valoración por dolor lumbar de tres semanas de evolución, sin datos de alarma neurológica ni indicación quirúrgica en este momento.',
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Diagnóstico: ' },
          { type: 'text', text: 'lumbalgia mecánica', marks: [{ type: 'underline' }] },
          { type: 'text', text: '. Se indica:' },
        ],
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reposo relativo por siete días.' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rehabilitación física, dos sesiones por semana.' }] }],
          },
        ],
      },
      {
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'La presente no certifica incapacidad laboral ni valoración de aptitud.',
            marks: [{ type: 'italic' }],
          }],
        }],
      },
      { type: 'horizontalRule' },
      {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [
          { type: 'text', text: 'Mérida, Yucatán' },
          { type: 'hardBreak' },
          { type: 'text', text: 'a 4 de agosto de 2026' },
        ],
      },
    ],
  },
}

/** Un caso es un documento entero, no una hoja de un documento común (ver 2.N). */
export type CasoEscrito = 'corto' | 'medio' | 'largo' | 'sin' | 'editor'

const CASOS: Record<
  CasoEscrito,
  {
    readonly asunto?: string
    readonly tituloPie?: string
    /** Solo `editor`: el cuerpo sale del conversor y no de `CUERPO`. */
    readonly desdeEditor?: boolean
  }
> = {
  corto: { asunto: TITULOS.corto },
  medio: { asunto: TITULOS.medio },
  largo: { asunto: TITULOS.largo, tituloPie: TITULO_PIE_LARGO },
  // Sin título y sin `tituloPie`: la banda cae al genérico `Escrito médico`.
  sin: {},
  editor: { asunto: TITULOS.corto, desdeEditor: true },
}

function HojaEscrito({
  medico,
  acentoHex,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  caso: CasoEscrito
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const c = CASOS[caso]

  return (
    <Document title={`Escrito médico — taller · ${caso}`}>
      <EscritoMedico
        medico={medicoMembrete(medico)}
        // El teléfono llega YA ROTULADO: 2.B coloca, no rotula.
        consultorio={{ domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` }}
        panel={{ variante: 'logo', acento, logo: medico.logo }}
        acento={acento}
        asunto={c.asunto}
        tituloPie={c.tituloPie}
        fecha={FECHA}
        cuerpo={c.desdeEditor === true ? cuerpoEscritoDesde({ doc: DOC_EDITOR }).cuerpo : CUERPO}
      />
    </Document>
  )
}

/** Genera el blob del caso pedido. Se llama desde el cliente. */
export async function generarPdfEscrito(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  // Sin QR y sin folio: es el único formato que no lleva ninguno de los dos (II.8 §1).
  const elemento: ReactElement<DocumentProps> = (
    <HojaEscrito
      medico={medico}
      acentoHex={acentoHex}
      caso={caso in CASOS ? (caso as CasoEscrito) : 'corto'}
    />
  )
  return pdf(elemento).toBlob()
}
