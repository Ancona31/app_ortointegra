/**
 * 2.N · `MotorFlujo` — la prueba del DEFECTO MUDO, copiada del molde de 2.M.
 *
 * POR QUÉ EXISTE ESTA PRUEBA Y NO SE BORRA
 *
 * Los tres avisos de pie son nodos que se recomponen por hoja, igual que la zona
 * de paginación de la banda de 2.M — y aquella se compuso en CERO LÍNEAS durante
 * toda su construcción, sin excepción, sin aviso y sin hueco visible. I.3.8 lo
 * llama «la trampa del nodo con `render`» y tiene dos mitades:
 *
 * 1. El interlineado de la escala es una RAZÓN del cuerpo, y cada recomposición
 *    la vuelve a aplicar sobre un valor ya resuelto —11 → 77 → 539 pt— hasta que
 *    la línea deja de caber y el maquetador devuelve cero líneas.
 * 2. La prebúsqueda de tipografías recorre el árbol DECLARADO, antes de que corra
 *    ningún `render`: lo que solo existe dentro del `render` se compone en la
 *    tipografía de reserva, con otras anchuras y sin lanzar nada.
 *
 * Ninguno de los dos lanza. Solo los detecta una prueba que lea el PDF.
 *
 * QUÉ COMPRUEBA, Y POR QUÉ ASÍ
 *
 * Que las cadenas **existen en el texto extraído de la hoja que toca**, no que el
 * componente devuelva un árbol: un árbol correcto es justamente lo que había
 * mientras el defecto de 2.M estaba vivo. Y que el `/BaseFont` del PDF dice
 * Archivo donde tiene que decir Archivo.
 *
 * El extractor está copiado a mano de `pieDocumento.test.ts` en vez de compartido:
 * las dos pruebas fijan defectos distintos del mismo renderer y ninguna debe poder
 * romper a la otra al tocar su extractor. Se implementa aquí abajo en vez de usar
 * `pdftotext` o `pdfjs-dist` porque el primero es un binario del sistema que no
 * todo el mundo tiene y el segundo no es dependencia declarada del proyecto: una
 * prueba que se salta cuando falta una herramienta es otro defecto mudo.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Page, View, Text, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import MotorFlujo, { type AvisoPie } from '@/lib/pdf/v2/MotorFlujo'
import BloqueFirmas from '@/lib/pdf/v2/BloqueFirmas'
import {
  PAPEL,
  MARGEN,
  FLUJO,
  TIPOGRAFIA,
  estiloTipografico,
} from '@/lib/pdf/v2/tokens'

const h = React.createElement

/**
 * Las mismas familias que `registrarFuentesV2()`, pero por ruta de disco: aquel
 * módulo las pide por URL relativa al origen porque asume render en el cliente
 * (ver su cabecera), y aquí no hay origen.
 */
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

// ─── Extractor de texto ──────────────────────────────────────────────────────
//
// react-pdf incrusta las tipografías como SUBCONJUNTOS con codificación
// `Identity-H`: lo que viaja en el operador de texto son índices de glifo de dos
// bytes, no caracteres. La traducción a Unicode está en el `ToUnicode` de cada
// fuente, que es lo que se lee aquí.

