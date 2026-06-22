import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
import type { PdfMedicoData, PdfColors, PdfConsultorioData } from './PdfStyles'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'

export interface SolicitudInternamientoData {
  paciente: string
  fecha: string
  fechaIngreso?: string
  lugar?: string
  diagnostico: string
  diagnosticosSecundarios?: string[]
  tipoInternamiento?: string
  procedimiento?: string
  diasEstimados?: string
  asa?: string
  urgente?: boolean
  requerimientos?: string[]
  justificacion?: string
  instruccionesPaciente?: string
  indicacionesPiso?: string
  folio?: string
}

export interface SolicitudInternamientoProps {
  medico: PdfMedicoData | null
  data: SolicitudInternamientoData
  logoUrl?: string
  consultorio?: PdfConsultorioData
}

export function renderSolicitudInternamiento(props: SolicitudInternamientoProps) {
  return <SolicitudInternamientoPdf {...props} />
}

function buildStyles(colors: PdfColors) {
  return StyleSheet.create({
    page: {
      fontFamily: 'Roboto',
      fontSize: 10,
      color: '#1a1a1a',
      paddingTop: 100,
      paddingBottom: 42,
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
    tituloDoc: {
      marginTop: 4,
      marginBottom: 6,
      paddingVertical: 6,
      borderRadius: 4,
      alignItems: 'center',
      backgroundColor: colors.cp,
    },
    tituloText: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: contrastText(colors.cp),
      letterSpacing: 1.5,
      textAlign: 'center',
    },
    urgenteBadge: {
      backgroundColor: '#dc2626',
      paddingHorizontal: 14,
      paddingVertical: 3,
      borderRadius: 3,
      alignSelf: 'center',
      marginBottom: 4,
    },
    urgenteBadgeText: {
      fontSize: 10,
      fontWeight: 700,
      color: '#ffffff',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    datoRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 1,
    },
    datoField: {
      flex: 1,
      marginBottom: 3,
      borderWidth: 0.75,
      borderColor: '#e5e7eb',
      borderRadius: 3,
      paddingHorizontal: 8,
      paddingTop: 2,
      paddingBottom: 3,
    },
    lugarValor: {
      fontSize: 10.5,
      fontWeight: 700,
      color: colors.cp,
      lineHeight: 1.3,
    },
    seccion: {
      paddingVertical: 4,
      paddingLeft: 10,
      borderLeftWidth: 3,
      borderLeftColor: colors.cp,
      backgroundColor: colors.cp + '0A',
      borderRadius: 3,
      marginTop: 6,
      marginBottom: 3,
    },
    seccionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: colors.cp,
    },
    diagPrincipal: {
      fontSize: 10.5,
      fontWeight: 700,
      color: '#1a1a1a',
      marginBottom: 2,
      paddingLeft: 6,
      lineHeight: 1.3,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 1,
      paddingLeft: 6,
    },
    bulletDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.cs,
      marginTop: 4,
    },
    bulletText: {
      fontSize: 10,
      color: '#333',
      flex: 1,
      lineHeight: 1.3,
    },
    justifiedText: {
      fontSize: 10,
      color: '#333',
      lineHeight: 1.4,
      textAlign: 'justify',
      paddingLeft: 6,
      marginTop: 2,
    },
    badgesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 2,
      paddingLeft: 6,
    },
    badge: {
      backgroundColor: colors.cp + '10',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: colors.cp + '30',
    },
    badgeText: {
      fontSize: 9,
      color: colors.cp,
      fontWeight: 500,
    },
    instruccionesBox: {
      backgroundColor: '#fffbeb',
      borderWidth: 1,
      borderColor: '#f59e0b',
      borderRadius: 4,
      padding: 8,
      marginTop: 6,
    },
    instruccionesHeader: {
      fontSize: 9.5,
      fontWeight: 700,
      color: '#b45309',
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    instruccionesContent: {
      fontSize: 9,
      color: '#78350f',
      lineHeight: 1.4,
    },
    indicacionesContent: {
      fontSize: 10,
      color: '#1a1a1a',
      lineHeight: 1.5,
    },
    firmasRow: {
      marginTop: 60,
      paddingTop: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 30,
    },
    firmaCol: {
      flex: 1,
      alignItems: 'center',
    },
    firmaLinea: {
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: '#999',
      borderTopStyle: 'dashed',
      paddingTop: 6,
      alignItems: 'center',
    },
    firmaLabel: {
      fontSize: 8,
      color: '#888',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    firmaNombre: {
      fontWeight: 700,
      fontSize: 9.5,
      color: colors.cp,
      textAlign: 'center',
    },
    firmaCed: {
      fontSize: 7.5,
      color: '#666',
      marginTop: 1,
      textAlign: 'center',
    },
    firmaYSello: {
      fontSize: 6,
      color: '#c0c0c0',
      marginTop: 3,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      textAlign: 'center',
    },
  })
}

