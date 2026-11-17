/**
 * plantillaCita.test.ts — tanda G1, punto 4: los correos de cita (código,
 * comprobante y recordatorio) salen del MISMO armado, con la marca en el HTML
 * y en el texto, botones anchos «a prueba de balas» con enlace absoluto, el
 * consultorio con su dirección COMPLETA (punto 2), legibles sin imágenes y sin
 * nada clínico.
 */
import { describe, it, expect } from 'vitest'
import { correoCodigo, correoComprobante } from '@/lib/reserva/correosReserva'
import { correoRecordatorio } from '@/lib/confirmacion/correosCita'
import { fechaDeCorreo, htmlCorreoCita, urlSegura } from '@/lib/correo/plantillaCita'

const URL_CONF = 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv'
const DIRECCION = 'Calle Ficticia 1, Centro, Mérida, Yucatán, C.P. 97000'
const comprobante = () => correoComprobante({
  medico: 'Dr. Admin Semilla Uno', consultorio: 'Consultorio Centro', direccion: DIRECCION, telefono: '9990000001',
  inicio: '2026-11-13T16:45:00.000Z', zona: 'America/Merida', urlConfirmacion: URL_CONF,
})
const recordatorio = (confirmada = false) => correoRecordatorio({
  inicio: '2026-11-13T16:45:00.000Z', zona: 'America/Merida', medico: 'Dr. Admin Semilla Uno',
  consultorio: { nombre: 'Consultorio Centro', direccion: DIRECCION, telefono: '9990000001' }, confirmada, url: URL_CONF,
})
const TODOS = () => ({ codigo: correoCodigo('Dr. Admin Semilla Uno', '482913'), comprobante: comprobante(), recordatorio: recordatorio() })

