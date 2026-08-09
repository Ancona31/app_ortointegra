/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.6 · Solicitud de Internamiento. **No es la emisión.** No
 * lee la base ni Storage, no toca v1, no toca los formularios ni el flujo del médico: el
 * médico, el paciente y el hospital son inventados y viven aquí abajo.
 *
 * TRES CASOS, Y NINGUNO ES «LLENO»
 *
 *   completo   las tres hojas del reparto, con badge y con sección 2
 *   mínimo     **SIN indicaciones de piso**: la sección 2 colapsa entera y son dos hojas
 *   prosa      la verificación visible de II.6 §6, con dos renglones sueltos delante
 *
 * **El caso `lleno` de los cinco formatos anteriores aquí no significa nada**, y esa es la
 * diferencia que hay que mirar: el reparto de este documento es ESTRUCTURAL, no por
 * capacidad. Con una indicación o con veinte, la sección 2 abre en su propia hoja. Lo que
 * sí desborda a una cuarta hoja es una sección 1 larga, y eso lo enseña el caso `prosa`,
 * que lleva las indicaciones más largas de los tres.
 *
 * EL MÍNIMO ES LA OTRA MITAD DE LA VERIFICACIÓN
 *
 * Sin `indicacionesPiso` desaparecen la apertura de sección, sus bloques numerados y la
 * tercera hoja; la firma del médico baja a cerrar la hoja 2, detrás de la pareja. También
 * va sin badge, sin procedimiento y sin requerimientos: es lo que enseña que los tres
 * colapsan sin dejar hueco.
 *
 * EL CASO `prosa` ES LA VERIFICACIÓN VISIBLE DE II.6 §6
 *
 * «Emitir con indicaciones de piso escritas como dos renglones de prosa seguidos de un
 * encabezado con sus viñetas.» Los dos renglones tienen que salir **en minúsculas y sin
 * raya** —son párrafos sueltos, no encabezados— y el primer bloque numerado tiene que
 * llevar el 1, no el 3: la prosa no consume número.
 *
 * SIN GUÍAS, como los otros cinco formatos: un documento tiene que verse como un documento.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import SolicitudInternamiento from '@/lib/pdf/v2/formatos/SolicitudInternamiento'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import type { ValoresPaciente } from '@/lib/pdf/v2/BloquePaciente'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Paciente del caso completo. INVENTADO, hospital incluido. **Las ocho celdas del riel**,
 * que son las que esta lámina compone: `fecha` y `hora` no se pasan porque en este formato
 * no viven en el riel —suben a la celda `Emisión` del bloque de título—, y `diagnostico`
 * tampoco: aquí es un bloque del cuerpo.
 *
 * Los días estimados y el peso llegan con su unidad ya redactada: 2.D coloca, no rotula ni
 * convierte.
 */
const PACIENTE_COMPLETO: ValoresPaciente = {
  paciente: 'Renata Bustamante Oceguera',
  edad: '25 años',
  sexo: 'Femenino',
  expediente: '2026-0184',
  hospital: 'Hospital Ficticio del Centro',
  tipoInternamiento: 'Cirugía electiva',
  diasEstimados: '2 días',
  asa: 'II',
}

/**
 * Paciente del caso mínimo: solo lo que bloquea emisión más la edad. Sin sexo, sin
 * expediente, sin tipo, sin días y sin ASA — las cinco celdas colapsan y las tres que
 * quedan se reparten el riel.
 */
const PACIENTE_MINIMO: ValoresPaciente = {
  paciente: 'Jorge Alberto Medina Salas',
  edad: '61 años',
  hospital: 'Hospital Ficticio del Centro',
}

/** Diagnósticos: el principal y dos secundarios, con la sintaxis de viñetas de 2.J. */
const DIAGNOSTICOS = [
  '— Gonartrosis tricompartimental derecha, grado IV de Kellgren-Lawrence',
  '— Hipertensión arterial sistémica en control con IECA',
  '— Obesidad grado I',
].join('\n')

const PROCEDIMIENTO =
  'Artroplastia total de rodilla derecha, cementada, con abordaje parapatelar medial.'

/**
 * EL CATÁLOGO DE REQUERIMIENTOS, en el orden literal de la lámina.
 *
 * ⚠ **SON SIETE Y EL PASO 4.6 DICE OCHO.** `SPEC_DISENO_PARTE_B.md` B.6 §4 los enumera con
 * nombre y son siete, y el formulario vivo de v1 lleva los mismos siete. Se componen los
 * siete y **queda reportado**: si hay un octavo, entra aquí sin tocar nada más — el
 * catálogo es abierto y por eso el riel va sin contador.
 *
 * Con siete y tres columnas, la última fila queda coja: es lo que hace una retícula que
 * envuelve, y es también lo que enseña que no se rellena con celdas vacías.
 */
const REQUERIMIENTOS: readonly string[] = [
  'Sangre y hemoderivados',
  'Profilaxis antibiótica',
  'Tromboprofilaxis',
  'Unidad de cuidados intensivos',
  'Material de osteosíntesis',
  'Implante especial',
  'Ayuno preoperatorio',
]

const JUSTIFICACION =
  'Dolor incapacitante de más de dieciocho meses de evolución, sin respuesta a tratamiento conservador con analgesia, fisioterapia e infiltración. La paciente refiere limitación para la marcha en trayectos menores de cien metros y despertares nocturnos por dolor.'

