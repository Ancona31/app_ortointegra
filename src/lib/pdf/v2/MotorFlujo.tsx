/**
 * Sistema de documentos v2 — componente 2.N · `MotorFlujo`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.N. Transcripción, no diseño.
 *
 * Propósito: decidir qué se queda en cada hoja. **Solo mueve bloques.**
 *
 * REGLA 1 — LA FIRMA NUNCA VA SOLA, Y EL UMBRAL ES FÓRMULA
 *
 * Si en la hoja no cabe `umbral.firma(rol)`, las últimas `flujo.arrastre` líneas
 * del contenido bajan con la firma. Aquí eso NO se implementa comparando un
 * número contra el hueco que queda: se implementa **componiendo el cierre como
 * un bloque indivisible cuyo alto ES el umbral**.
 *
 *     umbral.firma = firma.bloque.alto(rol) + espacio.16 + 3 × texto.corrido
 *                    └─ el bloque de firmas ─┘  └ el aire ┘  └─ el arrastre ─┘
 *
 * El cierre monta exactamente esos tres sumandos en ese orden, así que si el
 * cierre no cabe es que no cabía el umbral, y `wrap={false}` lo baja entero —con
 * el arrastre dentro—. El `minHeight` de `umbralFirma(rol)` cierra el único hueco
 * que queda: un arrastre que componga en menos de tres líneas dejaría el bloque
 * por debajo del umbral y lo colaría en un hueco donde el umbral no cabe.
 *
 * **No escribas 200.8 en ninguna parte.** Ese es el valor de referencia del spec
 * para `medicoTratante`; para los otros dos roles la fórmula da 189.8, y quien
 * congele cualquiera de los dos rompe el otro.
 *
 * EL AIRE SOBRANTE QUEDA DEBAJO DE LA RÚBRICA, NO ENCIMA (I.3.4)
 *
 * El cierre va en el FLUJO, detrás de lo último que haya: sin `position:
 * absolute` y sin `marginTop: auto`. Lo que el `minHeight` añade cuando el
 * arrastre es corto se apila **debajo** del bloque de firmas, que es donde el
 * corolario de I.3.4 manda que quede. Si alguna vez alguien empuja este bloque al
 * fondo de la caja «para que quede bonito», está invirtiendo esa regla.
 *
 * REGLA 2 — SIN VIUDAS NI HUÉRFANAS
 *
 * `flujo.orphans` y `flujo.widows` van en el párrafo que este componente compone,
 * que es el arrastre. El resto del texto corrido del sistema lo componen 2.P,
 * 2.I y 2.J, que hoy no los declaran: los dos tokens valen 2 y 2, que son
 * **exactamente el valor por defecto del renderer**, así que ningún párrafo
 * diverge hoy. El día que I.1.9 mueva cualquiera de los dos, esos tres
 * componentes tienen que pasarlos o quedarán en el 2 viejo sin avisar. Queda
 * fijado en `src/lib/tests/motorFlujo.test.ts`, que falla si los tokens se mueven.
 *
 * REGLA 3 — LOS CUATRO BLOQUES INDIVISIBLES (`CONCILIA D44`)
 *
 * Son cuatro, no tres, y los cuatro llevan ya su `wrap={false}`, que es el
 * `break-inside: avoid` del spec:
 *
 *     bloque de alarma      `BloqueDestacado.tsx`  (variante `alarma`)
 *     entrada numerada      `EntradaNumerada.tsx`
 *     bloque de firmas      `BloqueFirmas.tsx`
 *     bloques destacados    `BloqueDestacado.tsx`  (las tres variantes)
 *
 * El motor no los envuelve ni los vigila: cada uno se defiende solo, que es lo
 * que permite que un formato los coloque donde quiera. Lo único indivisible que
 * este componente añade es el CIERRE de la regla 1.
 *
 * PROHIBIDO CAMBIAR CUERPO, INTERLINEADO O MÁRGENES PARA CUADRAR UNA HOJA (I.3.4)
 *
 * En este archivo no hay ni una sola escritura de `fontSize`, `lineHeight` ni
 * margen de página. Si aparece una, la regla se rompió: cuando el contenido no
 * cabe se mueven bloques, no se comprime.
 *
 * ⚠️ LA TRAMPA DEL NODO CON `render` — LA MISMA DE 2.M, MEDIDA (I.3.8)
 *
 * Los tres avisos de pie son nodos que se recomponen por hoja, igual que la
 * paginación de la banda, y entran de lleno en los dos defectos MUDOS de I.3.8:
 *
 * 1. El interlineado es una RAZÓN del cuerpo. Cada recomposición vuelve a
 *    aplicarla sobre un valor ya resuelto —11 → 77 → 539 pt— hasta que la línea
 *    no cabe y el maquetador devuelve cero líneas: la zona sale en blanco, sin
 *    error y sin hueco.
 * 2. La prebúsqueda de tipografías recorre el árbol DECLARADO, antes de que corra
 *    ningún `render`. Lo que solo existe dentro del `render` no está ahí y su
 *    familia nunca se carga: el aviso saldría en Helvetica, sin lanzar nada.
 *
 * Forma correcta, y hacen falta las dos mitades: **el `render` va en el
 * CONTENEDOR** —así sus zonas se recrean desde el estilo literal en cada pasada y
 * la razón se resuelve una sola vez— **y las mismas zonas se declaran además como
 * hijos**, que es lo único que ve la prebúsqueda.
 *
 * EL ENCABEZADO POR HOJA — LO QUE ESTE COMPONENTE AÑADIÓ AL CABLEARSE
 *
 * Un `View fixed` con `render` al principio del flujo: el renderer lo repite en todas
 * las hojas y su contenido se decide por hoja, así que la 1 lleva el encabezado
 * completo y las demás el de continuación. **Los altos pueden diferir y el corte lo
 * respeta**, y eso no es una suposición: `splitPage` resuelve los nodos dinámicos y
 * RE-MAQUETA la hoja antes de partirla, y repite el ciclo sobre el resto. Medido
 * sobre el PDF, con una cabecera de 200 pt en la hoja 1 y de 40 en la 2.
 *
 * ⚠ **QUÉ HOJA ES, Y POR QUÉ SE LEEN DOS CIFRAS Y NO UNA.** En la pasada de REPARTO
 * el renderer entrega solo `pageNumber`; `subPageNumber` no existe hasta la pasada
 * final. Para un `Document` de un solo `Page` —que es toda emisión real: un documento
 * es un formato— las dos coinciden, así que `subPageNumber ?? pageNumber` es exacto.
 *
 * **En un `Document` con VARIOS `Page` no lo es**, porque `pageNumber` es absoluto
 * del documento: la primera hoja del segundo formato se reparte como si fuera una
 * continuación y luego se pinta con el encabezado completo. El resultado está medido
 * y es MUDO — el contenido se comprime, 13 ítems donde caben 10, con el paso de fila
 * bajando de 50 a 40.99 pt. Es una violación de I.3.4 que nadie lanza. **No compongas
 * dos formatos en un mismo `Document`**; el taller lo hacía y quedó corregido a un
 * caso por PDF.
 *
 * DÓNDE VIVE EL AVISO — AL PIE DEL ÁREA DE CONTENIDO, NO EN LA BANDA
 *
 * 2.M declara sus tres zonas —folio, paginación y leyenda— y ninguna es esta. El
 * aviso cuelga del **borde inferior de la caja de texto**, dentro de los 16 pt de
 * `transicion.contenidoPie`: el hueco que el margen inferior reserva y que ningún
 * bloque de contenido ocupa (ver la cabecera de 2.M). Por eso su posición se
 * deriva —`margen.inferior − pie.interlineado`— y por eso **no hace falta tocar el
 * `paddingBottom` de la página ni el alto de la caja**: reservar sitio dentro de
 * la caja para el aviso sería encoger `caja.alto`, que es un token.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import EncabezadoHoja, { type EncabezadoHojaProps } from './EncabezadoHoja'
import ContadorLista from './ContadorLista'
import {
  ESPACIO,
  FLUJO,
  MARGEN,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  umbralFirma,
  type Lamina,
  type RolFirmante,
} from './tokens'

/**
 * Zona derecha del aviso, invariable (`CONCILIA D22`).
 *
 * **No entra por prop**, por el mismo motivo que la leyenda de 2.M no entra por
 * prop: el sistema viejo tenía SEIS cadenas distintas aquí, incluida una
 * concordancia de género parametrizada por formato (`válida` / `válido`). La
 * concordancia se resuelve con el masculino del sustantivo elidido «documento»,
 * que es lo que el aviso predica. Ningún formato declina su propio nombre en el
 * pie. Se guarda como se imprime.
 */
