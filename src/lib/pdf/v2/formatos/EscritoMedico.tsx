/**
 * Sistema de documentos v2 — formato II.8 · **Escrito Médico**. El octavo y último.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina aprobada**, con
 * `DOCUMENTOS_SPEC.md` II.8 como segunda lectura. Donde las dos difieren manda la lámina.
 *
 * EL CHASIS MÁS DESNUDO, Y POR ESO ES EL QUE LO VALIDA
 *
 * Es el único **sin folio**, **sin QR**, **sin riel de identificación**, **sin bloque de
 * paciente** y con el **título variable**. Su encabezado mide **165.22 pt**, un tercio del de
 * Consentimiento. Lo que queda cuando se le quita todo eso es el chasis: membrete, un bloque
 * de título, cuerpo, firma y banda. Si el chasis se sostiene, se sostiene aquí.
 *
 * Y a la vez es el de cuerpo más rico: **el texto viene de un editor**, con encabezados,
 * listas, citas, separadores, negrita y cursiva. Los siete formatos anteriores componen
 * datos; este compone un documento que alguien escribió.
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La lámina mide **165.22 pt** desde el margen de 54, el menor del sistema.
 *
 *     fila superior del membrete    56       (el panel; la lámina la mide en 58.85)
 *     aire                           8       `transicion.membreteFilete`
 *     filete principal               2.5
 *     aire                           6       `transicion.membreteLineaFina`
 *     banda de dirección            24       dos renglones de 12, con cédulas
 *     espaciador de cierre          16       ← 2.B, cuarto valor del sistema
 *     bloque de título              20       un renglón de `titulo.documento`
 *     aire                           5       ← 2.C, los mismos 5 de Receta
 *     filete del título              2.5
 *     aire                          20       ← 2.C, el mayor del sistema
 *                                 ─────────
 *                                 160
 *
 * ⚠ Sumando los 2.85 pt del panel —56 en el chasis contra 58.85 en la lámina, la OCTAVA que
 * lo mide así— salen **162.85** contra los 165.22 medidos: **2.37 pt**, que son exactamente
 * el residuo del bloque de título. La lámina lo mide en **22.37** con un renglón y en **60**
 * con tres, y esas dos cifras no son la misma cuenta: 3 × 20 = 60 exactos, así que el
 * renglón mide 20 y los 2.37 son el *strut* que el HTML añade y Yoga no. Se componen los 20.
 * Reportado.
 *
 * LOS CUATRO ESTADOS DEL TÍTULO, QUE SON LA VERIFICACIÓN VISIBLE
 *
 *     corto    `Certificado médico`          1 renglón   bloque 20
 *     medio    `Carta de recomendación`      1 renglón   bloque 20
 *     largo    la constancia de 105 caracteres  3 renglones   bloque 60
 *     ausente  —                              0 renglones  **bloque 20**, con la fecha sola
 *
 * ⚠ **SIN TÍTULO EL BLOQUE NO COLAPSA, Y LA REGLA 4 DE 2.C DICE QUE SÍ.** La lámina deja 20
 * pt con la fecha alineada a la derecha y **conserva el filete**. Es coherente con lo que la
 * variante es: sin título el documento sigue teniendo fecha, y su fecha vive en este bloque.
 * Se compone lo medido y `II.8 §5` —que decía que el cuerpo arranca «sin banda vacía» bajo el
 * filete del membrete— queda **corregido**. Reportado.
 *
 * **El título largo ENVUELVE y nunca se recorta**: cada renglón extra suma 20 pt y se los
 * quita al cuerpo de esa hoja. No hay `maxLines` ni elipsis en el bloque de título — el único
 * recorte del sistema está en la banda de pie, y es sobre `tituloPie`, que es otro campo.
 *
 * LAS SEIS COSAS QUE ESTA LÁMINA CONTRADICE, Y QUÉ SE COMPONE
 *
 * a. **La variante `ausente` no colapsa**, arriba. Reportado en 2.C.
 * b. **La marca de lista va en la neo-grotesca.** La lámina la compone en IBM Plex Mono, que
 *    I.1.4 prohíbe en documento impreso. **Noveno caso idéntico** (`CONCILIA D13, D20, D30`)
 *    y el último del sistema: con este quedan los nueve contados.
 * c. **La negrita se compone en peso 500, no 600.** Es lo que la lámina mide, y encaja con la
 *    familia: IBM Plex Sans solo tiene 400 y 500 cargados, y el 600 de la neo-grotesca
 *    cambiaría de tipografía a mitad de un párrafo.
 * d. **Dos tratamientos de la misma fecha**: sin rótulo a 9 pt en `tinta.etiqueta` en la hoja
 *    1, y rotulada `Emisión` a 10 / 14 en peso 500 y tinta plena en las de continuación.
 *    II.8 §5 los unifica al de la hoja 1 (`CONCILIA D40`); el paso 4.8 manda componer los dos
 *    medidos. Reportado en 2.V.
 * e. **La banda de pie reparte sus tres zonas de otra manera** que la otra lámina con
 *    `sin folio`, y su zona central es **la única del sistema con recorte por elipsis**.
 *    Reportado en 2.M.
 * f. **El aviso de pie es el del chasis.** La lámina compone `El escrito continúa en la hoja
 *    2` a la izquierda; 2.N compone `Continúa en la hoja 2` para los ocho formatos
 *    (`CONCILIA D5`). La zona derecha sí coincide. Reportado, no compuesto.
 *
 * LA HOJA DE CONTINUACIÓN, Y LO QUE ATA UNA HOJA SIN FOLIO
 *
 * Es la menor del sistema y la única sin línea de paciente — este formato no tiene paciente.
 * Lo que ata su hoja 2 a la 1 son **tres datos**, y los tres los compone el chasis:
 *
 *     rótulo   `<nombre> · continuación`   en `firma.rol`, 7 / 11 sobre `tinta.etiqueta`
 *     médico   nombre a 14 / 18 y sus DOS cédulas bajo el filete
 *     fecha    en el riel derecho, rotulada `Emisión`
 *
 *     29     cabecera: rótulo (11) + nombre (18)
 *      8     `transicion.membreteFilete`
 *      2.5   el filete
 *      6     `transicion.membreteLineaFina`
 *     12     la línea de cédulas
 *     ─────
 *     57.5   + 24 de espaciador hasta el cuerpo
 *
 * ⚠ **LA LÁMINA DECLARA 54.5 Y SUS PROPIAS PIEZAS SUMAN 67.5.** Las cuatro que enumera —29,
 * 2.5, 12 y 24— ya se pasan de su total antes de contar ningún aire, así que las dos cifras
 * no cierran entre sí. Se componen las PIEZAS, que es la medida dura, y el resultado queda 3
 * pt por encima del total declarado — del mismo orden y con la misma causa que los 2.37 de su
 * bloque de título. Reportado.
 *
 * `tituloPie` ES UN CAMPO APARTE, NO UN TRUNCADO
 *
 * El encabezado puede imprimir `Constancia de atención médica y valoración ortopédica para
 * trámite escolar ante la Secretaría de Educación` y la banda `Constancia de atención
 * médica`. **No es el mismo texto recortado**: es un segundo campo que el médico escribe, y
 * por eso entra como prop propia con el título del encabezado como valor por defecto
 * (`CONCILIA D41`). La elipsis de la banda existe para el caso en que tampoco ese quepa.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import {
  CAJA,
  ESPACIO,
  FILETE,
  MARGEN,
  PAPEL,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

/** La lámina que fija la composición de los componentes del chasis en este formato. */
const LAMINA = 'escrito' as const

