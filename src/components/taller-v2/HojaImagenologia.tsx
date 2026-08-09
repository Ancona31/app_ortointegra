/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.2 · Solicitud de Imagenología. **No es la
 * emisión.** No lee la base ni Storage, no toca v1, no toca los formularios ni el
 * flujo del médico: el médico y el paciente son inventados y viven aquí abajo.
 *
 * TRES CASOS, Y LOS TRES HACEN FALTA
 *
 *   completo   los CUATRO estados de entrada, con diagnóstico, urgente y notas
 *   mínimo     un estudio de dos datos, sin diagnóstico, sin urgente y sin notas
 *   lleno      la hoja al tope, para ver dónde queda el techo de la lista
 *
 * El completo es el único que instancia los cuatro estados de la entrada a la vez,
 * que es lo que la lámina compone en su hoja «C y D» y lo que II.2 §6 manda
 * comprobar: que proyecciones e indicación colapsan POR SEPARADO. Con un solo
 * estado no se ve, porque una ranura ausente no se distingue de una ranura vacía
 * si no hay con qué comparar.
 *
 * El mínimo enseña el colapso del resto: sin diagnóstico el riel se queda en una
 * fila, sin urgente el bloque de título vuelve a sus 25 pt y sin notas la firma
 * sube.
 *
 * SIN GUÍAS, como el de Laboratorio: las líneas de zona segura son andamiaje del
 * taller de chasis y un documento tiene que verse como un documento.
 *
 * Cada caso es un `Page` propio, que es como se compone un formato (2.M): así la
 * paginación de cada uno se cuenta sola.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import SolicitudImagenologia, {
  type EstudioSolicitado,
} from '@/lib/pdf/v2/formatos/SolicitudImagenologia'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import type { ValoresPaciente } from '@/lib/pdf/v2/BloquePaciente'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Paciente del caso completo. INVENTADO. **Cuatro celdas del riel más el
 * diagnóstico**, que son las cinco que esta lámina compone: `fecha` y `hora` no se
 * pasan porque en este formato no viven en el riel — suben a la celda `Emisión`
 * del riel derecho del bloque de título.
 */
const PACIENTE_COMPLETO: ValoresPaciente = {
  paciente: 'María Fernanda Ruiz Ortega',
  edad: '54 años',
  sexo: 'Femenino',
  expediente: 'EXP-004821',
  diagnostico: 'Gonartrosis bilateral grado III',
}

/** Paciente del caso mínimo: sin diagnóstico, para ver colapsar la fila inferior. */
const PACIENTE_MINIMO: ValoresPaciente = {
  paciente: 'Jorge Alberto Medina Salas',
  edad: '61 años',
}

/**
 * LOS CUATRO ESTADOS DE LA ENTRADA, en el orden en que los declara la lámina.
 *
 * Es la instancia de la verificación visible de II.2 §6: la `01` muestra sus dos
 * ranuras, la `02` cierra sin dejar el hueco de las proyecciones, la `03` cierra
 * sin el de la indicación y la `04` no deja ninguno de los dos.
 */
const ESTUDIOS_COMPLETO: readonly EstudioSolicitado[] = [
  {
    tipo: 'Radiografía',
    region: 'Rodilla derecha',
    proyecciones: 'AP, lateral y axial de rótula',
    indicacion: 'Valorar interlínea articular en carga. Preoperatorio de artroplastia.',
  },
  {
    tipo: 'Resonancia magnética',
    region: 'Rodilla izquierda',
    indicacion: 'Descartar lesión meniscal medial tras traumatismo en flexión.',
  },
  {
    tipo: 'Tomografía computarizada',
    region: 'Columna lumbar',
    proyecciones: 'Cortes axiales de 1 mm con reconstrucción sagital',
  },
  { tipo: 'Densitometría ósea', region: 'Cadera y columna lumbar' },
]

/** Un solo estudio de dos datos: la entrada mínima del formato. */
const ESTUDIOS_MINIMO: readonly EstudioSolicitado[] = [
  { tipo: 'Ultrasonido', region: 'Hombro derecho' },
]

/**
 * El caso al tope. Doce entradas del estado más caro —los cuatro datos— para ver
 * a ojo dónde queda el techo que la medición calcula, y si el corte de la hoja 2
 * llega con el hueco que la cabecera del formato reporta (sin 2.N no hay
 * encabezado de continuación).
 */
const ESTUDIOS_LLENO: readonly EstudioSolicitado[] = Array.from(
  { length: 12 },
  (_, i) => ({
    tipo: 'Radiografía',
    region: `Segmento de control ${i + 1}`,
    proyecciones: 'AP y lateral',
    indicacion: 'Control evolutivo del material de osteosíntesis.',
  }),
)

/**
 * Notas al servicio del caso completo. Entran como UNA CADENA y las compone 2.J.
 *
 * El rótulo `Notas para el servicio de imagen` viaja DENTRO del texto, como primer
 * renglón, y por eso sale en `etiqueta` y no en los 9 / 13 de la lámina: ver el
 * punto (c) de la cabecera del formato.
 */
const NOTAS_COMPLETO = [
  'Notas para el servicio de imagen:',
  '- Enviar el estudio en disco y por enlace al consultorio.',
  '- Avisar por teléfono si el paciente no puede mantener la bipedestación.',
].join('\n')

/** Folios INVENTADOS, con la forma de `public.generar_folio()` para esta clase. */
const FOLIO_COMPLETO = 'IMG-2026-0148'
const FOLIO_MINIMO = 'IMG-2026-0149'
const FOLIO_LLENO = 'IMG-2026-0150'

/** Emisión ya compuesta: token corto de fecha + hora, con la raya del sistema. */
const EMISION = '7 ago 2026 · 10:45'

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
export type CasoImagenologia = 'completo' | 'minimo' | 'lleno'

const CASOS: Record<
  CasoImagenologia,
  {
    estudios: readonly EstudioSolicitado[]
    paciente: ValoresPaciente
    folio: string
    urgente: boolean
    notas?: string
  }
> = {
  completo: { estudios: ESTUDIOS_COMPLETO, paciente: PACIENTE_COMPLETO, folio: FOLIO_COMPLETO, urgente: true, notas: NOTAS_COMPLETO },
  minimo: { estudios: ESTUDIOS_MINIMO, paciente: PACIENTE_MINIMO, folio: FOLIO_MINIMO, urgente: false },
  // Urgente Y desbordado: es el caso que enseña el badge en las DOS hojas, reducido
  // en la segunda, que es lo único que distingue a este formato en continuación.
  lleno: { estudios: ESTUDIOS_LLENO, paciente: PACIENTE_COMPLETO, folio: FOLIO_LLENO, urgente: true, notas: NOTAS_COMPLETO },
}

function HojaImagenologia({
  medico,
  acentoHex,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  caso: CasoImagenologia
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
    <Document title={`Solicitud de imagenología — taller · ${caso}`}>
      <SolicitudImagenologia
        {...comun}
        paciente={c.paciente}
        estudios={c.estudios}
        emision={EMISION}
        urgente={c.urgente}
        notas={c.notas}
        folio={c.folio}
      />
    </Document>
  )
}

/** Genera el blob de los tres casos. Se llama desde el cliente. */
export async function generarPdfImagenologia(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  const elemento: ReactElement<DocumentProps> = (
    <HojaImagenologia
      medico={medico}
      acentoHex={acentoHex}
      caso={caso in CASOS ? (caso as CasoImagenologia) : 'completo'}
    />
  )
  return pdf(elemento).toBlob()
}
