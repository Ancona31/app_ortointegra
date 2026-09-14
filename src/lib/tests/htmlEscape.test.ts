import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/lib/htmlEscape'

describe('escapeHtml — los cinco caracteres', () => {
  it('escapa el ampersand', () => {
    expect(escapeHtml('Salud & Vida')).toBe('Salud &amp; Vida')
  })

  it('escapa el menor que', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b')
  })

  it('escapa el mayor que', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('escapa la comilla doble', () => {
    expect(escapeHtml('dice "hola"')).toBe('dice &quot;hola&quot;')
  })

  it('escapa la comilla simple', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien')
  })
})

describe('escapeHtml — el orden del ampersand', () => {
  /* ⚠️ ESTA ES LA PRUEBA QUE IMPORTA. Con reemplazos encadenados en el orden
     equivocado —`.replace('<','&lt;')` y DESPUÉS `.replace('&','&amp;')`— el
     segundo pase reescribe los ampersands que acaba de meter el primero y sale
     `&amp;lt;`: texto roto y escape inservible. El barrido único con tabla lo
     hace imposible por construcción; esto lo deja clavado ante una reescritura
     futura que vuelva a los encadenados. */
  it('un menor que NO se convierte en &amp;lt;', () => {
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('<')).not.toContain('&amp;lt;')
  })

  it('ampersand y menor que juntos se escapan una sola vez cada uno', () => {
    expect(escapeHtml('&<')).toBe('&amp;&lt;')
  })

  it('el orden inverso da el mismo resultado', () => {
    expect(escapeHtml('<&')).toBe('&lt;&amp;')
  })

  it('una entidad ya escapada se vuelve a escapar, no se interpreta', () => {
    // escapeHtml NO es idempotente y no debe serlo: recibe texto plano, no HTML.
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('los cinco caracteres mezclados salen cada uno con su entidad', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('escapeHtml — el caso que motivó la función', () => {
  /* El nombre del hallazgo: lo escribe quien se registra y acaba interpolado en
     el correo de confirmación, que va firmado con DKIM por mail.spinus.com.mx. */
  const nombreHostil = `Doctor</strong></p><p><a href="https://evil.tld">Verifica tu cuenta aquí</a>`

  it('no deja ninguna etiqueta viva', () => {
    const salida = escapeHtml(nombreHostil)
    expect(salida).not.toContain('</strong>')
    expect(salida).not.toContain('<p>')
    expect(salida).not.toContain('<a href=')
    expect(salida).not.toContain('</a>')
    // Ni un solo delimitador de etiqueta sobrevive.
    expect(salida).not.toContain('<')
    expect(salida).not.toContain('>')
  })

  it('neutraliza el href del enlace de phishing', () => {
    const salida = escapeHtml(nombreHostil)
    expect(salida).not.toContain('href="https://evil.tld"')
    expect(salida).toContain('&quot;https://evil.tld&quot;')
  })

  it('conserva el texto legible del nombre', () => {
    // Escapar no censura: el destinatario sigue viendo lo que se escribió.
    expect(escapeHtml(nombreHostil)).toContain('Doctor')
    expect(escapeHtml(nombreHostil)).toContain('Verifica tu cuenta aquí')
  })

  it('el resultado completo es el esperado, carácter por carácter', () => {
    expect(escapeHtml(nombreHostil)).toBe(
      'Doctor&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;&lt;a href=&quot;https://evil.tld&quot;&gt;' +
      'Verifica tu cuenta aquí&lt;/a&gt;',
    )
  })
})

describe('escapeHtml — texto que no necesita escape', () => {
  it('la cadena vacía devuelve cadena vacía', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('un nombre corriente sale idéntico', () => {
    expect(escapeHtml('Angel Ancona')).toBe('Angel Ancona')
  })

  it('acentos, eñes y diéresis salen intactos', () => {
    expect(escapeHtml('José María Peña Güemes')).toBe('José María Peña Güemes')
  })

  it('signos que no son de los cinco salen intactos', () => {
    expect(escapeHtml('Dr. Ruiz-Pérez (Traumatología) #1 · 50%')).toBe(
      'Dr. Ruiz-Pérez (Traumatología) #1 · 50%',
    )
  })
})

describe('escapeHtml — volumen', () => {
  it('escapa una cadena larga con muchos caracteres a escapar', () => {
    const patron = `&<>"'`
    const entrada = patron.repeat(2000)          // 10 000 caracteres, todos a escapar
    const salida = escapeHtml(entrada)

    expect(salida).toBe('&amp;&lt;&gt;&quot;&#39;'.repeat(2000))
    expect(salida).not.toContain('<')
    expect(salida).not.toContain('>')
    // Ningún ampersand quedó sin convertir en entidad: tantos `&amp;` como `&`
    // originales, y ninguna entidad doblemente escapada.
    expect(salida.match(/&amp;/g)).toHaveLength(2000)
    expect(salida).not.toContain('&amp;amp;')
    expect(salida).not.toContain('&amp;lt;')
  })

  it('mantiene el texto legible intercalado en una cadena larga', () => {
    const entrada = ('nombre<script>' as string).repeat(500)
    const salida = escapeHtml(entrada)
    expect(salida).not.toContain('<script>')
    expect(salida.match(/nombre/g)).toHaveLength(500)
  })
})
