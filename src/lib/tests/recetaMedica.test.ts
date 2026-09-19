/**
 * II.3 · Receta Médica — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. El
 * defecto que destapó la conciliación de 4.1 fue exactamente eso —un
 * `M.encabezado = 217` escrito a mano contra una lámina que medía 223.05—, y una
 * prueba que comparase tokens contra tokens lo habría dado por bueno. Aquí se
 * renderiza el PDF, se leen las coordenadas de su flujo de contenido y se mide.
 *
 * QUÉ TIENE QUE DAR
 *
 * La medición de `Receta Medica.dc.html` da **223.88 pt** de encabezado desde el
 * margen de 54. De ahí sale una sola resta, documentada en la cabecera del formato:
 *
 *     223.88   la lámina
 *     −  3     el panel: 56 pt en el chasis (border-box) contra 59 en la lámina
 *     ──────
 *      220.88  lo que este archivo compone
 *
 * Los 3 pt son el único punto donde el chasis no puede componer la lámina sin mover
 * geometría compartida por los ocho formatos (2.A), y **es la segunda lámina que los
 * mide en 59**. Por eso se miden aquí en vez de taparse: si algún día el panel pasa
 * a 59, esta prueba falla y la de Imagenología también, que es la señal correcta.
 *
 * LOS ALTOS DE FILA, Y POR QUÉ YA NO SE COMPARAN CONTRA LA LÁMINA
 *
 * La lámina mide tres filas: **85.37** con vía oral, **89.56** con vía en negativo y
 * **75.56** con negativo e indicación de una línea. **Ninguna de las tres se compone
 * ya**, y no por deriva: la entrada se densificó a propósito.
 *
 * LA REGRESIÓN QUE LO OBLIGÓ. Los betatesters reportaron que la receta de v1 metía
 * siete medicamentos con recomendaciones, firma y código en UNA hoja y la de v2 no.
 * Medido: v1 aguanta once, v2 aguantaba dos. De los 489 pt de diferencia, **274 eran
 * la entrada** —75 pt contra los 35.86 de v1—, y la causa era estructural: v1 compone
 * vía e indicación en COLUMNAS a la derecha del nombre y v2 las APILABA debajo.
 *
 * **SUBIÓ UNA COSA Y SE INTENTARON DOS.** La vía va a la derecha del ancla, en su
 * bloque en negativo: **−16.5 pt por entrada**, y la fila completa pasa de 75 a 58.5.
 *
 * ⚠ **EL GENÉRICO TAMBIÉN SUBIÓ Y SE BAJÓ OTRA VEZ. NO LO VUELVAS A SUBIR.** Ahorraba
 * otros 13 pt por entrada, pero al envolver el ancla —3 de cada 7 con nombres
 * comerciales reales— caía pegado a la indicación y se leía como parte de la pauta.
 * Un genérico que se confunde con la posología es un riesgo de dispensación. La
 * decisión está escrita donde se ejecuta, en `genericoMedicamento` de 2.G.
 *
 * ⚠ **LAS TRECE VÍAS SIGUEN EN NEGATIVO, INCLUIDA LA ORAL** —decisión de Angel contra
 * lo medido, ver la cabecera del formato—. Lo que cambia es dónde va el bloque y
 * cuánto pesa: **el cuerpo baja de 8 a 6.5 pt** con una calibración propia de la
 * lámina en 2.H, porque compartiendo renglón con el ancla le disputaba la jerarquía
 * al nombre comercial. El bloque mide 11 pt de alto y ya no 14.5.
 *
 * CÓMO LEE LAS COORDENADAS
 *
 * Igual que `solicitudImagenologia.test.ts`, del que sale el lector entero: react-pdf
 * abre la página con `1 0 0 -1 0 792 cm`, así que dentro del flujo el eje Y ya crece
 * hacia ABAJO, y sitúa cada caja anidando traslaciones `cm` en vez de escribir
 * posiciones absolutas. Leer el `Tm` sin llevar la pila de matrices da coordenadas
 * fuera del papel.
 *
 * Los filetes salen como rectángulos `x y w h re`; las reglas del riel y de la lista
 * no —el renderer las dibuja como trazos recortados—, y **el QR tampoco**: una imagen
 * se dibuja con `Do` y no con `re`. Por eso la zona de verificación se ancla a su
 * filete corto de 40 × 1.6, que sí es un rectángulo, y no al ráster.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Page, View, Text, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import RecetaMedica, {
  type MedicamentoRecetado,
  type RecetaMedicaProps,
} from '@/lib/pdf/v2/formatos/RecetaMedica'
import {
  CAJA,
  CIERRE,
  RETICULA,
  ESPACIO,
  MARGEN,
  PAPEL,
  TIPOGRAFIA,
  estiloTipografico,
  resolverAcento,
  ACENTO_BASE_POR_DEFECTO,
  type RolTipograficoNombre,
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

/**
 * Los filetes de una medida, de arriba abajo.
 *
 * La comparación es TOLERANTE y no exacta: las coordenadas salen de multiplicar por
 * la pila de matrices del flujo, y un filete de 1.6 pt vuelve como
 * `1.6000000000000227`. Con `===` ese filete no existe, que es un falso negativo
 * silencioso — y el peor sitio para tenerlo es una prueba que solo sabe medir.
 */
const EPSILON = 0.001

