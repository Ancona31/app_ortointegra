import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ReactElement } from 'react'
import PdfHeader from './PdfHeader'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
import type { PdfMedicoData, PdfColors, PdfConsultorioData } from './PdfStyles'

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

/**
 * Una firma electrónica ya capturada, tal como se imprime.
 * `GUIA_FORMULARIOS_05` §8.2. La compone el formulario a partir de las filas
 * que acaba de escribir en `public.firmas_documento`.
 */
export interface FirmaImpresa {
  /** `paciente` · `familiar` · `testigo_1` · `testigo_2` · `medico`. */
  rol: string
  /**
   * Data-URL PNG del trazo, ya recortado a la caja de la tinta.
   * NULL en el médico: su rúbrica sale del perfil, no se captura en el momento.
   */
  trazo: string | null
  /** ISO del sello del dispositivo — el momento real del trazo. */
  firmadoEn: string
}

/**
 * Una identificación de la hoja de anexo — GUIA_FORMULARIOS_05 §6.
 *
 * Una por firmante QUE FIRMÓ, tenga foto o no: quien firmó sin ella lleva su
 * recuadro con la leyenda de que no se capturó, que es un dato del expediente y
 * no un hueco. El médico no entra: el anexo reproduce la identificación de quien
 * consiente, no la de quien informa.
 */
export interface IdentificacionImpresa {
  /** El rol, ya redactado: `Paciente`, `Testigo 1`. */
  rol: string
  nombre: string
  /**
   * Data-URL de la foto, ya traída del bucket cerrado por quien llama. Ausente
   * cuando se siguió sin foto —o cuando traerla falló, que tampoco bloquea—.
   */
  foto?: string
  /** El campo «Identificación» del formulario, si lo lleva. */
  identificacion?: string
}

export interface ConsentimientoData {
  paciente: string
  lugar: string
  fecha: string
  expediente?: string
  edad: string
  idPaciente?: string
  procedimiento: string
  diagnostico: string
  familiar: string
  idFamiliar?: string
  representante?: string
  idRepresentante?: string
  anestesiologo?: string
  testigo1?: string
  testigo2?: string
  autorizaTransfusion?: 'si' | 'no' | null
  autorizaFotos?: boolean
  secciones: {
    preoperatorio: string
    beneficios: string
    anestesia: string
    descripcion: string
    riesgosComunes: string
    riesgosEspecificos: string
    alternativas: string
  }
  /**
   * Emite SOLO la hoja de denegación, sin las tres del consentimiento.
   *
   * ⚠ PUENTE, NO SOLUCIÓN DEFINITIVA. La denegación es un formato v2
   * (`GUIA_FORM_DENEGACION.md`), pero v2 entero sigue detrás de un interruptor
   * apagado: ningún formato v2 se usa en producción y cablearlo exige meter
   * versión en la firma de `generarPdf`, que toca sus 12 call sites (ver la
   * nota larga de `buildClientElement` en `src/lib/mobileShare.ts`). Sin este
   * atajo la denegación no se podría imprimir hasta ese paso posterior.
   * Cuando v2 se cablee, la denegación entra por la misma puerta que los otros
   * ocho y esta bandera se retira con su hoja.
   *
   * Sustituyó a `imprimirDenegacion`, que ANEXABA la denegación al
   * consentimiento. Es una bandera y no dos a propósito: los dos documentos son
   * excluyentes, no acumulables. Si el paciente deniega, no se imprimen las
   * siete hojas que explican y otorgan lo que acaba de rechazar.
   */
  soloDenegacion?: boolean
  folio?: string
  /**
   * Las firmas electrónicas del documento sellado. Ausente o vacío en un
   * consentimiento que se imprime para firmarse a mano, que es como salen los
   * `emitido_firma_manual`: entonces las celdas quedan en blanco, igual que
   * antes de que existiera el firmado.
   */
  firmas?: FirmaImpresa[]
  /** ISO del acto de sellar, que es el que reúne todas las firmas. */
  selladoEn?: string
  /** SHA-256 hexadecimal del contenido en el momento de firmar. */
  huella?: string
  /**
   * Cuántos firmantes pidió el flujo. NO son cuatro fijos: solo se pide firma a
   * quien tiene nombre escrito, así que un consentimiento sin testigos prevé
   * dos. Sin este dato la línea de cierre diría «4 previstos» donde solo se
   * pidieron dos, e inventaría dos ausencias que nunca existieron.
   */
  previstos?: number
  /**
   * Las identificaciones de la hoja de anexo. **La hoja solo se imprime si al
   * menos una trae fotografía**: sin ninguna, el documento cierra en las firmas
   * y no se añade una hoja entera de recuadros vacíos.
   */
  identificaciones?: IdentificacionImpresa[]
}

/**
 * Lo que la denegación necesita, y nada más. Sin las secciones clínicas, que no
 * aparecen en el documento.
 *
 * El diagnóstico SÍ está, y no en el riel —que no lo lleva (§4)— sino dentro de
 * la declaración: una revocación puede acabar en sede legal, y ahí importa no
 * solo qué procedimiento se rechazó sino de qué se estaba tratando al paciente.
 * Es opcional porque en denegación no es campo obligatorio; ver cómo se compone
 * la frase sin él más abajo.
 */
