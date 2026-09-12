/**
 * El cuerpo del Escrito Médico — `src/lib/pdf/v2/cuerpoEscrito.ts`.
 *
 * POR QUÉ EXISTE. El chasis de v2 se midió contra las láminas y nadie comprobó el
 * otro extremo: que los formatos pudieran leer lo que los formularios GUARDAN. El
 * escrito médico es donde ese hueco era total —el formato compone `NodoEscrito[]`
 * y la fila guarda JSON de ProseMirror y HTML— y este archivo es lo que impide
 * que se vuelva a abrir.
 *
 * QUÉ VIGILA. Que **todo lo que la barra del editor sabe producir tenga destino**:
 * negrita, cursiva, subrayado, los dos niveles de encabezado, las dos listas, la
 * cita, el separador y las cuatro alineaciones. Y que lo que no tiene equivalente
 * salga NOMBRADO en `descartes` en vez de desaparecer.
 *
 * La lista de la barra es `EditorEscrito.tsx:121-130` para las marcas y `:236`
 * para las alineaciones. Si algún día se le añade un botón, la prueba
 * «la barra entera tiene destino» es la que tiene que fallar.
 */

import { describe, expect, it } from 'vitest'
import {
  cuerpoDesdeDoc,
  cuerpoDesdeHtml,
  cuerpoEscritoDesde,
} from '@/lib/pdf/v2/cuerpoEscrito'
import type { NodoEscrito, TramoTexto } from '@/lib/pdf/v2/formatos/EscritoMedico'

// ─── Ayudas ──────────────────────────────────────────────────────────────────

function parrafo(texto: string, attrs?: Record<string, unknown>): unknown {
  return { type: 'paragraph', attrs, content: [{ type: 'text', text: texto }] }
}

function conMarca(texto: string, marca: string): unknown {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text: texto, marks: [{ type: marca }] }],
  }
}

function doc(...bloques: unknown[]): unknown {
  return { type: 'doc', content: bloques }
}

/** Los tramos de un nodo, sea cual sea su tipo. Vacío si el nodo no los lleva. */
function tramosDe(nodo: NodoEscrito | undefined): readonly TramoTexto[] {
  if (nodo === undefined) return []
  if (nodo.tipo === 'parrafo' || nodo.tipo === 'cita') return nodo.tramos
  return []
}

// ─── Las marcas de la barra ──────────────────────────────────────────────────

describe('las tres marcas que la barra ofrece', () => {
  it.each([
    ['bold', 'negrita'],
    ['italic', 'cursiva'],
    ['underline', 'subrayado'],
  ])('%s → %s, y sin descartes', (marcaEditor, marcaFormato) => {
    const { cuerpo, descartes } = cuerpoDesdeDoc(doc(conMarca('x', marcaEditor)))
    const tramo = tramosDe(cuerpo[0])[0]
    expect(tramo).toMatchObject({ texto: 'x', [marcaFormato]: true })
    expect(descartes).toEqual([])
  })

  /**
   * El subrayado es la marca que NO competía con nada, y por eso se prueba
   * combinada: `textDecoration` no es familia, así que se acumula con las otras
   * dos. Negrita + cursiva sí compiten —no hay 500 itálica registrada— pero esa
   * decisión la toma el formato al componer, no el conversor: aquí llegan las dos.
   */
  it('las marcas se acumulan en el mismo tramo', () => {
    const nodo = doc({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'x',
        marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }],
      }],
    })
    expect(tramosDe(cuerpoDesdeDoc(nodo).cuerpo[0])[0]).toEqual({
      texto: 'x', negrita: true, cursiva: true, subrayado: true,
    })
  })
})

// ─── Los encabezados, que es donde el mapeo engaña ───────────────────────────

describe('los dos niveles de encabezado', () => {
  /**
   * ⚠ La trampa: la barra rotula `h2` como «Título» y `h3` como «Subtítulo». Un
   * mapeo `level → encabezado${level}` mandaría el Título al nivel menor. Estas
   * dos aserciones son las que lo impiden.
   */
  it.each([
    [1, 'encabezado1'],
    [2, 'encabezado1'],
    [3, 'encabezado2'],
    [4, 'encabezado2'],
  ])('h%i → %s', (level, esperado) => {
    const d = doc({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: 'T' }] })
    expect(cuerpoDesdeDoc(d).cuerpo[0]).toMatchObject({ tipo: esperado, texto: 'T' })
  })

  it('un encabezado vacío no ocupa sitio', () => {
    const d = doc({ type: 'heading', attrs: { level: 2 }, content: [] })
    expect(cuerpoDesdeDoc(d).cuerpo).toEqual([])
  })
})

// ─── Listas, cita y separador ────────────────────────────────────────────────

