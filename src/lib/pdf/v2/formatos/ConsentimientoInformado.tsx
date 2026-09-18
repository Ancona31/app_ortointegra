/**
 * Sistema de documentos v3 — formato **II.7 · Carta de Consentimiento Informado**.
 * Brief `07`. Arquetipo D: multipágina, el de texto corrido más extenso del sistema y
 * el único con firmas en tres niveles de jerarquía.
 *
 * ── LO QUE CAMBIA RESPECTO DE v2, Y ES EL FORMATO QUE MÁS GANA ──────────────
 *
 * 1. **LOS TESTIGOS Y EL ANEXO SON `Page` PROPIOS** (defecto §4). El mapa
 *    `{ 5: { rotulo: 'Anexo · …' } }` indexado por número de hoja se elimina: bastaba
 *    que el documento creciera una hoja para que el rótulo del anexo apareciera encima
 *    de una hoja de texto corrido. Ahora cada hoja con rótulo propio es un elemento de
 *    página con su rótulo **escrito en el componente**.
 *    ⚠ **Esto no es «dos formatos en un PDF»**: `pageNumber` y `totalPages` son globales
 *    al `Document`, así que la paginación sigue siendo continua y la banda de pie de
 *    cada `Page` cuenta lo mismo.
 * 2. **El encabezado pasa de 511.6 pt a 190.6** — el recorte más grande del sistema. La
 *    causa de aquellos 511.6 era meter el fundamento legal ENTRE el título y la ficha;
 *    ahora el fundamento es el primer bloque del cuerpo, que es lo que es.
 * 3. **Se retira el subtítulo del bloque de título**: el procedimiento vive en la ficha
 *    y en la declaración, y componerlo tres veces era la redundancia más caraine del
 *    formato.
 * 4. **El diagnóstico se imprime una sola vez** (brief 00 §5.2): en su fila de la ficha,
 *    y **no se repite en la declaración**, que cita el procedimiento.
 * 5. **La medida de línea pasa de 402 a 507 pt** (defecto §9.7): con 402 el justificado
 *    abría ríos en todos los párrafos largos. 507 es la caja menos la sangría del marco.
 * 6. **Dos celdas de firma por fila como máximo** (brief 00 §6.2). En v2 la retícula
 *    llegaba a tres y las celdas bajaban a 106 pt de ancho.
 * 7. **Se retiran los saltos declarados antes de la declaración y antes de
 *    representación**: la declaración comparte hoja con las secciones y con la pareja de
 *    firmas. Quedan los dos que sí son estructurales, y son los dos `Page` nuevos.
 *
 * ⚠ **EL FUNDAMENTO LEGAL ES LITERAL, CARÁCTER POR CARÁCTER** (decisión cerrada). Es
 * una constante del sistema y no un campo: ningún formulario lo captura y ningún médico
 * lo edita. Si cambia la norma, cambia esta constante.
 *
 * ⚠ **AQUÍ VIVE LA PRIMERA DE LAS DOS EXCEPCIONES DECLARADAS A I.3.2** (prohibición del
 * justificado). La segunda está en el Escrito médico. `grep -rn "'justify'" src/lib/pdf/v2`
 * tiene que devolver tres líneas contadas —ésta, el Escrito y la Denegación— y ninguna sin
 * nota.
 */

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import BloqueFirmas, { type CeldaFirma, type Firma } from '../BloqueFirmas'
import EncabezadoHoja from '../EncabezadoHoja'
import MarcoParcial, { MARCO } from '../MarcoParcial'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import {
  CAJA,
  ESPACIO,
  FILETE,
  RETICULA,
  TINTA,
  TRANSICION,
  TIPOGRAFIA,
  MARGEN,
  PAPEL,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

const TITULO = 'Carta de consentimiento informado'
const ROTULO_FUNDAMENTO = 'Fundamento legal'
const ROTULO_DECLARACION = 'Declaración de consentimiento'
const ROTULO_ANEXO = 'Anexo · identificación de firmantes'
const ROTULO_TESTIGOS = 'Testigos del consentimiento'
const ENTRADILLA_ANEXO =
  'Reproducción de la identificación oficial del paciente y de las personas que firman el consentimiento.'
const SIN_FOTO = 'No se capturó fotografía de la identificación de este firmante.'

/**
 * Los dos rótulos del bloque de trazabilidad del anexo.
 *
 * ⚠ **SIN ELLOS EL BLOQUE NO DICE NADA, Y ASÍ SALÍA.** Las dos líneas se componían
 * como dato pelado —una fecha y un hexadecimal truncado, sin una palabra alrededor—,
 * que en un documento legal es peor que no imprimirlas: quien lo recibe no puede saber
 * si `09/08/2026 12:47:19` es la fecha del sellado, la de la cirugía o la de la
 * impresión. Son cadenas del sistema, no datos: las redacta el formato.
 */
const SELLO = {
  fecha: 'Documento sellado el',
  firmado: 'Firmado',
  conAnexo: 'con identificación anexa',
  huella: 'Huella SHA-256',
  verificable: 'verificable en el expediente electrónico',
} as const

/**
 * EL RECUENTO DEL SELLADO — y **cuando no falta nadie, no se enumeran ausencias**.
 *
 * ⚠⚠ **FALTABA EN LA ENTREGA Y NO ES UNA CIFRA DECORATIVA.** El bloque de trazabilidad
 * componía la fecha y la huella y nada más; sin el recuento, el papel sellado no dice a
 * cuántas personas se les pidió firma ni cuántas lo hicieron, que es exactamente lo que
 * un sellado acredita.
 *
 * `previstos` sale de a quién se le PIDIÓ firma —quien tiene nombre escrito o sello—, no
 * del número de celdas: las de testigo se componen siempre por NOM-004, y contarlas hacía
 * que un consentimiento de consulta sin testigos imprimiera «2 omitidos» sobre dos
 * personas a las que nadie pidió nada. En un papel que puede acabar en sede legal eso no
 * es una imprecisión de redacción: es una afirmación falsa sobre personas.
 *
 * La concordancia de número se compone: `1 firmó` y `1 omitido` en singular.
 */
function recuento(previstos: number, firmaron: number): string {
  const omitidos = previstos - firmaron
  const firmo = `${firmaron} ${firmaron === 1 ? 'firmó' : 'firmaron'}`
  if (omitidos <= 0) return firmo
  return [
    `${previstos} ${previstos === 1 ? 'firmante previsto' : 'firmantes previstos'}`,
    firmo,
    `${omitidos} ${omitidos === 1 ? 'omitido' : 'omitidos'}`,
  ].join(', ')
}

/**
 * EL PIE DE LA CELDA DE FIRMA, que no es sólo la hora.
 *
 * ⚠ **LA ENTREGA COMPONÍA EL SELLO A PELO.** Bajo la raya de firma salía
 * `09/08/2026 12:43:07` y nada más: una hora sin decir de qué, que en una hoja que puede
 * acabar en sede legal se lee igual de bien como hora de la cirugía que como hora del
 * ingreso. El verbo es lo que la convierte en evidencia de la firma.
 *
 * Y quien tiene su identificación reproducida en el anexo lo dice AQUÍ, que es donde se
 * mira: el anexo está tres hojas más adelante y nadie lo cruza solo. El médico no lo
 * lleva nunca —el anexo reproduce la identificación de quien CONSIENTE, no la de quien
 * informa—, así que la ausencia de la coletilla en su celda también significa algo.
 */
function pieDeSello(
  sello: string | undefined,
  conAnexo: boolean,
  hayTrazabilidad: boolean,
): ReactNode {
  // Un interruptor para los dos sitios: sin bloque de sellado no puede quedar un pie de
  // celda suelto. Un consentimiento impreso para firmarse a mano no lleva trazabilidad.
  if (!hayTrazabilidad) return undefined
  if (sello === undefined || sello.trim() === '') return undefined
  const piezas = conAnexo
    ? `${SELLO.firmado} ${sello} · ${SELLO.conAnexo}`
    : `${SELLO.firmado} ${sello}`
  return <Text style={estilos.sello}>{piezas}</Text>
}

/** ¿Se le pidió firma? Quien tiene nombre escrito, o quien ya firmó. */
function pidioFirma(firmante: FirmanteConsentimiento): boolean {
  const conNombre = firmante.nombre !== undefined && firmante.nombre.trim() !== ''
  const conSello = firmante.sello !== undefined && firmante.sello.trim() !== ''
  return conNombre || conSello
}

/** Los tres niveles de firma, con su ordinal. Se componen en versalita. */
const NIVEL = {
  otorgamiento: 'Otorgamiento',
  representacion: 'Representación',
  testigos: 'Testigos',
} as const

const ROL = {
  medico: 'Médico tratante',
  paciente: 'Paciente',
  familiar: 'Familiar o responsable',
  testigo1: 'Testigo 1',
  testigo2: 'Testigo 2',
} as const

/**
 * LA CONSTANCIA DE LA SUSTITUCIÓN.
 *
 * ⚠⚠ **FALTABA EN LA ENTREGA Y NO ES REDUNDANTE CON LA CELDA.** Cuando el paciente no
 * puede firmar, el formato sustituye su celda por la del familiar y no escribe una sola
 * palabra sobre el cambio. Quien recibe el papel ve dos firmas —médico y familiar— y
 * ninguna del paciente, sin nada que diga si falta o si no se le pidió. La frase lo dice,
 * y remite a la celda donde están los datos de quien firmó en su lugar.
 */
const TEXTO_SUSTITUCION =
  'El paciente no puede firmar por sí mismo; firma en su lugar el familiar o responsable, cuyos datos se asientan en la celda de la derecha.'

const NOTA = {
  paciente: 'Nombre y firma',
  familiar: 'Representante del paciente',
  testigo: 'Mayor de edad',
  parentesco: 'Parentesco con el paciente',
} as const

const TRANSFUSION = {
  si: 'Autorizo la transfusión de sangre o hemoderivados si el médico lo considera necesario durante el procedimiento.',
  no: 'NO autorizo la transfusión de sangre o hemoderivados, asumiendo los riesgos que esto implica.',
} as const
const FOTOS =
  'Autorizo la toma de fotografías clínicas con fines de documentación médica y seguimiento del tratamiento.'

/** Literal. Ver el aviso de la cabecera. */
const FUNDAMENTO =
  'De conformidad con la Norma Oficial Mexicana NOM-004-SSA3-2012 del Expediente Clínico, la Ley General de Salud (Art. 80 y 81) y el Reglamento de la Ley General de Salud en Materia de Prestación de Servicios de Atención Médica (Art. 80), este documento informa al paciente o a su representante legal sobre el procedimiento propuesto, sus riesgos, beneficios y alternativas, a fin de obtener su consentimiento libre, voluntario e informado.'

/** Las siete secciones clínicas, en orden, con su título y su entradilla. */
const SECCIONES: readonly {
  readonly clave: keyof SeccionesConsentimiento
  readonly titulo: string
  readonly entradilla?: string
}[] = [
  { clave: 'preoperatorio', titulo: 'Evaluación y decisión terapéutica' },
  { clave: 'beneficios', titulo: 'Beneficios esperados' },
  { clave: 'anestesia', titulo: 'Anestesia' },
  {
    clave: 'descripcion',
    titulo: 'Descripción del procedimiento',
    entradilla: 'A completar por el médico tratante, en términos comprensibles para el paciente.',
  },
  { clave: 'riesgosComunes', titulo: 'Riesgos comunes' },
  {
    clave: 'riesgosEspecificos',
    titulo: 'Riesgos específicos',
    entradilla:
      'Derivados de la localización anatómica y de las condiciones particulares del paciente. Se le han explicado de forma verbal y se detallan a continuación.',
  },
  { clave: 'alternativas', titulo: 'Alternativas de tratamiento' },
]

const PRESENCIA_ULTIMA_SECCION = 108

/**
 * v3 · LO QUE TIENE QUE CABER DEBAJO DEL RÓTULO DE UNA SECCIÓN PARA QUE NO SE QUEDE
 * SOLO AL PIE DE LA HOJA.
 *
 * ⚠ **El rótulo y el párrafo son DOS bloques hermanos y no uno, y ésa es la razón.**
 * Con un solo `View` por sección el motor la parte por donde le toca —`shouldSplit`
 * gana a `minPresenceAhead`, que sólo decide cuando el bloque CABE entero— y la hoja 1
 * cerraba con `4 · DESCRIPCIÓN DEL PROCEDIMIENTO` y nada debajo. Separados, la cabecera
 * siempre cabe, así que su `minPresenceAhead` sí gobierna: si detrás no quedan dos
 * renglones de párrafo, la cabecera se va con ellos.
 *
 * DERIVADO: aire del párrafo (6) + dos renglones de `seccion.parrafo` (2 × 16) = 38.
 */
const PRESENCIA_CABECERA =
  TRANSICION.seccionParrafo + 2 * (TIPOGRAFIA['seccion.parrafo'].interlineado ?? 16)

/** Cuatro filas. La celda base de este formato mide 28.5 y no 27 (calibración `declaracion`). */
const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 5 },
    { campo: 'edad', columnas: 2 },
    { campo: 'expediente', columnas: 2 },
    { campo: 'fecha', columnas: 3 },
  ],
  [{ campo: 'familiar', columnas: 12 }],
  [{ campo: 'diagnostico', columnas: 12 }],
  [
    { campo: 'hospital', columnas: 8, etiqueta: 'Hospital o clínica' },
    { campo: 'lugar', columnas: 4 },
  ],
]

