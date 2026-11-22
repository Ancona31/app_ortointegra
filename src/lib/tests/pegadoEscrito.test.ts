import { describe, expect, it } from 'vitest'
import {
  contarPalabras, enLinea, htmlPegadoAlEsquema, markdownAHtml, pareceMarkdown, renglonDeCeldas,
} from '@/lib/documentos/pegadoEscrito'

describe('markdown pegado como texto plano', () => {
  it('un texto sin Markdown no se toca', () => {
    expect(markdownAHtml('A quien corresponda:\n\nSe hace constar que el paciente acudió.')).toBeNull()
    expect(markdownAHtml('Dosis de 5 - 10 mg cada 8 h')).toBeNull()
    expect(pareceMarkdown('Una línea con *un asterisco suelto')).toBe(false)
  })
  it('títulos: # y ## → Título (h2); ### a ###### → Subtítulo (h3)', () => {
    expect(markdownAHtml('# Uno\n## Dos\n### Tres\n#### Cuatro\n###### Seis')).toBe(
      '<h2>Uno</h2><h2>Dos</h2><h3>Tres</h3><h3>Cuatro</h3><h3>Seis</h3>')
  })
  it('viñetas con -, * y +, y anidadas por sangría', () => {
    expect(markdownAHtml('- a\n* b\n  + b1\n    - b11\n- c')).toBe(
      '<ul><li><p>a</p></li><li><p>b</p><ul><li><p>b1</p><ul><li><p>b11</p></li></ul></li></ul></li><li><p>c</p></li></ul>')
  })
  it('numeradas con 1. y 1), respetando el inicio', () => {
    expect(markdownAHtml('3. tres\n4) cuatro')).toBe('<ol start="3"><li><p>tres</p></li><li><p>cuatro</p></li></ol>')
    expect(markdownAHtml('1. uno\n2. dos')).toBe('<ol><li><p>uno</p></li><li><p>dos</p></li></ol>')
  })
  it('una lista numerada con viñetas dentro', () => {
    expect(markdownAHtml('1. Uno\n   - detalle\n2. Dos')).toBe(
      '<ol><li><p>Uno</p><ul><li><p>detalle</p></li></ul></li><li><p>Dos</p></li></ol>')
  })
  it('cita de varios párrafos y separador', () => {
    expect(markdownAHtml('> uno\n> sigue\n>\n> dos\n\n---\n\nfin')).toBe(
      '<blockquote><p>uno sigue</p><p>dos</p></blockquote><hr><p>fin</p>')
  })
  it('negrita y cursiva en línea, escapando el HTML', () => {
    expect(enLinea('**Paciente** con *dolor* y <b>x</b> a_b_c')).toBe(
      '<strong>Paciente</strong> con <em>dolor</em> y &lt;b&gt;x&lt;/b&gt; a_b_c')
    expect(markdownAHtml('Hago constar que **Juan** acudió.')).toBe('<p>Hago constar que <strong>Juan</strong> acudió.</p>')
  })
  it('tablas Markdown → renglones «campo: valor» (dos columnas) o « · » (más)', () => {
    expect(markdownAHtml('| Campo | Valor |\n|---|---|\n| TA | 120/80 |\n| FC | 72 |')).toBe(
      '<p>Campo: Valor</p><p>TA: 120/80</p><p>FC: 72</p>')
    expect(markdownAHtml('| A | B | C |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |')).toBe('<p>A · B · C</p><p>1 · 2 · 3</p>')
  })
  it('bloques de código → texto llano, sin convertir lo de dentro', () => {
    expect(markdownAHtml('```\n## no es título\n- ni viñeta\n```\nfin')).toBe(
      '<p>## no es título</p><p>- ni viñeta</p><p>fin</p>')
  })
  it('un texto real estilo Gemini', () => {
    const gem = '## Certificado médico\n\nA quien corresponda:\n\nPor medio de la presente hago constar que **Paciente Prueba 01**, de 73 años, fue valorado.\n\n### Diagnóstico\n\n* Gonartrosis bilateral grado II\n* Sin datos de alarma\n\n### Indicaciones\n\n1. Reposo relativo por 7 días\n2. Analgésico en caso de dolor\n\n---\n\nSe extiende la presente a petición del interesado.'
    expect(markdownAHtml(gem)).toBe(
      '<h2>Certificado médico</h2><p>A quien corresponda:</p><p>Por medio de la presente hago constar que <strong>Paciente Prueba 01</strong>, de 73 años, fue valorado.</p>'
      + '<h3>Diagnóstico</h3><ul><li><p>Gonartrosis bilateral grado II</p></li><li><p>Sin datos de alarma</p></li></ul>'
      + '<h3>Indicaciones</h3><ol><li><p>Reposo relativo por 7 días</p></li><li><p>Analgésico en caso de dolor</p></li></ol>'
      + '<hr><p>Se extiende la presente a petición del interesado.</p>')
  })
  it('renglones seguidos de un párrafo conservan el salto', () => {
    expect(markdownAHtml('## T\nlínea uno\nlínea dos')).toBe('<h2>T</h2><p>línea uno<br>línea dos</p>')
  })
})

describe('HTML pegado: tablas y h4–h6', () => {
  it('una tabla de dos columnas → «campo: valor», con marcas', () => {
    const html = '<p>antes</p><table><thead><tr><th>Signo</th><th>Valor</th></tr></thead><tbody><tr><td><b>TA</b></td><td>120/80</td></tr><tr><td>FC</td><td><span>72</span> lpm</td></tr></tbody></table><p>después</p>'
    expect(htmlPegadoAlEsquema(html)).toBe('<p>antes</p><p>Signo: Valor</p><p><b>TA</b>: 120/80</p><p>FC: 72 lpm</p><p>después</p>')
  })
  it('tres columnas → « · »; filas vacías fuera', () => {
    expect(htmlPegadoAlEsquema('<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td></td><td> </td></tr></table>')).toBe('<p>a · b · c</p>')
  })
  it('h4–h6 → h3 (Subtítulo); h1–h3 intactos', () => {
    expect(htmlPegadoAlEsquema('<h1>a</h1><h3>b</h3><h4 style="x">c</h4><h6>d</h6>')).toBe('<h1>a</h1><h3>b</h3><h3 style="x">c</h3><h3>d</h3>')
  })
  it('sin tablas ni h4–h6, igual', () => {
    const h = '<h2>T</h2><ul><li>x</li></ul><blockquote><p>c</p></blockquote>'
    expect(htmlPegadoAlEsquema(h)).toBe(h)
  })
  it('renglonDeCeldas', () => {
    expect(renglonDeCeldas(['a', 'b'])).toBe('a: b')
    expect(renglonDeCeldas(['', 'b'])).toBe('b')
  })
})

describe('contador de palabras', () => {
  it('cuenta palabras y no signos sueltos', () => {
    expect(contarPalabras('Uno dos — tres, 4 ')).toBe(4)
    expect(contarPalabras('   ')).toBe(0)
  })
})