export type DenegacionData = Pick<
  ConsentimientoData,
  'paciente' | 'lugar' | 'fecha' | 'edad' | 'procedimiento' | 'familiar' | 'folio'
> & { diagnostico?: string }

export interface DenegacionProps {
  medico: PdfMedicoData | null
  data: DenegacionData
  logoUrl?: string
  consultorio?: PdfConsultorioData
}

export interface ConsentimientoProps {
  medico: PdfMedicoData | null
  data: ConsentimientoData
  logoUrl?: string
  consultorio?: PdfConsultorioData
}

/* ------------------------------------------------------------------ */
/*  Anexo · identificación de firmantes                                */
/* ------------------------------------------------------------------ */

/**
 * ⚠ TRABAJO CON FECHA DE CADUCIDAD CONOCIDA, Y ESTÁ DECIDIDO ASÍ.
 *
 * La hoja de anexo ya existe, mejor medida y con su propio sistema tipográfico,
 * en el formato v2: `src/lib/pdf/v2/formatos/ConsentimientoInformado.tsx`
 * (`IdentificacionAnexo`, `RecuadroAnexo`, la constante `ANEXO`). Lo que sigue
 * es una RÉPLICA de su geometría en este renderer, no un diseño nuevo.
 *
 * Se replicó porque v1 es el que emite hoy: `mobileShare.ts` manda
 * `consentimiento_informado` aquí, y v2 entero sigue detrás del interruptor
 * apagado que describe la nota de `soloDenegacion` —ninguno de sus formatos se
 * usa en producción—. Sin esta hoja, la captura de fotos del Paso 5.8 subiría
 * identificaciones que no salen en ningún papel.
 *
 * **Cuando v2 se cablee, esta sección se va con el resto del archivo**, igual
 * que la hoja de denegación y por el mismo motivo. No la mejores: mejora la del
 * v2, que es la que sobrevive.
 */
const ANEXO = {
  /** La caja de fotografía, en puntos. Proporción 1,583 — la de una credencial. */
  ancho: 228,
  alto: 144,
  /** Medianil entre las dos columnas. 228 + 30 + 228 = 486 de los 512 de contenido. */
  medianil: 30,
  /** Aire entre filas de la retícula. */
  aireFilas: 20,
} as const

const ANEXO_ROTULO = 'Anexo · Identificación de firmantes'
const ANEXO_ENTRADILLA =
  'Reproducción de la identificación oficial del paciente y de las personas que firman el consentimiento.'
/** La leyenda de quien firmó y no anexó identificación. Textual del v2. */
const ANEXO_SIN_FOTO =
  'No se capturó fotografía de la identificación de este firmante.'

/** Parte las identificaciones en filas de dos, que es la retícula. */
function enParejas(items: IdentificacionImpresa[]): IdentificacionImpresa[][] {
  const filas: IdentificacionImpresa[][] = []
  items.forEach((item, i) => {
    if (i % 2 === 0) filas.push([item])
    else filas[filas.length - 1].push(item)
  })
  return filas
}

const SECCION_LABELS: Array<{ key: string; num: string; titulo: string }> = [
  // ⚠ `key` es la clave del jsonb guardado y NO se renombra: de ella sale el
  // texto de los documentos ya emitidos (`data.secciones[sec.key]`). Cambiarla
  // imprimiría la sección 1 en blanco al regenerar un consentimiento viejo.
  // El rótulo dejó de decir «Preoperatorio» porque presuponía quirófano, y el
  // consentimiento cubre también procedimientos invasivos que no son cirugía.
  { key: 'preoperatorio', num: '1', titulo: 'Evaluación y decisión terapéutica' },
  { key: 'beneficios', num: '2', titulo: 'Beneficios esperados' },
  { key: 'anestesia', num: '3', titulo: 'Anestesia' },
  { key: 'descripcion', num: '4', titulo: 'Descripción del procedimiento' },
  { key: 'riesgosComunes', num: '5', titulo: 'Riesgos comunes' },
  { key: 'riesgosEspecificos', num: '6', titulo: 'Riesgos específicos' },
  { key: 'alternativas', num: '7', titulo: 'Alternativas de tratamiento' },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function nl2p(text: string, style: Style): ReactElement[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => (
      <Text key={i} style={style}>
        {l}
      </Text>
    ))
}

/**
 * `dd/mm/aaaa hh:mm:ss` — el formato de los sellos impresos (§8.2).
 * Local a este archivo y sin date-fns: los renderers de PDF no importan nada
 * del árbol de la aplicación más allá de sus propios estilos.
 */
