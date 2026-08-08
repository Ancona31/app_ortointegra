/**
 * Sistema de documentos v2 — componente 2.L · `BloqueFirmas`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.L y I.1.9. Transcripción, no
 * diseño.
 *
 * Propósito: el espacio donde se firma. De 1 a 6 firmas por hoja.
 *
 * REGLA 1 — EL ALTO DE LA FIRMA NO DEPENDE DE LA HOJA
 *
 * `firma.espacio` son 77 pt **en las tres variantes**. Lo que cambia entre ellas
 * es cuántas firmas caben en la fila, no el alto de la firma. Si no caben todas
 * en una hoja se reparten en dos; **nunca se comprimen** (I.3.4). Si alguna vez
 * ves aquí un alto que sale de una resta contra el hueco disponible, es el tramo
 * de 28 pt volviendo, y quedó retirado en `CONCILIA D37`.
 *
 * ANATOMÍA, Y POR QUÉ EL ROL VA ENCIMA DE LA LÍNEA
 *
 *     firma.rol         versalita, ENCIMA de la línea            11 pt
 *     firma.espacio     77 pt de espacio de escritura            77
 *     filete.fino       la línea                                  0.8
 *     espacio.5         margen superior del nombre                5
 *     firma.nombre      bajo la línea                            16
 *     firma.credencial  UN renglón, unido con la raya            11
 *                                                                ──── 120.8
 *
 * La suma es `firma.bloque.alto(rol)` de I.1.9 —**120.8 pt**— y está implementada
 * como fórmula en `altoBloqueFirma()`. Los 130.8 pt del médico tratante que
 * declaraba el spec contaban un renglón de cédula de más. Este
 * componente no la recalcula: **compone las mismas ranuras en el mismo orden**,
 * así que el alto sale solo. La línea se dibuja como borde de una caja sin alto
 * propio para que los 0.8 pt del filete se sumen a los 77 y no se coman de ellos.
 *
 * REGLA 4 — NUNCA SE SOLAPA CON `PieDocumento`
 *
 * Es el bug §8.1 del sistema viejo, presente en las dos páginas de Internamiento
 * y en Consentimiento. **No se resuelve aquí ni podría:** este bloque va en el
 * flujo del contenido y el pie va anclado al papel. Lo que lo garantiza es que la
 * página declare `paddingBottom: margen.inferior`, que reserva los 36 + 16 + 16
 * pt donde vive la banda. Ver la cabecera de 2.M.
 *
 * REGLA 2 — ANCLADO AL FINAL DEL CONTENIDO, NO AL PIE DE LA CAJA
 *
 * Por eso este componente **no lleva `position: absolute` ni `marginTop: auto`**:
 * va en el flujo, detrás de lo último que haya. El aire sobrante queda debajo de
 * la rúbrica, no encima (I.3.4). Si alguna vez alguien lo empuja al fondo de la
 * caja «para que quede bonito», está invirtiendo esa regla.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { CAJA, CIERRE, ESPACIO, FILETE, FIRMA, TINTA, estiloTipografico } from './tokens'

/**
 * Geometría interna de las variantes en fila, de la ficha de 2.L.
 *
 * `COINCIDENCIA` — el medianil de 24 pt vale lo mismo que `cierre.medianil`, y no
 * es el mismo valor: aquel separa las dos columnas de la fila de cierre —una de
 * 216 y otra de 246—, este separa dos celdas iguales de firma. No se fusionan.
 *
 * El padding de celda `14 0 4` es lo que separa las FILAS de una retícula: 14 pt
 * sobre cada celda y 4 bajo ella, 18 entre dos filas. La ficha lo declara solo
 * para `retícula` y aquí se respeta — en `pareja` hay una sola fila y no hay nada
 * que separar (anexo A, P2-27).
 */
const GEOMETRIA = {
  medianil: 24,
  celda: { superior: 14, inferior: 4 },
} as const

/**
 * La raya del sistema con sus dos espacios: la misma que separa las tres zonas de
 * la banda de pie (2.M). Une las credenciales de un firmante en el renglón único
 * que declara `FIRMA_RENGLONES`. Ver la nota junto al render.
 */
