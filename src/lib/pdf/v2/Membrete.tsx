/**
 * Sistema de documentos v3 — 2.B · **Membrete**. «Identidad del médico y del
 * consultorio donde se emite.»
 *
 * Alto total del bloque: **64.8 pt**, y es la suma de sus piezas, no una constante:
 *
 *     fila superior (la fija el panel)        40      `PANEL_DIAMETRO`
 *     aire                                     6      `transicion.membreteFilete`
 *     filete grueso + fino                     2.8    `FILETE.acento` + `FILETE.fino`
 *     aire                                     5      `transicion.membreteLineaFina`
 *     banda de dirección                      11      un renglón de `medico.credencial`
 *                                           ─────
 *                                            64.8
 *
 * Más `transicion.membreteCierre` (10) hasta la fila de título: **74.8** desde el
 * margen. En v2 esa suma iba de 116 a 130 según la lámina.
 *
 * ── LOS TRES CAMBIOS, Y EL PRIMERO ES UN DEFECTO CERRADO ─────────────────────
 *
 * 1. **LA BANDA DE DIRECCIÓN YA NO SE SOLAPA CONSIGO MISMA** (defecto §1). Era el
 *    único defecto del diagnóstico que se podía desplegar solo, y son tres claves en
 *    un `View` fila: `flexGrow: 1` + `flexShrink: 1` + `minWidth: 0` + recorte por
 *    elipsis en el domicilio, y `flexShrink: 0` en la zona derecha. Sin `minWidth: 0`
 *    Yoga no deja encoger por debajo del ancho natural del texto y el domicilio
 *    empuja al teléfono fuera de la caja; sin `flexShrink: 0` a la derecha, el
 *    teléfono es el que encoge y se parte. **Con las tres, el domicilio se recorta y
 *    el teléfono nunca se imprime encima.**
 *
 * 2. **UN SOLO RENGLÓN, Y ERAN DOS EN CINCO LÁMINAS.** Las cédulas se unen con la
 *    raya del sistema a la zona derecha del renglón único, y **la universidad deja de
 *    imprimirse en el membrete de los nueve formatos**. Decisión de Angel: no la pide
 *    ninguna normativa que este documento tenga que cumplir en el membrete, y costaba
 *    12 pt en todas las hojas 1 del sistema.
 *
 * 3. **`Lamina` SALE DE LA FIRMA DE PROPS.** Las ocho láminas medían este bloque con
 *    seis espaciadores de cierre distintos (10, 12, 14, 16, 20, 24, 26) y dos
 *    composiciones de banda. En v3 hay una, `transicion.membreteCierre`.
 *
 * ── LA VARIANTE `continuacion` SE RETIRA DE AQUÍ ─────────────────────────────
 *
 * El encabezado de continuación de v3 no lleva membrete: son 37 pt de rótulo, filete
 * y línea de paciente, y **el nombre del médico a 14 / 18 se retira** porque lo
 * identifica esa línea (brief 00 §8). Lo compone `EncabezadoHoja`, que es quien sabe
 * en qué hoja está. Este archivo se queda con una sola composición, que es la razón
 * por la que ya no necesita discriminante de variante.
 *
 * ── EL CUERPO DEL NOMBRE DEJA DE CALCULARSE, Y ESO ES UNA DECISIÓN ───────────
 *
 * `cuerpoDelNombre()`, `NOMBRE_MEMBRETE` y `metricasNombre.ts` **quedan sin
 * consumidor**. El cálculo existía porque un nombre largo a 26 pt en 412 pt de ancho
 * partía en dos renglones y empujaba 19 pt a los nueve formatos. En v3 los dos
 * términos del problema se movieron: el rol baja a **15** y el ancho disponible sube
 * a **488** (`540 − 40 − 12`).
 *
 * Medido con la cadena que obligó a escribir aquel algoritmo —«Dra. Mónica Alexandra
 * Arámbula Sánchez», que compone 489 pt a 26—: a 15 pt compone `489 × 15 / 26` =
 * **282 pt**, el 58 % del ancho disponible. El caso peor conocido cabe con 206 pt de
 * sobra, así que el algoritmo no tiene nada que reducir.
 *
 * ⚠ **Y NO PUEDE TENERLO, PORQUE SU INTERVALO SE CERRÓ.** `NOMBRE_MEMBRETE` deriva
 * el techo del cuerpo de `medico.nombre` (15) y el piso del de `titulo.documento`
 * (15): con los dos roles en 15, `techo === piso` y la función devolvería siempre la
 * misma cifra. Dejarla enchufada daría la impresión de que sigue habiendo reducción.
 * Se compone **15 fijo con `maxLines: 1` + elipsis**, que es el respaldo que el
 * propio brief declara para el nombre excepcional. Los tres archivos se conservan sin
 * tocar —no se borra un generado— y la decisión queda en `dudas.md` §3.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import FileteGruesoFino from './FileteGruesoFino'
import PanelCircular, {
  PANEL_DIAMETRO,
  PANEL_MEDIANIL,
  type PanelCircularProps,
} from './PanelCircular'
import { CAJA, TRANSICION, estiloTipografico, type AcentoResuelto, SIN_ENCOGER } from './tokens'

/** La raya del sistema, la misma con la que 2.L une las credenciales. */
const SEPARADOR = ' · '

