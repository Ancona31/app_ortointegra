/**
 * Sistema de documentos v3 — 2.G · **EntradaNumerada**. «El ítem de lista del
 * sistema. Base de Receta, Plan de Suplementación, Imagenología y Laboratorio.»
 *
 * ── UNA SOLA CALIBRACIÓN, Y ERAN CUATRO (defecto §8) ────────────────────────
 *
 * v2 tenía `normal`, `compacta`, `estudio`, `medicamento` y `suplemento`: cinco
 * juegos de cuerpos para la misma pieza, con doce roles tipográficos detrás. El
 * resultado medido es el defecto §8 del diagnóstico —densidad incoherente dentro del
 * mismo arquetipo—: un estudio de laboratorio se componía a 9/11.5 y un medicamento a
 * 12/16, y los dos son un renglón de lista en una solicitud de la misma consulta.
 *
 * En v3 hay **una** calibración y las diferencias entre formatos son **ranuras que se
 * montan o no**:
 *
 *     número        `entrada.numero`      11/14, 600, acento        siempre
 *     ancla         `entrada.ancla`       11/14, 600, −0.005 em     siempre
 *     secundario    `entrada.secundario`  9.5/13, 400, tinta plena  opcional
 *     marca         2.H, bloque negativo                            opcional
 *     nota          `entrada.nota`        IBM Plex 9.5/13           opcional
 *     rótulo nota   `entrada.rotuloNota`  6.5/13, 600, versalita    opcional
 *
 * **EL GENÉRICO VA EN TINTA PLENA Y NO ES UNA ELECCIÓN** (regla 5): la denominación
 * genérica es el único campo obligatorio por normativa y no puede componerse como
 * dato de segunda. Por eso `entrada.secundario` es `tinta.negra` aunque en
 * Imagenología ese mismo renglón sean las proyecciones.
 *
 * **EL RÓTULO DE LA NOTA VA A 13 Y NO A 16** — cierra el defecto §9.2: el `INDICACIÓN`
 * colgado de Imagenología llevaba el interlineado de otro rol y no alineaba con la
 * primera línea del texto que rotula.
 *
 * ── LA REGLA VA ARRIBA Y LA PRIMERA NO LA LLEVA ─────────────────────────────
 *
 * Regla 3, sin cambio: `FILETE.regla` en `TINTA.reglaFila` como borde SUPERIOR, y la
 * primera entrada se la ahorra porque encima tiene el filete de la cabecera de lista.
 * Así la última entrada no arrastra ninguna debajo y `CierreEntradas` cierra la lista
 * donde de verdad acaba.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import {
  CAJA,
  ESPACIO,
  FILETE,
  RETICULA,
  TINTA,
  estiloTipografico,
  type AcentoResuelto,
  SIN_ENCOGER,
} from './tokens'

/**
 * `APUESTA` — el aire interior de la entrada. La calibración de la lámina mide la
 * fila completa, no sus rellenos: con 6 arriba y 6 abajo, una entrada de tres ranuras
 * mide `0.5 + 6 + 14 + 13 + 13 + 6` = **52.5 pt** y una de dos, 39.5. Si al render la
 * lista sale más suelta o más apretada que el PNG de referencia, este par es lo
 * primero que hay que mirar: el resto de la fila son interlineados de rol y no se toca.
 */
const AIRE = { superior: ESPACIO[6], inferior: ESPACIO[6] } as const

