/**
 * Sistema de documentos v2 — componente 2.G · `EntradaNumerada`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.G. Transcripción, no diseño.
 *
 * Propósito: el ítem de lista del sistema. Base de Receta, Plan de Suplementación
 * e Imagenología.
 *
 * LAS CINCO RANURAS, Y QUIÉN DECIDE QUÉ VA EN CADA UNA
 *
 *   riel del número   `01`, `02`…                    rol `entrada.numero`
 *   `ancla`           los dos datos de mayor peso    rol `entrada.ancla`
 *   `secundario`      dato de apoyo bajo el ancla    rol `entrada.secundario`
 *   `marca`           bloque en negativo (2.H)       si el formato lo usa
 *   `nota`            texto en humanista (2.J)       rol `texto.corrido`
 *
 * **Qué dato ocupa cada ranura lo declara el FORMATO en la Sección II.** Este
 * componente declara las ranuras, no su contenido: no sabe que el ancla de la
 * Receta lleva el comercial y el gramaje, ni que la marca lleva la vía. Por eso
 * la prop de la marca se llama `marca` y no `via`.
 *
 * DOS EJES DE VARIANTE, LOS DOS DECLARADOS POR EL FORMATO
 *
 *   `calibracion`  `normal` · `compacta`   cuerpo, interlineado y aire de la fila
 *   `disposicion`  `apilada` · `columna`   dónde va la ranura `nota`
 *
 * Los dos entran porque la lámina los compone y el chasis no podía producirlos:
 * revierten `D4` y `D3` respectivamente. Son ortogonales y ninguno tiene valor por
 * defecto. **Ninguno de los dos se decide por el contenido en tiempo de render**,
 * que es lo único que I.3.4 prohíbe de verdad.
 *
 * LAS CINCO REGLAS
 *
 * 1. **Cero a la izquierda: `01`, no `1`.** Dos dígitos hasta 99.
 * 2. **Una sola entrada SÍ se numera.** Es la diferencia con 2.J, donde un solo
 *    ítem no se numera y se compone como párrafo. Son dos listas distintas y la
 *    confusión es previsible: aquí el número identifica el ítem —la farmacia
 *    despacha «el 02»—, allí solo ordena una enumeración.
 * 3. **Regla entre entradas, no antes de la primera ni después de la última.**
 * 4. **`break-inside: avoid`.** Una entrada nunca se parte entre hojas.
 * 5. **El `secundario` va en TINTA PLENA.** En Receta ese renglón es la
 *    denominación genérica: el único campo obligatorio por normativa. No puede
 *    componerse como dato de segunda. El rol ya lo trae en `tinta.negra` — si
 *    alguna vez ves un gris aquí, es un defecto, no una jerarquía.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueNegativo from './BloqueNegativo'
import FileteGruesoFino from './FileteGruesoFino'
import ParserBloques from './ParserBloques'
import { tieneValor } from './Campo'
import {
  ESPACIO,
  FILETE,
  RETICULA,
  TINTA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * LAS DOS CALIBRACIONES DE FILA, Y POR QUÉ SON DOS
 *
 * `D4` las había colapsado a una con el argumento de que «un documento no cambia
 * de métrica según cuántos ítems tenga» (I.3.4). **Contra la lámina el argumento
 * es falso:** `SPEC_DISENO_PARTE_B.md` B.1 §3 mide dos calibraciones distintas en
 * el archivo aprobado de Laboratorio, y la compacta es la que hace que 18 estudios
 * quepan en una hoja. La decisión queda revertida.
 *
 * Lo que I.3.4 sí prohíbe se conserva: **la calibración NO se elige por el número
 * de ítems en tiempo de render.** La declara el formato, una vez, en su ficha de la
 * Sección II. Si algún día ves aquí un `estudios.length > N`, es D4 volviendo por
 * la puerta de atrás.
 *
 * Geometría interna del componente, MEDIDA en la lámina. No es miembro de la escala
 * de espaciado y no debe forzarse a serlo (I.1.7), igual que los anillos de 2.A o
 * el padding de celda de 2.F.
 *
 * **EN `normal`, LA REGLA NO ESTÁ CENTRADA Y ES DELIBERADO.** Queda 2 pt más cerca
 * de la entrada que ABRE que de la que cierra, así que se lee como apertura de la
 * siguiente y no como cierre de la anterior — que es lo que hace que una lista
 * larga se recorra hacia abajo en vez de leerse como bloques sueltos. **No lo
 * «centres»:** un 6/6 es la corrección que hay que no hacer. El archivo de diseño
 * traía tres variantes de ese desfase —5/7, 8/10 y 9/11— y gana la de 5/7, que es
 * la de las láminas con varios medicamentos.
 *
 * **EN `compacta` el padding SÍ es simétrico**, y tampoco es un descuido: B.1 §3 lo
 * declara como un solo «padding vertical» de 1.75 pt. Es una tabla, no una lista
 * que se recorre, y una tabla no necesita señalar dónde abre cada renglón.
 *
 *   normal    7 + `filete.regla` + 5     = 12.5 pt entre entradas
 *   compacta  1.75 + `filete.regla` + 1.75 = 4 pt entre filas
 */