// ─── Cadenas ─────────────────────────────────────────────────────────────────

/**
 * ⚠ **ESTE FORMATO NO TIENE TÍTULO FIJO.** Lo escribe el médico, y por eso no hay ninguna
 * constante de título aquí. Lo único que el formato declara es el nombre con el que la banda
 * de pie llama al documento cuando nadie lo ha nombrado.
 */
const TITULO_PIE_POR_DEFECTO = 'Escrito médico'

/** El rótulo de la firma, textual de la lámina. */
const ROTULO_FIRMA = 'Firma y sello del médico'

/**
 * LA MARCA DE LISTA, en las dos formas que la lámina compone.
 *
 * ⚠ **VA EN LA NEO-GROTESCA Y LA LÁMINA LA COMPONE EN IBM PLEX MONO.** Noveno caso idéntico
 * (`CONCILIA D13, D20, D30`) y el último: I.1.4 prohíbe la mono en documento impreso.
 * Reportado.
 *
 * La numerada lleva punto y la de viñeta es la raya del sistema, la misma que 2.J compone y
 * que 2.B usa para unir las cédulas. Las dos comparten eje: riel de 14 pt alineado a la
 * DERECHA, así que `1.` y `10.` acaban en la misma vertical y la raya también.
 */
const RAYA = '—'