const ZONA_DERECHA = 'Sin firma no es válido'

/**
 * La versalita del sistema, leída de `etiqueta` en vez de escrita como cifra —
 * igual que en 2.K y 2.M. El color es del SITIO, no de la desviación: aquí es
 * `tinta.secundaria` porque el aviso vive sobre papel, no sobre la banda de
 * acento. Es el mismo cuidado que se toma el contador de 2.K, que vive a un palmo.
 */
const VERSALITA = {
  peso: TIPOGRAFIA.etiqueta.peso,
  /** En em, como lo declara el spec. La conversión a pt va abajo. */
  tracking: TIPOGRAFIA.etiqueta.tracking,
} as const

const estilos = StyleSheet.create({
  /** El arrastre: texto corrido, sin nada propio. */
  arrastre: { ...estiloTipografico('texto.corrido') },
  /**
   * EL AIRE SOBRE EL CONTADOR — `espacio.5`, y las tres láminas medidas coinciden.
   *
   * Vive aquí y no en el formato porque el contador lo monta este componente: 2.K no
   * lleva margen propio a propósito —«la separación respecto del contenido es del
   * contenedor»— y el contenedor es este. Que las tres láminas midan lo mismo es lo
   * que permite que no sea una prop; el día que una mida otra cosa, sube a prop como
   * `aireFirma`.
   */
  contador: { marginTop: ESPACIO[5] },
  /**
   * El aviso cuelga del borde inferior de la caja de texto y ocupa el primer
   * renglón de los 16 pt de `transicion.contenidoPie`. Los 5 pt que sobran hasta
   * la banda de 2.M son residuo de esa resta, no una separación declarada.
   */
  aviso: {
    position: 'absolute',
    left: MARGEN.izquierdo,
    right: MARGEN.derecho,
    bottom: MARGEN.inferior - TIPOGRAFIA.pie.interlineado,
    flexDirection: 'row',
  },
  /**
   * `pie` en versalita, en `tinta.secundaria`. La multiplicación por el cuerpo es
   * la misma conversión em → pt que hace `estiloTipografico()`, aplicada al
   * tracking que la desviación sustituye. Ver la nota larga de 2.K.
   */
  zona: {
    ...estiloTipografico('pie'),
    fontWeight: VERSALITA.peso,
    letterSpacing: VERSALITA.tracking * TIPOGRAFIA.pie.cuerpo,
    color: TINTA.secundaria,
  },
  /** Zona izquierda: mide lo que dice. */
  izquierda: { flexShrink: 0 },
  /** Zona derecha: el resto del ancho, alineada al borde de la caja. */
  derecha: { flex: 1, textAlign: 'right' },
})