const GEOMETRIA = {
  normal: {
    /** Aire bajo la entrada que termina. */
    aireInferior: 7,
    /** Aire sobre la entrada que empieza. */
    aireSuperior: 5,
    /** Regla entre entradas de una lista que se recorre. */
    regla: TINTA.hairline,
  },
  compacta: {
    aireInferior: 1.75,
    aireSuperior: 1.75,
    /** B.1 §3: la regla de la lista larga es `tinta.reglaFila`, más tenue. */
    regla: TINTA.reglaFila,
  },
  /**
   * LA TERCERA CALIBRACIÓN — `estudio`, medida en la lámina de Imagenología.
   *
   * No es una tercera densidad de la misma fila: es **la lista apilada**, con los
   * cuatro datos uno bajo otro, que es lo contrario de la tabla de columnas de
   * Laboratorio. Por eso su ritmo se compone de otra manera y no como las otras
   * dos —ver `entradaEstudio` en la hoja de estilos—: la regla va DEBAJO de cada
   * entrada, incluida la última, y el padding es de todas, incluida la primera.
   *
   * `5 arriba + 6 abajo` es el `padding: 5pt 0 6pt` de la lámina. No es el desfase
   * deliberado de `normal` —allí la regla queda más cerca de la entrada que abre—:
   * aquí la regla cierra cada entrada y el aire mayor va bajo ella.
   *
   * El medianil de 6 pt separa el rótulo colgado `Indicación` de su texto, y es
   * geometría de esta calibración: no sale de `reticula.medianil`, que vale 9.
   */
  estudio: {
    aireSuperior: 5,
    aireInferior: 6,
    regla: TINTA.hairline,
    medianilRotuloNota: 6,
  },
  /**
   * LA CUARTA CALIBRACIÓN — `medicamento`, medida en la lámina aprobada de Receta.
   *
   * **Su ritmo es el de `normal` y no una cuarta cifra.** 7 pt de padding inferior,
   * la regla de 0.5 en `tinta.hairline` y 5 pt de padding superior: exactamente lo
   * que ya declara `normal`, hasta el desfase deliberado de 2 pt que hace que la
   * regla se lea como apertura de la entrada que empieza. Esta lámina es de donde
   * salió aquel 5/7, así que confirmarlo aquí no es una coincidencia — es la fuente.
   *
   * Por eso esta entrada **no aparece en `separacion*`**: reutiliza el estilo de
   * `normal` tal cual. Lo que sí es propio son las tres cifras de abajo.
   *
   * ⚠ **LA LÁMINA `B · 1 MEDICAMENTO` USA OTRO RITMO Y NO ES ESTE.** Aquella
   * compone padding `8/10` y `9/11` en vez de `5/7`, junto con una calibración
   * tipográfica entera un punto por encima —número 14 / 17, ancla 12.5 / 17,
   * genérico 10.5 / 14, indicación 10.5 / 16—. Es la hoja de UN medicamento: la
   * lista de siete es la que gobierna, por el mismo criterio con que `compacta` no
   * se elige por el número de ítems (I.3.4). **Reportado y no compuesto:** si algún
   * día se compone, es una quinta calibración declarada por el formato, nunca un
   * `medicamentos.length === 1` en tiempo de render.
   */
  medicamento: {
    /**
     * Ancho de la indicación — **381 pt**, no el ancho de la caja de contenido.
     *
     * La caja mide 453.75 (486 − 23.25 de riel − 9 de medianil) y la indicación se
     * queda 72.75 pt corta por la derecha. Es ancho FIJO y no un `flex: 1`
     * recortado: la lámina lo declara como medida de línea, y una medida de línea
     * es lo que hace legible un párrafo de 10 / 14 — el resto de la caja se queda
     * en blanco a propósito.
     */
    anchoIndicacion: 381,
    /**
     * Aire sobre la indicación — 3 pt. Es el único aire interno de la entrada junto
     * al de la vía; el ancla, el genérico y la vía oral van pegados uno bajo otro.
     *
     * `DERIVADO DE LA SEGUNDA LECTURA` — las coordenadas medidas dan los altos de
     * fila (85.37 · 89.56 · 75.56) pero no el desglose, y sin este margen los tres
     * salen 3 pt cortos. `SPEC_DISENO_PARTE_B.md` B.3 §3 lo declara —«margen 3
     * pt»— sobre el mismo archivo. Con él, la fila de vía oral cuadra en 0.13 pt y
     * las dos de vía en negativo en 0.56.
     */
    aireIndicacion: 3,
    /**
     * Aire sobre el CONTENEDOR del bloque en negativo — 2 pt. La vía ORAL no lo
     * lleva: la lámina la compone «sin margen superior propio», y esa asimetría es
     * lo que hace que las dos formas midan distinto (13 contra 16.5).
     */
    aireVia: ESPACIO[2],
  },
  /**
   * Ancho de la columna de la nota en la disposición `columna`. B.1 §3 declara la
   * retícula de la tabla como `23.25pt 1fr 132pt` con medianil de 9 pt: el riel y
   * el medianil son `reticula.riel` y `reticula.medianil`, y este 132 es la tercera
   * columna. El `1fr` sale solo —486 − 23.25 − 9 − 132 − 9 = **312.75 pt**, que es
   * exactamente lo que B.1 §3 anota entre paréntesis—, así que no se declara aquí.
   */
  columnaNota: 132,
} as const

