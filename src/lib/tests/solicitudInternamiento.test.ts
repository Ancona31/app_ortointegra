/**
 * II.6 · Solicitud de Internamiento — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. Una prueba
 * que comparase tokens contra tokens daría por bueno cualquier presupuesto escrito a mano,
 * que es el defecto que destapó la conciliación de 4.1. Aquí se renderiza el PDF, se leen
 * las coordenadas de su flujo de contenido y se mide.
 *
 * El lector sale entero de `hojaDeContinuacion.test.ts`, con **un extractor más**: los
 * rectángulos rellenos del flujo (`re`). Hacen falta para lo único de este formato que no
 * es texto y que la verificación visible de II.6 §6 pide mirar — que el filete de la
 * sección 2 sea claramente más grueso que cualquier otro del documento.
 *
 * LO QUE ESTA PRUEBA VIGILA Y NINGUNA OTRA PUEDE
 *
 * **Que el reparto en tres hojas sea estructural.** Es el único formato del sistema cuyo
 * corte no depende de cuánto quepa, y eso solo se puede comprobar contando hojas y mirando
 * qué cae en cada una.
 *
 * **Que la hoja 3 no diga «continuación».** Es la regla 1 de 2.Q y es la única que se puede
 * romper escribiendo una cadena en el sitio equivocado, ahora que 2.N acepta rótulos
 * propios por hoja.
 *
 * **Que los bloques de un solo ítem conserven su raya.** Fue un defecto real y medido: al
 * reanalizar cada bloque por separado, la degradación del ítem único de 2.J —que es global
 * a la cadena a propósito— convertía tres de los cuatro bloques en párrafos sin marca.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import SolicitudInternamiento, {
  type SolicitudInternamientoProps,
} from '@/lib/pdf/v2/formatos/SolicitudInternamiento'
import {
  FILETE,
  FILETE_INTERNAMIENTO,
  RIEL_CELDA,
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

/** Un rectángulo relleno del flujo. Los filetes del sistema son todos de esta clase. */
interface Rectangulo {
  readonly ancho: number
  readonly alto: number
}

interface Hoja {
  readonly texto: string
  readonly cuerpos: ReadonlySet<number>
  readonly renglones: readonly Renglon[]
  readonly rectangulos: readonly Rectangulo[]
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
    const rectangulos: Rectangulo[] = []
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
      /(q)\n|(Q)\n|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm|\/(\w+) ([\d.]+) Tf|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm|\[([^\]]*)\] TJ|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re/g,
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
      if (t[18] !== undefined) {
        rectangulos.push({ ancho: +t[20], alto: +t[21] })
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
    return { texto, cuerpos, renglones, rectangulos }
  })
}

// ─── Los datos, inventados y compartidos ─────────────────────────────────────

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/**
 * ⚠ Ninguna cadena de anclaje lleva la secuencia `fi` en minúscula: react-pdf incrusta la
 * LIGADURA como un glifo propio y su `ToUnicode` no la descompone. Por eso aquí no se
 * anclan `Profilaxis`, `Justificación` ni `firma` — salen del PDF sin la `fi`.
 */
const PACIENTE = 'Renata Bustamante Oceguera'
const HOSPITAL = 'Hospital Ficticio del Centro'

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

/** Las cuatro celdas de la fila inferior del riel, con la de ASA a span 1. */
const RIEL_INGRESO = {
  hospital: HOSPITAL,
  tipoInternamiento: 'Cirugía electiva',
  diasEstimados: '2 días',
  asa: 'II',
}

/** Cuatro bloques, y **tres de ellos con un solo ítem**: es lo que destapó el defecto. */
const INDICACIONES = [
  'Dieta',
  '— Ayuno absoluto hasta valoración del anestesiólogo.',
  '— Dieta blanda a tolerancia a las seis horas.',
  '',
  'Soluciones',
  '— Solución Hartmann 1000 mL para 8 horas.',
  '',
  'Medicamentos',
  '— Cefalotina 1 g intravenoso cada 8 horas.',
  '',
  'Cuidados generales',
  '— Signos vitales cada 4 horas.',
].join('\n')

