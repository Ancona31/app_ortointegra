/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.1 · Solicitud de Laboratorio. **No es la
 * emisión.** No lee la base ni Storage, no toca v1, no toca los formularios ni el
 * flujo del médico: el médico y el paciente son inventados y viven aquí abajo.
 *
 * DOS CASOS, Y LOS DOS HACEN FALTA
 *
 *   completo   tres estudios con indicación, con diagnóstico y con notas
 *   mínimo     un solo estudio, sin diagnóstico y sin notas
 *
 * El mínimo es el que demuestra el colapso: bajo la lista no puede quedar ningún
 * hueco donde estarían las notas, y la firma tiene que subir (II.1 §6). Con un
 * solo caso eso no se ve, porque un hueco de más no se distingue de un bloque
 * ausente si no hay con qué comparar.
 *
 * SIN GUÍAS. Las líneas de zona segura y de caja son andamiaje del taller de
 * chasis y no aparecen en un formato: un documento tiene que verse como un
 * documento. Por eso este archivo no importa nada de `HojaTaller.tsx` salvo el
 * tipo del médico ficticio.
 *
 * Cada caso es un `Page` propio, que es como se compone un formato (2.M): así la
 * paginación de cada uno se cuenta sola y los dos dicen «PÁGINA 1 DE 1» en vez de
 * «1 de 2» y «2 de 2», que sería el conteo del PDF del taller y no el del
 * documento.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import SolicitudLaboratorio, {
  type EstudioSolicitado,
} from '@/lib/pdf/v2/formatos/SolicitudLaboratorio'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import type { ValoresPaciente } from '@/lib/pdf/v2/BloquePaciente'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Paciente del caso completo. INVENTADO. **Las SIETE celdas del riel**, que es lo
 * que la lámina aprobada compone: `SPEC_DISENO_PARTE_B.md` B.1 §2 declara el riel
 * de identificación como «7 celdas en dos filas» y §4 lista las siete etiquetas.
 *
 * La versión anterior pasaba cuatro —sin `sexo`, `expediente` ni `hora`— razonando
 * que los tres no llegan hoy desde ningún formulario (2.D regla 3). El razonamiento
 * es cierto y es cableado del Paso 5, pero la consecuencia era enseñar medio riel:
 * al colapsar tres celdas, 2.F redistribuye las cuatro vivas por `flexGrow` y la
 * fila superior queda con dos celdas estiradas donde la lámina tiene cuatro. El
 * taller existe para ver la composición del formato, no el estado del cableado.
 *
 * La fecha va en la forma larga —`7 de agosto de 2026`—, que es la de la hoja 1 en
 * B.1 §2. El token corto `7 ago 2026` es el de las hojas de continuación.
 */
const PACIENTE_COMPLETO: ValoresPaciente = {
  paciente: 'María Fernanda Ruiz Ortega',
  edad: '54 años',
  sexo: 'Femenino',
  expediente: 'EXP-004821',
  diagnostico: 'Gonartrosis bilateral grado III',
  fecha: '7 de agosto de 2026',
  hora: '10:45',
}

/** Paciente del caso mínimo: lo indispensable, para ver colapsar el diagnóstico. */
const PACIENTE_MINIMO: ValoresPaciente = {
  paciente: 'Jorge Alberto Medina Salas',
  edad: '61 años',
  fecha: '7 de agosto de 2026',
}

/**
 * Dos estudios con indicación, de un preoperatorio.
 *
 * **La cifra de tres que decía esta nota ya no aplica.** Se midió cuando la lista
 * apilaba la indicación bajo el nombre, a 53.5 pt por entrada; con la tabla de
 * B.1 §3 —fila `compacta`, indicación en `columna`— la entrada mide 15.5 pt y el
 * techo de una hoja está hoy en **15 estudios**, medido. Los dos de aquí se
 * conservan porque este caso existe para enseñar la composición, no el techo.
 *
 * Lo que sigue vivo de aquella nota es el defecto que describía: cuando la lista
 * desborda, la hoja 2 llega con la firma sola —sin membrete de continuación, sin
 * `BloquePaciente` reducido y sin el aviso `RESERVADO PARA LA FIRMA`—, porque este
 * formato todavía no monta `MotorFlujo` y II.1 §3 no declara ninguna de esas tres
 * piezas (anexo A, P4-4).
 */
const ESTUDIOS_COMPLETO: readonly EstudioSolicitado[] = [
  { nombre: 'Biometría hemática completa' },
  { nombre: 'Química sanguínea de seis elementos' },
]

/** Un solo estudio y sin indicación: la entrada mínima del sistema (II.1 §4). */
const ESTUDIOS_MINIMO: readonly EstudioSolicitado[] = [
  { nombre: 'Velocidad de sedimentación globular' },
]

/**
 * Notas al laboratorio del caso completo. Entran como UNA CADENA y las compone
 * 2.J: con viñetas salen como lista, y sin ellas saldrían como prosa. Aquí llevan
 * encabezado y viñetas para que se vea el caso que el formato va a recibir de una
 * plantilla.
 */