const estilos = StyleSheet.create({
  entrada: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  /**
   * REGLA 3, EN UNA SOLA BANDERA. Los 7 pt son «padding inferior de la entrada
   * que termina» y aquí se implementan como margen superior de la que sigue: el
   * resultado impreso es idéntico —nada se interpone entre las dos— y así basta
   * con saber si una entrada es la primera para no dejar regla ni aire sobrante
   * en ninguno de los dos extremos de la lista.
   *
   * Implementarlo como padding inferior obligaría a saber además cuál es la
   * ÚLTIMA, y una lista paginada no sabe cuál es la última hasta que el motor de
   * flujo (2.N) ha decidido dónde corta.
   */
  separacion: {
    marginTop: GEOMETRIA.normal.aireInferior,
    borderTopWidth: FILETE.regla,
    borderTopColor: GEOMETRIA.normal.regla,
    paddingTop: GEOMETRIA.normal.aireSuperior,
  },
  separacionCompacta: {
    marginTop: GEOMETRIA.compacta.aireInferior,
    borderTopWidth: FILETE.regla,
    borderTopColor: GEOMETRIA.compacta.regla,
    paddingTop: GEOMETRIA.compacta.aireSuperior,
  },
  /**
   * EL RITMO DE `estudio`, Y POR QUÉ NO SE ESCRIBE COMO LOS OTROS DOS.
   *
   * Las otras dos calibraciones ponen la regla ARRIBA de la entrada que empieza y
   * se la ahorran a la primera, que es lo que evita una regla flotando sobre la
   * lista. Esta lámina compone la regla ABAJO de cada entrada —«regla inferior 0.5
   * pt `#D9D6D0`»— y el padding en las dos direcciones de todas ellas, incluida la
   * primera. La diferencia se ve al empezar y al terminar la lista: aquí la
   * primera entrada arranca a 5 pt de la cabecera y la última cierra con su propia
   * regla, que es lo que hace de cierre de la lista.
   *
   * **Por eso este formato no monta `CierreEntradas`.** Un filete de cierre encima
   * de la regla de la última entrada serían dos líneas donde la lámina tiene una.
   */
  entradaEstudio: {
    paddingTop: GEOMETRIA.estudio.aireSuperior,
    paddingBottom: GEOMETRIA.estudio.aireInferior,
    borderBottomWidth: FILETE.regla,
    borderBottomColor: GEOMETRIA.estudio.regla,
  },
  /**
   * El riel del número. Ancho fijo `reticula.riel` más `reticula.medianil`: la
   * misma anatomía que el ítem colgante de 2.J y la sección de 2.P, y la suma es
   * una columna exacta (23.25 + 9 = 32.25 = `reticula.columna`).
   *
   * Lo que alinea los números entre sí es el ancho fijo de esta caja, no una
   * alineación declarada: con dos dígitos siempre, `01` y `02` empiezan y acaban
   * en el mismo sitio.
   */
  riel: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  contenido: {
    flex: 1,
  },
  filaAncla: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  /** El ancla toma el ancho restante y rompe sola. Sin truncado. */
  ancla: { ...estiloTipografico('entrada.ancla'), flex: 1 },
  anclaCompacta: { ...estiloTipografico('entradaCompacta.ancla'), flex: 1 },
  /**
   * LA TERCERA COLUMNA DE LA DISPOSICIÓN `columna`, de ancho fijo.
   *
   * `D3` había resuelto que la lista de Laboratorio era «la misma
   * `EntradaNumerada` con dos ranuras» que la tabla de la lámina. **No lo es:** la
   * lámina pone estudio e indicación en el MISMO renglón y esta ranura apilaba la
   * nota debajo, duplicando el alto de cada fila. La decisión queda revertida y la
   * tabla entra como disposición de 2.G, no como componente paralelo (I.3.5).
   *
   * El ancho es fijo y no `flex`, que es lo que la hace una COLUMNA: se mantiene
   * aunque la celda venga vacía, y por eso las indicaciones de todas las filas
   * arrancan alineadas. Es también la respuesta a qué se imprime cuando un estudio
   * no tiene indicación — **nada, y la columna no se cierra** —; B.1 §3 no lo dice
   * con palabras, lo dice al declarar la retícula con un ancho fijo en vez de un
   * `auto`. Queda reportado como derivado, no como medido.
   */
  columnaNota: {
    width: GEOMETRIA.columnaNota,
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
  },
  notaCompacta: { ...estiloTipografico('entradaCompacta.nota') },
  /**
   * LAS CUATRO RANURAS DE LA CALIBRACIÓN `medicamento`, APILADAS DENTRO DE LA CAJA.
   *
   * Ninguna lleva margen superior salvo las dos que la lámina declara —la vía en
   * negativo y la indicación—, y ese cero es medido: los altos de fila solo cuadran
   * si el genérico va pegado al ancla y la vía oral pegada al genérico.
   */
  anclaMedicamento: { ...estiloTipografico('entradaMedicamento.ancla'), flex: 1 },
  /** REGLA 5: tinta plena. Es la denominación genérica. El rol ya la trae. */
  genericoMedicamento: { ...estiloTipografico('entradaMedicamento.generico') },
  /**
   * El contenedor del bloque en negativo. Su margen es lo único propio.
   *
   * `alignItems: 'flex-start'` es lo que impide que el contenedor estire al bloque:
   * 2.H ya se defiende con su `alignSelf`, pero eso solo funciona si nadie de fuera
   * le impone un ancho, y un `View` en columna estira a sus hijos por defecto.
   */
  cajaVia: {
    marginTop: GEOMETRIA.medicamento.aireVia,
    alignItems: 'flex-start',
  },
  /**
   * La indicación, de ancho FIJO. Ver `GEOMETRIA.medicamento.anchoIndicacion`: no
   * es `flex: 1`, y por eso no se estira hasta el borde de la caja.
   */
  indicacionMedicamento: {
    ...estiloTipografico('entradaMedicamento.indicacion'),
    width: GEOMETRIA.medicamento.anchoIndicacion,
    marginTop: GEOMETRIA.medicamento.aireIndicacion,
  },
  /** Las tres ranuras de la calibración `estudio`, apiladas. */
  anclaEstudio: { ...estiloTipografico('entradaEstudio.ancla'), flex: 1 },
  /**
   * El secundario de esta lámina —las proyecciones— NO lleva aire sobre el ancla:
   * la entrada completa mide 48 pt de contenido —17 + 13 + 2 + 16— y ese 2 es el
   * único aire interno, el del bloque de la nota. Si aquí hubiera un margen, la
   * fila dejaría de medir lo que mide la lámina.
   */
  secundarioEstudio: { ...estiloTipografico('entradaEstudio.secundario') },
  /** El bloque de la nota: rótulo colgado a la izquierda y texto a la derecha. */
  notaEstudio: {
    flexDirection: 'row',
    marginTop: ESPACIO[2],
  },
  rotuloNota: {
    ...estiloTipografico('entradaEstudio.rotuloNota'),
    flexShrink: 0,
    marginRight: GEOMETRIA.estudio.medianilRotuloNota,
  },
  textoNota: { ...estiloTipografico('entradaEstudio.nota'), flex: 1 },
  /**
   * LA CABECERA DE LA LISTA APILADA. No es `CabeceraEntradas`: aquella rotula las
   * tres columnas de una tabla y esta nombra la lista entera con una sola palabra.
   *
   * El aire de 5 pt va ENTRE el rótulo y su filete, y bajo el filete es CERO: la
   * primera entrada arranca inmediatamente y su propio padding de 5 hace el resto.
   */
  cabeceraLista: {
    marginTop: ESPACIO[5],
  },
  rotuloLista: { ...estiloTipografico('titulo.seccion') },
  /**
   * La celda de indicación con la calibración `normal`. Ninguna lámina compone
   * `normal` + `columna` —Laboratorio es `compacta`—, así que el rol es el que la
   * ficha de 2.G ya declara para la ranura: `texto.corrido`.
   */
  notaColumna: { ...estiloTipografico('texto.corrido') },
  /**
   * LA MARCA VA EN LA FILA DEL ANCLA, a la derecha.
   *
   * La ficha no declara su posición, y la tabla de separaciones internas sí dice
   * algo: declara `ancla` → `secundario` y `secundario` → `nota`, sin ningún
   * tramo que toque la marca. Con la marca en el flujo vertical esa tabla tendría
   * un hueco, y este spec no deja huecos en silencio. Va, por tanto, fuera del
   * flujo: sobre la fila del ancla, que es el renglón que la marca califica.
   *
   * El medianil no lo declara la ficha: se usa el separador de columnas del
   * sistema en vez de inventar una cifra, que es lo mismo que hizo 2.C con el
   * hueco entre el título y la fecha.
   */
  cajaMarca: {
    marginLeft: RETICULA.medianil,
    flexShrink: 0,
  },
  /** REGLA 5: tinta plena. El rol ya la trae; no se aclara aquí ni en el dato. */
  secundario: {
    ...estiloTipografico('entrada.secundario'),
    marginTop: ESPACIO[4],
  },
  /** La nota cambia de familia y de registro, así que sube un miembro (H4). */
  nota: {
    marginTop: ESPACIO[8],
  },
  /**
   * CABECERA DE LA TABLA. A.11 la declara entera: Archivo 7 / 11 pt, 600, 0.22 em,
   * mayúsculas, #737373 —que es el rol `etiqueta` sin desviación—, con 6 pt de
   * `padding-bottom` y un filete de 2 pt en acento debajo. Los dos valores ya son
   * tokens: `transicion.tablaFilete` y `filete.acento`.
   *
   * Vive aquí y no en el formato para que la retícula de tres columnas tenga UN
   * solo sitio de definición (I.3.5): la cabecera y las filas tienen que alinearse
   * por construcción, no por dos cifras que alguien mantenga iguales a mano.
   */
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: TRANSICION.tablaFilete,
    borderBottomWidth: FILETE.acento,
  },
  rotulo: { ...estiloTipografico('etiqueta') },
  /**
   * CIERRE DE LA TABLA. A.11: 0.8 pt `tinta.negra` con `margin-top: -0.5pt`. El
   * margen negativo NO es un ajuste óptico: solapa el cierre con la regla de
   * 0.5 pt que la última fila arrastra encima, para que las dos no se lean como
   * una línea doble. Sin él, el pie de la tabla pesa más que su cabecera.
   */
  cierre: {
    marginTop: -FILETE.regla,
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
  },
})