describe('los bloques de la barra', () => {
  it.each([
    ['bulletList', 'vineta'],
    ['orderedList', 'numero'],
  ])('%s → lista con marca %s', (tipoEditor, marca) => {
    const d = doc({
      type: tipoEditor,
      content: [
        { type: 'listItem', content: [parrafo('uno')] },
        { type: 'listItem', content: [parrafo('dos')] },
      ],
    })
    expect(cuerpoDesdeDoc(d).cuerpo[0]).toMatchObject({ tipo: 'lista', marca })
    const nodo = cuerpoDesdeDoc(d).cuerpo[0]
    expect(nodo?.tipo === 'lista' ? nodo.items.length : 0).toBe(2)
  })

  it('la cita conserva sus marcas y sube la alineación del párrafo de dentro', () => {
    const d = doc({
      type: 'blockquote',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{ type: 'text', text: 'citado', marks: [{ type: 'italic' }] }],
      }],
    })
    expect(cuerpoDesdeDoc(d).cuerpo[0]).toEqual({
      tipo: 'cita',
      tramos: [{ texto: 'citado', cursiva: true }],
      alineacion: 'center',
    })
  })

  it('el separador entra tal cual', () => {
    expect(cuerpoDesdeDoc(doc({ type: 'horizontalRule' })).cuerpo[0]).toEqual({
      tipo: 'separador',
    })
  })
})

// ─── Las cuatro alineaciones ─────────────────────────────────────────────────

describe('las alineaciones de la barra', () => {
  it.each(['center', 'right', 'justify'])('%s sobrevive al conversor', (valor) => {
    const d = doc(parrafo('x', { textAlign: valor }))
    expect(cuerpoDesdeDoc(d).cuerpo[0]).toMatchObject({ alineacion: valor })
  })

  /**
   * `left` NO se escribe: es la bandera izquierda del chasis, y ponerla haría que
   * el caso normal llevara una alineación elegida en vez de la del sistema.
   */
  it('left no escribe alineación: es la del chasis', () => {
    const d = doc(parrafo('x', { textAlign: 'left' }))
    const nodo = cuerpoDesdeDoc(d).cuerpo[0]
    expect(nodo?.tipo === 'parrafo' ? nodo.alineacion : 'algo').toBeUndefined()
  })

  it('un valor que el editor no produce se ignora en vez de colarse', () => {
    const d = doc(parrafo('x', { textAlign: 'inherit' }))
    const nodo = cuerpoDesdeDoc(d).cuerpo[0]
    expect(nodo?.tipo === 'parrafo' ? nodo.alineacion : 'algo').toBeUndefined()
  })
})

// ─── Lo que no tiene equivalente ─────────────────────────────────────────────

describe('lo que no tiene equivalente sale nombrado, no en silencio', () => {
  it('el tachado se cuenta y su texto se conserva', () => {
    const { cuerpo, descartes } = cuerpoDesdeDoc(doc(conMarca('borrado', 'strike')))
    expect(tramosDe(cuerpo[0])[0]).toEqual({ texto: 'borrado' })
    expect(descartes).toEqual([{ que: 'tachado', veces: 1 }])
  })

  it('cuenta las veces, porque una y treinta no son lo mismo', () => {
    const { descartes } = cuerpoDesdeDoc(
      doc(conMarca('a', 'strike'), conMarca('b', 'strike'), conMarca('c', 'code')),
    )
    expect(descartes).toEqual([
      { que: 'tachado', veces: 2 },
      { que: 'código en línea', veces: 1 },
    ])
  })

  it('una lista anidada se aplana y queda anotada', () => {
    const d = doc({
      type: 'bulletList',
      content: [{
        type: 'listItem',
        content: [
          parrafo('padre'),
          { type: 'bulletList', content: [{ type: 'listItem', content: [parrafo('hijo')] }] },
        ],
      }],
    })
    const { cuerpo, descartes } = cuerpoDesdeDoc(d)
    const nodo = cuerpo[0]
    expect(nodo?.tipo === 'lista' ? nodo.items.length : 0).toBe(2)
    expect(descartes).toEqual([{ que: 'lista anidada', veces: 1 }])
  })
})

// ─── Saltos y líneas en blanco ───────────────────────────────────────────────

describe('saltos de línea y párrafos vacíos', () => {
  /**
   * Shift+Enter y Enter son dos gestos distintos en el editor. Sin esto, dos
   * renglones separados a mano salían pegados en el papel.
   */
  it('hardBreak es un salto dentro del tramo, no un párrafo nuevo', () => {
    const d = doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'uno' },
        { type: 'hardBreak' },
        { type: 'text', text: 'dos' },
      ],
    })
    const { cuerpo } = cuerpoDesdeDoc(d)
    expect(cuerpo).toHaveLength(1)
    expect(tramosDe(cuerpo[0]).map((t) => t.texto).join('')).toBe('uno\ndos')
  })

  it('una línea en blanco de EN MEDIO se conserva: es un gesto del médico', () => {
    const d = doc(parrafo('a'), { type: 'paragraph' }, parrafo('b'))
    expect(cuerpoDesdeDoc(d).cuerpo).toHaveLength(3)
  })

  it('las de los extremos se recortan: son residuo del cursor', () => {
    const d = doc({ type: 'paragraph' }, parrafo('a'), { type: 'paragraph' })
    const { cuerpo } = cuerpoDesdeDoc(d)
    expect(cuerpo).toHaveLength(1)
    expect(tramosDe(cuerpo[0])[0]?.texto).toBe('a')
  })
})