/**
 * LA ZONA IZQUIERDA DEL AVISO — UNA SOLA FORMA, Y ERAN TRES.
 *
 * `CONCILIA D5` había reducido de seis construcciones a tres: `listaContinua`
 * —«continúa en la hoja 2 · medicamentos 05 a 07»—, `textoContinua` y `reservaFirma`.
 * **Las tres quedan colapsadas en esta.**
 *
 * El motivo es el mismo que cambió la cadena del contador en 2.K: el rango `05 a 07`
 * lo tiene que poner quien sabe qué ítems cayeron en cada hoja, y **eso no lo reporta
 * el renderer**. Tampoco lo puede saber el formato sin paginar por su cuenta, que es
 * justo lo que este componente existe para evitar. Sin el rango, `listaContinua` y
 * `textoContinua` dicen exactamente lo mismo, y `reservaFirma` —«en la hoja de al
 * lado solo falta la firma»— exige saber dónde cayó el corte, que es el mismo dato.
 *
 * Con una sola forma, el aviso deja de entrar por prop: lo pone el motor en toda hoja
 * que no sea la última, que es la única condición que hace falta y la única que el
 * renderer sí da. **Un aviso que nadie tiene que declarar es un aviso que ningún
 * formato puede olvidar.**
 *
 * ⚠ **VA CONTRA LA LÁMINA**, que compone `CONTINÚA EN LA HOJA 2 · MEDICAMENTOS 05 A
 * 07`. Decisión de Angel, declarada y reportada: no es una limitación escondida.
 */
