/**
 * II.5 · Recibo de Honorarios / Cotización — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. Una prueba
 * que comparase tokens contra tokens daría por bueno cualquier `M.encabezado` escrito a
 * mano, que es el defecto que destapó la conciliación de 4.1. Aquí se renderiza el PDF,
 * se leen las coordenadas de su flujo de contenido y se mide.
 *
 * El lector sale entero de `hojaDeContinuacion.test.ts`.
 *
 * LO QUE ESTA PRUEBA VIGILA Y NINGUNA OTRA PUEDE
 *
 * **Que los dos casos sean el mismo componente.** Es I.3.5, y es lo único que puede
 * fallar en silencio en este formato: trece diferencias medidas entre cotización y
 * recibo son trece sitios donde un día alguien copiará el archivo en dos. La prueba las
 * recorre una por una sobre el mismo componente, con el mismo médico y el mismo acento,
 * cambiando solo el `tipo`.
 *
 * Y **que el paciente vacío no colapse**: la celda crece exactamente 3.47 pt, que es la
 * línea de escritura menos el renglón de valor que sustituye. Es el estado «vacío
 * requerido» de 2.E, y este es el único formato del sistema que lo usa.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import ReciboHonorarios, {
  type ConceptoCobrado,
  type ReciboHonorariosProps,
} from '@/lib/pdf/v2/formatos/ReciboHonorarios'
import {
  FILETE,
  ESPACIO,
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

registrarFuentesDeDisco()

// ─── Extractor ───────────────────────────────────────────────────────────────

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

function tablaUnicode(cmap: string): Map<number, string> {
  const tabla = new Map<number, string>()
  for (const m of cmap.matchAll(/<([0-9a-f]{4})>\s*<([0-9a-f]+)>/gi)) {
    tabla.set(parseInt(m[1], 16), Buffer.from(m[2], 'hex').swap16().toString('utf16le'))
  }
  return tabla
}

/** Matriz de transformación `[a b c d e f]`, como la escribe el operador `cm`. */
type Matriz = readonly [number, number, number, number, number, number]
const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0]

/** `cm` premultiplica: la nueva matriz se aplica ANTES que la que ya estaba. */
function concatenar(n: Matriz, p: Matriz): Matriz {
  return [
    n[0] * p[0] + n[1] * p[2],
    n[0] * p[1] + n[1] * p[3],
    n[2] * p[0] + n[3] * p[2],
    n[2] * p[1] + n[3] * p[3],
    n[4] * p[0] + n[5] * p[2] + p[4],
    n[4] * p[1] + n[5] * p[3] + p[5],
  ]
}

interface Renglon {
  readonly texto: string
  /** Línea base medida desde el borde SUPERIOR de la hoja. */
  readonly arriba: number
  readonly x: number
}

interface Hoja {
  readonly texto: string
  /** Los cuerpos de letra que dibuja la hoja, en pt. */
  readonly cuerpos: ReadonlySet<number>
  readonly renglones: readonly Renglon[]
}

function leer(pdf: Buffer): Hoja[] {
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

  return [...bruto.matchAll(/\/Type \/Page\n[\s\S]*?\/Contents (\d+) 0 R/g)].map((pagina) => {
    const contenido = flujo(objs.get(Number(pagina[1])) ?? '')
    let tabla: Map<number, string> | undefined
    let texto = ''
    const cuerpos = new Set<number>()
    const renglones: Renglon[] = []
    const pila: Matriz[] = []
    let ctm: Matriz = IDENTIDAD
    let actual = ''
    let base = 0
    let x = 0

    const cerrar = (): void => {
      if (actual !== '') renglones.push({ texto: actual, arriba: 792 - base, x })
      actual = ''
    }

    for (const t of contenido.matchAll(
      /(q)\n|(Q)\n|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm|\/(\w+) ([\d.]+) Tf|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm|\[([^\]]*)\] TJ/g,
    )) {
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
        cuerpos.add(Number(t[10]))
        continue
      }
      if (t[11] !== undefined) {
        cerrar()
        base = ctm[1] * +t[15] + ctm[3] * +t[16] + ctm[5]
        x = ctm[0] * +t[15] + ctm[2] * +t[16] + ctm[4]
        continue
      }
      for (const cadena of t[17].matchAll(/<([0-9a-f]+)>/gi)) {
        for (let i = 0; i < cadena[1].length; i += 4) {
          const c = tabla?.get(parseInt(cadena[1].slice(i, i + 4), 16)) ?? ''
          texto += c
          actual += c
        }
      }
    }
    cerrar()
    return { texto, cuerpos, renglones }
  })
}

