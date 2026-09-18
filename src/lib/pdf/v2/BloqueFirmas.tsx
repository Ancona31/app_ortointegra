/**
 * Sistema de documentos v3 — 2.L · **BloqueFirmas**. «El espacio donde se firma.»
 *
 * CAMBIOS v3 (brief 00 §6.1 y §6.2), y son los que cierran el defecto §2 —hojas
 * finales que sólo llevan la firma—:
 *
 *   `FIRMA.espacio`        61.6 → **44**, y con él la caja de la rúbrica
 *   rótulo del rol         obligatorio → **opcional**
 *   línea                  0.8 / 0.75 / 0.47 → **`FILETE.firma`, 0.75, única**
 *   aire línea → nombre    5 / 4 → **4**
 *   `firma.nombre`         11.5/16 · 11/15 · 10/14 → **10.5/14**
 *   alto del bloque        105.4 → **72.75** sin rol · **83.75** con rol
 *
 * ⚠ **LAS TRES CALIBRACIONES SE UNIFICAN EN UNA Y `Lamina` SALE DE LA FIRMA DE
 * PROPS.** `CalibracionFirma`, `calibracionDeLamina()` y las seis reglas de estilo
 * `*Medida` / `*Honorarios` se retiran enteras. Si alguien vuelve a introducirlas,
 * vuelve el problema que resolvían —dos láminas midiendo la misma pieza distinto— que
 * en v3 no existe porque hay una sola composición.
 *
 * ⚠ **EL ROL NO SE COMPONE EN LA CELDA DEL MÉDICO, EN NINGUNO DE LOS NUEVE
 * FORMATOS.** Su nombre y sus cédulas van bajo la línea y eso ya dice de quién es la
 * firma; el rótulo `FIRMA Y SELLO DEL MÉDICO` encima era redundante y costaba 11 pt
 * en el único bloque del sistema que no puede partirse. Sí se compone en las celdas
 * de paciente, familiar o responsable y testigo, cuya línea puede ir en blanco: ahí
 * el rótulo es lo único que dice quién firma.
 *
 * LO QUE NO CAMBIA: la regla 1 —el alto de la firma no depende del hueco sobrante; si
 * no caben todas se reparten en dos hojas, nunca se comprimen—, el `wrap={false}` de
 * cada celda (regla 3), el hueco de retícula (`null`), el renglón de nombre que se
 * reserva siempre, el renglón ÚNICO de credenciales unido con la raya del sistema, y
 * las dos ranuras `sello` y `anadido` con su orden.
 */

import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import {
  CIERRE,
  ESPACIO,
  FILETE,
  RUBRICA,
  TINTA,
  estiloTipografico,
  type Peso,
} from './tokens'

/** La raya del sistema, la misma con la que 2.B une las cédulas. */
const SEPARADOR_CREDENCIALES = ' · '

export interface Firma {
  /**
   * Qué firma esta persona: `Paciente`, `Testigo 1`, `Familiar o responsable`.
   * Se compone en versalita aquí; no lo pases ya en mayúsculas.
   *
   * ⚠ **OPCIONAL EN v3, Y ERA OBLIGATORIO.** Sin él la celda mide 72.75 en vez de
   * 83.75 y empieza directamente por el espacio de escritura. Es lo que compone la
   * celda del médico en los nueve formatos. Ver la cabecera.
   */
  readonly rol?: string
  /**
   * Nombre de quien firma. **Puede faltar y su renglón NO colapsa**: la firma del
   * paciente de II.6 se compone sin nombre a propósito —la escribe él en Admisión— y
   * colapsar el renglón dejaría dos firmas vecinas de alto distinto y quitaría el
   * sitio donde se escribe.
   *
   * Que el renglón no colapse no significa que la celda se componga siempre: **si la
   * celda existe lo decide el formato**, que es el único que sabe a quién se le pidió
   * firmar. Un formato con firmantes opcionales pasa `null` en el hueco. Ver `CeldaFirma`.
   */
  readonly nombre?: string
  /**
   * Peso del nombre, cuando el formato lo compone por debajo del 600 del rol. Un
   * consumidor: la celda de paciente o familiar de Internamiento, que va en 400.
   */
  readonly pesoNombre?: Peso
  /** Cédulas o parentesco. Se unen en UN renglón con la raya del sistema. */
  readonly credenciales?: readonly string[]
  /**
   * Trazo capturado del médico, ya normalizado a PNG o JPG por quien llama (I.3.8).
   * Los demás firmantes firman a mano sobre la línea (regla 5).
   */
  readonly rubrica?: string
  /**
   * Lo que cuelga bajo las credenciales, compuesto por el FORMATO. Un consumidor: el
   * campo `Parentesco con el paciente` de la celda de familiar del Consentimiento,
   * que no es una credencial sino un dato que se llena a pluma después de firmar.
   *
   * ⚠ **NO ES UN ATAJO PARA METER RENGLONES DE IDENTIFICACIÓN.** Lo que entre por
   * aquí **no lo cuenta `altoBloqueFirma()`**, así que el `minPresenceAhead` del
   * formato se queda corto en lo que mida. Quien lo use tiene que sumarlo a mano al
   * valor de la tabla del §9.2 del brief. Este componente pone el aire —6 pt— y nada más.
   */
  readonly anadido?: ReactNode
  /**
   * El pie de sello de trazabilidad, compuesto por el FORMATO. Va DESPUÉS de las
   * credenciales y ANTES de `anadido`. Mismo aviso de altura que `anadido`.
   */
  readonly sello?: ReactNode
}