const ZONA_IZQUIERDA = 'Continúa en la hoja'

/** Lo que el renderer entrega a cada nodo con `render`, de lo que aquí se usa. */
interface Hoja {
  /** Ausentes en la pasada de REPARTO. Ver la nota de la cabecera. */
  subPageNumber?: number
  subPageTotalPages?: number
  pageNumber?: number
}

/**
 * En qué hoja del DOCUMENTO estamos, y cuántas hay.
 *
 * `subPageNumber` cuenta las hojas de este `Page`; `pageNumber` las del PDF entero y
 * es lo único que llega en la pasada de reparto. Ver la nota larga de la cabecera
 * antes de tocar esta línea: de ella depende que el encabezado de la hoja 1 no se
 * componga como una continuación.
 */
export function numeroDeHoja(hoja: Hoja): number {
  return hoja.subPageNumber ?? hoja.pageNumber ?? 1
}

/**
 * ¿Esta hoja es la última del documento?
 *
 * En la pasada de reparto el total no existe todavía, y entonces **se responde que
 * NO**: es la respuesta conservadora para las dos cosas que dependen de ella. El
 * aviso vive en posición absoluta, así que componerlo de más en esa pasada no mueve
 * ni un punto del flujo; y el contador mide lo mismo en sus dos formas, un renglón de
 * `pie`. En la pasada final —la única que imprime— las dos cifras ya están.
 */
function esUltima({ subPageNumber, subPageTotalPages }: Hoja): boolean {
  if (subPageNumber === undefined || subPageTotalPages === undefined) return false
  return subPageNumber >= subPageTotalPages
}

/**
 * Las dos zonas del aviso. Se llama DOS veces y las dos hacen falta (I.3.8): una
 * desde el `render` del contenedor, que es lo que imprime, y otra como hijos
 * declarados, que es lo único que ve la prebúsqueda de tipografías. Los hijos
 * declarados no se componen —el renderer los descarta—, así que basta con que
 * lleven el estilo: la familia y el peso que hay que cargar salen de ahí.
 */
function zonas(): ReactElement[] {
  return [
    <Text
      key="izquierda"
      style={[estilos.zona, estilos.izquierda]}
      render={(hoja) =>
        esUltima(hoja)
          ? null
          : `${ZONA_IZQUIERDA} ${numeroDeHoja(hoja) + 1}`.toUpperCase()
      }
    />,
    <Text
      key="derecha"
      style={[estilos.zona, estilos.derecha]}
      render={(hoja) => (esUltima(hoja) ? null : ZONA_DERECHA.toUpperCase())}
    />,
  ]
}