// ─── Geometría del cuerpo ────────────────────────────────────────────────────

/**
 * LOS AIRES DEL CUERPO, medidos en la lámina. **Todos múltiplos de 4**, y el archivo lo
 * declara: 8 · 16 · 20 · 24 · 32.
 *
 * No suben a `ESPACIO` porque ya están: son `espacio.8`, `espacio.16`, `espacio.20` y
 * `espacio.32`. Lo que este bloque declara es QUÉ nodo usa cuál, que es composición del
 * formato y no escala del sistema.
 */
const AIRE = {
  parrafo: ESPACIO[8],
  encabezado1: ESPACIO[20],
  encabezado2: ESPACIO[16],
  lista: ESPACIO[8],
  cita: ESPACIO[16],
  separador: ESPACIO[16],
  /** Último bloque del cuerpo → firma. */
  firma: ESPACIO[32],
} as const

/**
 * LA LISTA — riel de 14 pt a la DERECHA y medianil de 8.
 *
 * `486 − 14 − 8 = 464`, que es lo que mide el texto de un ítem en la lámina. El 464 no se
 * escribe: sale de la resta.
 *
 * ⚠ **EL RIEL VA ALINEADO A LA DERECHA Y ES LO QUE HACE QUE LAS DOS FORMAS COMPARTAN EJE.**
 * En 2.J la marca cuelga a la izquierda de un riel de 9; aquí, con numeración que puede
 * llegar a dos cifras, alinear a la izquierda dejaría el texto de `10.` desplazado respecto
 * del de `9.`. A la derecha, el punto de todas las cifras cae en la misma vertical.
 */
const LISTA = { riel: 14, medianil: ESPACIO[8] } as const

/**
 * EL SEPARADOR — `filete.regla` en `tinta.reglaSuave`, a todo el ancho de la caja.
 *
 * Es el trazo más discreto que el sistema sabe dibujar, y eso es lo que un separador de
 * cuerpo tiene que ser: el que menos pesa de los que hay en la hoja, por debajo del filete de
 * la cita (1.6) y del principal (2.5).
 */
const SEPARADOR = { grosor: FILETE.regla, color: TINTA.reglaSuave } as const

// ─── El cuerpo, que viene del editor ─────────────────────────────────────────

/**
 * UN TRAMO DE TEXTO CON SUS MARCAS. El cuerpo viene de un editor de texto rico, así que un
 * párrafo no es una cadena: es una secuencia de tramos, cada uno con sus marcas.
 *
 * ⚠ **NO CONTRADICE `CONCILIA D10`.** Aquella regla dice que el sistema no recibe arrays de
 * DATOS tecleados —la lista de estudios de una solicitud, los medicamentos de una receta— y
 * que la estructura viaja dentro de una cadena con viñetas, que analiza 2.J. Aquí la
 * estructura la produce un editor y ya viene analizada: pedirle que la aplane a texto plano
 * para volver a analizarla perdería las marcas, que es justo lo que este formato compone.
 *
 * ⚠ **NEGRITA Y CURSIVA A LA VEZ PIDEN UNA CARA QUE NO EXISTE.** La negrita es peso 500 y la
 * cursiva es 400 itálica; IBM Plex Sans tiene registradas las tres caras que el sistema usa
 * —400, 500 y 400 itálica— pero **no la 500 itálica**. Con las dos marcas juntas se compone
 * la CURSIVA y se pierde el peso, que es la degradación que conserva más información: una
 * cursiva perdida cambia el sentido de una cita textual; medio punto de peso, no. Reportado.
 */
