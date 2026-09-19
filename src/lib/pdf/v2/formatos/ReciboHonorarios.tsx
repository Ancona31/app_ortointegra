/**
 * Sistema de documentos v3 — formato **II.5 · Recibo de Honorarios / Cotización**.
 * Brief `05`, con su adenda del §10. Arquetipo E: el único formato con lógica de
 * cálculo… que **no vive aquí**. Este archivo recibe importes ya formateados.
 *
 * Un archivo y dos documentos. Lo comparten todo menos cuatro cosas, y las cuatro
 * cuelgan de `tipo_doc`:
 *
 *     cotización   celda de vigencia · caja de aseguradora · columna de ORIGEN
 *                  en la tabla · desglose de subtotales · `Total estimado`
 *     recibo       anticipo y saldo · forma de pago · `Total`
 *
 * ── LO QUE CAMBIA RESPECTO DE v2 ────────────────────────────────────────────
 *
 * 1. **SIN QR, EN LOS DOS.** Decisión de producto: no hay ventanilla que verifique un
 *    importe. El código dejaba un hueco de 230 pt sobre la banda de cierre de la
 *    Cotización, que es el defecto §9.4.
 * 2. **La banda de cierre alinea por ARRIBA** y con dos celdas: firma a la izquierda
 *    (248) y dinero a la derecha (274). Es el reparto de `CIERRE` invertido respecto de
 *    los otros ocho formatos —la columna ancha cae a la derecha— y sigue siendo legal
 *    porque lo que entra es el ANCHO, no el lado.
 * 3. **`minPresenceAhead: 130` en la última fila de la tabla**: es la banda de cierre
 *    más alta del sistema —el riel de importes con total, anticipo y saldo— más su aire.
 * 4. **Se retira la compresión de la tabla de conceptos.** v2 medía tres calibraciones
 *    de fila (21.42, 17.21 y 22.47 pt) y componía una; la fila es ahora la del rol
 *    `concepto.texto` y no cambia con el número de conceptos (I.3.4).
 * 5. **La regla de dos columnas de notas se retira**: las notas van en bandera
 *    izquierda, en una columna, con `texto.reducido`. I.3.2 prohíbe el justificado y
 *    II.5 §5 lo repite con nombre.
 * 6. **`MOTIVO` es nuevo** (adenda §10 del brief 05): el nombre del procedimiento al
 *    que corresponden los honorarios. Opcional, colapsa entero, **dos renglones con
 *    elipsis** — sin techo, un motivo de tres líneas empuja la tabla y se lleva una fila.
 *
 * ⚠ **SIN RFC Y SIN NADA CON AIRE DE CFDI.** Decisión cerrada: el documento declara que
 * no es un comprobante fiscal, y lo declara **en jerarquía visible, no en gris pequeño
 * al pie** (II.5 §1). Por eso la leyenda va enmarcada y en tinta plena.
 */

import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import MarcoParcial, { MARCO } from '../MarcoParcial'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import RielDatos from '../RielDatos'
import RielImportes, { type FilaImporte } from '../RielImportes'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import {
  CIERRE,
  ESPACIO,
  FILETE,
  MARGEN,
  PAPEL,
  RETICULA,
  TINTA,
  TIPOGRAFIA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
  SIN_ENCOGER,
} from '../tokens'

const TITULO_RECIBO = 'Recibo de honorarios'
const TITULO_COTIZACION = 'Cotización'
const ITEMS = 'conceptos'
const ROTULO_MOTIVO = 'Motivo'
const ROTULO_ASEGURADORA = 'Aseguradora'
const ROTULO_FORMA_PAGO = 'Forma de pago'
const ROTULO_METODO = 'Método'
const ROTULO_NOTAS = 'Notas y consideraciones'
const ROTULO_ORIGEN_CONCEPTOS = 'Origen de los conceptos'
const TOTAL = 'Total'
const TOTAL_ESTIMADO = 'Total estimado'
const CABECERA = { numero: '#', concepto: 'Concepto', origen: 'Origen', precio: 'Precio' }
const NO_FISCAL = {
  titulo: 'Documento informativo',
  cuerpo: 'No es un Comprobante Fiscal Digital por Internet (CFDI).',
}

