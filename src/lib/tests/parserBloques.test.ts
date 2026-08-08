/**
 * Batería de 2.J · `ParserBloques` — `DOCUMENTOS_SPEC.md` I.2 · 2.J.
 *
 * La ficha declara siete casos y dice que **el caso 2 se prueba antes que ningún
 * otro**: por eso abre el archivo. No es orden estético — es el bug que ya
 * apareció una vez, en el mockup de Internamiento, y el único que se cuela sin
 * ruido: la prosa compuesta en versalita se ve como un título perfectamente
 * legible hasta que alguien lee lo que dice.
 *
 * Estas pruebas son del ANÁLISIS, no de la composición: qué es cada línea y en
 * qué orden queda. Lo que se ve —versalita, raya colgada, sangría— se comprueba
 * en el taller, con el PDF delante.
 */

import { describe, it, expect } from 'vitest'
import { analizar, type NodoParser } from '@/lib/pdf/v2/analizadorBloques'

/** Atajos de lectura: las pruebas hablan de tipos y textos, no de objetos. */
const tipos = (nodos: readonly NodoParser[]): readonly string[] => nodos.map((n) => n.tipo)
const textos = (nodos: readonly NodoParser[]): readonly string[] => nodos.map((n) => n.texto)
const ordinales = (nodos: readonly NodoParser[]): readonly number[] =>
  nodos.flatMap((n) => (n.tipo === 'item' ? [n.ordinal] : []))

describe('caso 2 — prosa sin viñetas y sin ítems debajo (SE PRUEBA PRIMERO)', () => {
  it('una línea de prosa suelta es párrafo, nunca encabezado', () => {
    const r = analizar('El paciente ingresa por dolor lumbar de tres semanas.')
    expect(tipos(r)).toEqual(['parrafo'])
  })

  it('dos renglones de prosa corrida son dos párrafos, sin versalita y sin numerar', () => {
    const r = analizar(
      'El paciente ingresa por dolor lumbar de tres semanas.\nSe solicita valoración por rehabilitación.',
    )
    expect(tipos(r)).toEqual(['parrafo', 'parrafo'])
    expect(ordinales(r)).toEqual([])
  })

  it('LA VERIFICACIÓN VISIBLE: dos renglones de prosa, después encabezado con sus viñetas', () => {
    const r = analizar(
      [
        'El paciente ingresa por dolor lumbar de tres semanas.',
        'Se solicita valoración por rehabilitación.',
        'Indicaciones generales:',
        '- Dieta blanda',
        '- Signos vitales cada ocho horas',
      ].join('\n'),
    )
    // Los dos primeros SIGUEN SIENDO PÁRRAFOS aunque más abajo haya una lista.
    expect(tipos(r)).toEqual(['parrafo', 'parrafo', 'encabezado', 'item', 'item'])
    expect(r[2].texto).toBe('Indicaciones generales:')
  })

  it('prosa con dos puntos al final sigue siendo párrafo si no hay ítems debajo', () => {
    const r = analizar('Indicaciones generales:\nSe entregan por escrito al familiar.')
    expect(tipos(r)).toEqual(['parrafo', 'parrafo'])
  })

  it('una línea en blanco CORTA: el encabezado separado de su lista es párrafo', () => {
    const r = analizar('El paciente ingresa hoy.\n\n- Dieta blanda\n- Reposo relativo')
    // Si el lookahead saltara los blancos, el primero saldría en versalita.
    expect(tipos(r)).toEqual(['parrafo', 'item', 'item'])
  })
})

describe('caso 1 — encabezado + 2 ítems', () => {
  const r = analizar('Indicaciones generales:\n- Dieta blanda\n- Signos vitales cada ocho horas')

  it('compone un bloque normal', () => {
    expect(tipos(r)).toEqual(['encabezado', 'item', 'item'])
  })

  it('los tres nodos van en el mismo bloque', () => {
    expect(r.map((n) => n.bloque)).toEqual([0, 0, 0])
  })

  it('la viñeta del dato no viaja al nodo: se sustituye en el render, no se duplica', () => {
    expect(textos(r)).toEqual([
      'Indicaciones generales:',
      'Dieta blanda',
      'Signos vitales cada ocho horas',
    ])
  })
})

describe('caso 3 — viñetas antes del primer encabezado', () => {
  const r = analizar(
    ['- Dieta blanda', '- Reposo relativo', 'Indicaciones al egreso:', '- Deambulación asistida'].join('\n'),
  )

  it('los ítems sueltos del principio son ítems, no prosa', () => {
    expect(tipos(r)).toEqual(['item', 'item', 'encabezado', 'item'])
  })

  it('no se concatenan: cada viñeta es su propio nodo', () => {
    expect(textos(r)).toEqual([
      'Dieta blanda',
      'Reposo relativo',
      'Indicaciones al egreso:',
      'Deambulación asistida',
    ])
  })

  it('el encabezado abre bloque nuevo', () => {
    expect(r.map((n) => n.bloque)).toEqual([0, 0, 1, 1])
  })
})