function selloLegible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
    + ` ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

interface FirmaBoxProps {
  label: string
  nombre?: string
  sublabel?: string
  idLabel?: string
  idVal?: string
  colors: PdfColors
  /**
   * La rúbrica, en los 48 pt libres sobre la línea. `objectFit: contain` y no
   * un ancho fijo: el trazo llega ya recortado a su tinta, así que ocupa lo que
   * ocupa —como en papel— y solo se le impide desbordar la celda.
   */
  trazo?: string | null
  /** El pie de sello, bajo la calidad del firmante y a 2 pt de ella. */
  sello?: string
}

function FirmaBox({ label, nombre, sublabel, idLabel, idVal, colors, trazo, sello }: FirmaBoxProps) {
  const fb = StyleSheet.create({
    wrap: {
      width: '48%',
      marginBottom: 24,
    },
    space: {
      height: 48,
      justifyContent: 'flex-end',
    },
    trazo: {
      width: '100%',
      height: 48,
      objectFit: 'contain',
    },
    sello: {
      fontSize: 7,
      color: '#666',
      marginTop: 2,
    },
    line: {
      borderTopWidth: 1,
      borderTopColor: colors.cp,
      paddingTop: 6,
      alignItems: 'center',
    },
    label: {
      fontSize: 8,
      fontWeight: 700,
      color: colors.cp,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    nombre: {
      fontSize: 9,
      color: '#1a1a1a',
      marginTop: 2,
    },
    sublabel: {
      fontSize: 7.5,
      color: '#666',
      marginTop: 1,
    },
    id: {
      fontSize: 7,
      color: '#999',
      marginTop: 1,
    },
  })

  return (
    <View style={fb.wrap}>
      <View style={fb.space}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de
            @react-pdf/renderer no acepta alt: no es una imagen del DOM. */}
        {trazo ? <Image style={fb.trazo} src={trazo} /> : null}
      </View>
      <View style={fb.line}>
        <Text style={fb.label}>{label}</Text>
        {nombre ? <Text style={fb.nombre}>{nombre}</Text> : null}
        {sublabel ? <Text style={fb.sublabel}>{sublabel}</Text> : null}
        {idLabel && idVal ? (
          <Text style={fb.id}>
            {idLabel}: {idVal}
          </Text>
        ) : null}
        {sello ? <Text style={fb.sello}>{sello}</Text> : null}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Compact header (pages 2+)                                          */
/* ------------------------------------------------------------------ */

interface CompactHeaderProps {
  medico: PdfMedicoData | null
  colors: PdfColors
  logoUrl?: string
  paciente: string
  procedimiento: string
}

function CompactHeader({ medico, colors, logoUrl, paciente, procedimiento }: CompactHeaderProps) {
  const nombre = componerNombreMedicoCompleto({
    titulo: medico?.titulo,
    nombres: medico?.nombres,
    apellido_paterno: medico?.apellido_paterno,
    apellido_materno: medico?.apellido_materno,
  }) || 'Médico'
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''

  const ch = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logoSmall: {
      width: 40,
      height: 20,
      objectFit: 'contain',
    },
    docName: {
      fontSize: 9,
      fontWeight: 700,
      color: colors.cp,
    },
    docCreds: {
      fontSize: 7,
      color: '#888',
    },
    right: {
      alignItems: 'flex-end',
    },
    paciente: {
      fontSize: 8,
      fontWeight: 500,
      color: '#1a1a1a',
    },
    proc: {
      fontSize: 7,
      color: '#666',
    },
    sep: {
      height: 1.5,
      backgroundColor: colors.cp,
      marginBottom: 10,
    },
  })

  const creds = [cedProf ? `Céd. Prof. ${cedProf}` : '', cedEsp ? `Céd. Esp. ${cedEsp}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <View>
      <View style={ch.row}>
        <View style={ch.left}>
          {logoUrl ? <Image style={ch.logoSmall} src={logoUrl} /> : null}
          <View>
            <Text style={ch.docName}>{nombre}</Text>
            {creds ? <Text style={ch.docCreds}>{creds}</Text> : null}
          </View>
        </View>
        <View style={ch.right}>
          <Text style={ch.paciente}>{paciente}</Text>
          <Text style={ch.proc}>{procedimiento}</Text>
        </View>
      </View>
      <View style={ch.sep} />
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Componente principal                                               */
/* ------------------------------------------------------------------ */

export function renderConsentimiento(props: ConsentimientoProps) {
  return <ConsentimientoInformadoPdf {...props} />
}

/** Las siete secciones que la denegación no lleva. Ver `soloDenegacion`. */
const SIN_SECCIONES: ConsentimientoData['secciones'] = {
  preoperatorio: '', beneficios: '', anestesia: '', descripcion: '',
  riesgosComunes: '', riesgosEspecificos: '', alternativas: '',
}

/**
 * La denegación como documento de una hoja. Ver la nota de `soloDenegacion`:
 * es el puente hasta que se cablee v2.
 */
export function renderDenegacion(props: DenegacionProps) {
  return (
    <ConsentimientoInformadoPdf
      medico={props.medico}
      logoUrl={props.logoUrl}
      consultorio={props.consultorio}
      data={{
        ...props.data,
        diagnostico: props.data.diagnostico ?? '',
        secciones: SIN_SECCIONES,
        soloDenegacion: true,
      }}
    />
  )
}