const COMPLETO: SolicitudInternamientoProps = {
  ...CHASIS,
  paciente: {
    paciente: PACIENTE,
    /*
      ⚠ NO SALE EN EL RIEL DE ESTA LÁMINA Y AQUÍ NO SOBRA. La fila superior de Internamiento
      cambió edad y sexo por la fecha de ingreso, pero `EncabezadoHoja` sigue componiendo la
      edad en la línea de paciente de las hojas de continuación — que es lo que afirma la
      prueba de la regla 2 de 2.D, más abajo. `sexo` sí se retiró: no tiene segundo consumidor.
    */
    edad: '25 años',
    expediente: '2026-0184',
    fechaIngreso: '12 de agosto de 2026',
    ...RIEL_INGRESO,
  },
  emision: '8 ago 2026 · 09:40',
  urgente: true,
  diagnosticos: [
    '— Gonartrosis tricompartimental derecha, grado IV',
    '— Hipertensión arterial sistémica en control',
  ].join('\n'),
  procedimiento: 'Artroplastia total de rodilla derecha, cementada.',
  /** El catálogo en el orden literal de la lámina: tres columnas y tres filas. */
  requerimientos: [
    'Sangre y hemoderivados',
    'Profilaxis antibiótica',
    'Tromboprofilaxis',
    'Unidad de cuidados intensivos',
    'Material de osteosíntesis',
    'Implante especial',
    'Ayuno preoperatorio',
  ],
  justificacion: 'Dolor incapacitante de más de dieciocho meses de evolución.',
  instruccionesPaciente: [
    '— Presentarse en Admisión a las 06:00 h del día programado.',
    '— Ayuno absoluto de ocho horas: sin alimentos, agua, café ni chicle.',
    '— Acudir acompañado por un adulto.',
  ].join('\n'),
  indicacionesPiso: INDICACIONES,
}

/** Sin sección 2: la hoja 3 colapsa entera y la firma del médico baja a la 2. */
const MINIMO: SolicitudInternamientoProps = {
  ...COMPLETO,
  urgente: undefined,
  procedimiento: undefined,
  requerimientos: undefined,
  indicacionesPiso: undefined,
}

/** La verificación visible de II.6 §6: dos renglones de prosa antes del primer bloque. */
const PROSA_1 = 'La paciente ingresa la noche previa por indicación de anestesiología.'
const PROSA_2 = 'Se avisa al residente de guardia al terminar el registro de ingreso.'
const CON_PROSA: SolicitudInternamientoProps = {
  ...COMPLETO,
  indicacionesPiso: [PROSA_1, PROSA_2, '', INDICACIONES].join('\n'),
}

/** Un `Document` con un solo `Page`, que es lo que ocurre en emisión real. */
async function componer(props: SolicitudInternamientoProps): Promise<Hoja[]> {
  return leer(
    await renderToBuffer(h<DocumentProps>(Document, {}, h(SolicitudInternamiento, props))),
  )
}

/**
 * react-pdf sitúa la línea base a `ascendente × cuerpo` del borde superior de la caja de
 * línea. Es la misma constante con la que 2.C explica el desplazamiento de 1.976 pt entre
 * el título y su fecha, y la que usa la prueba de II.5.
 */
const ASCENDENTE_ARCHIVO = 878 / 1000

function renglon(hoja: Hoja, texto: string): Renglon {
  const encontrado = hoja.renglones.find((r) => r.texto === texto)
  expect(encontrado, `no se encontró el renglón «${texto}»`).toBeDefined()
  return encontrado as Renglon
}

/**
 * El encabezado propio: del margen de 54 al borde superior del primer bloque. Se mide
 * desde la línea base de su título restando lo único que hay en medio — el filete del
 * bloque y el ascendente del rótulo.
 */
function encabezado(hoja: Hoja): number {
  return (
    renglon(hoja, 'Diagnósticos').arriba -
    54 -
    FILETE_INTERNAMIENTO.regla -
    ASCENDENTE_ARCHIVO * TIPOGRAFIA['bloqueSimple.titulo'].cuerpo
  )
}

