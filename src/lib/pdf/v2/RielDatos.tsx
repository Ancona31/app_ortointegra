/**
 * Sistema de documentos v2 — componente 2.F · `RielDatos`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.F. Transcripción, no diseño.
 *
 * Propósito: presentar varios datos cortos en una banda horizontal, cada uno con
 * su etiqueta.
 *
 * DE DÓNDE SALE ESTE ARCHIVO
 *
 * La composición de aquí se escribió por primera vez dentro de 2.D, cuando el
 * riel del paciente hizo falta antes de que 2.F existiera, con la nota de que al
 * llegar 2.F se sustituiría y no se duplicaría (I.3.5). Esto es esa sustitución:
 * `BloquePaciente` ya no compone celdas, declara las suyas y las entrega.
 *
 * LA RETÍCULA ES `riel.celda`, NO `reticula.columna`
 *
 * I.1.3 declara dos retículas conviviendo sobre la misma caja de 486 pt. Los
 * bloques de texto se separan con aire —el medianil de 9 pt sobre columnas de
 * 32.25— y las celdas del riel se separan con una REGLA VERTICAL más padding, así
 * que su partición es de doce partes iguales SIN medianil: `riel.celda` = 40.5 pt.
 * Donde hay regla no hace falta medianil. La ficha de 2.F pedía
 * `reticula.columna` «más sus medianiles» hasta que el barrido de listas de
 * tokens la corrigió (anexo A, P2-11); si vuelves a leer eso en algún sitio, es
 * spec viejo.
 *
 * QUÉ NO ES ESTE COMPONENTE
 *
 * a. NO compone el par rótulo + valor delegando en `Campo` (2.E). Ver la nota
 *    larga sobre `tieneValor` más abajo: la decisión de colapsar tiene que vivir
 *    donde vive la geometría que colapsa. Lo que sí se comparte con 2.E, y una
 *    sola vez en el sistema, es la regla de qué cuenta como dato ausente.
 * b. NO compone la línea fina del membrete. La tabla de variantes de 2.F la
 *    reclamaba como consumidora de `una línea` y no lo es: no tiene rótulos, sus
 *    anchos no salen de `riel.celda` y su texto va en `medico.credencial`. Queda
 *    declarada en 2.B, que es donde estaba su geometría.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { tieneValor } from './Campo'
import { CAJA, FILETE, RIEL_CELDA, TINTA, estiloTipografico } from './tokens'

/**
 * Geometría interna del riel, de la ficha de 2.F. I.1.7 declara que la geometría
 * interna vive en la ficha del componente y no en la escala de espaciado, aunque
 * no sea múltiplo de 4 — y `8 10 10` no lo es.
 */
const GEOMETRIA = {
  /** Padding de celda `8 10 10`: superior 8, laterales 10, inferior 10. */
  padding: { superior: 8, lateral: 10, inferior: 10 },
} as const

const estilos = StyleSheet.create({
  /**
   * El riel abre y cierra con `filete.fino` en `tinta.negra`. Los dos filetes son
   * del riel entero, no de sus filas: por eso van aquí y no en `fila`.
   */
  riel: {
    width: CAJA.ancho,
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
    borderBottomWidth: FILETE.fino,
    borderBottomColor: TINTA.negra,
  },
  fila: {
    flexDirection: 'row',
    // Por defecto, y a propósito: las celdas se estiran al alto de la más alta
    // para que las reglas verticales lleguen de arriba abajo de la fila.
    alignItems: 'stretch',
  },
  /** Regla superior de toda fila que no sea la primera VIVA. */
  filaSiguiente: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.hairline,
  },
  /**
   * ANCHO NOMINAL POR `width`, REDISTRIBUCIÓN POR `flexGrow`. Los dos juntos, y
   * en ese orden, son lo que cumple las dos exigencias a la vez:
   *
   * - `width: columnas × riel.celda` da el ancho declarado (regla 1). Con todas
   *   las celdas presentes los anchos suman la caja, no sobra espacio y cada
   *   celda mide exactamente sus columnas de riel.
   * - `flexGrow: columnas` solo entra en juego cuando una celda COLAPSA: entonces
   *   sobra espacio y las restantes se lo reparten en la misma proporción, hasta
   *   ocupar el riel completo (regla 3). Un riel con un agujero delata que
   *   faltaba un dato, que es justo lo que el colapso evita.
   *
   * NO LO SUSTITUYAS POR `flexBasis: 0`. Es la forma «obvia» de repartir en
   * proporción y da mal el caso nominal: en este renderer el flex-basis es de
   * CAJA DE CONTENIDO, así que el padding y la regla se suman por fuera del
   * reparto y las celdas salen más estrechas de lo declarado. Está en I.3.8 con
   * su síntoma y su medida.
   */
  celda: {
    paddingTop: GEOMETRIA.padding.superior,
    paddingBottom: GEOMETRIA.padding.inferior,
    paddingLeft: GEOMETRIA.padding.lateral,
    paddingRight: GEOMETRIA.padding.lateral,
  },
  /** Regla izquierda salvo en la primera celda de cada fila. */
  celdaConRegla: {
    borderLeftWidth: FILETE.regla,
    borderLeftColor: TINTA.hairline,
  },
  /**
   * Versalita: mayúsculas con tracking, no versalitas reales de la fuente
   * (I.1.4). La transformación a mayúsculas ocurre en el render.
   */
  etiqueta: { ...estiloTipografico('etiqueta') },
  /** El valor por defecto de toda celda del sistema. */
  valor: { ...estiloTipografico('dato') },
})