const PRESENCIA_ULTIMA_FILA = 130

/** Anchos de la tabla. Doce columnas de retícula, repartidas por el formato. */
const TABLA = {
  numero: RETICULA.riel,
  origen: 120,
  precio: 90,
} as const

export interface ConceptoCobrado {
  readonly concepto: string
  /** YA formateado, con divisa. Este archivo no calcula ni formatea. */
  readonly precio: string
  /** Origen del importe. Sólo la Cotización lo compone. */
  readonly origen?: string
}

export interface Aseguradora {
  readonly nombre: string
  readonly poliza?: string
  readonly cobertura?: string
}

interface Comun {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * ⚠ **EL ÚNICO FORMATO DONDE EL PACIENTE NO ES OBLIGATORIO.** Cuando falta, su celda
   * colapsa y la fila se queda con la fecha: un recibo de mostrador puede no llevar
   * nombre. Se arregla el día que el formulario lo exija, no desde aquí.
   */
  readonly paciente: ValoresPaciente
  readonly lineas: readonly ConceptoCobrado[]
  /** Nombre del procedimiento. Adenda §10. Colapsa. */
  readonly motivo?: string
  readonly monto: string
  /** `MXN · Pesos mexicanos`, ya redactado. */
  readonly divisa?: string
  readonly notas?: string
  readonly folio: string
  readonly rubrica?: string
}

export type ReciboHonorariosProps =
  | (Comun & {
      readonly tipo_doc: 'honorarios'
      readonly anticipo?: string
      readonly saldo?: string
      readonly forma_pago?: string
    })
  | (Comun & {
      readonly tipo_doc: 'cotizacion'
      readonly subtotales: readonly { readonly origen: string; readonly total: string }[]
      readonly aseguradora?: Aseguradora
    })

/**
 * Ascendente de Archivo en em, leído del binario de `public/fonts/`.
 *
 * ⚠⚠ **HACE FALTA PORQUE EL MOTOR NO ALINEA BASES, Y `alignItems` NO LO ARREGLA.**
 *
 * La base de la primera línea de un `Text` cae a `cuerpo × ASCENDENTE` del techo de su
 * caja, sin medio-interlineado. Dos celdas de la misma fila con cuerpos distintos —el
 * concepto a 10.5 y el `ORIGEN` en versalita de 7— tienen cajas del mismo alto (las dos
 * a interlineado 13) y bases separadas 3 pt, así que la fila deja de leerse de corrido.
 * Se probaron los cinco valores de `alignItems` —incluido `baseline`— sobre el render y
 * **ninguno mueve nada**, precisamente porque las cajas ya miden igual.
 *
 * Es la única tabla del sistema que pone tres cuerpos en una fila; por eso la
 * compensación vive aquí y no en el chasis.
 */
const ASCENDENTE_ARCHIVO = 0.878

/**
 * Desplazamiento que baja la base de un cuerpo pequeño hasta la del cuerpo de la fila.
 *
 * ⚠ **VA COMO `position: 'relative'` + `top`, NUNCA COMO `paddingTop`.** Un relleno
 * crece la caja, y la fila mide lo que mide su hijo más alto: con `paddingTop` la fila
 * de la tabla pasaba de 21.63 a 22.81 pt sólo por alinear el ordinal. La posición
 * relativa desplaza el dibujo sin tocar el reparto, que es justo lo que hace falta.
 */
