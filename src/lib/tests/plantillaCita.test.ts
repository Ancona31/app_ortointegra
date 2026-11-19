/**
 * plantillaCita.test.ts — el esqueleto de los correos de la agenda (tanda M,
 * M5, puntos 9 y 14): cabecera con el consultorio y el médico, bloques de la
 * maqueta, pie «Enviado con Spinus», colores de la app, siempre en claro, todo
 * escapado, filas y frases que desaparecen enteras sin su dato, y la zona de
 * la hora («hora de Yucatán»). Lo de cada correo, en `correosCita.test.ts` y
 * `correosReserva.test.ts`.
 *
 * MUTACIONES (vistas en rojo): quitar `escapeHtml` de `datosHtml` → «escapa
 * cada bloque»; quitar el `filter` de filas vacías → «una fila sin dato
 * desaparece»; volver a la `llamadaHtml` sin la guarda del teléfono → «la frase
 * del teléfono desaparece»; quitar 'America/Cancun' de `HORA_DE_ZONA` → «todas
 * las zonas de México»; poner '#2b63a6' (el de la maqueta) en `C.marca` →
 * «colores de la app»; añadir `@media (prefers-color-scheme: dark)` → «en
 * claro».
 */
import { describe, it, expect } from 'vitest'
import {
  fechaDeCorreo, horaDeZona, htmlCorreoCita, textoCorreoCita, urlSegura, zonaValida, type BloqueCorreo, type CorreoArmado,
} from '@/lib/correo/plantillaCita'
import { ZONAS_MEXICO } from '@/lib/consultorios/zonas-mexico'

/** El HTML sin etiquetas: lo que se lee con las imágenes bloqueadas. */
const leible = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
/** El texto oculto de la vista previa. */
const vistaPrevia = (html: string): string => /<div style="display:none[^"]*">([^<]*)<\/div>/.exec(html)?.[1] ?? ''
/** Lo que se lee del cuerpo, tras la vista previa oculta. */
const cuerpoDe = (html: string): string => leible(html.slice(html.indexOf('</div>', html.indexOf('<body')) + 6)).trim()

const RARO = '<b>x</b> & "y"'
const RARO_ESCAPADO = '&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;'

const TODOS_LOS_BLOQUES = (v: string): BloqueCorreo[] => [
  { tipo: 'entrada', pildora: { texto: v }, encabezado: v, parrafos: [v] },
  { tipo: 'fecha', fecha: { dia: v, fecha: v, hora: v, zona: v } },
  { tipo: 'codigo', codigo: v, vigencia: v },
  { tipo: 'botones', antes: v, botones: [{ texto: v, url: 'https://x.mx/a' }], nota: [v], llamada: { frase: v, telefono: v } },
  { tipo: 'datos', filas: [{ etiqueta: v, valor: v }] },
  { tipo: 'lista', titulo: v, puntos: [v] },
  { tipo: 'recuadro', fuerte: v, texto: v },
  { tipo: 'aviso', lineas: [v] },
]
const armado = (o: Partial<CorreoArmado> = {}): CorreoArmado =>
  ({ preencabezado: 'pre', titulo: 'T', marca: { medico: 'Dr. Uno', consultorio: 'Consultorio Centro' }, bloques: [], ...o })

