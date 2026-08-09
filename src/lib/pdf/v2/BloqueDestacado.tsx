/**
 * Sistema de documentos v2 — componente 2.I · `BloqueDestacado`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.I. Transcripción, no diseño.
 *
 * Propósito: separar del cuerpo un pasaje que el lector debe leer aunque lea en
 * diagonal. Se distingue **por filete, NUNCA por fondo de color**.
 *
 * REGLA 1 — POR QUÉ NO HAY UN SOLO `backgroundColor` EN ESTE ARCHIVO
 *
 * Ninguna variante lleva fondo. Ni al velo del acento, que es el fondo tenue que
 * I.1.8 sí admite en otros sitios. La jerarquía la carga el GROSOR del filete,
 * que es lo único que sobrevive intacto a una fotocopia: un velo al 6 % se va en
 * la primera copia y con él se iría la distinción entre las tres variantes.
 *
 * Es también I.3.3 —el color nunca es el único portador de significado— aplicado
 * al caso en que la distinción no es de color sino de trama: una trama que
 * desaparece deja tres bloques idénticos.
 *
 * LOS TRES GROSORES SE DERIVAN, NO SE ELIGEN
 *
 * La jerarquía es alarma > instrucciones > cita, y entre `filete.alarma` (3 pt) y
 * `filete.cita` (1.6 pt) la escala de I.1.6 tiene un solo miembro,
 * `filete.acento` (2 pt). No había nada que decidir (`CIERRA H1`). Que
 * `filete.acento` lo usen además la cabecera de tabla y el marco del QR no
 * estorba: un grosor es un grosor.
 *
 * QUÉ LADO LLEVA FILETE
 *
 * `alarma` lleva superior E izquierdo; `instrucciones` y `cita` solo izquierdo.
 * La `cita` con filete superior que aparecía en Suplementación quedó unificada a
 * solo izquierdo (`CONCILIA D42`): es lo que la distingue de la alarma.
 *
 * **Y AHORA SON CUATRO.** `recomendaciones` entra con la lámina aprobada de Receta y
 * es la primera que lleva **solo el superior**, en `filete.regla` y
 * `tinta.reglaSuave` en vez de `tinta.negra`. Ver `VarianteDestacado`.
 *
 * EL ENCABEZADO ES UNA RANURA, Y ANTES NO EXISTÍA
 *
 * Dos de las cuatro variantes lo llevan y las dos lo componen con rol propio —9.5 /
 * 13 la alarma, 9 / 13 las recomendaciones—, medidos en esa misma lámina. Ver la
 * prop `encabezado` para por qué no entra por el texto.
 *
 * LA RANURA DE 2.J, YA CONECTADA
 *
 * La regla 4 de la ficha dice que `instrucciones` compone lista NUMERADA, no con
 * raya. Esa composición es de `ParserBloques` (2.J), y la prop `texto` de aquí ya
 * tenía su forma: UNA SOLA CADENA (`CONCILIA D10`). La ranura que quedó marcada
 * al construir este componente está ocupada — el cambio fue interno y la entrada
 * no se movió, que era lo que se dejó anunciado.
 *
 * **Las tres variantes pasan por el parser**, no solo `instrucciones`: el pasaje
 * entra como cadena en las tres y la Receta compone su alarma «con
 * `ParserBloques` dentro» (II.3 §3). Lo que cambia entre variantes es la marca de
 * lista —número en `instrucciones`, raya en las otras dos— y el rol del cuerpo.
 * Una prosa sin viñetas sale de ahí como prosa: es la degradación segura del
 * parser, no una excepción de este componente.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import ParserBloques, { type RolCuerpoParser } from './ParserBloques'
import {
  ESPACIO,
  FILETE,
  FILETE_SUPLEMENTACION,
  TINTA,
  estiloTipografico,
  type Lamina,
  type RolTipograficoNombre,
} from './tokens'

/**
 * SANGRÍA DEL TEXTO RESPECTO DEL FILETE — `espacio.16` EN LAS TRES VARIANTES.
 *
 * La regla 2 de la ficha dice «la sangría del texto respecto del filete», en
 * singular, y `alarma` tiene dos filetes. La sangría se aplica a los dos: el
 * texto guarda `espacio.16` con el filete que tiene a la izquierda y, cuando
 * existe, con el que tiene encima. Leerlo como «solo el izquierdo» dejaría el
 * texto de la alarma pegado a un filete de 3 pt, que es el más grueso del bloque
 * y el que más necesita aire. Queda registrado en el anexo A (P2-16).
 *
 * `CORRIGE HANDOFF` — el bloque de alarma figuraba con 14 pt, que no es miembro
 * de la escala de espaciado. No hay razón de alineación que exija 14: la sangría
 * no se alinea con la retícula, se alinea con el filete.
 */
