/**
 * Generador de `src/lib/pdf/v2/metricasNombre.ts`.
 *
 * POR QUÉ EXISTE UNA TABLA EN VEZ DE MEDIR EN CALIENTE
 *
 * El cuerpo del nombre del membrete se deriva de su ancho compuesto (2.B), y ese
 * ancho hay que conocerlo **en el render de React**, que en react-pdf ocurre ANTES
 * de que el renderer resuelva y cargue las tipografías: dentro del componente no
 * hay ninguna métrica disponible todavía. Y la generación de PDF vive en el
 * CLIENTE (ver la cabecera de `fonts.ts`), donde no se puede abrir el TTF por
 * filesystem. Una tabla generada es la única forma de tener la medida real,
 * síncrona, y en los dos entornos.
 *
 * NO ES UNA CUENTA DE CARACTERES. Los avances y el kerning salen del binario real
 * con fontkit —el mismo motor que usa react-pdf—, así que la cifra es la que el
 * renderer compone, no una aproximación por longitud.
 *
 * CÓMO SE REGENERA (solo si se repone `Archivo-SemiBold.ttf`):
 *
 *     node scripts/generar-metricas-nombre.mjs
 *
 * ⚠ Si el TTF cambia y esto no se vuelve a correr, la tabla queda obsoleta y el
 * cuerpo elegido deja de corresponder al ancho real. `membreteNombre.test.ts`
 * concilia la tabla contra el PDF compuesto y falla si eso pasa.
 */

import * as fontkit from 'fontkit'
import { writeFileSync } from 'node:fs'

const TTF = 'public/fonts/Archivo-SemiBold.ttf'
const SALIDA = 'src/lib/pdf/v2/metricasNombre.ts'

/**
 * Juego de caracteres con AVANCE tabulado. Generoso a propósito: ASCII imprimible
 * más el suplemento Latin-1 y el Latin Extended-A, que cubre cualquier nombre
 * hispano y la mayoría de los europeos.
 */
const CON_AVANCE = []
for (let c = 0x20; c <= 0x7e; c++) CON_AVANCE.push(String.fromCodePoint(c))
for (let c = 0xa0; c <= 0x17f; c++) CON_AVANCE.push(String.fromCodePoint(c))

/**
 * Juego con PARES DE KERNING tabulados. Más corto que el anterior, y no es un
 * descuido: los pares crecen al cuadrado, y un par ausente se trata como kerning
 * cero, que **sobreestima** el ancho —todos los pares de esta fuente son
 * negativos o nulos— y por tanto encoge de más, nunca de menos. Errar hacia el
 * lado que no desborda es la razón de que el recorte sea aceptable.
 */
const CON_KERNING = (
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  'ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÇç' +
  " .-'"
).split('')

const fuente = fontkit.openSync(TTF)
if (fuente.unitsPerEm !== 1000) {
  throw new Error(`unitsPerEm inesperado: ${fuente.unitsPerEm}. Revisa el generador.`)
}

const avances = {}
for (const ch of CON_AVANCE) {
  const glifo = fuente.glyphForCodePoint(ch.codePointAt(0))
  if (glifo === undefined || glifo.id === 0) continue
  avances[ch] = Math.round(glifo.advanceWidth)
}

const kerning = {}
let positivos = 0
for (const a of CON_KERNING) {
  for (const b of CON_KERNING) {
    const k =
      fuente.layout(a + b).advanceWidth -
      fuente.layout(a).advanceWidth -
      fuente.layout(b).advanceWidth
    if (k === 0) continue
    if (k > 0) positivos += 1
    kerning[a + b] = Math.round(k)
  }
}

const cabecera = `/**
 * MÉTRICAS DE \`Archivo SemiBold\` — **ARCHIVO GENERADO. NO SE EDITA A MANO.**
 *
 * Lo produce \`scripts/generar-metricas-nombre.mjs\` leyendo el binario real de
 * \`public/fonts/Archivo-SemiBold.ttf\` con fontkit, que es el mismo motor de
 * métricas que usa react-pdf. Las cifras son avances y pares de kerning del
 * archivo, no una estimación por número de caracteres.
 *
 * Para qué sirve: 2.B deriva el CUERPO del nombre del médico de su ancho
 * compuesto, y ese ancho hace falta durante el render de React, cuando el
 * renderer todavía no ha cargado ninguna tipografía. Ver la cabecera del
 * generador.
 *
 * Unidades: milésimas de em (\`unitsPerEm\` = 1000).
 */

`

const cuerpo = `/** Avance por carácter, en milésimas de em. */
const AVANCE: Readonly<Record<string, number>> = ${JSON.stringify(avances)}

/**
 * Ajuste de kerning por par, en milésimas de em. Un par ausente vale cero.
 *
 * Son ${Object.keys(kerning).length} pares, y ${Object.keys(kerning).length - positivos} de ellos son ≤ 0. Por eso tratar un par NO
 * tabulado como cero sobreestima el ancho, que es la dirección segura: se encoge
 * un poco de más y nunca se desborda la caja.
 *
 * ⚠ **HAY ${positivos} PAR POSITIVO Y ESTÁ TABULADO**: ${JSON.stringify(
   Object.entries(kerning).filter(([, v]) => v > 0),
 )}. Al estar en la tabla se
 * compone exacto, así que no rompe lo anterior. Lo que queda como supuesto —no
 * como hecho comprobado— es que ningún par FUERA del juego tabulado sea positivo;
 * si algún día aparece uno, el ancho se subestimaría y podría desbordar.
 */
const KERNING: Readonly<Record<string, number>> = ${JSON.stringify(kerning)}

/**
 * Avance del carácter que se usa cuando uno no está tabulado.
 *
 * Es el más ancho de la tabla, no una media: un carácter desconocido tiene que
 * empujar hacia el recorte y no hacia el desbordamiento.
 */
const AVANCE_DESCONOCIDO = ${Math.max(...Object.values(avances))}

/**
 * Avance compuesto de una cadena, en milésimas de em, kerning incluido.
 *
 * Es lo que react-pdf compone SIN contar el tracking: el tracking va en puntos y
 * depende del cuerpo, así que lo suma quien conoce el cuerpo.
 */
export function avanceRelativo(texto: string): number {
  const chars = [...texto]
  let total = 0
  for (let i = 0; i < chars.length; i += 1) {
    total += AVANCE[chars[i]] ?? AVANCE_DESCONOCIDO
    if (i > 0) total += KERNING[chars[i - 1] + chars[i]] ?? 0
  }
  return total
}
`

writeFileSync(SALIDA, cabecera + cuerpo)
console.log(
  `${SALIDA}: ${Object.keys(avances).length} avances, ` +
    `${Object.keys(kerning).length} pares de kerning (${positivos} positivos).`,
)
