/**
 * 2.M · `PieDocumento` — la prueba del DEFECTO MUDO.
 *
 * POR QUÉ EXISTE ESTA PRUEBA Y NO SE BORRA
 *
 * La zona de paginación de la banda de pie **se compuso en cero líneas** durante
 * toda la construcción de 2.M: sin excepción, sin aviso y sin hueco visible — la
 * banda salía entera, con folio y leyenda, y la cifra simplemente no estaba. Un
 * defecto que no lanza y no se ve solo lo detecta una prueba.
 *
 * La causa está en I.3.8 («La trampa del nodo con render»): el interlineado de la
 * escala es una RAZÓN del cuerpo, cada nodo con función de render obliga a
 * recomponer la página, y en cada recomposición la razón se vuelve a aplicar
 * sobre un valor ya resuelto — 11 → 77 → 539 pt—, hasta que la línea no cabe en
 * la banda de 16.
 *
 * **2.N va a repetirlo.** Sus tres avisos de pie son nodos que se recomponen por
 * hoja, igual que este. Cuando se construya, esta prueba es el molde.
 *
 * QUÉ COMPRUEBA, Y POR QUÉ ASÍ
 *
 * Que la cadena de paginación **existe en el texto extraído de las dos hojas**,
 * no que el componente devuelva un árbol. Un árbol correcto es justamente lo que
 * había mientras el defecto estaba vivo.
 *
 * El extractor se implementa aquí abajo, a mano, en vez de usar `pdftotext` o
 * `pdfjs-dist`: el primero es un binario del sistema que no todo el mundo tiene y
 * el segundo no es dependencia declarada de este proyecto. Una prueba que se
 * salta cuando falta una herramienta es otro defecto mudo.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Page, Text, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import PieDocumento from '@/lib/pdf/v2/PieDocumento'
import {
  PAPEL,
  MARGEN,
  FUENTE,
  resolverAcento,
  ACENTO_BASE_POR_DEFECTO,
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

/**
 * Texto de cada hoja del PDF, en orden. Sin heurísticas de palabra: devuelve los
 * caracteres tal como los dibuja el flujo de contenido.
 *
 * **Ojo con lo que NO hace:** no reconstruye espacios a partir de la posición.
 * Los que salen son los que el documento dibuja como glifo.
 */
function textoPorHoja(pdf: Buffer): string[] {
  const bruto = pdf.toString('latin1')
  const objs = objetos(bruto)

  // Nombre de recurso (`/F5`) → tabla de la fuente. pdfkit es consistente en
  // todo el documento: un nombre apunta siempre al mismo objeto.
  const tablas = new Map<string, Map<number, string>>()
  for (const dicc of bruto.matchAll(/\/Font <<([^>]*)>>/g)) {
    for (const par of dicc[1].matchAll(/\/(\w+) (\d+) 0 R/g)) {
      const fuente = objs.get(Number(par[2])) ?? ''
      const ref = fuente.match(/\/ToUnicode (\d+) 0 R/)
      if (ref === null) continue
      tablas.set(par[1], tablaUnicode(flujo(objs.get(Number(ref[1])) ?? '')))
    }
  }

  const hojas: string[] = []
  for (const pagina of bruto.matchAll(/\/Type \/Page\n[\s\S]*?\/Contents (\d+) 0 R/g)) {
    const contenido = flujo(objs.get(Number(pagina[1])) ?? '')
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
    hojas.push(texto)
  }
  return hojas
}

// ─── La prueba ───────────────────────────────────────────────────────────────

registrarFuentesDeDisco()

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/** Relleno suficiente para que el flujo reparta en DOS hojas y no en una. */
const RELLENO = Array.from({ length: 40 }, (_, i) =>
  h(
    Text,
    { key: i, style: { fontFamily: FUENTE.humanista, fontSize: 11.5, marginBottom: 6 } },
    `Renglon de relleno numero ${i}.`,
  ),
)

/** Una hoja del sistema: es el `paddingBottom` lo que reserva la banda (I.1.2). */
function documento(pie: React.ReactElement): React.ReactElement<DocumentProps> {
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
      ...RELLENO,
      pie,
    ),
  )
}

describe('2.M · PieDocumento', () => {
  it('imprime la paginación en LAS DOS hojas, variante completo', async () => {
    const hojas = textoPorHoja(
      await renderToBuffer(
        documento(h(PieDocumento, { variante: 'completo', folio: 'RX-2026-0042', acento })),
      ),
    )

    expect(hojas).toHaveLength(2)
    // Lo que se cayó en silencio. Si esto falla, mira I.3.8 antes que el componente.
    expect(hojas[0]).toContain('PÁGINA 1 DE 2')
    expect(hojas[1]).toContain('PÁGINA 2 DE 2')
    // Las otras dos zonas, que nunca fallaron: si caen, es otra cosa.
    for (const hoja of hojas) {
      expect(hoja).toContain('Folio RX-2026-0042')
      expect(hoja).toContain('spinus.com.mx')
    }
  }, 60_000)

  it('imprime la paginación en LAS DOS hojas, variante sin folio', async () => {
    const hojas = textoPorHoja(
      await renderToBuffer(
        documento(
          h(PieDocumento, { variante: 'sinFolio', acento }),
        ),
      ),
    )

    expect(hojas).toHaveLength(2)
    expect(hojas[0]).toContain('PÁGINA 1 DE 2')
    expect(hojas[1]).toContain('PÁGINA 2 DE 2')
    for (const hoja of hojas) {
      // Regla 4: en esta variante no hay folio en ninguna hoja.
      expect(hoja).not.toContain('Folio')
      // Y desde que el título salió de la banda, tampoco el nombre del
      // documento: la zona que el folio deja libre no la ocupa nadie.
      expect(hoja).toContain('spinus.com.mx')
    }
  }, 60_000)

  it('compone la banda con la tipografía del sistema, no con la de reserva', async () => {
    // La prebúsqueda de tipografías recorre el árbol DECLARADO, antes de que
    // corra ningún `render`. Si las tres zonas solo existieran dentro del
    // `render`, sus familias no se cargarían y la banda caería a la tipografía
    // por defecto del renderer — sin lanzar nada. Ver I.3.8.
    const pdf = (
      await renderToBuffer(
        documento(h(PieDocumento, { variante: 'completo', folio: 'RX-2026-0042', acento })),
      )
    ).toString('latin1')

    const familias = [...pdf.matchAll(/\/BaseFont \/(?:\w{6}\+)?([\w-]+)/g)].map((m) => m[1])
    expect(familias).toContain('Archivo-Regular')
    expect(familias).toContain('Archivo-SemiBold')
    expect(familias.filter((f) => f.startsWith('Helvetica'))).toEqual([])
  }, 60_000)
})
