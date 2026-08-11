/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.9 · Denegación o revocación del consentimiento. **No es la
 * emisión.** No lee la base ni Storage, no toca v1, no toca los formularios ni el flujo del
 * médico: el médico, el paciente y el familiar son inventados y viven aquí.
 *
 * CINCO CASOS, Y CADA UNO ENSEÑA UNA COSA QUE NO SE VE EN LOS OTROS
 *
 *   firma el paciente   tres firmantes en TRES columnas de 142, sin constancia
 *   por sustitución     dos en dos de 228, con la constancia del motivo — **la variante más
 *                       ajustada del sistema: le quedan 13.43 pt con el diagnóstico dentro**
 *   sin diagnóstico     la declaración **sin el inciso**: sin hueco, sin guion, sin coma doble
 *   familiar vacío      el campo vacío requerido del riel: conserva su rótulo y deja la línea
 *   procedimiento largo el riesgo que la guía deja declarado, con la cadena que lo destapa
 *
 * LO QUE HAY QUE MIRAR, POR ORDEN
 *
 * **Que las dos primeras quepan en una hoja.** Es la única condición dura de este documento:
 * una revocación en dos hojas no es aceptable. El visor lo dice en su barra —`1 / 1`— antes de
 * que haga falta medir nada.
 *
 * **La retícula de firmas.** En `firma el paciente` son tres columnas iguales en una sola fila,
 * sin media fila vacía; en `por sustitución` son dos y **la celda del paciente no está**, no
 * está vacía. Es el parámetro que este formato estrenó en 2.L.
 *
 * **Los 77 pt de espacio de firma, iguales en las dos.** No se comprimen para que quepa nada:
 * es la regla 1 de 2.L y es lo que hay que comprobar de un vistazo poniendo las dos al lado.
 *
 * **El procedimiento largo.** El subtítulo sale recortado con elipsis y el documento sigue en
 * una hoja; el nombre entero se lee dentro de la declaración, cuatro bloques más abajo. Si algún
 * día ese caso sale en dos hojas, lo que se ha roto es el recorte de 2.C.
 *
 * **El inciso del diagnóstico, poniendo `por sustitución` y `sin diagnóstico` uno al lado del
 * otro.** Son el mismo documento con y sin él, así que la frase se compara renglón a renglón: la
 * coma que abre el inciso viaja dentro de él, y sin diagnóstico queda `Yo, [PACIENTE], declaro
 * que…` sin hueco ni coma doble. **El diagnóstico NO está en el riel** y eso también se ve: las
 * dos hojas tienen el mismo encabezado.
 *
 * ⚠ **LAS RÚBRICAS SON UN PNG DE 1 × 1.** El taller no tiene capturas reales y no debe
 * inventarlas: lo que se comprueba aquí es la CAJA de 77 pt y que la imagen no se estire.
 *
 * **EL MÉDICO FIRMA Y LOS OTROS DOS NO**, que es el reparto normal: la rúbrica del médico se
 * captura una vez en su perfil y las de paciente y familiar solo existen si firmaron en
 * pantalla. Las tres celdas miden lo mismo y las dos sin firmar salen en blanco, sin leyenda.
 *
 * ⚠ **EL TEXTO CORRIDO VA JUSTIFICADO**, que es la misma excepción declarada a I.3.2 del
 * consentimiento y no una opción del taller. Ver la cabecera del formato.
 *
 * SIN GUÍAS, como los otros ocho formatos: un documento tiene que verse como un documento.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import DenegacionConsentimiento from '@/lib/pdf/v2/formatos/DenegacionConsentimiento'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import type { ValoresPaciente } from '@/lib/pdf/v2/BloquePaciente'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/** Ráster mínimo: un PNG de 1 × 1 en base64. Hace de rúbrica capturada. */
const RASTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/**
 * Paciente del documento. INVENTADO. **Seis de sus siete datos van al riel**, sin expediente; el
 * séptimo —el diagnóstico— **no está en el riel y sí dentro de la declaración**, que es donde
 * tiene valor legal en una revocación.
 */
const PACIENTE: ValoresPaciente = {
  paciente: 'Renata Bustamante Oceguera',
  edad: '25 años',
  fecha: '22 jun 2026',
  familiar: 'María Bustamante Canul',
  hospital: 'Hospital Ficticio del Centro',
  lugar: 'Mérida, Yucatán',
  diagnostico: 'Espondilolistesis degenerativa L4-L5 con estenosis del canal lumbar',
}

/** El mismo riel con el familiar SIN dato: la celda conserva su rótulo y deja la línea. */
const PACIENTE_SIN_FAMILIAR: ValoresPaciente = { ...PACIENTE, familiar: undefined }

/**
 * El mismo paciente SIN diagnóstico. No es un caso raro: en denegación el campo no es
 * obligatorio, y lo que hay que mirar es que la frase se componga **sin el inciso** —sin hueco,
 * sin guion y sin coma doble—.
 */
const PACIENTE_SIN_DIAGNOSTICO: ValoresPaciente = { ...PACIENTE, diagnostico: undefined }