export interface MotorFlujoProps {
  /**
   * LOS DATOS DEL ENCABEZADO, no su composición. El motor los pasa a 2.V dos veces
   * —una por variante— y decide cuál sale en cada hoja.
   *
   * **Es lo que impide que un formato componga su propia hoja de continuación.** Si
   * esta prop fuera un `ReactNode`, cada uno de los ocho volvería a escribir el
   * membrete reducido, el riel del paciente y el rótulo de continuación, y serían
   * ocho sitios donde olvidarse del nombre del paciente.
   */
  encabezado: Omit<EncabezadoHojaProps, 'variante'>
  /** El contenido del documento, ya compuesto en bloques por el formato. */
  children: ReactNode
  /**
   * El contador de la lista (2.K), si el formato tiene lista. Sale **en todas las
   * hojas**, con la forma que corresponda: `intermedia` mientras queden hojas,
   * `final` en la última. El formato declara el sustantivo y el total; el número de
   * hoja lo pone el renderer.
   */
  contador?: {
    readonly items: string
    readonly total: number
    readonly lamina?: Lamina
  }
  /**
   * Lo que va entre el contador y la firma: notas, recomendaciones, alarma. Va
   * DESPUÉS del contador en el flujo, que es el orden de las tres láminas medidas.
   */
  cierre?: ReactNode
  /**
   * Aire entre lo último del contenido y el bloque de firma. Lo declara el FORMATO
   * porque cada lámina lo mide distinto —20 pt en Laboratorio, 26 en Imagenología y
   * en Receta—, igual que el aire hasta la cabecera de la lista.
   *
   * Sin él, `espacio.16`: el mismo sumando que la fórmula de `umbral.firma` pone
   * entre el arrastre y la firma, que es la única separación que I.1.9 declara aquí.
   */
  aireFirma?: number
  /**
   * Las últimas `flujo.arrastre` líneas del contenido: el texto corrido que baja
   * con la firma cuando el umbral no cabe (regla 1).
   *
   * **Lo declara el formato y no lo puede calcular el motor.** react-pdf no
   * expone la maquetación de líneas antes de componer la hoja, así que no hay
   * ningún momento en el que este componente pueda mirar el contenido y saber
   * dónde caen sus tres últimas líneas.
   *
   * Opcional, y ninguno de los tres formatos construidos lo pasa: los tres terminan
   * en lista o en bloque destacado, no en prosa. El `minHeight` de abajo sigue
   * reservando el umbral entero, así que la regla 1 se cumple igual — lo que no hay
   * es texto que arrastrar.
   */
  arrastre?: string
  /** El bloque de firmas (2.L), ya compuesto. Cierra el documento. */
  firmas: ReactElement
  /** Rol del firmante que cierra: es de donde sale el umbral. */
  rol?: RolFirmante
}

