import { describe, it, expect } from 'vitest'
import { parseNota } from '@/lib/notaParser'

describe('parseNota — entradas vacías', () => {
  it('cadena vacía → sin secciones', () => {
    expect(parseNota('')).toEqual({ secciones: [] })
  })

  it('null → sin secciones', () => {
    expect(parseNota(null)).toEqual({ secciones: [] })
  })

  it('undefined → sin secciones', () => {
    expect(parseNota(undefined)).toEqual({ secciones: [] })
  })

  it('solo espacios en blanco → sin secciones', () => {
    expect(parseNota('   \n  \n ')).toEqual({ secciones: [] })
  })
})

describe('parseNota — 7 tipos de sección G3-G6', () => {
  const casos: Array<[string, string]> = [
    ['**[SUBJETIVO]:**', 'subjetivo'],
    ['**[OBJETIVO]:**', 'objetivo'],
    ['**[AUXILIARES DX]:**', 'auxiliares_dx'],
    ['**[ANÁLISIS]:**', 'analisis'],
    ['**[DIAGNÓSTICO]:**', 'diagnostico'],
    ['**[PLAN]:**', 'plan'],
    ['**[PRONÓSTICO]:**', 'pronostico'],
  ]

  it.each(casos)('%s → tipo correcto', (encabezado, tipoEsperado) => {
    const r = parseNota(`${encabezado}\ncontenido`)
    expect(r.secciones).toHaveLength(1)
    expect(r.secciones[0].tipo).toBe(tipoEsperado)
  })

  it('AUXILIARES DIAGNÓSTICOS (forma larga) también mapea a auxiliares_dx', () => {
    const r = parseNota('**[AUXILIARES DIAGNÓSTICOS]:**\nRx')
    expect(r.secciones[0].tipo).toBe('auxiliares_dx')
  })
})

describe('parseNota — variantes de sintaxis del encabezado', () => {
  it('1 vs 2 asteriscos producen el mismo tipo', () => {
    const dos = parseNota('**[PLAN]:**\nreposo')
    const uno = parseNota('*[PLAN]*\nreposo')
    expect(dos.secciones[0].tipo).toBe('plan')
    expect(uno.secciones[0].tipo).toBe('plan')
  })

  it('encabezado sin dos puntos se reconoce igual', () => {
    const r = parseNota('*[PLAN]\nreposo')
    expect(r.secciones[0].tipo).toBe('plan')
    expect(r.secciones[0].bloques[0].spans[0].texto).toBe('reposo')
  })

  it('texto en la misma línea del encabezado = primer bloque', () => {
    const r = parseNota('**[SUBJETIVO]:** refiere dolor lumbar')
    expect(r.secciones[0].tipo).toBe('subjetivo')
    expect(r.secciones[0].bloques).toHaveLength(1)
    expect(r.secciones[0].bloques[0].spans[0].texto).toBe('refiere dolor lumbar')
  })

  it('encabezado no reconocido → desconocida conservando el título original', () => {
    const r = parseNota('**[NOTAS EXTRA]:**\nalgo')
    expect(r.secciones[0].tipo).toBe('desconocida')
    expect(r.secciones[0].titulo).toBe('NOTAS EXTRA')
  })
})

describe('parseNota — encabezados G2 legacy (SOAP)', () => {
  it('S/O/A/P (paréntesis normal) mapean por letra', () => {
    const r = parseNota('**S (Subjetivo):**\na\n**O (Objetivo):**\nb\n**A (Análisis):**\nc\n**P (Plan):**\nd')
    expect(r.secciones.map((s) => s.tipo)).toEqual(['subjetivo', 'objetivo', 'analisis', 'plan'])
  })

  it('case-insensitive', () => {
    const r = parseNota('**s (subjetivo):**\nhola')
    expect(r.secciones[0].tipo).toBe('subjetivo')
  })

  it('paréntesis fullwidth U+FF08', () => {
    const r = parseNota('**O （Objetivo）:**\nTA 120/80')
    expect(r.secciones[0].tipo).toBe('objetivo')
  })

  it('Pronostico sin acento', () => {
    const r = parseNota('**Pronostico:**\nfavorable')
    expect(r.secciones[0].tipo).toBe('pronostico')
  })

  it('Pronóstico con acento', () => {
    const r = parseNota('**Pronóstico:**\nreservado')
    expect(r.secciones[0].tipo).toBe('pronostico')
  })

  it('bold que NO es encabezado G2 se trata como cuerpo', () => {
    const r = parseNota('**Importante:** vigilar signos')
    expect(r.secciones[0].tipo).toBe('desconocida')
    expect(r.secciones[0].titulo).toBe('')
    const spans = r.secciones[0].bloques[0].spans
    expect(spans[0]).toEqual({ texto: 'Importante:', bold: true })
    expect(spans[1]).toEqual({ texto: ' vigilar signos', bold: false })
  })
})

describe('parseNota — cuerpo: párrafos, items y negritas', () => {
  it('líneas "- " producen bloques item sin el guion', () => {
    const r = parseNota('**[PLAN]:**\n- Reposo relativo\n- Analgésico')
    const bloques = r.secciones[0].bloques
    expect(bloques).toHaveLength(2)
    expect(bloques[0].tipo).toBe('item')
    expect(bloques[0].spans[0].texto).toBe('Reposo relativo')
    expect(bloques[1].tipo).toBe('item')
  })

  it('negrita multi-span dentro de un párrafo', () => {
    const r = parseNota('**[OBJETIVO]:**\nPeso **80 kg** y talla **1.75 m** hoy')
    const spans = r.secciones[0].bloques[0].spans
    expect(spans).toEqual([
      { texto: 'Peso ', bold: false },
      { texto: '80 kg', bold: true },
      { texto: ' y talla ', bold: false },
      { texto: '1.75 m', bold: true },
      { texto: ' hoy', bold: false },
    ])
  })

  it('líneas vacías separan bloques (no generan bloques vacíos)', () => {
    const r = parseNota('**[SUBJETIVO]:**\nlinea uno\n\nlinea dos')
    expect(r.secciones[0].bloques).toHaveLength(2)
    expect(r.secciones[0].bloques[0].spans[0].texto).toBe('linea uno')
    expect(r.secciones[0].bloques[1].spans[0].texto).toBe('linea dos')
  })
})

describe('parseNota — fallback sin encabezados', () => {
  it('texto plano sin encabezados → una sección desconocida con titulo ""', () => {
    const r = parseNota('Solo texto libre del médico.')
    expect(r.secciones).toHaveLength(1)
    expect(r.secciones[0].tipo).toBe('desconocida')
    expect(r.secciones[0].titulo).toBe('')
    expect(r.secciones[0].bloques[0].spans[0].texto).toBe('Solo texto libre del médico.')
  })

  it('texto antes del primer encabezado va a una sección desconocida inicial', () => {
    const r = parseNota('preludio\n**[PLAN]:**\nreposo')
    expect(r.secciones).toHaveLength(2)
    expect(r.secciones[0].tipo).toBe('desconocida')
    expect(r.secciones[0].titulo).toBe('')
    expect(r.secciones[1].tipo).toBe('plan')
  })

  it('addendum típico (sin encabezados) → desconocida', () => {
    const r = parseNota('Se corrige la dosis del analgésico a 1 tableta cada 8 horas.')
    expect(r.secciones).toHaveLength(1)
    expect(r.secciones[0].tipo).toBe('desconocida')
  })
})