/**
 * El hueco de retícula: una celda que reserva su columna y no compone ninguna firma.
 *
 * Existe porque una firma ausente no es una firma menos. Un consentimiento con un
 * solo testigo tiene DOS celdas, y la segunda vacía dice que ahí no firmó nadie; si
 * la retícula se cerrara, el papel diría que sólo se previó un testigo. Es contenido
 * normativo: describe qué afirma el papel, no cómo se ve.
 */
export type CeldaFirma = Firma | null

const estilos = StyleSheet.create({
  /** Una fila de celdas, alineadas por ARRIBA. Ver §6 del brief y el defecto §9.4. */
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  celda: {
    // Regla 3: una celda de firma no se parte entre hojas, nunca.
    flexShrink: 0,
  },
  rol: {
    ...estiloTipografico('firma.rol'),
  },
  espacio: {
    height: RUBRICA.alto,
    justifyContent: 'flex-end',
  },
  rubrica: {
    width: RUBRICA.ancho,
    height: RUBRICA.alto,
    objectFit: 'contain',
  },
  linea: {
    borderTopWidth: FILETE.firma,
    borderTopColor: TINTA.negra,
  },
  nombre: {
    ...estiloTipografico('firma.nombre'),
    marginTop: ESPACIO[4],
  },
  credencial: {
    ...estiloTipografico('firma.credencial'),
  },
  sello: {},
  anadido: {
    marginTop: 6,
  },
})

/** Una firma: rol opcional encima, espacio de escritura, línea, identificación. */
function UnaFirma({ firma }: { readonly firma: Firma }): ReactElement {
  return (
    <View>
      {firma.rol === undefined || firma.rol.trim() === '' ? null : (
        <Text style={estilos.rol}>{firma.rol.toUpperCase()}</Text>
      )}

      <View style={estilos.espacio}>
        {firma.rubrica === undefined ? null : (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={firma.rubrica} style={estilos.rubrica} />
        )}
      </View>

      <View style={estilos.linea} />

      {/*
        El renglón del nombre se reserva SIEMPRE, con o sin nombre: es la ranura que
        `altoBloqueFirma()` cuenta y es donde se escribe a mano cuando el formato deja
        la firma en blanco.
      */}
      <Text
        style={[
          estilos.nombre,
          firma.pesoNombre === undefined ? {} : { fontWeight: firma.pesoNombre },
        ]}
      >
        {firma.nombre ?? ' '}
      </Text>

      {/*
        UN SOLO RENGLÓN DE CREDENCIALES, SIEMPRE, unido con la raya del sistema. Se une
        aquí y no en el formato porque `altoBloqueFirma()` cuenta UN renglón: si el
        formato pudiera pasar dos, la fórmula mentiría y el flujo pagaría el error.
      */}
      <Text style={estilos.credencial}>
        {(firma.credenciales ?? []).join(SEPARADOR_CREDENCIALES) || ' '}
      </Text>

      {firma.sello === undefined ? null : <View style={estilos.sello}>{firma.sello}</View>}
      {firma.anadido === undefined ? null : <View style={estilos.anadido}>{firma.anadido}</View>}
    </View>
  )
}

export type BloqueFirmasProps =
  /**
   * Una celda. `ancho` lo declara el formato cuando su banda de cierre no reparte
   * como las demás —el Recibo, que pone el riel de importes a la derecha—. Sin él,
   * `CIERRE.izquierda` (274).
   */
  | { variante: 'simple'; firmas: readonly [Firma]; ancho?: number }
  /**
   * Dos celdas en la misma fila, de `CIERRE.pareja` (261). Cualquiera puede ser un
   * hueco. Es el máximo del Consentimiento y de la Denegación: los testigos van en
   * hoja propia (brief 00 §6.2).
   */
  | { variante: 'pareja'; firmas: readonly [CeldaFirma, CeldaFirma] }
  /** Tres celdas de `CIERRE.tercio` (168), en una sola fila. */
  | { variante: 'reticula'; firmas: readonly CeldaFirma[]; columnas?: number }

/** Parte las celdas en filas de `columnas`. Los huecos ocupan sitio como cualquier celda. */
function enFilas(
  firmas: readonly CeldaFirma[],
  columnas: number,
): readonly (readonly CeldaFirma[])[] {
  const filas: CeldaFirma[][] = []
  firmas.forEach((firma, indice) => {
    if (indice % columnas === 0) filas.push([firma])
    else filas[filas.length - 1]!.push(firma)
  })
  return filas
}

/** 2.L · `BloqueFirmas`. */
export default function BloqueFirmas(props: BloqueFirmasProps): ReactElement {
  if (props.variante === 'simple') {
    return (
      <View style={[estilos.celda, { width: props.ancho ?? CIERRE.izquierda }]} wrap={false}>
        <UnaFirma firma={props.firmas[0]} />
      </View>
    )
  }

  const columnas = props.variante === 'pareja' ? 2 : (props.columnas ?? 3)
  const ancho = columnas === 2 ? CIERRE.pareja : CIERRE.tercio
  const filas = enFilas(props.firmas, columnas)

  return (
    <View>
      {filas.map((fila, indiceFila) => (
        <View
          key={indiceFila}
          style={[estilos.fila, indiceFila === 0 ? {} : { marginTop: ESPACIO[16] }]}
        >
          {fila.map((celda, indiceCelda) => (
            <View
              key={indiceCelda}
              style={[
                estilos.celda,
                { width: ancho },
                indiceCelda === 0 ? {} : { marginLeft: CIERRE.medianil },
              ]}
              wrap={false}
            >
              {/* El hueco reserva su columna y no compone nada. Ver `CeldaFirma`. */}
              {celda === null ? null : <UnaFirma firma={celda} />}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