/**
 * Cuál de las dos calibraciones de fila usa la lista. **La declara el formato**,
 * nunca el número de ítems (ver la nota de `GEOMETRIA`).
 */
export type CalibracionEntrada = 'normal' | 'compacta' | 'estudio' | 'medicamento'

/**
 * Dónde va la ranura `nota` respecto del `ancla`.
 *
 *   `apilada`  bajo el ancla, a `espacio.8`, compuesta por 2.J. Receta, Suplementación
 *   `columna`  en el MISMO renglón, en la tercera columna de 132 pt. Laboratorio
 *
 * En `columna` la nota **no pasa por 2.J**: B.1 Pregunta A es explícita en que la
 * celda de indicación «son datos, no prosa», y por eso el cambio de chasis a
 * `texto.corrido` no la toca. Se compone como celda, con el rol de la calibración.
 */
export type DisposicionNota = 'apilada' | 'columna'

export interface EntradaNumeradaProps {
  /**
   * El ordinal de la entrada en el DOCUMENTO, no en la hoja: una lista que sigue
   * en la hoja 2 continúa en `04`, no vuelve a empezar.
   */
  numero: number
  /**
   * ¿Es la primera de la lista? Sin valor por defecto a propósito, por el mismo
   * motivo que `requerido` en 2.E: los dos valores posibles producen un defecto
   * visible —una regla flotando sobre la primera entrada, o una lista entera sin
   * reglas— y ninguno de los dos debe poder ocurrir por omisión.
   */
  primera: boolean
  /** Los dos datos de mayor peso, ya compuestos en una línea por el formato. */
  ancla: string
  /** Dato de apoyo bajo el ancla. Colapsa si no viene. */
  secundario?: string
  /**
   * La palabra del bloque en negativo (2.H), si el formato usa esta ranura. En
   * Receta es la vía de administración; el componente no lo sabe ni tiene por qué.
   */
  marca?: string
  /** Texto en humanista, compuesto por 2.J. Colapsa si no viene. */
  nota?: string
  /**
   * Rótulo colgado de la ranura `nota`. **Solo la calibración `estudio`**, que es
   * la única lámina que lo compone: existe para distinguir la indicación DEL
   * ESTUDIO del diagnóstico DEL DOCUMENTO, que va una sola vez en el riel.
   *
   * La cadena la declara el formato —`Indicación`—, como todas las del sistema.
   * Colapsa con la nota: sin nota no hay nada que rotular.
   */
  rotuloNota?: string
  /** El número va en `acento.tinta`, que es el único color que necesita acento. */
  acento: AcentoResuelto
  /**
   * Calibración de fila. Sin valor por defecto a propósito, igual que `primera`:
   * las dos producen documentos válidos y distintos, así que ninguna puede entrar
   * por omisión. La declara la ficha del formato en la Sección II.
   */
  calibracion: CalibracionEntrada
  /** Disposición de la ranura `nota`. Mismo criterio que `calibracion`. */
  disposicion: DisposicionNota
}