const SANGRIA = ESPACIO[16]

/**
 * Geometría interna de las dos composiciones que las láminas miden y la ficha no
 * declara. I.1.7: lo que es geometría de un componente vive en su ficha, aunque no
 * sea múltiplo de `espacio.base`.
 *
 * ⚠ **`D15` QUEDA COMPUESTO, NO RESUELTO.** La sangría de la alarma es **14 pt** en
 * la lámina aprobada de Receta y `espacio.16` en el chasis, que además marcaba el 14
 * como `CORRIGE HANDOFF` «porque no es múltiplo de 4». Ese argumento ya no vale —la
 * escala tiene 14 desde Imagenología— pero la decisión sigue siendo de producto: se
 * compone la de esta lámina bajo `lamina`, y el chasis no se mueve.
 *
 * El padding de la alarma **no es uniforme y eso es lo que la ficha no preveía**:
 * `6 0 8 14` reparte más aire abajo que arriba y ninguno a la derecha, mientras que
 * la lectura de la ficha —«la sangría se aplica a los dos filetes»— da 16 y 16. Son
 * dos composiciones distintas del mismo bloque, no un ajuste del mismo valor.
 */
const GEOMETRIA = {
  /** Alarma en la lámina de Receta: `padding: 6pt 0 8pt 14pt`. */
  alarmaReceta: { superior: 6, izquierda: ESPACIO[14], inferior: 8 },
  /**
   * Recomendaciones generales: filete SUPERIOR de `filete.regla` en
   * `tinta.reglaSuave` y 6 pt de aire bajo él. **Sin sangría izquierda**, que es lo
   * que la distingue de las otras tres y lo que hace que su cuerpo mida los 486 pt
   * de `caja.ancho` — el único bloque del sistema que usa la medida completa.
   */
  recomendaciones: { superior: 6 },
  /**
   * Aire entre el encabezado y su cuerpo. Dos valores medidos y ninguno de la
   * escala: la alarma aprieta más porque su cuerpo pesa más (12 / 18 en 500).
   */
  aireCuerpo: { alarma: 3, recomendaciones: ESPACIO[4] },
  /**
   * LA CITA DE CONTROL DE SUPLEMENTACIÓN, Y ROMPE LO QUE `CONCILIA D42` HABÍA UNIDO.
   *
   * ⚠ **LLEVA FILETE SUPERIOR E IZQUIERDO**, y `D42` unificó la variante `cita` a
   * «solo izquierdo» precisamente porque una cita con filete superior aparecía en
   * Suplementación: era lo que la distinguía de la alarma. **La lámina la compone con
   * los dos**, así que la unificación no describe el archivo aprobado. Se compone bajo
   * `lamina` y el chasis no se mueve — con lo que la distinción respecto de la alarma
   * se queda en lo que siempre fue de verdad: el grosor (1.9 contra 4) y el color del
   * cuerpo. **Reportado, no resuelto.**
   *
   * El grosor es `FILETE_SUPLEMENTACION.acento`, 1.9 pt, y no `filete.cita`, que vale
   * 1.6. Es el mismo trazo con el que esa lámina separa la celda de peso en el riel.
   *
   * `ancho` es del BLOQUE, no de su medida de línea: es el único destacado del sistema
   * que no ocupa la caja entera. Y la sangría son 12 pt aplicados a los dos filetes,
   * que es la lectura de la regla 2 que ya fijó el anexo A (P2-16) para la alarma.
   */
  citaSuplementacion: { sangria: ESPACIO[12], ancho: 294 },
  /**
   * Las notas adicionales de esa misma lámina: la anatomía de `recomendaciones` con
   * **0.63 pt de filete en vez de 0.5**. Es el mismo hairline que su regla de entrada,
   * y por eso el valor sale de `FILETE_SUPLEMENTACION` y no se escribe aquí.
   *
   * ⚠ **LO QUE NO SE COMPONE DE ESE BLOQUE SON LOS MÁRGENES DE SUS PÁRRAFOS**: la
   * lámina mide **5 pt en cada uno** y 2.J compone 4 dentro de un bloque y 8 entre
   * bloques (`dentroDelBloque` / `entreBloques`, anexo A, P2-20). Esa escala es del
   * parser y la comparten los cuatro destacados y las notas de los otros formatos;
   * moverla por esta lámina, o abrirle una ranura de márgenes a 2.J, es propagar una
   * decisión de este bloque a un componente que no la toma. **Reportado, no compuesto.**
   */
} as const