describe('cabecera y pie', () => {
  it('arriba el consultorio y el médico (en el HTML como texto, y en el texto plano), abajo «Enviado con Spinus»', () => {
    const c = armado({ bloques: [{ tipo: 'entrada', encabezado: 'Hola:' }] })
    const html = htmlCorreoCita(c)
    const cuerpo = cuerpoDe(html)
    expect(cuerpo.startsWith('Consultorio Centro Dr. Uno Hola:')).toBe(true)
    expect(html).toMatch(/<td bgcolor="#163250"[^>]*>.*Consultorio Centro.*Dr\. Uno/)
    expect(cuerpo.endsWith('Este es un mensaje automático; por favor no respondas a este correo. Enviado con Spinus')).toBe(true)
    expect(textoCorreoCita(c)).toBe('Dr. Uno\nConsultorio Centro\n\nHola:\n\nEste es un mensaje automático; por favor no respondas a este correo.\nEnviado con Spinus')
  })
  it('sin consultorio, sólo el médico; sin médico, «Spinus»; el pie, siempre', () => {
    const sinConsultorio = htmlCorreoCita(armado({ marca: { medico: 'Dr. Uno', consultorio: '  ' } }))
    expect(sinConsultorio).not.toContain('text-transform:uppercase;color:#96a3b0')
    const sinMedico = armado({ marca: { medico: ' ' } })
    expect(cuerpoDe(htmlCorreoCita(sinMedico))).toMatch(/^Spinus Este es un mensaje/)
    expect(textoCorreoCita(sinMedico).startsWith('Spinus\n\n')).toBe(true)
    expect(textoCorreoCita(armado({ marca: { medico: '', consultorio: 'Sala 1' } })).startsWith('Spinus\nSala 1\n\n')).toBe(true)
    expect(htmlCorreoCita(sinMedico)).toContain('Enviado con <strong')
  })
  it('la vista previa va oculta y escapada', () => {
    const html = htmlCorreoCita(armado({ preencabezado: RARO }))
    expect(vistaPrevia(html)).toBe(RARO_ESCAPADO)
  })
})

describe('escapado y enlaces', () => {
  it('escapa cada bloque, la cabecera y el título; en el texto va tal cual', () => {
    const c = armado({ titulo: RARO, marca: { medico: RARO, consultorio: RARO }, bloques: TODOS_LOS_BLOQUES(RARO) })
    const html = htmlCorreoCita(c)
    expect(html).not.toContain('<b>x')
    // título, médico, consultorio, y en los bloques: píldora, h1, párrafo, día, fecha, hora, zona, código, vigencia,
    // antes, botón, nota, frase, teléfono, etiqueta, valor, título de lista, punto, fuerte, texto, aviso.
    expect(html.split(RARO_ESCAPADO).length - 1).toBe(24)
    expect(textoCorreoCita(c)).toContain(RARO)
  })
  it('sólo una URL http(s) sin espacios ni comillas entra a un href; si no, el botón no sale', () => {
    for (const mala of ['javascript:alert(1)', 'https://x.mx/"><b>', 'https://x .mx', 'data:text/html,x', '']) expect(urlSegura(mala)).toBeNull()
    expect(urlSegura('https://x.mx/confirmar/Ab_-?paso=confirmar')).toBe('https://x.mx/confirmar/Ab_-?paso=confirmar')
    const c = armado({ bloques: [{ tipo: 'botones', botones: [{ texto: 'Mal', url: 'javascript:alert(1)' }], nota: ['NOTA-VISIBLE'],
      llamada: { frase: 'Llámanos al', telefono: '9990000001' }, enTexto: ['Mal: javascript:alert(1)'] }] })
    expect(htmlCorreoCita(c)).not.toContain('href=')
    // Ni el botón, ni su nota, ni la frase del teléfono, en el HTML ni en el texto (aunque traiga `enTexto`).
    for (const parte of [htmlCorreoCita(c), textoCorreoCita(c)]) expect(parte).not.toMatch(/NOTA-VISIBLE|Llámanos|javascript/)
  })
  it('el teléfono de México se lee con espacios y se pulsa con sus 10 dígitos; otro, sin enlace', () => {
    const c = (telefono: string) => htmlCorreoCita(armado({ bloques: [{ tipo: 'datos', filas: [{ etiqueta: 'Teléfono', valor: telefono, telefono: true }] }] }))
    expect(c('+52 1 (999) 000-0001')).toContain('<a href="tel:9990000001" style="color:#1e5fa8;text-decoration:none">999 000 0001</a>')
    expect(c('ext. 12 "x"')).not.toContain('tel:')
    expect(c('ext. 12 "x"')).toContain('ext. 12 &quot;x&quot;')
  })
})