/** Regla 1: dos dígitos hasta 99. Por encima crece, nunca se trunca. */
function formatearNumero(numero: number): string {
  return String(numero).padStart(2, '0')
}

export interface CabeceraEntradasProps {
  /** Rótulo del riel del número. En el espécimen y en la lámina, `#`. */
  readonly numero: string
  /** Rótulo de la columna del ancla. */
  readonly ancla: string
  /** Rótulo de la columna de la nota. */
  readonly nota: string
  readonly acento: AcentoResuelto
}

/**
 * La cabecera de la tabla, para la disposición `columna`.
 *
 * **II.1 §5 la había PROHIBIDO**, declarando como excepción que «la lista es de una
 * sola columna» porque «el renderer viejo dibujaba el encabezado de una segunda
 * columna sin filas debajo» (auditoría §8.2). Eso describe una cabecera HUÉRFANA
 * —un rótulo sin nada que rotular—, no una cabecera. La lámina la compone, A.11 la
 * declara con todos sus valores y B.1 §5 le reserva presupuesto propio (`cabTabla`).
 *
 * Solo tiene sentido con `disposicion="columna"`: sin tercera columna no hay dos
 * rótulos que separar, y una cabecera sobre una lista apilada volvería a ser la
 * huérfana de §8.2.
 */