// ─── Los datos, inventados y compartidos ─────────────────────────────────────

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/**
 * Ninguna cadena de anclaje lleva la secuencia `fi` en minúscula: react-pdf incrusta la
 * LIGADURA como un glifo propio y su `ToUnicode` no la descompone.
 */
const PACIENTE = 'Renata Bustamante Oceguera'
/** El ancla con la que se localiza cada fila de la tabla. */
const CONCEPTO = /^Concepto de control \d+$/

const CHASIS = {
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
  panel: { variante: 'monograma', acento, iniciales: 'EM' } as const,
  acento,
}

function conceptos(cuantos: number, origen = false): readonly ConceptoCobrado[] {
  return Array.from({ length: cuantos }, (_, i) => ({
    concepto: `Concepto de control ${i + 1}`,
    precio: '$1,314.29',
    // Texto libre, que es lo que el formulario guarda: dos de los cuatro orígenes
    // que sugiere, alternados. No `propio`/`tercero`, que era la unión que este
    // campo declaraba y que nadie ha guardado nunca.
    //
    // ⚠ LOS DOS CORTOS, Y NO POR COMODIDAD: la columna de origen mide 66 pt y a
    // 7 pt en versalita le caben unos 17 caracteres, así que `Honorarios médicos`
    // y `Material e implantes` —dos de las cuatro sugerencias del formulario—
    // ENVUELVEN, y la fila pasa de 17.63 pt a 30.63. La medición de más abajo
    // supone la fila de un renglón, que es la que 2.G declara. Que los otros dos
    // no quepan es un desajuste de ANCHO, no de nombre: no se resuelve aquí.
    ...(origen ? { origen: i % 2 === 0 ? 'Anestesiólogo' : 'Hospital' } : {}),
  }))
}

const COTIZACION: ReciboHonorariosProps = {
  ...CHASIS,
  tipo_doc: 'cotizacion',
  paciente: { paciente: PACIENTE, fecha: '8 ago 2026', vigencia: '30 días naturales' },
  lineas: conceptos(4, true),
  aseguradora: {
    nombre: 'Grupo Nacional Provincial',
    poliza: 'GNP-4471-882301',
    cobertura: 'Gastos mayores',
  },
  // Agrupados por el TEXTO del origen, que es lo que hace `subtotalesDe()`.
  subtotales: [
    { origen: 'Anestesiólogo', total: '$45,000.00' },
    { origen: 'Hospital', total: '$145,000.00' },
  ],
  monto: '$190,000.00',
  /*
    ⚠ v3 · **LA DIVISA LLEGA YA REDACTADA.** En v2 el formato recibía el CÓDIGO y tenía
    dentro el catálogo de nombres; en v3 redactar es cablear y el catálogo baja al
    adaptador, así que la prop es la cadena entera. Ver `NOMBRE_DIVISA` en
    `adaptadores/ReciboHonorarios.tsx`.
  */
  divisa: 'MXN · Pesos mexicanos',
  notas: 'Los importes marcados como estimado de terceros son referencia de costos.',
  folio: 'Q-4F17A20C93B6',
  /*
    ⚠ v3 · **LA COTIZACIÓN YA NO LLEVA QR Y LA PROP NO EXISTE.** No se declara en ningún
    brief y el formato no monta `ZonaQR`; se retiró con la interfaz. Queda anotado aquí
    porque el dato SÍ se sigue generando aguas arriba: si alguien lo echa de menos, lo que
    falta es la ranura, no el valor.
  */
}