export default function ConsentimientoInformadoPdf({
  medico,
  data,
  logoUrl,
  consultorio,
}: ConsentimientoProps) {
  const colors = getPdfColors(medico)
  const nombre = componerNombreMedicoCompleto({
    titulo: medico?.titulo,
    nombres: medico?.nombres,
    apellido_paterno: medico?.apellido_paterno,
    apellido_materno: medico?.apellido_materno,
  }) || 'Médico'
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''

  const seccionesP1 = SECCION_LABELS.slice(0, 4)
  const seccionesP2 = SECCION_LABELS.slice(4)

  const s = StyleSheet.create({
    page: {
      fontFamily: 'Roboto',
      fontSize: 10,
      color: '#1a1a1a',
      paddingTop: 100,
      paddingBottom: 54,
      paddingHorizontal: 50,
    },
    headerFixed: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    headerInner: {
      paddingHorizontal: 50,
      paddingTop: 8,
    },
    footerFixed: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    /* Title banner */
    tituloWrap: {
      backgroundColor: colors.cp + '0D',
      borderRadius: 4,
      paddingVertical: 10,
      marginTop: 16,
      marginBottom: 6,
    },
    tituloText: {
      textAlign: 'center',
      fontSize: 14,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: colors.cp,
      letterSpacing: 1.2,
    },
    subtituloText: {
      textAlign: 'center',
      fontSize: 10,
      color: colors.cs,
      marginTop: 3,
    },
    /* NOM intro box */
    nomBox: {
      backgroundColor: colors.cs + '08',
      borderLeftWidth: 3,
      borderLeftColor: colors.cs,
      borderRadius: 3,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginTop: 10,
      marginBottom: 14,
    },
    nomText: {
      fontSize: 8,
      color: '#444',
      lineHeight: 1.6,
      textAlign: 'justify',
    },
    /* Datos de identificacion */
    datosBox: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 4,
      marginBottom: 14,
      overflow: 'hidden',
    },
    datosHeader: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: colors.cp,
    },
    datosHeaderText: {
      fontSize: 9,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    datosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 4,
    },
    datosCell: {
      width: '33.33%',
      marginBottom: 8,
      paddingRight: 8,
    },
    datosCellHalf: {
      width: '50%',
      marginBottom: 8,
      paddingRight: 8,
    },
    datosCellFull: {
      width: '100%',
      marginBottom: 8,
      paddingRight: 8,
    },
    /* Section header */
    secHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 3,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginTop: 14,
      marginBottom: 6,
      backgroundColor: colors.cp,
    },
    secBadge: {
      backgroundColor: '#ffffff',
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    secBadgeNum: {
      fontSize: 9,
      fontWeight: 700,
      color: colors.cp,
    },
    secTitle: {
      fontSize: 10,
      fontWeight: 700,
      color: contrastText(colors.cp),
      letterSpacing: 0.3,
    },
    secBody: {
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    secParagraph: {
      fontSize: 9.5,
      color: '#1a1a1a',
      textAlign: 'justify',
      lineHeight: 1.6,
      marginBottom: 4,
    },
    /* Continuacion label */
    contLabel: {
      fontSize: 8,
      color: '#999',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    /* Declaracion box */
    declBox: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 16,
    },
    declHeader: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.cp,
    },
    declHeaderText: {
      fontSize: 10,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    declBody: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    declText: {
      fontSize: 9,
      color: '#1a1a1a',
      textAlign: 'justify',
      lineHeight: 1.7,
      marginBottom: 6,
    },
    declBold: {
      fontWeight: 700,
    },
    authLine: {
      fontSize: 9,
      color: '#1a1a1a',
      marginTop: 6,
      lineHeight: 1.5,
    },
    /* Firmas grid */
    firmasGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    /* Cierre de la hoja firmada (§8.2), sobre filete gris */
    cierreBox: {
      borderTopWidth: 1,
      borderTopColor: '#d1d5db',
      paddingTop: 5,
    },
    cierreText: {
      fontSize: 7,
      color: '#666',
      lineHeight: 1.5,
    },
    /* Denegacion */
    denegBox: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 16,
    },
    denegHeader: {
      backgroundColor: '#991b1b',
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    denegHeaderText: {
      fontSize: 10,
      fontWeight: 700,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    denegBody: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    denegText: {
      fontSize: 9,
      color: '#1a1a1a',
      textAlign: 'justify',
      lineHeight: 1.7,
      marginBottom: 6,
    },
    /* Anexo · identificación de firmantes. Réplica del v2: ver la nota de ANEXO. */
    anexoEntradilla: {
      fontSize: 8,
      color: '#666',
      lineHeight: 1.5,
      marginBottom: 4,
    },
    anexoFila: {
      flexDirection: 'row',
      marginTop: ANEXO.aireFilas,
    },
    anexoCelda: { width: ANEXO.ancho },
    anexoCeldaSiguiente: { marginLeft: ANEXO.medianil },
    anexoNumero: {
      fontSize: 8,
      fontWeight: 700,
      color: colors.cs,
      marginRight: 6,
    },
    anexoRol: {
      fontSize: 8,
      fontWeight: 700,
      color: colors.cp,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    anexoNombre: {
      fontSize: 9,
      color: '#1a1a1a',
      marginTop: 1,
    },
    /* El filete de acento que abre la caja. Es su borde superior: dibujar los
       dos daría una línea doble donde el v2 tiene una. */
    anexoFilete: {
      height: 2,
      backgroundColor: colors.cp,
      marginTop: 5,
    },
    anexoCaja: {
      height: ANEXO.alto,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#d1d5db',
      alignItems: 'center',
      justifyContent: 'center',
    },
    anexoConFoto: { backgroundColor: '#f8fafc' },
    anexoSinFoto: { paddingHorizontal: 24 },
    /* La foto no se estira: conserva su proporción dentro de la caja —el
       recortador ya la entrega en la proporción exacta, así que la llena—.

       ⚠ LAS ESQUINAS REDONDEADAS VAN AQUÍ, EN LA COMPOSICIÓN, Y NO EN LA
       IMAGEN. La foto se guarda en JPEG, que no tiene transparencia: redondear
       el archivo obligaría a PNG, y medido sobre contenido fotográfico a
       1400 px el PNG pesa de 23 a 43 veces más (5,8–6,7 MB contra 135–287 KB) —
       con alfa llega a 7,5 MB, que ni siquiera entra en el tope de 5 MB del
       bucket—. El render de @react-pdf recorta la propia Image por su
       borderRadius, así que el redondeo cuesta cero bytes. Detrás asoma el
       fondo de la caja, como una credencial real sobre su lámina. El recortador
       enseña el mismo radio en pantalla (`MARCO_ESTILO`). */
    anexoFoto: { width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 },
    anexoLeyenda: {
      fontSize: 7.5,
      color: '#999',
      textAlign: 'center',
      lineHeight: 1.5,
    },
    anexoPie: {
      fontSize: 7.5,
      color: '#666',
      marginTop: 4,
    },
  })

  /* ---------- Render section block ---------- */
  function SeccionBlock({ sec }: { sec: (typeof SECCION_LABELS)[number] }) {
    const text = data?.secciones?.[sec.key as keyof typeof data.secciones] ?? ''
    return (
      <View wrap={false}>
        <View style={s.secHeader}>
          <View style={s.secBadge}>
            <Text style={s.secBadgeNum}>{sec.num}</Text>
          </View>
          <Text style={s.secTitle}>{sec.titulo}</Text>
        </View>
        <View style={s.secBody}>{nl2p(text, s.secParagraph)}</View>
      </View>
    )
  }

  /* ---------- Firmas electrónicas, si el documento está sellado ---------- */
  // Índice por rol. Vacío en un documento que se imprime para firmarse a mano,
  // y entonces todo lo de abajo se resuelve a null: la lámina sale como antes.
  const porRol = new Map((data.firmas ?? []).map(f => [f.rol, f]))
  const sellado = data.selladoEn !== undefined && porRol.size > 0

  function pieDe(rol: string): string | undefined {
    const f = porRol.get(rol)
    if (!f) return undefined
    const cuando = selloLegible(f.firmadoEn)
    return cuando === '' ? undefined : `Firmado ${cuando}`
  }

  /* ---------- Signatures grid ---------- */
  function FirmasBlock() {
    return (
      <View style={s.firmasGrid}>
        <FirmaBox
          label="Paciente"
          nombre={data?.paciente ?? ''}
          idLabel="Identificación"
          idVal={data?.idPaciente}
          colors={colors}
          trazo={porRol.get('paciente')?.trazo}
          sello={pieDe('paciente')}
        />
        <FirmaBox
          label="Médico Tratante"
          nombre={nombre}
          sublabel={medico?.especialidad}
          idLabel="Céd. Prof."
          idVal={cedProf}
          colors={colors}
          // El médico no firma en el flujo: su rúbrica sale del perfil, y solo
          // se estampa cuando el documento se selló —en uno impreso para
          // firmarse a mano, la celda se queda para la pluma—.
          trazo={sellado ? medico?.firma_url ?? null : null}
          sello={pieDe('medico')}
        />
        <FirmaBox
          label={data?.representante ? 'Representante Legal' : 'Familiar / Responsable'}
          nombre={data?.representante ?? data?.familiar ?? ''}
          idLabel="Identificación"
          idVal={data?.idRepresentante ?? data?.idFamiliar}
          colors={colors}
          trazo={porRol.get('familiar')?.trazo}
          sello={pieDe('familiar')}
        />
        {/* El anestesiólogo no entra en el flujo de firmado: su celda se queda
            siempre para la pluma. */}
        <FirmaBox
          label="Anestesiólogo"
          nombre={data?.anestesiologo}
          colors={colors}
        />
        <FirmaBox
          label="Testigo 1"
          nombre={data?.testigo1}
          colors={colors}
          trazo={porRol.get('testigo_1')?.trazo}
          sello={pieDe('testigo_1')}
        />
        <FirmaBox
          label="Testigo 2"
          nombre={data?.testigo2}
          colors={colors}
          trazo={porRol.get('testigo_2')?.trazo}
          sello={pieDe('testigo_2')}
        />
      </View>
    )
  }

  /* ---------- Anexo · identificación de firmantes (§6) ---------- */
  // La hoja SOLO existe si al menos una identificación trae fotografía: sin
  // ninguna, el documento cierra en las firmas y no se añade una hoja entera de
  // recuadros vacíos. Réplica de la decisión de producto 5 del formato v2.
  const identificaciones = data.identificaciones ?? []
  const hayAnexo = identificaciones.some(i => (i.foto ?? '') !== '')

  /**
   * Un recuadro. Con foto o sin ella, el rol y el nombre se imprimen igual.
   *
   * Una función que devuelve un ELEMENTO, no un componente declarado dentro del
   * render: los dos que sí lo son en este archivo —`SeccionBlock` y
   * `FirmasBlock`— ya arrastran el aviso del linter, y no se le suma un tercero.
   */
  function recuadroAnexo(id: IdentificacionImpresa, numero: number): ReactElement {
    const foto = id.foto ?? ''
    return (
      <View wrap={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={s.anexoNumero}>{String(numero).padStart(2, '0')}</Text>
          <View>
            <Text style={s.anexoRol}>{id.rol.toUpperCase()}</Text>
            <Text style={s.anexoNombre}>{id.nombre}</Text>
          </View>
        </View>
        <View style={s.anexoFilete} />
        <View style={[s.anexoCaja, foto ? s.anexoConFoto : s.anexoSinFoto]}>
          {foto ? (
            /* eslint-disable-next-line jsx-a11y/alt-text -- el <Image> de
               @react-pdf/renderer no acepta alt: no es una imagen del DOM. */
            <Image style={s.anexoFoto} src={foto} />
          ) : (
            <Text style={s.anexoLeyenda}>{ANEXO_SIN_FOTO}</Text>
          )}
        </View>
        {id.identificacion ? (
          <Text style={s.anexoPie}>{id.identificacion}</Text>
        ) : null}
      </View>
    )
  }

  /* ---------- Cierre de la hoja firmada (§8.2) ---------- */
  // Los del flujo; el médico no se cuenta ahí porque no se le pregunta: su
  // rúbrica se estampa siempre.
  const DEL_FLUJO = ['paciente', 'familiar', 'testigo_1', 'testigo_2']
  const firmaron = DEL_FLUJO.filter(r => porRol.has(r)).length
  // Sin el dato, el suelo honesto es «tantos previstos como firmaron»: nunca
  // inventa una ausencia.
  const previstos = data.previstos ?? firmaron

  // Un elemento y NO un componente declarado dentro del render: los dos de este
  // archivo que sí lo son ya arrastran ese aviso del linter y no se le suma un
  // tercero.
  const huellaCompleta = data.huella ?? ''
  const cierreSellado = !sellado ? null : (
    <View style={s.cierreBox}>
      {/* El singular importa: el mínimo real es UN firmante —un consentimiento
          que firma solo el paciente, sin familiar ni testigos, es válido— y
          «1 firmantes previstos» en un documento legal se lee como un descuido. */}
      <Text style={s.cierreText}>
        Documento sellado el {selloLegible(data.selladoEn ?? '')} · {previstos}{' '}
        {previstos === 1 ? 'firmante previsto' : 'firmantes previstos'}, {firmaron}{' '}
        {firmaron === 1 ? 'firmó' : 'firmaron'}, {previstos - firmaron}{' '}
        {previstos - firmaron === 1 ? 'no firmó' : 'no firmaron'}
      </Text>
      {huellaCompleta ? (
        <Text style={s.cierreText}>
          {/* Abreviada como en la lámina: los cuatro primeros y los cuatro últimos. */}
          Huella SHA-256 · {huellaCompleta.length > 8
            ? `${huellaCompleta.slice(0, 4)}…${huellaCompleta.slice(-4)}`
            : huellaCompleta} · verificable en el expediente electrónico
        </Text>
      ) : null}
    </View>
  )

  /* ---------- Cédulas string ---------- */
  const credsStr = [
    cedProf ? `Céd. Prof. ${cedProf}` : '',
    cedEsp ? `Céd. Esp. ${cedEsp}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  /* ---------- Transfusion / Fotos lines ---------- */
  const transfusionLine =
    data.autorizaTransfusion != null
      ? data.autorizaTransfusion === 'si'
        ? 'Autorizo la transfusión de sangre o hemoderivados si el médico lo considera necesario durante el procedimiento.'
        : 'NO autorizo la transfusión de sangre o hemoderivados, asumiendo los riesgos que esto implica.'
      : null

  /* ---------- Diagnóstico de la declaración de denegación ---------- */
  // No es obligatorio en denegación —exigirlo bloquearía un rechazo por no
  // haber redactado antes lo que el paciente acaba de rechazar—, así que la
  // frase se compone SIN el inciso cuando falta, y no con un hueco ni un guion.
  const dxDenegacion = data.diagnostico?.trim() ?? ''

  const fotosLine = data.autorizaFotos
    ? 'Autorizo la toma de fotografías clínicas con fines de documentación médica y seguimiento del tratamiento.'
    : null

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <Document>
      {/* Las tres hojas del consentimiento NO se emiten cuando el documento es
          la denegación: es un documento que SUSTITUYE, no que se anexa. */}
      {!data.soloDenegacion && (<>
      {/* =================== PAGE 1 =================== */}
      <Page size="LETTER" style={s.page}>
        {/* Header fixed */}
        <View fixed style={s.headerFixed}>
          <BarraTop colors={colors} />
          <View style={s.headerInner}>
            <PdfHeader
              medico={medico}
              colors={colors}
              logoUrl={logoUrl}
              folio={data.folio}
              fecha={data.fecha}
              compact
              consultorio={consultorio}
            />
          </View>
        </View>

        {/* Footer fixed */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

          {/* Title */}
          <View style={s.tituloWrap}>
            <Text style={s.tituloText}>Consentimiento Médico Informado</Text>
            <Text style={s.subtituloText}>{data?.procedimiento ?? ''}</Text>
          </View>

          {/* NOM intro */}
          <View style={s.nomBox}>
            <Text style={s.nomText}>
              De conformidad con lo dispuesto en la Norma Oficial Mexicana NOM-004-SSA3-2012 del
              Expediente Clínico, la Ley General de Salud (Art. 80 y 81), y el Reglamento de la
              Ley General de Salud en Materia de Prestación de Servicios de Atención
              Médica (Art. 80), el presente documento tiene como finalidad informar al paciente
              o su representante legal sobre el procedimiento propuesto, sus riesgos, beneficios y
              alternativas, a fin de obtener su consentimiento libre, voluntario e informado.
            </Text>
          </View>

          {/* Datos de identificacion */}
          <View style={s.datosBox}>
            <View style={s.datosHeader}>
              <Text style={s.datosHeaderText}>Datos de Identificación</Text>
            </View>
            <View style={s.datosGrid}>
              <View style={s.datosCell}>
                <Text style={baseStyles.datoLabel}>LUGAR</Text>
                <Text style={baseStyles.datoValor}>{data?.lugar ?? ''}</Text>
              </View>
              <View style={s.datosCell}>
                <Text style={baseStyles.datoLabel}>FECHA</Text>
                <Text style={baseStyles.datoValor}>{data?.fecha ?? ''}</Text>
              </View>
              <View style={s.datosCell}>
                <Text style={baseStyles.datoLabel}>NO. EXPEDIENTE</Text>
                <Text style={baseStyles.datoValor}>{data?.expediente ?? '—'}</Text>
              </View>
              <View style={s.datosCell}>
                <Text style={baseStyles.datoLabel}>PACIENTE</Text>
                <Text style={baseStyles.datoValor}>{data?.paciente ?? 'Pte. no identificado'}</Text>
              </View>
              <View style={s.datosCell}>
                <Text style={baseStyles.datoLabel}>EDAD</Text>
                <Text style={baseStyles.datoValor}>{data?.edad ?? '—'}</Text>
              </View>
              <View style={s.datosCell}>
                <Text style={baseStyles.datoLabel}>IDENTIFICACIÓN PACIENTE</Text>
                <Text style={baseStyles.datoValor}>{data?.idPaciente ?? '—'}</Text>
              </View>
              <View style={s.datosCellHalf}>
                <Text style={baseStyles.datoLabel}>FAMILIAR / RESPONSABLE</Text>
                <Text style={baseStyles.datoValor}>{data?.familiar ?? ''}</Text>
              </View>
              <View style={s.datosCellHalf}>
                <Text style={baseStyles.datoLabel}>IDENTIFICACIÓN FAMILIAR</Text>
                <Text style={baseStyles.datoValor}>{data?.idFamiliar ?? '—'}</Text>
              </View>
              {data?.representante ? (
                <>
                  <View style={s.datosCellHalf}>
                    <Text style={baseStyles.datoLabel}>REPRESENTANTE LEGAL</Text>
                    <Text style={baseStyles.datoValor}>{data.representante}</Text>
                  </View>
                  <View style={s.datosCellHalf}>
                    <Text style={baseStyles.datoLabel}>IDENTIFICACIÓN REPRESENTANTE</Text>
                    <Text style={baseStyles.datoValor}>{data?.idRepresentante ?? '—'}</Text>
                  </View>
                </>
              ) : null}
              <View style={s.datosCellFull}>
                <Text style={baseStyles.datoLabel}>DIAGNÓSTICO</Text>
                <Text style={baseStyles.datoValor}>{data?.diagnostico ?? ''}</Text>
              </View>
            </View>
          </View>

          {/* Sections 1-4 */}
          {seccionesP1.map((sec) => (
            <SeccionBlock key={sec.key} sec={sec} />
          ))}
      </Page>

      {/* =================== PAGE 2 =================== */}
      <Page size="LETTER" style={s.page}>
        <View fixed style={s.headerFixed}>
          <BarraTop colors={colors} />
          <View style={s.headerInner}>
            <PdfHeader
              medico={medico}
              colors={colors}
              logoUrl={logoUrl}
              folio={data.folio}
              fecha={data.fecha}
              compact
              consultorio={consultorio}
            />
          </View>
        </View>
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

          <Text style={s.contLabel}>Continuación — Consentimiento Médico Informado</Text>

          {/* Sections 5-7 */}
          {seccionesP2.map((sec) => (
            <SeccionBlock key={sec.key} sec={sec} />
          ))}
      </Page>

      {/* =================== PAGE 3 =================== */}
      <Page size="LETTER" style={s.page}>
        <View fixed style={s.headerFixed}>
          <BarraTop colors={colors} />
          <View style={s.headerInner}>
            <PdfHeader
              medico={medico}
              colors={colors}
              logoUrl={logoUrl}
              folio={data.folio}
              fecha={data.fecha}
              compact
              consultorio={consultorio}
            />
          </View>
        </View>
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

        <View style={{ flex: 1 }}>
          {/* Declaracion de Consentimiento */}
          <View style={s.declBox}>
            <View style={s.declHeader}>
              <Text style={s.declHeaderText}>Declaración de Consentimiento</Text>
            </View>
            <View style={s.declBody}>
              <Text style={s.declText}>
                Yo, <Text style={s.declBold}>{data?.paciente ?? 'Pte. no identificado'}</Text>, declaro que el/la Dr(a).{' '}
                <Text style={s.declBold}>{nombre}</Text>
                {credsStr ? ` (${credsStr})` : ''} me ha explicado de forma clara y comprensible
                la naturaleza del procedimiento:{' '}
                <Text style={s.declBold}>{data?.procedimiento ?? ''}</Text>, incluyendo sus riesgos,
                beneficios esperados y alternativas de tratamiento.
              </Text>
              <Text style={s.declText}>
                He tenido la oportunidad de hacer preguntas y todas han sido respondidas a mi
                satisfacción. Comprendo que ningún procedimiento médico está
                libre de riesgos y que los resultados no pueden ser garantizados.
              </Text>
              <Text style={s.declText}>
                Por lo anterior, otorgo mi consentimiento libre, voluntario e informado para la
                realización del procedimiento descrito, así como para los procedimientos
                adicionales que pudieran ser necesarios durante el acto quirúrgico por
                hallazgos transoperatorios.
              </Text>
              {transfusionLine ? <Text style={s.authLine}>{transfusionLine}</Text> : null}
              {fotosLine ? <Text style={s.authLine}>{fotosLine}</Text> : null}
            </View>
          </View>

        </View>

          {/* Firmas */}
          <FirmasBlock />
          {cierreSellado}
      </Page>

      {/* ============ ANEXO — hoja condicional (§6) ============
          Solo si al menos una identificación trae fotografía. Un consentimiento
          en el que nadie anexó identificación cierra en las firmas. */}
      {hayAnexo ? (
        <Page size="LETTER" style={s.page}>
          <View fixed style={s.headerFixed}>
            <BarraTop colors={colors} />
            <View style={s.headerInner}>
              <PdfHeader
                medico={medico}
                colors={colors}
                logoUrl={logoUrl}
                folio={data.folio}
                fecha={data.fecha}
                compact
                consultorio={consultorio}
              />
            </View>
          </View>
          <View fixed style={s.footerFixed}>
            <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
          </View>

          <PdfWatermark logoUrl={logoUrl} />

            <Text style={s.contLabel}>{ANEXO_ROTULO}</Text>
            <Text style={s.anexoEntradilla}>{ANEXO_ENTRADILLA}</Text>

            {enParejas(identificaciones).map((fila, indiceFila) => (
              <View key={fila[0].rol} style={s.anexoFila}>
                {fila.map((id, columna) => (
                  <View key={id.rol}
                    style={columna === 0 ? s.anexoCelda : [s.anexoCelda, s.anexoCeldaSiguiente]}>
                    {recuadroAnexo(id, indiceFila * 2 + columna + 1)}
                  </View>
                ))}
              </View>
            ))}
        </Page>
      ) : null}
      </>)}

      {/* ============ DENEGACIÓN — hoja única y excluyente ============ */}
      {data.soloDenegacion ? (
        <Page size="LETTER" style={s.page}>
          <View fixed style={s.headerFixed}>
            <BarraTop colors={colors} />
            <View style={s.headerInner}>
              <PdfHeader
                medico={medico}
                colors={colors}
                logoUrl={logoUrl}
                folio={data.folio}
                fecha={data.fecha}
                compact
                consultorio={consultorio}
              />
            </View>
          </View>
          <View fixed style={s.footerFixed}>
            <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
          </View>

          <PdfWatermark logoUrl={logoUrl} />

          <View style={{ flex: 1 }}>
            {/* Denegacion */}
            <View style={s.denegBox}>
              <View style={s.denegHeader}>
                <Text style={s.denegHeaderText}>
                  Denegación o Revocación del Consentimiento
                </Text>
              </View>
              <View style={s.denegBody}>
                {/* La cadena literal de GUIA_FORM_DENEGACION §5, con el inciso
                    del diagnóstico. Los cuatro datos destacados llevan el mismo
                    tratamiento —`declBold`—: el diagnóstico con otro peso se
                    leería como un dato de otra clase dentro de la misma frase. */}
                <Text style={s.denegText}>
                  Yo, <Text style={s.declBold}>{data?.paciente ?? 'Pte. no identificado'}</Text>
                  {dxDenegacion !== '' ? (
                    <>, con diagnóstico de <Text style={s.declBold}>{dxDenegacion}</Text></>
                  ) : null}
                  , declaro que he sido informado de manera clara y completa sobre el
                  procedimiento <Text style={s.declBold}>{data?.procedimiento ?? ''}</Text>,
                  sus riesgos, beneficios y alternativas, por el{' '}
                  <Text style={s.declBold}>{nombre}</Text>.
                </Text>
                {/* Sin versalitas ni barra: las versalitas dentro del texto
                    corrido no existen en el sistema y la barra no es un recurso
                    declarado. El énfasis lo lleva el título del documento. */}
                <Text style={s.denegText}>
                  No obstante, en pleno uso de mis facultades y de forma libre y voluntaria,
                  manifiesto mi decisión de no autorizar o revocar la autorización
                  previamente otorgada para la realización del procedimiento descrito,
                  asumiendo las consecuencias que de ello puedan derivarse, las cuales me han
                  sido explicadas.
                </Text>
                <Text style={s.denegText}>
                  Se me ha informado que puedo cambiar de opinión y otorgar mi
                  consentimiento en cualquier momento.
                </Text>
              </View>
            </View>

          </View>

            {/* Firmas */}
            <FirmasBlock />
        </Page>
      ) : null}
    </Document>
  )
}