describe('II.6 · Solicitud de Internamiento', () => {
  it('el encabezado, contra la cota de 237.61 de la lámina', async () => {
    const [hoja1] = await componer(COMPLETO)

    /*
      LO COMPUESTO SON **233.825 pt** CONTRA LOS 237.61 MEDIDOS, y los 3.785 de diferencia
      se explican enteros con dos residuos ya conocidos:

          2.85    el hueco del panel —56 pt en el chasis contra 58.85 en la lámina—, la
                  SEXTA lámina que lo mide por encima de 56
          0.935   el residuo de caja de línea del HTML, repartido entre el bloque de título
                  (0.84) y el riel de identificación (0.095)

      **Se mide aquí en vez de taparse.** Si algún día 2.A pasa a 59, fallan esta prueba,
      la de Imagenología, la de Receta, la de Suplementación y la de Honorarios a la vez,
      que es la señal correcta.
    */
    expect(encabezado(hoja1)).toBeCloseTo(233.83, 1)
  }, 120_000)

  it('tres hojas, con el reparto estructural de la lámina', async () => {
    const hojas = await componer(COMPLETO)
    expect(hojas).toHaveLength(3)

    // Hoja 1 · sección 1: diagnósticos, procedimiento, requerimientos y justificación.
    expect(hojas[0].texto).toContain('Diagnósticos')
    expect(hojas[0].texto).toContain('Procedimiento o cirugía')
    expect(hojas[0].texto).toContain('Requerimientos especiales')
    expect(hojas[0].texto).toContain('Sangre y hemoderivados')

    // Hoja 2 · cierre de la sección 1: instrucciones y las DOS firmas.
    expect(hojas[1].texto).toContain('INSTRUCCIONES PARA EL PACIENTE')
    expect(hojas[1].texto).toContain('FIRMA DEL PACIENTE O FAMILIAR')
    expect(hojas[1].texto).toContain('FIRMA Y SELLO DEL MÉDICO')
    expect(hojas[1].texto).not.toContain('Requerimientos especiales')

    // Hoja 3 · sección 2: apertura, bloques numerados y UNA firma.
    expect(hojas[2].texto).toContain('Indicaciones de ingreso a piso')
    expect(hojas[2].texto).toContain('Para personal de enfermería y médico residente')
    expect(hojas[2].texto).toContain('Cuidados generales')
    expect(hojas[2].texto).not.toContain('FIRMA DEL PACIENTE O FAMILIAR')

    // Y la paginación de 2.M cuenta las tres.
    expect(hojas[2].texto).toContain('PÁGINA 3 DE 3')
  }, 120_000)

  it('la hoja 3 dice «sección 2 de 2» y NUNCA «continuación»', async () => {
    const hojas = await componer(COMPLETO)

    /*
      LA REGLA 1 DE 2.Q, MEDIDA. La hoja 2 sí es continuación de la 1 —cierra la sección 1
      con las instrucciones y las firmas— y compone el rótulo del chasis. La 3 abre otro
      documento dentro del mismo folio y compone el suyo.
    */
    expect(hojas[1].texto).toContain('SOLICITUD DE INTERNAMIENTO · CONTINUACIÓN')
    expect(hojas[2].texto).toContain('SOLICITUD DE INTERNAMIENTO · SECCIÓN 2 DE 2')
    expect(hojas[2].texto).not.toContain('CONTINUACIÓN')
  }, 120_000)

  it('el filete de la sección 2 es el más grueso del documento', async () => {
    const hojas = await componer(COMPLETO)

    /*
      LA VERIFICACIÓN VISIBLE DE II.6 §6, medida sobre los rectángulos rellenos del flujo:
      la sección 2 abre con un segmento de **144 × 4** y ningún otro filete del documento
      pasa de los 2.5 pt del principal. Se descartan los rectángulos que no son filetes —el
      fondo de la hoja, el panel circular, el badge y la banda de pie— por su alto.
      */
    const filetes = (hoja: Hoja): readonly Rectangulo[] =>
      hoja.rectangulos.filter((r) => r.alto <= FILETE.transicion && r.ancho >= 90)

    expect(filetes(hojas[2])).toContainEqual({ ancho: 144, alto: FILETE.transicion })
    for (const hoja of [hojas[0], hojas[1]]) {
      for (const filete of filetes(hoja)) expect(filete.alto).toBeLessThanOrEqual(2.5)
    }
  }, 120_000)

  it('los bloques de un solo ítem conservan su raya', async () => {
    const [, , hoja3] = await componer(COMPLETO)

    /*
      EL DEFECTO QUE ESTA PRUEBA EXISTE PARA FIJAR. Tres de los cuatro bloques traen una
      sola viñeta, y al reanalizar cada bloque por separado la degradación del ítem único
      de 2.J —global a la cadena a propósito— los convertía en párrafos sin marca. Con el
      análisis en una sola pasada, las CINCO viñetas salen.
    */
    const rayas = hoja3.renglones.filter((r) => r.texto === '—')
    expect(rayas).toHaveLength(5)

    // Y los cuatro bloques llevan su número corrido, sin cero a la izquierda.
    for (const numero of ['1', '2', '3', '4']) {
      expect(hoja3.renglones.some((r) => r.texto === numero)).toBe(true)
    }
  }, 120_000)

  it('la prosa suelta no consume número ni lleva raya (II.6 §6)', async () => {
    const [, , hoja3] = await componer(CON_PROSA)

    // Los dos renglones salen enteros, en su caja y sin marca delante.
    const prosa1 = renglon(hoja3, PROSA_1)
    const prosa2 = renglon(hoja3, PROSA_2)
    expect(prosa1.x).toBeCloseTo(72, 1)
    expect(prosa2.x).toBeCloseTo(72, 1)

    /*
      Y EL PRIMER BLOQUE NUMERADO SIGUE LLEVANDO EL 1: la prosa no consume número, que es
      lo que el contador de bloques del analizador ya declara. Con cuatro bloques, el
      último es el 4 y no el 5.
    */
    expect(hoja3.renglones.some((r) => r.texto === '4')).toBe(true)
    expect(hoja3.renglones.some((r) => r.texto === '5')).toBe(false)
  }, 120_000)

  it('sin folio y sin contador en ninguna hoja', async () => {
    const hojas = await componer(COMPLETO)

    /*
      LA DECISIÓN DE ANGEL, MEDIDA EN LAS TRES HOJAS. La lámina compone folio con prefijo
      `H-` en las tres y este formato no lo lleva: es documento de apoyo interno, sin valor
      legal propio y sin tercero que cite un número. Lo que ata las hojas es la paginación
      y la línea de paciente.

      La banda de pie compone el TÍTULO en la zona donde iría el número, que es lo que hace
      la variante `sin folio` de 2.M.
    */
    for (const hoja of hojas) {
      expect(hoja.texto).not.toContain('FOLIO')
      expect(hoja.texto).not.toContain('H-')
      // 2.K no se instancia: el catálogo de requerimientos es abierto (regla 3).
      expect(hoja.texto).not.toContain('TOTAL DE ')
      expect(hoja.texto).toContain('Solicitud de internamiento')
    }
  }, 120_000)

  it('el badge sale solo en la hoja 1, y el hospital en las otras dos', async () => {
    const hojas = await componer(COMPLETO)

    /*
      ⚠ **VA CONTRA LA LECTURA DE CORRIDO DE LA REGLA 4 DE 2.H** —un badge marca el
      DOCUMENTO, no una hoja— y es lo que compone la lámina: las otras dos láminas con
      bloque en negativo lo repiten reducido en su continuación y esta no lo compone.
    */
    expect(hojas[0].texto).toContain('URGENTE')
    expect(hojas[1].texto).not.toContain('URGENTE')
    expect(hojas[2].texto).not.toContain('URGENTE')

    /*
      LA LÍNEA DE PACIENTE LLEVA EL HOSPITAL, que ningún otro formato tiene. Es lo que hace
      que una hoja separada se pueda devolver a su piso, que es para lo que existe la regla
      2 de 2.D.
    */
    for (const hoja of [hojas[1], hojas[2]]) {
      expect(hoja.texto).toContain(
        `Paciente · ${PACIENTE} · 25 años · Exp. 2026-0184 · ${HOSPITAL}`,
      )
    }
  }, 120_000)

  it('el riel de ingreso reparte 5 + 4 + 2 + 1, con ASA en la celda más estrecha', async () => {
    const [hoja1] = await componer(COMPLETO)

    /*
      LAS CUATRO CELDAS DE LA FILA INFERIOR, medidas por dónde arrancan sus rótulos. Las
      diferencias son múltiplos exactos de `riel.celda`, así que el reparto se lee sin
      depender del padding ni del filete: lo que se compara son dos celdas con el mismo
      arranque relativo.
    */
    const x = (etiqueta: string): number => renglon(hoja1, etiqueta).x
    expect(x('TIPO DE INTERNAMIENTO') - x('HOSPITAL O LUGAR')).toBeCloseTo(5 * RIEL_CELDA, 0)
    expect(x('DÍAS EST.') - x('TIPO DE INTERNAMIENTO')).toBeCloseTo(4 * RIEL_CELDA, 1)
    expect(x('ASA') - x('DÍAS EST.')).toBeCloseTo(2 * RIEL_CELDA, 1)

    // Y la de ASA es la última: lo que queda hasta el borde de la caja es UNA columna.
    expect(x('ASA') + RIEL_CELDA).toBeGreaterThan(72 + 486 - RIEL_CELDA)
  }, 120_000)

  /**
   * ⚠ LA FECHA DE INGRESO ES LO QUE EL HOSPITAL NECESITA PARA AGENDAR LA CAMA, y v2 no tenía
   * dónde ponerla: `ValoresPaciente` no la declaraba y la fila inferior está llena —una de
   * sus celdas ya está en el mínimo del sistema—. v1 sí la imprime
   * (`SolicitudInternamientoPdf.tsx:316`), así que encender v2 la habría borrado del papel.
   *
   * La fila superior de este formato es propia: `Paciente 5 · Ingreso 4 · Expediente 3`.
   * Edad y sexo ceden sus cuatro columnas y ninguna de las otras dos cambia de ancho.
   */
  it('la fila superior es propia: paciente 5, ingreso 4, expediente 3', async () => {
    const [hoja1] = await componer(COMPLETO)
    const x = (etiqueta: string): number => renglon(hoja1, etiqueta).x

    expect(hoja1.texto).toContain('12 de agosto de 2026')
    expect(x('INGRESO') - x('PACIENTE')).toBeCloseTo(5 * RIEL_CELDA, 0)
    expect(x('EXPEDIENTE') - x('INGRESO')).toBeCloseTo(4 * RIEL_CELDA, 0)

    // Y las dos celdas que este riel NO lleva, contra las del chasis.
    expect(hoja1.texto).not.toContain('SEXO')
    expect(hoja1.texto).not.toContain('EDAD')
  }, 120_000)

  it('el catálogo de requerimientos son tres columnas de 162 que envuelven', async () => {
    const [hoja1] = await componer(COMPLETO)

    /*
      TRES COLUMNAS DE 4 × `riel.celda` = 162 pt. La primera arranca pegada al margen —su
      padding izquierdo es 0— y las otras dos sangran 10 pt tras su regla de 0.63.
    */
    const columna = (n: number): number =>
      72 + n * 4 * RIEL_CELDA + (n === 0 ? 0 : FILETE_INTERNAMIENTO.regla + 10)
    expect(renglon(hoja1, 'Sangre y hemoderivados').x).toBeCloseTo(columna(0), 1)
    expect(renglon(hoja1, 'Material de osteosíntesis').x).toBeCloseTo(columna(1), 1)
    expect(renglon(hoja1, 'Implante especial').x).toBeCloseTo(columna(2), 1)

    /*
      Y CON SIETE ÍTEMS SON TRES FILAS, LA ÚLTIMA COJA: la celda mide 23 —4 + 14 + 5— más
      la regla de fila de 0.5. La lámina mide 23.48, y los 0.48 son el residuo de caja de
      línea del HTML. Que la última fila lleve un solo requerimiento es lo que hace una
      retícula que envuelve: no se rellena con celdas vacías.
    */
    const paso =
      renglon(hoja1, 'Unidad de cuidados intensivos').arriba -
      renglon(hoja1, 'Sangre y hemoderivados').arriba
    expect(paso).toBeCloseTo(23 + FILETE.regla, 1)
    expect(renglon(hoja1, 'Ayuno preoperatorio').x).toBeCloseTo(columna(0), 1)
  }, 120_000)

  it('las dos composiciones de firma del mismo documento', async () => {
    const hojas = await componer(COMPLETO)

    /*
      LA HOJA 2 COMPONE EL NOMBRE A 10 / 14 Y LA HOJA 3 A 11 / 15, y las dos cifras salen
      de la distancia entre el rótulo de la firma y el nombre de abajo:

          hoja 2   11 + 77 + 0.47 + 4 + 0.878 × 10 − 0.878 × 7 = 95.104
          hoja 3   11 + 77 + 0.75 + 4 + 0.878 × 11 − 0.878 × 7 = 96.262

      Son 1.158 pt de diferencia dentro del mismo archivo. **Queda reportado**: es el
      cuarto y el segundo valor del sistema para el mismo renglón.
    */
    /*
      El nombre del médico sale DOS veces en las hojas de continuación —arriba en la
      cabecera del membrete y abajo bajo la línea de firma—, así que se toma el de más
      abajo. Buscar el primero mediría contra el membrete y daría un salto negativo.
    */
    const salto = (hoja: Hoja): number => {
      const nombres = hoja.renglones
        .filter((r) => r.texto === CHASIS.medico.nombre)
        .map((r) => r.arriba)
      expect(nombres.length).toBeGreaterThan(0)
      return Math.max(...nombres) - renglon(hoja, 'FIRMA Y SELLO DEL MÉDICO').arriba
    }

    const rol = ASCENDENTE_ARCHIVO * (TIPOGRAFIA['firma.rol'].cuerpo ?? 0)
    expect(salto(hojas[1])).toBeCloseTo(11 + 77 + 0.47 + 4 + ASCENDENTE_ARCHIVO * 10 - rol, 1)
    expect(salto(hojas[2])).toBeCloseTo(11 + 77 + 0.75 + 4 + ASCENDENTE_ARCHIVO * 11 - rol, 1)
  }, 120_000)

  it('sin indicaciones de piso, la sección 2 colapsa entera', async () => {
    const hojas = await componer(MINIMO)

    /*
      II.6 §2: `indicacionesPiso` ausente **colapsa la sección 2 entera** — su apertura, sus
      bloques y su hoja. La firma del médico no desaparece: baja a cerrar la hoja 2, detrás
      de la pareja, porque la monta 2.N como cierre del documento.
    */
    expect(hojas).toHaveLength(2)
    expect(hojas[1].texto).not.toContain('Indicaciones de ingreso a piso')
    expect(hojas[1].texto).toContain('FIRMA DEL PACIENTE O FAMILIAR')
    expect(hojas[1].texto).toContain('PÁGINA 2 DE 2')

    // Y los tres bloques opcionales de la hoja 1 colapsan sin dejar rótulo ni hueco.
    expect(hojas[0].texto).not.toContain('Procedimiento o cirugía')
    expect(hojas[0].texto).not.toContain('Requerimientos especiales')
    expect(hojas[0].texto).not.toContain('URGENTE')
  }, 120_000)

  it('el aviso de pie es el del chasis, y la lámina compone otro', async () => {
    const hojas = await componer(COMPLETO)

    /*
      ⚠ **REPORTADO Y NO COMPUESTO.** La lámina escribe `Continúa en la hoja 2 ·
      instrucciones y firmas` a la izquierda y `Sección 1 de 2` a la derecha —la CUARTA
      construcción distinta de esa zona, que es lo que `D22` lleva reportado desde la
      conciliación—. 2.N compone una sola forma para los seis formatos (`CONCILIA D5, D22`)
      y no la recibe por prop.
    */
    expect(hojas[0].texto).toContain('CONTINÚA EN LA HOJA 2')
    expect(hojas[0].texto).toContain('SIN FIRMA NO ES VÁLIDO')
    expect(hojas[1].texto).toContain('CONTINÚA EN LA HOJA 3')
    expect(hojas[2].texto).not.toContain('CONTINÚA EN LA HOJA')
    expect(hojas[0].texto).not.toContain('Sección 1 de 2')
  }, 120_000)
})