const PROCEDIMIENTO = 'Artrodesis lumbar instrumentada L4-L5'

/**
 * EL NOMBRE QUE DESTAPA EL RIESGO DE LA GUÍA — un procedimiento quirúrgico completo, con
 * lateralidad, abordaje, niveles y material. No es una cadena inventada para que falle: es como
 * los escriben los formularios cuando nadie los acorta.
 */
const PROCEDIMIENTO_LARGO =
  'Artrodesis lumbar posterolateral instrumentada de L3 a S1 con tornillos transpediculares de titanio y descompresión mediante laminectomía'

/**
 * LOS TRES FIRMANTES. El médico firma —su rúbrica se captura una vez en el perfil— y los otros
 * dos no. Es lo que hay que mirar: las tres celdas miden lo mismo.
 */
const FIRMANTES = {
  medico: { rubrica: RASTER },
  paciente: { nombre: 'Renata Bustamante Oceguera' },
  familiar: { nombre: 'María Bustamante Canul' },
} as const

/** Folios INVENTADOS, con el prefijo `DEN` que fija la migración de folios. */
const FOLIOS = {
  paciente: 'DEN-2026-0001',
  sustitucion: 'DEN-2026-0002',
  sinDiagnostico: 'DEN-2026-0003',
  familiarVacio: 'DEN-2026-0004',
  largo: 'DEN-2026-0005',
} as const

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
export type CasoDenegacion =
  | 'paciente'
  | 'sustitucion'
  | 'sinDiagnostico'
  | 'familiarVacio'
  | 'largo'

const CASOS: Record<
  CasoDenegacion,
  {
    readonly paciente: ValoresPaciente
    readonly procedimiento: string
    readonly sustitucion?: boolean
    readonly folio: string
  }
> = {
  paciente: {
    paciente: PACIENTE,
    procedimiento: PROCEDIMIENTO,
    folio: FOLIOS.paciente,
  },
  /*
    LA MÁS AJUSTADA DEL SISTEMA, y con el diagnóstico dentro le quedan **13.43 pt**. Es el caso
    que hay que mirar cuando algo de este documento crezca: es el primero que desborda.
  */
  sustitucion: {
    paciente: PACIENTE,
    procedimiento: PROCEDIMIENTO,
    sustitucion: true,
    folio: FOLIOS.sustitucion,
  },
  /*
    VA POR SUSTITUCIÓN para que las dos frases se puedan comparar renglón a renglón contra el
    caso de arriba: lo único que cambia entre los dos es el inciso del diagnóstico.
  */
  sinDiagnostico: {
    paciente: PACIENTE_SIN_DIAGNOSTICO,
    procedimiento: PROCEDIMIENTO,
    sustitucion: true,
    folio: FOLIOS.sinDiagnostico,
  },
  familiarVacio: {
    paciente: PACIENTE_SIN_FAMILIAR,
    procedimiento: PROCEDIMIENTO,
    folio: FOLIOS.familiarVacio,
  },
  /*
    EL LARGO VA POR SUSTITUCIÓN A PROPÓSITO: es la variante que desborda primero, así que
    ponerlo en la otra no comprobaría nada. Ver el riesgo declarado en la guía.

    ⚠ **Y VA SIN DIAGNÓSTICO, QUE NO ES UNA OMISIÓN.** El nombre del procedimiento y el
    diagnóstico viven en el MISMO párrafo y compiten por los mismos renglones; con los dos al
    máximo el documento se va a dos hojas, y este caso existe para enseñar el recorte del
    subtítulo, no para enseñar el desborde. El techo de los dos juntos está medido en
    `denegacionConsentimiento.test.ts`.
  */
  largo: {
    paciente: PACIENTE_SIN_DIAGNOSTICO,
    procedimiento: PROCEDIMIENTO_LARGO,
    sustitucion: true,
    folio: FOLIOS.largo,
  },
}

function HojaDenegacion({
  medico,
  acentoHex,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  caso: CasoDenegacion
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const c = CASOS[caso]

  return (
    <Document title={`Denegación o revocación del consentimiento — taller · ${caso}`}>
      <DenegacionConsentimiento
        medico={medicoMembrete(medico)}
        // El teléfono llega YA ROTULADO: 2.B coloca, no rotula.
        consultorio={{ domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` }}
        panel={{ variante: 'logo', acento, logo: medico.logo }}
        acento={acento}
        paciente={c.paciente}
        procedimiento={c.procedimiento}
        firmantes={FIRMANTES}
        sustitucion={c.sustitucion}
        folio={c.folio}
      />
    </Document>
  )
}

/** Genera el blob del caso pedido. Se llama desde el cliente. */
export async function generarPdfDenegacion(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  // Sin QR: el documento no autoriza nada, es la constancia de que no se autorizó.
  const elemento: ReactElement<DocumentProps> = (
    <HojaDenegacion
      medico={medico}
      acentoHex={acentoHex}
      caso={caso in CASOS ? (caso as CasoDenegacion) : 'paciente'}
    />
  )
  return pdf(elemento).toBlob()
}
