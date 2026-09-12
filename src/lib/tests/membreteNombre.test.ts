/**
 * 2.B · El nombre del médico en el MEMBRETE — **la prueba del cuerpo ajustado.**
 *
 * QUÉ DEFIENDE
 *
 * El nombre se componía a 26 pt fijos en una caja de 412, así que uno largo partía en
 * dos renglones y la fila superior crecía de 56 a 75 pt. Esos 19 pt bajaban a TODO el
 * contenido, y en los NUEVE formatos, porque `Membrete` es chasis compartido.
 *
 * Ahora el cuerpo se deriva del ancho compuesto (`cuerpoDelNombre()`), con techo en el
 * cuerpo declarado del rol y piso en el del rótulo del documento. Esta prueba mide el
 * PDF real y comprueba las cuatro cosas que pueden romperse:
 *
 *   1. que un nombre que cabía a 26 sigue saliendo EXACTAMENTE igual
 *   2. que el largo deja de partir y la fila recupera sus 56 pt, sin empuje
 *   3. que el panel de identidad no se mueve —su centrado depende del alto de fila—
 *   4. que la tabla de métricas sigue correspondiendo a la fuente del repo
 *
 * LA CUARTA ES LA QUE ENVEJECE. `metricasNombre.ts` es un archivo GENERADO desde
 * `Archivo-SemiBold.ttf`; si alguien repone el TTF y no vuelve a correr
 * `scripts/generar-metricas-nombre.mjs`, el cuerpo elegido dejaría de corresponder al
 * ancho real y nada lo diría. Aquí se concilia la tabla contra el ancho que compone el
 * renderer, que es la única forma de que ese desfase se note.
 *
 * Lector de coordenadas: el mismo de `recetaMedica.test.ts`. Ver su cabecera.
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
import { cuerpoDelNombre } from '@/lib/pdf/v2/Membrete'
import { avanceRelativo } from '@/lib/pdf/v2/metricasNombre'
import { PANEL_DIAMETRO } from '@/lib/pdf/v2/PanelCircular'
import {
  CAJA,
  NOMBRE_MEMBRETE,
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

// ─── El caso ─────────────────────────────────────────────────────────────────

registrarFuentesDeDisco()

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/** PNG de un píxel: el QR no se mide aquí, solo tiene que existir. */
const QR_MINIMO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** Ancho disponible para el nombre con panel visible: la resta de 2.B. */
const DISPONIBLE = CAJA.ancho - PANEL_DIAMETRO - 18

/** Nombre que cabe a 26 pt: la referencia de «no se mueve nada». */
const CORTO = 'Dr. Ángel Ancona'
/** El caso reportado: 489 pt a 26, se pasa un 19 %. */
const LARGO = 'Dra. Mónica Alexandra Arámbula Sánchez'
/**
 * Cerca del piso.
 *
 * ⚠ Ninguna cadena de este archivo lleva `fi` ni `fl`: react-pdf incrusta la LIGADURA
 * como un glifo propio y su `ToUnicode` no la descompone, así que un «Delfino» vuelve
 * del flujo como «Delno» y no hay renglón que encontrar. Es la misma trampa que anota
 * `recetaMedica.test.ts`.
 */
const MUY_LARGO = 'Dr. Diego Demetrio Tadeo Zambrano Hernández'
/** El extremo: al piso todavía no cabe, así que parte — como antes. */
const EXTREMO =
  'Dra. María Guadalupe Echeverría Zambrano de la Torre Villaseñor Buenrostro'

/**
 * Testigo del panel oculto: 435.9 pt a 26: **no cabe en 412 pero sí en 486.**
 * `MUY_LARGO` no sirve para esto porque tampoco cabe en la caja entera.
 */
const INTERMEDIO = 'Dr. Juan Carlos Villaseñor Maldonado'

const MEDICAMENTOS: readonly MedicamentoRecetado[] = [
  {
    nombre_comercial: 'Meloxicam',
    presentacion: 'Tabletas 15 mg',
    via_administracion: 'Oral',
    indicacion: 'Una tableta cada 24 horas.',
  },
]

