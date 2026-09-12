/**
 * Sistema de documentos v2 — componente 2.A · `PanelCircular`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.A. Transcripción, no diseño.
 *
 * Propósito: la marca del documento. Doble anillo con disco al velo del acento,
 * y dentro el logo del médico o su monograma.
 *
 * LAS CUATRO REGLAS DE LA FICHA
 *
 * 1. EL LOGO LLENA EL CÍRCULO INTERIOR Y SE RECORTA A ÉL, centrado y
 *    conservando su proporción. Aquí eso son dos cosas juntas:
 *    `objectFit: 'cover'` para escalar por el lado menor hasta cubrir, y
 *    `overflow: 'hidden'` sobre un contenedor con `borderRadius`, que es lo que
 *    recorta al círculo. Es el mismo mecanismo de recorte que v1 usa en
 *    `PdfHeader.tsx` desde su primera versión.
 *
 *    La ficha declaraba antes una «caja útil» de 33 × 19 pt y prohibía recortar;
 *    las dos cosas quedaron retiradas (anexo A, P2-1) porque dejaban el logo en
 *    un cuarto de la superficie del panel. No las repongas: `contain` aquí es el
 *    defecto, no la regla.
 * 2. El ráster llega NORMALIZADO desde el ingest del perfil. Este render no
 *    normaliza, no redimensiona y no convierte formatos: si el asset no sirve,
 *    quien llama pasa la variante `monograma`. Por eso `logo` es un `string` y
 *    no hay validación aquí — no es olvido, es la regla 2.
 * 3. EL PANEL APARECE SOLO EN LA PRIMERA HOJA. Es responsabilidad de quien lo
 *    instancia (2.B `Membrete`), no de este componente: repetirlo en hojas de
 *    continuación cuesta peso sin agregar identificación.
 * 4. El panel no se escala por hoja ni por cantidad de contenido. No hay ninguna
 *    prop de tamaño y no debe agregarse.
 *
 * `<Image>` de react-pdf solo acepta JPG, PNG o base64 (I.3.8). Nada de SVG
 * como archivo ni de GIF.
 *
 * Sin `'use client'` a propósito: es un módulo neutro, igual que `fonts.ts`. Lo
 * consume quien renderiza el PDF, que hoy es siempre el cliente.
 */

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { FUENTE, TINTA, type AcentoResuelto } from './tokens'

/**
 * Geometría de ESTE componente, extraída de la tabla de 2.A. Idéntica en los
 * ocho formatos y para todos los médicos.
 *
 * Los grosores de 1.5 y 0.5 pt NO son miembros de `filete.*`: I.1.6 los declara
 * explícitamente geometría interna de este componente y por eso viven aquí y no
 * en la capa de tokens. No los muevas a `FILETE`.
 *
 * El cuerpo de 19 pt del monograma tampoco es un rol de la escala tipográfica de
 * I.1.4, por la misma razón. Su `interlineado: 1` viene así de la ficha: es un
 * multiplicador, que es justo lo que react-pdf entiende por `lineHeight`.
 */
/**
 * Diámetro exterior del panel, en border-box.
 *
 * Se exporta porque 2.B lo RESTA para saber cuánto ancho le queda al nombre del
 * médico (ver `cuerpoDelNombre()` en `Membrete.tsx`). Escribir un 56 allí sería la
 * misma cifra en dos sitios, y el día que el panel cambie de tamaño el nombre se
 * seguiría midiendo contra el viejo.
 */
export const PANEL_DIAMETRO = 56

const GEOMETRIA = {
  diametroExterior: PANEL_DIAMETRO,
  anilloExterior: 1.5,
  diametroInterior: 47,
  anilloInterior: 0.5,
  monogramaCuerpo: 19,
  monogramaPeso: 600,
  monogramaInterlineado: 1,
} as const

/**
 * Desplazamiento del círculo interior dentro del exterior, medido desde el
 * contenido del anillo exterior: `(56 − 2×1.5 − 47) / 2 = 3`. Es la holgura de
 * 4.5 pt menos el grosor del anillo, no un número nuevo.
 *
 * Solo lo necesita el anillo interior repuesto por encima del logo, que va
 * posicionado en absoluto y por tanto no lo centra el flex.
 */
const CENTRADO_INTERIOR =
  (GEOMETRIA.diametroExterior - GEOMETRIA.anilloExterior * 2 - GEOMETRIA.diametroInterior) / 2

