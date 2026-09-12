/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Montaje de taller del formato II.7 · Consentimiento Informado. **No es la emisión.** No
 * lee la base ni Storage, no toca v1, no toca los formularios ni el flujo del médico: el
 * médico, el paciente, los testigos y las identificaciones son inventados y viven aquí.
 *
 * CUATRO CASOS, Y CADA UNO ENSEÑA UNA RAMA DISTINTA
 *
 *   completo      los cinco firmantes, tres niveles y la hoja de anexo con fotografías
 *   sin fotos     **la hoja de anexo NO aparece**: es la verificación de la decisión 5
 *   sustitución   el nivel 2 desaparece, Testigos se renumera a 2 y se compone su declaración
 *   sin sellar    **sin trazabilidad**: ni pies de celda ni bloque de cierre
 *
 * LOS SELLOS SON LA VERIFICACIÓN DEL `completo` Y DEL `sin sellar`
 *
 * En el sellado, **dos firmantes llevan pie con su hora y dos no**: el médico y el paciente
 * firmaron, el familiar y los dos testigos no. Las horas son distintas entre sí a propósito —
 * esa diferencia es parte de la evidencia—, y el bloque de cierre de la última hoja cuenta
 * cinco previstos, dos firmados y tres omitidos.
 *
 * En el `sin sellar` no hay un solo sello en ninguna parte, aunque los firmantes traigan hora:
 * un consentimiento impreso para firmarse a mano no tiene nada que sellar.
 *
 * LAS RÚBRICAS MEZCLADAS SON LO QUE HAY QUE MIRAR EN EL `completo`
 *
 * El médico y el paciente firman; el familiar y los dos testigos, no. Las cinco celdas
 * miden lo mismo —77 pt de espacio de escritura, sin comprimir— y **las tres sin firmar
 * salen en blanco, sin leyenda**: el aviso vive en pantalla, no en el papel (decisión 3).
 *
 * LOS TEXTOS CLÍNICOS SON LOS PRELLENADOS REALES DEL FORMULARIO
 *
 * Salen de `SECCIONES_DEFAULT` de `ConsentimientoInformadoForm.tsx`, que es la plantilla que
 * el médico edita en la app. No son PII: son boilerplate del sistema, y usarlos es lo que
 * hace que el taller mida renglones de verdad y no de una lorem ipsum más corta.
 *
 * ⚠ **LAS FOTOGRAFÍAS Y LAS RÚBRICAS SON UN PNG DE 1 × 1.** El taller no tiene capturas
 * reales y no debe inventarlas: lo que se comprueba aquí es la CAJA —228 × 144 con su
 * filete de acento y su fondo— y que la imagen no se estira, no el parecido de la foto.
 *
 * ⚠ **EL TEXTO CORRIDO VA JUSTIFICADO**, que es la excepción declarada a I.3.2 de este
 * formato y no una opción del taller: el interruptor con el que se comparó existió durante
 * una pasada y se retiró al decidir. Ver la cabecera del formato.
 *
 * SIN GUÍAS, como los otros seis formatos: un documento tiene que verse como un documento.
 */

