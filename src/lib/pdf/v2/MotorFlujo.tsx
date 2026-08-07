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
import {
  ESPACIO,
  FLUJO,
  MARGEN,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  umbralFirma,
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
   * El aire de la fórmula de `umbral.firma`, entre el arrastre y la firma. Es
   * `espacio.16` y no `transicion.contenidoPie`, que mide lo mismo y separa otras
   * dos cosas: el último bloque de contenido de la banda de pie.
   */
  firmas: { marginTop: ESPACIO[16] },
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
 * Las tres formas canónicas del aviso de pie (`CONCILIA D5`). No hay una cuarta:
 * el sistema viejo tenía cuatro construcciones distintas de la zona izquierda
 * —`La solicitud continúa…`, `El consentimiento continúa…`, `El escrito
 * continúa…`, `Continúa en la hoja 2 · instrucciones y firmas`— y ninguna era
 * ninguna de estas.
 *
 * `items` es la palabra que **declara el formato**, no el componente: estudios,
 * medicamentos, suplementos, conceptos. Entra en capitalización de oración y se
 * compone en versalita aquí, exactamente como en 2.K.
 */
export type AvisoPie =
  /** La lista no terminó en esta hoja. `desde` y `hasta` son los de ESTA hoja. */
  | { forma: 'listaContinua'; items: string; desde: number; hasta: number }
  /** La lista cerró y el texto corrido sigue. */
  | { forma: 'textoContinua'; items: string }
  /** Todo cerró y solo falta la firma: es la regla 1 vista desde la hoja anterior. */
  | { forma: 'reservaFirma' }

/** Lo que el renderer entrega a cada nodo con `render`, de lo que aquí se usa. */
interface Hoja {
  subPageNumber: number
  subPageTotalPages: number
}

/**
 * La cadena de la zona izquierda, en capitalización de oración. La versalita la
 * pone la composición, como en 2.C, 2.H, 2.K y 2.M.
 *
 * `siguiente` es siempre `subPageNumber + 1`: las tres formas apuntan a la hoja
 * de al lado, nunca a una hoja arbitraria.
 */
function cadena(aviso: AvisoPie, siguiente: number): string {
  switch (aviso.forma) {
    case 'listaContinua':
      return `Continúa en la hoja ${siguiente} · ${aviso.items} ${aviso.desde} a ${aviso.hasta}`
    case 'textoContinua':
      return `Las ${aviso.items} continúan en la hoja ${siguiente}`
    case 'reservaFirma':
      return `Reservado para la firma · Continúa en la hoja ${siguiente}`
  }
}

/**
 * Qué aviso lleva la hoja que se está componiendo, o ninguno.
 *
 * **La última hoja no lleva aviso nunca**, diga lo que diga el formato: en ella no
 * continúa nada y las tres formas prometen una hoja siguiente que no existe. La
 * guarda va aquí y no en quien llama porque es la única forma de que no dependa
 * de que cada formato acierte con la longitud de su lista.
 *
 * En la pasada de reparto el renderer todavía no conoce las cifras de hoja y las
 * entrega sin definir; la aritmética cae entonces en `NaN`, el índice no
 * encuentra nada y el aviso no se compone. En la pasada final —la única que
 * imprime— ya están las cuatro.
 */
function avisoDeLaHoja(
  avisos: readonly (AvisoPie | null)[],
  { subPageNumber, subPageTotalPages }: Hoja,
): AvisoPie | null {
  if (subPageNumber >= subPageTotalPages) return null
  return avisos[subPageNumber - 1] ?? null
}

/**
 * Las dos zonas del aviso. Se llama DOS veces y las dos hacen falta (I.3.8): una
 * desde el `render` del contenedor, que es lo que imprime, y otra como hijos
 * declarados, que es lo único que ve la prebúsqueda de tipografías. Los hijos
 * declarados no se componen —el renderer los descarta—, así que basta con que
 * lleven el estilo: la familia y el peso que hay que cargar salen de ahí.
 */
function zonas(avisos: readonly (AvisoPie | null)[]): ReactElement[] {
  return [
    <Text
      key="izquierda"
      style={[estilos.zona, estilos.izquierda]}
      render={(hoja) => {
        const aviso = avisoDeLaHoja(avisos, hoja)
        return aviso === null ? null : cadena(aviso, hoja.subPageNumber + 1).toUpperCase()
      }}
    />,
    <Text
      key="derecha"
      style={[estilos.zona, estilos.derecha]}
      render={(hoja) =>
        avisoDeLaHoja(avisos, hoja) === null ? null : ZONA_DERECHA.toUpperCase()
      }
    />,
  ]
}

export interface MotorFlujoProps {
  /** El contenido del documento, ya compuesto en bloques por el formato. */
  children: ReactNode
  /**
   * Las últimas `flujo.arrastre` líneas del contenido: el texto corrido que baja
   * con la firma cuando el umbral no cabe (regla 1).
   *
   * **Lo declara el formato y no lo puede calcular el motor.** react-pdf no
   * expone la maquetación de líneas antes de componer la hoja, así que no hay
   * ningún momento en el que este componente pueda mirar el contenido y saber
   * dónde caen sus tres últimas líneas. Es la misma delegación que hace 2.K con
   * la forma de su contador, y por la misma razón.
   */
  arrastre: string
  /** El bloque de firmas (2.L), ya compuesto. Cierra el documento. */
  firmas: ReactElement
  /** Rol del firmante que cierra: es de donde sale el umbral. */
  rol?: RolFirmante
  /**
   * El aviso de pie de cada hoja: `avisos[0]` es la hoja 1. Una hoja sin entrada
   * —o con `null`— no lleva aviso, y la última no lleva nunca.
   */
  avisos?: readonly (AvisoPie | null)[]
}

/** 2.N · `MotorFlujo`. */
export default function MotorFlujo({
  children,
  arrastre,
  firmas,
  rol = 'medicoTratante',
  avisos = [],
}: MotorFlujoProps): ReactElement {
  return (
    <>
      {children}

      {/*
        El cierre. `wrap={false}` es lo que hace verdadera la regla 1: si no cabe,
        baja ENTERO, y el arrastre está dentro. El `minHeight` es `umbral.firma`
        como fórmula — nunca como cifra.
      */}
      <View wrap={false} style={{ minHeight: umbralFirma(rol) }}>
        <Text style={estilos.arrastre} orphans={FLUJO.orphans} widows={FLUJO.widows}>
          {arrastre}
        </Text>
        <View style={estilos.firmas}>{firmas}</View>
      </View>

      {/*
        El aviso de pie. `fixed` para que se evalúe en todas las hojas, `render` en
        el CONTENEDOR y las mismas zonas declaradas como hijos: las dos mitades de
        I.3.8. Ver la nota larga de la cabecera antes de tocar cualquiera de las tres.
      */}
      <View style={estilos.aviso} fixed render={() => zonas(avisos)}>
        {zonas(avisos)}
      </View>
    </>
  )
}
