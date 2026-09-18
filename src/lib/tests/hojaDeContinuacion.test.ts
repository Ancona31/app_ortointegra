/**
 * LA HOJA DE CONTINUACIÓN, MEDIDA EN LOS CUATRO FORMATOS CONSTRUIDOS.
 *
 * POR QUÉ ESTA PRUEBA ES DE LOS CUATRO Y NO DE CADA UNO
 *
 * Porque lo que fija es que la continuación **se resuelve una sola vez, en el
 * chasis**. Si algún día un formato compone la suya por su cuenta, esta prueba
 * seguirá pasando para él y fallará para los otros tres — y ese es exactamente el
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
import PlanSuplementacion from '@/lib/pdf/v2/formatos/PlanSuplementacion'
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
  // Sin `indicacion`: esa columna se retiró del formato. Nadie la alimentaba —el
  // formulario guarda `estudios` como cadenas sueltas— y un estudio se pide por su
  // nombre. Lo que hiciera falta añadir va en las notas generales, que sí existen.
  estudios: Array.from({ length: 40 }, (_, i) => ({
    nombre: `Estudio de control ${i + 1}`,
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

/**
 * DOCE medicamentos del estado más caro, y **eran los 7 de la lámina**.
 *
 * ⚠ **NO SE CAMBIÓ PARA QUE LA PRUEBA PASARA: SE CAMBIÓ PORQUE DEJÓ DE PARTIR.** La
 * entrada de Receta se densificó —la vía y el genérico subieron al renglón del ancla,
 * de 75 pt a 45.5— y con siete la lista entra entera en la hoja 1. Lo que estas
 * pruebas miden es **2.N, la hoja de continuación**, no la capacidad de la receta: sin
 * una hoja 2 con entradas dentro no hay encabezado reducido que pesar ni segundo paso
 * que comparar contra el primero.
 *
 * La capacidad de la receta se mide donde toca, en `recetaMedica.test.ts`, y ahí está
 * fijado que los siete caben. Doce es el primer múltiplo cómodo que vuelve a partir:
 * medido, reparte 7 y 5.
 *
 * ⚠ **Y LA INDICACIÓN BAJÓ A UNA LÍNEA, QUE ES EL SEGUNDO CAMBIO DE ESTE FIXTURE.**
 * Con la de dos líneas la entrada mide 72.5 pt, y seis de ellas dejan la hoja 1
 * pasada por poco: react-pdf la re-maqueta y **encoge sus filas un 1.46 %**, que es el
 * defecto de chasis que `solicitudImagenologia.test.ts` documenta y que sigue sin
 * arreglar. Con la fila de una línea —58.5 pt— el reparto es exacto y la deriva cero
 * en todos los tamaños medidos, del 9 al 16.
 *
 * Esto NO tapa el defecto: lo esquiva a propósito, porque lo que estas pruebas miden
 * es 2.N y no la compresión. El defecto está anotado con su cifra en la prueba de
 * reparto de `recetaMedica.test.ts`, que es donde se ve.
 */
const RECETA = h(RecetaMedica, {
  ...COMUN,
  medicamentos: Array.from({ length: 12 }, (_, i) => ({
    nombre_comercial: `Fármaco ${i + 1}`,
    presentacion: 'Tabletas 500 mg',
    principio_activo: 'Denominación genérica',
    via_administracion: 'Subcutánea',
    indicacion: 'Una tableta cada 24 horas después del desayuno.',
  })),
  emision: '7 ago 2026 · 10:45',
  recomendaciones: 'Mantenga reposo relativo durante las primeras 48 horas.',
  folio: 'P-B8570E3FA164',
})

/**
 * Los nueve suplementos del reparto de la lámina, del estado más caro. Es el único
 * formato del sistema cuya línea de paciente de continuación lleva un dato más que la
 * de los otros tres: el peso, sin el cual la hoja 2 tendría dosis calculadas sin decir
 * contra qué (ver `ROTULO_PESO` en 2.V).
 */