const estilos = StyleSheet.create({
  /**
   * Lo común a las cuatro. Sin `backgroundColor` (regla 1) y sin margen: la
   * separación respecto de los bloques vecinos es del contenedor, como en 2.E.
   *
   * **La sangría YA NO VIVE AQUÍ.** Vive en cada estilo de filete, porque
   * `recomendaciones` no la lleva —su filete es superior y no izquierdo, así que no
   * hay ningún filete a la izquierda del que separarse—. Dejarla en el bloque común
   * habría sangrado un bloque sin filete izquierdo, que es sangría sin causa.
   */
  bloque: {},
  fileteAlarma: {
    borderLeftWidth: FILETE.alarma,
    borderLeftColor: TINTA.negra,
    borderTopWidth: FILETE.alarma,
    borderTopColor: TINTA.negra,
    paddingTop: SANGRIA,
    paddingLeft: SANGRIA,
  },
  /** La misma alarma con el padding de la lámina de Receta. Ver `GEOMETRIA`. */
  fileteAlarmaReceta: {
    borderLeftWidth: FILETE.alarma,
    borderLeftColor: TINTA.negra,
    borderTopWidth: FILETE.alarma,
    borderTopColor: TINTA.negra,
    paddingTop: GEOMETRIA.alarmaReceta.superior,
    paddingLeft: GEOMETRIA.alarmaReceta.izquierda,
    paddingBottom: GEOMETRIA.alarmaReceta.inferior,
  },
  fileteInstrucciones: {
    borderLeftWidth: FILETE.acento,
    borderLeftColor: TINTA.negra,
    paddingLeft: SANGRIA,
  },
  fileteCita: {
    borderLeftWidth: FILETE.cita,
    borderLeftColor: TINTA.negra,
    paddingLeft: SANGRIA,
  },
  /** La cita de Suplementación: dos filetes, sangría de 12 y ancho propio. */
  fileteCitaSuplementacion: {
    borderLeftWidth: FILETE_SUPLEMENTACION.acento,
    borderLeftColor: TINTA.negra,
    borderTopWidth: FILETE_SUPLEMENTACION.acento,
    borderTopColor: TINTA.negra,
    paddingTop: GEOMETRIA.citaSuplementacion.sangria,
    paddingLeft: GEOMETRIA.citaSuplementacion.sangria,
    width: GEOMETRIA.citaSuplementacion.ancho,
  },
  /**
   * El único filete SUPERIOR del componente, y el único que no va en `tinta.negra`.
   * Es también el más fino de los cuatro, y eso es la jerarquía funcionando: unas
   * recomendaciones generales se leen después de la alarma, no antes.
   */
  fileteRecomendaciones: {
    borderTopWidth: FILETE.regla,
    borderTopColor: TINTA.reglaSuave,
    paddingTop: GEOMETRIA.recomendaciones.superior,
  },
  /** El mismo, 0.13 pt más grueso. Ver `GEOMETRIA` antes de fusionarlos. */
  fileteRecomendacionesSuplementacion: {
    borderTopWidth: FILETE_SUPLEMENTACION.regla,
    borderTopColor: TINTA.reglaSuave,
    paddingTop: GEOMETRIA.recomendaciones.superior,
  },
  encabezadoAlarma: { ...estiloTipografico('alarma.encabezado') },
  encabezadoRecomendaciones: { ...estiloTipografico('recomendaciones.encabezado') },
  cuerpoTrasEncabezadoAlarma: { marginTop: GEOMETRIA.aireCuerpo.alarma },
  cuerpoTrasEncabezadoRecomendaciones: {
    marginTop: GEOMETRIA.aireCuerpo.recomendaciones,
  },
})