/** 2.N · `MotorFlujo`. */
export default function MotorFlujo({
  encabezado,
  children,
  contador,
  cierre,
  aireFirma = ESPACIO[16],
  arrastre,
  firmas,
  rol = 'medicoTratante',
}: MotorFlujoProps): ReactElement {
  /**
   * Las dos variantes del encabezado, compuestas de antemano. Se montan las DOS
   * aunque solo salga una: son lo único que ve la prebúsqueda de tipografías, que
   * recorre el árbol declarado antes de que corra ningún `render` (I.3.8). Sin ellas
   * el encabezado de continuación pediría familias que nadie cargó y saldría en la
   * tipografía de reserva, sin lanzar nada.
   */
  const primera = <EncabezadoHoja variante="primera" {...encabezado} />
  const continuacion = <EncabezadoHoja variante="continuacion" {...encabezado} />

  /** El contador de esta hoja. Las dos formas miden lo mismo: un renglón de `pie`. */
  const contadorDeHoja = (hoja: Hoja): ReactElement | null => {
    if (contador === undefined) return null
    return esUltima(hoja) ? (
      <ContadorLista forma="final" {...contador} />
    ) : (
      <ContadorLista
        forma="intermedia"
        hoja={numeroDeHoja(hoja)}
        hojas={hoja.subPageTotalPages ?? numeroDeHoja(hoja)}
        {...contador}
      />
    )
  }

  return (
    <>
      {/*
        EL ENCABEZADO DE CADA HOJA. `fixed` para que se repita y `render` para que
        cambie: las dos mitades hacen falta y ninguna sirve sola. Los hijos declarados
        no se componen —el renderer los descarta y se queda con lo que devuelve el
        `render`— pero son lo único que ve la prebúsqueda de tipografías.
      */}
      <View fixed render={(hoja: Hoja) => (numeroDeHoja(hoja) === 1 ? primera : continuacion)}>
        {primera}
        {continuacion}
      </View>

      {children}

      {/*
        EL CONTADOR, UNO POR HOJA Y EN SU SITIO DEL FLUJO.

        Es `fixed`, así que el renderer lo copia a todas las hojas **conservando su
        posición entre hermanos**: cae justo detrás de la última entrada de su hoja y,
        en la última, delante de los bloques de cierre. Es el orden de las tres
        láminas, y sale solo — no hay que saber dónde cortó la lista para colocarlo.
      */}
      {contador === undefined ? null : (
        <View style={estilos.contador} fixed render={(hoja: Hoja) => contadorDeHoja(hoja)}>
          <ContadorLista forma="final" {...contador} />
        </View>
      )}

      {cierre}

      {/*
        El cierre. `wrap={false}` es lo que hace verdadera la regla 1: si no cabe,
        baja ENTERO, y el arrastre está dentro. El `minHeight` es `umbral.firma`
        como fórmula — nunca como cifra.

        ⚠ **EL `minHeight` SOLO SE APLICA CUANDO HAY ARRASTRE, Y ANTES SE APLICABA
        SIEMPRE.** `umbral.firma` es `firma.bloque.alto + espacio.16 + 3 renglones`, y
        esos dos últimos sumandos SON el arrastre y su aire: existen para que un
        arrastre que componga en menos de tres líneas no cuele el bloque en un hueco
        donde el umbral no cabía. Sin arrastre no hay nada que reservar, y reservarlo
        igual son 72 pt de aire muerto —190.8 contra los 118.75 que mide la firma—
        que empujan el cierre a una hoja propia.

        Medido en Receta con 7 medicamentos: con el `minHeight` puesto salían TRES
        hojas, la última con la firma y los dos bloques de cierre y ni un medicamento.
        **Es el defecto que la regla 1 existe para evitar, provocado por la propia
        regla 1.** Sin él salen las dos hojas de la lámina, 4 y 3.

        Lo que la regla 1 garantiza sigue en pie por otro lado: el bloque es
        indivisible, así que la firma nunca se parte, y los bloques de cierre que la
        preceden traen su propio `wrap={false}` (2.I regla 3).
      */}
      <View wrap={false} style={arrastre === undefined ? {} : { minHeight: umbralFirma(rol) }}>
        {arrastre === undefined ? null : (
          <Text style={estilos.arrastre} orphans={FLUJO.orphans} widows={FLUJO.widows}>
            {arrastre}
          </Text>
        )}
        <View style={{ marginTop: arrastre === undefined ? aireFirma : ESPACIO[16] }}>
          {firmas}
        </View>
      </View>

      {/*
        El aviso de pie. `fixed` para que se evalúe en todas las hojas, `render` en
        el CONTENEDOR y las mismas zonas declaradas como hijos: las dos mitades de
        I.3.8. Ver la nota larga de la cabecera antes de tocar cualquiera de las tres.
      */}
      <View style={estilos.aviso} fixed render={() => zonas()}>
        {zonas()}
      </View>
    </>
  )
}
