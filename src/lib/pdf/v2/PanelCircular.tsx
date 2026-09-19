/**
 * Sistema de documentos v3 — 2.A · **PanelCircular**.
 *
 * «La marca del documento. Doble anillo con disco al velo del acento, y dentro el
 * logo del médico o su monograma.»
 *
 * CAMBIO v3 (brief 00 §3.1): el panel baja de 56 a **40 pt** de diámetro y sus dos
 * anillos y su monograma bajan en proporción. No es un ajuste estético — es el
 * primer sumando del recorte del encabezado, que pasa de 270–345 pt a 157–182.
 *
 * LO QUE NO CAMBIA: las tres variantes y su lógica. `oculto` sigue devolviendo
 * `null` —no un `View` vacío con el diámetro puesto— y sigue siendo una variante del
 * chasis, no un estado degradado: hay médicos con membrete tipográfico sin marca.
 *
 * ⚠ **YOGA MIDE EL BORDE POR DENTRO Y LAS LÁMINAS HTML LO MIDEN POR FUERA.** Con el
 * panel en 56 eso valía 3 pt de discrepancia contra la lámina y quedó reportado dos
 * veces sin resolver. Aquí el diámetro EXTERIOR son 40 y el anillo vive dentro, así
 * que la fila superior del membrete mide 40 y no 42.4. Es el mismo criterio de
 * siempre; lo que cambia es que ahora la cifra del brief ya es la de Yoga.
 */

import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { TINTA, estiloTipografico, type AcentoResuelto, SIN_ENCOGER } from './tokens'

/**
 * Diámetro EXTERIOR del panel, en pt. Exportado porque `Membrete` resta este valor
 * y el medianil para saber con cuánto ancho compone el nombre: si el panel cambia
 * de tamaño y el membrete midiera contra su propia copia, el nombre se compondría
 * contra un ancho que ya no existe.
 */
export const PANEL_DIAMETRO = 40

/** Medianil del panel al bloque del nombre (brief 00 §3.1). Lo lee `Membrete`. */
export const PANEL_MEDIANIL = 12

const GEOMETRIA = {
  /** Anillo exterior, en `acento.base` — su forma pura, que aquí es legal: es trazo. */
  anilloExterior: 1.2,
  /** Anillo interior, en `TINTA.reglaSuave`. */
  anilloInterior: 0.4,
  /** Diámetro del disco interior. Con 40 de panel deja 1.8 pt de aire por lado. */
  disco: 34,
  /** Cuerpo del monograma. Peso 600 y `acento.tinta`, que sí es color de texto. */
  monograma: 15,
  /** Sangría del logo dentro del disco, para que el ráster no toque el anillo. */
  sangriaLogo: 2,
} as const

const estilos = StyleSheet.create({
  panel: {
    width: PANEL_DIAMETRO,
    height: PANEL_DIAMETRO,
    borderRadius: PANEL_DIAMETRO / 2,
    borderWidth: GEOMETRIA.anilloExterior,
    alignItems: 'center',
    justifyContent: 'center',
    // El panel nunca encoge: es una marca, no una caja de texto (regla 4 de 2.A).
    flexShrink: SIN_ENCOGER,
  },
  disco: {
    width: GEOMETRIA.disco,
    height: GEOMETRIA.disco,
    borderRadius: GEOMETRIA.disco / 2,
    borderWidth: GEOMETRIA.anilloInterior,
    borderColor: TINTA.reglaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: GEOMETRIA.disco - 2 * (GEOMETRIA.anilloInterior + GEOMETRIA.sangriaLogo),
    height: GEOMETRIA.disco - 2 * (GEOMETRIA.anilloInterior + GEOMETRIA.sangriaLogo),
    objectFit: 'contain',
  },
})

export type VariantePanel = 'logo' | 'monograma' | 'oculto'

export type PanelCircularProps =
  | {
      variante: 'logo'
      acento: AcentoResuelto
      /** Ráster ya normalizado por quien llama (I.3.8). */
      logo: string
    }
  | {
      variante: 'monograma'
      acento: AcentoResuelto
      /** Una o dos iniciales, ya derivadas del nombre por el adaptador. */
      iniciales: string
    }
  | { variante: 'oculto' }

/** 2.A · `PanelCircular`. Devuelve `null` en la variante `oculto` (regla 4). */
export default function PanelCircular(props: PanelCircularProps): ReactElement | null {
  if (props.variante === 'oculto') return null

  const { acento } = props

  return (
    <View style={[estilos.panel, { borderColor: acento.base }]}>
      <View style={[estilos.disco, { backgroundColor: acento.velo }]}>
        {props.variante === 'logo' ? (
          // `Image` es la primitiva de @react-pdf/renderer, no un `<img>`: no admite
          // `alt` y su salida es un PDF, no un árbol accesible.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={props.logo} style={estilos.logo} />
        ) : (
          <Text
            style={{
              ...estiloTipografico('medico.nombre', acento),
              fontSize: GEOMETRIA.monograma,
              // El monograma no lleva interlineado del rol: es una caja centrada de
              // un renglón, y un multiplicador de 18/15 lo bajaría del centro.
              lineHeight: 1,
              letterSpacing: 0,
              color: acento.tinta,
            }}
          >
            {props.iniciales.toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  )
}