const estilos = StyleSheet.create({
  entrada: {
    flexDirection: 'row',
    paddingTop: AIRE.superior,
    paddingBottom: AIRE.inferior,
    // Regla 2: una entrada no se parte entre hojas. Su número y su pauta viajan juntos.
    flexShrink: SIN_ENCOGER,
  },
  regla: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.reglaFila,
  },
  riel: {
    width: RETICULA.riel,
    flexShrink: SIN_ENCOGER,
  },
  /**
   * ⚠⚠ **ANCHO DECLARADO, Y NO `flexGrow` + `flexShrink` + `minWidth: 0`.**
   *
   * En este motor un `Text` NO recibe su ancho del reparto flex: Yoga lo mide por su
   * ancho natural y le deja componer con el del PADRE, no con el de su celda. Medido: la
   * justificación de un suplemento y los párrafos justificados del Consentimiento se
   * imprimían con la medida de la caja entera arrancando ya sangrados, o sea **36 pt
   * fuera del margen derecho**, casi hasta el borde del papel.
   *
   * Es el mismo defecto que se vio en la banda de pie y en la fila de título, y la
   * misma cura: declarar la cifra. DERIVADO — si el riel cambia, la caja lo sigue.
   */
  caja: {
    width: CAJA.ancho - RETICULA.riel,
    flexShrink: SIN_ENCOGER,
  },
  /**
   * ⚠⚠ **`flexShrink: 0` ES I.3.4, NO UNA PRECAUCIÓN.**
   *
   * Los hijos de una columna se encogen por defecto en este motor: cuando el contenido
   * de una hoja pasa del alto de la caja por poco, Yoga NO lo manda a la hoja siguiente,
   * **lo aprieta**. Medido sobre 24 entradas mínimas de Imagenología: el paso bajaba de
   * 26.5 a 26.182 en TODAS a la vez, 0.318 por entrada, sin que nada lo dijera. Eso es
   * exactamente lo que I.3.4 prohíbe, y se ve: la lista sale más apretada en la hoja que
   * va llena que en la que va suelta.
   *
   * Lo declaran las tres piezas que componen la fila —ancla, secundario y nota—, porque
   * el reparto flexible se aplica a cada hija de la columna y basta que una ceda para
   * que la entrada mida distinto. El `flexShrink: 1` de `ancla` y `nota` es del eje
   * HORIZONTAL, dentro de su fila, y ése sí tiene que ceder.
   */
  filaAncla: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: SIN_ENCOGER,
  },
  ancla: {
    ...estiloTipografico('entrada.ancla'),
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  marca: {
    flexShrink: SIN_ENCOGER,
    marginLeft: ESPACIO[8],
  },
  secundario: {
    ...estiloTipografico('entrada.secundario'),
    flexShrink: SIN_ENCOGER,
  },
  /**
   * El rótulo colgado va como TRAMO DENTRO del `Text` de la nota, no como hermano en
   * una fila.
   *
   * ⚠ **Y NO ES UNA SIMPLIFICACIÓN: ES LO QUE ALINEA LAS DOS BASES.** Como hermanos en
   * un `flexDirection: 'row'`, cada uno se coloca por el ALTO de su propia línea, y con
   * cuerpos distintos —6.5 el rótulo, 9.5 la nota— el `INDICACIÓN` de Imagenología
   * salía flotando 3 pt por encima del renglón que rotula. `alignItems: 'baseline'` no
   * lo arregla: el motor no resuelve la base de un `Text` hermano. Dentro del mismo
   * `Text` los dos tramos comparten renglón y base por construcción.
   *
   * Igualar el interlineado a 13 cierra la otra mitad del defecto §9.2.
   */
  rotuloNota: {
    ...estiloTipografico('entrada.rotuloNota'),
  },
  nota: {
    ...estiloTipografico('entrada.nota'),
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  cierre: {
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cabeceraTitulo: {
    ...estiloTipografico('titulo.seccion'),
  },
  cabeceraRotulo: {
    ...estiloTipografico('etiqueta'),
    color: TINTA.etiqueta,
    marginLeft: ESPACIO[10],
    flexShrink: 1,
    minWidth: 0,
    maxLines: 1,
    textOverflow: 'ellipsis',
  },
  aireCabecera: { height: 3 },
})

export interface EntradaNumeradaProps {
  /**
   * El ordinal en el DOCUMENTO, no en la hoja: una lista que sigue en la hoja 2
   * empieza por `07`. Se compone a dos dígitos.
   */
  readonly numero: number
  /** `true` en la primera del documento: es la que no lleva regla arriba. */
  readonly primera: boolean
  /** Lo que identifica la entrada. Lo redacta el formato. */
  readonly ancla: string
  /** Segundo renglón: genérico, proyecciones. Colapsa solo. */
  readonly secundario?: string
  /** La marca de 2.H —vía, urgente—, ya construida por el formato. Colapsa sola. */
  readonly marca?: ReactNode
  /** Indicación o pauta. Colapsa sola. */
  readonly nota?: string
  /** Rótulo colgado de la nota, en versalita. Uno lo usa: `Indicación` de Imagenología. */
  readonly rotuloNota?: string
  /**
   * `minPresenceAhead` de esta entrada, en pt. Lo declara el formato y **sólo en la
   * última**: es el mecanismo que evita que la banda de cierre viaje sola cuando el
   * formato no tiene bloque de cierre detrás de la lista (Imagenología, Receta sin
   * recomendaciones). Ver brief 00 §9.2 — es un techo, no una reserva.
   */
  readonly presencia?: number
  readonly acento: AcentoResuelto
}

/** 2.G · `EntradaNumerada`. */
export default function EntradaNumerada({
  numero,
  primera,
  ancla,
  secundario,
  marca,
  nota,
  rotuloNota,
  presencia,
  acento,
}: EntradaNumeradaProps): ReactElement {
  const hayNota = nota !== undefined && nota.trim() !== ''

  return (
    <View
      style={[estilos.entrada, primera ? {} : estilos.regla]}
      wrap={false}
      minPresenceAhead={presencia}
    >
      <View style={estilos.riel}>
        <Text style={{ ...estiloTipografico('entrada.numero', acento) }}>
          {String(numero).padStart(2, '0')}
        </Text>
      </View>

      <View style={estilos.caja}>
        <View style={estilos.filaAncla}>
          <Text style={estilos.ancla}>{ancla}</Text>
          {marca === undefined ? null : <View style={estilos.marca}>{marca}</View>}
        </View>

        {secundario === undefined || secundario.trim() === '' ? null : (
          <Text style={estilos.secundario}>{secundario}</Text>
        )}

        {!hayNota ? null : (
          <Text style={estilos.nota}>
            {rotuloNota === undefined ? null : (
              <Text style={estilos.rotuloNota}>{`${rotuloNota.toUpperCase()}   `}</Text>
            )}
            {nota}
          </Text>
        )}
      </View>
    </View>
  )
}

export interface CabeceraListaProps {
  /** El sustantivo de la lista, en capitalización de oración. Se compone en versalita. */
  readonly titulo: string
  /**
   * Rótulo a la derecha del sustantivo, en el mismo renglón. Uno lo usa:
   * `Dosis calculada para 72.5 kg` de Suplementación, que colapsa con el peso.
   */
  readonly rotulo?: string
  readonly acento: AcentoResuelto
}

/**
 * LA CABECERA DE LA LISTA, que en v3 **vive en el flujo y no en el encabezado de
 * hoja** (defecto §3.1). La compone el formato justo antes de su primera entrada.
 *
 * Es sustantivo + rótulo opcional + `FileteGruesoFino` medida `lista`. Con la cabecera
 * en el encabezado fijo, una hoja de continuación rotulaba una lista que no
 * continuaba: el bloque de notas del Laboratorio caía bajo un `SOLICITUD DE
 * LABORATORIO · CONTINUACIÓN` sin nada debajo.
 */
export function CabeceraLista({ titulo, rotulo, acento }: CabeceraListaProps): ReactElement {
  return (
    // El bloque no se parte: un filete de cabecera al pie de hoja no rotula nada.
    <View wrap={false}>
      <View style={estilos.cabecera}>
        <Text style={estilos.cabeceraTitulo}>{titulo.toUpperCase()}</Text>
        {rotulo === undefined || rotulo.trim() === '' ? null : (
          <Text style={estilos.cabeceraRotulo}>{rotulo}</Text>
        )}
      </View>
      <View style={estilos.aireCabecera} />
      <FileteLista acento={acento} />
    </View>
  )
}

/** El filete de la cabecera: segmento de 64 × 2 en acento sobre la línea fina negra. */
function FileteLista({ acento }: { readonly acento: AcentoResuelto }): ReactElement {
  return (
    <View style={{ position: 'relative', height: FILETE.acento + FILETE.fino }}>
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderBottomWidth: FILETE.fino,
          borderBottomColor: TINTA.negra,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 64,
          height: FILETE.acento,
          backgroundColor: acento.base,
        }}
      />
    </View>
  )
}

/** El filete que cierra la lista bajo la última entrada. */
export function CierreEntradas(): ReactElement {
  return <View style={estilos.cierre} />
}