export interface TramoTexto {
  readonly texto: string
  /** `<strong>` del editor. Peso 500, no 600. Ver el punto (c) de la cabecera. */
  readonly negrita?: boolean
  /** `<em>` del editor. 400 itálica. */
  readonly cursiva?: boolean
  /**
   * `<u>` del editor — la marca de nivel 2 de su barra (`EditorEscrito.tsx:125`).
   *
   * Se compone con `textDecoration: 'underline'`, que es una propiedad de decoración y
   * NO de familia, así que **se acumula con las otras dos sin pedir una cara nueva**: a
   * diferencia de negrita+cursiva, subrayado+cursiva o subrayado+negrita se componen
   * enteros. Es la marca menos costosa de las tres.
   */
  readonly subrayado?: boolean
}

/**
 * LA ALINEACIÓN DEL PÁRRAFO — y **es la segunda excepción declarada a I.3.2** del sistema.
 *
 * ⚠ I.3.2 PROHÍBE EL TEXTO JUSTIFICADO EN TODO v2, y hasta ahora la única excepción vivía
 * en `formatos/ConsentimientoInformado.tsx`, escrita en un solo sitio para que
 * `grep -rn "'justify'" src/lib/pdf/v2` devolviera UNA línea. Ahora devuelve dos, y la
 * segunda es esta. Que sean dos y no una es lo que hay que vigilar: si algún día aparece
 * una tercera sin nota, la regla habrá dejado de ser una regla.
 *
 * **Por qué se admite aquí.** Este formato no es una hoja del sistema: es la hoja
 * membretada del médico, donde escribe certificados, constancias y cartas cuyo trámite
 * manda sobre la composición. La barra del editor ofrece las cuatro alineaciones
 * (`EditorEscrito.tsx:236`), el médico las usa, y **perderlas por el camino sería peor que
 * la excepción**: un centrado que desaparece cambia lo que el papel dice de sí mismo.
 *
 * `undefined` es bandera izquierda, que es lo que compone el resto del sistema. No se
 * escribe `'left'` por defecto: así el caso normal no lleva la propiedad y sigue siendo el
 * del chasis, no una alineación elegida que casualmente coincide.
 */
export type AlineacionEscrito = 'left' | 'center' | 'right' | 'justify'

/**
 * UN NODO DEL CUERPO. Son los siete constructores que la lámina declara, menos uno: `p` con
 * aire propio no es un nodo distinto sino el mismo párrafo — el aire lo pone el tipo.
 */
export type NodoEscrito =
  | {
      readonly tipo: 'parrafo'
      readonly tramos: readonly TramoTexto[]
      readonly alineacion?: AlineacionEscrito
    }
  | { readonly tipo: 'encabezado1'; readonly texto: string; readonly alineacion?: AlineacionEscrito }
  | { readonly tipo: 'encabezado2'; readonly texto: string; readonly alineacion?: AlineacionEscrito }
  | {
      readonly tipo: 'lista'
      readonly marca: 'vineta' | 'numero'
      readonly items: readonly (readonly TramoTexto[])[]
    }
  /**
   * La cita lleva alineación porque el editor la deja poner: `TextAlign` está configurado
   * para `['heading', 'paragraph']` (`editorExtensions.ts:15`) y una cita del editor es un
   * `blockquote` que CONTIENE párrafos, así que la marca vive en el párrafo de dentro. El
   * conversor la sube aquí.
   */
  | {
      readonly tipo: 'cita'
      readonly tramos: readonly TramoTexto[]
      readonly alineacion?: AlineacionEscrito
    }
  | { readonly tipo: 'separador' }

// ─── Props ───────────────────────────────────────────────────────────────────