/** Caja de fotografía del anexo. **144 pt: hay mínimo legal de reproducción.** */
const ANEXO = { caja: 144, cabecera: 42, columnas: 2, medianil: ESPACIO[16] } as const

export interface FirmanteConsentimiento {
  /** Sin él, el renglón se reserva para llenarlo a mano. */
  readonly nombre?: string
  readonly rubrica?: string
  /** Sello de trazabilidad: `Firmado 09/08/2026 12:41:52`. Ya redactado. */
  readonly sello?: string
}

export interface IdentificacionAnexo {
  /** Rol de la persona, con la MISMA cadena que su celda de firma. */
  readonly rol: string
  readonly nombre: string
  readonly tipo?: string
  readonly numero?: string
  /** Ráster de la credencial. Sin él, el recuadro compone su leyenda de ausencia. */
  readonly foto?: string
}

export interface SeccionesConsentimiento {
  readonly preoperatorio?: string
  readonly beneficios?: string
  readonly anestesia?: string
  readonly descripcion?: string
  readonly riesgosComunes?: string
  readonly riesgosEspecificos?: string
  readonly alternativas?: string
}

export interface ConsentimientoInformadoProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly paciente: ValoresPaciente
  /** El procedimiento autorizado. Bloquea emisión. */
  readonly procedimiento: string
  readonly secciones: SeccionesConsentimiento
  readonly firmantes: {
    readonly medico: FirmanteConsentimiento
    readonly paciente: FirmanteConsentimiento
    readonly familiar: FirmanteConsentimiento
    readonly testigo1: FirmanteConsentimiento
    readonly testigo2: FirmanteConsentimiento
  }
  readonly pacienteNoPuedeFirmar: boolean
  /** Tri-estado: `true` autoriza, `false` niega, `undefined` no se compone. */
  readonly autorizaTransfusion?: boolean
  readonly autorizaFotos: boolean
  readonly identificaciones: readonly IdentificacionAnexo[]
  /** Los dos juntos o ninguno: un sellado sin huella diría menos de lo que promete. */
  readonly sellado?: { readonly fecha: string; readonly huella: string }
  readonly folio: string
}

