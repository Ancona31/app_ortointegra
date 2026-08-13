/**
 * II.4 · Plan de Suplementación — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. Una
 * prueba que comparase tokens contra tokens daría por bueno cualquier `M.encabezado`
 * escrito a mano, que es exactamente el defecto que destapó la conciliación de 4.1.
 * Aquí se renderiza el PDF, se leen las coordenadas de su flujo de contenido y se mide.
 *
 * El lector es el mismo que el de `recetaMedica.test.ts`, del que sale entero.
 *
 * QUÉ TIENE QUE DAR
 *
 * La lámina mide **232.51 pt** de encabezado desde el margen de 54. De ahí salen dos
 * restas y las dos están documentadas en la cabecera del formato:
 *
 *     232.51    la lámina
 *     −  3      el panel: 56 pt en el chasis (border-box) contra 59 en la lámina
 *     +  0.365  residuo de caja de línea del HTML, del mismo orden y signo que el
 *               0.47 de sus filas de entrada y el 0.56 de las de Receta
 *     ────────
 *      229.875  lo que este archivo compone
 *
 * **Es la cuarta lámina que mide el panel en 59.** Se mide aquí en vez de taparse: si
 * algún día 2.A pasa a 59, fallan esta prueba, la de Imagenología y la de Receta a la
 * vez, que es la señal correcta.
 *
 * LO QUE ESTA PRUEBA VIGILA Y NINGUNA OTRA PUEDE
 *
 * **Que la entrada de dos ranuras no necesitara un componente paralelo** (II.4 §4,
 * I.3.5). Se comprueba por sus tres altos de fila —28 · 48 · 66— y por la ausencia
 * total de las tres ranuras que este formato no ocupa: sin bloque en negativo, sin
 * rótulo de genérico y sin línea de escritura en ninguna parte de la hoja.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import PlanSuplementacion, {
  type PlanSuplementacionProps,
  type SuplementoIndicado,
} from '@/lib/pdf/v2/formatos/PlanSuplementacion'
import {
  CAJA,
  ESPACIO,
  MARGEN,
  PAPEL,
  RIEL_CELDA,
  TIPOGRAFIA,
  resolverAcento,
  ACENTO_BASE_POR_DEFECTO,
  FILETE_SUPLEMENTACION,
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
  /**
   * LOS FILETES DE BORDE, QUE NO SON RECTÁNGULOS Y HAY QUE LEER DE OTRO SITIO.
   *
   * La prueba de Receta ya lo anota: «los filetes salen como rectángulos `x y w h re`;
   * las reglas del riel no —el renderer las dibuja como trazos recortados—». Eso vale
   * para todo lo que se compone con `border*Width`, que es la mitad del chasis: las
   * reglas del riel, los cuatro bloques destacados, la línea de firma y el ritmo de la
   * lista. Con solo `re` no se pueden medir, y este formato añade dos que hay que
   * vigilar: el filete de acento de la celda de peso y los DOS de la cita.
   *
   * Un borde se emite como `q · camino · W n · trazo · Q`: el camino es el rectángulo
   * del borde y `W n` lo instala como recorte. Aquí se recoge el rectángulo envolvente
   * de cada recorte, que es exactamente la caja del filete. Se acumulan los puntos de
   * `m` y `l` —las curvas de estos caminos son degeneradas y repiten sus extremos, así
   * que no aportan nada— y se vacían en cada `q`, `Q` y `W n`, que es lo que impide que
   * un camino se mezcle con el siguiente.
   */
  readonly recortes: readonly Rectangulo[]
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
    // Los dos de abajo van AL FINAL a propósito: la alternancia se prueba en orden y
    // las de arriba tienen que seguir ganando —`1 0 0 1 72 54 cm` no puede leerse como
    // un `m`—. Añadirlos antes cambiaría además los índices de todo lo anterior.
    '(-?[\\d.]+) (-?[\\d.]+) [ml]\\n',
    '(W) n',
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
    const recortes: Rectangulo[] = []
    const pila: Matriz[] = []
    let ctm: Matriz = IDENTIDAD
    let tabla: Map<number, string> | undefined
    let texto = ''
    let posicion: readonly [number, number] = [0, 0]
    let camino: Array<readonly [number, number]> = []

    const cerrarRenglon = (): void => {
      if (texto !== '') {
        renglones.push({ texto, arriba: PAPEL.alto - posicion[1], x: posicion[0] })
      }
      texto = ''
    }

    /** El rectángulo envolvente del camino acumulado, en coordenadas de papel. */
    const cerrarRecorte = (): void => {
      if (camino.length > 1) {
        const xs = camino.map(([x]) => x)
        const ys = camino.map(([, y]) => y)
        recortes.push({
          x: Math.min(...xs),
          arriba: PAPEL.alto - Math.max(...ys),
          ancho: Math.max(...xs) - Math.min(...xs),
          alto: Math.max(...ys) - Math.min(...ys),
        })
      }
      camino = []
    }

    for (const t of contenido.matchAll(OPERADORES)) {
      if (t[1] !== undefined) {
        pila.push(ctm)
        camino = []
        continue
      }
      if (t[2] !== undefined) {
        ctm = pila.pop() ?? IDENTIDAD
        camino = []
        continue
      }
      if (t[3] !== undefined) {
        ctm = concatenar([+t[3], +t[4], +t[5], +t[6], +t[7], +t[8]] as const, ctm)
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
      if (t[17] !== undefined) {
        const [x0, y0] = aplicar(ctm, +t[17], +t[18])
        const [x1, y1] = aplicar(ctm, +t[17] + +t[19], +t[18] + +t[20])
        rectangulos.push({
          x: Math.min(x0, x1),
          arriba: PAPEL.alto - Math.max(y0, y1),
          ancho: Math.abs(x1 - x0),
          alto: Math.abs(y1 - y0),
        })
        continue
      }
      if (t[21] !== undefined) {
        camino.push(aplicar(ctm, +t[21], +t[22]))
        continue
      }
      cerrarRecorte()
    }
    cerrarRenglon()
    resultado.push({ renglones, rectangulos, recortes })
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

/**
 * Los filetes de una medida, de arriba abajo.
 *
 * La comparación es TOLERANTE y no exacta: las coordenadas salen de multiplicar por la
 * pila de matrices del flujo, y un filete de 1.9 pt vuelve como `1.9000000000000227`.
 */
const EPSILON = 0.001

function filetes(hoja: Hoja, ancho: number, alto: number): readonly Rectangulo[] {
  return hoja.rectangulos
    .filter(
      (r) => Math.abs(r.ancho - ancho) < EPSILON && Math.abs(r.alto - alto) < EPSILON,
    )
    .sort((a, b) => a.arriba - b.arriba)
}

/** Lo mismo para los filetes de borde, que se leen del recorte. Ver `Hoja`. */
function bordes(hoja: Hoja, ancho: number, alto: number): readonly Rectangulo[] {
  return hoja.recortes
    .filter(
      (r) => Math.abs(r.ancho - ancho) < EPSILON && Math.abs(r.alto - alto) < EPSILON,
    )
    .sort((a, b) => a.arriba - b.arriba)
}

/**
 * Dónde ABRE la caja de la cabecera de la lista, que es donde termina el encabezado.
 * Se ancla a su filete —un rectángulo, y por tanto medible— y se le restan los dos
 * sumandos que la cabecera compone encima: el aire de 5 pt y el renglón del rótulo.
 * Ninguno de los dos se escribe como cifra aquí.
 */
function abreLaLista(hoja: Hoja): number {
  const filete = filetes(hoja, 64, 2)[0]
  return filete.arriba - ESPACIO[5] - (TIPOGRAFIA['titulo.seccion'].interlineado ?? 0)
}

/**
 * TODO EL TEXTO DE LA HOJA, PEGADO — y hace falta más de lo que parece.
 *
 * ⚠ **EL RENDERER PARTE EN DOS TODO RENGLÓN QUE EMPIECE POR UN DÍGITO.** Medido en
 * este mismo documento: `72.5 kg` sale del flujo como `72.5 ` y `kg` en dos
 * operadores de texto distintos, y `4 de noviembre de 2026` como `4 ` y
 * `de noviembre de 2026`. No pasa cuando el dígito va en medio —`Dosis calculada para
 * 72.5 kg` sale entero—, así que solo muerde en los datos que ABREN con cifra: la
 * fecha, el peso y la edad.
 *
 * Por eso lo que empieza por número se busca aquí, sobre el texto pegado, y no con
 * `renglon()`. Lo que se pierde al hacerlo es la coordenada, así que se usa solo
 * cuando lo que se comprueba es que el dato ESTÉ, nunca dónde.
 */
function textoDe(hoja: Hoja): string {
  return hoja.renglones.map((r) => r.texto).join('')
}

/** El paso de una entrada a la siguiente: la distancia entre sus dos anclas. */
function pasos(hoja: Hoja, anclas: readonly string[]): number[] {
  const alturas = anclas.map((a) => renglon(hoja, a).arriba)
  return alturas.slice(1).map((altura, i) => altura - alturas[i])
}

// ─── El caso ─────────────────────────────────────────────────────────────────

registrarFuentesDeDisco()

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/**
 * QR de un píxel, en PNG y base64. Lo que esta prueba mide de 2.R es dónde cae su
 * bloque de texto; el ráster se dibuja con `Do`, que el lector no sigue.
 */
const QR_MINIMO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/**
 * El peso, con su unidad y ya redactado por quien llama. Vive en una constante porque
 * la prueba lo busca en TRES sitios —la celda del riel, el rótulo de la cabecera y la
 * línea de paciente de la hoja 2— y los tres tienen que decir lo mismo.
 */
const PESO = '72.5 kg'

/**
 * La geometría del bloque de cita, de `GEOMETRIA.citaSuplementacion` en 2.I. Se repite
 * aquí porque una prueba de medición tiene que poder fallar contra el componente: si se
 * leyera del propio módulo, un cambio de 294 a otra cosa pasaría inadvertido.
 */
const GEOMETRIA_CITA = { sangria: 12, ancho: 294 } as const

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
    peso: PESO,
    diagnostico: 'Osteopenia con deficiencia documentada',
  },
  emision: '4 ago 2026 · 10:15',
  folio: 'S-C9174B2E60A5',
  qr: QR_MINIMO,
} satisfies Omit<PlanSuplementacionProps, 'seleccionados'>

