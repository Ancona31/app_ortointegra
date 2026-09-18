/**
 * II.2 · Solicitud de Imagenología — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. El
 * defecto que destapó la conciliación de 4.1 fue exactamente eso — un
 * `M.encabezado = 217` escrito a mano contra una lámina que medía 223.05—, y una
 * prueba que comparase tokens contra tokens lo habría dado por bueno. Aquí se
 * renderiza el PDF, se leen las coordenadas de su flujo de contenido y se mide.
 *
 * QUÉ TIENE QUE DAR
 *
 * La medición de `Solicitud de Imagen.dc.html` da **232.88 pt** de encabezado
 * desde el margen de 54. De ahí sale una sola resta, documentada en la cabecera
 * del formato:
 *
 *     232.88   la lámina
 *     −  3     el panel: 56 pt en el chasis (border-box) contra 59 en la lámina
 *     ──────
 *      229.88  lo que este archivo compone
 *
 * Los 3 pt son el único punto donde el chasis no puede componer la lámina sin
 * mover geometría compartida por los ocho formatos (2.A), y por eso se miden aquí
 * en vez de taparse: **si algún día el panel pasa a 59, esta prueba falla y es la
 * señal correcta.**
 *
 * ⚠ Una versión anterior de esta prueba esperaba 217.88, restando además los 12 pt
 * del espaciador que cierra el membrete por haberlo leído como un renglón vacío.
 * No lo es: es lo que separa el membrete del documento, vive en 2.B y viaja a los
 * ocho formatos.
 *
 * CÓMO LEE LAS COORDENADAS
 *
 * react-pdf abre la página con `1 0 0 -1 0 792 cm`, así que dentro del flujo el
 * eje Y ya crece hacia ABAJO, y sitúa cada caja anidando traslaciones `cm` en vez
 * de escribir posiciones absolutas: un renglón se dibuja siempre con el mismo
 * `1 0 0 1 0 792 Tm` y lo que lo coloca es la pila de matrices que tiene encima.
 * Leer el `Tm` sin llevar esa pila da coordenadas fuera del papel. Por eso el
 * lector de abajo mantiene la CTM con su `q`/`Q`, que es lo mínimo que hace falta
 * para que un número de este archivo signifique algo.
 *
 * Los filetes salen como rectángulos `x y w h re`; las reglas del riel y de la
 * lista no —el renderer las dibuja como trazos recortados—, así que las cotas se
 * anclan a los filetes, que sí son rectángulos, y al texto.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import SolicitudImagenologia, {
  type EstudioSolicitado,
  type SolicitudImagenologiaProps,
} from '@/lib/pdf/v2/formatos/SolicitudImagenologia'
import {
  CAJA,
  MARGEN,
  PAPEL,
  TIPOGRAFIA,
  resolverAcento,
  ACENTO_BASE_POR_DEFECTO,
} from '@/lib/pdf/v2/tokens'

const h = React.createElement

/** Las mismas familias que `registrarFuentesV2()`, por ruta de disco. */
function registrarFuentesDeDisco(): void {
  const ruta = (archivo: string): string =>
    path.resolve(process.cwd(), 'public/fonts', archivo)

  Font.registerHyphenationCallback((palabra: string) => [palabra])
  Font.register({
    family: 'Archivo',
    fonts: [
      { src: ruta('Archivo-Regular.ttf'), fontWeight: 400 },
      { src: ruta('Archivo-Medium.ttf'), fontWeight: 500 },
      { src: ruta('Archivo-SemiBold.ttf'), fontWeight: 600 },
    ],
  })
  Font.register({
    family: 'IBM Plex Sans',
    fonts: [
      { src: ruta('IBMPlexSans-Regular.ttf'), fontWeight: 400 },
      { src: ruta('IBMPlexSans-Medium.ttf'), fontWeight: 500 },
    ],
  })
}

// ─── Lector del flujo de contenido ───────────────────────────────────────────

/** Matriz de transformación `[a b c d e f]`, como la escribe el operador `cm`. */
type Matriz = readonly [number, number, number, number, number, number]

const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0]