/** El riel del ordinal de sección. Propio: el número de una cifra vive holgado en 36. */
const RIEL_NUMERO = RETICULA.riel + 12

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    paddingBottom: MARGEN.inferior,
  },
  fundamento: { marginBottom: ESPACIO[16] },
  rotuloBloque: { ...estiloTipografico('rotulo.bloque'), marginBottom: ESPACIO[6] },
  rotuloSeccion: { ...estiloTipografico('titulo.seccion') },
  fundamentoCuerpo: { ...estiloTipografico('fundamento.cuerpo'), textAlign: 'justify' },
  /** La cabecera de la sección: filete, número y rótulo. Nunca se parte. */
  seccionCabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: FILETE.tabla,
    borderTopColor: TINTA.negra,
    paddingTop: ESPACIO[8],
  },
  /** El párrafo, en la misma retícula. Éste sí se parte entre hojas. */
  seccionCuerpo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: ESPACIO[12],
  },
  rielNumero: { width: RIEL_NUMERO, flexShrink: 0 },
  numero: { ...estiloTipografico('nivel.numero') },
  /** Ver la nota de `caja` en 2.G: un `Text` no recibe su ancho del reparto flex. */
  cuerpoSeccion: { width: CAJA.ancho - RIEL_NUMERO, flexShrink: 0 },
  entradilla: { ...estiloTipografico('seccion.entradilla'), marginTop: ESPACIO[4] },
  /** La medida de línea del justificado: 507 pt. Ver el punto 5 de la cabecera. */
  parrafo: {
    ...estiloTipografico('seccion.parrafo'),
    textAlign: 'justify',
    marginTop: TRANSICION.seccionParrafo,
  },
  fuerte: { fontWeight: 500 },
  casilla: { ...estiloTipografico('casilla.texto'), marginBottom: ESPACIO[4] },
  nivel: { flexDirection: 'row', alignItems: 'center', marginBottom: ESPACIO[8] },
  nivelNumero: { ...estiloTipografico('nivel.numero'), marginRight: ESPACIO[6] },
  nivelRotulo: { ...estiloTipografico('firma.rol') },
  nivelRegla: {
    flexGrow: 1,
    marginLeft: ESPACIO[10],
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.hairline,
  },
  banda: { marginTop: TRANSICION.contenidoCierre },
  parentesco: { ...estiloTipografico('aseguradora.rotulo'), marginBottom: ESPACIO[4] },
  lineaParentesco: {
    height: 16,
    borderBottomWidth: FILETE.regla,
    borderBottomColor: TINTA.negra,
  },
  sello: { ...estiloTipografico('sello.pie') },
  anexoEntradilla: { ...estiloTipografico('texto.corrido'), marginBottom: ESPACIO[16] },
  anexoRejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  anexoCelda: { marginBottom: ANEXO.medianil },
  anexoCabecera: {
    height: ANEXO.cabecera,
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  anexoNumero: { ...estiloTipografico('seccion.numero'), width: 28, flexShrink: 0 },
  anexoRol: { ...estiloTipografico('firma.rol') },
  anexoNombre: { ...estiloTipografico('anexo.nombre'), maxLines: 1, textOverflow: 'ellipsis' },
  anexoCaja: {
    height: ANEXO.caja,
    backgroundColor: TINTA.papelTenue,
    borderWidth: 0.5,
    borderColor: TINTA.reglaSuave,
    borderTopWidth: FILETE.acento,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ESPACIO[8],
  },
  anexoSinFoto: { ...estiloTipografico('anexo.pie'), textAlign: 'center' },
  anexoPie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: ESPACIO[4] },
  anexoPieTexto: { ...estiloTipografico('anexo.pie') },
  selladoBloque: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.hairline,
    paddingTop: ESPACIO[6],
    marginTop: ESPACIO[8],
  },
})