/**
 * QUÉ LE PIDE CADA VARIANTE AL PARSER.
 *
 * - **Rol del cuerpo.** `alarma` compone en `alarma.cuerpo` —IBM Plex Sans 12/18,
 *   peso 500 (`CONCILIA D16`)—, un punto por encima del texto corrido (II.3 §5);
 *   es el único cuerpo del sistema con ventaja declarada sobre `texto.corrido`.
 *   Las otras dos van en el texto corrido del sistema. El rol lo declara ESTA
 *   ficha y 2.J solo pone la ranura, igual que 2.F con la excepción de celda.
 * - **Marca de lista.** Número en `instrucciones`, porque la secuencia significa
 *   algo —primero presentarse, después el ayuno (regla 4)—; raya en las otras dos,
 *   que enumeran sin orden.
 */
const COMPOSICION = {
  alarma: { rolCuerpo: 'alarma.cuerpo', marca: 'raya', rolEncabezado: 'alarma.encabezado' },
  instrucciones: { rolCuerpo: 'texto.corrido', marca: 'numero', rolEncabezado: null },
  cita: { rolCuerpo: 'texto.corrido', marca: 'raya', rolEncabezado: null },
  recomendaciones: {
    rolCuerpo: 'texto.corrido',
    marca: 'raya',
    rolEncabezado: 'recomendaciones.encabezado',
  },
} as const satisfies Record<
  VarianteDestacado,
  {
    rolCuerpo: RolCuerpoParser
    marca: 'raya' | 'numero'
    rolEncabezado: RolTipograficoNombre | null
  }
>

/**
 * Las CUATRO variantes. `recomendaciones` entra con la lámina de Receta y es la
 * primera cuyo filete no va a la izquierda ni en `tinta.negra`.
 *
 * **No rompe la jerarquía de grosores, la extiende por abajo:** alarma (4) >
 * instrucciones (2) > cita (1.6) > recomendaciones (0.5). Y no es un cuarto miembro
 * inventado —los cuatro grosores ya estaban en la escala de I.1.6—; lo que hacía
 * falta era el sitio donde ponerlo.
 */
export type VarianteDestacado = 'alarma' | 'instrucciones' | 'cita' | 'recomendaciones'

export interface BloqueDestacadoProps {
  /** Cuál de las cuatro, con su grosor y su rol. */
  variante: VarianteDestacado
  /**
   * EL ENCABEZADO DEL BLOQUE, como cadena y en capitalización de oración: se compone
   * en mayúsculas aquí, como toda versalita del sistema.
   *
   * **Es una prop y no un renglón del texto**, aunque `ParserBloques` sepa reconocer
   * encabezados: los que reconoce salen en `etiqueta` —7 / 11— y las láminas
   * componen estos dos a 9 / 13 y 9.5 / 13. Meterlos por el texto obligaría a
   * desviar el rol de 2.J por lámina, que es propagar una decisión de este bloque a
   * un componente que no la toma. Además son cadenas del FORMATO —«Recomendaciones
   * generales», «Acuda de inmediato a urgencias si presenta»—, no del médico, y las
   * cadenas del formato no viajan mezcladas con el dato.
   *
   * Colapsa si no viene, y con él su aire: `instrucciones` y `cita` no lo llevan.
   */
  encabezado?: string
  /**
   * El pasaje, como UNA cadena. Es la misma forma que espera `ParserBloques`
   * (`CONCILIA D10`), así que cuando 2.J llegue no hay que cambiar la prop: el
   * texto entra igual y lo que cambia es quién lo compone dentro.
   *
   * Uno de los dos, `texto` o `contenido`. Si vienen los dos, manda `contenido`.
   */
  texto?: string
  /**
   * COMPOSICIÓN PROPIA DEL FORMATO, EN VEZ DEL PASAJE.
   *
   * ⚠ **NO ES UN ATAJO PARA METER PROSA POR OTRA PUERTA.** El pasaje entra por `texto`
   * y lo compone 2.J, y eso no cambia: si lo que tienes es un párrafo, usa `texto`.
   *
   * Existe por un caso y hoy tiene uno: el bloque de cita de Suplementación son
   * **cuatro datos con cuatro roles distintos** —rótulo, fecha, plazo y nota— y ninguno
   * es prosa. Meterlos por `texto` obligaría a que 2.J supiera distinguirlos, que es
   * pedirle a un analizador de viñetas que analice una ficha.
   *
   * Lo que este bloque sigue aportando es lo suyo y es todo lo que aporta: el filete,
   * la sangría, el ancho y el `wrap={false}`. **La tipografía del contenido NO la pone
   * el formato**: los cuatro roles `cita.*` viven en I.1.4, que es donde un formato
   * puede leerlos sin escribir ni un cuerpo.
   */
  contenido?: ReactNode
  /** Qué lámina fija el padding de la alarma. Sin ella, la del chasis. */
  lamina?: Lamina
}