import { Document, pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import ConsentimientoInformado, {
  type IdentificacionAnexo,
  type SeccionesConsentimiento,
} from '@/lib/pdf/v2/formatos/ConsentimientoInformado'
import type { MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import type { ValoresPaciente } from '@/lib/pdf/v2/BloquePaciente'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import { resolverAcento } from '@/lib/pdf/v2/tokens'
import type { MedicoFicticio } from './HojaTaller'

/**
 * Ráster mínimo: un PNG de 1 × 1 en base64. Hace de fotografía de identificación y de
 * rúbrica capturada. Ver la nota de la cabecera.
 */
const RASTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/**
 * Paciente del riel. INVENTADO. **Las ocho celdas que esta lámina compone**, sin sexo —este
 * formato no lo pide— y con el familiar, que es campo vacío requerido: si se quita, la celda
 * conserva su rótulo y deja la línea.
 */
const PACIENTE: ValoresPaciente = {
  paciente: 'Renata Bustamante Oceguera',
  edad: '25 años',
  expediente: '2026-0184',
  fecha: '22 jun 2026',
  familiar: 'María Bustamante Canul',
  diagnostico: 'Espondilolistesis degenerativa L4-L5 con estenosis del canal lumbar',
  hospital: 'Hospital Ficticio del Centro',
  lugar: 'Mérida, Yucatán',
}

const PROCEDIMIENTO = 'Artrodesis lumbar instrumentada L4-L5'

/**
 * LOS SIETE TEXTOS CLÍNICOS, los prellenados reales del formulario. Los dos que el
 * formulario deja vacíos —descripción y riesgos específicos— se rellenan aquí con prosa del
 * caso, porque son los que llevan zona de escritura y hay que ver las dos cosas juntas.
 */
const SECCIONES: SeccionesConsentimiento = {
  preoperatorio:
    'Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones previas correspondientes.',
  beneficios:
    'El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad, la cual podría producir lesiones más serias o dolor incapacitante. Los resultados esperados incluyen mejoría del dolor, recuperación funcional y mejora en la calidad de vida, aunque estos no pueden garantizarse en su totalidad, ya que dependen de múltiples factores individuales.',
  anestesia:
    'La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento. El médico anestesiólogo le informará cuál es la alternativa más adecuada para su caso y resolverá cualquier duda al respecto.',
  descripcion:
    'Se realizará abordaje posterior en la línea media, descompresión mediante laminectomía de L4, y artrodesis instrumentada con tornillos transpediculares y barras de titanio, complementada con injerto óseo autólogo y de banco.',
  riesgosComunes:
    'Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen pero no se limitan a: sangrado transoperatorio o postoperatorio, infección superficial o profunda de la herida quirúrgica, reacciones adversas a la anestesia o medicamentos, trombosis venosa profunda, tromboembolismo pulmonar, cicatrización anómala, dehiscencia de herida, y en casos excepcionales, complicaciones graves que podrían requerir tratamientos complementarios médicos o quirúrgicos e incluso, en un mínimo porcentaje de casos, ser causa de muerte.',
  riesgosEspecificos:
    'Lesión de la raíz nerviosa L5 con debilidad o alteración de la sensibilidad, fístula de líquido cefalorraquídeo, movilización o rotura del material de osteosíntesis, y ausencia de consolidación de la artrodesis con necesidad de reintervención.',
  alternativas:
    'Como alternativa al procedimiento propuesto, el paciente puede optar por tratamiento conservador que incluye manejo analgésico y antiinflamatorio, reposo relativo, rehabilitación física, uso de ortesis o inmovilización y otras medidas paliativas. Dicho tratamiento posiblemente mejore los síntomas sin resolver la causa de fondo, pudiendo requerir manejo definitivo en el futuro.',
}

/** Las cuatro identificaciones del anexo. Personas y claves INVENTADAS. */
const IDENTIFICACIONES: readonly IdentificacionAnexo[] = [
  {
    rol: 'Paciente',
    nombre: 'Renata Bustamante Oceguera',
    tipo: 'Credencial para votar',
    numero: 'BUOR010412MYN04',
    foto: RASTER,
  },
  {
    rol: 'Familiar o responsable',
    nombre: 'María Bustamante Canul',
    tipo: 'Credencial para votar',
    numero: 'BUCM780921MYN08',
    foto: RASTER,
  },
  {
    rol: 'Testigo 1',
    nombre: 'Juan Canul Uc',
    tipo: 'Credencial para votar',
    // Sin fotografía: el recuadro se compone igual, con su leyenda y con estos dos datos.
    numero: 'CAUJ850614HYN02',
  },
  {
    rol: 'Testigo 2',
    nombre: 'Rosa Pech Ek',
    tipo: 'Pasaporte',
    numero: 'G12345678',
    foto: RASTER,
  },
]

/** Las mismas identificaciones sin ninguna fotografía: la hoja de anexo NO se imprime. */
const IDENTIFICACIONES_SIN_FOTO: readonly IdentificacionAnexo[] =
  IDENTIFICACIONES.map(({ rol, nombre, tipo, numero }) => ({ rol, nombre, tipo, numero }))

/**
 * LOS CINCO FIRMANTES, con las rúbricas MEZCLADAS. Es lo que hay que mirar: el médico
 * siempre, el paciente porque firmó en pantalla, y los otros tres en blanco.
 */
const FIRMANTES = {
  medico: { rubrica: RASTER, sello: '09/08/2026 12:41:52' },
  paciente: {
    nombre: 'Renata Bustamante Oceguera',
    rubrica: RASTER,
    sello: '09/08/2026 12:43:07',
  },
  // Los tres sin sello: no firmaron, así que su celda no lleva pie.
  familiar: { nombre: 'María Bustamante Canul' },
  testigo1: { nombre: 'Juan Canul Uc' },
  testigo2: { nombre: 'Rosa Pech Ek' },
} as const

/** El sello del documento. Fecha y huella INVENTADAS. */
const SELLADO = { fecha: '09/08/2026 12:47:19', huella: '3f9a…8c41' } as const

/**
 * LOS FIRMANTES DEL CASO DE CONSULTA — sin testigos y sin familiar.
 *
 * Es el caso NORMAL en consulta y el que destapó los DOS defectos del mismo hecho, que se
 * corrigieron en dos pases:
 *
 *   1. El bloque de cierre declaraba «5 firmantes previstos, 2 firmaron, 3 omitidos» sobre
 *      tres personas a las que nadie pidió nada.
 *   2. **Y las celdas se componían igual, vacías** — rol, 77 pt de espacio, línea y nota—,
 *      que es lo mismo dicho sin palabras y en el sitio donde más se mira.
 *
 * Ahora no se compone la celda de quien no iba a firmar, y con ninguno de los dos niveles
 * la hoja entera desaparece: este caso sale en CUATRO hojas y `completo` en seis. Miradas
 * la una junto a la otra, enseñan las dos formas del bloque de firmas y de la línea de
 * sellado.
 */
const FIRMANTES_SIN_TESTIGOS = {
  medico: FIRMANTES.medico,
  paciente: FIRMANTES.paciente,
  familiar: {},
  testigo1: {},
  testigo2: {},
} as const

/**
 * Las identificaciones SIN tipo ni número, que es como llegan hoy: el formulario captura la
 * fotografía de la credencial y nada más. El pie del recuadro colapsa entero.
 */
const IDENTIFICACIONES_SIN_DATOS: readonly IdentificacionAnexo[] = IDENTIFICACIONES.map(
  ({ rol, nombre, foto }) => ({ rol, nombre, foto }),
)

/** Folios INVENTADOS, con el prefijo `C-` que la lámina compone. */
const FOLIOS = {
  completo: 'C-7F41A9C0D3E2',
  sinFotos: 'C-2B60E4F19A7C',
  sustitucion: 'C-9D08C5A2B461',
  sinSellar: 'C-5E13B7A6C209',
  autorizaciones: 'C-84A2F70B1D5E',
  sinTestigos: 'C-1C79E5D24B60',
  anexoSinDatos: 'C-D250A8C63F1B',
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
export type CasoConsentimiento =
  | 'completo'
  | 'sinFotos'
  | 'sustitucion'
  | 'sinSellar'
  /** Las dos autorizaciones, con la transfusión RECHAZADA. Ver `autorizaciones` en II.7. */
  | 'autorizaciones'
  /** El caso de consulta: el papel no declara ausencias de quien no fue convocado. */
  | 'sinTestigos'
  /** El anexo como llega hoy: fotografía sin tipo ni número. El pie colapsa. */
  | 'anexoSinDatos'

const CASOS: Record<
  CasoConsentimiento,
  {
    readonly identificaciones: readonly IdentificacionAnexo[]
    readonly pacienteNoPuedeFirmar?: boolean
    readonly sellado?: typeof SELLADO
    readonly folio: string
    readonly autorizaTransfusion?: 'si' | 'no'
    readonly autorizaFotos?: boolean
    readonly firmantes?: typeof FIRMANTES | typeof FIRMANTES_SIN_TESTIGOS
  }
> = {
  /*
    LLEVA LA TRANSFUSIÓN AUTORIZADA porque un documento completo hoy no puede no
    llevarla: el formulario exige la respuesta para emitir. Sin ella, este caso estaría
    midiendo un papel que ya no se puede emitir —solo reimprimir, si se firmó antes de
    la regla—, y el caso de referencia del taller tiene que ser uno real.
  */
  completo: {
    identificaciones: IDENTIFICACIONES,
    sellado: SELLADO,
    folio: FOLIOS.completo,
    autorizaTransfusion: 'si',
  },
  sinFotos: {
    identificaciones: IDENTIFICACIONES_SIN_FOTO,
    sellado: SELLADO,
    folio: FOLIOS.sinFotos,
  },
  sustitucion: {
    identificaciones: IDENTIFICACIONES,
    pacienteNoPuedeFirmar: true,
    sellado: SELLADO,
    folio: FOLIOS.sustitucion,
  },
  // Sin `sellado`: ni pies de celda ni bloque de cierre.
  sinSellar: { identificaciones: IDENTIFICACIONES, folio: FOLIOS.sinSellar },
  /*
    LA TRANSFUSIÓN VA EN `no` A PROPÓSITO. El `sí` es el caso amable y el que cualquiera
    probaría; la negativa expresa es el dato con más valor legal de los dos, y el papel la
    compone entera —«NO autorizo…, asumiendo los riesgos»— en vez de callarla. Junto a
    `completo`, que lleva el `sí`, se ven las dos redacciones una al lado de otra.

    Y con las fotografías encima: es la pila de DOS declaraciones, para ver el aire de 8 pt
    que las separa frente a los 12 con que la primera cuelga del marco.
  */
  autorizaciones: {
    identificaciones: IDENTIFICACIONES,
    sellado: SELLADO,
    folio: FOLIOS.autorizaciones,
    autorizaTransfusion: 'no',
    autorizaFotos: true,
  },
  sinTestigos: {
    identificaciones: [],
    sellado: SELLADO,
    folio: FOLIOS.sinTestigos,
    firmantes: FIRMANTES_SIN_TESTIGOS,
  },
  anexoSinDatos: {
    identificaciones: IDENTIFICACIONES_SIN_DATOS,
    sellado: SELLADO,
    folio: FOLIOS.anexoSinDatos,
  },
}

function HojaConsentimiento({
  medico,
  acentoHex,
  caso,
}: {
  medico: MedicoFicticio
  acentoHex: string
  caso: CasoConsentimiento
}): ReactElement {
  const acento = resolverAcento(acentoHex)
  const c = CASOS[caso]

  return (
    <Document title={`Carta de consentimiento informado — taller · ${caso}`}>
      <ConsentimientoInformado
        medico={medicoMembrete(medico)}
        // El teléfono llega YA ROTULADO: 2.B coloca, no rotula.
        consultorio={{ domicilio: medico.domicilio, telefono: `Tel. ${medico.telefono}` }}
        panel={{ variante: 'logo', acento, logo: medico.logo }}
        acento={acento}
        paciente={PACIENTE}
        procedimiento={PROCEDIMIENTO}
        secciones={SECCIONES}
        firmantes={c.firmantes ?? FIRMANTES}
        pacienteNoPuedeFirmar={c.pacienteNoPuedeFirmar}
        autorizaTransfusion={c.autorizaTransfusion}
        autorizaFotos={c.autorizaFotos}
        identificaciones={c.identificaciones}
        sellado={c.sellado}
        folio={c.folio}
      />
    </Document>
  )
}

/** Genera el blob del caso pedido. Se llama desde el cliente. */
export async function generarPdfConsentimiento(
  medico: MedicoFicticio,
  acentoHex: string,
  caso: string,
): Promise<Blob> {
  registrarFuentesV2()
  // Sin QR: II.7 conserva el folio y retira el código (anexo A, P2-30).
  const elemento: ReactElement<DocumentProps> = (
    <HojaConsentimiento
      medico={medico}
      acentoHex={acentoHex}
      caso={caso in CASOS ? (caso as CasoConsentimiento) : 'completo'}
    />
  )
  return pdf(elemento).toBlob()
}
