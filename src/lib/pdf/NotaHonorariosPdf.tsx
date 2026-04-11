import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors, contrastText } from './PdfStyles'
import type { PdfMedicoData } from './PdfStyles'

export interface NotaHonorariosData {
  paciente?: string
  fecha: string
  folio: string
  tipoDoc: 'honorarios' | 'cotizacion'
  lineas: Array<{ concepto: string; precio: number }>
  total: number
  divisa: 'MXN' | 'USD'
  formaPago?: string
}

export interface NotaHonorariosProps {
  medico: PdfMedicoData | null
  data: NotaHonorariosData
  logoUrl?: string
}

function fmt(n: number, divisa: 'MXN' | 'USD'): string {
  return n.toLocaleString(divisa === 'MXN' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: divisa,
  })
}

/** Helper para renderToBuffer — retorna el JSX con tipo correcto */
export function renderNotaHonorarios(props: NotaHonorariosProps) {
  return <NotaHonorariosPdf {...props} />
}

export default function NotaHonorariosPdf({ medico, data, logoUrl }: NotaHonorariosProps) {
  const colors = getPdfColors(medico)
  const esCotizacion = data.tipoDoc === 'cotizacion'
  const titulo = esCotizacion ? 'Cotización' : 'Recibo de Honorarios'
  const divisaLabel = data.divisa === 'MXN' ? 'Pesos mexicanos' : 'Dólares americanos'

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
    /* Titulo banner */
    tituloBanner: {
      marginTop: 14,
      marginBottom: 16,
      paddingVertical: 9,
      borderRadius: 4,
      flexDirection: 'row',
      justifyContent: 'center',
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
      flex: 1,
    },
    folioTag: {
      position: 'absolute',
      right: 14,
      fontSize: 8,
      color: contrastText(colors.cp),
      opacity: 0.85,
      fontWeight: 500,
    },
    /* Tabla */
    tableHeader: {
      flexDirection: 'row',
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      paddingVertical: 7,
      paddingHorizontal: 12,
      backgroundColor: colors.cp,
    },
    thNum: {
      width: 30,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
    },
    thConcepto: {
      flex: 1,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
    },
    thPrecio: {
      width: 110,
      fontSize: 7.5,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      textAlign: 'right',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    tdNum: {
      width: 30,
      fontSize: 9.5,
      color: '#888',
      fontWeight: 500,
    },
    tdConcepto: {
      flex: 1,
      fontSize: 10,
      color: '#1a1a1a',
    },
    tdPrecio: {
      width: 110,
      fontSize: 10,
      color: '#1a1a1a',
      fontWeight: 500,
      textAlign: 'right',
    },
    /* Total — separate from table */
    totalWrap: {
      borderRadius: 6,
      padding: 12,
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cp,
    },
    totalLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: contrastText(colors.cp),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalAmount: {
      fontSize: 18,
      fontWeight: 700,
      color: contrastText(colors.cp),
    },
    divisaNote: {
      fontSize: 7.5,
      color: '#888',
      textAlign: 'right',
      marginTop: 4,
    },
    /* Forma de pago */
    pagoBadge: {
      borderWidth: 0.75,
      borderColor: '#d1d5db',
      backgroundColor: '#f9fafb',
      borderRadius: 10,
      paddingVertical: 5,
      paddingHorizontal: 14,
      alignSelf: 'flex-start',
      marginTop: 14,
      flexDirection: 'row',
      gap: 4,
    },
    pagoLabel: {
      fontSize: 8.5,
      color: '#888',
      fontWeight: 700,
    },
    pagoText: {
      fontSize: 8.5,
      color: '#555',
    },
    /* Footer */
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 16,
      paddingTop: 10,
    },
    fiscalNote: {
      fontSize: 7,
      color: '#aaa',
      maxWidth: 200,
      lineHeight: 1.5,
    },
  })

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header fixed — se repite en cada página */}
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
            />
          </View>
        </View>

        {/* Footer fixed — se repite en cada página */}
        <View fixed style={s.footerFixed}>
          <BarraBottom colors={colors} medico={medico} />
        </View>

        <PdfWatermark logoUrl={logoUrl} />

        <View style={{ flex: 1 }}>
          {/* Titulo banner con folio */}
          <View style={s.tituloBanner}>
            <Text style={s.tituloText}>{titulo}</Text>
            <Text style={s.folioTag}>Folio: {data.folio}</Text>
          </View>

          {/* Datos */}
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={{ ...baseStyles.datoLabel, color: colors.cs }}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data.fecha}</Text>
            </View>
            <View style={[baseStyles.datoField, { flex: 2 }]}>
              <Text style={{ ...baseStyles.datoLabel, color: colors.cs }}>
                {esCotizacion ? 'CLIENTE' : 'PACIENTE'}
              </Text>
              <Text style={baseStyles.datoValor}>{data.paciente || '—'}</Text>
            </View>
          </View>

          {/* Tabla de conceptos */}
          <View style={s.tableHeader}>
            <Text style={s.thNum}>#</Text>
            <Text style={s.thConcepto}>Concepto</Text>
            <Text style={s.thPrecio}>Precio</Text>
          </View>
          {data.lineas.map((linea, i) => (
            <View
              key={i}
              style={[
                s.tableRow,
                { backgroundColor: i % 2 === 0 ? colors.cs + '0D' : '#ffffff' },
              ]}
            >
              <Text style={s.tdNum}>{i + 1}</Text>
              <Text style={s.tdConcepto}>{linea.concepto}</Text>
              <Text style={s.tdPrecio}>{fmt(linea.precio, data.divisa)}</Text>
            </View>
          ))}

          {/* Total — separate card */}
          <View style={s.totalWrap}>
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