describe('caso 4 — un solo ítem', () => {
  it('un ítem solo se degrada a párrafo: no se numera', () => {
    const r = analizar('- Ayuno absoluto de ocho horas')
    expect(tipos(r)).toEqual(['parrafo'])
    expect(ordinales(r)).toEqual([])
    expect(textos(r)).toEqual(['Ayuno absoluto de ocho horas'])
  })

  it('con encabezado encima, el encabezado se queda como encabezado', () => {
    const r = analizar('Indicación única:\n- Ayuno absoluto de ocho horas')
    expect(tipos(r)).toEqual(['encabezado', 'parrafo'])
  })

  it('DOS ítems separados por un renglón en blanco NO son dos listas de uno', () => {
    // Si el alcance de la regla fuera el bloque, los dos perderían su raya.
    const r = analizar('- Dieta blanda\n\n- Reposo relativo')
    expect(tipos(r)).toEqual(['item', 'item'])
    expect(ordinales(r)).toEqual([1, 2])
  })
})

describe('caso 5 — ítem con dos puntos en medio', () => {
  it('no se confunde con encabezado', () => {
    const r = analizar('- Ayuno: ocho horas antes del ingreso\n- Traslado: en camilla')
    expect(tipos(r)).toEqual(['item', 'item'])
    expect(textos(r)).toEqual(['Ayuno: ocho horas antes del ingreso', 'Traslado: en camilla'])
  })
})

describe('caso 6 — cadena vacía', () => {
  it('cadena vacía colapsa entera', () => {
    expect(analizar('')).toEqual([])
  })

  it('solo espacios y saltos de línea colapsan enteros', () => {
    expect(analizar('   \n\n \n')).toEqual([])
  })
})

describe('caso 7 — varios bloques con contador corrido', () => {
  const r = analizar(
    [
      'Antes del ingreso:',
      '- Ayuno de ocho horas',
      '- Traer estudios recientes',
      '',
      'El día del procedimiento:',
      '- Presentarse a las 06:00 h',
      '- Acudir acompañado',
    ].join('\n'),
  )

  it('el contador corre entre bloques y no repite números', () => {
    expect(ordinales(r)).toEqual([1, 2, 3, 4])
    expect(new Set(ordinales(r)).size).toBe(ordinales(r).length)
  })

  it('los dos bloques quedan separados', () => {
    expect(r.map((n) => n.bloque)).toEqual([0, 0, 0, 1, 1, 1])
  })

  it('la línea vacía no produce nodo', () => {
    expect(r).toHaveLength(6)
  })
})

describe('viñetas reconocidas', () => {
  it.each(['-', '–', '—', '•', '*'])('«%s» abre ítem', (vineta) => {
    const r = analizar(`${vineta} Dieta blanda\n${vineta} Reposo relativo`)
    expect(tipos(r)).toEqual(['item', 'item'])
  })

  it('el prefijo numérico del dato se reconoce y se descarta: nunca dos numeraciones', () => {
    const r = analizar('1. Ayuno de ocho horas\n2) Traer estudios recientes')
    expect(tipos(r)).toEqual(['item', 'item'])
    expect(textos(r)).toEqual(['Ayuno de ocho horas', 'Traer estudios recientes'])
    expect(ordinales(r)).toEqual([1, 2])
  })

  it('una viñeta sin espacio detrás no es viñeta: prosa, que es el lado seguro', () => {
    const r = analizar('—dijo el paciente al ingresar\n—y lo repitió al alta')
    expect(tipos(r)).toEqual(['parrafo', 'parrafo'])
  })

  it('la numeración del dato tampoco reordena: el ordinal lo pone el sistema', () => {
    const r = analizar('3. Primero esto\n7. Después esto otro')
    expect(ordinales(r)).toEqual([1, 2])
  })
})

describe('degradación segura', () => {
  it('dos líneas que el dato separó nunca se juntan en un párrafo', () => {
    const r = analizar('Primera línea de prosa.\nSegunda línea de prosa.\nTercera línea de prosa.')
    expect(r).toHaveLength(3)
    expect(textos(r)).toEqual([
      'Primera línea de prosa.',
      'Segunda línea de prosa.',
      'Tercera línea de prosa.',
    ])
  })

  it('con saltos de Windows se comporta igual', () => {
    const r = analizar('Indicaciones:\r\n- Dieta blanda\r\n- Reposo relativo')
    expect(tipos(r)).toEqual(['encabezado', 'item', 'item'])
  })

  it('un texto sin ninguna estructura sigue saliendo entero y en orden', () => {
    const entrada = 'a\nb\nc\nd'
    expect(textos(analizar(entrada))).toEqual(['a', 'b', 'c', 'd'])
  })
})