function alinearBase(cuerpo: number): { position: 'relative'; top: number } {
  return {
    position: 'relative',
    top: (TIPOGRAFIA['concepto.texto'].cuerpo - cuerpo) * ASCENDENTE_ARCHIVO,
  }
}

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    paddingBottom: MARGEN.inferior,
  },
  bloqueMotivo: { marginBottom: TRANSICION.fichaContenido },
  rotulo: { ...estiloTipografico('etiqueta') },
  motivo: {
    ...estiloTipografico('concepto.texto'),
    maxLines: 2,
    textOverflow: 'ellipsis',
  },
  aseguradora: { marginBottom: TRANSICION.fichaContenido },
  aseguradoraNombre: { ...estiloTipografico('aseguradora.nombre') },
  fila: { flexDirection: 'row', alignItems: 'baseline' },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: FILETE.acento,
    borderBottomColor: TINTA.negra,
    paddingBottom: TRANSICION.tablaFilete,
  },
  filaConcepto: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: FILETE.regla,
    borderBottomColor: TINTA.reglaFila,
    paddingVertical: ESPACIO[4],
    // I.3.4 · una fila no se aprieta para que quepa una más. Ver `SIN_ENCOGER`.
    flexShrink: SIN_ENCOGER,
  },
  /**
   * ⚠⚠ **LA GEOMETRÍA DE CADA CELDA VA EN SU `Text`, SIN `View` ENVOLVENTE.**
   *
   * `alignItems: 'baseline'` de la fila **sólo funciona con hijos que son `Text`**: el
   * motor no sabe deducir la base de un `View` y lo alinea por arriba. Con las celdas
   * envueltas, las tres columnas de esta tabla se componían con tres bases distintas
   * —el `ORIGEN` en versalita de 7 salía 3 pt por encima del concepto de 10.5— y la
   * fila dejaba de leerse de corrido. Medido sobre el render.
   *
   * Los cuatro anchos y el `flexShrink` bajan aquí desde las cajas que había.
   */
  numero: {
    ...estiloTipografico('concepto.numero'),
    textAlign: 'right',
    width: TABLA.numero,
    flexShrink: SIN_ENCOGER,
    ...alinearBase(TIPOGRAFIA['concepto.numero'].cuerpo),
  },
  concepto: {
    ...estiloTipografico('concepto.texto'),
    maxLines: 2,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingLeft: ESPACIO[8],
  },
  origenPropio: {
    ...estiloTipografico('concepto.origenPropio'),
    maxLines: 1,
    width: TABLA.origen,
    flexShrink: SIN_ENCOGER,
    ...alinearBase(TIPOGRAFIA['concepto.origenPropio'].cuerpo),
  },
  origenTercero: {
    ...estiloTipografico('concepto.origenTercero'),
    maxLines: 1,
    width: TABLA.origen,
    flexShrink: SIN_ENCOGER,
    ...alinearBase(TIPOGRAFIA['concepto.origenTercero'].cuerpo),
  },
  precio: {
    ...estiloTipografico('concepto.texto'),
    textAlign: 'right',
    width: TABLA.precio,
    flexShrink: SIN_ENCOGER,
  },
  cabeceraNumero: {
    ...estiloTipografico('etiqueta'),
    textAlign: 'right',
    width: TABLA.numero,
    flexShrink: SIN_ENCOGER,
  },
  cabeceraConcepto: {
    ...estiloTipografico('etiqueta'),
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingLeft: ESPACIO[8],
  },
  cabeceraOrigen: { ...estiloTipografico('etiqueta'), width: TABLA.origen, flexShrink: 0 },
  cabeceraPrecio: {
    ...estiloTipografico('etiqueta'),
    textAlign: 'right',
    width: TABLA.precio,
    flexShrink: SIN_ENCOGER,
  },
  banda: { flexDirection: 'row', alignItems: 'flex-start' },
  columnaIzquierda: { width: CIERRE.derecha, flexShrink: 0 },
  columnaDerecha: { width: CIERRE.izquierda, flexShrink: SIN_ENCOGER, marginLeft: CIERRE.medianil },
  bloquePago: { marginBottom: ESPACIO[16] },
  valorPago: { ...estiloTipografico('formaPago.valor') },
  leyenda: { marginTop: ESPACIO[16] },
  noFiscalTitulo: { ...estiloTipografico('noFiscal.titulo') },
  noFiscalCuerpo: { ...estiloTipografico('noFiscal.cuerpo') },
  bloqueNotas: { marginTop: ESPACIO[16] },
  notas: { ...estiloTipografico('texto.reducido') },
})

