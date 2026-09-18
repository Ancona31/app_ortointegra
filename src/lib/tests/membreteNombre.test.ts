/**
 * 2.B · El nombre del médico en el MEMBRETE.
 *
 * ── QUÉ DEFENDÍA ESTA PRUEBA EN v2, Y POR QUÉ CAMBIA ────────────────────────
 *
 * El nombre se componía a 26 pt en una caja de 412, así que uno largo partía en dos
 * renglones y la fila superior crecía de 56 a 75 pt: 19 pt que bajaban a TODO el
 * contenido en los nueve formatos. v2 lo cerró DERIVANDO el cuerpo del ancho compuesto
 * (`cuerpoDelNombre()`), con techo en el cuerpo del rol y piso en el del rótulo del
 * documento.
 *
 * ⚠ **EN v3 ESE ALGORITMO SE RETIRA, Y NO ES UNA REGRESIÓN.** Los dos roles bajan a 15
 * —`medico.nombre` y `titulo.documento`—, así que techo y piso coinciden y la función
 * devolvería siempre la misma cifra: el intervalo se cerró solo. El nombre va a **15 pt
 * fijos con `maxLines: 1` y elipsis**, que resuelve el mismo defecto sin calcular nada.
 * `cuerpoDelNombre()`, `NOMBRE_MEMBRETE` y `metricasNombre.ts` quedan en el repo sin
 * consumidor (`dudas.md` §3).
 *
 * Las cinco cotas que medían el algoritmo describían la maqueta vieja y se reescriben
 * contra el render nuevo. **Lo que defienden sigue siendo lo mismo y es lo que importa:
 * que el nombre NO parta y que la fila NO crezca con él.** Las tres que ya lo medían
 * así —la fila, el panel y la especialidad— se conservan.
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
import { PANEL_DIAMETRO } from '@/lib/pdf/v2/PanelCircular'
import {
  CAJA,
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
  /*
    ⚠ LA CONCILIACIÓN DE `metricasNombre.ts` SE RETIRA CON SU CONSUMIDOR.
    Era la sonda que detectaba una tabla de métricas obsoleta frente al TTF del repo, y
    sólo tenía sentido mientras alguien eligiera el cuerpo con esa tabla. Sin
    `cuerpoDelNombre()` no hay elección que conciliar: el archivo generado queda inerte y
    una prueba que lo vigile mide código sin consumidores. Si el algoritmo vuelve —haría
    falta declarar un piso real, ver `dudas.md` §3—, esta prueba vuelve con él.
  */

  it('el cuerpo del nombre NO depende del nombre: su base cae en el mismo sitio', async () => {
    /*
      ⚠ LA COTA QUE SUSTITUYE A `un nombre que cabe a 26 no se mueve`.
      Aquella comprobaba que `cuerpoDelNombre()` devolvía el techo para un nombre corto.
      Sin algoritmo, lo que hay que vigilar es lo contrario y es más fuerte: que el
      cuerpo sea el mismo para CUALQUIER nombre. La línea base del renglón es el testigo
      —`lineHeight` es un ratio, así que un cuerpo distinto la movería— y se compara el
      corto contra el extremo de 74 caracteres, que es el que más tentaría a encogerlo.
    */
    const corto = (await componer(CORTO))[0]
    const extremo = (await componer(EXTREMO))[0]
    expect(renglonesDelNombre(corto, CORTO)).toBe(1)
    expect(renglon(extremo, EXTREMO.split(' ')[0]).arriba).toBeCloseTo(
      renglon(corto, CORTO.split(' ')[0]).arriba,
      2,
    )
  }, 200_000)

  it('NINGÚN nombre parte a dos renglones, ni el extremo de 74 caracteres', async () => {
    /*
      ⚠ ES LA COTA QUE HEREDA DE LAS DOS DE v2, y ahora cubre también el extremo.
      Con el algoritmo, al llegar al piso un nombre de ~70 caracteres TODAVÍA no cabía y
      se le dejaba partir: era el caso aceptado. Con 15 pt y elipsis ya no hay caso
      aceptado — el que no cabe se recorta, y la fila nunca crece.
    */
    for (const nombre of [CORTO, INTERMEDIO, LARGO, MUY_LARGO, EXTREMO]) {
      expect(renglonesDelNombre((await componer(nombre))[0], nombre), nombre).toBe(1)
    }
  }, 200_000)

  it('el nombre compuesto no supera el ancho disponible del membrete', async () => {
    const cuerpo = TIPOGRAFIA['medico.nombre'].cuerpo
    for (const nombre of [CORTO, INTERMEDIO, LARGO, MUY_LARGO]) {
      expect(await anchoReal(nombre, cuerpo), nombre).toBeLessThanOrEqual(DISPONIBLE)
    }
    // El extremo NO cabe ni a 15: es el que ejercita la elipsis.
    expect(await anchoReal(EXTREMO, cuerpo)).toBeGreaterThan(DISPONIBLE)
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

  it('la especialidad NO se mueve: el cuerpo del nombre ya no cambia', async () => {
    /*
      ⚠ **ERA UNA COTA DE 2.21 pt Y AHORA ES CERO, y el cambio es el esperado.**
      En v2 el cuerpo encogía con el nombre, el renglón medía menos —`lineHeight` es un
      ratio— y el bloque nombre+especialidad pasaba de 47 a 42.6 pt; como la fila lo
      centra, la especialidad subía la mitad de la diferencia. En v3 el cuerpo es fijo,
      así que el bloque mide lo mismo con cualquier nombre y nada se mueve. Si esta
      diferencia dejara de ser cero, alguien reintrodujo un cuerpo variable.
    */
    const corto = (await componer(CORTO))[0]
    const largo = (await componer(LARGO))[0]
    // v3 · 2.B la compone en versalita, así que la sonda va en mayúsculas.
    const delta = renglon(corto, 'ORTOPEDIA').arriba - renglon(largo, 'ORTOPEDIA').arriba
    expect(delta).toBeCloseTo(0, 2)
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

  /*
    ⚠ `con panel oculto el disponible es la caja entera` SE RETIRA.
    Medía `cuerpoDelNombre()` con dos anchos distintos para comprobar que sin panel no se
    restaba ni el panel ni su medianil. Sin cuerpo variable, el ancho disponible ya no
    decide nada sobre la composición del nombre: la regla 4 de 2.A la vigila la prueba de
    2.A, que es donde vive el panel.
  */
})
