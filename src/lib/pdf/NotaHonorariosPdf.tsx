import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import PdfHeader from './PdfHeader'
import PdfFirma from './PdfFirma'
import PdfWatermark from './PdfWatermark'
import { BarraTop, BarraBottom } from './PdfBarras'
import { baseStyles, getPdfColors } from './PdfStyles'
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

  const s = StyleSheet.create({
    tituloBanner: {
      backgroundColor: colors.cp + '0D',
      borderRadius: 4,
      paddingVertical: 8,
      paddingHorizontal: 14,
      marginTop: 18,
      marginBottom: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    tituloText: {
      fontSize: 13,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: colors.cp,
      letterSpacing: 1,
    },
    folioText: {
      fontSize: 9,
      color: colors.cp,
      fontWeight: 500,
    },
    /* Tabla */
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: colors.cp,
      borderRadius: 3,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginBottom: 2,
    },
    thNum: {
      width: 30,
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
    },
    thConcepto: {
      flex: 1,
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
    },
    thPrecio: {
      width: 100,
      fontSize: 8,
      fontWeight: 700,
      color: '#ffffff',
      textAlign: 'right',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 2,
    },
    tdNum: {
      width: 30,
      fontSize: 9.5,
      color: '#555',
    },
    tdConcepto: {
      flex: 1,
      fontSize: 10,
      color: '#1a1a1a',
    },
    tdPrecio: {
      width: 100,
      fontSize: 10,
      color: '#1a1a1a',
      textAlign: 'right',
    },
    /* Total */
    totalCard: {
      backgroundColor: colors.cp,
      borderRadius: 4,
      paddingVertical: 10,
      paddingHorizontal: 18,
      marginTop: 14,
      alignSelf: 'flex-end',
      minWidth: 200,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 11,
      fontWeight: 700,
      color: '#ffffff',
    },
    totalAmount: {
      fontSize: 16,
      fontWeight: 700,
      color: '#ffffff',
    },
    divisaNote: {
      fontSize: 7.5,
      color: '#888',
      textAlign: 'right',
      marginTop: 4,
    },
    /* Forma de pago */
    pagoBadge: {
      backgroundColor: '#f0f0f0',
      borderRadius: 10,
      paddingVertical: 4,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
      marginTop: 14,
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
      marginTop: 32,
    },
    fiscalNote: {
      fontSize: 7,
      color: '#aaa',
      maxWidth: 200,
      lineHeight: 1.5,
    },
  })

  const divisaLabel = data.divisa === 'MXN' ? 'Pesos mexicanos' : 'Dólares americanos'

  return (
    <Document>
      <Page size="LETTER" style={baseStyles.page}>
        <BarraTop colors={colors} />
        <View style={baseStyles.contenido}>
          <PdfWatermark logoUrl={logoUrl} />
          <PdfHeader
            medico={medico}
            colors={colors}
            logoUrl={logoUrl}
            folio={data.folio}
            fecha={data.fecha}
          />

          {/* Titulo banner */}
          <View style={s.tituloBanner}>
            <Text style={s.tituloText}>{titulo}</Text>
            <Text style={s.folioText}>Folio: {data.folio}</Text>
          </View>

          {/* Datos */}
          <View style={baseStyles.datoRow}>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>FECHA</Text>
              <Text style={baseStyles.datoValor}>{data.fecha}</Text>
            </View>
            <View style={baseStyles.datoField}>
              <Text style={baseStyles.datoLabel}>
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
                { backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff' },
              ]}
            >
              <Text style={s.tdNum}>{i + 1}</Text>
              <Text style={s.tdConcepto}>{linea.concepto}</Text>
              <Text style={s.tdPrecio}>{fmt(linea.precio, data.divisa)}</Text>
            </View>
          ))}

          {/* Total */}
          <View style={s.totalCard}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalAmount}>{fmt(data.total, data.divisa)}</Text>
          </View>
          <Text style={s.divisaNote}>{divisaLabel}</Text>

          {/* Forma de pago */}
          {!esCotizacion && data.formaPago ? (
            <View style={s.pagoBadge}>
              <Text style={s.pagoText}>Forma de pago: {data.formaPago}</Text>
            </View>
          ) : null}

          {/* Footer: fiscal note + firma */}
          <View style={s.footerRow}>
            <Text style={s.fiscalNote}>
              Este documento no es un Comprobante Fiscal Digital por Internet (CFDI).
            </Text>
            <View style={{ minWidth: 240 }}>
              <PdfFirma medico={medico} colors={colors} />
            </View>
          </View>
        </View>

        {/* Numeración de página */}
        <Text
          style={baseStyles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />

        <BarraBottom colors={colors} medico={medico} />
      </Page>
    </Document>
  )
}