export interface EscritoMedicoProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * El título, que **lo escribe el médico**. Sin él, el bloque compone la variante `ausente`:
   * 20 pt con la fecha sola y su filete. Envuelve a los renglones que haga falta y nunca se
   * recorta.
   */
  readonly asunto?: string
  /**
   * EL NOMBRE DEL DOCUMENTO EN LA BANDA DE PIE. **Es un campo aparte, no un truncado del
   * título** (`CONCILIA D41`): el encabezado puede llevar una constancia de tres renglones y
   * la banda decir `Constancia de atención médica`.
   *
   * Sin él, el título del encabezado; sin ninguno de los dos, `Escrito médico`.
   */
  readonly tituloPie?: string
  /**
   * Fecha de emisión, YA compuesta por quien llama —la lámina imprime `4 ago 2026`, token
   * corto y sin lugar—. Colgada del título en la hoja 1 y rotulada `Emisión` en las de
   * continuación.
   *
   * ⚠ **LA LÍNEA FORMAL DE LUGAR Y FECHA LA ESCRIBE EL MÉDICO DENTRO DEL CUERPO**, según lo
   * que exija el trámite. El sistema no la impone (II.8 §5).
   */
  readonly fecha?: string
  /** El cuerpo, ya analizado por el editor. **Bloquea emisión** si viene vacío (II.8 §2). */
  readonly cuerpo: readonly NodoEscrito[]
  /** Trazo capturado del médico (2.L regla 5). */
  readonly rubrica?: string
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    // Regla 4 de 2.L: reserva los 36 + 16 + 16 pt donde vive la banda de 2.M.
    paddingBottom: MARGEN.inferior,
  },

  /**
   * EL PÁRRAFO Y SUS TRES CARAS. `texto.corrido` sin tocar para la redonda; el peso 500 lo
   * pone `instruccion.texto`, que es el mismo rol un peso por encima; y la cursiva es la
   * redonda con `fontStyle`, que no es un miembro de la escala —I.1.4 no declara estilo, solo
   * familia, cuerpo, peso, tracking y color— y por eso se compone aquí.
   */
  parrafo: { ...estiloTipografico('texto.corrido'), width: CAJA.ancho },
  negrita: { fontWeight: TIPOGRAFIA['instruccion.texto'].peso },
  cursiva: { fontStyle: 'italic' },
  /**
   * El subrayado. `textDecoration` es de las pocas propiedades de decoración que
   * @react-pdf/renderer implementa sobre `Text`, y no toca la familia: por eso esta marca
   * se acumula con la negrita y con la cursiva y aquellas dos no se acumulan entre sí.
   */
  subrayado: { textDecoration: 'underline' },

  encabezado1: { ...estiloTipografico('cuerpo.encabezado1'), width: CAJA.ancho },
  encabezado2: { ...estiloTipografico('cuerpo.encabezado2'), width: CAJA.ancho },

  /** La cita: cuerpo en peso 500, dentro del marco que 2.I pone. */
  cita: { ...estiloTipografico('instruccion.texto') },

  separador: {
    width: CAJA.ancho,
    height: SEPARADOR.grosor,
    backgroundColor: SEPARADOR.color,
  },

  lista: { width: CAJA.ancho },
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  /** El riel de la marca, alineado a la derecha. Ver `LISTA`. */
  rielMarca: {
    width: LISTA.riel,
    marginRight: LISTA.medianil,
    flexShrink: 0,
  },
  /**
   * La marca hereda cuerpo e interlineado del texto del ítem y cambia de familia y de tinta:
   * es `item.raya`, el mismo rol con el que II.6 compone las suyas.
   */
  marca: { ...estiloTipografico('item.raya'), textAlign: 'right' },
  cajaItem: { flex: 1 },

  /** La fila de cierre: la firma sola, a la izquierda, en su columna de 246. */
  filaCierre: { flexDirection: 'row' },
})

// ─── Composición del cuerpo ──────────────────────────────────────────────────

/**
 * Los tramos de un párrafo, con sus marcas. Un tramo sin marcas no monta `Text` anidado: es
 * la cadena tal cual, que es lo que compone la inmensa mayoría del cuerpo.
 */