/**
 * Datos del médico que el membrete imprime. Ninguno es opcional (regla 2): el
 * membrete no adivina, y quien no tenga el dato pasa la cadena vacía — que es lo que
 * hace `adaptadores/comun.tsx` leyendo un perfil incompleto.
 *
 * ⚠ **`universidad` SIGUE EN EL TIPO Y YA NO SE IMPRIME.** No se retira del tipo
 * porque `PdfMedicoData` la trae y los nueve adaptadores la leen hoy; quitarla de
 * aquí obligaría a tocar los nueve para no pasar nada. Queda declarada y sin
 * consumidor, con este aviso. Ver `dudas.md` §9.
 */
export interface MedicoMembrete {
  readonly nombre: string
  readonly especialidad: string
  readonly universidad: string
  readonly cedulas: readonly string[]
}

/** Consultorio activo. Llega por prop: lo elige quien construye el documento (I.3.6). */
export interface ConsultorioMembrete {
  readonly domicilio: string
  /** Ya rotulado por el adaptador: `Tel. 55 0000 0000`. 2.B coloca, no rotula. */
  readonly telefono: string
}

export interface MembreteProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
}

/**
 * El ancho que le queda al nombre. DERIVADO, y con el panel `oculto` sube a la caja
 * entera: sin panel no se reserva su medianil (regla 4 de 2.A), y restarlo siempre
 * encogería el nombre de un membrete que no tiene marca.
 *
 * Hoy no lo consume nadie —el nombre va a cuerpo fijo—, pero se conserva porque es la
 * cifra contra la que se decidió ese cuerpo fijo. Ver la cabecera.
 */
export function anchoParaNombre(panelOculto: boolean): number {
  return panelOculto ? CAJA.ancho : CAJA.ancho - PANEL_DIAMETRO - PANEL_MEDIANIL
}

const estilos = StyleSheet.create({
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PANEL_DIAMETRO,
  },
  /**
   * El bloque del nombre. `flex: 1` con `minWidth: 0`: es el segundo y último hijo de
   * la fila, se queda con todo el sobrante, y el `minWidth` es lo que permite que el
   * recorte del nombre funcione en vez de desbordar.
   */
  identidad: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginLeft: PANEL_MEDIANIL,
  },
  nombre: {
    ...estiloTipografico('medico.nombre'),
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  especialidad: {
    ...estiloTipografico('medico.especialidad'),
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  aireFilete: { height: TRANSICION.membreteFilete },
  aireBanda: { height: TRANSICION.membreteLineaFina },
  banda: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  /** Ver el punto 1 de la cabecera. Las tres claves y el recorte van juntos. */
  domicilio: {
    ...estiloTipografico('medico.credencial'),
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  credenciales: {
    ...estiloTipografico('medico.credencial'),
    flexShrink: SIN_ENCOGER,
    marginLeft: 12,
    textAlign: 'right',
  },
  cierre: { height: TRANSICION.membreteCierre },
})

/** 2.B · `Membrete`. */
export default function Membrete({
  medico,
  consultorio,
  panel,
  acento,
}: MembreteProps): ReactElement {
  /**
   * La zona derecha de la banda: las cédulas y el teléfono, en ese orden, unidos con
   * la raya. Se filtra lo vacío antes de unir — con una sola pieza no queda la raya
   * suelta, que es el defecto que una plantilla dejaría.
   *
   * La universidad NO entra. Ver el punto 2 de la cabecera.
   */
  const derecha = [...medico.cedulas, consultorio.telefono]
    .filter((pieza) => pieza.trim() !== '')
    .join(SEPARADOR)

  return (
    <View>
      <View style={estilos.filaSuperior}>
        <PanelCircular {...panel} />
        <View style={estilos.identidad}>
          <Text style={estilos.nombre}>{medico.nombre}</Text>
          {/* Versalita del sistema: mayúsculas con tracking, no versalitas reales. */}
          <Text style={estilos.especialidad}>{medico.especialidad.toUpperCase()}</Text>
        </View>
      </View>

      <View style={estilos.aireFilete} />
      <FileteGruesoFino acento={acento} medida="principal" />
      <View style={estilos.aireBanda} />

      <View style={estilos.banda}>
        <Text style={estilos.domicilio}>{consultorio.domicilio}</Text>
        {derecha === '' ? null : <Text style={estilos.credenciales}>{derecha}</Text>}
      </View>

      <View style={estilos.cierre} />
    </View>
  )
}