describe('lo que falta, desaparece entero', () => {
  it('una fila sin dato desaparece, en el HTML y en el texto, y la raya no queda colgando', () => {
    const c = armado({ bloques: [{ tipo: 'datos', filas: [
      { etiqueta: 'Médico', valor: 'Dr. Uno' }, { etiqueta: 'Dirección', valor: null }, { etiqueta: 'Teléfono', valor: '  ', telefono: true },
    ] }] })
    expect(leible(htmlCorreoCita(c))).not.toMatch(/Dirección|Teléfono/)
    expect(textoCorreoCita(c)).not.toMatch(/Dirección|Teléfono/)
    expect(htmlCorreoCita(c)).not.toContain(`border-bottom:1px solid #e7ecf3;color:#52627a`)
  })
  it('la frase del teléfono desaparece sin teléfono; con él, va en el HTML (pulsable) y en el texto', () => {
    const con = (telefono: string | null) => armado({ bloques: [{ tipo: 'recuadro', fuerte: '¿No puedes?', texto: 'Avísanos.', llamada: { frase: 'Llámanos al', telefono } }] })
    expect(leible(htmlCorreoCita(con(null)))).not.toContain('Llámanos')
    expect(textoCorreoCita(con(null))).toContain('¿No puedes? Avísanos.\n')
    expect(textoCorreoCita(con(null))).not.toContain('Llámanos')
    expect(htmlCorreoCita(con('9990000001'))).toContain('Llámanos al <a href="tel:9990000001"')
    expect(textoCorreoCita(con('9990000001'))).toContain('¿No puedes? Avísanos. Llámanos al 999 000 0001.')
  })
  it('un salto de línea dentro de un dato no fabrica renglones en el texto', () => {
    const c = armado({ bloques: [{ tipo: 'datos', filas: [{ etiqueta: 'Dirección', valor: 'Calle 1\nTeléfono: 000' }] }] })
    expect(textoCorreoCita(c)).toContain('Dirección: Calle 1 Teléfono: 000')
  })
  it('un bloque de datos sin ninguna fila no deja nada', () => {
    const c = armado({ bloques: [{ tipo: 'datos', filas: [{ etiqueta: 'Dirección', valor: '' }] }] })
    expect(htmlCorreoCita(c)).toBe(htmlCorreoCita(armado()))
  })
})

describe('la zona de la hora', () => {
  it('todas las zonas de México tienen su «hora de …»', () => {
    for (const z of ZONAS_MEXICO) expect(horaDeZona(z.value), z.value).toMatch(/^hora (de|del) /)
    expect(horaDeZona('America/Merida')).toBe('hora de Yucatán')
    expect(horaDeZona('America/Mexico_City')).toBe('hora del centro de México')
    expect(horaDeZona('America/Tijuana')).toBe('hora de Baja California')
  })
  it('una zona de fuera de México, como hasta hoy: «zona horaria: <IANA>»; una inválida, la de la clínica', () => {
    expect(horaDeZona('Europe/Madrid')).toBe('zona horaria: Europe/Madrid')
    expect(zonaValida('No/Existe')).toBe('America/Mexico_City')
    expect(zonaValida(null)).toBe('America/Mexico_City')
  })
  it('la fecha grande en la zona dada, con la zona junto a la hora, en el HTML y en el texto', () => {
    const f = fechaDeCorreo('2026-11-13T16:45:00.000Z', 'America/Merida')
    expect(f).toEqual({ dia: 'Viernes', fecha: '13 de noviembre', hora: '10:45 h', zona: 'hora de Yucatán', completa: 'viernes 13 de noviembre de 2026' })
    expect(fechaDeCorreo('2026-11-13T16:45:00.000Z', 'America/Cancun').hora).toBe('11:45 h')
    const c = armado({ bloques: [{ tipo: 'fecha', fecha: f }] })
    expect(htmlCorreoCita(c)).toMatch(/>10:45 h <span[^>]*>&nbsp;hora de Yucatán<\/span>/)
    expect(textoCorreoCita(c)).toContain('Fecha: viernes 13 de noviembre a las 10:45 h, hora de Yucatán.')
  })
})