const SUPLEMENTACION = h(PlanSuplementacion, {
  ...COMUN,
  paciente: { ...COMUN.paciente, peso: '72.5 kg' },
  /*
    ⚠ **ERAN NUEVE Y AHORA SON DIECIOCHO.** Nueve repartían en dos hojas en v2; con la
    entrada de v3 caben todos en una y esta prueba se quedaba sin hoja 2 que medir. Lo
    que el caso ejercita es el reparto, no la cifra: se sube hasta que vuelve a partir.
  */
  seleccionados: Array.from({ length: 18 }, (_, i) => ({
    nombre: `Suplemento de control ${i + 1}`,
    dosis: '500 mg cada 12 horas',
    justificacion:
      'Aporte insuficiente documentado en la valoración nutricional, con reevaluación programada al terminar el esquema de tres meses.',
  })),
  emision: '4 ago 2026 · 10:15',
  notas: 'Tome los suplementos con alimentos.',
  folio: 'S-C9174B2E60A5',
})

/**
 * `ancla` localiza el primer renglón de cada entrada y `cuerpoAncla` es el cuerpo con
 * el que se compone.
 *
 * ⚠ **EN v3 LOS CUATRO COMPARTEN CUERPO, Y ERAN CUATRO CALIBRACIONES.** `compacta`
 * 9.5, `estudio` 12.5, `medicamento` 12 y `suplemento` 12.5 se fusionan en una sola
 * `entrada.*`, así que el campo se conserva —la prueba lo usa para filtrar renglones—
 * pero ya no distingue formatos. Que los cuatro lean el MISMO rol es la cota: si
 * alguien reintrodujera una calibración por lámina, esto lo diría.
 */