/**
 * Las filas de la ficha. La Cotización añade su celda de vigencia.
 *
 * ⚠⚠ **`requerido: true` EN LA CELDA DE PACIENTE, Y FALTABA.**
 *
 * Es el único **campo vacío requerido** de este formato y uno de los tres del sistema:
 * sin nombre la celda NO colapsa —conserva su rótulo y deja la línea que se llena a
 * pluma—, que es lo que permite emitir un recibo de mostrador y anotar a quién se le
 * dio. La cabecera de 2.F lo declara así con nombre y apellidos («el paciente del
 * recibo mínimo») y la ranura existía en `CeldaPaciente`; lo que faltaba era pasarla,
 * y sin ella la celda colapsaba y el recibo salía con la fecha sola.
 */
function fichaDe(esCotizacion: boolean): readonly (readonly CeldaPaciente[])[] {
  return esCotizacion
    ? [
        [
          { campo: 'paciente', columnas: 4, requerido: true },
          { campo: 'fecha', columnas: 4, etiqueta: 'Fecha de emisión' },
          { campo: 'vigencia', columnas: 4 },
        ],
      ]
    : [
        [
          { campo: 'paciente', columnas: 6, requerido: true },
          { campo: 'fecha', columnas: 6, etiqueta: 'Fecha de emisión' },
        ],
      ]
}