/** Una justificación que cabe holgada en un renglón de 453.75 pt a 11.5 / 18. */
const UNA_LINEA = 'Aporte insuficiente en la dieta habitual.'
/**
 * Una que NO cabe en un renglón. La prueba no depende de la cifra de caracteres:
 * compara contra la versión de una línea y la diferencia tiene que ser exactamente un
 * interlineado de `texto.corrido`.
 */
const DOS_LINEAS =
  'Deficiencia documentada de 25-OH vitamina D en 14 ng/mL, con osteopenia en densitometría de columna lumbar y reevaluación programada a los tres meses.'

/**
 * LAS COMBINACIONES DE LA ENTRADA, más una para cerrar la medición.
 *
 * **Son tres y en Receta eran cuatro**, y esa es la mitad del punto de este formato: la
 * entrada tiene DOS ranuras, así que solo hay tres estados posibles —justificación de
 * dos líneas, de una, y ninguna—. El cuarto renglón mide la media ranura que queda: sin
 * dosis, el ancla se reduce al nombre.
 *
 * ⚠ Ninguna cadena de anclaje lleva la secuencia `fi`: react-pdf incrusta la LIGADURA
 * como un glifo propio y su `ToUnicode` no la descompone.
 */
const CUATRO_FILAS: readonly SuplementoIndicado[] = [
  // 1 · completa — ancla y justificación de una línea
  { nombre: 'Colecalciferol', dosis: '4 000 UI cada 24 horas', justificacion: UNA_LINEA },
  // 2 · sin justificación — la ranura colapsa entera
  { nombre: 'Magnesio', dosis: '300 mg por la noche' },
  // 3 · sin dosis — el ancla se queda con el nombre, sin raya suelta
  { nombre: 'Zinc', justificacion: UNA_LINEA },
  // 4 · cierre de la medición
  { nombre: 'Colágeno', dosis: '10 g cada 24 horas' },
]