/** Una sección clínica: número en su riel, título, entradilla y párrafo justificado. */
function Seccion({
  numero,
  titulo,
  entradilla,
  texto,
  presencia,
  acento,
}: {
  readonly numero: number
  readonly titulo: string
  readonly entradilla?: string
  readonly texto: string
  readonly presencia?: number
  readonly acento: AcentoResuelto
}): ReactElement {
  return (
    <>
      <View
        style={estilos.seccionCabecera}
        wrap={false}
        minPresenceAhead={PRESENCIA_CABECERA}
      >
        <View style={estilos.rielNumero}>
          <Text style={{ ...estilos.numero, color: acento.tinta }}>{numero}</Text>
        </View>
        <View style={estilos.cuerpoSeccion}>
          <Text style={estilos.rotuloSeccion}>{titulo.toUpperCase()}</Text>
          {entradilla === undefined ? null : (
            <Text style={estilos.entradilla}>{entradilla}</Text>
          )}
        </View>
      </View>

      <View style={estilos.seccionCuerpo} minPresenceAhead={presencia}>
        {/* El riel vacío conserva la sangría del párrafo bajo su rótulo. */}
        <View style={estilos.rielNumero} />
        <View style={estilos.cuerpoSeccion}>
          <Text style={estilos.parrafo}>{texto}</Text>
        </View>
      </View>
    </>
  )
}

