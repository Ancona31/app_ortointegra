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
  FILETE_HONORARIOS,
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

/**
 * Ráster mínimo para la zona de verificación: un PNG de 1 × 1 en base64. No hace falta
 * que sea un código legible —2.R solo coloca la imagen y la regla 3 vigila QUÉ codifica
 * quien la genera, no este archivo—, pero sí que exista: sin él la zona colapsa y el
 * rótulo `VERIFICACIÓN` no se imprime, que es exactamente lo que la prueba comprueba.
 */
const QR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

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
  divisa: 'MXN',
  notas: 'Los importes marcados como estimado de terceros son referencia de costos.',
  folio: 'Q-4F17A20C93B6',
  qr: QR,
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
  divisa: 'USD',
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
      LAS DOS COTAS: **270.7 pt con aseguradora y 208.8 sin ella**, desde el margen de
      54. Lo compuesto queda por debajo de las dos, y las dos diferencias se explican
      enteras con dos residuos ya conocidos:

          sin aseguradora   205.95   ← 2.85 por debajo de 208.8
          con aseguradora   268.48   ← 2.22 por debajo de 270.7

      Los **2.85** son el hueco del panel —56 pt en el chasis contra 59 en la lámina, la
      QUINTA que lo mide así— y aparecen en los dos lados, porque el panel está en los
      dos. Que el segundo falle por 2.22 y no por 2.85 es la otra mitad de la cuenta: el
      bloque de aseguradora compone 0.63 de más, que es el residuo de caja de línea de
      esta lámina, el mismo con el que su regla de fila mide 0.63.

      **Se mide aquí en vez de taparse.** Si algún día 2.A pasa a 59, fallan esta prueba,
      la de Imagenología, la de Receta y la de Suplementación a la vez, que es la señal
      correcta.

      ⚠ **Y AHORA SON 25 pt MENOS EN LOS DOS LADOS: 180.95 y 243.48.** Los aporta el
      subtítulo `Procedimiento o motivo`, que se retiró porque nadie lo alimentaba. La
      distancia a la cota de la lámina crece a 27.85 y 27.22, y sigue siendo por debajo:
      **la lámina mide un bloque que este documento ya no compone**. Los residuos de 2.85
      y 2.22 se conservan intactos dentro de la diferencia, que es lo que permite seguir
      leyendo la cuenta de arriba sin rehacerla.
    */
    expect(encabezado(sinSeguro)).toBeCloseTo(180.95, 1)
    expect(encabezado(conSeguro)).toBeCloseTo(243.48, 1)
  }, 120_000)

  it('el encabezado: la aseguradora pesa 62.53 y la lámina mide 61.9', async () => {
    const [conSeguro] = await componer(COTIZACION)
    const [sinSeguro] = await componer(COTIZACION_SIN_ASEGURADORA)

    /*
      LO QUE MIDE LA LÁMINA: **270.7 pt con aseguradora y 208.8 sin ella**, y la
      diferencia entre las dos son 61.9. Aquí se compone:

          10      `espacio.10`, riel → aseguradora
          52.53   el bloque: marco 2.53 + padding 6/8 + rótulo 11 + aire 2 + fila 23
          ─────
          62.53

      **Los 0.63 de sobra son el residuo de esta lámina**, el mismo con el que su riel
      cierra en 250.8 y con el que su regla de fila mide 0.63: el HTML añade el *strut*
      de la fuente donde Yoga no. Aparece en los dos lados del presupuesto —270.7 y
      208.8 fallan los dos por 2.85, que es el hueco del panel— y por eso esta resta es
      la comprobación buena: aísla el bloque sin arrastrar el panel.
    */
    expect(hastaLaPrimeraFila(conSeguro) - hastaLaPrimeraFila(sinSeguro)).toBeCloseTo(
      62.53,
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

  it('la fila de la tabla mide 17.63 y no cambia con el número de conceptos', async () => {
    const [cotizacion] = await componer(COTIZACION)
    const [recibo] = await componer(RECIBO)

    /*
      UNA SOLA CALIBRACIÓN, QUE ES LO QUE `D4` EXIGE. La lámina mide tres —21.42 con
      cuatro conceptos, 17.21 con catorce y 22.47 con uno— y eso es métrica decidida por
      el contenido, que I.3.4 prohíbe. Se compone una:

          2 + 13 + 2 + 0.63 = 17.63

      El 13 es el interlineado de `concepto.texto`, el 2 el padding de fila y el 0.63 la
      regla inferior. Que el documento de 4 y el de 14 den la MISMA cifra es la prueba.
    */
    const paso = (hoja: Hoja): number => {
      const ys = hoja.renglones.filter((r) => CONCEPTO.test(r.texto)).map((r) => r.arriba)
      expect(ys.length).toBeGreaterThan(1)
      return ys[1] - ys[0]
    }

    const esperado =
      2 * 2 + (TIPOGRAFIA['concepto.texto'].interlineado ?? 0) + FILETE_HONORARIOS.regla
    expect(esperado).toBeCloseTo(17.63, 2)
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

    const esperado =
      2 * 2 + (TIPOGRAFIA['concepto.texto'].interlineado ?? 0) + FILETE_HONORARIOS.regla

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
    // 10 · el QR y su rótulo, solo en la cotización
    expect(enCotizacion).toContain('VERIFICACIÓN')
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
    // 2.T regla 2: 22 pt, el cuerpo más grande de la hoja después del nombre del médico.
    expect([...hoja.cuerpos]).toContain(22)
    expect([...hoja.cuerpos]).toContain(TIPOGRAFIA['medico.nombre'].cuerpo)
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
    expect(recibo[0].texto).toContain('FIRMA DEL MÉDICO')

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
    expect(largo[1].texto).toContain('FIRMA DEL MÉDICO')
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
    expect(hojas[1].texto).toContain('17 conceptos · total $18,400.00 USD en la hoja 1')
    expect(hojas[1].texto).toContain('RECIBO DE HONORARIOS · CONTINUACIÓN')
    // Y el eco NO está en la hoja 1: allí la cifra la da el riel de importes.
    expect(hojas[0].texto).not.toContain('en la hoja 1')
  }, 120_000)

  it('sin contador en ninguna hoja, y con el aviso canónico del chasis', async () => {
    // El de 17, que es el que parte: el aviso de continuación solo existe si hay hoja 2.
    const hojas = await componer(RECIBO_LARGO)

    /*
      `D24` — II.5 §3 declara `ContadorLista` con `<ÍTEMS>` = CONCEPTOS y el diseño no
      lo instancia en ninguna hoja, **ni siquiera en la intermedia**. No se compone.
    */
    for (const hoja of hojas) {
      expect(hoja.texto).not.toContain('TOTAL DE ')
      expect(hoja.texto).not.toContain('HOJA 1 DE')
    }

    /*
      ⚠ EL AVISO ES EL DEL CHASIS Y LA LÁMINA COMPONE OTRO. Ella escribe «Reservado para
      la firma · continúa en la hoja 2» y «El recibo no es válido sin ella»; 2.N compone
      una sola forma para los ocho formatos (`CONCILIA D5, D22`) y no la recibe por prop.
      Se compone la del chasis y queda reportado.
    */
    expect(hojas[0].texto).toContain('CONTINÚA EN LA HOJA 2')
    expect(hojas[0].texto).toContain('SIN FIRMA NO ES VÁLIDO')
    expect(hojas[1].texto).not.toContain('CONTINÚA EN LA HOJA')
  }, 120_000)
})
