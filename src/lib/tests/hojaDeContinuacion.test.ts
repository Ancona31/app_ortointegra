/**
 * LA HOJA DE CONTINUACIÓN, MEDIDA EN LOS TRES FORMATOS CONSTRUIDOS.
 *
 * POR QUÉ ESTA PRUEBA ES DE LOS TRES Y NO DE CADA UNO
 *
 * Porque lo que fija es que la continuación **se resuelve una sola vez, en el
 * chasis**. Si algún día un formato compone la suya por su cuenta, esta prueba
 * seguirá pasando para él y fallará para los otros dos — y ese es exactamente el
 * síntoma que hay que ver. Las cotas de cada lámina se miden en la prueba del
 * formato; aquí solo se mide lo que 2.N y 2.V garantizan para los ocho.
 *
 * LO QUE COMPRUEBA
 *
 * 1. **La hoja 2 identifica al paciente ella sola.** Es la regla 2 de 2.D y el
 *    hallazgo más grave de la auditoría del sistema viejo: antes de cablear 2.N, una
 *    solicitud de 25 estudios llegaba a su segunda hoja sin membrete, sin folio y sin
 *    nombre. La prueba se lee tapándose la hoja 1 con la mano.
 * 2. **El badge de urgente sale en las dos hojas**, reducido en la segunda.
 * 3. **El cuerpo del texto es idéntico en todas las hojas.** Es I.3.4: cuando el
 *    contenido no cabe se mueven bloques, nunca se comprime. **Esta es la
 *    comprobación que habría cazado el defecto que destapó el cableado** — tres
 *    formatos en un `Document` repartían la primera hoja del segundo con el
 *    encabezado equivocado y luego la re-maquetaban comprimida, 13 ítems donde caben
 *    10 y el paso de fila bajando de 50 a 40.99 pt, sin lanzar nada.
 * 4. **El aviso y el contador dicen lo que toca en cada hoja**, y ninguno inventa la
 *    cifra que el renderer no reporta.
 *
 * UN DOCUMENTO ES UN FORMATO
 *
 * Cada caso se compone en su propio `Document` con un solo `Page`. No es una
 * comodidad: en la pasada de reparto el renderer entrega `pageNumber` ABSOLUTO y no
 * `subPageNumber`, así que con varios `Page` la primera hoja del segundo formato se
 * reparte como si fuera continuación. Ver la cabecera de 2.N.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import SolicitudLaboratorio from '@/lib/pdf/v2/formatos/SolicitudLaboratorio'
import SolicitudImagenologia from '@/lib/pdf/v2/formatos/SolicitudImagenologia'
import RecetaMedica from '@/lib/pdf/v2/formatos/RecetaMedica'
import {
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

interface Hoja {
  readonly texto: string
  /** Los cuerpos de letra que dibuja la hoja, en pt. */
  readonly cuerpos: ReadonlySet<number>
  /** Alto de cada rectángulo. Sirve para distinguir el badge de su variante. */
  readonly altos: readonly number[]
  /** Cada renglón con su línea base. Es con lo que se mide el paso de fila. */
  readonly renglones: readonly { readonly texto: string; readonly y: number }[]
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
    const altos: number[] = []
    const renglones: { texto: string; y: number }[] = []
    const pila: Matriz[] = []
    let ctm: Matriz = IDENTIDAD
    let actual = ''
    let base = 0

    const cerrar = (): void => {
      if (actual !== '') renglones.push({ texto: actual, y: base })
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
        continue
      }
      if (t[17] !== undefined) {
        for (const cadena of t[17].matchAll(/<([0-9a-f]+)>/gi)) {
          for (let i = 0; i < cadena[1].length; i += 4) {
            const c = tabla?.get(parseInt(cadena[1].slice(i, i + 4), 16)) ?? ''
            texto += c
            actual += c
          }
        }
        continue
      }
      altos.push(Math.abs(Number(t[21])))
    }
    cerrar()
    return { texto, cuerpos, altos, renglones }
  })
}

// ─── Los datos, inventados y compartidos ─────────────────────────────────────

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/**
 * Ninguna cadena de anclaje lleva la secuencia `fi`: react-pdf incrusta la LIGADURA
 * como un glifo propio y su `ToUnicode` no la descompone, así que un
 * «Identificable» sale del flujo como «Identicable».
 */