const NOTAS_COMPLETO = [
  'Indicaciones para la toma:',
  '- Enviar resultados por correo al consultorio en cuanto estén.',
  '- Reportar por teléfono cualquier valor crítico.',
].join('\n')

/*
 * Los dos subtítulos de los casos QUEDAN RETIRADOS. La lámina los tiene en sus tres
 * hojas —B.1 §1 observa `Protocolo preoperatorio completo`, `Examen general de
 * orina` y `Protocolo preoperatorio ampliado`— y el formato ya no compone la ranura:
 * `CONCILIA D2` queda revertido por decisión de producto. Ver la nota junto al
 * título en `SolicitudLaboratorio`.
 */

/**
 * Folios INVENTADOS, con la forma que emitirá `public.generar_folio()` tras la
 * migración `20260808_folio_02_clases_faltantes.sql` — `LAB-AAAA-NNNN`.
 *
 * **No son los de la lámina.** Aquella emite `L-7C15A0E4D2B9`: prefijo de una letra
 * más 8 hex de UUID, que es la generación anterior y que el CHECK de
 * `20260807_folio_01` excluye a propósito. La forma es decisión de producto y manda
 * `DOCUMENTOS_SPEC.md`; la lámina manda en que el folio EXISTA y en dónde se
 * compone, no en cómo se genera.
 */
const FOLIO_COMPLETO = 'LAB-2026-0148'
const FOLIO_MINIMO = 'LAB-2026-0149'

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
 * ⚠️ **UN CASO POR PDF, Y ANTES ERAN VARIOS EN UNO.**
 *
 * Cada caso es un **documento entero**, no una hoja de un documento común. No es una
 * comodidad del taller: es lo que ocurre en emisión real —un documento es un formato,
 * un `Document` con un `Page`— y componer varios `Page` en un `Document` **produce un
 * resultado que no existe en producción**.
 *
 * Y no solo mentía: rompía. En la pasada de reparto el renderer entrega `pageNumber`
 * ABSOLUTO del documento y no `subPageNumber`, así que la primera hoja del segundo
 * caso se repartía como si fuera una continuación y luego se pintaba con el
 * encabezado completo. Medido: 13 ítems donde caben 10, con el paso de fila
 * comprimido de 50 a 40.99 pt — una violación de I.3.4 sin un solo aviso. Ver la
 * cabecera de 2.N.
 */
export type CasoLaboratorio = 'completo' | 'minimo' | 'lleno'

/**
 * El caso `lleno` son 25 estudios: por encima de los 18 que la lámina mete en una
 * hoja, así que **corta**. Es el caso que enseña la hoja de continuación de este
 * formato, y el que hay que mirar tapándose la hoja 1 con la mano: la 2 tiene que
 * identificar al paciente ella sola (regla 2 de 2.D).
 */
const ESTUDIOS_LLENO: readonly EstudioSolicitado[] = Array.from(
  { length: 25 },
  (_, i) => ({
    nombre: `Estudio de control ${i + 1}`,
  }),
)

const CASOS: Record<
  CasoLaboratorio,
  { estudios: readonly EstudioSolicitado[]; paciente: ValoresPaciente; folio: string; notas?: string }
> = {
  completo: { estudios: ESTUDIOS_COMPLETO, paciente: PACIENTE_COMPLETO, folio: FOLIO_COMPLETO, notas: NOTAS_COMPLETO },
  minimo: { estudios: ESTUDIOS_MINIMO, paciente: PACIENTE_MINIMO, folio: FOLIO_MINIMO },
  lleno: { estudios: ESTUDIOS_LLENO, paciente: PACIENTE_COMPLETO, folio: FOLIO_COMPLETO, notas: NOTAS_COMPLETO },
}

function HojaLaboratorio({
  medico,
  acentoHex,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  caso: CasoLaboratorio
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const comun = {
    medico: medicoMembrete(medico),
    // El teléfono llega YA ROTULADO: A.7 compone `Tel. 999 222 3173 · Univ. …` en
    // un solo renglón y 2.B une los dos datos, pero no inventa el rótulo.
    consultorio: { domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` },
    panel: { variante: 'logo', acento, logo: medico.logo } as const,
    acento,
  }

  const c = CASOS[caso]

  return (
    <Document title={`Solicitud de laboratorio — taller · ${caso}`}>
      <SolicitudLaboratorio
        {...comun}
        paciente={c.paciente}
        estudios={c.estudios}
        notas={c.notas}
        folio={c.folio}
      />
    </Document>
  )
}

/** Genera el blob de los dos casos. Se llama desde el cliente. */
export async function generarPdfLaboratorio(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  const elemento: ReactElement<DocumentProps> = (
    <HojaLaboratorio
      medico={medico}
      acentoHex={acentoHex}
      caso={caso in CASOS ? (caso as CasoLaboratorio) : 'completo'}
    />
  )
  return pdf(elemento).toBlob()
}