function Tramos({ tramos }: { tramos: readonly TramoTexto[] }): ReactElement {
  return (
    <>
      {tramos.map((tramo, i) =>
        tramo.negrita !== true && tramo.cursiva !== true && tramo.subrayado !== true ? (
          // El índice ES la identidad: los tramos salen de un editor y su orden es lo único
          // que los distingue —dos pueden decir lo mismo—.
          <Text key={i}>{tramo.texto}</Text>
        ) : (
          <Text
            key={i}
            style={[
              // Con las dos marcas gana la cursiva: no hay 500 itálica registrada. Ver
              // `TramoTexto`.
              tramo.negrita === true && tramo.cursiva !== true ? estilos.negrita : {},
              tramo.cursiva === true ? estilos.cursiva : {},
              // El subrayado NO compite con las otras dos: es decoración, no familia, así
              // que se acumula con cualquiera de ellas sin pedir una cara registrada.
              tramo.subrayado === true ? estilos.subrayado : {},
            ]}
          >
            {tramo.texto}
          </Text>
        ),
      )}
    </>
  )
}

/** Un ítem de lista: la marca en su riel a la derecha y el texto al lado. */
function Item({
  tramos,
  marca,
}: {
  tramos: readonly TramoTexto[]
  marca: string
}): ReactElement {
  return (
    <View style={estilos.item}>
      <View style={estilos.rielMarca}>
        <Text style={estilos.marca}>{marca}</Text>
      </View>
      <Text style={[estilos.parrafo, estilos.cajaItem]}>
        <Tramos tramos={tramos} />
      </Text>
    </View>
  )
}

/** El aire que cada nodo guarda con lo que tiene encima. Ver `AIRE`. */
function aireDe(nodo: NodoEscrito): number {
  if (nodo.tipo === 'encabezado1') return AIRE.encabezado1
  if (nodo.tipo === 'encabezado2') return AIRE.encabezado2
  if (nodo.tipo === 'lista') return AIRE.lista
  if (nodo.tipo === 'cita') return AIRE.cita
  if (nodo.tipo === 'separador') return AIRE.separador
  return AIRE.parrafo
}

/**
 * UN NODO DEL CUERPO, ya compuesto.
 *
 * `orphans` y `widows` van en los párrafos, que es donde I.1.9 los declara y donde el cuerpo
 * de este formato los necesita: es el único cuyo texto puede tener veinte párrafos seguidos.
 * Valen 2 y 2, que es el valor por defecto del renderer, así que hoy no cambian nada — el día
 * que I.1.9 mueva cualquiera de los dos, este archivo lo sigue.
 */
function Nodo({
  nodo,
  primero,
}: {
  nodo: NodoEscrito
  primero: boolean
}): ReactElement {
  const separacion = primero ? {} : { marginTop: aireDe(nodo) }

  /**
   * La alineación, o nada. `undefined` deja la bandera izquierda del chasis en vez de
   * escribir `'left'`: así el caso normal no lleva la propiedad. Ver `AlineacionEscrito`,
   * donde está declarada la excepción a I.3.2 que esto abre.
   */
  const alineacion =
    nodo.tipo === 'separador' || nodo.tipo === 'lista' || nodo.alineacion === undefined
      ? {}
      : { textAlign: nodo.alineacion }

  if (nodo.tipo === 'separador') {
    return <View style={[estilos.separador, separacion]} />
  }

  if (nodo.tipo === 'encabezado1' || nodo.tipo === 'encabezado2') {
    /*
      `break-after: avoid` de la lámina: un encabezado no se queda solo al pie de una hoja.
      react-pdf no tiene esa propiedad, así que lo que se compone es lo que sí tiene —
      `wrap={false}` sobre el encabezado— y el arrastre de su primer párrafo queda **sin
      componer**: no hay forma de declarar «no cortes DESPUÉS de este nodo». Reportado.
    */
    return (
      <Text
        style={[
          nodo.tipo === 'encabezado1' ? estilos.encabezado1 : estilos.encabezado2,
          separacion,
          alineacion,
        ]}
        wrap={false}
      >
        {nodo.texto.toUpperCase()}
      </Text>
    )
  }

  if (nodo.tipo === 'cita') {
    return (
      <View style={separacion}>
        <BloqueDestacado
          variante="cita"
          lamina={LAMINA}
          contenido={
            <Text style={[estilos.cita, alineacion]}>
              <Tramos tramos={nodo.tramos} />
            </Text>
          }
        />
      </View>
    )
  }

  if (nodo.tipo === 'lista') {
    return (
      <View style={[estilos.lista, separacion]}>
        {nodo.items.map((tramos, i) => (
          <Item
            key={i}
            tramos={tramos}
            marca={nodo.marca === 'numero' ? `${i + 1}.` : RAYA}
          />
        ))}
      </View>
    )
  }

  return (
    <Text style={[estilos.parrafo, separacion, alineacion]} orphans={2} widows={2}>
      <Tramos tramos={nodo.tramos} />
    </Text>
  )
}