/**
 * HOLGURA ENTRE ANILLOS — 4.5 pt por lado. La ficha la declara y aquí NO se
 * escribe como número, porque es consecuencia de los dos diámetros:
 * `(56 − 47) / 2 = 4.5`. El centrado por flex la reparte sola.
 *
 * Yoga mide `width` en border-box, así que el anillo exterior de 1.5 pt vive
 * DENTRO del diámetro de 56: la caja de contenido queda en 53, el círculo
 * interior de 47 se centra con 3 pt por lado, y del borde exterior al interior
 * hay 1.5 + 3 = 4.5 pt. Sale exacto sin escribir la cifra en ninguna parte.
 */
const estilos = StyleSheet.create({
  exterior: {
    width: GEOMETRIA.diametroExterior,
    height: GEOMETRIA.diametroExterior,
    borderRadius: GEOMETRIA.diametroExterior / 2,
    borderWidth: GEOMETRIA.anilloExterior,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interior: {
    width: GEOMETRIA.diametroInterior,
    height: GEOMETRIA.diametroInterior,
    borderRadius: GEOMETRIA.diametroInterior / 2,
    borderWidth: GEOMETRIA.anilloInterior,
    borderColor: TINTA.reglaSuave,
    // Recorta al círculo lo que el logo derrame. Sin esto, `cover` desbordaría
    // el panel en cuadrado. Es el mecanismo de v1 (`PdfHeader.tsx`).
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * El anillo interior, repuesto ENCIMA del logo.
   *
   * react-pdf dibuja la imagen sobre el borde de su propio contenedor, así que
   * un logo que llena el círculo tapa el anillo de 0.5 pt. Sin esto el panel
   * perdería, solo en la variante `logo`, una de las dos medidas que la ficha
   * declara. Va después del contenido en el árbol: en PDF eso es «encima».
   */
  anilloInteriorEncima: {
    position: 'absolute',
    top: CENTRADO_INTERIOR,
    left: CENTRADO_INTERIOR,
    width: GEOMETRIA.diametroInterior,
    height: GEOMETRIA.diametroInterior,
    borderRadius: GEOMETRIA.diametroInterior / 2,
    borderWidth: GEOMETRIA.anilloInterior,
    borderColor: TINTA.reglaSuave,
  },
  logo: {
    // Llena el círculo interior completo.
    width: '100%',
    height: '100%',
    // Regla 1: escala por el lado menor hasta cubrir, conserva la proporción y
    // deja fuera lo que sobra del lado mayor. Nunca estira.
    objectFit: 'cover',
  },
  monograma: {
    fontFamily: FUENTE.neogrotesca,
    fontSize: GEOMETRIA.monogramaCuerpo,
    fontWeight: GEOMETRIA.monogramaPeso,
    lineHeight: GEOMETRIA.monogramaInterlineado,
  },
})

/** Las tres variantes declaradas por la ficha. */
export type VariantePanel = 'logo' | 'monograma' | 'oculto'

/**
 * Unión discriminada, no props opcionales: cada variante pide exactamente lo que
 * consume y nada más.
 *
 * `oculto` no recibe acento porque no pinta nada. Es una alternativa legítima
 * —el médico eligió membrete tipográfico sin marca—, no un estado degradado.
 */
export type PanelCircularProps =
  | {
      variante: 'logo'
      acento: AcentoResuelto
      /** Ráster ya normalizado por el ingest del perfil. PNG, JPG o base64. */
      logo: string
    }
  | {
      variante: 'monograma'
      acento: AcentoResuelto
      /**
       * Iniciales ya compuestas. 2.A no declara cómo se derivan del nombre ni
       * cuántas caben, así que esa decisión es de quien llama, no de aquí.
       */
      iniciales: string
    }
  | { variante: 'oculto' }

/**
 * 2.A · `PanelCircular`.
 *
 * Devuelve `null` en la variante `oculto`: la ficha exige que NO se reserve el
 * espacio del panel. Un `View` vacío con el diámetro puesto sería un defecto.
 */
export default function PanelCircular(props: PanelCircularProps): ReactElement | null {
  if (props.variante === 'oculto') return null

  const { acento } = props

  return (
    <View
      style={[
        estilos.exterior,
        { borderColor: acento.base, backgroundColor: acento.velo },
      ]}
    >
      <View style={estilos.interior}>
        {props.variante === 'logo' ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- <Image> de react-pdf, no acepta `alt`: no hay DOM ni lector de pantalla
          <Image src={props.logo} style={estilos.logo} />
        ) : (
          <Text style={[estilos.monograma, { color: acento.tinta }]}>
            {props.iniciales}
          </Text>
        )}
      </View>
      {props.variante === 'logo' && <View style={estilos.anilloInteriorEncima} />}
    </View>
  )
}
