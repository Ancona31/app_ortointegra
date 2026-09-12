/**
 * Sistema de documentos v2 — el analizador de 2.J · `ParserBloques`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.J. Transcripción, no diseño.
 *
 * POR QUÉ ESTE ARCHIVO ESTÁ SEPARADO DEL COMPONENTE
 *
 * `ParserBloques.tsx` compone; esto decide. La ficha dice que 2.J es **el
 * componente de mayor riesgo del proyecto** y que se escribe con su batería de
 * pruebas al lado: separar la decisión de la composición es lo que permite que la
 * batería —`src/lib/tests/parserBloques.test.ts`— pruebe los siete casos sin
 * montar un PDF ni arrastrar `@react-pdf/renderer` a un entorno de node. No es
 * una capa de abstracción: es la mitad testable de un solo componente.
 *
 * LAS CUATRO REGLAS DEL PARSER
 *
 *   Línea que empieza con viñeta          → ítem
 *   Línea sin viñeta CON ítems debajo     → encabezado de bloque
 *   Línea sin viñeta SIN ítems debajo     → párrafo suelto, sin versalita
 *   Línea vacía                           → corte, se descarta
 *
 * **EL LOOKAHEAD ES OBLIGATORIO Y ES EL MOTIVO DE ESTE ARCHIVO.** Decidir el tipo
 * de una línea exige mirar la SIGUIENTE. Sin él, la prosa sin viñetas se compone
 * en versalita como si fuera título: es el bug que apareció en el mockup de
 * Internamiento y es el caso 2 de la batería, que se prueba antes que ningún otro.
 *
 * DEGRADACIÓN SEGURA — REQUISITO, NO EFECTO COLATERAL
 *
 * La viñeta vive en el DATO, no en el render: este módulo no reescribe el texto
 * de origen, solo lo lee. Si el análisis se equivoca, lo peor que sale es prosa
 * —una línea por párrafo, en el orden en que venía— y nunca un párrafo
 * apelmazado: **dos líneas que el dato separó no se juntan aquí jamás**. Por eso
 * no hay ninguna rama que concatene líneas, y ninguna función de este archivo
 * lanza: una entrada rara produce nodos pobres, no una excepción a media hoja.
 */

/**
 * Las viñetas que se reconocen en el dato. Guion, raya, semirraya, punto y
 * asterisco, más el prefijo numérico que produce cualquier editor cuando alguien
 * teclea una lista ordenada.
 *
 * **La viñeta tiene que ir seguida de espacio.** Sin esa exigencia, una línea de
 * prosa que empiece por raya —«—dijo el paciente»— se leería como ítem. Con ella,
 * el peor caso es el contrario: un ítem mal tecleado se compone como prosa, que
 * es el lado seguro de la degradación.
 *
 * El prefijo numérico se reconoce **como viñeta y se descarta**, igual que los
 * demás: si la lista va numerada, el número lo pone el sistema y corrido (caso 7).
 * Nunca se imprimen los dos, que es la regla 1 de composición de la ficha.
 */
const VINETA = /^\s*(?:[-–—•*]|\d+[.)])\s+/

/** Un nodo del texto analizado. `bloque` los agrupa; ver `analizar()`. */
export type NodoParser =
  | { readonly tipo: 'encabezado'; readonly texto: string; readonly bloque: number }
  | { readonly tipo: 'parrafo'; readonly texto: string; readonly bloque: number }
  /**
   * `ordinal` es el número corrido del ítem en TODA la cadena, empezando en 1.
   * Corre entre bloques a propósito: dos bloques seguidos no repiten el 1 (caso 7
   * de la batería). Se calcula aunque el consumidor vaya a componer con raya —
   * quién usa el ordinal lo decide la composición, no el análisis.
   */
  | { readonly tipo: 'item'; readonly texto: string; readonly bloque: number; readonly ordinal: number }

type Clase = 'vacia' | 'item' | 'prosa'

interface LineaClasificada {
  readonly clase: Clase
  /** Ya sin viñeta y sin espacios de los extremos. */
  readonly texto: string
}