const PACIENTE = 'Renata Bustamante Oceguera'
const EXPEDIENTE = 'EXP-004821'

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
  panel: { variante: 'monograma', acento, iniciales: 'EM' } as const,
  acento,
  paciente: {
    paciente: PACIENTE,
    edad: '54 años',
    expediente: EXPEDIENTE,
    diagnostico: 'Gonartrosis bilateral grado III',
  },
}

/** Un `Document` con un solo `Page`, que es lo que ocurre en emisión real. */
async function componer(formato: React.ReactElement): Promise<Hoja[]> {
  return leer(await renderToBuffer(h<DocumentProps>(Document, {}, formato)))
}

/**
 * 40 estudios. La lámina de Laboratorio mete 18 en una hoja y con 25 la lista todavía
 * cabía entera —lo que desbordaba era la cola, notas y firma—, así que la hoja 2 se
 * quedaba sin entradas y no había dos hojas de lista que comparar. Con 40 la LISTA
 * corta, que es lo que esta prueba tiene que ver.
 */
const LABORATORIO = h(SolicitudLaboratorio, {
  ...COMUN,
  estudios: Array.from({ length: 40 }, (_, i) => ({
    nombre: `Estudio de control ${i + 1}`,
    indicacion: i % 3 === 0 ? 'Ayuno de 8 horas' : undefined,
  })),
  notas: 'Enviar resultados al consultorio.',
  folio: 'LAB-2026-0148',
})

/** Doce estudios del estado más caro, y urgente: corta y lleva badge. */
const IMAGENOLOGIA = h(SolicitudImagenologia, {
  ...COMUN,
  estudios: Array.from({ length: 12 }, (_, i) => ({
    tipo: 'Radiografía',
    region: `Segmento de control ${i + 1}`,
    proyecciones: 'AP y lateral',
    indicacion: 'Control evolutivo del material de osteosíntesis.',
  })),
  emision: '7 ago 2026 · 10:45',
  urgente: true,
  folio: 'IMG-2026-0148',
})

/** Los 7 medicamentos del caso de la lámina, con la fila cara. */
const RECETA = h(RecetaMedica, {
  ...COMUN,
  medicamentos: Array.from({ length: 7 }, (_, i) => ({
    comercial: `Fármaco ${i + 1}`,
    presentacion: 'Tabletas 500 mg',
    generico: 'Denominación genérica',
    via: 'Subcutánea',
    indicacion:
      'Una tableta cada 24 horas después del desayuno durante siete días, y suspender si aparece dolor epigástrico.',
  })),
  emision: '7 ago 2026 · 10:45',
  recomendaciones: 'Mantenga reposo relativo durante las primeras 48 horas.',
  signosDeAlarma: 'Fiebre mayor de 38.5 °C que no cede con el antipirético.',
  folio: 'P-B8570E3FA164',
})

/**
 * `ancla` localiza el primer renglón de cada entrada y `cuerpoAncla` es el cuerpo con
 * el que se compone, que sale de la calibración que el formato declara en 2.G:
 * `compacta` 9.5, `estudio` 12.5, `medicamento` 12.
 */
const FORMATOS = [
  {
    nombre: 'Laboratorio',
    elemento: LABORATORIO,
    titulo: 'SOLICITUD DE LABORATORIO',
    ancla: /^Estudio de control \d+$/,
    cuerpoAncla: TIPOGRAFIA['entradaCompacta.ancla'].cuerpo,
  },
  {
    nombre: 'Imagenología',
    elemento: IMAGENOLOGIA,
    titulo: 'SOLICITUD DE IMAGENOLOGÍA',
    ancla: /^Radiografía · Segmento de control \d+$/,
    cuerpoAncla: TIPOGRAFIA['entradaEstudio.ancla'].cuerpo,
  },
  {
    nombre: 'Receta',
    elemento: RECETA,
    titulo: 'RECETA MÉDICA',
    ancla: /^Fármaco \d+ · Tabletas 500 mg$/,
    cuerpoAncla: TIPOGRAFIA['entradaMedicamento.ancla'].cuerpo,
  },
] as const

