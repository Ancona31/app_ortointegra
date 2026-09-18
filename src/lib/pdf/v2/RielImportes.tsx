/**
 * Sistema de documentos v3 — 2.T · **RielImportes**. La columna de dinero del Recibo y
 * de la Cotización, y el único sitio del sistema donde una cifra tiene que sumar
 * visualmente con la de abajo.
 *
 * ── CÓMO ALINEA, Y NO ES CON `fontVariant` ──────────────────────────────────
 *
 * ⚠ **`fontVariant` NO EXISTE EN ESTE MOTOR.** La tabla `CIFRAS_TABULARES` de los
 * tokens queda como documentación de intención y **no la aplica nadie**. Lo que alinea
 * una columna de importes son dos cosas y las dos están aquí: `textAlign: 'right'` y
 * un ancho de columna fijo. Quien quite cualquiera de las dos rompe la suma visual sin
 * que nada avise.
 *
 * ── LA GEOMETRÍA DEL TOTAL ES DE ESTE COMPONENTE ────────────────────────────
 *
 * `APUESTA` — el cuerpo del total son **20 pt**. No sale de un rol: I.1.4 no tiene
 * ninguno de 20, y I.1.7 manda que la geometría interna de un componente viva en su
 * ficha. Está medido sobre el PNG de referencia (`honorarios-normal-hoja-1.png`), donde
 * el importe grande mide poco más del doble que el concepto de 10.5. Si al render sale
 * desproporcionado respecto del PNG, este número es lo único que hay que mover.
 *
 * Regla 3, sin cambio: **sin subtotales no hay nada que separar del total**, así que el
 * filete intermedio no se dibuja. Y sin anticipo no hay bloque de anticipo, y sin él el
 * saldo no tiene de qué colgarse.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { ESPACIO, FILETE, TINTA, estiloTipografico } from './tokens'

/** `APUESTA`. Ver la cabecera. */
const CUERPO_TOTAL = 20

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  etiqueta: {
    ...estiloTipografico('concepto.texto'),
    color: TINTA.secundaria,
    flexShrink: 1,
    minWidth: 0,
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  importe: {
    ...estiloTipografico('concepto.texto'),
    flexShrink: 0,
    marginLeft: ESPACIO[12],
    textAlign: 'right',
  },
  rotuloTotal: {
    ...estiloTipografico('etiqueta'),
  },
  divisa: {
    ...estiloTipografico('formaPago.valor'),
    color: TINTA.secundaria,
    flexShrink: 1,
    minWidth: 0,
    maxLines: 2,
  },
  total: {
    ...estiloTipografico('concepto.texto'),
    fontSize: CUERPO_TOTAL,
    lineHeight: 1.15,
    fontWeight: 600,
    flexShrink: 0,
    marginLeft: ESPACIO[12],
    textAlign: 'right',
  },
  filete: {
    borderTopWidth: FILETE.tabla,
    borderTopColor: TINTA.negra,
    marginTop: ESPACIO[4],
    paddingTop: ESPACIO[4],
  },
  reglaSuave: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.hairline,
    marginTop: ESPACIO[4],
    paddingTop: ESPACIO[4],
  },
  destacado: {
    ...estiloTipografico('concepto.texto'),
    fontWeight: 600,
    color: TINTA.negra,
  },
})

/** Una fila de importe: rótulo a la izquierda, cifra a la derecha. */
export interface FilaImporte {
  readonly etiqueta: string
  /** El importe YA formateado, con divisa y signo. Este componente no calcula. */
  readonly importe: string
}

export interface RielImportesProps {
  /** Desglose por origen. Sólo la Cotización lo compone. */
  readonly subtotales?: readonly FilaImporte[]
  /** Rótulo del total: `Total` o `Total estimado`. Lo redacta el formato. */
  readonly rotuloTotal: string
  /** Nombre largo de la divisa: `MXN · Pesos mexicanos`. Colapsa si no viene. */
  readonly divisa?: string
  readonly total: string
  /** Anticipo recibido, con su signo. Sólo el Recibo. Colapsa. */
  readonly anticipo?: FilaImporte
  /** Saldo pendiente. Colapsa con el anticipo: sin él no hay saldo que mostrar. */
  readonly saldo?: FilaImporte
}

function Fila({
  fila,
  destacada = false,
}: {
  readonly fila: FilaImporte
  readonly destacada?: boolean
}): ReactElement {
  return (
    <View style={estilos.fila}>
      <Text style={[estilos.etiqueta, destacada ? estilos.destacado : {}]}>
        {fila.etiqueta}
      </Text>
      <Text style={[estilos.importe, destacada ? estilos.destacado : {}]}>
        {fila.importe}
      </Text>
    </View>
  )
}

/** 2.T · `RielImportes`. */
export default function RielImportes({
  subtotales,
  rotuloTotal,
  divisa,
  total,
  anticipo,
  saldo,
}: RielImportesProps): ReactElement {
  const haySubtotales = subtotales !== undefined && subtotales.length > 0

  return (
    <View wrap={false}>
      {haySubtotales ? (
        <View>
          {subtotales!.map((fila) => (
            <Fila key={fila.etiqueta} fila={fila} />
          ))}
        </View>
      ) : null}

      {/* Regla 3: el filete sólo existe si hay algo que separar del total. */}
      <View style={haySubtotales ? estilos.filete : {}}>
        <Text style={estilos.rotuloTotal}>{rotuloTotal.toUpperCase()}</Text>
        <View style={estilos.fila}>
          <Text style={estilos.divisa}>{divisa ?? ' '}</Text>
          <Text style={estilos.total}>{total}</Text>
        </View>
      </View>

      {anticipo === undefined ? null : (
        <View style={estilos.reglaSuave}>
          <Fila fila={anticipo} />
          {saldo === undefined ? null : <Fila fila={saldo} destacada />}
        </View>
      )}
    </View>
  )
}