function clasificar(linea: string): LineaClasificada {
  if (linea.trim() === '') return { clase: 'vacia', texto: '' }
  const vineta = VINETA.exec(linea)
  if (vineta !== null) {
    return { clase: 'item', texto: linea.slice(vineta[0].length).trim() }
  }
  return { clase: 'prosa', texto: linea.trim() }
}

/**
 * Analiza UNA SOLA CADENA (`CONCILIA D10`: el sistema no recibe arrays).
 *
 * QUÉ ES UN BLOQUE, Y QUÉ CORTA
 *
 * Un bloque es un encabezado con sus ítems, o una tirada de prosa: lo que se
 * compone junto. Se cierra de dos maneras — con una línea vacía, que es el corte
 * que declara la ficha, y con un encabezado nuevo, que abre el suyo.
 *
 * **UNA LÍNEA VACÍA CORTA DE VERDAD**, y por eso el lookahead mira la línea
 * siguiente y no la siguiente no vacía. Es la lectura conservadora y es
 * deliberada: si el lookahead saltara los blancos, esto
 *
 *     El paciente ingresa hoy.
 *     (línea vacía)
 *     - Dieta blanda
 *
 * ascendería «El paciente ingresa hoy.» a encabezado en versalita **por una lista
 * que no es suya** — el caso 2 entrando por la otra puerta. El precio es que un
 * encabezado separado de sus viñetas por un renglón en blanco se compone como
 * párrafo; el texto sigue siendo una lista legible con su encabezado en prosa, que
 * es exactamente lo que la degradación segura promete.
 *
 * CON UN SOLO ÍTEM NO SE NUMERA, Y EL ALCANCE ES LA CADENA ENTERA
 *
 * Un único ítem en todo el texto no es una lista: se compone como párrafo. El
 * alcance es global y no por bloque, por dos razones. La ficha lo contrasta con
 * 2.G —«donde una sola entrada SÍ lleva su número»—, y ahí «una sola» es del
 * documento entero. Y por bloque, dos ítems separados por un renglón en blanco
 * serían dos listas de uno y perderían los dos su raya, que es justo el
 * apelmazamiento que la degradación segura prohíbe.
 *
 * Cuando eso ocurre, **el encabezado que tuviera encima sigue siendo encabezado**:
 * lo decidió el lookahead sobre el texto de origen, donde sí había un ítem debajo,
 * y sigue agrupando lo que va debajo de él.
 */
export function analizar(texto: string): readonly NodoParser[] {
  const lineas = texto.split(/\r?\n/).map(clasificar)

  const crudos: NodoParser[] = []
  let bloque = 0
  /** ¿El bloque en curso ya tiene algún nodo? Evita cortar en el vacío. */
  let abierto = false

  lineas.forEach((linea, i) => {
    if (linea.clase === 'vacia') {
      // Corte. La línea no produce nodo: «se descarta» de la tabla de la ficha.
      if (abierto) {
        bloque += 1
        abierto = false
      }
      return
    }

    if (linea.clase === 'item') {
      // El ordinal se pone en la segunda pasada, cuando ya se sabe cuántos hay.
      crudos.push({ tipo: 'item', texto: linea.texto, bloque, ordinal: 0 })
      abierto = true
      return
    }

    // Prosa: aquí y solo aquí decide el LOOKAHEAD.
    const siguiente = lineas[i + 1]
    const tieneItemsDebajo = siguiente !== undefined && siguiente.clase === 'item'

    if (tieneItemsDebajo && abierto) bloque += 1
    crudos.push({
      tipo: tieneItemsDebajo ? 'encabezado' : 'parrafo',
      texto: linea.texto,
      bloque,
    })
    abierto = true
  })

  const items = crudos.filter((n) => n.tipo === 'item')
  const degradarItemUnico = items.length === 1

  let ordinal = 0
  return crudos.map((nodo) => {
    if (nodo.tipo !== 'item') return nodo
    if (degradarItemUnico) {
      return { tipo: 'parrafo', texto: nodo.texto, bloque: nodo.bloque }
    }
    ordinal += 1
    return { ...nodo, ordinal }
  })
}