/** El rótulo de un nivel de firma: ordinal, versalita y regla hasta el borde. */
function Nivel({
  numero,
  rotulo,
  acento,
}: {
  readonly numero: number
  readonly rotulo: string
  readonly acento: AcentoResuelto
}): ReactElement {
  return (
    <View style={estilos.nivel}>
      <Text style={{ ...estilos.nivelNumero, color: acento.tinta }}>{numero}</Text>
      <Text style={estilos.nivelRotulo}>{rotulo.toUpperCase()}</Text>
      <View style={estilos.nivelRegla} />
    </View>
  )
}

/** II.7 · Carta de Consentimiento Informado. Devuelve el `Document` entero. */
export default function ConsentimientoInformado(
  props: ConsentimientoInformadoProps,
): ReactElement<DocumentProps> {
  const {
    medico,
    consultorio,
    panel,
    acento,
    paciente,
    procedimiento,
    secciones,
    firmantes,
    pacienteNoPuedeFirmar,
    autorizaTransfusion,
    autorizaFotos,
    identificaciones,
    sellado,
    folio,
  } = props

  const encabezado = {
    medico,
    consultorio,
    panel,
    acento,
    titulo: TITULO,
    folio,
    paciente,
    filasFicha: FICHA,
    calibracionFicha: 'declaracion' as const,
  }

  const vivas = SECCIONES.map((s) => ({ ...s, texto: secciones[s.clave] })).filter(
    (s): s is typeof s & { texto: string } => s.texto !== undefined && s.texto.trim() !== '',
  )

  /** ¿El anexo reproduce la identificación de este rol? Se compara por el rótulo. */
  const enAnexo = (rol: string): boolean =>
    identificaciones.some((i) => i.rol.trim().toUpperCase() === rol.trim().toUpperCase())

  const celdaMedico: Firma = {
    rol: ROL.medico,
    nombre: firmantes.medico.nombre ?? medico.nombre,
    credenciales: medico.cedulas,
    rubrica: firmantes.medico.rubrica,
    sello: pieDeSello(firmantes.medico.sello, enAnexo(ROL.medico), sellado !== undefined),
  }

  /**
   * La celda del paciente **no se compone cuando no puede firmar**: en su lugar firma
   * el familiar, y eso no es un hueco de retícula sino una firma que no se le pidió.
   */
  const celdaPaciente: CeldaFirma = pacienteNoPuedeFirmar
    ? null
    : {
        rol: ROL.paciente,
        nombre: firmantes.paciente.nombre ?? paciente.paciente,
        credenciales: [NOTA.paciente],
        rubrica: firmantes.paciente.rubrica,
        sello: pieDeSello(firmantes.paciente.sello, enAnexo(ROL.paciente), sellado !== undefined),
      }

  /**
   * LA CELDA DEL FAMILIAR **NO SE COMPONE SI NADIE LE PIDIÓ FIRMA.**
   *
   * ⚠ **LA CONDICIÓN MIRA A `firmantes`, NO A LA FICHA.** Que el riel traiga un familiar
   * es un dato de contacto del expediente; pedirle firma es otra cosa, y quien lo decide
   * es el formulario al llenar `firmantes.familiar`. Con la ficha como condición, un
   * consentimiento de consulta —que casi siempre trae acompañante anotado— componía un
   * nivel de REPRESENTACIÓN entero con la raya en blanco, y una raya en blanco bajo un
   * nombre afirma que esa persona tenía que firmar y no firmó.
   *
   * Por sustitución la celda existe SIEMPRE: ahí el familiar es quien otorga, y sin su
   * celda el documento no tendría ninguna firma de la parte que consiente.
   */
  const lePidieronFirma =
    (firmantes.familiar.nombre !== undefined && firmantes.familiar.nombre.trim() !== '') ||
    firmantes.familiar.rubrica !== undefined
  const celdaFamiliar: CeldaFirma =
    !pacienteNoPuedeFirmar && !lePidieronFirma
      ? null
      : {
          rol: ROL.familiar,
          nombre: firmantes.familiar.nombre ?? paciente.familiar,
          credenciales: [NOTA.familiar],
          rubrica: firmantes.familiar.rubrica,
          sello: pieDeSello(firmantes.familiar.sello, enAnexo(ROL.familiar), sellado !== undefined),
          /*
            El parentesco cuelga de la celda y **no es una credencial**: es un dato que
            se llena a pluma después de firmar, y por eso `altoBloqueFirma()` no lo
            cuenta. Sumar su alto —11 de rótulo + 16 de línea + 6 de aire— a cualquier
            `minPresenceAhead` que tenga esta celda detrás.
          */
          anadido: (
            <View>
              <Text style={estilos.parentesco}>{NOTA.parentesco.toUpperCase()}</Text>
              <View style={estilos.lineaParentesco} />
            </View>
          ),
        }

  const testigos: readonly CeldaFirma[] = [
    firmantes.testigo1.nombre === undefined && firmantes.testigo1.rubrica === undefined
      ? null
      : {
          rol: ROL.testigo1,
          nombre: firmantes.testigo1.nombre,
          credenciales: [NOTA.testigo],
          rubrica: firmantes.testigo1.rubrica,
          sello: pieDeSello(firmantes.testigo1.sello, enAnexo(ROL.testigo1), sellado !== undefined),
        },
    firmantes.testigo2.nombre === undefined && firmantes.testigo2.rubrica === undefined
      ? null
      : {
          rol: ROL.testigo2,
          nombre: firmantes.testigo2.nombre,
          credenciales: [NOTA.testigo],
          rubrica: firmantes.testigo2.rubrica,
          sello: pieDeSello(firmantes.testigo2.sello, enAnexo(ROL.testigo2), sellado !== undefined),
        },
  ]

  const hayTestigos = testigos.some((t) => t !== null)
  const hayAnexo = identificaciones.length > 0

  /**
   * LOS NIVELES SE NUMERAN POR LOS QUE HAY, NO POR LOS QUE PODRÍA HABER.
   *
   * ⚠ **LA ENTREGA CABLEABA EL 2 Y EL 3.** Cuando no hay a quién representar —porque el
   * paciente firmó por sí mismo y no hay familiar, o porque firma él en su lugar y ya
   * consta arriba— el documento imprimía `1 OTORGAMIENTO` y `3 TESTIGOS`, y un 2 que
   * falta se lee como una hoja perdida, no como un nivel que no existe.
   *
   * La representación tampoco se compone cuando el familiar firma por sustitución: ahí ya
   * tiene su celda en el nivel 1, y repetirla sería pedirle dos firmas.
   */
  const hayRepresentacion = !pacienteNoPuedeFirmar && celdaFamiliar !== null
  const numeroTestigos = hayRepresentacion ? 3 : 2
  /** La hoja de firmas existe si tiene algún nivel que componer. */
  const hayHojaFirmas = hayRepresentacion || hayTestigos

  /**
   * LOS DOS NÚMEROS DEL RECUENTO, DERIVADOS de los firmantes y no recibidos por prop.
   *
   * Se derivan a propósito: el formato tiene delante a los cinco, y un `previstos` que
   * llegara de fuera podría no coincidir con las celdas que compone — dos versiones de la
   * misma verdad en el mismo papel, sin nada que las obligue a estar de acuerdo.
   *
   * El paciente que no puede firmar NO entra: a él no se le pidió firma, firma el familiar
   * en su lugar. Es la misma pregunta que decide si su celda existe.
   */
  const convocados: readonly FirmanteConsentimiento[] = [
    firmantes.medico,
    ...(pacienteNoPuedeFirmar ? [] : [firmantes.paciente]),
    firmantes.familiar,
    firmantes.testigo1,
    firmantes.testigo2,
  ]
  const previstos = convocados.filter(pidioFirma).length
  const firmaron = convocados.filter(
    (f) => f.sello !== undefined && f.sello.trim() !== '',
  ).length

  /**
   * EL BLOQUE DE TRAZABILIDAD VA EN LA ÚLTIMA HOJA QUE EXISTA, y en la entrega vivía
   * dentro de la hoja de anexo: un consentimiento sin identificaciones —el caso normal
   * de consulta— se sellaba en la base de datos y salía impreso **sin una sola línea de
   * sellado**. Un sello que dice que el documento no se alteró no puede tener páginas
   * detrás, así que se monta en la que sea la última de las tres.
   */
  const bloqueSellado =
    sellado === undefined ? null : (
      <View style={estilos.selladoBloque}>
        <Text style={estilos.sello}>
          {`${SELLO.fecha} ${sellado.fecha} · ${recuento(previstos, firmaron)}`}
        </Text>
        <Text style={estilos.sello}>
          {`${SELLO.huella} · ${sellado.huella} · ${SELLO.verificable}`}
        </Text>
      </View>
    )

  /** Ancho de una celda del anexo. DERIVADO: (540 − 16) / 2 = 262. */
  const anchoAnexo = (CAJA.ancho - ANEXO.medianil) / ANEXO.columnas

  return (
    <Document title={TITULO}>
      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
        <MotorFlujo
          encabezado={encabezado}
          firmas={
            <View style={estilos.banda} wrap={false}>
              <Nivel numero={1} rotulo={NIVEL.otorgamiento} acento={acento} />
              {/*
                Dos celdas como máximo (brief 00 §6.2). Cuando el paciente no puede
                firmar, la segunda es el FAMILIAR y no un hueco: quien otorga es él.
              */}
              <BloqueFirmas
                variante="pareja"
                firmas={[celdaMedico, pacienteNoPuedeFirmar ? celdaFamiliar : celdaPaciente]}
              />
              {hayHojaFirmas || hayAnexo ? null : bloqueSellado}
            </View>
          }
        >
          <View style={estilos.fundamento} wrap={false}>
            <MarcoParcial padding={MARCO.leyenda} ancho={CAJA.ancho} color={acento.base}>
              <Text style={estilos.rotuloBloque}>{ROTULO_FUNDAMENTO.toUpperCase()}</Text>
              <Text style={estilos.fundamentoCuerpo}>{FUNDAMENTO}</Text>
            </MarcoParcial>
          </View>

          {/*
            ⚠ EL RÓTULO `DATOS DE IDENTIFICACIÓN` SE RETIRA. La ficha del chasis ya
            rotula cada celda y el bloque de título dice qué documento es; en v2 ese
            rótulo costaba 15 pt por hoja 1 para nombrar lo que está nombrado. Queda
            escrito aquí para que no se reponga por costumbre. Reportado.
          */}

          {vivas.map((seccion, indice) => (
            <Seccion
              key={seccion.clave}
              numero={indice + 1}
              titulo={seccion.titulo}
              entradilla={seccion.entradilla}
              texto={seccion.texto}
              presencia={indice === vivas.length - 1 ? PRESENCIA_ULTIMA_SECCION : undefined}
              acento={acento}
            />
          ))}

          {/* LA DECLARACIÓN. Sin salto declarado: comparte hoja con las secciones. */}
          <View style={estilos.fundamento}>
            <Text style={estilos.rotuloBloque}>{ROTULO_DECLARACION.toUpperCase()}</Text>
            <MarcoParcial padding={MARCO.leyenda} ancho={CAJA.ancho} color={acento.base}>
              <Text style={estilos.parrafo}>
                {'Yo, '}
                <Text style={estilos.fuerte}>{paciente.paciente}</Text>
                {`, declaro que ${medico.nombre} me ha explicado de forma clara y comprensible la naturaleza del procedimiento: `}
                <Text style={estilos.fuerte}>{procedimiento}</Text>
                {', incluyendo sus riesgos, beneficios esperados y alternativas de tratamiento.'}
              </Text>
              <Text style={estilos.parrafo}>
                He tenido la oportunidad de hacer preguntas y todas han sido respondidas a mi
                satisfacción. Comprendo que ningún procedimiento médico está libre de riesgos y
                que los resultados no pueden ser garantizados.
              </Text>
              <Text style={estilos.parrafo}>
                Por lo anterior, otorgo mi consentimiento libre, voluntario e informado para la
                realización del procedimiento descrito, así como para los procedimientos
                adicionales que pudieran ser necesarios durante el acto quirúrgico por hallazgos
                transoperatorios.
              </Text>
            </MarcoParcial>

            {/*
              La constancia y las dos autorizaciones. Las tres son frases enteras y sin
              casilla: una casilla vacía en un papel firmado no se distingue de una que
              nadie marcó. La de transfusión es tri-estado: sin dato, no se compone.
            */}
            <View style={{ marginTop: ESPACIO[10] }}>
              {pacienteNoPuedeFirmar ? (
                <Text style={estilos.casilla}>{TEXTO_SUSTITUCION}</Text>
              ) : null}
              {autorizaTransfusion === undefined ? null : (
                <Text style={estilos.casilla}>
                  {autorizaTransfusion ? TRANSFUSION.si : TRANSFUSION.no}
                </Text>
              )}
              {autorizaFotos ? <Text style={estilos.casilla}>{FOTOS}</Text> : null}
            </View>
          </View>
        </MotorFlujo>

        <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
      </Page>

      {/*
        HOJA DE REPRESENTACIÓN Y TESTIGOS — `Page` propio con su rótulo escrito aquí.
        Sólo existe si hay testigos: sin ellos, la representación cabe en la pareja de
        la hoja anterior y esta hoja no se monta.
      */}
      {hayHojaFirmas ? (
        <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
          <EncabezadoHoja
            {...encabezado}
            variante="continuacion"
            rotulo={ROTULO_TESTIGOS}
            /* `fixed`: si la hoja de testigos creciera a dos, la segunda lleva el mismo
               rótulo — que es lo correcto, porque sigue siendo la hoja de testigos. */
          />
          {hayRepresentacion ? (
            <View style={{ marginBottom: ESPACIO[16] }} wrap={false}>
              <Nivel numero={2} rotulo={NIVEL.representacion} acento={acento} />
              <BloqueFirmas variante="pareja" firmas={[celdaFamiliar, null]} />
            </View>
          ) : null}
          {hayTestigos ? (
            <View wrap={false}>
              <Nivel numero={numeroTestigos} rotulo={NIVEL.testigos} acento={acento} />
              <BloqueFirmas variante="pareja" firmas={[testigos[0], testigos[1]]} />
            </View>
          ) : null}
          {hayAnexo ? null : bloqueSellado}
          <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
        </Page>
      ) : null}

      {/*
        HOJA DE ANEXO — `Page` propio. Su rótulo ya no sale de un mapa por número de
        hoja: está escrito aquí, y por eso no puede caer sobre la hoja equivocada
        (defecto §4).
      */}
      {hayAnexo ? (
        <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
          <EncabezadoHoja {...encabezado} variante="continuacion" rotulo={ROTULO_ANEXO} />
          <Text style={estilos.anexoEntradilla}>{ENTRADILLA_ANEXO}</Text>

          <View style={estilos.anexoRejilla}>
            {identificaciones.map((identificacion, indice) => (
              <View
                key={indice}
                style={[
                  estilos.anexoCelda,
                  {
                    width: anchoAnexo,
                    marginLeft: indice % ANEXO.columnas === 0 ? 0 : ANEXO.medianil,
                  },
                ]}
                wrap={false}
              >
                {/*
                  CABECERA DE ALTURA FIJA con `overflow: hidden` (defecto §9.3): un rol
                  de dos renglones junto a uno de uno desalineaba las dos cajas de
                  fotografía de la fila, y eso se ve porque las cajas tienen borde.
                */}
                <View style={estilos.anexoCabecera}>
                  <Text style={{ ...estilos.anexoNumero, color: acento.tinta }}>
                    {String(indice + 1).padStart(2, '0')}
                  </Text>
                  <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                    <Text style={estilos.anexoRol}>{identificacion.rol.toUpperCase()}</Text>
                    <Text style={estilos.anexoNombre}>{identificacion.nombre}</Text>
                  </View>
                </View>

                {/*
                  LA CAJA NO SE REDUCE: 144 pt, y hay mínimo legal de reproducción. El
                  fondo `papelTenue` no es el único portador de significado —la caja se
                  distingue además por su borde y por el filete de acento que la abre—,
                  así que en fotocopia sigue siendo una caja (I.3.3).
                */}
                <View style={[estilos.anexoCaja, { borderTopColor: acento.base }]}>
                  {identificacion.foto === undefined ? (
                    <Text style={estilos.anexoSinFoto}>{SIN_FOTO}</Text>
                  ) : null}
                  {/*
                    ⚠ LA FOTOGRAFÍA NO SE COMPONE TODAVÍA. `identificacion.foto` llega
                    como data-URL y el recuadro está medido para recibirla con
                    `objectFit: 'contain'`, pero **la captura no está cableada** (II.7
                    §5, segunda entrega). Montar un `Image` con una cadena vacía produce
                    un PDF roto, no un hueco; con la leyenda de ausencia, el papel dice
                    la verdad. `dudas.md` §14.
                  */}
                </View>

                <View style={estilos.anexoPie}>
                  <Text style={estilos.anexoPieTexto}>{identificacion.tipo ?? ' '}</Text>
                  <Text style={estilos.anexoPieTexto}>{identificacion.numero ?? ' '}</Text>
                </View>
              </View>
            ))}
          </View>

          {bloqueSellado}

          <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
        </Page>
      ) : null}
    </Document>
  )
}