describe('forma del correo', () => {
  const html = (): string => htmlCorreoCita(armado({ bloques: [
    ...TODOS_LOS_BLOQUES('v'), { tipo: 'botones', botones: [{ texto: 'No', url: 'https://x.mx/b', secundario: true }] },
  ] }))
  it('siempre en claro: color-scheme light y ninguna regla de modo oscuro', () => {
    expect(html()).toContain('<meta name="color-scheme" content="light">')
    expect(html()).toContain('<meta name="supported-color-schemes" content="light">')
    expect(html()).toMatch(/<body style="[^"]*color-scheme:light/)
    expect(html()).not.toMatch(/prefers-color-scheme|color-scheme:\s*dark|content="[^"]*dark/i)
  })
  it('tablas y estilos en línea, sin imágenes ni hojas externas; cabe en el teléfono', () => {
    expect(html()).not.toMatch(/<img|background-image|url\(|<link|display:\s*(flex|grid)|var\(--/i)
    expect(html()).toContain('<meta name="viewport" content="width=device-width,initial-scale=1">')
    expect(html()).toContain('max-width:600px')
    // El único <style> es la declaración de color-scheme.
    expect(html().match(/<style>/g)).toHaveLength(1)
  })
  it('los colores son los de la app, no los de la maqueta (CLAUDE.md regla 4: el acento es --cs #1e5fa8)', () => {
    for (const app of ['#163250', '#1e5fa8', '#e8f4fd', '#15243e', '#27364f', '#52627a', '#7c8aa0', '#eef1f5', '#e7ecf3', '#76849a', '#96a3b0']) {
      expect(html(), app).toContain(app)
    }
    for (const maqueta of ['#1c3551', '#2b63a6', '#e8f1fa', '#1a2438', '#3d4759', '#5b667a', '#7a8597', '#edf0f5', '#e6ebf3', '#cfd8e4', '#9fb6d3']) {
      expect(html(), maqueta).not.toContain(maqueta)
    }
  })
  it('integración M: el pie «Enviado con Spinus» contrasta al menos 4,5:1 con el fondo de la página', () => {
    const h = htmlCorreoCita(armado({}))
    const fondo = /<body[^>]*background-color:(#[0-9a-f]{6})/i.exec(h)?.[1] ?? /bgcolor="(#[0-9a-f]{6})"/i.exec(h)?.[1] ?? ''
    const pie = /color:(#[0-9a-f]{6})">[^<]*<br>Enviado con/i.exec(h)?.[1] ?? ''
    expect(fondo).toBe('#eef1f5')
    expect(pie).toBe('#52627a')
    const luz = (x: string): number => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const [a1, b1] = [luz(fondo), luz(pie)].sort((x, y) => y - x)
    expect((a1 + 0.05) / (b1 + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
  it('los botones son celdas con fondo y un enlace ancho; el secundario, blanco con borde', () => {
    const c = htmlCorreoCita(armado({ bloques: [{ tipo: 'botones', botones: [
      { texto: 'Sí', url: 'https://x.mx/a' }, { texto: 'No', url: 'https://x.mx/b', secundario: true },
    ] }] }))
    expect(c).toMatch(/<td align="center" bgcolor="#1e5fa8"[^>]*><a href="https:\/\/x\.mx\/a"[^>]*display:block[^>]*>Sí<\/a>/)
    expect(c).toMatch(/<td align="center" bgcolor="#ffffff" style="[^"]*border:1px solid #76849a;[^"]*"><a href="https:\/\/x\.mx\/b"/)
  })
})
