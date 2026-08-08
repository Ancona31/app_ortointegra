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
  MARGEN,
  PAPEL,
  TIPOGRAFIA,
  ESPACIO,
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
 * restan los dos sumandos que la cabecera compone encima: el aire de 5 pt y el
 * renglón del rótulo. Ninguno de los dos se escribe como cifra aquí.
 */
function abreLaLista(hoja: Hoja): number {
  const filete = filetes(hoja, 64, 2)[0]
  return filete.arriba - ESPACIO[5] - (TIPOGRAFIA['titulo.seccion'].interlineado ?? 0)
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
  it('compone el encabezado en 229.88 pt desde el margen', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    // 232.88 de la lámina − 3 del panel. Ver la cabecera.
    expect(abreLaLista(hoja) - MARGEN.superior).toBeCloseTo(229.88, 2)
  }, 60_000)

  it('sitúa los tres bloques del encabezado donde la lámina los mide', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    const [membrete, titulo] = filetes(hoja, 96, 2.5)

    // Filete del membrete: el panel abre en el margen y cierra 8 pt antes. Los 56
    // son los del chasis; la lámina mide 59 y ahí nacen los 3 pt de diferencia.
    expect(membrete.arriba).toBeCloseTo(MARGEN.superior + 56 + 8, 2)

    // Banda de dirección: DOS renglones de 12, no tres. El segundo va pegado al
    // primero, y los dos llevan el mismo tratamiento.
    const direccion = renglon(hoja, 'Av. Ficticia')
    const credenciales = renglon(hoja, 'Céd. Prof.')
    expect(credenciales.arriba - direccion.arriba).toBeCloseTo(12, 2)

    // De donde abre la banda al filete del título hay: 24 de banda + 12 del
    // espaciador que cierra el membrete + 25 del bloque de título + 6 de aire.
    // El bloque son 25 porque lo fija el riel derecho —rótulo 11 + valor 14—, no
    // la caja del título, que mide 20.
    const banda = direccion.arriba - TIPOGRAFIA['medico.credencial'].cuerpo * 0.878
    expect(titulo.arriba - banda).toBeCloseTo(24 + 12 + 25 + 6, 1)

    // Las dos celdas del riel derecho, alineadas a la derecha y con 16 pt entre
    // ellas. La de emisión abre antes que la de folio.
    expect(renglon(hoja, 'EMISIÓN').x).toBeLessThan(renglon(hoja, 'FOLIO').x)
    expect(renglon(hoja, 'EMISIÓN').arriba).toBeCloseTo(renglon(hoja, 'FOLIO').arriba, 2)

    // Riel de identificación: 63.87 pt, del filete del título + 2.5 + 10 hasta
    // donde abre la cabecera de la lista, 14 pt más arriba.
    const abreRiel = titulo.arriba + 2.5 + 10
    expect(abreLaLista(hoja) - ESPACIO[14] - abreRiel).toBeCloseTo(63.87, 1)
  }, 60_000)

  it('mide los cuatro estados de la entrada: 59.5 · 46.5 · 41.5 · 28.5', async () => {
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

    // 1 · completa       5 + 17 + 13 + 2 + 16 + 6 + 0.5
    expect(anclas[1] - anclas[0]).toBeCloseTo(59.5, 2)
    // 2 · sin proyecciones      5 + 17 + 2 + 16 + 6 + 0.5
    expect(anclas[2] - anclas[1]).toBeCloseTo(46.5, 2)
    // 3 · sin indicación        5 + 17 + 13 + 6 + 0.5
    expect(anclas[3] - anclas[2]).toBeCloseTo(41.5, 2)
    // 4 · solo tipo y región    5 + 17 + 6 + 0.5
    expect(anclas[4] - anclas[3]).toBeCloseTo(28.5, 2)
  }, 60_000)

  it('colapsa proyecciones e indicación POR SEPARADO, sin dejar hueco', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    // II.2 §6: la 02 no tiene proyecciones y sí indicación; la 03 al revés; la 04
    // ninguna de las dos. El rótulo colgado sale una vez por cada indicación viva.
    expect(hoja.renglones.filter((r) => r.texto === 'INDICACIÓN')).toHaveLength(2)
    // Y los altos de arriba lo confirman: 59.5 − 46.5 = 13, el renglón de
    // proyecciones; 59.5 − 41.5 = 18, el bloque de la indicación con su aire.
  }, 60_000)

  it('el badge de urgente empuja 13.5 pt lo que va bajo el título', async () => {
    const [sinBadge] = await componer(CUATRO_ESTADOS)
    const [conBadge] = await componer(CUATRO_ESTADOS, { urgente: true })

    // 4 pt de aire más 14.5 de badge: la caja del título pasa de 20 a 38.5 y
    // adelanta al riel derecho de 190, que era quien fijaba el alto del bloque.
    expect(abreLaLista(conBadge) - abreLaLista(sinBadge)).toBeCloseTo(13.5, 2)

    // El badge de la lámina mide 14.5, no los 19 que deduce la ficha de 2.H.
    const badge = conBadge.rectangulos.find((r) => r.alto === 14.5)
    expect(badge).toBeDefined()
    // Regla 4: uno por documento, bajo el título. No se repite por estudio.
    expect(conBadge.renglones.filter((r) => r.texto === 'URGENTE')).toHaveLength(1)
  }, 60_000)

  it('cierra la hoja donde la medición dice, y no una entrada más', async () => {
    // Con el estado más caro caben CUATRO. El presupuesto, en pt sobre los 670 de
    // caja: 217.88 de encabezado + 21 de cabecera + N × 59.5 + 5 + 11 de contador
    // + 26 + 118.75 de firma. Con N = 4 sobran 30.87; con N = 5 faltan 28.63.
    const caro = (i: number): EstudioSolicitado => ({
      tipo: 'Radiografía',
      region: `Segmento ${i}`,
      proyecciones: 'AP y lateral',
      indicacion: 'Control evolutivo del material de osteosíntesis.',
    })
    expect(await componer(Array.from({ length: 4 }, (_, i) => caro(i)))).toHaveLength(1)
    expect(await componer(Array.from({ length: 5 }, (_, i) => caro(i)))).toHaveLength(2)

    // Con el estado mínimo —28.5 por entrada— caben NUEVE.
    const minimo = (i: number): EstudioSolicitado => ({
      tipo: 'Radiografía',
      region: `Segmento ${i}`,
    })
    expect(await componer(Array.from({ length: 9 }, (_, i) => minimo(i)))).toHaveLength(1)
    expect(await componer(Array.from({ length: 10 }, (_, i) => minimo(i)))).toHaveLength(2)
  }, 180_000)

  it('ancla la banda de pie en y = 740 y con folio', async () => {
    const [hoja] = await componer(CUATRO_ESTADOS)

    const banda = hoja.rectangulos.find((r) => r.ancho === 486 && r.alto === 16)
    expect(banda?.arriba).toBe(740)
    // Variante `completo`: la lámina compone folio, y II.2 §1 decía `sin folio`.
    expect(renglon(hoja, 'Folio IMG-2026-0148')).toBeDefined()
  }, 60_000)
})
