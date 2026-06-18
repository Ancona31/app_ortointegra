import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { getPdfColors } from './PdfStyles'
import type { PdfMedicoData, PdfConsultorioData } from './PdfStyles'

export interface NotaHonorariosData {
  paciente?: string
  fecha: string
  folio: string
  tipoDoc: 'honorarios' | 'cotizacion'
  lineas: Array<{ concepto: string; precio: number }>
  total: number
  divisa: 'MXN' | 'USD'
  formaPago?: string
  notas?: string
  aseguradora?: {
    nombre: string
    poliza: string
    cobertura: string
  } | null
}

export interface NotaHonorariosProps {
  medico: PdfMedicoData | null
  data: NotaHonorariosData
  logoUrl?: string
  consultorio?: PdfConsultorioData
}

function fmt(n: number, divisa: 'MXN' | 'USD'): string {
  return n.toLocaleString(divisa === 'MXN' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: divisa,
  })
}

export function renderNotaHonorarios(props: NotaHonorariosProps) {
  return <NotaHonorariosPdf {...props} />
}

export default function NotaHonorariosPdf({ medico, data, logoUrl, consultorio }: NotaHonorariosProps) {
  const colors = getPdfColors(medico)
  const esCotizacion = data.tipoDoc === 'cotizacion'
  const titulo = esCotizacion ? 'Cotización' : 'Recibo de Honorarios'
  const divisaLabel = data.divisa === 'MXN' ? 'Pesos mexicanos' : 'Dólares americanos'

  const s = StyleSheet.create({
    /* ── Page ── */
    page: {
      fontFamily: 'Roboto',
      fontSize: 9,
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

    /* ── Título — línea inferior, sin fondo sólido ── */
    tituloRow: {
      marginTop: 10,
      marginBottom: 10,
      paddingBottom: 6,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.cp,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    tituloText: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: colors.cp,
      letterSpacing: 1.5,
    },
    folioText: {
      fontSize: 8,
      color: '#888',
      opacity: 0.8,
      fontWeight: 500,
    },

    /* ── Datos compactos — sin recuadros/bordes ── */
    datosRow: {
      flexDirection: 'row',
      gap: 24,
      marginBottom: 8,
    },
    datoGroup: {
      flex: 1,
    },
    datoGroupWide: {
      flex: 2,
    },
    datoLabel: {
      fontSize: 7,
      fontWeight: 700,
      color: colors.cs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    datoValor: {
      fontSize: 9.5,
      color: '#1a1a1a',
      fontWeight: 500,
    },

    /* ── Aseguradora — condicional ── */
    aseguradoraRow: {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 10,
      paddingVertical: 6,
      paddingRight: 10,
      paddingLeft: 14,
      backgroundColor: '#f8fafc',
      borderLeftWidth: 2.5,
      borderLeftColor: colors.cs,
    },

    /* ── Tabla quirúrgica — líneas, sin fondo sólido ── */
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderTopWidth: 1,
      borderTopColor: colors.cp,
      borderBottomWidth: 1,
      borderBottomColor: colors.cp,
      marginTop: 6,
    },
    thNum: {
      width: 26,
      fontSize: 7,
      fontWeight: 700,
      color: colors.cp,
      textTransform: 'uppercase',
    },
    thConcepto: {
      flex: 1,
      fontSize: 7,
      fontWeight: 700,
      color: colors.cp,
      textTransform: 'uppercase',
    },
    thPrecio: {
      width: 100,
      fontSize: 7,
      fontWeight: 700,
      color: colors.cp,
      textTransform: 'uppercase',
      textAlign: 'right',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: '#e5e7eb',
    },
    tdNum: {
      width: 26,
      fontSize: 9,
      color: '#aaa',
      fontWeight: 500,
    },
    tdConcepto: {
      flex: 1,
      fontSize: 9,
      color: '#1a1a1a',
    },
    tdPrecio: {
      width: 100,
      fontSize: 9,
      color: '#1a1a1a',
      fontWeight: 500,
      textAlign: 'right',
    },

    /* ── Total — línea superior, sin fondo sólido ── */
    totalRow: {
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 2,
      borderTopColor: colors.cp,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'baseline',
      gap: 12,
    },
    totalLabel: {
      fontSize: 8,
      fontWeight: 700,
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalAmount: {
      fontSize: 16,
      fontWeight: 700,
      color: colors.cp,
    },
    divisaNote: {
      fontSize: 7,
      color: '#aaa',
      textAlign: 'right',
      marginTop: 2,
    },

    /* ── Forma de pago ── */
    pagoBadge: {
      borderWidth: 0.5,
      borderColor: '#d1d5db',
      backgroundColor: '#fafafa',
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
      marginTop: 10,
      flexDirection: 'row',
      gap: 4,
    },
    pagoLabel: {
      fontSize: 8,
      color: '#888',
      fontWeight: 700,
    },
    pagoText: {
      fontSize: 8,
      color: '#555',
    },

    /* ── Notas y Consideraciones ── */
    notasSection: {
      marginTop: 10,
      paddingLeft: 10,
      borderLeftWidth: 2.5,
      borderLeftColor: colors.cs,
      paddingVertical: 6,
    },
    notasTitle: {
      fontSize: 7.5,
      fontWeight: 700,
      color: colors.cp,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    notasText: {
      fontSize: 8.5,
      color: '#444',
      lineHeight: 1.3,
      fontStyle: 'italic',
    },

    /* ── Footer ── */
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 10,
      paddingTop: 8,
    },
    fiscalNote: {
      fontSize: 6.5,
      color: '#aaa',
      maxWidth: 200,
      lineHeight: 1.4,
    },
  })

  return (
    <Document>
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

        <View style={{ flex: 1 }}>
          {/* Título — solo texto, folio ya está en el Header global */}
          <View style={s.tituloRow}>
            <Text style={s.tituloText}>{titulo}</Text>
          </View>

          {/* Datos compactos — sin recuadros */}
          <View style={s.datosRow}>
            <View style={s.datoGroup}>
              <Text style={s.datoLabel}>Fecha</Text>
              <Text style={s.datoValor}>{data.fecha}</Text>
            </View>
            <View style={s.datoGroupWide}>
              <Text style={s.datoLabel}>
Paciente
              </Text>
              <Text style={s.datoValor}>{data.paciente || '—'}</Text>
            </View>
          </View>

          {/* Aseguradora — condicional */}
          {data.aseguradora?.nombre ? (
            <View style={s.aseguradoraRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.datoLabel}>Aseguradora</Text>
                <Text style={s.datoValor}>{data.aseguradora.nombre}</Text>
              </View>
              {data.aseguradora.poliza ? (
                <View style={{ flex: 1 }}>
                  <Text style={s.datoLabel}>Póliza</Text>
                  <Text style={s.datoValor}>{data.aseguradora.poliza}</Text>
                </View>
              ) : null}
              {data.aseguradora.cobertura ? (
                <View style={{ flex: 1 }}>
                  <Text style={s.datoLabel}>Cobertura</Text>
                  <Text style={s.datoValor}>{data.aseguradora.cobertura}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Tabla de conceptos — líneas horizontales, sin fondo sólido */}
          <View style={s.tableHeader}>
            <Text style={s.thNum}>#</Text>
            <Text style={s.thConcepto}>Concepto</Text>
            <Text style={s.thPrecio}>Precio</Text>
          </View>
          {data.lineas.map((linea, i) => (
            <View key={i} style={s.tableRow} wrap={false}>
              <Text style={s.tdNum}>{i + 1}</Text>
              <Text style={s.tdConcepto}>{linea.concepto}</Text>
              <Text style={s.tdPrecio}>{fmt(linea.precio, data.divisa)}</Text>
            </View>
          ))}

          {/* Total — línea superior, monto a la derecha */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalAmount}>{fmt(data.total, data.divisa)}</Text>
          </View>
          <Text style={s.divisaNote}>{divisaLabel}</Text>

          {/* Forma de pago */}
          {!esCotizacion && data.formaPago ? (
            <View style={s.pagoBadge}>
              <Text style={s.pagoLabel}>Forma de pago:</Text>
              <Text style={s.pagoText}>{data.formaPago}</Text>
            </View>
          ) : null}

          {/* Notas y Consideraciones — condicional */}
          {data.notas ? (
            <View style={s.notasSection}>
              <Text style={s.notasTitle}>Notas y Consideraciones</Text>
              <Text style={s.notasText}>{data.notas}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer: fiscal note + firma */}
        <View style={s.footerRow}>
          <Text style={s.fiscalNote}>
            Este documento no es un Comprobante Fiscal Digital por Internet (CFDI).
          </Text>
          <View style={{ minWidth: 240 }}>
            <PdfFirma medico={medico} colors={colors} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