/** El mismo documento sin aseguradora: es la otra mitad del presupuesto medido. */
const COTIZACION_SIN_ASEGURADORA: ReciboHonorariosProps = {
  ...COTIZACION,
  aseguradora: undefined,
}

const RECIBO: ReciboHonorariosProps = {
  ...CHASIS,
  tipo_doc: 'honorarios',
  paciente: { paciente: PACIENTE, fecha: '8 ago 2026' },
  lineas: conceptos(14),
  monto: '$18,400.00',
  divisa: 'USD · Dólares estadounidenses',
  anticipo: '−$6,000.00',
  saldo: '$12,400.00',
  forma_pago: 'Transferencia electrónica',
  notas: 'Todos los conceptos corresponden a honorarios del médico que suscribe.',
  folio: 'R-B8570E3FA164',
}

/**
 * EL RECIBO QUE DESBORDA, y hace falta uno aparte desde que se retiró el subtítulo.
 *
 * `RECIBO` tiene 14 conceptos y partía en dos hojas. Al irse la prop `procedimiento` el
 * encabezado adelgazó **25 pt** y esas 14 filas pasaron a caber en una sola, así que ya no
 * ejercita la hoja de continuación. Con **17** vuelve a partir: 16 caben y 17 no.
 *
 * Es dato del caso y no un número mágico: si el encabezado vuelve a moverse, esta cifra se
 * remide. Lo que la prueba fija es la CONDUCTA —que exista hoja 2 y que lleve su eco—, no
 * el número de filas que hace falta para provocarla.
 */
const RECIBO_LARGO: ReciboHonorariosProps = { ...RECIBO, lineas: conceptos(17) }

/**
 * El mismo recibo con el paciente VACÍO y una sola fila. Es lo único que cambia respecto
 * de `RECIBO`, así que la diferencia de encabezado es exactamente lo que mide la línea de
 * escritura.
 */
const MINIMO: ReciboHonorariosProps = {
  ...RECIBO,
  paciente: { paciente: '', fecha: '8 ago 2026' },
  lineas: conceptos(1),
  anticipo: undefined,
  forma_pago: 'Efectivo',
}

/** Un `Document` con un solo `Page`, que es lo que ocurre en emisión real. */
async function componer(props: ReciboHonorariosProps): Promise<Hoja[]> {
  return leer(
    await renderToBuffer(
      h<DocumentProps>(Document, {}, h(ReciboHonorarios, props)),
    ),
  )
}

/**
 * Del margen superior a la LÍNEA BASE de la primera fila de la tabla. Es el encabezado
 * entero más la cabecera de columnas, más el padding de fila y el ascendente del
 * concepto: todo constante entre casos, así que las diferencias son exactas aunque el
 * valor absoluto arrastre esas tres sumas.
 */
function hastaLaPrimeraFila(hoja: Hoja): number {
  const filas = hoja.renglones
    .filter((r) => CONCEPTO.test(r.texto))
    .map((r) => r.arriba)
  expect(filas.length).toBeGreaterThan(0)
  return Math.min(...filas) - 54
}

/**
 * LO QUE HAY ENTRE EL CIERRE DEL ENCABEZADO Y LA LÍNEA BASE QUE SE MIDE, para poder
 * comparar contra las dos cotas de la lámina —270.7 y 208.8— en vez de contra una cifra
 * con tres sumas dentro.
 *
 *     16      la cabecera de la tabla: 11 de rótulo + 3 de aire + 2 de filete
 *      2      el padding superior de la fila
 *      9.219  el ascendente de Archivo (878 / 1000 em) a cuerpo 10.5
 *
 * El ascendente es el mismo con el que 2.C explica el desplazamiento de 1.976 pt entre
 * el título y su fecha: react-pdf sitúa la línea base a `ascendente × cuerpo` del borde
 * superior de la caja de línea.
 */
const ASCENDENTE_ARCHIVO = 878 / 1000
const BAJO_EL_ENCABEZADO =
  16 + 2 + ASCENDENTE_ARCHIVO * TIPOGRAFIA['concepto.texto'].cuerpo