/**
 * Estilo del valor de una celda.
 *
 * El tipo sale de `estilos.valor` y NO de una interfaz declarada: el tipo `Style`
 * de react-pdf lleva un índice de media queries, y TypeScript se lo presta a un
 * tipo de objeto inferido pero nunca a una interfaz. Mismo motivo que en 2.B y en
 * 2.D.
 */
export type EstiloValorCelda = typeof estilos.valor

export interface CeldaRiel {
  /** Identidad estable de la celda dentro del riel. */
  readonly clave: string
  /** Se compone en versalita aquí: no la pases ya en mayúsculas. */
  readonly etiqueta: string
  /** Ausente o vacío es lo mismo: la celda colapsa y las demás redistribuyen. */
  readonly valor?: string
  /** Columnas de `riel.celda`. Entero, nunca un ancho arbitrario (regla 1). */
  readonly columnas: number
  /**
   * Excepción tipográfica del valor, cuando el consumidor declara una en su
   * propia ficha. Sin ella, el valor va en el rol `dato`, que es el caso normal.
   *
   * Entra por aquí y no como una variante de este componente porque la excepción
   * la declara la ficha del CONSUMIDOR —el diagnóstico y el nombre del paciente
   * son geometría de 2.D— y `RielDatos` no tiene por qué conocerlas. Lo que este
   * componente declara es que existe una ranura para ellas.
   */
  readonly estiloValor?: EstiloValorCelda
}

/**
 * `sin contador` — LA PROPIEDAD ORTOGONAL DE LA FICHA, QUE NO COMPONE NADA.
 *
 * No es una tercera variante: un riel puede ser `celdas` **y** `sin contador` a
 * la vez. Declara que el riel no participa del conteo de `ContadorLista` (2.K
 * regla 3), porque el catálogo que presenta es abierto —el médico agrega y quita
 * requerimientos especiales de Internamiento— y «3 de 7» sería una cifra falsa.
 *
 * **No cambia nada del render**, y por eso no se leerá en este archivo: aquí no
 * hay ningún `if` que la consulte y no debe haberlo.
 *
 * QUIÉN LA LEE, YA CON 2.K CONSTRUIDO. No 2.K: ese componente recibe cifras ya
 * contadas —`enEstaHoja` y `total`— y no ve los rieles de la hoja, así que no
 * puede consultar esta prop ni aunque quisiera. La lee **el sitio que compone el
 * documento**, que es quien tiene delante los dos: el riel y el contador. Es la
 * misma forma que tomó el consultorio activo en P2-3 —la lectura vive en el sitio
 * que construye el documento, no dentro del componente que imprime—. Queda
 * registrado en el anexo A (P2-18).
 */
interface SinContador {
  readonly sinContador?: boolean
}

export type RielDatosProps =
  /** Varias filas de celdas. El número de celdas por fila lo declara el formato. */
  | ({ variante: 'celdas'; filas: readonly (readonly CeldaRiel[])[] } & SinContador)
  /** Riel comprimido de una sola fila. Hoy: `BloquePaciente` reducido. */
  | ({ variante: 'unaLinea'; celdas: readonly CeldaRiel[] } & SinContador)

/**
 * Una fila del riel, con sus celdas YA filtradas por el componente: aquí no llega
 * ninguna celda muerta. `primera` marca la que no lleva regla horizontal encima.
 */
function Fila({
  celdas,
  primera,
}: {
  celdas: readonly CeldaRiel[]
  primera: boolean
}): ReactElement {
  return (
    <View style={[estilos.fila, primera ? {} : estilos.filaSiguiente]}>
      {celdas.map((celda, indice) => (
        <View
          key={celda.clave}
          style={[
            estilos.celda,
            { width: celda.columnas * RIEL_CELDA, flexGrow: celda.columnas },
            indice === 0 ? {} : estilos.celdaConRegla,
          ]}
        >
          <Text style={estilos.etiqueta}>{celda.etiqueta.toUpperCase()}</Text>
          <Text style={celda.estiloValor ?? estilos.valor}>{celda.valor}</Text>
        </View>
      ))}
    </View>
  )
}

/** 2.F · `RielDatos`. */
export default function RielDatos(props: RielDatosProps): ReactElement {
  const declaradas =
    props.variante === 'unaLinea' ? [props.celdas] : props.filas

  /**
   * El colapso se resuelve ANTES de montar nada, y en dos pasos, porque son dos
   * cosas distintas: una celda sin dato desaparece de su fila, y una fila que se
   * queda sin celdas desaparece entera. Sin el segundo paso quedaría una regla
   * horizontal flotando sobre nada.
   *
   * Filtrar aquí y no dentro de `Fila` es lo que permite saber cuál es la primera
   * fila VIVA. Marcar la primera por su índice declarado pondría la regla
   * superior en la fila de arriba del todo en cuanto colapsara la fila 1.
   */
  const vivas = declaradas
    .map((fila) => fila.filter((celda) => tieneValor(celda.valor)))
    .filter((fila) => fila.length > 0)

  return (
    <View style={estilos.riel}>
      {vivas.map((celdas, indice) => (
        <Fila key={celdas[0].clave} celdas={celdas} primera={indice === 0} />
      ))}
    </View>
  )
}