const COMUN = {
  medico: {
    nombre: CORTO,
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

async function componer(nombre: string): Promise<Hoja[]> {
  return hojas(
    await renderToBuffer(
      h<DocumentProps>(
        Document,
        {},
        h(RecetaMedica, {
          ...COMUN,
          medico: { ...COMUN.medico, nombre },
          medicamentos: MEDICAMENTOS,
        }),
      ),
    ),
  )
}

/**
 * Ancho compuesto REAL de una cadena, medido sobre el PDF.
 *
 * La hoja es deliberadamente enorme y sin padding: con la de carta, un nombre largo
 * a 26 pt envuelve dentro de la propia sonda y ya no hay renglón que medir.
 */
async function anchoReal(cadena: string, cuerpo: number): Promise<number> {
  const MARCA = '|'
  const estilo = { ...estiloTipografico('medico.nombre' as RolTipograficoNombre, acento) }
  const ajustado = {
    ...estilo,
    fontSize: cuerpo,
    letterSpacing: TIPOGRAFIA['medico.nombre'].tracking * cuerpo,
  }
  const hoja = (
    await hojas(
      await renderToBuffer(
        h<DocumentProps>(
          Document,
          {},
          h(
            Page,
            { size: [4000, 300], style: { padding: 0 } },
            h(
              View,
              { style: { flexDirection: 'row', alignSelf: 'flex-start' } },
              h(Text, { style: ajustado }, cadena),
              h(Text, { style: ajustado }, MARCA),
            ),
          ),
        ),
      ),
    )
  )[0]
  return renglon(hoja, MARCA).x - renglon(hoja, cadena).x
}

/** Los renglones del nombre en el membrete: 1 si cabe, 2 si parte. */
function renglonesDelNombre(hoja: Hoja, nombre: string): number {
  const primera = nombre.split(' ')[0]
  return hoja.renglones.filter((r) => r.arriba < 120 && r.texto.startsWith(primera)).length
}

describe('2.B · nombre del médico en el membrete', () => {
  it('la tabla de métricas concilia con el ancho que compone el renderer', async () => {
    /*
      LA SONDA QUE DETECTA UNA TABLA OBSOLETA. `metricasNombre.ts` se genera desde el
      TTF; si el TTF cambia y nadie regenera, esto falla. La tolerancia es de 0.1 pt
      —el error de la tabla frente al renderer, medido sobre once nombres reales—, no
      un margen cómodo puesto a ojo.
    */
    for (const nombre of [CORTO, LARGO, MUY_LARGO, EXTREMO]) {
      const cuerpo = 26
      const rol = TIPOGRAFIA['medico.nombre']
      const previsto =
        cuerpo *
        (avanceRelativo(nombre) / 1000 + rol.tracking * [...nombre].length)
      expect(await anchoReal(nombre, cuerpo), nombre).toBeCloseTo(previsto, 1)
    }
  }, 200_000)

  it('un nombre que cabe a 26 no se mueve: mismo cuerpo y una sola línea', async () => {
    expect(cuerpoDelNombre(CORTO, DISPONIBLE)).toBe(NOMBRE_MEMBRETE.techo)
    const hoja = (await componer(CORTO))[0]
    expect(renglonesDelNombre(hoja, CORTO)).toBe(1)
  }, 200_000)

  it('el nombre largo cabe en UNA línea y no supera el ancho disponible', async () => {
    for (const nombre of [LARGO, MUY_LARGO]) {
      const cuerpo = cuerpoDelNombre(nombre, DISPONIBLE)
      expect(cuerpo, nombre).toBeLessThan(NOMBRE_MEMBRETE.techo)
      expect(cuerpo, nombre).toBeGreaterThanOrEqual(NOMBRE_MEMBRETE.piso)
      // Lo que importa: al cuerpo elegido, el ancho compuesto CABE.
      expect(await anchoReal(nombre, cuerpo), nombre).toBeLessThanOrEqual(DISPONIBLE)
      expect(renglonesDelNombre((await componer(nombre))[0], nombre), nombre).toBe(1)
    }
  }, 200_000)

  it('el piso no se cruza: al extremo se le deja partir, como antes', async () => {
    expect(cuerpoDelNombre(EXTREMO, DISPONIBLE)).toBe(NOMBRE_MEMBRETE.piso)
    // Y al piso todavía no cabe: por eso parte. Es el caso aceptado de ~70 caracteres.
    expect(await anchoReal(EXTREMO, NOMBRE_MEMBRETE.piso)).toBeGreaterThan(DISPONIBLE)
  }, 200_000)

  it('la fila del membrete no crece: el empuje de 19 pt desaparece', async () => {
    /*
      LA COTA DE LA REGRESIÓN. Con el cuerpo fijo, el nombre largo partía y la fila
      pasaba de 56 a 75 pt: 19 pt que bajaban a TODO lo que viene después. Aquí se
      mide que las posiciones son IDÉNTICAS con el nombre corto y con el largo.

      ⚠ **VALE PARA LOS NUEVE FORMATOS Y SE MIDE EN UNO.** Lo que se comprueba no es
      una cota de la Receta: es que el ALTO DE LA FILA del membrete no depende del
      nombre. Esa fila la compone `Membrete`, que es chasis compartido y entra en los
      nueve por `EncabezadoHoja` — el que se elija para medir da lo mismo.
    */
    const corto = (await componer(CORTO))[0]
    const largo = (await componer(LARGO))[0]
    for (const sonda of ['Av. Ficticia', 'RECETA', 'PACIENTE', 'Meloxicam']) {
      expect(renglon(largo, sonda).arriba, sonda).toBeCloseTo(renglon(corto, sonda).arriba, 2)
    }
  }, 200_000)

  it('la especialidad sube 2.2 pt, y es la consecuencia buscada', async () => {
    /*
      ⚠ **ESTO NO ES UNA FUGA DEL EMPUJE: ES EL INTERLINEADO PROPORCIONAL FUNCIONANDO.**
      Al encoger el cuerpo, el renglón del nombre mide menos —`lineHeight` es un RATIO,
      así que baja con él— y el bloque nombre+especialidad pasa de 47 a 42.6 pt. Como la
      fila lo centra verticalmente (`alignItems: 'center'`), el bloque se reparte la
      diferencia y la especialidad sube (47 − 42.6) / 2 = 2.2 pt.

      La fila sigue midiendo 56 —lo dice el panel, que no se mueve— y por eso NADA de lo
      que viene debajo se entera. Queda medido en vez de tapado: si algún día esta cifra
      cambia, es que cambió el centrado o el ratio, y conviene enterarse.
    */
    const corto = (await componer(CORTO))[0]
    const largo = (await componer(LARGO))[0]
    const delta = renglon(corto, 'Ortopedia').arriba - renglon(largo, 'Ortopedia').arriba
    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeCloseTo(2.21, 1)
  }, 200_000)

  it('el panel de identidad no se mueve', async () => {
    /*
      El panel se centra verticalmente en la fila (`alignItems: 'center'`), así que su
      posición es un TESTIGO del alto de fila: cuando el nombre partía, el monograma
      bajaba de 89.2 a 98.7. Que vuelva a coincidir es lo que dice que la fila recuperó
      sus 56 pt, y no solo que el texto de abajo no se movió.
    */
    const corto = (await componer(CORTO))[0]
    const largo = (await componer(LARGO))[0]
    expect(renglon(largo, 'EM').arriba).toBeCloseTo(renglon(corto, 'EM').arriba, 2)
  }, 200_000)

  it('con panel oculto el disponible es la caja entera', () => {
    /*
      Regla 4 de 2.A: sin panel no hay panel NI medianil. Si esto se restara siempre,
      un membrete sin panel encogería el nombre sin necesidad. `MUY_LARGO` es el
      testigo: con panel se encoge, sin panel cabe a 26.
    */
    expect(cuerpoDelNombre(INTERMEDIO, DISPONIBLE)).toBeLessThan(NOMBRE_MEMBRETE.techo)
    expect(cuerpoDelNombre(INTERMEDIO, CAJA.ancho)).toBe(NOMBRE_MEMBRETE.techo)
  })
})