describe('2.N · la hoja de continuación, en los tres formatos', () => {
  for (const formato of FORMATOS) {
    it(`${formato.nombre}: la hoja 2 identifica al paciente ella sola`, async () => {
      const hojas = await componer(formato.elemento)
      expect(hojas.length).toBeGreaterThan(1)

      for (const [indice, hoja] of hojas.entries()) {
        if (indice === 0) continue
        /*
          TAPARSE LA HOJA 1 CON LA MANO. Lo que queda tiene que bastar para saber de
          quién es el papel y de qué documento sale: nombre, expediente, médico,
          folio y el título con su rótulo de continuación. Regla 2 de 2.D.
        */
        expect(hoja.texto).toContain(PACIENTE)
        expect(hoja.texto).toContain(EXPEDIENTE)
        expect(hoja.texto).toContain(COMUN.medico.nombre)
        expect(hoja.texto).toContain(`${formato.titulo} · CONTINUACIÓN`)
      }

      // Y el título SIN rótulo sale solo en la hoja 1.
      expect(hojas[0].texto).toContain(formato.titulo)
      expect(hojas[0].texto).not.toContain('CONTINUACIÓN')
    }, 120_000)

    it(`${formato.nombre}: no comprime nada entre hojas (I.3.4)`, async () => {
      const hojas = await componer(formato.elemento)
      expect(hojas.length).toBeGreaterThan(1)

      /*
        LA COMPROBACIÓN QUE CAZÓ EL DEFECTO, Y POR QUÉ NO MIDE EL CUERPO.

        La primera versión de esta prueba comparaba los `fontSize` de cada hoja, y
        **no habría cazado nada**: cuando el renderer re-maqueta una hoja con un
        encabezado más alto del que usó para repartirla, el cuerpo NO cambia — lo que
        se aplasta son las cajas. Medido en el defecto real: el paso de fila bajó de
        50 a 40.99 pt con el cuerpo intacto en 10.

        Así que lo que se mide es el PASO ENTRE ENTRADAS. Todas las entradas de estos
        casos son idénticas, así que todos los pasos de todas las hojas tienen que dar
        la misma cifra. Un solo paso distinto es el motor comprimiendo.
      */
      const pasos = hojas.flatMap((hoja) => {
        const ys = hoja.renglones
          .filter((r) => formato.ancla.test(r.texto))
          .map((r) => r.y)
        return ys.slice(1).map((y, i) => ys[i] - y)
      })

      /*
        LA TOLERANCIA ES DE CENTÉSIMAS Y NO DE MILÉSIMAS, y no es laxitud: el
        renderer redondea la caja de línea y dos filas idénticas pueden salir a
        15.5 y 15.4796. **El defecto que esto vigila movió el paso 9 pt**, tres
        órdenes de magnitud por encima de ese ruido, así que la guarda sigue mordiendo
        con margen de sobra.
      */
      expect(pasos.length).toBeGreaterThan(2)
      for (const paso of pasos) expect(paso).toBeCloseTo(pasos[0], 1)

      // Y el cuerpo del ancla es el mismo en toda hoja que lleve entradas: es la
      // otra mitad de I.3.4, más débil pero gratis.
      const conEntradas = hojas.filter((hoja) =>
        hoja.renglones.some((r) => formato.ancla.test(r.texto)),
      )
      expect(conEntradas.length).toBeGreaterThan(1)
      for (const hoja of conEntradas) {
        expect([...hoja.cuerpos]).toContain(formato.cuerpoAncla)
      }
    }, 120_000)

    it(`${formato.nombre}: el aviso y el contador dicen lo que toca`, async () => {
      const hojas = await componer(formato.elemento)
      const ultima = hojas.length

      for (const [indice, hoja] of hojas.entries()) {
        const esUltima = indice === ultima - 1
        // El aviso va en todas menos la última: en ella no continúa nada.
        expect(hoja.texto.includes(`CONTINÚA EN LA HOJA ${indice + 2}`)).toBe(!esUltima)
        expect(hoja.texto.includes('SIN FIRMA NO ES VÁLIDO')).toBe(!esUltima)
        // Y el contador sitúa la hoja mientras quedan, y da el total al cerrar.
        expect(hoja.texto.includes(`HOJA ${indice + 1} DE ${ultima} · TOTAL`)).toBe(
          !esUltima,
        )
        expect(hoja.texto.includes('TOTAL DE ')).toBe(esUltima)
      }

      // Y en ninguna aparece la cifra que el renderer no reporta. Ver 2.K.
      expect(hojas.some((hoja) => hoja.texto.includes('EN ESTA HOJA'))).toBe(false)
    }, 120_000)
  }

  it('Imagenología: el badge sale en las dos hojas, reducido en la segunda', async () => {
    const hojas = await componer(IMAGENOLOGIA)
    expect(hojas.length).toBeGreaterThan(1)

    for (const hoja of hojas) {
      expect(hoja.texto).toContain('URGENTE')
    }

    // 2.H mide el badge en 14.5 pt y su variante reducida en 12.5. La hoja 1 lleva
    // el primero y las de continuación el segundo — es lo único que los distingue,
    // porque la palabra no se abrevia nunca (regla 1).
    expect(hojas[0].altos).toContain(14.5)
    expect(hojas[0].altos).not.toContain(12.5)
    for (const hoja of hojas.slice(1)) {
      expect(hoja.altos).toContain(12.5)
      expect(hoja.altos).not.toContain(14.5)
    }
  }, 120_000)

  it('Receta: reparte 4 y 3 como la lámina, en DOS hojas', async () => {
    const hojas = await componer(RECETA)

    /*
      DOS HOJAS, QUE ES LO QUE LA LÁMINA COMPONE. Con el encabezado de continuación
      pesando lo que pesaba antes de plegarlo —166 pt contra los 93.5 de ahora— la
      firma no cabía en la hoja 2 y caía sola en una tercera, que es el defecto que la
      regla 1 de 2.N existe para evitar.
    */
    expect(hojas).toHaveLength(2)

    // El reparto de la lámina para el caso de 7 (B.3 §5). Allí está fijado por
    // literal —`slice(0,4)`— y aquí sale de medir: es el mismo.
    const enHoja = (i: number): number =>
      (hojas[i].texto.match(/Fármaco \d/g) ?? []).length
    expect(enHoja(0)).toBe(4)
    expect(enHoja(1)).toBe(3)

    // La hoja 1 no lleva ninguno de los dos bloques de cierre. Es lo que el motor
    // hace posible: antes competían con la lista en la misma hoja.
    expect(hojas[0].texto).not.toContain('RECOMENDACIONES GENERALES')
    expect(hojas[0].texto).not.toContain('ACUDA DE INMEDIATO')
    expect(hojas[1].texto).toContain('RECOMENDACIONES GENERALES')
    expect(hojas[1].texto).toContain('ACUDA DE INMEDIATO')
    // Y la firma y el QR cierran ahí mismo, no en una hoja aparte.
    expect(hojas[1].texto).toContain('FIRMA DEL MÉDICO')
  }, 120_000)

  it('el encabezado de continuación pesa la mitad que el completo', async () => {
    /*
      LO QUE PLEGAR LA CABECERA COMPRÓ, MEDIDO.

      Se mide desde el margen hasta el ancla de la PRIMERA entrada de cada hoja, que
      es todo lo que el encabezado ocupa más la cabecera de la lista. La cifra sale
      de la misma cota con la que la prueba de II.3 fija el encabezado de la hoja 1.

      El encabezado propio —hasta donde ABRE la cabecera de la lista— mide **220.88 pt**
      en la hoja 1 y **93.50** en las de continuación. La lámina compone ~95. Aquí se
      miden sus dos consecuencias, que llevan encima la cabecera de la lista (21 pt),
      el ritmo de entrada de la hoja 2 (12.5, que la primera no tiene por ser
      `primera`) y el descenso de la línea base dentro de su caja:

          hoja 1          252.41 pt
          continuación    137.54 pt      ← 114.87 menos

      Los 166 pt que pesaba la primera versión salían de montar las piezas de la hoja
      1 encogidas: membrete con el nombre a tamaño de portada, bloque de título entero
      con su filete y el riel del paciente con los suyos. Los tres tramos que los
      separan están declarados donde se ejecutan — el nombre a 14 / 18 en 2.B, el
      título plegado y la línea de paciente en 2.V.
    */
    const hojas = await componer(RECETA)
    expect(hojas).toHaveLength(2)

    /** Del margen superior al ancla de la primera entrada de la hoja. */
    const hastaLaLista = (hoja: Hoja): number => {
      const anclas = hoja.renglones
        .filter((r) => /^Fármaco \d/.test(r.texto))
        .map((r) => 792 - r.y)
      expect(anclas.length).toBeGreaterThan(0)
      return Math.min(...anclas) - 54
    }

    const completo = hastaLaLista(hojas[0])
    const continuacion = hastaLaLista(hojas[1])

    // Lo que los tres tramos compraron, en una resta. Con la versión que montaba las
    // piezas de la hoja 1 encogidas la diferencia era de 55 pt y la firma no cabía.
    expect(completo - continuacion).toBeGreaterThan(100)
    // Y las dos cifras, ancladas: si alguna se mueve, algo del encabezado cambió.
    expect(completo).toBeCloseTo(252.41, 1)
    expect(continuacion).toBeCloseTo(137.54, 1)
  }, 120_000)
})