export default function SolicitudInternamientoPdf({ medico, data, logoUrl, consultorio }: SolicitudInternamientoProps) {
  const colors = getPdfColors(medico)
  const s = buildStyles(colors)
  const nombre = componerNombreMedicoCompleto({
    titulo: medico?.titulo,
    nombres: medico?.nombres,
    apellido_paterno: medico?.apellido_paterno,
    apellido_materno: medico?.apellido_materno,
  }) || 'Médico'
  const cedProf = medico?.cedula_profesional || ''
  const cedEsp = medico?.cedula_especialidad || ''

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header fixed — se repite en cada página */}
        <View fixed style={s.headerFixed}>
          <BarraTop colors={colors} />
          <View style={s.headerInner}>
            <PdfHeader medico={medico} colors={colors} logoUrl={logoUrl} folio={data.folio} fecha={data.fecha} compact consultorio={consultorio} />
          </View>
        </View>

        {/* Footer fixed — se repite en cada página */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

        <View style={{ flex: 1 }}>
        {/* Titulo */}
        <View style={s.tituloDoc}>
          <Text style={s.tituloText}>Solicitud de Internamiento Hospitalario</Text>
        </View>

        {/* Badge urgente */}
        {data.urgente ? (
          <View style={s.urgenteBadge}>
            <Text style={s.urgenteBadgeText}>URGENTE</Text>
          </View>
        ) : null}

        {/* FECHA + PACIENTE + FECHA INGRESO */}
        <View style={s.datoRow}>
          <View style={s.datoField}>
            <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>FECHA</Text>
            <Text style={baseStyles.datoValor}>{data.fecha}</Text>
          </View>
          <View style={[s.datoField, { flex: 2 }]}>
            <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>PACIENTE</Text>
            <Text style={baseStyles.datoValor}>{data.paciente}</Text>
          </View>
          {data.fechaIngreso ? (
            <View style={s.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>FECHA DE INGRESO</Text>
              <Text style={baseStyles.datoValor}>{data.fechaIngreso}</Text>
            </View>
          ) : null}
        </View>

        {/* HOSPITAL/LUGAR */}
        {data.lugar ? (
          <View style={s.datoRow}>
            <View style={s.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>HOSPITAL / LUGAR</Text>
              <Text style={s.lugarValor}>{data.lugar}</Text>
            </View>
          </View>
        ) : null}

        {/* TIPO + DIAS + ASA */}
        <View style={s.datoRow}>
          {data.tipoInternamiento ? (
            <View style={s.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>TIPO DE INTERNAMIENTO</Text>
              <Text style={baseStyles.datoValor}>{data.tipoInternamiento}</Text>
            </View>
          ) : null}
          {data.diasEstimados ? (
            <View style={s.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>DÍAS ESTIMADOS</Text>
              <Text style={baseStyles.datoValor}>{data.diasEstimados}</Text>
            </View>
          ) : null}
          {data.asa ? (
            <View style={s.datoField}>
              <Text style={[baseStyles.datoLabel, { color: colors.cp }]}>ASA</Text>
              <Text style={baseStyles.datoValor}>{data.asa}</Text>
            </View>
          ) : null}
        </View>

        {/* Diagnosticos */}
        <View>
          <View style={s.seccion}>
            <Text style={s.seccionTitle}>Diagnósticos</Text>
          </View>
          <Text style={s.diagPrincipal}>{data.diagnostico}</Text>
          {data.diagnosticosSecundarios?.map((dx, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.bulletDot} />
              <Text style={s.bulletText}>{dx}</Text>
            </View>
          ))}
        </View>

        {/* Procedimiento */}
        {data.procedimiento ? (
          <View>
            <View style={s.seccion}>
              <Text style={s.seccionTitle}>Procedimiento / Cirugía</Text>
            </View>
            <Text style={s.justifiedText}>{data.procedimiento}</Text>
          </View>
        ) : null}

        {/* Requerimientos especiales */}
        {data.requerimientos && data.requerimientos.length > 0 ? (
          <View>
            <View style={s.seccion}>
              <Text style={s.seccionTitle}>Requerimientos especiales</Text>
            </View>
            <View style={s.badgesWrap}>
              {data.requerimientos.map((req, i) => (
                <View key={i} style={s.badge}>
                  <Text style={s.badgeText}>{req}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Justificacion clinica */}
        {data.justificacion ? (
          <View>
            <View style={s.seccion}>
              <Text style={s.seccionTitle}>Justificación clínica</Text>
            </View>
            <Text style={s.justifiedText}>{data.justificacion}</Text>
          </View>
        ) : null}

        {/* Instrucciones para el paciente */}
        {data.instruccionesPaciente ? (
          <View style={s.instruccionesBox}>
            <Text style={s.instruccionesHeader}>Instrucciones para el paciente</Text>
            <Text style={s.instruccionesContent}>{data.instruccionesPaciente}</Text>
          </View>
        ) : null}

        </View>

        {/* Doble firma — último elemento del contenido */}
        <View style={s.firmasRow} wrap={false}>
          <View style={s.firmaCol}>
            <View style={s.firmaLinea}>
              <Text style={s.firmaLabel}>Firma del Paciente o Familiar</Text>
            </View>
          </View>
          <View style={s.firmaCol}>
            <View style={s.firmaLinea}>
              <Text style={s.firmaNombre}>{nombre}</Text>
              {cedProf ? <Text style={s.firmaCed}>Céd. Prof. {cedProf}</Text> : null}
              {cedEsp ? <Text style={s.firmaCed}>Céd. Esp. {cedEsp}</Text> : null}
              <Text style={s.firmaYSello}>Firma y sello</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* PÁGINA 2 — Solo si hay indicaciones de piso */}
      {data.indicacionesPiso ? (
        <Page size="LETTER" style={s.page}>
          <View fixed style={s.headerFixed}>
            <BarraTop colors={colors} />
            <View style={s.headerInner}>
              <PdfHeader medico={medico} colors={colors} logoUrl={logoUrl} compact consultorio={consultorio} />
            </View>
          </View>

          <View fixed style={s.footerFixed}>
            <BarraBottom colors={colors} medico={medico} consultorio={consultorio} />
          </View>

          <PdfWatermark logoUrl={logoUrl} />

          <View style={{ flex: 1 }}>
          <View style={s.tituloDoc}>
            <Text style={s.tituloText}>Indicaciones de Ingreso a Piso</Text>
          </View>
          <Text style={{ fontSize: 8, color: '#666', textAlign: 'center', marginBottom: 10 }}>
            Para personal de enfermería y médico residente
          </Text>

          <Text style={s.indicacionesContent}>{data.indicacionesPiso}</Text>

          </View>

          {/* Firma del médico */}
          <View style={s.firmasRow}>
            <View style={s.firmaCol} />
            <View style={s.firmaCol}>
              <View style={s.firmaLinea}>
                <Text style={s.firmaNombre}>{nombre}</Text>
                {cedProf ? <Text style={s.firmaCed}>Céd. Prof. {cedProf}</Text> : null}
                {cedEsp ? <Text style={s.firmaCed}>Céd. Esp. {cedEsp}</Text> : null}
                <Text style={s.firmaYSello}>Firma y sello</Text>
              </View>
            </View>
          </View>
        </Page>
      ) : null}
    </Document>
  )
}