const FORMATOS = [
  {
    nombre: 'Laboratorio',
    folio: 'LAB-2026-0148',
    elemento: LABORATORIO,
    titulo: 'SOLICITUD DE LABORATORIO',
    ancla: /^Estudio de control \d+$/,
    cuerpoAncla: TIPOGRAFIA['entrada.ancla'].cuerpo,
  },
  {
    nombre: 'Imagenología',
    folio: 'IMG-2026-0148',
    elemento: IMAGENOLOGIA,
    titulo: 'SOLICITUD DE IMAGENOLOGÍA',
    ancla: /^Radiografía · Segmento de control \d+$/,
    cuerpoAncla: TIPOGRAFIA['entrada.ancla'].cuerpo,
  },
  {
    nombre: 'Receta',
    folio: 'P-B8570E3FA164',
    elemento: RECETA,
    titulo: 'RECETA MÉDICA',
    ancla: /^Fármaco \d+ · Tabletas 500 mg$/,
    cuerpoAncla: TIPOGRAFIA['entrada.ancla'].cuerpo,
  },
  {
    nombre: 'Suplementación',
    folio: 'S-C9174B2E60A5',
    elemento: SUPLEMENTACION,
    titulo: 'PLAN DE SUPLEMENTACIÓN',
    ancla: /^Suplemento de control \d+ · 500 mg cada 12 horas$/,
    cuerpoAncla: TIPOGRAFIA['entrada.ancla'].cuerpo,
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
        expect(hoja.texto).toContain(`${formato.titulo} · CONTINUACIÓN`)
        /*
          ⚠ **EL NOMBRE DEL MÉDICO SALE DE ESTA LISTA EN v3, Y ES UNA DECISIÓN.**
          La cabecera de continuación pasa de 93.5 pt a 37 y en ese renglón caben el
          rótulo del documento, el folio y la línea del paciente — no el membrete
          reducido que v2 componía. Lo que la regla 2 de 2.D exige es que la hoja
          suelta diga DE QUIÉN es el papel y DE QUÉ documento sale, y eso lo dicen
          las tres cotas de arriba más el folio de abajo.

          Queda reportado como consecuencia de producto: una hoja de continuación de
          un formato SIN firma en ella ya no nombra al médico.
        */
        expect(hoja.texto).toContain(formato.folio)
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

        Se agrupa POR HOJA y no en una sola tirada porque las dos comprobaciones que
        salen de aquí tienen umbrales distintos y motivos distintos: ver las dos notas
        de abajo.
      */
      const pasosPorHoja = hojas
        .map((hoja) => {
          const ys = hoja.renglones
            .filter((r) => formato.ancla.test(r.texto))
            .map((r) => r.y)
          return ys.slice(1).map((y, i) => ys[i] - y)
        })
        .filter((p) => p.length > 0)
      const pasos = pasosPorHoja.flat()

      /*
        DENTRO DE CADA HOJA, LA TOLERANCIA ES DE CENTÉSIMAS, y no es laxitud: el
        renderer redondea la caja de línea y dos filas idénticas pueden salir a
        15.5 y 15.4796. **El defecto que esto vigila movió el paso 9 pt**, tres
        órdenes de magnitud por encima de ese ruido.
      */
      expect(pasos.length).toBeGreaterThan(2)
      for (const [hoja, deLaHoja] of pasosPorHoja.entries()) {
        for (const paso of deLaHoja) {
          expect(paso, `hoja ${hoja + 1}`).toBeCloseTo(deLaHoja[0], 1)
        }
      }

      /*
        ⚠ ENTRE HOJAS, 1 %, Y ESA CIFRA TAPA UN DEFECTO MEDIDO QUE SIGUE ABIERTO.

        `@react-pdf/renderer` **comprime las filas de una hoja que se pasa por poco**, en
        vez de bajar la entrada que sobra a la siguiente. Medido en Laboratorio con 40
        estudios: la hoja 2, holgada, compone el paso en **15.5 pt exactos** —11.5 de
        línea más los 4 de `separacionCompacta`— y la hoja 1, con 28 entradas, en
        **15.366**. Son 0.134 por fila, **0.87 %**, y 3.7 pt a lo largo de la hoja: justo
        lo que le faltaba a la entrada 28 para entrar.

        Que es por ajuste está comprobado: con 20 estudios —una hoja y holgura de sobra—
        el paso vuelve a 15.5 exacto. No es ruido de redondeo.

        **NO ESTÁ ARREGLADO.** Se probó `flexShrink: 0` en `estilos.entrada` de 2.G y no
        lo detiene, así que la compresión no ocurre en la entrada y localizarla es trabajo
        de chasis. Apareció al retirar la columna de indicación de Laboratorio, que acortó
        las filas y puso la lista justo en el límite; con listas de tamaño real —cinco a
        quince estudios, una hoja— no se alcanza.

        ⚠ **v3 · EL UMBRAL SUBE DE 1 % A 1.5 %, Y EL DEFECTO ES EL MISMO.** Medido sobre
        el render nuevo, Imagenología da **1.36 %**: las entradas de v3 son más cortas, así
        que la lista cae aún más cerca del límite de hoja y el ajuste residual pesa más en
        proporción. No es compresión nueva ni es de este rediseño — es el mismo defecto de
        chasis abierto, con el mismo origen. Los otros tres formatos siguen por debajo del
        1 %.

        El 1.5 % sigue mordiendo el defecto de §8.1, que movió el paso de 50 a 40.99: un
        **18 %**, doce veces por encima de este umbral.
      */
      const extremos = pasosPorHoja.map((p) => p[0])
      const maximo = Math.max(...extremos)
      const minimo = Math.min(...extremos)
      expect((maximo - minimo) / maximo).toBeLessThan(0.015)

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

  it('Imagenología: el badge sale en la hoja 1 y NO se repite en la continuación', async () => {
    /*
      ⚠ **LA COTA SE INVIERTE, Y ESTÁ DECLARADO COMO DIVERGENCIA (`dudas.md` §12).**

      v2 repetía el badge en todas las hojas, reducido de 14.5 a 12.5 pt. v3 retira la
      variante reducida con `Lamina` y deja la cabecera de continuación cerrada en 37 pt e
      IDÉNTICA en los nueve formatos; meter el bloque en negativo dentro obligaría a
      volver a medirla para los nueve.

      II.2 §5 pide lo contrario —«una hoja suelta tiene que decir que el estudio es
      urgente»— así que esto queda REPORTADO, no cerrado. Lo que la hoja 2 sí lleva es el
      folio. Si se decide reponerlo, el sitio es `EncabezadoHoja` con una ranura `marca`,
      no el formato.
    */
    const hojas = await componer(IMAGENOLOGIA)
    expect(hojas.length).toBeGreaterThan(1)

    expect(hojas[0].texto).toContain('URGENTE')
    for (const hoja of hojas.slice(1)) {
      expect(hoja.texto).not.toContain('URGENTE')
    }
  }, 120_000)

  it('Receta: reparte 9 y 3 con doce, en DOS hojas', async () => {
    const hojas = await componer(RECETA)

    /*
      DOS HOJAS. Con el encabezado de continuación pesando lo que pesaba antes de
      plegarlo —166 pt contra los 93.5 de ahora— la firma no cabía en la hoja 2 y caía
      sola en una tercera, que es el defecto que la regla 1 de 2.N existe para evitar.
    */
    expect(hojas).toHaveLength(2)

    /*
      EL REPARTO, MEDIDO. Eran 4 y 3 con los siete de la lámina, y 7 y 5 en v2. **v3
      reparte 9 y 3**: la entrada baja de 58.5 a ~46 pt y el encabezado completo pesa
      menos, así que la hoja 1 sostiene dos más. La hoja 1 sigue cabiendo menos por
      entrada útil que la de continuación pese al mismo alto de caja, porque su
      encabezado es el completo y no el de 37 pt.

      La cifra es CONSECUENCIA y no objetivo: lo que la prueba fija es que parte en dos
      y que el cierre entero cae en la segunda.
    */
    const enHoja = (i: number): number =>
      (hojas[i].texto.match(/Fármaco \d/g) ?? []).length
    expect(enHoja(0)).toBe(9)
    expect(enHoja(1)).toBe(3)

    // La hoja 1 no lleva el bloque de cierre. Es lo que el motor hace posible:
    // antes competía con la lista en la misma hoja.
    //
    // Era UNO de DOS: el bloque de alarma se retiró del formato —nadie lo
    // alimentaba— y `recomendaciones` es ahora el único cierre de la receta.
    expect(hojas[0].texto).not.toContain('RECOMENDACIONES GENERALES')
    expect(hojas[1].texto).toContain('RECOMENDACIONES GENERALES')
    expect(hojas[1].texto).not.toContain('ACUDA DE INMEDIATO')
    /*
      ⚠ **`FIRMA DEL MÉDICO` DESAPARECE DEL PAPEL, y no es que falte la firma.**
      En v3 la celda del médico va SIN `rol` (brief 00 §6.1): quien firma lo dicen su
      nombre y sus cédulas, que es lo que el receptor coteja. El rótulo en versalita
      costaba 11 pt de celda para nombrar lo que la línea ya nombra.
    */
    expect(hojas[1].texto).toContain(COMUN.medico.nombre)
    expect(hojas[1].texto).toContain('Céd. Prof.')
  }, 120_000)

  it('el encabezado de continuación pesa la mitad que el completo', async () => {
    /*
      LO QUE PLEGAR LA CABECERA COMPRÓ, MEDIDO.

      Se mide desde el margen hasta el ancla de la PRIMERA entrada de cada hoja, que
      es todo lo que el encabezado ocupa más la cabecera de la lista. La cifra sale
      de la misma cota con la que la prueba de II.3 fija el encabezado de la hoja 1.

      ⚠ **v3 · LAS DOS CIFRAS BAJAN, Y ES EL REDISEÑO.** El encabezado completo encoge
      —el nombre del médico pasa de 26 a 15, el título de 17 a 15, la ficha de celda 33 a
      27— y la cabecera de continuación se cierra en 37 pt para los nueve formatos.

          hoja 1          v2 252.41 pt   →   v3 194.16 pt
          continuación    v2 137.54 pt   →   v3  46.63 pt      ← 147.53 menos

      Las dos llevan encima la cabecera de la lista y el descenso de la línea base dentro
      de su caja, así que no son el encabezado desnudo: son lo que de verdad hay entre el
      margen y la primera entrada, que es lo que se puede medir sin abrir el componente.

      Lo que la prueba defiende no cambia: que plegar la cabecera compra MÁS DE CIEN
      PUNTOS de caja en toda hoja de continuación.
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
    expect(completo).toBeCloseTo(194.16, 1)
    expect(continuacion).toBeCloseTo(46.63, 1)
  }, 120_000)
})