/** El HTML sin etiquetas: lo que se lee con las imágenes bloqueadas. */
const leible = (html: string) => html.replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('los tres correos comparten el armado', () => {
  /* Tanda I, punto 21: la marca de arriba es el MÉDICO (y el consultorio, si
     lo hay); Spinus sólo queda pequeño al pie. */
  it('llevan arriba el nombre del médico, en el HTML (como texto) y en el texto plano, y Spinus al pie', () => {
    for (const c of Object.values(TODOS())) {
      // Lo primero que se lee del cuerpo (tras el preencabezado oculto) es el médico.
      const cuerpo = c.html.slice(c.html.indexOf('</div>', c.html.indexOf('<body')) + 6)
      expect(leible(cuerpo).trim().startsWith('Dr. Admin Semilla Uno')).toBe(true)
      expect(c.texto.startsWith('Dr. Admin Semilla Uno\n')).toBe(true)
      expect(c.texto.endsWith('Enviado con Spinus')).toBe(true)
      expect(c.remitente).toBe('Dr. Admin Semilla Uno')
    }
  })
  it('sin médico, la cabecera vuelve a ser «Spinus» y no hay pie', () => {
    const html = htmlCorreoCita({ preencabezado: 'pre', titulo: 'T', parrafos: ['p'] })
    expect(leible(html)).toContain('Spinus')
    expect(html).not.toContain('Enviado con Spinus')
  })
  it('el nombre del médico va escapado en la cabecera', () => {
    const c = correoCodigo('Dr. <b>Raro</b> & "Cía"', '482913', { consultorio: 'Sala <1>' })
    expect(c.html).toContain('Dr. &lt;b&gt;Raro&lt;/b&gt; &amp; &quot;Cía&quot;')
    expect(c.html).toContain('Sala &lt;1&gt;')
    expect(c.html).not.toContain('<b>Raro</b>')
  })
  it('se leen sin imágenes: no llevan ninguna y caben en el teléfono', () => {
    for (const c of Object.values(TODOS())) {
      expect(c.html).not.toMatch(/<img|background-image|url\(/i)
      expect(c.html).toContain('<meta name="viewport" content="width=device-width,initial-scale=1">')
    }
  })
  it('los botones son tablas con fondo y enlace absoluto, y la URL también va en el texto', () => {
    for (const c of [TODOS().comprobante, TODOS().recordatorio]) {
      expect(c.html).toMatch(/<td align="center" bgcolor="#1e5fa8"[^>]*><a href="https:\/\/[^"]+"/)
      expect(c.texto).toContain(URL_CONF)
    }
  })
  it('el consultorio va con su dirección completa en el HTML y en el texto', () => {
    for (const c of [TODOS().comprobante, TODOS().recordatorio]) {
      expect(leible(c.html)).toContain('Consultorio Centro')
      expect(leible(c.html)).toContain(DIRECCION)
      expect(c.texto).toContain(DIRECCION)
    }
  })
  it('nada clínico ni nada del paciente', () => {
    for (const c of Object.values(TODOS())) {
      const todo = `${c.asunto}\n${c.texto}\n${c.html}`
      for (const prohibido of ['Ortopedia', 'Consulta:', 'notas', 'Paciente', 'motivo', 'Tipo de cita']) expect(todo).not.toContain(prohibido)
    }
  })
})

describe('cada correo', () => {
  it('el código, en grande y como primer número de 6 cifras del texto', () => {
    const c = correoCodigo('Dr. X', '482913')
    expect(c.html).toMatch(/font:800 32px[^>]*>482913</)
    expect(/\b(\d{6})\b/.exec(c.texto)?.[1]).toBe('482913')
  })
  it('el comprobante: fecha grande con sólo la primera letra en mayúscula', () => {
    expect(leible(comprobante().html)).toContain('Viernes 13 de noviembre · 10:45 h')
    expect(fechaDeCorreo('2026-11-13T16:45:00.000Z', 'America/Merida')).toEqual({ dia: 'Viernes', resto: '13 de noviembre · 10:45 h' })
  })
  it('el recordatorio: «Confirmo» al enlace y «No podré asistir» al paso de cancelar (un GET que no escribe)', () => {
    const c = recordatorio()
    expect(c.html).toContain(`href="${URL_CONF}"`)
    expect(c.html).toContain(`href="${URL_CONF}?paso=cancelar"`)
    expect(leible(c.html)).toContain('Confirmo mi asistencia')
    const ya = recordatorio(true)
    expect(leible(ya.html)).not.toContain('Confirmo')
    expect(ya.html).toContain(`href="${URL_CONF}?paso=cancelar"`)
  })
  it('una URL que no es http(s) no se pinta como botón', () => {
    expect(urlSegura('javascript:alert(1)')).toBeNull()
    const html = htmlCorreoCita({ preencabezado: 'x', titulo: 't', botones: [{ texto: 'Mal', url: 'javascript:alert(1)' }] })
    expect(html).not.toContain('href=')
  })
})

/* Tanda H, punto 2 de Angel: los correos se muestran en claro, sin seguir el oscuro del sistema. */
describe('los correos, siempre en claro', () => {
  const htmls = () => [...Object.values(TODOS()).map(c => c.html), recordatorio(true).html, htmlCorreoCita({ preencabezado: 'p', titulo: 't' })]
  it('declaran color-scheme y supported-color-schemes en light', () => {
    for (const html of htmls()) {
      expect(html).toContain('<meta name="color-scheme" content="light">')
      expect(html).toContain('<meta name="supported-color-schemes" content="light">')
      expect(html).toMatch(/<style>:root\{color-scheme:light;supported-color-schemes:light\}<\/style>/)
      expect(html).toMatch(/<body style="[^"]*color-scheme:light/)
    }
  })
  it('no tienen ninguna regla para el modo oscuro', () => {
    for (const html of htmls()) {
      expect(html).not.toMatch(/prefers-color-scheme|color-scheme:\s*dark|content="[^"]*dark/i)
    }
  })
})