/**
 * LAS SEIS INSTRUCCIONES PRELLENADAS, en el orden literal de la lámina. Lista NUMERADA, no
 * con raya: la secuencia significa —primero presentarse, después el ayuno (II.6 §5).
 *
 * Entran con viñeta y el sistema pone el número: la regla 1 de composición de 2.J es que
 * nunca se imprimen las dos marcas.
 */
const INSTRUCCIONES = [
  '— Presentarse en Admisión a las 06:00 h del día programado, con este documento impreso.',
  '— Ayuno absoluto de ocho horas: sin alimentos, agua, café ni chicle.',
  '— No suspender los antihipertensivos: tomarlos con un sorbo mínimo de agua.',
  '— Llevar identificación oficial, póliza de seguro y estudios previos en disco.',
  '— Retirar esmalte de uñas, joyería, lentes de contacto y prótesis dentales.',
  '— Acudir acompañado por un adulto que pueda permanecer durante el internamiento.',
].join('\n')

/**
 * LAS INDICACIONES DE PISO — cuatro bloques numerados, cada uno con su encabezado y sus
 * viñetas. Es el único sitio del sistema donde el médico escribe estructura con texto
 * plano, y lo que la compone es el lookahead de 2.J.
 */
const INDICACIONES_PISO = [
  'Dieta',
  '— Ayuno absoluto hasta valoración del anestesiólogo.',
  '— Dieta blanda a tolerancia a las seis horas del posquirúrgico.',
  '',
  'Soluciones',
  '— Solución Hartmann 1000 mL para 8 horas.',
  '— Suspender al tolerar la vía oral.',
  '',
  'Medicamentos',
  '— Cefalotina 1 g intravenoso cada 8 horas por 24 horas.',
  '— Paracetamol 1 g intravenoso cada 8 horas.',
  '— Enoxaparina 40 mg subcutánea cada 24 horas, primera dosis a las 12 horas.',
  '',
  'Cuidados generales',
  '— Signos vitales cada 4 horas y reporte de sangrado por el drenaje.',
  '— Crioterapia local 20 minutos cada 4 horas.',
  '— Movilización asistida a las 12 horas del posquirúrgico.',
].join('\n')

/**
 * EL MISMO TEXTO CON DOS RENGLONES DE PROSA DELANTE. Es la verificación visible de II.6 §6:
 * los dos salen en minúsculas y sin raya, y el primer bloque numerado sigue llevando el 1.
 */
const INDICACIONES_CON_PROSA = [
  'La paciente ingresa la noche previa por indicación de anestesiología.',
  'Se avisa al residente de guardia al terminar el registro de ingreso.',
  '',
  INDICACIONES_PISO,
].join('\n')

/** Emisión ya compuesta: token corto de fecha + hora, con la raya del sistema. */
const EMISION = '8 ago 2026 · 09:40'

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
export type CasoInternamiento = 'completo' | 'minimo' | 'prosa'

interface Caso {
  readonly paciente: ValoresPaciente
  readonly urgente?: boolean
  readonly procedimiento?: string
  readonly requerimientos?: readonly string[]
  readonly justificacion?: string
  readonly instrucciones?: string
  readonly indicaciones?: string
}

const CASOS: Record<CasoInternamiento, Caso> = {
  completo: {
    paciente: PACIENTE_COMPLETO,
    urgente: true,
    procedimiento: PROCEDIMIENTO,
    requerimientos: REQUERIMIENTOS,
    justificacion: JUSTIFICACION,
    instrucciones: INSTRUCCIONES,
    indicaciones: INDICACIONES_PISO,
  },
  // Sin badge, sin procedimiento, sin requerimientos y SIN SECCIÓN 2: dos hojas.
  minimo: {
    paciente: PACIENTE_MINIMO,
    instrucciones: INSTRUCCIONES,
  },
  prosa: {
    paciente: PACIENTE_COMPLETO,
    procedimiento: PROCEDIMIENTO,
    requerimientos: REQUERIMIENTOS,
    justificacion: JUSTIFICACION,
    instrucciones: INSTRUCCIONES,
    indicaciones: INDICACIONES_CON_PROSA,
  },
}

function HojaInternamiento({
  medico,
  acentoHex,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  caso: CasoInternamiento
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const c = CASOS[caso]

  return (
    <Document title={`Solicitud de internamiento — taller · ${caso}`}>
      <SolicitudInternamiento
        medico={medicoMembrete(medico)}
        // El teléfono llega YA ROTULADO: 2.B coloca, no rotula.
        consultorio={{ domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` }}
        panel={{ variante: 'logo', acento, logo: medico.logo }}
        acento={acento}
        paciente={c.paciente}
        emision={EMISION}
        urgente={c.urgente}
        diagnosticos={DIAGNOSTICOS}
        procedimiento={c.procedimiento}
        requerimientos={c.requerimientos}
        justificacion={c.justificacion}
        instruccionesPaciente={c.instrucciones}
        indicacionesPiso={c.indicaciones}
      />
    </Document>
  )
}

/** Genera el blob del caso pedido. Se llama desde el cliente. */
export async function generarPdfInternamiento(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  // Sin QR: este formato no lo lleva (II.6 §1), así que tampoco hay ráster que generar.
  const elemento: ReactElement<DocumentProps> = (
    <HojaInternamiento
      medico={medico}
      acentoHex={acentoHex}
      caso={caso in CASOS ? (caso as CasoInternamiento) : 'completo'}
    />
  )
  return pdf(elemento).toBlob()
}
