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
 * Paciente del caso completo. INVENTADO. Sin `sexo`, `expediente` ni `hora`: los
 * tres no llegan hoy desde ningún formulario (2.D regla 3), así que pasarlos aquí
 * enseñaría un riel que la app todavía no puede producir.
 */
const PACIENTE_COMPLETO: ValoresPaciente = {
  paciente: 'María Fernanda Ruiz Ortega',
  edad: '54 años',
  diagnostico: 'Gonartrosis bilateral grado III',
  fecha: '7 ago 2026',
}

/** Paciente del caso mínimo: lo indispensable, para ver colapsar el diagnóstico. */
const PACIENTE_MINIMO: ValoresPaciente = {
  paciente: 'Jorge Alberto Medina Salas',
  edad: '61 años',
  fecha: '7 ago 2026',
}

/**
 * Dos estudios con indicación, de un preoperatorio.
 *
 * **Son DOS y no tres, y la cifra está medida.** Con tres estudios de una línea
 * de indicación más estas notas, el documento pasa a DOS hojas y la hoja 2 llega
 * con la firma sola —sin membrete de continuación, sin `BloquePaciente` reducido
 * y sin el aviso `RESERVADO PARA LA FIRMA`—, porque este formato todavía no monta
 * `MotorFlujo` y II.1 §3 no declara ninguna de esas tres piezas. Queda registrado
 * en el spec (anexo A, P4-4). Con dos, el caso completo cabe en una hoja, que es
 * lo que estos dos casos existen para enseñar.
 */
const ESTUDIOS_COMPLETO: readonly EstudioSolicitado[] = [
  {
    nombre: 'Biometría hemática completa',
    indicacion: 'Preoperatorio de artroplastia total de rodilla derecha.',
  },
  {
    nombre: 'Química sanguínea de seis elementos',
    indicacion: 'Ayuno de ocho horas. Valorar función renal previa a AINE.',
  },
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

function HojaLaboratorio({
  medico,
  acentoHex,
}: {
  medico: MedicoFicticio
  acentoHex: string
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const comun = {
    medico: medicoMembrete(medico),
    consultorio: { domicilio: medico.domicilio, telefono: medico.telefono },
    panel: { variante: 'logo', acento, logo: medico.logo } as const,
    acento,
  }

  return (
    <Document title="Solicitud de laboratorio — taller">
      <SolicitudLaboratorio
        {...comun}
        paciente={PACIENTE_COMPLETO}
        estudios={ESTUDIOS_COMPLETO}
        notas={NOTAS_COMPLETO}
      />
      <SolicitudLaboratorio
        {...comun}
        paciente={PACIENTE_MINIMO}
        estudios={ESTUDIOS_MINIMO}
      />
    </Document>
  )
}

/** Genera el blob de los dos casos. Se llama desde el cliente. */
export async function generarPdfLaboratorio(
  medico: MedicoFicticio,
  acentoHex: string,
): Promise<Blob> {
  registrarFuentesV2()
  const elemento: ReactElement<DocumentProps> = (
    <HojaLaboratorio medico={medico} acentoHex={acentoHex} />
  )
  return pdf(elemento).toBlob()
}