export function CabeceraEntradas({
  numero,
  ancla,
  nota,
  acento,
}: CabeceraEntradasProps): ReactElement {
  return (
    <View style={[estilos.cabecera, { borderBottomColor: acento.base }]}>
      <View style={estilos.riel}>
        <Text style={estilos.rotulo}>{numero.toUpperCase()}</Text>
      </View>
      <Text style={[estilos.rotulo, estilos.contenido]}>{ancla.toUpperCase()}</Text>
      <Text style={[estilos.rotulo, estilos.columnaNota]}>{nota.toUpperCase()}</Text>
    </View>
  )
}

/** El filete que cierra la tabla bajo la última fila (A.11). */
export function CierreEntradas(): ReactElement {
  return <View style={estilos.cierre} />
}

export interface CabeceraListaProps {
  /**
   * El sustantivo de la lista, en capitalización de oración: se compone en
   * mayúsculas aquí. La lámina imprime `Estudios` y, en continuación,
   * `Estudios · continuación`; la cadena entera la declara el formato.
   */
  readonly titulo: string
  readonly acento: AcentoResuelto
}

/**
 * LA CABECERA DE LA LISTA APILADA — rótulo y filete corto.
 *
 * La otra cabecera de este archivo, `CabeceraEntradas`, rotula las TRES COLUMNAS
 * de la disposición `columna`. Esta no rotula columnas: la lista de Imagenología
 * es apilada y no tiene ninguna, así que lo que la cabecera nombra es la lista
 * entera. Son dos piezas distintas con el mismo sitio en la hoja, no dos nombres
 * de la misma.
 *
 * El rótulo va en `titulo.seccion` —Archivo 10 / 14, 600, 0.14 em—, que es
 * exactamente lo que mide la lámina, y **no en `etiqueta`**, la versalita de 7 / 11
 * con la que se rotula un campo: 0.14 em no es el 0.22 de la versalita del sistema.
 * Se compone en mayúsculas porque la lámina lo compone así.
 */