/** `cm` premultiplica: la nueva matriz se aplica ANTES que la que ya estaba. */
function concatenar(nueva: Matriz, previa: Matriz): Matriz {
  return [
    nueva[0] * previa[0] + nueva[1] * previa[2],
    nueva[0] * previa[1] + nueva[1] * previa[3],
    nueva[2] * previa[0] + nueva[3] * previa[2],
    nueva[2] * previa[1] + nueva[3] * previa[3],
    nueva[4] * previa[0] + nueva[5] * previa[2] + previa[4],
    nueva[4] * previa[1] + nueva[5] * previa[3] + previa[5],
  ]
}

function aplicar(m: Matriz, x: number, y: number): readonly [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** Una línea de texto dibujada. `arriba` es su LÍNEA BASE desde el borde superior. */
interface Renglon {
  readonly texto: string
  readonly arriba: number
  readonly x: number
}

/** Un rectángulo relleno: filetes y barras. `arriba` es su borde superior. */
interface Rectangulo {
  readonly arriba: number
  readonly x: number
  readonly ancho: number
  readonly alto: number
}

interface Hoja {
  readonly renglones: readonly Renglon[]
  readonly rectangulos: readonly Rectangulo[]
}

function objetos(pdf: string): Map<number, string> {
  const mapa = new Map<number, string>()
  for (const m of pdf.matchAll(/(?:^|\n)(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) {
    mapa.set(Number(m[1]), m[2])
  }
  return mapa
}

function flujo(cuerpo: string): string {
  const inicio = cuerpo.indexOf('stream\n') + 'stream\n'.length
  const crudo = Buffer.from(cuerpo.slice(inicio, cuerpo.indexOf('\nendstream')), 'latin1')
  return cuerpo.includes('/FlateDecode')
    ? zlib.inflateSync(crudo).toString('latin1')
    : crudo.toString('latin1')
}

/**
 * Índice de glifo → carácter. react-pdf incrusta subconjuntos con `Identity-H`,
 * así que lo que viaja en el operador de texto son índices de dos bytes.
 */
function tablaUnicode(cmap: string): Map<number, string> {
  const tabla = new Map<number, string>()
  for (const m of cmap.matchAll(/<([0-9a-f]{4})>\s*<([0-9a-f]+)>/gi)) {
    tabla.set(parseInt(m[1], 16), Buffer.from(m[2], 'hex').swap16().toString('utf16le'))
  }
  return tabla
}

const OPERADORES = new RegExp(
  [
    '(q)\\n',
    '(Q)\\n',
    '(-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) cm',
    '\\/(\\w+) [\\d.]+ Tf',
    '(-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) Tm',
    '\\[([^\\]]*)\\] TJ',
    '(-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) (-?[\\d.]+) re',
  ].join('|'),
  'g',
)

/** Todo lo que cada hoja dibuja, en coordenadas de papel medidas desde arriba. */
function hojas(pdf: Buffer): Hoja[] {
  const bruto = pdf.toString('latin1')
  const objs = objetos(bruto)

  const tablas = new Map<string, Map<number, string>>()
  for (const dicc of bruto.matchAll(/\/Font <<([^>]*)>>/g)) {
    for (const par of dicc[1].matchAll(/\/(\w+) (\d+) 0 R/g)) {
      const fuente = objs.get(Number(par[2])) ?? ''
      const ref = fuente.match(/\/ToUnicode (\d+) 0 R/)
      if (ref === null) continue
      tablas.set(par[1], tablaUnicode(flujo(objs.get(Number(ref[1])) ?? '')))
    }
  }

  const resultado: Hoja[] = []
  for (const pagina of bruto.matchAll(/\/Type \/Page\n[\s\S]*?\/Contents (\d+) 0 R/g)) {
    const contenido = flujo(objs.get(Number(pagina[1])) ?? '')
    const renglones: Renglon[] = []
    const rectangulos: Rectangulo[] = []
    const pila: Matriz[] = []
    let ctm: Matriz = IDENTIDAD
    let tabla: Map<number, string> | undefined
    let texto = ''
    let posicion: readonly [number, number] = [0, 0]

    const cerrarRenglon = (): void => {
      if (texto !== '') {
        renglones.push({ texto, arriba: PAPEL.alto - posicion[1], x: posicion[0] })
      }
      texto = ''
    }

    for (const t of contenido.matchAll(OPERADORES)) {
      if (t[1] !== undefined) {
        pila.push(ctm)
        continue
      }
      if (t[2] !== undefined) {
        ctm = pila.pop() ?? IDENTIDAD
        continue
      }
      if (t[3] !== undefined) {
        ctm = concatenar(
          [+t[3], +t[4], +t[5], +t[6], +t[7], +t[8]] as const,
          ctm,
        )
        continue
      }
      if (t[9] !== undefined) {
        tabla = tablas.get(t[9])
        continue
      }
      if (t[10] !== undefined) {
        cerrarRenglon()
        posicion = aplicar(ctm, +t[14], +t[15])
        continue
      }
      if (t[16] !== undefined) {
        for (const cadena of t[16].matchAll(/<([0-9a-f]+)>/gi)) {
          for (let i = 0; i < cadena[1].length; i += 4) {
            texto += tabla?.get(parseInt(cadena[1].slice(i, i + 4), 16)) ?? ''
          }
        }
        continue
      }
      const [x0, y0] = aplicar(ctm, +t[17], +t[18])
      const [x1, y1] = aplicar(ctm, +t[17] + +t[19], +t[18] + +t[20])
      rectangulos.push({
        x: Math.min(x0, x1),
        arriba: PAPEL.alto - Math.max(y0, y1),
        ancho: Math.abs(x1 - x0),
        alto: Math.abs(y1 - y0),
      })
    }
    cerrarRenglon()
    resultado.push({ renglones, rectangulos })
  }
  return resultado
}

/** El primer renglón cuyo texto empieza por `prefijo`. */
function renglon(hoja: Hoja, prefijo: string): Renglon {
  const encontrado = hoja.renglones.find((r) => r.texto.startsWith(prefijo))
  if (encontrado === undefined) {
    throw new Error(`Ningún renglón empieza por «${prefijo}»`)
  }
  return encontrado
}

/** Los filetes de una medida, de arriba abajo. */
function filetes(hoja: Hoja, ancho: number, alto: number): readonly Rectangulo[] {
  return hoja.rectangulos
    .filter((r) => r.ancho === ancho && r.alto === alto)
    .sort((a, b) => a.arriba - b.arriba)
}

/**
 * Dónde ABRE la caja de la cabecera de la lista, que es donde termina el
 * encabezado. Se ancla a su filete —un rectángulo, y por tanto medible— y se le
 * restan los dos sumandos que la cabecera compone encima: su aire y el renglón del
 * rótulo.
 *
 * ⚠ v3 · el aire baja de 5 a 3 y **`ESPACIO[5]` deja de existir**: la escala se reduce
 * a nueve miembros pares. Con el miembro retirado, esta resta daba `NaN` y las cuatro
 * cotas que la usan fallaban sin decir por qué.
 */
const AIRE_CABECERA_LISTA = 3

function abreLaLista(hoja: Hoja): number {
  const filete = filetes(hoja, 64, 2)[0]
  return (
    filete.arriba - AIRE_CABECERA_LISTA - (TIPOGRAFIA['titulo.seccion'].interlineado ?? 0)
  )
}

// ─── El caso ─────────────────────────────────────────────────────────────────

registrarFuentesDeDisco()

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

const COMUN = {
  medico: {
    nombre: 'Dra. Elena Marín Solís',
    especialidad: 'Ortopedia y Traumatología',
    universidad: 'Universidad Nacional Autónoma de México',
    cedulas: ['Céd. Prof. 7000001', 'Céd. Esp. 8000002'],
  },
  consultorio: {
    domicilio: 'Av. Ficticia 100, Consultorio 3, Col. Ejemplo, 06700 CDMX',
    telefono: 'Tel. 55 0000 0000',
  },
  panel: { variante: 'monograma', acento, iniciales: 'EM' },
  acento,
  paciente: {
    paciente: 'María Fernanda Ruiz Ortega',
    edad: '54 años',
    sexo: 'Femenino',
    expediente: 'EXP-004821',
    diagnostico: 'Gonartrosis bilateral grado III',
  },
  emision: '7 ago 2026 · 10:45',
  folio: 'IMG-2026-0148',
  // v3 · requerida: el distintivo de urgencia se declara, no se deduce de su ausencia.
  urgente: false,
} satisfies Omit<SolicitudImagenologiaProps, 'estudios'>

/**
 * LOS CUATRO ESTADOS DE LA ENTRADA, en el orden de la lámina. Cada ancla empieza
 * por una palabra distinta para poder localizarla en el texto extraído.
 */
const CUATRO_ESTADOS: readonly EstudioSolicitado[] = [
  {
    tipo: 'Radiografía',
    region: 'Rodilla derecha',
    proyecciones: 'AP y lateral',
    indicacion: 'Valorar interlínea articular en carga.',
  },
  {
    tipo: 'Resonancia magnética',
    region: 'Rodilla izquierda',
    indicacion: 'Descartar lesión meniscal medial.',
  },
  {
    tipo: 'Tomografía computarizada',
    region: 'Columna lumbar',
    proyecciones: 'Cortes axiales de 1 mm',
  },
  { tipo: 'Densitometría ósea', region: 'Cadera y columna lumbar' },
]

async function componer(
  estudios: readonly EstudioSolicitado[],
  extra: Partial<SolicitudImagenologiaProps> = {},
): Promise<Hoja[]> {
  return hojas(
    await renderToBuffer(
      h<DocumentProps>(
        Document,
        {},
        h(SolicitudImagenologia, { ...COMUN, estudios, ...extra }),
      ),
    ),
  )
}

describe('II.2 · Solicitud de Imagenología — medido sobre el PDF', () => {
  it('compone el encabezado en 178.50 pt desde el margen', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    /*
      ⚠ **ERAN 229.88 Y SON 178.50: 51.38 pt MENOS, Y ES EL REDISEÑO.**
      El panel baja de 56 a 40, el nombre del médico de 26 a 15, la banda de dirección
      pasa de DOS renglones a uno, el bloque de título encoge con su rótulo a 15 y la
      celda de la ficha de 33 a 27. La cota vieja describía la maqueta de v2; lo que esta
      prueba defiende —que el encabezado tenga UNA cifra y no derive sin que nadie se
      entere— no cambia.
    */
    expect(abreLaLista(hoja) - MARGEN.superior).toBeCloseTo(178.50, 2)
  }, 60_000)

  it('sitúa los bloques del encabezado donde v3 los compone', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    /*
      ⚠ **LOS ANCLAJES CAMBIAN PORQUE LOS RECTÁNGULOS CAMBIAN.**
      v2 medía dos filetes de 96 × 2.5 —el del membrete y el del título— y los leía en
      una sola llamada. En v3 el bloque de título **no repite el segmento grueso** (se
      gasta una vez por hoja, y se gasta en el membrete), así que sólo queda uno, y mide
      72 × 2. El filete del título es un borde y no un rectángulo: no se puede anclar a
      él, así que lo que se mide son las cajas de texto que lo rodean.
    */
    const [membrete] = filetes(hoja, 72, 2)
    expect(membrete).toBeDefined()
    expect(membrete.x).toBeCloseTo(MARGEN.izquierdo, 2)

    /*
      LA BANDA DE DIRECCIÓN ES DE UN SOLO RENGLÓN, y eran dos. Domicilio a la izquierda,
      cédulas y teléfono a la derecha, en la MISMA línea base. Es el defecto §1 del
      diagnóstico: los dos bloques se montaban uno encima del otro.
    */
    const direccion = renglon(hoja, 'Av. Ficticia')
    const credenciales = renglon(hoja, 'Céd. Prof.')
    expect(credenciales.arriba).toBeCloseTo(direccion.arriba, 2)
    expect(credenciales.x).toBeGreaterThan(direccion.x)

    // Las dos celdas del riel de folio, alineadas y con la emisión a la izquierda.
    expect(renglon(hoja, 'EMISIÓN').x).toBeLessThan(renglon(hoja, 'FOLIO').x)
    expect(renglon(hoja, 'EMISIÓN').arriba).toBeCloseTo(renglon(hoja, 'FOLIO').arriba, 2)

    // Y el rótulo de cada celda cuelga sobre su valor, no a su lado.
    expect(renglon(hoja, 'IMG-2026').arriba).toBeGreaterThan(renglon(hoja, 'FOLIO').arriba)
  }, 60_000)

  it('mide los cuatro estados de la entrada: 52.5 · 39.5 · 39.5 · 26.5', async () => {
    // Se compone una entrada MÁS de las cuatro que hacen falta, y mínima: el paso
    // de una entrada es la distancia entre su ancla y la de la siguiente, así que
    // sin una quinta el cuarto estado no tendría contra qué medirse. El ancla es
    // el primer renglón de la entrada y su caja abre siempre a la misma altura
    // dentro de ella, así que la resta es el paso limpio.
    const [hoja] = await componer([
      ...CUATRO_ESTADOS,
      { tipo: 'Ultrasonido', region: 'Hombro derecho' },
    ])

    const anclas = [
      'Radiografía',
      'Resonancia',
      'Tomografía',
      'Densitometría',
      'Ultrasonido',
    ].map((t) => renglon(hoja, t).arriba)

    /*
      ⚠ **LOS CUATRO BAJAN, Y DOS DE ELLOS PASAN A MEDIR LO MISMO.**
      La calibración `estudio` de v2 —ancla 12.5/17, secundario 10/13, nota 10.5/16—
      desaparece con `Lamina`: v3 compone las cuatro ranuras con la única `entrada.*`, y
      ahí el secundario y la nota comparten interlineado (13). Por eso los estados 2 y 3
      —«sin proyecciones» y «sin indicación»— miden ahora **lo mismo**: la ranura que
      falta pesa igual en los dos casos. En v2 se distinguían por los 5 pt que el rol de
      nota llevaba de más.

      Lo que la prueba defiende no cambia: que cada ranura ausente se lleve su renglón y
      NADA más — sin hueco, sin rótulo huérfano.
    */
    // 1 · completa                 6 + 14 + 13 + 13 + 6 + 0.5
    expect(anclas[1] - anclas[0]).toBeCloseTo(52.5, 2)
    // 2 · sin proyecciones         6 + 14 + 13 + 6 + 0.5
    expect(anclas[2] - anclas[1]).toBeCloseTo(39.5, 2)
    // 3 · sin indicación           idéntico al 2: la ranura que falta pesa lo mismo
    expect(anclas[3] - anclas[2]).toBeCloseTo(39.5, 2)
    // 4 · solo tipo y región       6 + 14 + 6 + 0.5
    expect(anclas[4] - anclas[3]).toBeCloseTo(26.5, 2)
  }, 60_000)

  it('colapsa proyecciones e indicación POR SEPARADO, sin dejar hueco', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    // II.2 §6: la 02 no tiene proyecciones y sí indicación; la 03 al revés; la 04
    // ninguna de las dos. El rótulo colgado sale una vez por cada indicación viva.
    /*
      ⚠ v3 · EL RÓTULO SE COMPONE COMO TRAMO DENTRO DEL `Text` DE LA NOTA, no como
      hermano en una fila: es lo único que alinea su base con la del renglón que rotula
      —el motor no resuelve la base de un `Text` hermano, `alignItems: 'baseline'` no lo
      arregla—. Por eso llega al extractor con el espacio que lo separa de la nota.
    */
    expect(hoja.renglones.filter((r) => r.texto.trim() === 'INDICACIÓN')).toHaveLength(2)
    // Y los altos de arriba lo confirman: 52.5 − 39.5 = 13, que es el renglón que
    // falta, el mismo para las dos ranuras.
  }, 60_000)

  it('el badge de urgente empuja 21 pt lo que va bajo la ficha', async () => {
    const [sinBadge] = await componer(CUATRO_ESTADOS)
    const [conBadge] = await componer(CUATRO_ESTADOS, { urgente: true })

    /*
      ⚠ **21 pt, Y ERAN 13.5.** En v2 el badge colgaba DENTRO del bloque de título y
      parte de su alto lo absorbía el riel de folio, que ya medía 190; en v3 va en su
      propio bloque bajo la ficha (marca el DOCUMENTO, no el estudio) y empuja su alto
      entero más su aire. El badge además encoge de 14.5 a 13.
    */
    expect(abreLaLista(conBadge) - abreLaLista(sinBadge)).toBeCloseTo(21, 2)

    // 2.H mide el bloque en negativo en 13 pt, y eran 14.5.
    const badge = conBadge.rectangulos.find((r) => r.alto === 13)
    expect(badge).toBeDefined()
    // Regla 4: uno por documento, bajo el título. No se repite por estudio.
    expect(conBadge.renglones.filter((r) => r.texto === 'URGENTE')).toHaveLength(1)
  }, 60_000)

  it('I.3.4: el paso de entrada es el mismo en TODAS las hojas', async () => {
    /*
      ⚠ **LA SONDA DE I.3.4, Y MIDE LO QUE SÍ SE MUEVE.**

      Cuando la hoja no cuadra, Yoga reparte el exceso encogiendo a TODOS los hijos en
      proporción — puede hacerlo porque `@react-pdf/layout` compone `setFlexShrink` como
      `setYogaValue('flexShrink')(value || 1)`, así que el 0 se vuelve 1 y ningún nodo se
      declara rígido. La hoja sale un tanto por mil —o un dos por ciento— más pequeña, sin
      aviso ninguno, y **la paginación no llega a enterarse**: para cuando `splitNodes`
      mira las cajas, ya caben todas.

      **Ni el cuerpo de letra ni el paso entre renglones de un párrafo lo delatan**:
      react-pdf nunca toca `fontSize`, y las líneas de un `Text` las coloca el motor de
      texto, no Yoga. Lo que sí lo delata es el paso de una ENTRADA a la siguiente, que es
      distancia entre cajas y no puede salir de otro sitio que de la suma de sus tokens.

      Se mide en TODAS las hojas y en TODAS las parejas: la que se comprime es la que
      cierra, y puede ser cualquiera.
    */
    const minimo = (i: number): EstudioSolicitado => ({
      tipo: 'Radiografía',
      region: `Segmento ${i}`,
    })
    /*
      ⚠ **ERAN DIECISÉIS Y SON VEINTICUATRO.** La entrada mínima baja de 28.5 a 26.5 y el
      encabezado encoge 51 pt, así que dieciséis dejaron de partir: la sonda se habría
      quedado midiendo una sola hoja en silencio. Se sube hasta que vuelve a repartir.
    */
    const hojas = await componer(Array.from({ length: 24 }, (_, i) => minimo(i)))
    expect(hojas.length).toBeGreaterThan(1)

    // El estado mínimo mide 26.5 por entrada, de la prueba de los cuatro estados.
    const esperado = 26.5

    let hojasMedidas = 0
    for (const [indice, hoja] of hojas.entries()) {
      const anclas = hoja.renglones
        .filter((r) => /^Radiografía · Segmento \d/.test(r.texto))
        .map((r) => r.arriba)
      if (anclas.length < 2) continue
      hojasMedidas += 1
      for (const [i, altura] of anclas.slice(1).entries()) {
        expect(altura - anclas[i], `hoja ${indice + 1}`).toBeCloseTo(esperado, 1)
      }
    }
    // Si la lista dejara de partirse, la sonda quedaría midiendo una sola hoja en silencio.
    expect(hojasMedidas).toBeGreaterThan(1)
  }, 200_000)

  it('EL DEFECTO DE COMPRESIÓN YA NO SE REPRODUCE AQUÍ: el paso es constante', async () => {
    /*
      ⚠⚠ **ESTA PRUEBA FIJABA UN DEFECTO VIVO Y AHORA FIJA SU AUSENCIA EN ESTE FORMATO.**

      El defecto no se ha arreglado: `@react-pdf/renderer` sigue **encogiendo las filas de
      una hoja que se pasa por poco** en vez de mandar la fila que sobra a la siguiente.
      Lo que ha cambiado es DÓNDE aparece. En v2, con siete estudios caros, Imagenología
      se pasaba por ~8 pt —dentro de la holgura que Yoga puede absorber— y la hoja entera
      encogía un 1.97 %: el paso bajaba de 59.5 a 58.3269.

      En v3 la entrada cara mide 52.5 en vez de 59.5 y el encabezado 51 pt menos, así que
      SIETE caben con holgura y el octavo desborda por mucho más de lo que Yoga puede
      absorber: pagina limpio. Medido de tres a ocho estudios, el paso sale **52.5
      exactos en los seis casos**, incluido el que parte.

      **Dónde está ahora:** `hojaDeContinuacion.test.ts` lo mide en Imagenología con doce
      estudios al **1.36 %**, y la nota de `tokens.ts` sobre igualar los márgenes ya
      anticipaba que se reubicaría. Sigue siendo el defecto de chasis abierto de
      `DOCUMENTOS_RANURAS_MUERTAS.md` §3.

      Si algún día esta prueba falla, el defecto volvió a este formato: mira el paso de
      la hoja que CIERRA, no el cuerpo de letra — react-pdf nunca toca `fontSize`.
    */
    const caro = (i: number): EstudioSolicitado => ({
      tipo: 'Radiografía',
      region: `Segmento ${i}`,
      proyecciones: 'AP y lateral',
      indicacion: 'Control evolutivo del material de osteosíntesis.',
    })
    const paso = async (n: number): Promise<number> => {
      const [hoja] = await componer(Array.from({ length: n }, (_, i) => caro(i)))
      const anclas = hoja.renglones
        .filter((r) => /^Radiografía · Segmento \d/.test(r.texto))
        .map((r) => r.arriba)
      return anclas[1] - anclas[0]
    }

    for (const n of [6, 7, 8]) {
      expect(await paso(n), `${n} estudios`).toBeCloseTo(52.5, 2)
    }
  }, 200_000)

  it('cierra la hoja donde la medición dice, y no una entrada más', async () => {
    /*
      ⚠ **CABEN SIETE, Y EN v2 CABÍAN CUATRO.** La caja pasa de 670 a 693, el encabezado
      de 229.88 a 178.50 y la entrada cara de 59.5 a 52.5. La cifra es CONSECUENCIA del
      rediseño y no su objetivo; lo que la prueba defiende es que la hoja cierre donde la
      suma dice y no una entrada más tarde.
    */
    const caro = (i: number): EstudioSolicitado => ({
      tipo: 'Radiografía',
      region: `Segmento ${i}`,
      proyecciones: 'AP y lateral',
      indicacion: 'Control evolutivo del material de osteosíntesis.',
    })
    expect(await componer(Array.from({ length: 7 }, (_, i) => caro(i)))).toHaveLength(1)
    expect(await componer(Array.from({ length: 8 }, (_, i) => caro(i)))).toHaveLength(2)

    // Con el estado mínimo —26.5 por entrada— caben QUINCE, y eran nueve.
    const minimo = (i: number): EstudioSolicitado => ({
      tipo: 'Radiografía',
      region: `Segmento ${i}`,
    })
    expect(await componer(Array.from({ length: 15 }, (_, i) => minimo(i)))).toHaveLength(1)
    expect(await componer(Array.from({ length: 16 }, (_, i) => minimo(i)))).toHaveLength(2)
  }, 180_000)

  it('ancla la banda de pie en y = 740 y con folio', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    const banda = hoja.rectangulos.find((r) => r.ancho === CAJA.ancho && r.alto === 16)
    expect(banda?.arriba).toBe(740)
    // Variante `completo`: la lámina compone folio, y II.2 §1 decía `sin folio`.
    expect(renglon(hoja, 'Folio IMG-2026-0148')).toBeDefined()
  }, 60_000)

})