const ANCLAS = ['Colecalciferol', 'Magnesio', 'Zinc', 'Colágeno'] as const

async function componer(
  seleccionados: readonly SuplementoIndicado[],
  extra: Partial<PlanSuplementacionProps> = {},
): Promise<Hoja[]> {
  return hojas(
    await renderToBuffer(
      h<DocumentProps>(
        Document,
        {},
        h(PlanSuplementacion, { ...COMUN, seleccionados, ...extra }),
      ),
    ),
  )
}

describe('II.4 · Plan de Suplementación — medido sobre el PDF', () => {
  it('compone el encabezado en 229.875 pt desde el margen', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    // 232.51 de la lámina − 3 del panel + 0.365 de residuo. Ver la cabecera.
    expect(abreLaLista(hoja) - MARGEN.superior).toBeCloseTo(229.875, 2)
  }, 60_000)

  it('sitúa los bloques del encabezado donde la lámina los mide', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    const [membrete, titulo] = filetes(hoja, 96, 2.5)

    // Filete del membrete: el panel abre en el margen y cierra 8 pt antes. Los 56 son
    // los del chasis; la lámina mide 59 y ahí nacen los 3 pt.
    expect(membrete.arriba).toBeCloseTo(MARGEN.superior + 56 + 8, 2)

    // Banda de dirección: DOS renglones de 12, el segundo pegado al primero, y con
    // cédulas y universidad — que es lo que la distingue de la de Laboratorio.
    const direccion = renglon(hoja, 'Av. Ficticia')
    const credenciales = renglon(hoja, 'Céd. Prof.')
    expect(credenciales.arriba - direccion.arriba).toBeCloseTo(12, 2)
    expect(renglon(hoja, 'Universidad Nacional')).toBeDefined()

    // De donde abre la banda al filete del título hay: 24 de banda + 12 del espaciador
    // que cierra el membrete —que aquí NO son los 10 de Receta— + 25 del bloque de
    // título + 5 de aire. El bloque son 25 porque lo fija el riel derecho de 210.
    const banda = direccion.arriba - TIPOGRAFIA['medico.credencial'].cuerpo * 0.878
    expect(titulo.arriba - banda).toBeCloseTo(24 + 12 + 25 + 5, 1)

    // Las dos celdas del riel derecho, alineadas entre sí y con la emisión primero.
    expect(renglon(hoja, 'EMISIÓN').x).toBeLessThan(renglon(hoja, 'FOLIO').x)
    expect(renglon(hoja, 'EMISIÓN').arriba).toBeCloseTo(renglon(hoja, 'FOLIO').arriba, 2)

    // Riel de identificación: 64.875 pt —0.75 + 30 + 0.375 + 33 + 0.75—, del filete del
    // título + 2.5 + 10 hasta donde abre la cabecera, 14 pt más arriba. Los 10 de abajo
    // son la única cifra propia de esta lámina en el bloque de título.
    const abreRiel = titulo.arriba + 2.5 + 10
    expect(abreLaLista(hoja) - ESPACIO[14] - abreRiel).toBeCloseTo(64.875, 2)
  }, 60_000)

  it('mide los tres altos de la entrada de dos ranuras: 48 · 28 · 66', async () => {
    const [hoja] = await componer(CUATRO_FILAS)
    const [conJustificacion, sinJustificacion, sinDosis] = pasos(hoja, ANCLAS)

    /*
      EL PASO ES EL ALTO DE LA FILA MÁS SU REGLA. La lámina mide los altos en 48.47 ·
      28.47 · 66.47 y el residuo de 0.47 es suyo —caja de línea del HTML, la misma causa
      que el 0.56 de Receta—, así que aquí se comparan 48 y 28. A cada uno se le suma la
      regla de 0.63 que la entrada de abajo trae encima.
    */
    const REGLA = FILETE_SUPLEMENTACION.regla

    // 1 · 5 de padding + 17 de ancla + 2 + 18 de justificación + 6 de padding = 48
    expect(conJustificacion).toBeCloseTo(48 + REGLA, 2)

    // 2 · sin justificación: se van su renglón Y su aire de 2. Veinte puntos.
    expect(sinJustificacion).toBeCloseTo(conJustificacion - 20, 2)
    expect(sinJustificacion).toBeCloseTo(28 + REGLA, 2)

    // 3 · sin dosis NO cambia el alto: el ancla es una línea con una mitad o con dos.
    expect(sinDosis).toBeCloseTo(conJustificacion, 2)

    // Y con la justificación a dos líneas sube exactamente un interlineado de
    // `texto.corrido`, que es lo que fija la medida en 453.75 sin escribir la cifra.
    const [conDosLineas] = await componer([
      { ...CUATRO_FILAS[0], justificacion: DOS_LINEAS },
      CUATRO_FILAS[1],
    ])
    expect(pasos(conDosLineas, ['Colecalciferol', 'Magnesio'])[0]).toBeCloseTo(
      conJustificacion + (TIPOGRAFIA['texto.corrido'].interlineado ?? 0),
      2,
    )
  }, 120_000)

  it('no compone ninguna de las tres ranuras que este formato no ocupa', async () => {
    /*
      LA COMPROBACIÓN DE I.3.5, Y ES POR AUSENCIA.

      II.4 §4: «sin vía, sin presentación, sin genérico… si alguien crea un componente
      aparte para esto, el chasis está mal». La entrada es la MISMA de Receta con dos
      ranuras vacías, y lo que hay que ver es que las vacías no dejen nada: ni bloque en
      negativo, ni rótulo colgado, ni línea de escritura, ni aviso.
    */
    const [hoja] = await componer(CUATRO_FILAS)

    // Ni un solo bloque en negativo: los de 2.H miden 14.5 pt de alto y aquí no hay.
    expect(hoja.rectangulos.filter((r) => Math.abs(r.alto - 14.5) < EPSILON)).toHaveLength(
      0,
    )
    expect(hoja.renglones.some((r) => r.texto.startsWith('VÍA'))).toBe(false)
    expect(hoja.renglones.some((r) => r.texto === 'GENÉRICO')).toBe(false)
    expect(hoja.renglones.some((r) => r.texto === 'PRESENTACIÓN')).toBe(false)
    expect(hoja.renglones.some((r) => /OBLIGATORI|FALTA|REQUERID/.test(r.texto))).toBe(
      false,
    )

    // El ancla une sus dos mitades con la raya del sistema, y con una sola mitad no
    // queda la raya colgando.
    expect(renglon(hoja, 'Colecalciferol').texto).toBe(
      'Colecalciferol · 4 000 UI cada 24 horas',
    )
    expect(renglon(hoja, 'Zinc').texto).toBe('Zinc')
  }, 60_000)

  it('compone la celda de peso con su rótulo doble y su filete de acento', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    /*
      LOS DOS RÓTULOS COMPARTEN RENGLÓN, y es la lectura que hace cuadrar los 33 pt de
      la fila. Si alguien los apila, esta comprobación se rompe y el encabezado se pasa
      diez puntos de los 232.51.

      **Lo que se compara NO son las dos líneas base**, porque no coinciden ni tienen
      por qué: las cajas se apoyan por su borde inferior —`alignItems: 'flex-end'`, lo
      único alineable en react-pdf (2.C, regla 3)— y con los dos interlineados iguales
      eso alinea también sus bordes superiores. La base va a `ascendente × cuerpo` de
      ahí, así que la del calificador queda MÁS ALTA en la diferencia de cuerpos por el
      ascendente de Archivo, 878/1000 em. Es la misma fórmula que documenta `cajaFecha`
      en 2.C y no un residuo que perseguir.
    */
    const ASCENDENTE_ARCHIVO = 0.878
    /** Cuerpo del calificador, de `GEOMETRIA.peso.base` en 2.D. */
    const CUERPO_BASE = 6.5
    const peso = renglon(hoja, 'PESO')
    const base = renglon(hoja, 'BASE DEL CÁLCULO')
    expect(peso.arriba - base.arriba).toBeCloseTo(
      ASCENDENTE_ARCHIVO * (TIPOGRAFIA.etiqueta.cuerpo - CUERPO_BASE),
      2,
    )
    expect(base.x).toBeGreaterThan(peso.x)

    // La celda abre pegada al margen: su padding izquierdo es 0 y el de la fila de
    // arriba es 10. Es de la lámina — ver `GEOMETRIA.peso` en 2.D.
    expect(peso.x).toBeCloseTo(MARGEN.izquierdo, 2)
    expect(renglon(hoja, 'PACIENTE').x).toBeCloseTo(MARGEN.izquierdo + 10, 2)

    // Y el valor está, con su unidad, tal como lo entrega quien llama. Por `textoDe`
    // porque abre con cifra: ver la nota del lector.
    expect(textoDe(hoja)).toContain(PESO)

    /*
      EL FILETE DE ACENTO ENTRE PESO Y DIAGNÓSTICO. Se compone como borde izquierdo de
      la celda de diagnóstico (2.F), así que abre donde acaba la de peso: en el margen
      más cuatro celdas de riel. Su alto es el de la fila —33 pt, los que fija la celda
      de peso—, que es también la comprobación de que los dos rótulos comparten renglón.
    */
    const acentoVertical = bordes(hoja, FILETE_SUPLEMENTACION.acento, 33)
    expect(acentoVertical).toHaveLength(1)
    expect(acentoVertical[0].x).toBeCloseTo(MARGEN.izquierdo + 4 * RIEL_CELDA, 2)

    // Y el diagnóstico arranca detrás de él: el filete de 1.9 se lleva el sitio que en
    // cualquier otra celda ocupa el hairline de 0.375. Es la otra cara de la misma
    // medida, y la que se rompería si alguien dejara el grosor por defecto.
    expect(renglon(hoja, 'DIAGNÓSTICO').x).toBeCloseTo(
      MARGEN.izquierdo + 4 * RIEL_CELDA + FILETE_SUPLEMENTACION.acento + 10,
      2,
    )
  }, 60_000)

  it('sin peso colapsan la celda, el rótulo de cálculo y el filete de acento', async () => {
    /*
      LA VERIFICACIÓN VISIBLE DE II.4 §6, ENTERA.

      «Emitir el mismo plan dos veces, con peso y sin peso. Sin peso: desaparecen los dos
      y las celdas restantes del riel se ensanchan hasta llenarlo, y las dosis impresas
      son las mismas.»
    */
    const [conPeso] = await componer(CUATRO_FILAS)
    expect(renglon(conPeso, `Dosis calculada para ${PESO}`)).toBeDefined()

    const [sinPeso] = await componer(CUATRO_FILAS, {
      paciente: { ...COMUN.paciente, peso: undefined },
    })

    // Desaparecen los dos: la celda del riel y el rótulo de la cabecera.
    expect(sinPeso.renglones.some((r) => r.texto === 'PESO')).toBe(false)
    expect(sinPeso.renglones.some((r) => r.texto === 'BASE DEL CÁLCULO')).toBe(false)
    expect(sinPeso.renglones.some((r) => r.texto.startsWith('Dosis calculada'))).toBe(
      false,
    )

    // Y el filete de acento se va con la celda: el diagnóstico pasa a ser la primera
    // celda viva de su fila, y una primera celda no lleva regla. Sin esto quedaría un
    // filete de 1.9 pt dibujado contra el margen.
    expect(
      sinPeso.recortes.filter(
        (r) => Math.abs(r.ancho - FILETE_SUPLEMENTACION.acento) < EPSILON,
      ),
    ).toHaveLength(0)

    // Las celdas que quedan se ensanchan hasta llenar el riel: el diagnóstico abre
    // ahora en el margen, no cuatro celdas más adentro.
    expect(renglon(sinPeso, 'DIAGNÓSTICO').x).toBeCloseTo(MARGEN.izquierdo + 10, 2)
    expect(renglon(conPeso, 'DIAGNÓSTICO').x).toBeGreaterThan(
      renglon(sinPeso, 'DIAGNÓSTICO').x,
    )

    // Y las dosis impresas son las mismas.
    expect(renglon(sinPeso, 'Colecalciferol').texto).toBe(
      renglon(conPeso, 'Colecalciferol').texto,
    )
  }, 120_000)

  it('compone el bloque de cita con sus dos filetes y su texto libre', async () => {
    /*
      ERAN CUATRO TEXTOS Y SON DOS: el encabezado y el seguimiento. La cita entraba como
      objeto de tres campos —`fecha` requerida, `plazo` y `nota`— y ningún formulario los
      captura: lo que se guarda es `seguimiento`, una cadena libre, y es lo que v1 imprime
      en su badge. Se compone como lo que es.
    */
    const CITA = 'Control a 3 meses, el 4 de noviembre de 2026. Traer vitamina D.'
    const uno: readonly SuplementoIndicado[] = [
      { nombre: 'Colecalciferol', dosis: '2 000 UI cada 24 horas' },
    ]

    const [conCita] = await componer(uno, { seguimiento: CITA, notas: 'Tome con alimentos.' })

    expect(renglon(conCita, 'CITA DE CONTROL')).toBeDefined()
    // Por `textoDe`: la cadena es larga y el renderer la parte en varios renglones.
    expect(textoDe(conCita)).toContain('Control a 3 meses')
    expect(textoDe(conCita)).toContain('Traer vitamina D.')

    /*
      LOS DOS FILETES, Y `CONCILIA D42` DECÍA QUE ERA UNO. El superior mide 294 pt —el
      ancho del bloque, que es el único destacado del sistema que no ocupa la caja
      entera— por 1.9 de grosor; el izquierdo, 1.9 de ancho por el alto del bloque. Que
      existan los DOS es lo que esta prueba fija: la unificación a «solo izquierdo» no
      describe esta lámina.
    */
    const superior = bordes(
      conCita,
      GEOMETRIA_CITA.ancho,
      FILETE_SUPLEMENTACION.acento,
    )
    expect(superior).toHaveLength(1)
    expect(superior[0].x).toBeCloseTo(MARGEN.izquierdo, 2)

    // El del riel también mide 1.9 de ancho y vive arriba del todo, así que se descarta
    // por altura: lo que se busca es el que abre con el filete superior de la cita.
    const izquierdo = conCita.recortes.filter(
      (r) =>
        Math.abs(r.ancho - FILETE_SUPLEMENTACION.acento) < EPSILON &&
        r.alto > FILETE_SUPLEMENTACION.acento &&
        r.arriba >= superior[0].arriba,
    )
    expect(izquierdo).toHaveLength(1)
    expect(izquierdo[0].x).toBeCloseTo(MARGEN.izquierdo, 2)
    expect(izquierdo[0].arriba).toBeCloseTo(superior[0].arriba, 2)

    // LA SANGRÍA, que se lee en dónde arrancan los textos: el filete de 1.9 más los 12
    // de sangría. Es lo que fija las dos cifras a la vez.
    expect(renglon(conCita, 'CITA DE CONTROL').x).toBeCloseTo(
      MARGEN.izquierdo + FILETE_SUPLEMENTACION.acento + GEOMETRIA_CITA.sangria,
      2,
    )

    // Y colapsa ENTERO sin cita: ni encabezado, ni fecha, ni filetes.
    const [sinCita] = await componer(uno, { notas: 'Tome con alimentos.' })
    expect(sinCita.renglones.some((r) => r.texto.startsWith('CITA DE CONTROL'))).toBe(
      false,
    )
    expect(
      bordes(sinCita, GEOMETRIA_CITA.ancho, FILETE_SUPLEMENTACION.acento),
    ).toHaveLength(0)
    // La firma sube: el bloque se fue con su aire, no dejó el hueco.
    expect(renglon(sinCita, 'FIRMA DEL MÉDICO').arriba).toBeLessThan(
      renglon(conCita, 'FIRMA DEL MÉDICO').arriba,
    )
  }, 180_000)

  it('reparte la fila de cierre: firma a la izquierda y verificación a la derecha', async () => {
    const paginas = await componer(CUATRO_FILAS)
    const hoja = paginas[paginas.length - 1]

    // La firma abre en el margen izquierdo, que es donde la lámina la sitúa.
    expect(renglon(hoja, 'FIRMA DEL MÉDICO').x).toBeCloseTo(MARGEN.izquierdo, 2)
    // Y el rótulo es el de ESTA lámina, no el de las dos solicitudes (`D14`).
    expect(hoja.renglones.some((r) => r.texto.startsWith('FIRMA Y SELLO'))).toBe(false)

    // La zona de verificación existe, con su folio: II.4 §1 decía que este formato no
    // llevaba ni QR ni folio, y la lámina compone los dos. Ver el punto (a).
    expect(renglon(hoja, 'VERIFICACIÓN')).toBeDefined()
    expect(hoja.renglones.filter((r) => r.texto === COMUN.folio).length).toBeGreaterThan(1)

    // Sin filete corto entre el rótulo y el folio, igual que en Receta.
    expect(filetes(hoja, 40, 1.6)).toHaveLength(0)

    // El bloque de texto del QR crece hacia la izquierda y no alcanza al código.
    const folios = hoja.renglones.filter((r) => r.texto === COMUN.folio)
    const folio = folios[folios.length - 1]
    expect(folio.x).toBeLessThan(renglon(hoja, 'VERIFICACIÓN').x)
    expect(folio.x).toBeGreaterThan(MARGEN.izquierdo + CAJA.ancho - 56 - 12 - 172)
  }, 60_000)

  it('ancla la banda de pie en y = 740 y con folio S-', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    const banda = hoja.rectangulos.find((r) => r.ancho === 486 && r.alto === 16)
    expect(banda?.arriba).toBe(740)
    // Variante `completo`. II.4 §1 declara `sin folio`; manda la lámina.
    expect(renglon(hoja, `Folio ${COMUN.folio}`)).toBeDefined()
  }, 60_000)

  it('I.3.4: el paso de entrada es el mismo en TODAS las hojas', async () => {
    /*
      ⚠ **LA SONDA DE I.3.4, Y MIDE LO QUE SÍ SE MUEVE.**

      Cuando la hoja que cierra no cuadra, `splitPage` la re-maqueta con altura DEFINIDA y
      Yoga reparte el exceso encogiendo a TODOS los hijos en proporción — puede hacerlo
      porque el renderer compone `setFlexShrink` como `value || 1` y ningún nodo se puede
      declarar rígido. El resultado es una hoja un tanto por mil más pequeña, sin aviso.

      **Lo que NO delata el defecto:** ni los cuerpos de letra —react-pdf nunca toca
      `fontSize`— ni el paso entre renglones DENTRO de un párrafo, porque las líneas de un
      `Text` las coloca el motor de texto y no Yoga. Medido: en un documento comprimido los
      dos salen idénticos.

      **Lo que sí:** el paso de una ENTRADA a la siguiente, que es distancia entre cajas.
      Medido sobre este mismo formato al ras: **101.13 pt limpio contra 100.968 comprimido**.

      Se mide en TODAS las hojas porque la que se comprime es la que CIERRA, y esa puede ser
      cualquiera — la primera versión de esta sonda solo miraba la hoja 1.
    */
    /*
      NUEVE ENTRADAS DEL ESTADO MÁS CARO, que es el reparto de 6 y 3 que fija la prueba de
      abajo: hacen falta DOS hojas con varias entradas en cada una, o no hay paso que medir
      en la segunda.
    */
    const lista = Array.from({ length: 9 }, (_, i) => ({
      nombre: `Suplemento ${i}`,
      dosis: '500 mg cada 12 horas',
      justificacion: DOS_LINEAS,
    }))
    const hojas = await componer(lista, {
      notas: 'Tome los suplementos con alimentos y separados de cualquier antibiótico.',
      seguimiento: 'Control a 3 meses, el 4 de noviembre de 2026.',
    })
    expect(hojas.length).toBeGreaterThan(1)

    /*
      EL PASO, SUMADO DE SUS PARTES y no copiado de una medición: padding de la fila, ancla,
      aire de la justificación, sus dos renglones, padding inferior y la regla que separa de
      la siguiente. Es la misma cuenta que fija la prueba de los tres altos, más la regla.
    */
    const esperado =
      5 + 17 + 2 + 2 * (TIPOGRAFIA['texto.corrido'].interlineado ?? 0) + 6 +
      FILETE_SUPLEMENTACION.regla

    for (const [indice, hoja] of hojas.entries()) {
      const anclas = hoja.renglones
        .filter((r) => /^Suplemento \d/.test(r.texto))
        .map((r) => r.arriba)
      if (anclas.length < 2) continue
      for (const [i, altura] of anclas.slice(1).entries()) {
        expect(altura - anclas[i], `hoja ${indice + 1}`).toBeCloseTo(esperado, 1)
      }
    }
  }, 200_000)

  it('reparte nueve suplementos en 6 y 3, con todo el cierre en la hoja 2', async () => {
    /*
      EL REPARTO DE LA LÁMINA. Nueve suplementos del estado más caro —ancla y
      justificación de dos líneas— caen 6 y 3, y la hoja 2 se queda con las notas, la
      cita, la firma y el QR.

      Cabe uno más por hoja que en Receta con siete, y no es casualidad: la fila cara de
      aquella mide 89 pt y esta 66, y su encabezado pesa 220.88 contra los 229.875 de
      este. La lista es más ligera aunque el encabezado sea más pesado.
    */
    const caro = (i: number): SuplementoIndicado => ({
      nombre: `Suplemento ${i}`,
      dosis: '500 mg cada 12 horas',
      justificacion: DOS_LINEAS,
    })
    const cierre = {
      notas: 'Tome los suplementos con alimentos y separados de cualquier antibiótico.',
      seguimiento: 'Control a 3 meses, el 4 de noviembre de 2026.',
    }
    const lista = Array.from({ length: 9 }, (_, i) => caro(i))

    const paginas = await componer(lista, cierre)
    expect(paginas).toHaveLength(2)

    const enHoja = (i: number): number =>
      paginas[i].renglones.filter((r) => /^Suplemento \d/.test(r.texto)).length
    expect(enHoja(0)).toBe(6)
    expect(enHoja(1)).toBe(3)

    // La hoja 1 no lleva nada del cierre: es lo que el motor hace posible.
    expect(paginas[0].renglones.some((r) => r.texto.startsWith('NOTAS ADICIONALES'))).toBe(
      false,
    )
    expect(paginas[0].renglones.some((r) => r.texto.startsWith('CITA DE CONTROL'))).toBe(
      false,
    )
    expect(renglon(paginas[1], 'NOTAS ADICIONALES')).toBeDefined()
    expect(renglon(paginas[1], 'CITA DE CONTROL')).toBeDefined()
    expect(renglon(paginas[1], 'FIRMA DEL MÉDICO')).toBeDefined()
    expect(renglon(paginas[1], 'VERIFICACIÓN')).toBeDefined()

    /*
      Y LA HOJA 2 LLEVA EL PESO EN SU LÍNEA DE PACIENTE, que es lo único que este
      formato añade a 2.V. Sin él, la hoja de continuación tendría dosis calculadas sin
      decir contra qué peso.
    */
    expect(renglon(paginas[1], 'Paciente · ')).toBeDefined()
    expect(textoDe(paginas[1])).toContain(`Peso ${PESO}`)
  }, 300_000)
})