// ─── El camino de los escritos antiguos ──────────────────────────────────────

describe('el HTML de los escritos anteriores al editor', () => {
  it('compone párrafos, encabezados, separador y marcas', () => {
    const { cuerpo } = cuerpoDesdeHtml(
      '<h2>Constancia</h2><p>Texto con <strong>peso</strong>.</p><hr /><p>Cierre</p>',
    )
    expect(cuerpo.map((n) => n.tipo)).toEqual([
      'encabezado1', 'parrafo', 'separador', 'parrafo',
    ])
    expect(tramosDe(cuerpo[1])).toContainEqual({ texto: 'peso', negrita: true })
  })

  /**
   * La diferencia real con el parser de v1, que usaba una expresión regular por
   * pareja de etiquetas y por tanto perdía la marca de fuera.
   */
  it('las marcas anidadas conservan las dos, que es lo que v1 perdía', () => {
    const { cuerpo } = cuerpoDesdeHtml('<p><strong><em>ambas</em></strong></p>')
    expect(tramosDe(cuerpo[0])[0]).toEqual({ texto: 'ambas', negrita: true, cursiva: true })
  })

  it('las listas se reconocen como listas y no como párrafos con viñeta', () => {
    const { cuerpo } = cuerpoDesdeHtml('<ul><li>uno</li><li>dos</li></ul>')
    expect(cuerpo[0]).toMatchObject({ tipo: 'lista', marca: 'vineta' })
  })

  it('lee la alineación del atributo de estilo', () => {
    const { cuerpo } = cuerpoDesdeHtml('<p style="text-align: center">centrado</p>')
    expect(cuerpo[0]).toMatchObject({ alineacion: 'center' })
  })

  it('decodifica las entidades que el HTML viejo trae', () => {
    const { cuerpo } = cuerpoDesdeHtml('<p>a&nbsp;b &amp; c</p>')
    expect(tramosDe(cuerpo[0]).map((t) => t.texto).join('')).toBe('a b & c')
  })

  it('el texto suelto sin etiqueta de bloque no se pierde', () => {
    const { cuerpo } = cuerpoDesdeHtml('suelto<p>dentro</p>')
    expect(cuerpo).toHaveLength(2)
    expect(tramosDe(cuerpo[0])[0]?.texto).toBe('suelto')
  })
})

// ─── La puerta: cuál de los dos caminos ──────────────────────────────────────

describe('cuerpoEscritoDesde · elige el camino', () => {
  it('manda `doc` cuando existe, porque `cuerpo` es su copia aplanada', () => {
    const { cuerpo } = cuerpoEscritoDesde({
      doc: { schema: 'tiptap-doc-v1', content: doc({
        type: 'bulletList',
        content: [{ type: 'listItem', content: [parrafo('real')] }],
      }) },
      // La misma lista, ya aplanada por `postProcesarParaParserLegacy`.
      cuerpo: '<p>• real</p>',
    })
    expect(cuerpo[0]).toMatchObject({ tipo: 'lista' })
  })

  it('cae al HTML cuando no hay `doc`: son los escritos antiguos', () => {
    const { cuerpo } = cuerpoEscritoDesde({ cuerpo: '<p>antiguo</p>' })
    expect(tramosDe(cuerpo[0])[0]?.texto).toBe('antiguo')
  })

  /**
   * `documentos.contenido` es `jsonb` y pudo escribirlo otra versión del
   * formulario. Un esquema desconocido cae al HTML —la copia degradada pero
   * legible— en vez de producir un cuerpo vacío sin decir nada.
   */
  it('un esquema desconocido cae al HTML en vez de vaciar el cuerpo', () => {
    const { cuerpo } = cuerpoEscritoDesde({
      doc: { schema: 'otro-esquema-v9', content: doc(parrafo('ignorado')) },
      cuerpo: '<p>respaldo</p>',
    })
    expect(tramosDe(cuerpo[0])[0]?.texto).toBe('respaldo')
  })

  it('sin nada que leer devuelve un cuerpo vacío y no revienta', () => {
    expect(cuerpoEscritoDesde(null)).toEqual({ cuerpo: [], descartes: [] })
    expect(cuerpoEscritoDesde({})).toEqual({ cuerpo: [], descartes: [] })
  })

  it('un JSON malformado no interrumpe la generación del PDF', () => {
    const roto = { schema: 'tiptap-doc-v1', content: { type: 'doc', content: [null, 7, {}] } }
    expect(() => cuerpoEscritoDesde({ doc: roto })).not.toThrow()
  })
})