/**
 * Los tres estilos de filete, como unión de los objetos inferidos por
 * `StyleSheet.create`. El tipo NO se declara como interfaz por el mismo motivo
 * que en 2.B, 2.D y 2.F: el `Style` de react-pdf lleva un índice de media queries
 * que TypeScript presta a un tipo de objeto inferido pero nunca a una interfaz.
 */
type EstiloFilete =
  | typeof estilos.fileteAlarma
  | typeof estilos.fileteAlarmaReceta
  | typeof estilos.fileteInstrucciones
  | typeof estilos.fileteCita
  | typeof estilos.fileteCitaSuplementacion
  | typeof estilos.fileteRecomendaciones
  | typeof estilos.fileteRecomendacionesSuplementacion

/** Filete y sangría de cada variante, con la lámina que la fija. */
function estiloFilete(variante: VarianteDestacado, lamina: Lamina): EstiloFilete {
  const suplementacion = lamina === 'suplementacion'
  if (variante === 'alarma') {
    return lamina === 'receta' ? estilos.fileteAlarmaReceta : estilos.fileteAlarma
  }
  if (variante === 'instrucciones') return estilos.fileteInstrucciones
  if (variante === 'recomendaciones') {
    return suplementacion
      ? estilos.fileteRecomendacionesSuplementacion
      : estilos.fileteRecomendaciones
  }
  return suplementacion ? estilos.fileteCitaSuplementacion : estilos.fileteCita
}

/** 2.I · `BloqueDestacado`. */
export default function BloqueDestacado({
  variante,
  encabezado,
  texto,
  contenido,
  lamina = 'chasis',
}: BloqueDestacadoProps): ReactElement {
  const composicion = COMPOSICION[variante]
  const hayEncabezado = encabezado !== undefined && encabezado.trim() !== ''

  return (
    // `wrap={false}` es la regla 3: un bloque destacado no se parte entre hojas.
    // Es el `break-inside: avoid` de la ficha y uno de los cuatro bloques
    // indivisibles que declara 2.N (`CONCILIA D44`).
    <View style={[estilos.bloque, estiloFilete(variante, lamina)]} wrap={false}>
      {hayEncabezado && composicion.rolEncabezado !== null ? (
        <Text
          style={
            variante === 'alarma'
              ? estilos.encabezadoAlarma
              : estilos.encabezadoRecomendaciones
          }
        >
          {encabezado.toUpperCase()}
        </Text>
      ) : null}

      {/*
        LA RANURA DE 2.J, OCUPADA. `ParserBloques` decide qué es encabezado, qué es
        ítem y qué es párrafo —con el lookahead, que es lo que impide que la prosa
        salga en versalita— y en `instrucciones` compone la lista NUMERADA de la
        regla 4. Este componente no vuelve a mirar el texto: pone el filete, la
        sangría y el rol, y entrega la cadena entera.

        El aire sobre el parser existe SOLO si hay encabezado del que separarse; sin
        él el cuerpo arranca pegado al padding del bloque, que es lo que hacen
        `instrucciones` y `cita`.
      */}
      <View
        style={
          !hayEncabezado || composicion.rolEncabezado === null
            ? {}
            : variante === 'alarma'
              ? estilos.cuerpoTrasEncabezadoAlarma
              : estilos.cuerpoTrasEncabezadoRecomendaciones
        }
      >
        {contenido ??
          (texto === undefined ? null : (
            <ParserBloques
              texto={texto}
              marca={composicion.marca}
              rolCuerpo={composicion.rolCuerpo}
            />
          ))}
      </View>
    </View>
  )
}