/** Cuerpo de cada objeto indirecto del PDF, por número. */
function objetos(pdf: string): Map<number, string> {
  const mapa = new Map<number, string>()
  for (const m of pdf.matchAll(/(?:^|\n)(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) {
    mapa.set(Number(m[1]), m[2])
  }
  return mapa
}

/** Datos del `stream` de un objeto, descomprimidos. */
function flujo(cuerpo: string): string {
  const inicio = cuerpo.indexOf('stream\n') + 'stream\n'.length
  const crudo = Buffer.from(cuerpo.slice(inicio, cuerpo.indexOf('\nendstream')), 'latin1')
  return cuerpo.includes('/FlateDecode')
    ? zlib.inflateSync(crudo).toString('latin1')
    : crudo.toString('latin1')
}

/** Índice de glifo → carácter, leído del `ToUnicode` de una fuente. */
function tablaUnicode(cmap: string): Map<number, string> {
  if (cmap.includes('beginbfrange')) {
    throw new Error('ToUnicode con bfrange: el extractor de esta prueba solo lee bfchar')
  }
  const tabla = new Map<number, string>()
  for (const m of cmap.matchAll(/<([0-9a-f]{4})>\s*<([0-9a-f]+)>/gi)) {
    tabla.set(parseInt(m[1], 16), Buffer.from(m[2], 'hex').swap16().toString('utf16le'))
  }
  return tabla
}

/** Flujo de contenido de cada hoja del PDF, en orden, con sus tablas de fuente. */
function hojas(pdf: Buffer): { contenido: string; tablas: Map<string, Map<number, string>> }[] {
  const bruto = pdf.toString('latin1')
  const objs = objetos(bruto)

  // Nombre de recurso (`/F5`) → tabla de la fuente. pdfkit es consistente en todo
  // el documento: un nombre apunta siempre al mismo objeto.
  const tablas = new Map<string, Map<number, string>>()
  for (const dicc of bruto.matchAll(/\/Font <<([^>]*)>>/g)) {
    for (const par of dicc[1].matchAll(/\/(\w+) (\d+) 0 R/g)) {
      const fuente = objs.get(Number(par[2])) ?? ''
      const ref = fuente.match(/\/ToUnicode (\d+) 0 R/)
      if (ref === null) continue
      tablas.set(par[1], tablaUnicode(flujo(objs.get(Number(ref[1])) ?? '')))
    }
  }

  return [...bruto.matchAll(/\/Type \/Page\n[\s\S]*?\/Contents (\d+) 0 R/g)].map((pagina) => ({
    contenido: flujo(objs.get(Number(pagina[1])) ?? ''),
    tablas,
  }))
}

/**
 * Texto de cada hoja del PDF, en orden. Sin heurísticas de palabra: devuelve los
 * caracteres tal como los dibuja el flujo de contenido.
 *
 * **Ojo con lo que NO hace:** no reconstruye espacios a partir de la posición.
 * Los que salen son los que el documento dibuja como glifo — dentro de una línea
 * los hay, entre dos líneas de un mismo párrafo no.
 */
function textoPorHoja(pdf: Buffer): string[] {
  return hojas(pdf).map(({ contenido, tablas }) => {
    let tabla: Map<number, string> | undefined
    let texto = ''
    // `/F5 7 Tf` fija la fuente; `[<glifos> ajuste …] TJ` dibuja.
    for (const t of contenido.matchAll(/\/(\w+) [\d.]+ Tf|\[([^\]]*)\] TJ/g)) {
      if (t[1] !== undefined) {
        tabla = tablas.get(t[1])
        continue
      }
      for (const cadena of t[2].matchAll(/<([0-9a-f]+)>/gi)) {
        for (let i = 0; i < cadena[1].length; i += 4) {
          texto += tabla?.get(parseInt(cadena[1].slice(i, i + 4), 16)) ?? ''
        }
      }
    }
    return texto
  })
}

/**
 * Los cuerpos de letra que dibuja cada hoja, en puntos. Es la regla con la que se
 * mide la verificación visible de la ficha: «medir que el cuerpo del texto es
 * idéntico en las dos hojas; si en la primera es más chico, el motor comprimió y
 * eso es un defecto» (I.3.4).
 */
function cuerposPorHoja(pdf: Buffer): Set<number>[] {
  return hojas(pdf).map(({ contenido }) => {
    const cuerpos = new Set<number>()
    for (const t of contenido.matchAll(/\/\w+ ([\d.]+) Tf/g)) cuerpos.add(Number(t[1]))
    return cuerpos
  })
}

// ─── El documento del taller, en miniatura ───────────────────────────────────

registrarFuentesDeDisco()

const CORRIDO = { ...estiloTipografico('texto.corrido') }

/**
 * Las tres últimas líneas del contenido. Lleva una palabra que no aparece en
 * ningún otro sitio del documento —«constancia»— porque el extractor no
 * reconstruye los espacios entre líneas y una frase larga podría partirse.
 */
const ARRASTRE =
  'Con lo anterior se cierra la valoración del episodio y se da por terminada la nota. ' +
  'El paciente queda citado para revisión y se le entregan por escrito los datos de alarma ' +
  'por los que debe volver antes de esa fecha, de lo cual queda constancia.'

/** Nombre que solo puede salir del bloque de firmas. */
const FIRMANTE = 'Angel Ancona'

const FIRMAS = h(BloqueFirmas, {
  variante: 'simple',
  firmas: [{ rol: 'Firma y sello del médico', nombre: FIRMANTE, credenciales: ['Céd. Prof. 9552456'] }],
})

/**
 * Bloque de firmas de mentira, compuesto ENTERO en la humanista. Solo lo usa la
 * prueba de tipografía: con el 2.L de verdad, el rol de firma ya pide Archivo en
 * peso 600 y cargaría la familia que el aviso necesita, tapando el defecto. Con
 * este, el aviso es lo ÚNICO que pide Archivo en todo el documento.
 */
const FIRMAS_SIN_ARCHIVO = h(View, {}, h(Text, { style: CORRIDO }, FIRMANTE))

/**
 * Renglones de relleno. Cada uno ocupa una línea de `texto.corrido`, así que el
 * alto del contenido es `n × 18 pt` y se puede colocar donde haga falta respecto
 * del umbral de la firma.
 */
function relleno(n: number): React.ReactElement[] {
  return Array.from({ length: n }, (_, i) =>
    h(Text, { key: i, style: CORRIDO }, `Renglón de relleno número ${i}.`),
  )
}

/**
 * Una hoja del sistema. Es el `paddingBottom: margen.inferior` lo que reserva el
 * hueco donde vive el aviso (I.1.2): sin él, el aviso se solaparía con la última
 * línea de contenido, que es el bug §8.1 en su versión de 2.N.
 */
function documento(
  hijos: number,
  props: { arrastre: string; firmas: React.ReactElement; avisos?: readonly (AvisoPie | null)[] },
): React.ReactElement<DocumentProps> {
  return h<DocumentProps>(
    Document,
    {},
    h(
      Page,
      {
        size: [PAPEL.ancho, PAPEL.alto] as [number, number],
        style: {
          paddingTop: MARGEN.superior,
          paddingLeft: MARGEN.izquierdo,
          paddingRight: MARGEN.derecho,
          paddingBottom: MARGEN.inferior,
        },
      },
      h(MotorFlujo, { ...props, children: relleno(hijos) }),
    ),
  )
}

/**
 * 30 renglones son 540 pt sobre una caja de 670: el contenido termina a media
 * hoja y en lo que queda —130 pt— no cabe el umbral de 200.8. Es el caso de la
 * regla 1, y es el único que no se puede fabricar por accidente.
 */
const CONTENIDO_A_MEDIA_HOJA = 30

// ─── Las pruebas ─────────────────────────────────────────────────────────────

describe('2.N · MotorFlujo', () => {
  it('regla 1: la firma no baja sola, baja con el arrastre, y la hoja 1 lo avisa', async () => {
    const pdf = await renderToBuffer(
      documento(CONTENIDO_A_MEDIA_HOJA, {
        arrastre: ARRASTRE,
        firmas: FIRMAS,
        avisos: [{ forma: 'reservaFirma' }],
      }),
    )
    const texto = textoPorHoja(pdf)

    expect(texto).toHaveLength(2)

    // La hoja 1 cierra con el aviso. Esto es lo que se compone dentro de un
    // `render` y lo que se cae en silencio: si falla, mira I.3.8 antes que el
    // componente.
    expect(texto[0]).toContain('RESERVADO PARA LA FIRMA · CONTINÚA EN LA HOJA 2')
    expect(texto[0]).toContain('SIN FIRMA NO ES VÁLIDO')

    // Y no se queda ni con el arrastre ni con la firma.
    expect(texto[0]).not.toContain('constancia')
    expect(texto[0]).not.toContain(FIRMANTE)

    // La hoja 2 trae las dos cosas. La firma sola sería el defecto.
    expect(texto[1]).toContain('constancia')
    expect(texto[1]).toContain(FIRMANTE)

    // El aviso NO sale en la última hoja: en ella no continúa nada.
    expect(texto[1]).not.toContain('RESERVADO PARA LA FIRMA')
    expect(texto[1]).not.toContain('SIN FIRMA NO ES VÁLIDO')
  }, 60_000)

  it('I.3.4: no comprime el cuerpo para cuadrar la hoja', async () => {
    const cuerpos = cuerposPorHoja(
      await renderToBuffer(
        documento(CONTENIDO_A_MEDIA_HOJA, {
          arrastre: ARRASTRE,
          firmas: FIRMAS,
          avisos: [{ forma: 'reservaFirma' }],
        }),
      ),
    )

    expect(cuerpos).toHaveLength(2)
    // El mismo cuerpo de texto corrido en las dos hojas. Si en la primera fuera
    // más chico, el motor habría comprimido para que cupiera algo más.
    for (const hoja of cuerpos) {
      expect(hoja).toContain(TIPOGRAFIA['texto.corrido'].cuerpo)
    }
    // Y nada por debajo del cuerpo más pequeño de la escala que este documento
    // usa, que es el del aviso.
    const minimo = Math.min(...cuerpos.flatMap((hoja) => [...hoja]))
    expect(minimo).toBe(TIPOGRAFIA.pie.cuerpo)
  }, 60_000)

  it('las tres formas del aviso, con la palabra que declara el formato', async () => {
    // Tres hojas: 80 renglones son 1440 pt sobre una caja de 670, así que caben
    // 37 en cada una de las dos primeras y el resto pasa a la tercera con el cierre.
    const texto = textoPorHoja(
      await renderToBuffer(
        documento(80, {
          arrastre: ARRASTRE,
          firmas: FIRMAS,
          avisos: [
            { forma: 'listaContinua', items: 'estudios', desde: 1, hasta: 5 },
            { forma: 'textoContinua', items: 'indicaciones' },
          ],
        }),
      ),
    )

    expect(texto).toHaveLength(3)
    expect(texto[0]).toContain('CONTINÚA EN LA HOJA 2 · ESTUDIOS 1 A 5')
    expect(texto[1]).toContain('LAS INDICACIONES CONTINÚAN EN LA HOJA 3')
    // La zona derecha es la misma en las dos, e invariable (`CONCILIA D22`).
    expect(texto[0]).toContain('SIN FIRMA NO ES VÁLIDO')
    expect(texto[1]).toContain('SIN FIRMA NO ES VÁLIDO')
    expect(texto[2]).not.toContain('SIN FIRMA NO ES VÁLIDO')
  }, 60_000)

  it('compone el aviso con la tipografía del sistema, no con la de reserva', async () => {
    // La prebúsqueda de tipografías recorre el árbol DECLARADO, antes de que corra
    // ningún `render`. Si las dos zonas solo existieran dentro del `render`, su
    // familia no se cargaría y el aviso caería a la tipografía por defecto del
    // renderer — sin lanzar nada. Ver I.3.8.
    //
    // El bloque de firmas va aquí SIN Archivo a propósito: con el 2.L de verdad,
    // el rol de firma cargaría la familia y el defecto quedaría tapado.
    const pdf = (
      await renderToBuffer(
        documento(CONTENIDO_A_MEDIA_HOJA, {
          arrastre: ARRASTRE,
          firmas: FIRMAS_SIN_ARCHIVO,
          avisos: [{ forma: 'reservaFirma' }],
        }),
      )
    ).toString('latin1')

    const familias = [...pdf.matchAll(/\/BaseFont \/(?:\w{6}\+)?([\w-]+)/g)].map((m) => m[1])
    // El aviso es lo único de este documento que pide la neo-grotesca en 600.
    expect(familias).toContain('Archivo-SemiBold')
    expect(familias.filter((f) => f.startsWith('Helvetica'))).toEqual([])
  }, 60_000)

  it('regla 2: los dos umbrales de párrafo siguen valiendo el defecto del renderer', () => {
    // 2.P, 2.I y 2.J no declaran `orphans` ni `widows`: hoy no hace falta porque
    // los dos tokens valen lo mismo que el defecto de react-pdf. El día que I.1.9
    // mueva cualquiera de los dos, esos tres componentes se quedarían en el valor
    // viejo SIN AVISAR. Esta prueba es lo que convierte ese silencio en un fallo.
    expect(FLUJO.orphans).toBe(2)
    expect(FLUJO.widows).toBe(2)
  })
})