/** El encabezado propio, desde el margen de 54 hasta donde abre la cabecera. */
function encabezado(hoja: Hoja): number {
  return hastaLaPrimeraFila(hoja) - BAJO_EL_ENCABEZADO
}

describe('II.5 · Recibo de Honorarios / Cotización', () => {
  it('el encabezado, contra las dos cotas de la lámina', async () => {
    const [conSeguro] = await componer(COTIZACION)
    const [sinSeguro] = await componer(COTIZACION_SIN_ASEGURADORA)

    /*
      ⚠ **LAS DOS COTAS SE REMIDEN: 135.27 y 219.87, Y ERAN 180.95 y 243.48.**

      v2 medía el encabezado contra la lámina —270.7 con aseguradora y 208.8 sin ella—
      y explicaba las dos diferencias con dos residuos conocidos: los 2.85 del panel
      (56 en el chasis contra 59 en la lámina) y los 0.63 de caja de línea del bloque de
      aseguradora. **Esa contabilidad se cierra aquí**: en v3 el panel mide 40, el
      nombre 15, la banda de dirección es de un renglón y la celda de la ficha 27, así
      que ninguna de las dos cifras de la lámina es ya el objetivo.

      Lo que la prueba defiende no cambia: que el encabezado tenga UNA cifra por caso y
      no derive sin que nadie se entere.
    */
    /*
      ⚠ **+11 pt: LA UNIVERSIDAD VUELVE AL MEMBRETE.** Se retiró en el rediseño y no debía
      —es requisito en la receta—, así que se repone en **su propio renglón bajo la banda
      de dirección**, a la izquierda y con los 540 de la caja. Dentro de la banda no cabía:
      ese renglón gasta ya 448.37 pt y la universidad pide 160 más su raya. Cuesta su
      renglón de `medico.credencial`, 11 pt, y sólo cuando el médico la tiene registrada:
      sin ella el nodo no se monta y esta cota vuelve a la de antes. Ver la cabecera de 2.B.
    */
    expect(encabezado(sinSeguro)).toBeCloseTo(143.20, 1)
    expect(encabezado(conSeguro)).toBeCloseTo(227.80, 1)
  }, 120_000)

  it('el encabezado: el bloque de aseguradora pesa 84.60', async () => {
    const [conSeguro] = await componer(COTIZACION)
    const [sinSeguro] = await componer(COTIZACION_SIN_ASEGURADORA)

    /*
      ⚠ **PESA 84.60 Y PESABA 62.53.** El bloque CRECE 22 pt en v3, y es el único del
      encabezado que crece: el marco parcial pasa a los grosores del chasis y el aire que
      lo separa de la ficha es ahora `transicion.fichaContenido` (12) en vez de
      `espacio.10`. Todo lo demás del encabezado encoge.

      La resta sigue siendo la comprobación buena porque aísla el bloque: no arrastra ni
      el panel ni la banda de dirección, que son los que se movieron por su cuenta.
    */
    expect(hastaLaPrimeraFila(conSeguro) - hastaLaPrimeraFila(sinSeguro)).toBeCloseTo(
      84.60,
      1,
    )
  }, 120_000)

  it('el paciente vacío no colapsa: la celda crece 3.47 pt', async () => {
    const [recibo] = await componer(RECIBO)
    const [minimo] = await componer(MINIMO)

    /*
      LA LÍNEA DE ESCRITURA, MEDIDA POR LO QUE EMPUJA. La celda pasa de 30 a 33.47 pt
      —3 + 10 + 16.47 + 4— y con ella baja todo lo que hay debajo. Es la comprobación de
      que la celda NO colapsa: si colapsara, el riel se quedaría con una sola celda y la
      cifra sería 0.

      Los dos documentos son el mismo salvo por el nombre del paciente: mismo
      procedimiento, mismo riel de dos celdas, misma tabla.
    */
    expect(hastaLaPrimeraFila(minimo) - hastaLaPrimeraFila(recibo)).toBeCloseTo(3.47, 1)

    // Y el rótulo sigue ahí, que es la otra mitad de la regla 1 de 2.E: nunca una caja
    // con etiqueta y nada debajo, y nunca un hueco sin etiqueta.
    expect(minimo.texto).toContain('PACIENTE')
    expect(minimo.texto).not.toContain(PACIENTE)
  }, 120_000)

  it('la fila de la tabla mide 21.5 y no cambia con el número de conceptos', async () => {
    const [cotizacion] = await componer(COTIZACION)
    const [recibo] = await componer(RECIBO)

    /*
      UNA SOLA CALIBRACIÓN, QUE ES LO QUE `D4` EXIGE. La lámina mide tres —21.42 con
      cuatro conceptos, 17.21 con catorce y 22.47 con uno— y eso es métrica decidida por
      el contenido, que I.3.4 prohíbe. Se compone una:

          4 + 13 + 4 + 0.5 = 21.5

      ⚠ **ERAN 17.63.** El padding de fila sube de 2 a `espacio.4` y la regla pasa de los
      0.63 de `FILETE_HONORARIOS` —el grupo por lámina que se retira con `Lamina`— a
      `FILETE.regla`, la única del chasis. El 13 sigue siendo el interlineado de
      `concepto.texto`. Que el documento de 4 y el de 14 den la MISMA cifra es la prueba,
      y eso no cambia.

      ⚠ **Y LA CIFRA NO INCLUYE NINGÚN RELLENO DE ALINEACIÓN.** Las tres columnas de esta
      tabla componen tres cuerpos distintos y sus bases se alinean con
      `position: 'relative'`, que desplaza sin crecer la caja: con `paddingTop` la fila
      medía 22.81 y la tabla entera se estiraba por alinear el ordinal.
    */
    const paso = (hoja: Hoja): number => {
      const ys = hoja.renglones.filter((r) => CONCEPTO.test(r.texto)).map((r) => r.arriba)
      expect(ys.length).toBeGreaterThan(1)
      return ys[1] - ys[0]
    }

    const esperado =
      2 * ESPACIO[4] + (TIPOGRAFIA['concepto.texto'].interlineado ?? 0) + FILETE.regla
    expect(esperado).toBeCloseTo(21.5, 2)
    expect(paso(cotizacion)).toBeCloseTo(esperado, 1)
    expect(paso(recibo)).toBeCloseTo(esperado, 1)
  }, 120_000)

  it('I.3.4: el paso de fila es el mismo en TODAS las hojas', async () => {
    /*
      ⚠ **LA SONDA DE I.3.4, Y MIDE LO QUE SÍ SE MUEVE.**

      La prueba de arriba compara dos documentos, pero solo en su hoja 1 y solo entre sus dos
      primeras filas. **El riesgo no está ahí**: cuando la hoja que CIERRA no cuadra,
      `splitPage` la re-maqueta con altura DEFINIDA y Yoga reparte el exceso encogiendo a
      todos los hijos en proporción — puede hacerlo porque `@react-pdf/layout` compone
      `setFlexShrink` como `value || 1`, así que ningún nodo se declara rígido. La hoja sale
      un tanto por mil más pequeña, sin aviso ninguno.

      **Ni el cuerpo de letra ni el paso entre renglones de un párrafo lo delatan**: react-pdf
      nunca toca `fontSize`, y las líneas de un `Text` las coloca el motor de texto, no Yoga.
      Lo que sí lo delata es el paso de una FILA a la siguiente, que es distancia entre cajas.
      Medido al ras en II.4: 101.13 limpio contra 100.968 comprimido.

      Por eso este recibo lleva **treinta** conceptos y no catorce: con catorce la tabla cabe
      entera en la hoja 1 y la hoja que se comprime —la que cierra— no tiene una sola fila que
      medir. Se recorren TODAS las hojas y TODAS las parejas consecutivas.
    */
    const hojas = await componer({ ...RECIBO, lineas: conceptos(30) })
    expect(hojas.length).toBeGreaterThan(1)

    // v3 · el padding de fila sube de 2 a `espacio.4`. Ver la prueba de la fila.
    const esperado =
      2 * ESPACIO[4] + (TIPOGRAFIA['concepto.texto'].interlineado ?? 0) + FILETE.regla

    let hojasMedidas = 0
    for (const [indice, hoja] of hojas.entries()) {
      const ys = hoja.renglones.filter((r) => CONCEPTO.test(r.texto)).map((r) => r.arriba)
      if (ys.length < 2) continue
      hojasMedidas += 1
      for (const [i, y] of ys.slice(1).entries()) {
        expect(y - ys[i], `hoja ${indice + 1}`).toBeCloseTo(esperado, 1)
      }
    }
    // Si la tabla dejara de partirse, la sonda quedaría midiendo una sola hoja en silencio.
    expect(hojasMedidas).toBeGreaterThan(1)
  }, 120_000)

  it('las trece diferencias salen del mismo componente', async () => {
    const cotizacion = await componer(COTIZACION)
    const recibo = await componer(RECIBO)
    const todo = (hojas: Hoja[]): string => hojas.map((x) => x.texto).join('\n')
    const enCotizacion = todo(cotizacion)
    const enRecibo = todo(recibo)

    // 1 · el título, que es variante `fijo` con dos valores y no un título variable
    expect(enCotizacion).toContain('COTIZACIÓN')
    expect(enRecibo).toContain('RECIBO DE HONORARIOS')
    // 2 · el riel: la vigencia solo en la cotización
    expect(enCotizacion).toContain('VIGENCIA')
    expect(enRecibo).not.toContain('VIGENCIA')
    // 3 · la aseguradora, con sus tres celdas
    expect(enCotizacion).toContain('ASEGURADORA')
    expect(enCotizacion).toContain('GNP-4471-882301')
    expect(enRecibo).not.toContain('ASEGURADORA')
    // 4 · la columna de origen, con el texto libre tal como llega y en versalita
    expect(enCotizacion).toContain('ORIGEN')
    expect(enCotizacion).toContain('ANESTESIÓLOGO')
    expect(enCotizacion).toContain('HOSPITAL')
    expect(enRecibo).not.toContain('ANESTESIÓLOGO')
    /*
      5 · los subtotales. La etiqueta de cada fila **es el texto del origen**: el
      formulario agrupa por lo que el médico escribió, así que aquí no hay rótulo
      redactado que buscar sino el origen tal cual. Antes decía `Estimado de terceros`,
      que era una redacción inventada para la lámina.
    */
    expect(enCotizacion).toContain('Hospital')
    expect(enRecibo).not.toContain('Hospital')
    // 6 · el rótulo del total
    expect(enCotizacion).toContain('TOTAL ESTIMADO')
    expect(enRecibo).toContain('TOTAL')
    expect(enRecibo).not.toContain('TOTAL ESTIMADO')
    /*
      7 y 8 · el anticipo y el saldo, **sin fecha**. `AnticipoRecibido.fecha` existía en
      2.T y no la guardaba nadie: el formulario tiene un `anticipo` que es un número y
      ningún campo de fecha detrás. Se fue con las siete ranuras sin productor.
    */
    expect(enRecibo).toContain('Anticipo recibido')
    expect(enRecibo).toContain('−$6,000.00')
    expect(enRecibo).toContain('Saldo pendiente')
    expect(enCotizacion).not.toContain('Anticipo recibido')
    // 9 · la forma de pago
    expect(enRecibo).toContain('FORMA DE PAGO')
    expect(enRecibo).toContain('Transferencia electrónica')
    expect(enCotizacion).not.toContain('FORMA DE PAGO')
    /*
      ⚠⚠ **10 · EL QR SE RETIRA DE LA COTIZACIÓN, y era una de las trece diferencias.**
      v2 componía `ZonaQR` encima de la firma en la cotización y no en el recibo; el
      formato de v3 no monta 2.R en ninguna de las dos variantes —los dos únicos
      consumidores que quedan son la Receta y el Plan de Suplementación—.

      **No está declarado en `dudas.md` ni en el 00_LEEME**, así que queda REPORTADO: o
      la cotización deja de ser verificable por QR a propósito, o falta el cableado. Lo
      que la prueba fija ahora es el estado real del papel, no el deseado.
    */
    expect(enCotizacion).not.toContain('VERIFICACIÓN')
    expect(enRecibo).not.toContain('VERIFICACIÓN')
    // 11 · el encabezado de las notas
    expect(enCotizacion).toContain('NOTAS Y CONSIDERACIONES')
    expect(enRecibo).toContain('ORIGEN DE LOS CONCEPTOS')
    // 12 · el prefijo del folio, que sale en la banda de pie y en el riel del título
    expect(enCotizacion).toContain('Q-4F17A20C93B6')
    expect(enRecibo).toContain('R-B8570E3FA164')
    // 13 · la divisa, entera bajo el total
    expect(enCotizacion).toContain('MXN · Pesos mexicanos')
    expect(enRecibo).toContain('USD · Dólares estadounidenses')

    // Y lo que NO cambia entre los dos: la leyenda no fiscal, en jerarquía visible.
    for (const texto of [enCotizacion, enRecibo]) {
      expect(texto).toContain('Documento informativo')
      expect(texto).toContain('No es un Comprobante Fiscal Digital por Internet (CFDI).')
    }
  }, 120_000)

  it('el total es la única cifra que sube de escala', async () => {
    const [hoja] = await componer(COTIZACION)
    /*
      2.T regla 2: la cifra del total es la única que sube de escala. ⚠ v3 · **20 pt, y
      eran 22**, con `RielImportes` recalibrado —es una `APUESTA` de `dudas.md`, medida
      sobre el PNG de referencia y no derivada de ningún rol—.

      ⚠ Y **ya no es el segundo cuerpo más grande de la hoja: es el PRIMERO.** El nombre
      del médico baja de 26 a 15, así que la comparación con él se invierte. Se conserva
      la cota porque lo que dice sigue siendo cierto y más fuerte: en este documento la
      cifra del dinero es lo más grande del papel.
    */
    expect([...hoja.cuerpos]).toContain(20)
    expect(Math.max(...hoja.cuerpos)).toBe(20)
    expect([...hoja.cuerpos]).toContain(TIPOGRAFIA['medico.nombre'].cuerpo)
    expect(TIPOGRAFIA['medico.nombre'].cuerpo).toBeLessThan(20)
  }, 120_000)

  it('el recibo de 14 cabe ahora en una hoja, y el de 17 parte en dos', async () => {
    const cotizacion = await componer(COTIZACION)
    const recibo = await componer(RECIBO)
    const minimo = await componer(MINIMO)
    const largo = await componer(RECIBO_LARGO)

    expect(cotizacion).toHaveLength(1)
    expect(minimo).toHaveLength(1)

    /*
      ⚠ **ESTE RECIBO PARTÍA EN DOS Y YA NO.** Al retirarse el subtítulo `Procedimiento o
      motivo` —que no alimentaba nadie— el encabezado adelgazó 25 pt, y con ellos entran
      dos filas más de tabla: las 14 caben con su fila de cierre en la misma hoja.

      Es holgura ganada, no una ranura tapada: el documento no queda con un hueco donde
      estaba el subtítulo, sino con dos filas más de sitio antes de necesitar una hoja 2.
    */
    expect(recibo).toHaveLength(1)
    /*
      ⚠ v3 · la celda del médico va SIN rótulo (brief 00 §6.1): quien firma lo dicen su
      nombre y sus cédulas. La sonda pasa a ser la línea de credencial, que sólo sale en
      la banda del membrete y en la celda de firma — dos veces en una hoja 1.
    */
    expect(recibo[0].texto).not.toContain('FIRMA DEL MÉDICO')
    expect(
      (recibo[0].texto.match(/Céd\. Prof\. 7000001/g) ?? []).length,
    ).toBeGreaterThan(1)

    /*
      LAS FILAS CABEN EN LA HOJA 1 Y LO QUE BAJA ES LA FILA DE CIERRE ENTERA.

      ⚠ La lámina deja el riel de importes en la hoja 1 y baja solo la forma de pago y
      la firma. Aquí la fila de cierre es indivisible —2.N la cierra con `wrap={false}`—
      y viaja entera. Ver la cabecera del formato: elegir entre las dos disposiciones
      exige saber si el documento cabe, que es contenido en tiempo de render (I.3.4).
    */
    expect(largo).toHaveLength(2)
    expect((largo[0].texto.match(/Concepto de control/g) ?? []).length).toBe(17)
    expect(largo[1].texto).not.toContain('Concepto de control')
    // En la hoja de continuación el membrete no compone credencial: la única es la firma.
    expect(largo[1].texto).toContain('Céd. Prof. 7000001')
    expect(largo[1].texto).toContain('Saldo pendiente')
  }, 120_000)

  it('la hoja 2 lleva el eco del total, que ningún otro formato tiene', async () => {
    const hojas = await componer(RECIBO_LARGO)
    expect(hojas).toHaveLength(2)

    /*
      LA HOJA 2 SE LEE TAPÁNDOSE LA 1 CON LA MANO, y en este formato eso incluye el
      dinero: es una hoja firmada sin una sola fila de la tabla, así que sin el eco no
      diría cuánto se cobra.
    */
    expect(hojas[1].texto).toContain(PACIENTE)
    expect(hojas[1].texto).toContain('RECIBO DE HONORARIOS · CONTINUACIÓN')

    /*
      ⚠⚠ **EL ECO DEJA DE SER UNA FRASE Y PASA A SER LA BANDA DE CIERRE ENTERA.**

      v2 componía en la hoja 2 una línea propia de este formato —`17 conceptos · total
      $18,400.00 USD en la hoja 1`— porque la banda de importes se quedaba en la hoja 1.
      En v3 **la banda de cierre viaja con la firma**: la hoja 2 lleva el total, su
      divisa, el anticipo, el saldo y la forma de pago, además del contador de conceptos.

      Dice más que el eco, y con las cifras del documento en vez de una frase redactada.
      Lo que la cota defiende no cambia: **la hoja 2 se lee tapándose la 1 con la mano y
      en este formato eso incluye el dinero.**
    */
    expect(hojas[1].texto).toContain('$18,400.00')
    expect(hojas[1].texto).toContain('USD')
    expect(hojas[1].texto).toContain('TOTAL DE CONCEPTOS · 17')
    // Y la hoja 1 no lleva ni el total ni la firma: los dos bajan juntos.
    expect(hojas[0].texto).not.toContain('$18,400.00')
  }, 120_000)

  it('CON contador en todas las hojas, y sin aviso de continuación', async () => {
    // El de 17, que es el que parte: el aviso de continuación solo existe si hay hoja 2.
    const hojas = await componer(RECIBO_LARGO)

    /*
      ⚠ **LA COTA SE INVIERTE: v3 SÍ COMPONE EL CONTADOR.** `D24` anotaba que II.5 §3 lo
      declaraba y que el diseño de v2 no lo instanciaba en ninguna hoja; el formato de v3
      lo pasa a 2.N como los otros cuatro con lista. Con la tabla partida, la hoja 1 dice
      dónde está y la última da el total — que es justo lo que el eco de v2 hacía a mano.
    */
    expect(hojas[0].texto).toContain(`CONCEPTOS · HOJA 1 DE ${hojas.length} · TOTAL 17`)
    expect(hojas[hojas.length - 1].texto).toContain('TOTAL DE CONCEPTOS · 17')

    /*
      ⚠ v3 · **YA NO HAY AVISO DE CONTINUACIÓN, NI EL DEL CHASIS NI EL DE LA LÁMINA.** Aquí
      se comprobaba que se componía el del chasis —«CONTINÚA EN LA HOJA 2 · SIN FIRMA NO ES
      VÁLIDO»— en vez del que la lámina escribía. La banda entera se retira de los nueve
      formatos: el paginador de 2.M ya sitúa cada hoja, y la mitad derecha de esa banda
      nunca se imprimió. La lámina, por tanto, tampoco espera ya nada aquí.
    */
    for (const hoja of hojas) {
      expect(hoja.texto).not.toContain('CONTINÚA EN LA HOJA')
      expect(hoja.texto).not.toContain('SIN FIRMA')
    }
  }, 120_000)

})