export function CabeceraLista({ titulo, acento }: CabeceraListaProps): ReactElement {
  return (
    <View>
      <Text style={estilos.rotuloLista}>{titulo.toUpperCase()}</Text>
      <View style={estilos.cabeceraLista}>
        <FileteGruesoFino acento={acento} medida="lista" />
      </View>
    </View>
  )
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
  acento,
  calibracion,
  disposicion,
}: EntradaNumeradaProps): ReactElement {
  const compacta = calibracion === 'compacta'
  const estudio = calibracion === 'estudio'
  const medicamento = calibracion === 'medicamento'
  const enColumna = disposicion === 'columna'

  /**
   * `estudio` lleva su ritmo en las DOS direcciones y en todas las entradas, así
   * que no consulta `primera`. Las otras tres se lo ahorran a la primera, que es lo
   * que evita la regla flotando sobre la lista — y `medicamento` reutiliza el de
   * `normal` sin más, porque es el mismo (ver `GEOMETRIA.medicamento`).
   */
  const ritmo = estudio
    ? estilos.entradaEstudio
    : primera
      ? {}
      : compacta
        ? estilos.separacionCompacta
        : estilos.separacion

  return (
    // Regla 4: `wrap={false}` es el `break-inside: avoid` de la ficha. Es uno de
    // los cuatro bloques indivisibles que declara 2.N (`CONCILIA D44`).
    <View style={[estilos.entrada, ritmo]} wrap={false}>
      <View style={estilos.riel}>
        {/*
          El único estilo de v2 que no puede vivir en `StyleSheet.create`: el rol
          del número va en `acento.tinta` y el acento entra por prop, así que se
          resuelve en el render. Se ESPARCE en un literal a propósito — el
          `EstiloTipografico` que devuelve la función es una interfaz, y el `Style`
          de react-pdf lleva un índice de media queries que TypeScript presta a un
          objeto inferido pero nunca a una interfaz. Es la misma razón que ya está
          anotada en 2.B, 2.D, 2.F y 2.I, vista desde el otro lado.
        */}
        <Text
          style={{
            ...estiloTipografico(
              compacta
                ? 'entradaCompacta.numero'
                : medicamento
                  ? 'entradaMedicamento.numero'
                  : 'entrada.numero',
              acento,
            ),
          }}
        >
          {formatearNumero(numero)}
        </Text>
      </View>

      <View style={estilos.contenido}>
        <View style={estilos.filaAncla}>
          <Text
            style={
              estudio
                ? estilos.anclaEstudio
                : medicamento
                  ? estilos.anclaMedicamento
                  : compacta
                    ? estilos.anclaCompacta
                    : estilos.ancla
            }
          >
            {ancla}
          </Text>
          {/*
            LA MARCA VA EN LA FILA DEL ANCLA EN TODAS LAS CALIBRACIONES MENOS EN
            `medicamento`, donde la lámina le da renglón propio —el tercero de la
            caja, entre el genérico y la indicación—. Ver el bloque de la vía abajo.
          */}
          {!medicamento && tieneValor(marca) ? (
            <View style={estilos.cajaMarca}>
              <BloqueNegativo variante="via" via={marca} />
            </View>
          ) : null}
        </View>

        {/*
          EL `secundario` COLAPSA COMO CUALQUIER RANURA DE 2.G: sin dato, no queda
          rótulo ni hueco.

          ⚠ **AQUÍ HUBO UN CAMPO VACÍO REQUERIDO (2.E) Y SE RETIRÓ.** II.3 §2 declara
          el genérico y la presentación como «vacío requerido: rótulo y línea», y así
          se compuso: sin genérico salía `GENÉRICO` sobre una línea de
          `manuscrito.ancho`. **Angel decidió que colapse entero.** El motivo no es
          de redacción: esa línea mide 246 pt y vive dentro de la caja de contenido de
          la entrada, así que en cuanto la entrada llevaba vía y el bloque en negativo
          quedaba debajo, las dos zonas se pisaban. Un hueco donde escribir a pluma
          que se solapa con la vía de administración es peor que no tenerlo.

          Si vuelve, vuelve con una línea que no sea `manuscrito.ancho` — medida
          contra la caja de la entrada, no contra la presentación más larga del
          catálogo, que es de donde salen los 246.
        */}
        {tieneValor(secundario) ? (
          <Text
            style={
              estudio
                ? estilos.secundarioEstudio
                : medicamento
                  ? estilos.genericoMedicamento
                  : estilos.secundario
            }
          >
            {secundario}
          </Text>
        ) : null}

        {/*
          LA VÍA, EN SU PROPIO RENGLÓN. Entra por 2.H con la calibración medida.

          ⚠ **LA LÁMINA COMPONE LA ORAL COMO TEXTO PLANO Y AQUÍ VAN LAS TRECE EN
          NEGATIVO.** Es decisión de Angel contra lo medido, y devuelve a II.3 §5 lo
          que la lámina le había quitado. Cuesta 3.5 pt por entrada oral —el bloque
          mide 2 + 14.5 donde el renglón plano medía 13—, así que las filas de vía
          oral dejan de medir los 85.37 pt de la lámina y miden los 89 de las demás.
        */}
        {medicamento && tieneValor(marca) ? (
          <View style={estilos.cajaVia}>
            <BloqueNegativo variante="via" via={marca} lamina="receta" />
          </View>
        ) : null}

        {/* La indicación, de medida fija. No pasa por 2.J: es un dato, no prosa. */}
        {medicamento && tieneValor(nota) ? (
          <Text style={estilos.indicacionMedicamento}>{nota}</Text>
        ) : null}

        {/*
          LA NOTA DE `estudio` NO PASA POR 2.J, y por la misma razón que no pasa la
          de la disposición `columna`: es un dato con su propio rótulo, no prosa con
          viñetas. Colapsa entera —rótulo incluido— cuando no viene, que es la mitad
          de la verificación visible de II.2 §6; la otra mitad es que colapse
          INDEPENDIENTEMENTE de las proyecciones, y eso sale de que sean dos
          condiciones separadas y no una.
        */}
        {estudio && tieneValor(nota) ? (
          <View style={estilos.notaEstudio}>
            {tieneValor(rotuloNota) ? (
              <Text style={estilos.rotuloNota}>{rotuloNota.toUpperCase()}</Text>
            ) : null}
            <Text style={estilos.textoNota}>{nota}</Text>
          </View>
        ) : null}

        {/*
          La nota APILADA pasa por 2.J. En la práctica es prosa —una indicación— y
          de ahí sale como prosa, que es la degradación segura del parser; si el
          médico escribe viñetas, salen como lista en vez de como una tirada de
          guiones sueltos. Raya y no número: una indicación enumera sin orden, no
          describe una secuencia.

          En `columna` no pasa por aquí: sale de este bloque y se compone como
          celda, abajo. Ver `DisposicionNota`.

          NO DEFINIDO — `compacta` + `apilada`. Ninguna lámina compone esa pareja, y
          2.J tiene su lista de roles de cuerpo cerrada a dos (`texto.corrido` y
          `alarma.cuerpo`), así que la nota apilada saldría a 11.5 / 18 aunque la
          fila esté calibrada a 9 / 11.5. No se resuelve inventando: cuando exista
          una lámina que lo use, se mide y se abre la ranura en 2.J.
        */}
        {!estudio && !medicamento && !enColumna && tieneValor(nota) ? (
          <View style={estilos.nota}>
            <ParserBloques texto={nota} marca="raya" />
          </View>
        ) : null}
      </View>

      {enColumna ? (
        <View style={estilos.columnaNota}>
          {tieneValor(nota) ? (
            <Text style={compacta ? estilos.notaCompacta : estilos.notaColumna}>
              {nota}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