function filetes(hoja: Hoja, ancho: number, alto: number): readonly Rectangulo[] {
  return hoja.rectangulos
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
/**
 * ⚠ v3 · el aire de la cabecera de lista baja de 5 a 3 y **`ESPACIO[5]` deja de
 * existir**: la escala se reduce a nueve miembros pares. Con el miembro retirado esta
 * resta daba `NaN` y las cotas que la usan fallaban sin decir por qué.
 */
const AIRE_CABECERA_LISTA = 3

function abreLaLista(hoja: Hoja): number {
  const filete = filetes(hoja, 64, 2)[0]
  return (
    filete.arriba - AIRE_CABECERA_LISTA - (TIPOGRAFIA['titulo.seccion'].interlineado ?? 0)
  )
}

/**
 * EL ANCHO COMPUESTO DE UNA CADENA EN UN ROL, medido sobre un PDF de sonda.
 *
 * El lector de arriba da la x de arranque de cada renglón y NO su ancho: el flujo de
 * contenido no lo escribe en ninguna parte. Se obtiene poniendo dos textos en una
 * fila —el que se mide y una marca detrás—: en un contenedor de fila el segundo
 * arranca justo donde acaba el primero, así que la resta de sus dos x ES el ancho.
 *
 * Hace falta porque la única forma de comprobar que algo está alineado a la DERECHA
 * es saber dónde acaba, y lo único que se lee es dónde empieza. Se mide con el mismo
 * renderer y las mismas fuentes que el documento, no con una tabla de métricas
 * aparte: si el peso de una familia cambia, esto cambia con él.
 */
async function anchoCompuesto(cadena: string, rol: RolTipograficoNombre): Promise<number> {
  const MARCA = '|'
  const hoja = (
    await hojas(
      await renderToBuffer(
        h<DocumentProps>(
          Document,
          {},
          h(
            Page,
            { size: [PAPEL.ancho, PAPEL.alto], style: { padding: MARGEN.izquierdo } },
            h(
              View,
              { style: { flexDirection: 'row', alignSelf: 'flex-start' } },
              h(Text, { style: { ...estiloTipografico(rol, acento) } }, cadena),
              h(Text, { style: { ...estiloTipografico(rol, acento) } }, MARCA),
            ),
          ),
        ),
      ),
    )
  )[0]
  return renglon(hoja, MARCA).x - renglon(hoja, cadena).x
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
 * QR de un píxel, en PNG y base64. No es un código legible y no tiene por qué serlo:
 * lo que esta prueba mide de 2.R es dónde cae su bloque de texto, y el ráster se
 * dibuja con `Do`, que el lector de arriba no sigue. Generar uno de verdad metería
 * `qrcode` en la prueba sin medir nada más.
 */
const QR_MINIMO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

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
  folio: 'P-B8570E3FA164',
  qr: QR_MINIMO,
} satisfies Omit<RecetaMedicaProps, 'medicamentos'>

/**
 * EL ALTO DEL BLOQUE DE LA VÍA — **11 pt, y eran 14.5.**
 *
 * `1.25 + 8 + 1.75`, la calibración `receta` que 2.H estrenó al distinguir por primera
 * vez entre láminas. Los 14.5 de antes son los de `normal`, que sigue componiendo el
 * badge `URGENTE` de Imagenología: si esta cifra vuelve a 14.5, la vía ha dejado de
 * usar su calibración y está compitiendo otra vez con el nombre comercial.
 */
/**
 * ⚠ v3 · **13, y eran 11.** El bloque en negativo de 2.H se recalibra al retirarse
 * `Lamina`: una sola composición para los nueve formatos.
 */
const ALTO_VIA = 13

/** Una indicación que cabe holgada en un renglón de 381 pt a 10 / 14. */
const UNA_LINEA = 'Una tableta cada 24 horas.'
/**
 * Una que NO cabe en un renglón: a 10 pt sobre una medida de 381 pt entran unos 75
 * caracteres y esta tiene 118. La prueba no depende de la cifra — compara contra la
 * versión de una línea y la diferencia tiene que ser exactamente un interlineado.
 */
/*
 * ⚠ **SE ALARGA, Y NO ES CAPRICHO: LA MEDIDA CAMBIÓ.** La caja de la entrada pasa de
 * 381 a 516 pt —la caja crece a 540 y la nota deja de tener ancho propio— así que la
 * cadena de v2 ya cabe de sobra en un renglón y esta prueba se quedaba midiendo dos
 * filas iguales. Lo que fija es que UN renglón de más cueste exactamente un
 * interlineado, no la longitud concreta del texto.
 */
const DOS_LINEAS =
  'Una tableta cada 24 horas después del desayuno durante siete días, y suspender de inmediato si aparece dolor epigástrico, náusea persistente o cualquier signo de sangrado digestivo.'

/**
 * LAS CUATRO COMBINACIONES DE DATOS DE LA ENTRADA, más una quinta para cerrar.
 *
 * El paso de una entrada es la distancia entre su ancla y la de la siguiente, así
 * que sin una quinta la cuarta no tendría contra qué medirse. Cada comercial empieza
 * por una palabra distinta para poder localizarlo en el texto extraído.
 *
 * **La vía ya no es un eje de esta tabla:** las trece van en negativo, así que la
 * `01` pesa lo mismo con `Oral` que con `Intramuscular`. Lo que varía es qué ranuras
 * traen dato, que es lo único que puede cambiar el alto de una fila.
 *
 * ⚠ Ninguna cadena de anclaje lleva la secuencia `fi`: react-pdf incrusta la LIGADURA
 * como un glifo propio y su `ToUnicode` no la descompone, así que un «Buprenorfina»
 * sale del flujo como «Buprenorna» y no hay renglón que encontrar.
 */
const CUATRO_FILAS: readonly MedicamentoRecetado[] = [
  // 1 · completa — ancla, genérico, vía e indicación de una línea
  {
    nombre_comercial: 'Meloxicam',
    presentacion: 'Tabletas 15 mg',
    principio_activo: 'Meloxicam sódico',
    via_administracion: 'Oral',
    indicacion: UNA_LINEA,
  },
  // 2 · sin genérico — la ranura colapsa entera, sin rótulo y sin línea
  {
    nombre_comercial: 'Diclofenaco',
    presentacion: 'Ampolleta 75 mg',
    via_administracion: 'Intramuscular',
    indicacion: UNA_LINEA,
  },
  // 3 · sin indicación
  {
    nombre_comercial: 'Fentanilo',
    presentacion: 'Parche 5 mg',
    principio_activo: 'Fentanilo',
    via_administracion: 'Transdérmica',
  },
  // 4 · solo el ancla — con la vía, que nunca colapsa: sin dato es `Oral` (II.3 §2)
  { nombre_comercial: 'Ketorolaco', presentacion: 'Tabletas 10 mg' },
  // 5 · cierre de la medición
  { nombre_comercial: 'Paracetamol', presentacion: 'Tabletas 500 mg', principio_activo: 'Paracetamol' },
]

const ANCLAS = [
  'Meloxicam',
  'Diclofenaco',
  'Fentanilo',
  'Ketorolaco',
  'Paracetamol',
] as const

async function componer(
  medicamentos: readonly MedicamentoRecetado[],
  extra: Partial<RecetaMedicaProps> = {},
): Promise<Hoja[]> {
  return hojas(
    await renderToBuffer(
      h<DocumentProps>(
        Document,
        {},
        h(RecetaMedica, { ...COMUN, medicamentos, ...extra }),
      ),
    ),
  )
}

describe('II.3 · Receta Médica — medido sobre el PDF', () => {
  it('compone el encabezado en 178.50 pt desde el margen', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    /*
      ⚠ **ERAN 220.88 Y SON 178.50: 42.38 pt MENOS, Y ES EL REDISEÑO.** El panel baja de
      56 a 40, el nombre del médico de 26 a 15, la banda de dirección pasa de DOS
      renglones a uno, el rótulo del documento de 17 a 15 y la celda de la ficha de 33 a
      27. La cota vieja describía la maqueta de v2.

      ⚠ **Y ES LA MISMA CIFRA QUE EN IMAGENOLOGÍA, QUE ES LA COTA DE VERDAD.** En v2 los
      dos formatos medían distinto —220.88 y 229.88— porque cada lámina declaraba sus
      propios aires de encabezado. Con `Lamina` retirado hay UNA composición: si estas
      dos cifras vuelven a separarse, alguien reintrodujo geometría por formato.
    */
    expect(abreLaLista(hoja) - MARGEN.superior).toBeCloseTo(178.50, 2)
  }, 60_000)

  it('sitúa los bloques del encabezado donde v3 los compone', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    /*
      ⚠ **LOS ANCLAJES CAMBIAN PORQUE LOS RECTÁNGULOS CAMBIAN.** v2 leía dos filetes de
      96 × 2.5 —membrete y título— en una sola llamada. En v3 el bloque de título **no
      repite el segmento grueso** (se gasta una vez por hoja y se gasta en el membrete),
      así que sólo queda uno y mide 72 × 2. El filete del título es un borde y no un
      rectángulo: se miden las cajas de texto que lo rodean.
    */
    const [membrete] = filetes(hoja, 72, 2)
    expect(membrete).toBeDefined()
    expect(membrete.x).toBeCloseTo(MARGEN.izquierdo, 2)

    /*
      LA BANDA DE DIRECCIÓN ES DE UN SOLO RENGLÓN, y eran dos apilados. Domicilio a la
      izquierda, cédulas y teléfono a la derecha, en la MISMA línea base: es el defecto
      §1 del diagnóstico —los dos bloques se montaban uno encima del otro— resuelto con
      `flexGrow` + `flexShrink` + `minWidth: 0` a la izquierda y `flexShrink: 0` a la
      derecha.
    */
    const direccion = renglon(hoja, 'Av. Ficticia')
    const credenciales = renglon(hoja, 'Céd. Prof.')
    expect(credenciales.arriba).toBeCloseTo(direccion.arriba, 2)
    expect(credenciales.x).toBeGreaterThan(direccion.x)

    // Las dos celdas del riel de folio, alineadas y con la emisión a la izquierda.
    expect(renglon(hoja, 'EMISIÓN').x).toBeLessThan(renglon(hoja, 'FOLIO').x)
    expect(renglon(hoja, 'EMISIÓN').arriba).toBeCloseTo(renglon(hoja, 'FOLIO').arriba, 2)

    // Y cada rótulo cuelga SOBRE su valor, no a su lado.
    expect(renglon(hoja, COMUN.folio).arriba).toBeGreaterThan(renglon(hoja, 'FOLIO').arriba)
  }, 60_000)

  it('mide las cuatro combinaciones de la entrada: 52.5 · 39.5 · 39.5 · 26.5', async () => {
    const [hoja] = await componer(CUATRO_FILAS)
    const [completa, sinGenerico, sinIndicacion, soloAncla] = pasos(hoja, ANCLAS)

    /*
      ⚠ **LAS CUATRO BAJAN, Y DOS DE ELLAS PASAN A MEDIR LO MISMO.**

      La calibración `medicamento` de v2 —número 13/16, ancla 12/16, genérico 10/13,
      indicación 10/14— desaparece con `Lamina`: v3 compone las cuatro ranuras con la
      única `entrada.*`, donde el secundario y la nota comparten interlineado (13). Por
      eso los estados 2 y 3 —«sin genérico» y «sin indicación»— miden ahora lo mismo: la
      ranura que falta pesa igual en los dos casos.

          14     el renglón del ancla — 11 / 14, con el bloque de la vía dentro
          13     el genérico, a 9.5 / 13
          13     la indicación, a 9.5 / 13 y en una línea
          12.5   el ritmo de la entrada: 6 abajo + 0.5 de regla + 6 arriba
          ─────
          52.5

      Lo que la prueba defiende no cambia: que cada ranura ausente se lleve SU renglón y
      nada más.
    */
    expect(completa).toBeCloseTo(52.5, 2)

    // 2 · sin genérico: se va SU RENGLÓN Y NADA MÁS. Trece puntos, su interlineado.
    expect(sinGenerico).toBeCloseTo(completa - 13, 2)
    expect(sinGenerico).toBeCloseTo(39.5, 2)

    // 3 · sin indicación: la misma cifra, porque los dos roles miden 13.
    expect(sinIndicacion).toBeCloseTo(completa - 13, 2)
    expect(sinIndicacion).toBeCloseTo(39.5, 2)

    /*
      4 · solo el ancla: se van las dos a la vez. La vía NO se va —sin dato es oral— y
      tampoco cuesta renglón, así que la fila es el renglón del ancla más el ritmo.
    */
    expect(soloAncla).toBeCloseTo(completa - 13 - 13, 2)
    expect(soloAncla).toBeCloseTo(26.5, 2)

    /*
      LA MISMA COMPLETA CON LA INDICACIÓN A DOS LÍNEAS: un interlineado más. No se
      compara contra ninguna cifra de lámina, sino contra la fila de una línea.
    */
    const [conDosLineas] = await componer([
      { ...CUATRO_FILAS[0], indicacion: DOS_LINEAS },
      CUATRO_FILAS[1],
    ])
    expect(pasos(conDosLineas, ['Meloxicam', 'Diclofenaco'])[0]).toBeCloseTo(
      completa + (TIPOGRAFIA['entrada.nota'].interlineado ?? 13),
      2,
    )
  }, 120_000)

  it('compone las trece vías en negativo, incluida la oral', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    /*
      CINCO MEDICAMENTOS, CINCO BLOQUES. Dos de los cinco son orales —uno declarado y
      otro por defecto— y los dos llevan caja: es la decisión de Angel contra lo
      medido. Si alguien repone la rama de texto plano, aquí salen tres.
    */
    const bloques = hoja.rectangulos.filter((r) => r.alto === ALTO_VIA)
    expect(bloques).toHaveLength(5)

    /*
      ⚠ **EL BLOQUE PIERDE LA PALABRA `VÍA`, y es una decisión declarada del rediseño.**
      Compone `ORAL`, no `VÍA ORAL`: cuatro caracteres de 6.5 pt para decir lo que la
      forma del bloque ya dice. La vía sigue componiéndose para las trece, incluida la
      oral, que es lo que esta prueba defiende.
    */
    expect(renglon(hoja, 'ORAL')).toBeDefined()
    expect(renglon(hoja, 'INTRAMUSCULAR')).toBeDefined()
    // La `04` y la `05` no declaran vía y salen orales igual (II.3 §2): con la `01`,
    // que sí la declara, son tres.
    expect(hoja.renglones.filter((r) => r.texto === 'ORAL')).toHaveLength(3)

    // Y NINGUNA sale como texto plano: la forma plana partía el renglón en dos runs
    // —el rótulo en gris y el valor en tinta plena— y aquí no queda ninguno.
    expect(hoja.renglones.some((r) => r.texto.startsWith('VÍA'))).toBe(false)

    // Regla 1 de 2.H: el bloque crece con la palabra y no se abrevia. La más larga
    // del catálogo tiene que salir más ancha que la más corta.
    const anchos = bloques.map((b) => b.ancho).sort((a, b) => a - b)
    expect(anchos[anchos.length - 1]).toBeGreaterThan(anchos[0])
  }, 60_000)

  it('colapsa el genérico y la presentación sin dejar rótulo ni hueco', async () => {
    const [hoja] = await componer([
      // 01 · sin genérico
      { nombre_comercial: 'Meloxicam', presentacion: 'Tabletas 15 mg', via_administracion: 'Intramuscular' },
      // 02 · sin presentación: el ancla se reduce al comercial
      { nombre_comercial: 'Diclofenaco', principio_activo: 'Diclofenaco sódico' },
      // 03 · completa, para cerrar la medición del paso de la 02
      { nombre_comercial: 'Paracetamol', presentacion: 'Tabletas 500 mg', principio_activo: 'Paracetamol' },
    ])

    /*
      NI RÓTULO NI LEYENDA. II.3 §2 declara los dos campos «vacío requerido: rótulo y
      línea», y así se compusieron primero; Angel decidió que colapsen enteros. Lo que
      esta prueba fija es que **no queda nada**: ni el rótulo, ni la línea, ni el
      aviso que la regla 2 de 2.E ya prohibía cuando el campo sí se componía.
    */
    expect(hoja.renglones.some((r) => r.texto === 'GENÉRICO')).toBe(false)
    expect(hoja.renglones.some((r) => r.texto === 'PRESENTACIÓN')).toBe(false)
    expect(hoja.renglones.some((r) => /OBLIGATORI|FALTA|REQUERID/.test(r.texto))).toBe(
      false,
    )
    // Y la línea de escritura de `manuscrito.ancho` tampoco: era la que se solapaba
    // con el bloque de la vía. Se dibuja como trazo, no como `re`, así que lo que se
    // mide es su ALTO — 20 pt que ya no ocupa nadie. Ver los pasos de abajo.

    // El ancla de la 02 es solo el comercial, sin la raya del sistema colgando.
    expect(renglon(hoja, 'Diclofenaco').texto).toBe('Diclofenaco')
    // La de la 01 sí lleva las dos mitades unidas por la raya.
    expect(renglon(hoja, 'Meloxicam').texto).toBe('Meloxicam · Tabletas 15 mg')

    /*
      EL COLAPSO ES TOTAL, Y ESO SE MIDE EN EL PASO. Con el campo vacío requerido la
      01 medía 16 + 31 + 16.5 + 12.5 = 76; los 31 que se fueron eran `etiqueta` (11)
      + `manuscrito.alto` (20).

      Ahora miden 26.5 y 39.5 —eran 28.5 y 41.5 en v2, con el ancla a 16 en vez de 14—:
      la vía no cuesta renglón, va en el del ancla, y lo que separa a las dos filas son
      exactamente los 13 pt del genérico.
    */
    const [paso01, paso02] = pasos(hoja, ['Meloxicam', 'Diclofenaco', 'Paracetamol'])
    // 01 · ancla 14 —con la vía dentro— + ritmo 12.5
    expect(paso01).toBeCloseTo(14 + 12.5, 2)
    // 02 · ancla 14 + genérico 13 + ritmo 12.5. La diferencia entre las dos ES el
    // renglón del genérico, que es lo que esta prueba mide desde que volvió a tenerlo.
    expect(paso02).toBeCloseTo(14 + 13 + 12.5, 2)
    expect(paso02 - paso01).toBeCloseTo(13, 2)
  }, 60_000)

  it('no deja que ninguna zona de la entrada desborde su columna', async () => {
    /*
      LA COMPROBACIÓN QUE EL DEFECTO DEL CAMPO VACÍO OBLIGÓ A ESCRIBIR.
      
      Aquella línea medía `manuscrito.ancho` —246 pt, medidos contra la presentación
      más larga del CATÁLOGO y no contra la caja de la entrada— y se metía donde no
      cabía. Esto barre las cuatro combinaciones de datos a la vez y comprueba que
      todo lo dibujado vive dentro de la caja de contenido.

      Las dos cotas son las de I.1.1 y no se escriben: el borde izquierdo es
      `margen.izquierdo` y el derecho `margen.izquierdo + caja.ancho`. Dentro de una
      entrada hay además una segunda cota, el riel del número: todo lo que no es el
      número arranca una columna más adentro, en 104.25.
    */
    const [hoja] = await componer(CUATRO_FILAS)

    const IZQUIERDA = MARGEN.izquierdo
    const DERECHA = MARGEN.izquierdo + CAJA.ancho
    /*
      ⚠ v3 · **el riel del número mide `reticula.riel` y nada más.** En v2 se le sumaba el
      medianil de la retícula de doce; en v3 la caja de la entrada es `CAJA.ancho −
      RETICULA.riel` y arranca donde el riel acaba, sin medianil entre medias.
    */
    const COLUMNA_CONTENIDO = IZQUIERDA + RETICULA.riel

    // El fondo de la hoja es el papel entero y no cuenta: no es contenido.
    const dibujados = hoja.rectangulos.filter(
      (r) => !(r.ancho === PAPEL.ancho && r.alto === PAPEL.alto),
    )
    expect(dibujados.length).toBeGreaterThan(0)
    for (const r of dibujados) {
      expect(r.x).toBeGreaterThanOrEqual(IZQUIERDA - EPSILON)
      expect(r.x + r.ancho).toBeLessThanOrEqual(DERECHA + EPSILON)
    }

    /*
      LOS BLOQUES DE VÍA, QUE AHORA COMPARTEN RENGLÓN CON EL ANCLA Y CIERRAN A LA
      DERECHA. Antes abrían en la columna de contenido —eran el primer elemento de su
      propio renglón—; desde la densificación son el último elemento de la fila del
      ancla, así que lo que se fija es dónde ACABAN: en el borde de la caja, los cinco.

      Que cierren todos en el mismo punto ES la alineación a la derecha, y es también
      lo que comprueba que ninguno se sale: el más ancho del catálogo —`VÍA
      INTRAMUSCULAR`— cierra en 558 igual que `VÍA ORAL`, creciendo hacia la izquierda.
    */
    const vias = hoja.rectangulos.filter((r) => r.alto === ALTO_VIA)
    expect(vias).toHaveLength(5)
    for (const v of vias) {
      expect(v.x + v.ancho).toBeCloseTo(DERECHA, 2)
      // Y creciendo hacia la izquierda no invade el riel del número.
      expect(v.x).toBeGreaterThanOrEqual(COLUMNA_CONTENIDO - EPSILON)
    }

    // Y ningún renglón arranca fuera de la caja. Los de la entrada arrancan en el
    // riel —el número— o en la columna de contenido; nada entre medias y nada fuera.
    for (const r of hoja.renglones) {
      expect(r.x).toBeGreaterThanOrEqual(IZQUIERDA - EPSILON)
      expect(r.x).toBeLessThan(DERECHA)
    }
    const enLaLista = hoja.renglones.filter(
      (r) => r.arriba > abreLaLista(hoja) && r.arriba < 700,
    )
    for (const r of enLaLista) {
      const enElRiel = Math.abs(r.x - IZQUIERDA) < EPSILON
      expect(enElRiel || r.x >= COLUMNA_CONTENIDO - EPSILON).toBe(true)
    }
  }, 60_000)

  it('reparte la fila de cierre: firma a la izquierda y verificación a la derecha', async () => {
    const paginas = await componer(CUATRO_FILAS)
    // La fila de cierre va al final del flujo, así que cae en la última hoja. Es lo
    // único que garantiza hoy la regla 2 de 2.R —«una sola vez, en la última»— sin
    // 2.N: no hay un segundo sitio donde pueda salir.
    const hoja = paginas[paginas.length - 1]

    /*
      ⚠ **LA CELDA DEL MÉDICO YA NO LLEVA RÓTULO, y no es que falte la firma.**
      En v3 el `rol` de 2.L es OPCIONAL y la celda del médico va sin él (brief 00 §6.1):
      quien firma lo dicen su nombre y sus cédulas, que es lo que el receptor coteja. El
      rótulo en versalita costaba 11 pt de celda para nombrar lo que la línea ya nombra,
      y es la diferencia entre los 83.75 de una celda rotulada y los 72.75 de ésta.
    */
    expect(hoja.renglones.some((r) => r.texto.startsWith('FIRMA DEL MÉDICO'))).toBe(false)
    expect(hoja.renglones.some((r) => r.texto.startsWith('FIRMA Y SELLO'))).toBe(false)
    /*
      La celda abre en el margen izquierdo, que es donde la banda de cierre la sitúa.
      ⚠ El nombre sale DOS veces en la hoja —en el membrete y aquí—, así que se toma el
      ÚLTIMO: el orden de dibujo sigue al del árbol y la banda de cierre va al final.
    */
    const nombres = hoja.renglones.filter((r) => r.texto === COMUN.medico.nombre)
    expect(nombres.length).toBeGreaterThan(1)
    expect(nombres[nombres.length - 1].x).toBeCloseTo(MARGEN.izquierdo, 2)

    /*
      LA ZONA DE QR. ⚠ v3 · **el lado del código baja de 56 a 48** y el marco se retira
      del todo, así que no queda ningún rectángulo al que anclarse: lo que se mide es
      dónde ACABA cada renglón del par rótulo + folio, que es el borde del hueco del
      código menos su medianil. Es la misma comprobación por el mismo lado.
    */
    const LADO_QR = 48
    const BORDE_QR = MARGEN.izquierdo + CAJA.ancho - LADO_QR
    const BORDE_TEXTO = BORDE_QR - 12
    expect(renglon(hoja, 'VERIFICACIÓN')).toBeDefined()

    /*
      SIN FILETE CORTO ENTRE EL RÓTULO Y EL FOLIO. La ficha de 2.R lo declara —40 ×
      `filete.cita` en acento, con 10 pt de margen— y Angel lo retiró. Es la guarda
      de esa decisión: si vuelve, aquí aparece un rectángulo.
    */
    expect(filetes(hoja, 40, 1.6)).toHaveLength(0)

    /*
      Y LOS DOS RENGLONES SE LEEN COMO UN BLOQUE. Con el filete, entre sus dos cajas
      de línea había **11.6 pt** —10 de margen más 1.6 de filete— y las líneas base
      quedaban a 26.112. Sin él la separación es CERO, que es lo que el sistema
      compone para un par rótulo + valor, y las bases quedan a 14.512.

      El 14.512 no se escribe como cifra: sale del alto de la caja del rótulo más lo
      que la línea base baja al crecer el cuerpo. react-pdf sitúa la base a
      `ascendente × cuerpo` del borde superior de la caja de línea, y el ascendente de
      Archivo es 878/1000 em — el mismo que ya documenta la regla 3 de 2.C.
    */
    /*
      ⚠ **LA CIFRA SE CONSERVA EN 14.512 Y SUS TRES SUMANDOS CAMBIAN.** Los dos roles
      bajan —el rótulo de 7/11 a 6.5/9, el folio de 11 a 10.5— y 2.R **estrena un aire
      de 2 pt** entre el rótulo y su valor, que v2 no tenía. La coincidencia es casual:
      9 + 2 + 3.512 da lo mismo que 11 + 3.512.

      Se escribe como suma y no como literal justamente por eso: si mañana se retira el
      aire o se mueve un rol, la cifra se mueve sola y la cota de abajo sigue midiendo el
      render contra la fórmula.
    */
    const ASCENDENTE_ARCHIVO = 0.878
    const separacionBases =
      (TIPOGRAFIA.etiqueta.interlineado ?? 0) +
      ESPACIO[2] +
      ASCENDENTE_ARCHIVO * (TIPOGRAFIA.folio.cuerpo - TIPOGRAFIA.etiqueta.cuerpo)
    expect(separacionBases).toBeCloseTo(14.512, 3)

    /*
      EL FOLIO NO SE METE DEBAJO DEL QR, Y LOS DOS RENGLONES CIERRAN A LA DERECHA.

      Es la prueba del defecto que tenía este bloque: la caja de texto se declaraba en
      86.27 pt y el folio de la lámina compone **94.56**, 8.29 más. Sin espacios donde
      romper y con la hifenación desactivada, el renglón no envolvía — desbordaba por
      la derecha y entraba en el QR.

      Se comprueba por el lado que importa, que es dónde ACABA cada renglón: los dos
      tienen que cerrar exactamente en el borde del bloque, y ninguno pasarse. Que
      cierren en el mismo punto ES la alineación a la derecha.
    */
    const anchoFolio = await anchoCompuesto(COMUN.folio, 'folio')
    const anchoRotulo = await anchoCompuesto('VERIFICACIÓN', 'etiqueta')

    /*
      EL ÚLTIMO, NO EL PRIMERO. Desde que 2.N compone el encabezado en todas las
      hojas, el folio sale DOS veces en la última: una en el riel del bloque de título
      —alineado al borde de la caja, en 558— y otra en la zona de verificación. El
      orden de dibujo sigue al del árbol, así que el de la zona es el segundo.
    */
    const folios = hoja.renglones.filter((r) => r.texto === COMUN.folio)
    expect(folios.length).toBeGreaterThan(0)
    const folio = folios[folios.length - 1]
    expect(folio).toBeDefined()
    expect((folio?.x ?? 0) + anchoFolio).toBeCloseTo(BORDE_TEXTO, 1)
    expect(renglon(hoja, 'VERIFICACIÓN').x + anchoRotulo).toBeCloseTo(BORDE_TEXTO, 1)

    // Y el par queda pegado: la separación medida es la que sale de los dos roles.
    expect((folio?.arriba ?? 0) - renglon(hoja, 'VERIFICACIÓN').arriba).toBeCloseTo(
      separacionBases,
      2,
    )

    // Y ninguno alcanza el QR, que es el defecto en su forma cruda.
    expect((folio?.x ?? 0) + anchoFolio).toBeLessThanOrEqual(BORDE_QR)

    // El bloque mide su pieza más ancha, que hoy es el folio: es él quien fija el
    // borde izquierdo, y el rótulo arranca más adentro. Con un ancho fijo esto no se
    // cumple —los dos arrancarían desde la misma caja— y con uno fijado al folio de
    // ESTA lámina se rompería con el siguiente, que compone 97.14.
    expect(folio?.x ?? 0).toBeLessThan(renglon(hoja, 'VERIFICACIÓN').x)

    // Crecer hacia la izquierda no puede llegar a la firma: queda holgura de sobra.
    expect(anchoFolio).toBeLessThan(CAJA.ancho - CIERRE.izquierda - 12 - LADO_QR)

    // El QR es una imagen y se dibuja con `Do`, no con `re`: no se mide desde aquí.
    // Lo que se mide es dónde queda su hueco, que es lo que fija el filete de arriba.
  }, 60_000)

  it('compone UN bloque de cierre, y colapsa entero con su aire', async () => {
    // Un solo medicamento, para que la hoja entera quepa. Con la lista llena el
    // cierre se va a la hoja 2 — ver la prueba de capacidad.
    const uno: readonly MedicamentoRecetado[] = [
      { nombre_comercial: 'Meloxicam', presentacion: 'Tabletas 15 mg', principio_activo: 'Meloxicam' },
    ]
    const RECOMENDACIONES = 'Mantenga reposo relativo durante las primeras 48 horas.'

    /*
      ERAN DOS Y ES UNO. La receta llevó un bloque de alarma aparte —`ACUDA DE INMEDIATO
      A URGENCIAS SI PRESENTA`, con el filete de 4 pt— y no se compuso en ninguna receta
      emitida: `RecetaForm` no tiene ese campo. Se retiró en vez de dotarlo, porque no
      son dos cosas: una alarma, si la hay, es una recomendación al paciente y se escribe
      donde el médico escribe las demás. II.3 §2 los inventariaba como uno solo.
    */
    const [conRecomendaciones] = await componer(uno, { recomendaciones: RECOMENDACIONES })
    expect(renglon(conRecomendaciones, 'RECOMENDACIONES GENERALES')).toBeDefined()
    expect(conRecomendaciones.renglones.some((r) => r.texto.startsWith('ACUDA'))).toBe(false)

    /*
      Y EL COLAPSO ES TOTAL: sin el bloque no queda su aire. Sin recomendaciones, la
      firma sube exactamente lo que medía el bloque más sus 14 pt de separación — no
      queda un hueco donde estaba, que es la condición de toda ranura que colapsa.
    */
    const [sinNada] = await componer(uno)
    expect(sinNada.renglones.some((r) => r.texto.startsWith('RECOMENDACIONES'))).toBe(false)
    /*
      ⚠ v3 · la celda del médico va sin rótulo, así que la sonda es la LÍNEA DE CRÉDITO
      —las cédulas—, que es lo último que compone la banda de cierre y sólo sale ahí.
    */
    const baseFirma = (hoja: Hoja): number => {
      // El renglón de cédulas sale dos veces: en la banda del membrete y en la celda
      // de firma. La de la firma es la última en el orden de dibujo.
      const ceds = hoja.renglones.filter((r) => r.texto.startsWith('Céd. Prof. 7000001'))
      return ceds[ceds.length - 1].arriba
    }
    expect(baseFirma(conRecomendaciones)).toBeGreaterThan(baseFirma(sinNada))
  }, 180_000)

  it('ancla la banda de pie en y = 740 y con folio', async () => {
    const [hoja] = await componer(CUATRO_FILAS)

    const banda = hoja.rectangulos.find((r) => r.ancho === CAJA.ancho && r.alto === 16)
    expect(banda?.arriba).toBe(740)
    // Variante `completo`: uno de los tres formatos que llevan folio en el pie.
    expect(renglon(hoja, 'Folio P-B8570E3FA164')).toBeDefined()
  }, 60_000)

  it('I.3.4: el paso de entrada es el mismo en TODAS las hojas', async () => {
    /*
      ⚠ **LA SONDA DE I.3.4, Y MIDE LO QUE SÍ SE MUEVE.**

      Cuando la hoja que cierra no cuadra, `splitPage` la re-maqueta con altura DEFINIDA y
      Yoga reparte el exceso encogiendo a TODOS los hijos en proporción — puede hacerlo porque
      el renderer compone `setFlexShrink` como `value || 1` y ningún nodo se puede declarar
      rígido. La hoja sale un tanto por mil más pequeña, sin aviso.

      **Ni los cuerpos de letra ni el paso entre renglones de un párrafo lo delatan**: react-pdf
      nunca toca `fontSize`, y las líneas de un `Text` las coloca el motor de texto, no Yoga.
      Lo que sí lo delata es el paso de una ENTRADA a la siguiente, que es distancia entre
      cajas. Medido en II.4 al ras: 101.13 limpio contra 100.968 comprimido.

      Se mide en TODAS las hojas: la que se comprime es la que CIERRA, y puede ser cualquiera.
    */
    const caro = (i: number): MedicamentoRecetado => ({
      nombre_comercial: `Fármaco ${i}`,
      presentacion: 'Tabletas 500 mg',
      principio_activo: 'Denominación genérica',
      via_administracion: 'Subcutánea',
      indicacion: UNA_LINEA,
    })
    const hojas = await componer(Array.from({ length: 12 }, (_, i) => caro(i)))
    expect(hojas.length).toBeGreaterThan(1)

    /*
      EL PASO ESPERADO ES EL DE LA ENTRADA COMPLETA, el mismo 45.5 que mide la prueba de las
      cuatro combinaciones —el `caro` de aquí lleva la indicación de UNA línea, al revés que
      el de la prueba de reparto—, con su regla dentro, porque es paso entre anclas y no
      alto de caja.
    */
    /*
      ⚠ **ERAN 58.5 Y SON 52.5.** La entrada se recalibra con la `entrada.*` única de v3.
      Lo que la sonda defiende no cambia: que el paso sea el MISMO en todas las hojas.
    */
    const esperado = 52.5

    let hojasMedidas = 0
    for (const [indice, hoja] of hojas.entries()) {
      const anclas = hoja.renglones
        .filter((r) => /^Fármaco \d/.test(r.texto))
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

  it('reparte la lista entre hojas en vez de apretarla en una', async () => {
    /*
      LA CAPACIDAD, DESPUÉS DE LA DENSIFICACIÓN DE LA ENTRADA.

      El archivo aprobado reparte 4 y 3 por literal —`slice(0, 4)`— y no declara
      capacidad, y con la entrada apilada esta prueba medía justamente eso: 4 + 3 con
      la fila cara y 5 + 2 con la corta.

      **CON LA FILA CORTA YA NO CORTA CON SIETE**, que es la cota que los betatesters
      reportaron: los siete caben en la hoja 1. Con la fila CARA —indicación de dos
      líneas, 72.5 pt— entran seis.

      ⚠⚠ **v3 · LA COTA DE LOS BETATESTERS SE ALCANZA, Y ESTA ES LA PRUEBA QUE LO FIJA.**

      «Siete medicamentos CON recomendaciones, firma y código en UNA hoja» es lo que los
      betatesters reportaron y lo que no se alcanzaba ni en v2 —donde entraban seis— ni en
      las primeras revisiones de v3, donde entraban los siete pero la banda de cierre se
      iba a la hoja 2. Angel lo había retirado del objetivo porque lo que faltaba salía
      del hueco de la rúbrica, del contador o del riel, y ninguno de los tres se toca.

      Lo que faltaba salió de otro sitio: al retirarse el aviso de continuación, el suelo
      de la caja vuelve de 63 a 52 y la hoja gana 11 pt. **Con la fila corta, los siete y
      su cierre caben en una sola hoja.** Con la fila cara —indicación de dos líneas,
      72.5 pt— los siete siguen entrando en la hoja 1 y el cierre sigue bajando: ésa no se
      alcanza, y se deja medida abajo para que se vea la diferencia entre las dos.
    */
    const caro = (i: number): MedicamentoRecetado => ({
      nombre_comercial: `Fármaco ${i}`,
      presentacion: 'Tabletas 500 mg',
      principio_activo: 'Denominación genérica',
      via_administracion: 'Subcutánea',
      indicacion: DOS_LINEAS,
    })
    const corto = (i: number): MedicamentoRecetado => ({ ...caro(i), indicacion: UNA_LINEA })
    const cierre = {
      recomendaciones: 'Mantenga reposo relativo durante las primeras 48 horas.',
    }
    const lista = (n: number): readonly MedicamentoRecetado[] =>
      Array.from({ length: n }, (_, i) => caro(i))

    /** Cuántos medicamentos imprime cada hoja. */
    const reparto = (hojas: readonly Hoja[]): number[] =>
      hojas.map((hoja) => hoja.renglones.filter((r) => /^Fármaco \d/.test(r.texto)).length)

    // LA COTA DE LOS BETATESTERS: los siete Y su cierre en UNA hoja, con la fila corta.
    const cortos = Array.from({ length: 7 }, (_, i) => corto(i))
    expect(reparto(await componer(cortos, cierre))).toEqual([7])

    // Con la fila CARA, los mismos siete: en v2 entraban SEIS y el séptimo bajaba.
    expect(reparto(await componer(lista(7), cierre))).toEqual([7, 0])

    // Sin el bloque de cierre, los mismos siete y también en dos hojas: lo que baja
    // es la banda de firma, no la lista.
    expect(reparto(await componer(lista(7)))).toEqual([7, 0])

    /*
      DÓNDE CORTA CON DOCE. Con la fila corta, **9 + 3** —eran 7 + 5 en v2—: la hoja 1
      sostiene nueve y la de continuación carga además con la fila de cierre. Es la cifra
      medida, no una capacidad declarada.
    */
    const doceCortos = Array.from({ length: 12 }, (_, i) => corto(i))
    expect(reparto(await componer(doceCortos, cierre))).toEqual([9, 3])
  }, 300_000)

})