const SEPARADOR_CREDENCIALES = ' · '

/** Dos columnas iguales sobre la caja, con su medianil. */
const ANCHO_CELDA = (CAJA.ancho - GEOMETRIA.medianil) / 2

const estilos = StyleSheet.create({
  /**
   * La variante `simple` ocupa la columna IZQUIERDA de la fila de cierre, que es
   * donde vive la caja de firma en los ocho formatos (I.1.3). **No es
   * `manuscrito.ancho`**, aunque mida lo mismo: ver la nota de `cierre.izquierda`.
   *
   * ⚠ **ESTABA A LA DERECHA Y ERA UN DEFECTO DE CHASIS.** I.1.3 declaraba «la caja
   * de firma vive en su columna derecha» y aquí se cableaba con `flex-end`. Las
   * láminas la ponen a la IZQUIERDA, con la cifra al lado —B.3 §2 y B.4: «firma a
   * la izquierda (246 pt) · QR y folio de verificación a la derecha»—. Los dos
   * nombres de `cierre.*` estaban cambiados y quedan corregidos en la capa de
   * tokens; esto es la otra mitad del mismo defecto.
   */
  cajaSimple: {
    width: CIERRE.izquierda,
    alignSelf: 'flex-start',
  },
  fila: {
    flexDirection: 'row',
  },
  celda: {
    width: ANCHO_CELDA,
  },
  celdaConMedianil: {
    marginLeft: GEOMETRIA.medianil,
  },
  /** Solo en `retícula`: es lo que separa una fila de la siguiente. */
  celdaEnReticula: {
    paddingTop: GEOMETRIA.celda.superior,
    paddingBottom: GEOMETRIA.celda.inferior,
  },
  /** Versalita: mayúsculas con tracking, como toda versalita del sistema. */
  rol: { ...estiloTipografico('firma.rol') },
  /**
   * El espacio de escritura. Caja vacía de `firma.espacio`: es donde se firma a
   * mano, o donde se estampa el trazo capturado del médico (regla 5).
   */
  espacio: {
    height: FIRMA.espacio,
    justifyContent: 'flex-end',
  },
  /** La rúbrica no se estira: se apoya en la línea y conserva su proporción. */
  rubrica: {
    height: FIRMA.espacio,
    objectFit: 'contain',
    objectPositionX: '0%',
  },
  /**
   * La línea. Caja sin alto propio con borde inferior, para que el filete SUME sus
   * 0.8 pt a los 77 del espacio en vez de comérselos por dentro — que es como está
   * escrita la fórmula de I.1.9.
   *
   * `filete.fino`, que es lo que declaran A.12 y B.1 §5. Una generación anterior lo
   * bajó a `filete.regla` para que el bloque cuadrara en los 119.45 pt medidos en la
   * lámina: **manda el valor declarado, no el que cuadra la suma.**
   */
  linea: {
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  /**
   * `espacio.5`, no `espacio.4`. Es el margen superior del nombre que mide la
   * lámina, y el mismo sumando que usa `altoBloqueFirma()`.
   */
  nombre: {
    ...estiloTipografico('firma.nombre'),
    marginTop: ESPACIO[5],
  },
  credencial: { ...estiloTipografico('firma.credencial') },
})

export interface Firma {
  /**
   * Qué firma esta persona: `Firma y sello del médico`, `Paciente`, `Testigo 1`.
   * Se compone en versalita aquí; no lo pases ya en mayúsculas.
   */
  readonly rol: string
  /**
   * Nombre de quien firma. **Puede faltar y su renglón NO colapsa**: un testigo
   * sin nombre deja su línea —y el renglón de abajo— para llenarse a mano
   * (II.7 §5, NOM-004). Colapsarlo dejaría dos firmas vecinas de alto distinto y
   * quitaría el sitio donde se escribe el nombre.
   */
  readonly nombre?: string
  /** Cédulas o parentesco. El inventario por rol lo declara I.1.9. */
  readonly credenciales?: readonly string[]
  /**
   * Trazo capturado del médico, ya normalizado a PNG o JPG por quien llama
   * (I.3.8). Los demás firmantes firman a mano sobre la línea (regla 5).
   */
  readonly rubrica?: string
}

export type BloqueFirmasProps =
  /** Una firma, en la columna derecha de la fila de cierre. */
  | { variante: 'simple'; firmas: readonly [Firma] }
  /** Dos firmas en la misma fila. */
  | { variante: 'pareja'; firmas: readonly [Firma, Firma] }
  /** De 3 a 6 firmas, en dos columnas. */
  | { variante: 'reticula'; firmas: readonly Firma[] }

/** Una firma: rol encima, espacio de escritura, línea, y la identificación. */
function UnaFirma({ firma }: { firma: Firma }): ReactElement {
  return (
    <View>
      <Text style={estilos.rol}>{firma.rol.toUpperCase()}</Text>

      <View style={estilos.espacio}>
        {firma.rubrica === undefined ? null : (
          // `Image` es la primitiva de @react-pdf/renderer, no un `<img>` de
          // HTML: no admite `alt` y su salida es un PDF, no un árbol accesible.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={firma.rubrica} style={estilos.rubrica} />
        )}
      </View>

      <View style={estilos.linea} />

      {/*
        El renglón del nombre se reserva SIEMPRE, con o sin nombre: es la ranura
        que la fórmula de I.1.9 cuenta y es donde se escribe a mano cuando el
        formato deja la firma en blanco.
      */}
      <Text style={estilos.nombre}>{firma.nombre ?? ' '}</Text>

      {/*
        UN SOLO RENGLÓN DE CREDENCIALES, SIEMPRE.

        La lámina imprime `Céd. Prof. 9552456 · Céd. Esp. 12085805` en una línea
        (B.1 §4), separadas por la raya del sistema. La versión anterior mapeaba el
        arreglo a un `Text` por elemento y sacaba dos renglones donde la lámina tiene
        uno: **11 pt de más en el bloque**, y una de las tres causas por las que 18
        estudios no cabían en una hoja.

        Se une AQUÍ y no en el formato porque `FIRMA_RENGLONES` declara un renglón de
        credencial por rol y `altoBloqueFirma()` cuenta ese renglón: si el formato
        pudiera pasar dos, la fórmula mentiría y el motor de flujo pagaría el error.
        Unir con un solo elemento es idempotente, así que los roles que ya traían una
        credencial no cambian.
      */}
      <Text style={estilos.credencial}>
        {(firma.credenciales ?? []).join(SEPARADOR_CREDENCIALES) || ' '}
      </Text>
    </View>
  )
}

/** Parte las firmas en filas de dos, que es la retícula declarada. */
function enParejas(firmas: readonly Firma[]): readonly (readonly Firma[])[] {
  const filas: Firma[][] = []
  firmas.forEach((firma, indice) => {
    if (indice % 2 === 0) filas.push([firma])
    else filas[filas.length - 1].push(firma)
  })
  return filas
}

/** 2.L · `BloqueFirmas`. */
export default function BloqueFirmas(props: BloqueFirmasProps): ReactElement {
  // Regla 3: `break-inside: avoid`. Un bloque de firmas no se parte entre hojas;
  // es uno de los cuatro bloques indivisibles de 2.N (`CONCILIA D44`).
  if (props.variante === 'simple') {
    return (
      <View style={estilos.cajaSimple} wrap={false}>
        <UnaFirma firma={props.firmas[0]} />
      </View>
    )
  }

  const reticula = props.variante === 'reticula'

  return (
    <View wrap={false}>
      {enParejas(props.firmas).map((fila) => (
        <View key={fila[0].rol} style={estilos.fila}>
          {fila.map((firma, columna) => (
            <View
              key={firma.rol}
              style={[
                estilos.celda,
                columna === 0 ? {} : estilos.celdaConMedianil,
                reticula ? estilos.celdaEnReticula : {},
              ]}
            >
              <UnaFirma firma={firma} />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
