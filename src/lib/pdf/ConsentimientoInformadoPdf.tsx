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
  imprimirDenegacion?: boolean
  folio?: string
}

export interface ConsentimientoProps {
  medico: PdfMedicoData | null
  data: ConsentimientoData
  logoUrl?: string
  consultorio?: PdfConsultorioData
}

const SECCION_LABELS: Array<{ key: string; num: string; titulo: string }> = [
  { key: 'preoperatorio', num: '1', titulo: 'Preoperatorio' },
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

interface FirmaBoxProps {
  label: string
  nombre?: string
  sublabel?: string
  idLabel?: string
  idVal?: string
  colors: PdfColors
}

function FirmaBox({ label, nombre, sublabel, idLabel, idVal, colors }: FirmaBoxProps) {
  const fb = StyleSheet.create({
    wrap: {
      width: '48%',
      marginBottom: 24,
    },
    space: {
      height: 48,
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
      <View style={fb.space} />
      <View style={fb.line}>
        <Text style={fb.label}>{label}</Text>
        {nombre ? <Text style={fb.nombre}>{nombre}</Text> : null}
        {sublabel ? <Text style={fb.sublabel}>{sublabel}</Text> : null}
        {idLabel && idVal ? (
          <Text style={fb.id}>
            {idLabel}: {idVal}
          </Text>
        ) : null}
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
        />
        <FirmaBox
          label="Médico Tratante"
          nombre={nombre}
          sublabel={medico?.especialidad}
          idLabel="Céd. Prof."
          idVal={cedProf}
          colors={colors}
        />
        <FirmaBox
          label={data?.representante ? 'Representante Legal' : 'Familiar / Responsable'}
          nombre={data?.representante ?? data?.familiar ?? ''}
          idLabel="Identificación"
          idVal={data?.idRepresentante ?? data?.idFamiliar}
          colors={colors}
        />
        <FirmaBox
          label="Anestesiólogo"
          nombre={data?.anestesiologo}
          colors={colors}
        />
        <FirmaBox
          label="Testigo 1"
          nombre={data?.testigo1}
          colors={colors}
        />
        <FirmaBox
          label="Testigo 2"
          nombre={data?.testigo2}
          colors={colors}
        />
      </View>
    )
  }

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

  const fotosLine = data.autorizaFotos
    ? 'Autorizo la toma de fotografías clínicas con fines de documentación médica y seguimiento del tratamiento.'
    : null

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <Document>
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
      </Page>

      {/* =================== PAGE 4 (optional) =================== */}
      {data.imprimirDenegacion ? (
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
                <Text style={s.denegText}>
                  Yo, <Text style={s.declBold}>{data?.paciente ?? 'Pte. no identificado'}</Text>, declaro que he sido
                  informado(a) de manera clara y completa sobre el procedimiento:{' '}
                  <Text style={s.declBold}>{data?.procedimiento ?? ''}</Text>, sus riesgos, beneficios
                  y alternativas por el/la Dr(a).{' '}
                  <Text style={s.declBold}>{nombre}</Text>.
                </Text>
                <Text style={s.denegText}>
                  No obstante, en pleno uso de mis facultades y de forma libre y voluntaria,
                  manifiesto mi decisión de NO autorizar / REVOCAR la autorización
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