/** II.5 · Recibo de Honorarios / Cotización. */
export default function ReciboHonorarios(props: ReciboHonorariosProps): ReactElement {
  const esCotizacion = props.tipo_doc === 'cotizacion'
  const titulo = esCotizacion ? TITULO_COTIZACION : TITULO_RECIBO
  const { medico, consultorio, panel, acento, paciente, lineas, motivo, notas, folio } = props

  const firmas: readonly [Firma] = [
    { nombre: medico.nombre, credenciales: medico.cedulas, rubrica: props.rubrica },
  ]

  const anticipo: FilaImporte | undefined =
    props.tipo_doc === 'honorarios' && props.anticipo !== undefined
      ? { etiqueta: 'Anticipo recibido', importe: props.anticipo }
      : undefined
  const saldo: FilaImporte | undefined =
    props.tipo_doc === 'honorarios' && props.saldo !== undefined
      ? { etiqueta: 'Saldo pendiente', importe: props.saldo }
      : undefined

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          titulo,
          /* El subtítulo nombra el procedimiento cotizado. Dos formatos lo componen:
             éste y la Denegación. */
          subtitulo: esCotizacion ? motivo : undefined,
          folio,
          paciente,
          filasFicha: fichaDe(esCotizacion),
        }}
        contador={{ items: ITEMS, total: lineas.length }}
        firmas={
          <View style={estilos.banda}>
            <View style={estilos.columnaIzquierda}>
              {props.tipo_doc === 'honorarios' &&
              props.forma_pago !== undefined &&
              props.forma_pago.trim() !== '' ? (
                <View style={estilos.bloquePago}>
                  <Text style={estilos.rotulo}>{ROTULO_FORMA_PAGO.toUpperCase()}</Text>
                  <View style={estilos.fila}>
                    <Text style={{ ...estiloTipografico('formaPago.rotulo'), marginRight: 6 }}>
                      {ROTULO_METODO.toUpperCase()}
                    </Text>
                    <Text style={estilos.valorPago}>{props.forma_pago}</Text>
                  </View>
                </View>
              ) : null}
              <BloqueFirmas variante="simple" firmas={firmas} ancho={CIERRE.derecha} />
            </View>

            <View style={estilos.columnaDerecha}>
              <RielImportes
                subtotales={
                  props.tipo_doc === 'cotizacion'
                    ? props.subtotales.map((s) => ({ etiqueta: s.origen, importe: s.total }))
                    : undefined
                }
                rotuloTotal={esCotizacion ? TOTAL_ESTIMADO : TOTAL}
                divisa={props.divisa}
                total={props.monto}
                anticipo={anticipo}
                saldo={saldo}
              />

              {/* La leyenda no fiscal, enmarcada y en tinta plena. Ver la cabecera. */}
              <View style={estilos.leyenda}>
                <MarcoParcial padding={MARCO.leyenda} ancho={CIERRE.izquierda}>
                  <Text style={estilos.noFiscalTitulo}>{NO_FISCAL.titulo}</Text>
                  <Text style={estilos.noFiscalCuerpo}>{NO_FISCAL.cuerpo}</Text>
                </MarcoParcial>
              </View>

              {notas === undefined || notas.trim() === '' ? null : (
                <View style={estilos.bloqueNotas}>
                  <Text style={estilos.rotulo}>
                    {(esCotizacion ? ROTULO_NOTAS : ROTULO_ORIGEN_CONCEPTOS).toUpperCase()}
                  </Text>
                  {/* Bandera izquierda, una columna. Ver el punto 5 de la cabecera. */}
                  <Text style={estilos.notas}>{notas}</Text>
                </View>
              )}
            </View>
          </View>
        }
      >
        {motivo === undefined || motivo.trim() === '' || esCotizacion ? null : (
          /* En la Cotización el motivo sube al subtítulo de la fila de título; en el
             Recibo vive aquí, bajo la ficha. Adenda §10. */
          <View style={estilos.bloqueMotivo}>
            <Text style={estilos.rotulo}>{ROTULO_MOTIVO.toUpperCase()}</Text>
            <Text style={estilos.motivo}>{motivo}</Text>
          </View>
        )}

        {props.tipo_doc === 'cotizacion' && props.aseguradora !== undefined ? (
          <View style={estilos.aseguradora}>
            <MarcoParcial padding={MARCO.aseguradora} color={acento.base}>
              <Text style={estilos.rotulo}>{ROTULO_ASEGURADORA.toUpperCase()}</Text>
              <Text style={estilos.aseguradoraNombre}>{props.aseguradora.nombre}</Text>
              <RielDatos
                variante="celdas"
                filas={[
                  [
                    {
                      clave: 'poliza',
                      etiqueta: 'Póliza',
                      valor: props.aseguradora.poliza,
                      columnas: 5,
                    },
                    {
                      clave: 'cobertura',
                      etiqueta: 'Cobertura',
                      valor: props.aseguradora.cobertura,
                      columnas: 5,
                    },
                  ],
                ]}
              />
            </MarcoParcial>
          </View>
        ) : null}

        {/*
          LA CABECERA DE LA TABLA. **No se repite en las hojas de continuación**, y el
          §9.1 del brief dice «sí si la tabla parte hoja». Para repetirla haría falta
          `fixed` en un nodo de tabla, que reaparecería también en la hoja donde la
          tabla ya terminó — el mismo defecto §3.1 que la cabecera de lista acaba de
          dejar atrás. Los dos casos densos medidos caben en una hoja. `dudas.md` §13.
        */}
        <View style={estilos.cabecera}>
          <Text style={estilos.cabeceraNumero}>{CABECERA.numero}</Text>
          <Text style={estilos.cabeceraConcepto}>{CABECERA.concepto.toUpperCase()}</Text>
          {esCotizacion ? (
            <Text style={estilos.cabeceraOrigen}>{CABECERA.origen.toUpperCase()}</Text>
          ) : null}
          <Text style={estilos.cabeceraPrecio}>{CABECERA.precio.toUpperCase()}</Text>
        </View>

        {lineas.map((linea, indice) => (
          <View
            key={indice}
            style={estilos.filaConcepto}
            wrap={false}
            minPresenceAhead={indice === lineas.length - 1 ? PRESENCIA_ULTIMA_FILA : undefined}
          >
            <Text style={estilos.numero}>{String(indice + 1).padStart(2, '0')}</Text>
            <Text style={estilos.concepto}>{linea.concepto}</Text>
            {esCotizacion ? (
              /*
                Propio contra tercero se distingue por PESO Y TINTA, no por caja: en
                fotocopia la diferencia entre 600 negro y 400 gris se conserva; la de un
                cuadro relleno frente a uno hueco, no (I.3.3).
              */
              <Text
                style={
                  linea.origen !== undefined && /honorario/i.test(linea.origen)
                    ? estilos.origenPropio
                    : estilos.origenTercero
                }
              >
                {(linea.origen ?? '').toUpperCase()}
              </Text>
            ) : null}
            <Text style={estilos.precio}>{linea.precio}</Text>
          </View>
        ))}
      </MotorFlujo>

      <PieDocumento variante="completo" folio={folio} documento={titulo} acento={acento} />
    </Page>
  )
}