// ─── El formato ──────────────────────────────────────────────────────────────

/** II.8 · Escrito Médico. */
export default function EscritoMedico({
  medico,
  consultorio,
  panel,
  acento,
  asunto,
  tituloPie,
  fecha,
  cuerpo,
  rubrica,
}: EscritoMedicoProps): ReactElement {
  const hayTitulo = tieneValor(asunto)
  /**
   * EL NOMBRE DEL DOCUMENTO, en cascada: el campo propio, el título del encabezado y el
   * genérico. Lo usan la banda de pie y el rótulo de las hojas de continuación, que son los
   * dos sitios donde el documento tiene que decir cómo se llama aunque nadie lo haya nombrado.
   */
  const nombre = tieneValor(tituloPie)
    ? tituloPie
    : hayTitulo
      ? asunto
      : TITULO_PIE_POR_DEFECTO

  /**
   * La firma del médico tratante, la única del formato. Los renglones bajo la línea salen de
   * I.1.9 y son los mismos que el membrete imprime arriba: se toman de `MedicoMembrete` en
   * vez de pedirlos otra vez.
   *
   * Anotado y no aseverado: 2.L pide una tupla de una firma y la anotación se la da sin `as`.
   */
  const firmas: readonly [Firma] = [
    { rol: ROTULO_FIRMA, nombre: medico.nombre, credenciales: medico.cedulas, rubrica },
  ]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          lamina: LAMINA,
          /*
            EL TÍTULO Y EL NOMBRE SON DOS COSAS, y este es el único formato donde se separan.
            Arriba se imprime el TÍTULO, entero y envolviendo los renglones que haga falta; en
            las hojas de continuación y en la banda de pie se usa el NOMBRE, que existe
            siempre. Por eso `tituloAusente` es un booleano y no un título vacío: sin título
            el documento sigue teniendo nombre. Ver esas dos props en 2.V.
          */
          titulo: hayTitulo ? asunto : nombre,
          nombreDocumento: nombre,
          tituloAusente: !hayTitulo,
          fecha,
          emision: fecha,
        }}
        aireFirma={AIRE.firma}
        firmas={
          /*
            LA FILA DE CIERRE. Una sola firma, en la columna izquierda de 246 pt que I.1.3
            declara, y sin nada a la derecha: este formato no tiene QR que poner ahí.
          */
          <View style={estilos.filaCierre}>
            <BloqueFirmas variante="simple" lamina={LAMINA} firmas={firmas} />
          </View>
        }
      >
        {/*
          ═══ EL CUERPO ═══

          Los nodos que el editor produjo, en su orden. El primero no lleva aire: cuelga del
          filete del título, y esa separación —los 20 pt de 2.C— ya la aporta el bloque de
          arriba. Sumar aquí el aire del nodo la contaría dos veces.
        */}
        {cuerpo.map((nodo, indice) => (
          // El índice ES la identidad: los nodos salen de un editor y su orden es lo único
          // que los distingue.
          <Nodo key={indice} nodo={nodo} primero={indice === 0} />
        ))}
      </MotorFlujo>

      {/*
        Variante `sin folio`, con las tres zonas de esta lámina: paginación a la izquierda,
        nombre del documento al centro **con elipsis** y leyenda a la derecha. Es el único
        formato del sistema sin folio y sin QR, y el único con recorte. Ver 2.M.
      */}
      <PieDocumento
        variante="sinFolio"
        lamina={LAMINA}
        titulo={nombre}
        acento={acento}
      />
    </Page>
  )
}
