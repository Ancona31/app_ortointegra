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
import MotorFlujo from '@/lib/pdf/v2/MotorFlujo'
import BloqueFirmas from '@/lib/pdf/v2/BloqueFirmas'
import {
  PAPEL,
  MARGEN,
  FLUJO,
  TIPOGRAFIA,
  estiloTipografico,
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

/**
 * LAS LÍNEAS BASE DE UNA HOJA, en orden de aparición y medidas desde el borde superior.
 *
 * ⚠ **NO BASTA CON LEER LOS `Tm`.** react-pdf los escribe casi siempre como
 * `1 0 0 1 0 792 Tm` y coloca el texto con la pila de `cm`, así que un lector que solo mire
 * el `Tm` obtiene 792 para todos los renglones — que es exactamente el fallo con el que esta
 * prueba se escribió la primera vez. Hay que componer la matriz, como hacen los lectores de
 * las pruebas de formato.
 */
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

function basesPorHoja(pdf: Buffer): number[][] {
  return hojas(pdf).map(({ contenido }) => {
    const bases: number[] = []
    const pila: Matriz[] = []
    let ctm: Matriz = IDENTIDAD
    for (const t of contenido.matchAll(
      /(q)\n|(Q)\n|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm/g,
    )) {
      if (t[1] !== undefined) pila.push(ctm)
      else if (t[2] !== undefined) ctm = pila.pop() ?? IDENTIDAD
      else if (t[3] !== undefined) {
        ctm = concatenar([+t[3], +t[4], +t[5], +t[6], +t[7], +t[8]] as const, ctm)
      } else {
        bases.push(792 - (ctm[1] * +t[13] + ctm[3] * +t[14] + ctm[5]))
      }
    }
    return bases
  })
}

/**
 * EL PASO ENTRE DOS RENGLONES CONSECUTIVOS DE UNA HOJA, sin repetir el que ya se midió.
 *
 * Devuelve los pasos distintos que aparecen, redondeados a centésimas: en una hoja sin
 * comprimir hay UNO —el interlineado del rol— más los saltos entre bloques, que son mayores.
 * Lo que delata la compresión es que el paso del cuerpo deje de ser exacto.
 */
function pasos(bases: number[]): number[] {
  const saltos = bases.slice(1).map((y, i) => Math.round((y - bases[i]) * 100) / 100)
  return [...new Set(saltos)].sort((a, b) => a - b)
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

/*
  ⚠ **AQUÍ VIVÍA `cuerposPorHoja`, Y MEDÍA LA SEÑAL EQUIVOCADA.**

  Comparaba los cuerpos de letra de una hoja con los de la otra para detectar la compresión
  de I.3.4. No podía cazar nada: **react-pdf no toca `fontSize` jamás**. Cuando la hoja no
  cuadra, quien encoge es Yoga, y encoge CAJAS — las letras salen del mismo tamaño dentro de
  cajas más juntas. Una prueba que no puede fallar es peor que ninguna: se lee como garantía.

  La sustituye la sonda de más abajo, que mide distancias entre puntos conocidos del flujo
  contra su suma de tokens, y en TODAS las hojas.
*/

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

/**
 * Nombre que solo puede salir del riel del paciente, en cualquiera de sus dos
 * variantes. Sin la secuencia `fi`: react-pdf incrusta la LIGADURA como glifo propio
 * y su `ToUnicode` no la descompone, así que un «Identificable» sale del flujo como
 * «Identicable» y la prueba fallaría por el extractor, no por el componente.
 */
const PACIENTE = 'Paciente Reconocible'

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
 * Los datos del encabezado. Van al mínimo a propósito: esta prueba fija el motor de
 * flujo, no la composición del encabezado —eso es 2.V y lo miden las tres pruebas de
 * formato—. Lo único que importa aquí es que exista, porque su alto entra en el
 * reparto.
 */
const ENCABEZADO = {
  medico: {
    nombre: 'Dra. Elena Marín Solís',
    especialidad: 'Ortopedia y Traumatología',
    universidad: 'Universidad Nacional Autónoma de México',
    cedulas: ['Céd. Prof. 7000001'],
  },
  consultorio: { domicilio: 'Av. Ficticia 100', telefono: 'Tel. 55 0000 0000' },
  panel: { variante: 'oculto' } as const,
  acento: resolverAcento(ACENTO_BASE_POR_DEFECTO),
  titulo: 'Hoja de prueba',
  paciente: { paciente: PACIENTE },
}

/**
 * Una hoja del sistema. Es el `paddingBottom: margen.inferior` lo que reserva el
 * hueco donde vive el aviso (I.1.2): sin él, el aviso se solaparía con la última
 * línea de contenido, que es el bug §8.1 en su versión de 2.N.
 */
function documento(
  hijos: number,
  props: {
    arrastre?: string
    firmas: React.ReactElement
    contador?: { items: string; total: number }
  },
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
      h(MotorFlujo, { encabezado: ENCABEZADO, ...props, children: relleno(hijos) }),
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
      }),
    )
    const texto = textoPorHoja(pdf)

    expect(texto).toHaveLength(2)

    // La hoja 1 cierra con el aviso. Esto es lo que se compone dentro de un
    // `render` y lo que se cae en silencio: si falla, mira I.3.8 antes que el
    // componente.
    //
    // UNA SOLA FORMA, y eran tres: el rango de la de lista pedía saber qué ítems
    // cayeron en cada hoja, que el renderer no reporta. Ver `ZONA_IZQUIERDA` en 2.N.
    expect(texto[0]).toContain('CONTINÚA EN LA HOJA 2')
    expect(texto[0]).toContain('SIN FIRMA NO ES VÁLIDO')

    // Y no se queda ni con el arrastre ni con la firma.
    expect(texto[0]).not.toContain('constancia')
    expect(texto[0]).not.toContain(FIRMANTE)

    // La hoja 2 trae las dos cosas. La firma sola sería el defecto.
    expect(texto[1]).toContain('constancia')
    expect(texto[1]).toContain(FIRMANTE)

    // El aviso NO sale en la última hoja: en ella no continúa nada.
    expect(texto[1]).not.toContain('CONTINÚA EN LA HOJA')
    expect(texto[1]).not.toContain('SIN FIRMA NO ES VÁLIDO')

    // REGLA 2 DE 2.D, QUE ES LO QUE 2.N AÑADIÓ AL CABLEARSE: la hoja de continuación
    // identifica al paciente ella sola. Antes de esto llegaba sin membrete, sin folio
    // y sin nombre — el hallazgo más grave de la auditoría del sistema viejo.
    expect(texto[1]).toContain(PACIENTE)
    expect(texto[1]).toContain('CONTINUACIÓN')
  }, 60_000)

  it('I.3.4: no comprime el cuerpo para cuadrar la hoja, en NINGUNA hoja', async () => {
    /*
      ⚠ **ESTA PRUEBA MEDÍA LOS CUERPOS DE LETRA Y ESA ES LA SEÑAL EQUIVOCADA.**

      Comparaba los operadores `Tf` de las dos hojas —«si en la primera fuera más chico, el
      motor habría comprimido»—. **react-pdf nunca toca `fontSize`**: cuando la hoja que
      cierra no cuadra, lo que encoge son las CAJAS. Medido sobre un documento comprimido: los
      conjuntos de cuerpos salen byte a byte idénticos a los del mismo documento sin comprimir,
      así que la prueba pasaba con el defecto delante.

      Y tampoco habría cazado el defecto que la cabecera de 2.N documenta —«el paso de fila
      bajando de 50 a 40.99 pt»—, por lo mismo: ahí lo que baja es el paso, no el cuerpo.

      **Lo que se mide ahora es la distancia entre dos puntos conocidos del flujo contra su
      suma de tokens**: dos renglones consecutivos de `texto.corrido` tienen que estar
      separados por su interlineado EXACTO. Y se mide en todas las hojas, no solo en la
      primera — la compresión ocurre en la hoja que CIERRA, que puede ser cualquiera.

      DE DÓNDE SALE LA COMPRESIÓN, para quien venga a tocar esto:

      `splitPage` re-maqueta la hoja que cierra con altura DEFINIDA —`{ ...page.box, height }`—
      y la siguiente con altura auto. Con altura definida, cualquier exceso residual es
      espacio libre negativo de un contenedor flex en columna, y Yoga lo reparte encogiendo a
      todos los hijos en proporción. Puede encogerlos a todos porque `setFlexShrink` compone
      `value || 1`: **ningún nodo puede declararse rígido con `flexShrink: 0`**.
    */
    const bases = basesPorHoja(
      await renderToBuffer(
        documento(CONTENIDO_A_MEDIA_HOJA, { arrastre: ARRASTRE, firmas: FIRMAS }),
      ),
    )

    expect(bases).toHaveLength(2)

    const interlineado = TIPOGRAFIA['texto.corrido'].interlineado ?? 0
    for (const [indice, hoja] of bases.entries()) {
      const cuerpo = pasos(hoja).filter((p) => p > 0 && p < interlineado * 1.5)
      /*
        El paso del cuerpo es UNO y es el interlineado del rol. Si la hoja se hubiera
        comprimido, aquí saldría 17.97 en vez de 18 — y con dos decimales eso no pasa
        desapercibido. Se filtran los saltos mayores porque son los aires entre bloques, que
        esta prueba no fija: los fijan las de cada formato.
      */
      expect(cuerpo, `hoja ${indice + 1}`).toContain(interlineado)
    }
  }, 60_000)

  it('el contador sale en todas las hojas, con su forma y sin cifra inventada', async () => {
    // Tres hojas: 80 renglones son 1440 pt sobre una caja que el encabezado ya
    // recorta, así que el contenido reparte y el cierre cae en la última.
    const texto = textoPorHoja(
      await renderToBuffer(
        documento(80, {
          arrastre: ARRASTRE,
          firmas: FIRMAS,
          contador: { items: 'estudios', total: 9 },
        }),
      ),
    )

    expect(texto.length).toBeGreaterThan(2)
    const ultima = texto.length

    /*
      LA FORMA INTERMEDIA SITÚA LA HOJA, NO CUENTA SUS ÍTEMS. El `NN DE MM` de la
      ficha —«cuántos van en ESTA hoja»— no lo reporta el renderer y no lo puede
      calcular nadie sin paginar a mano. Decisión de Angel: cambiar la cadena. Ver 2.K.
    */
    for (let i = 0; i < ultima - 1; i += 1) {
      expect(texto[i]).toContain(`ESTUDIOS · HOJA ${i + 1} DE ${ultima} · TOTAL 9`)
      expect(texto[i]).toContain('SIN FIRMA NO ES VÁLIDO')
    }

    // La última lleva la forma final, y ninguna otra la lleva.
    expect(texto[ultima - 1]).toContain('TOTAL DE ESTUDIOS · 9')
    expect(texto[ultima - 1]).not.toContain('SIN FIRMA NO ES VÁLIDO')
    expect(texto.slice(0, -1).every((t) => !t.includes('TOTAL DE ESTUDIOS'))).toBe(true)

    // Y en ninguna aparece la cifra que no se puede saber.
    expect(texto.some((t) => t.includes('EN ESTA HOJA'))).toBe(false)
  }, 60_000)

  it('compone el aviso con la tipografía del sistema, no con la de reserva', async () => {
    // La prebúsqueda de tipografías recorre el árbol DECLARADO, antes de que corra
    // ningún `render`. Si las dos zonas solo existieran dentro del `render`, su
    // familia no se cargaría y el aviso caería a la tipografía por defecto del
    // renderer — sin lanzar nada. Ver I.3.8.
    //
    // El bloque de firmas va aquí SIN Archivo a propósito: con el 2.L de verdad,
    // el rol de firma cargaría la familia y el defecto quedaría tapado. El
    // encabezado sí la carga —el nombre del médico va en Archivo—, así que lo que
    // esta prueba fija hoy es que ninguna de las dos zonas cae a Helvetica.
    const pdf = (
      await renderToBuffer(
        documento(CONTENIDO_A_MEDIA_HOJA, {
          arrastre: ARRASTRE,
          firmas: FIRMAS_SIN_ARCHIVO,
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
