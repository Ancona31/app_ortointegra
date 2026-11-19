/**
 * correosReserva.test.ts — el correo del CÓDIGO (maqueta
 * `correo-codigo-reserva.html`), el COMPROBANTE de la reserva (maqueta
 * `correo-cita-paciente.html`, con «Cita agendada») y el aviso A LA CLÍNICA
 * (mismo esqueleto). Tanda M, M5 puntos 10, 11, 13 y 14.
 *
 * MUTACIONES (vistas en rojo): el código con espacios (`709 959`) en el bloque
 * → «sin espacios, en el cuerpo y en la vista previa»; píldora «Cita
 * confirmada» en el comprobante → «Cita agendada»; quitar `paciente` de la
 * fila → «el nombre del paciente»; `llamada` sin teléfono → «sin dirección ni
 * teléfono»; añadir `?paso=confirmar` al botón del comprobante → «el enlace de
 * siempre».
 */
import { describe, it, expect } from 'vitest'
import { correoCodigo, correoComprobante, type DatosComprobante } from '@/lib/reserva/correosReserva'
import { correoReservaClinica } from '@/lib/reserva/correoClinicaReserva'

const leible = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const vistaPrevia = (html: string): string => /<div style="display:none[^"]*">([^<]*)<\/div>/.exec(html)?.[1] ?? ''
/** Las partes, en este orden, en el texto dado. */
function enOrden(texto: string, partes: string[]): void {
  let desde = 0
  for (const parte of partes) {
    const i = texto.indexOf(parte, desde)
    expect(i, parte).toBeGreaterThanOrEqual(desde)
    desde = i + parte.length
  }
}

const URL_CODIGO = 'https://spinus.prueba/reservar/fijo0000000000000000000?origen=x#codigo=012345'
const URL_CONF = 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv'
const COMPROBANTE: DatosComprobante = {
  medico: 'Dr. Admin Semilla Uno', consultorio: 'Consultorio Centro', direccion: 'Calle Ficticia 1, Centro, Mérida', telefono: '9990000001',
  inicio: '2026-11-20T14:00:00.000Z', zona: 'America/Merida', paciente: 'Ana Sofía Pech', urlConfirmacion: URL_CONF,
}

describe('el correo del código (punto 10)', () => {
  const c = () => correoCodigo('Dr. Admin Semilla Uno', '012345', { consultorio: 'Consultorio Centro', url: URL_CODIGO })
  it('sigue la maqueta: título, instrucción, código, vigencia, botón, nota, seguridad y pie', () => {
    enOrden(leible(c().html), ['Consultorio Centro', 'Dr. Admin Semilla Uno', 'Tu código para reservar',
      'Escribe este código en la página de reserva para continuar con tu cita.', '012345', 'Vence en 10 minutos',
      'Continuar mi reserva', '¿Cerraste la página? Este botón te regresa a tu reserva.',
      'No compartas este código con nadie; el consultorio nunca te lo pedirá.', 'Si no lo solicitaste, ignora este correo.', 'Enviado con Spinus'])
  })
  it('el código SIN espacios, en el cuerpo (el espaciado es CSS), en la vista previa y en el texto', () => {
    expect(c().html).toMatch(/letter-spacing:12px[^>]*><span style="padding-left:12px">012345<\/span>/)
    expect(vistaPrevia(c().html)).toBe('Tu código es 012345. Vence en 10 minutos.')
    expect(c().texto).toContain('Tu código es 012345.')
    expect(/\b(\d{6})\b/.exec(c().texto)?.[1]).toBe('012345')
    expect(c().asunto).toBe('Tu código para reservar: 012345')
  })
  it('«Continuar mi reserva» conserva su enlace, con el código en el fragmento; sin URL, ni botón ni nota', () => {
    expect(c().html).toContain(`<a href="${URL_CODIGO}"`)
    expect(c().texto).toContain(`Continuar mi reserva: ${URL_CODIGO}`)
    const sin = correoCodigo('Dr. X', '012345')
    expect(sin.html).not.toContain('href=')
    expect(`${sin.html}${sin.texto}`).not.toContain('Cerraste')
  })
  it('a nombre del médico, escapado; sin saludo y nada de la persona', () => {
    const raro = correoCodigo('Dr. <b>Raro</b> & "Cía"', '012345', { consultorio: 'Sala <1>' })
    expect(raro.html).toContain('Dr. &lt;b&gt;Raro&lt;/b&gt; &amp; &quot;Cía&quot;')
    expect(raro.html).toContain('Sala &lt;1&gt;')
    expect(raro.html).not.toContain('<b>Raro')
    expect(raro.remitente).toBe('Dr. <b>Raro</b> & "Cía"')
    expect(`${c().texto}${c().html}`).not.toMatch(/Hola|Paciente/)
  })
})

describe('el comprobante de la reserva (punto 11)', () => {
  it('sigue la maqueta: «✓ Cita agendada», saludo, fecha con zona, detalles con el paciente, botón, «Para tu consulta» y el recuadro', () => {
    const c = correoComprobante(COMPROBANTE)
    enOrden(leible(c.html), ['Consultorio Centro', 'Dr. Admin Semilla Uno', 'Cita agendada', 'Hola, Ana Sofía Pech:',
      'Tu cita quedó registrada. Aquí tienes los datos para que la tengas a la mano.', 'Viernes', '20 de noviembre',
      '08:00 h', 'hora de Yucatán', 'Médico Dr. Admin Semilla Uno', 'Consultorio Consultorio Centro',
      'Dirección Calle Ficticia 1, Centro, Mérida', 'Paciente Ana Sofía Pech', 'Confirmar o cancelar mi cita', 'Para tu consulta',
      'Llega 10 minutos antes de tu hora.', 'Trae una identificación oficial.',
      'Si tienes estudios previos (radiografías, resonancias, análisis) o recetas de tus medicamentos actuales, tráelos.',
      '¿No puedes asistir?', 'Avísanos con anticipación para darle el espacio a otro paciente.', 'Llámanos o escríbenos al 999 000 0001',
      'Enviado con Spinus'])
    expect(c.html).toContain('&#10003;&nbsp; Cita agendada')
    expect(c.html).not.toMatch(/Cita confirmada|Pendiente de confirmar/)
    expect(vistaPrevia(c.html)).toBe('Tu cita con Dr. Admin Semilla Uno es el viernes 20 de noviembre de 2026 a las 08:00 h.')
    expect(c.asunto).toBe('Tu cita con Dr. Admin Semilla Uno')
    expect(c.remitente).toBe('Dr. Admin Semilla Uno')
  })
  it('el enlace de siempre, tal cual, en el botón y en el texto', () => {
    const c = correoComprobante(COMPROBANTE)
    expect(c.html).toContain(`<a href="${URL_CONF}" target="_blank"`)
    expect(c.html).not.toContain('?paso=')
    expect(c.texto).toContain(`Para confirmar tu asistencia o avisar que no podrás ir, usa este enlace:\n${URL_CONF}\n`)
  })
  it('sin dirección ni teléfono, la fila y la frase desaparecen enteras; sin nombre, «Hola:» y sin fila «Paciente»', () => {
    const c = correoComprobante({ ...COMPROBANTE, direccion: null, telefono: '  ', paciente: null })
    expect(`${leible(c.html)}\n${c.texto}`).not.toMatch(/Dirección|Llámanos|tel:|Paciente /)
    expect(c.html).toMatch(/<h1[^>]*>Hola:<\/h1>/)
    expect(c.texto).toContain('¿No puedes asistir? Avísanos con anticipación para darle el espacio a otro paciente.\n')
  })
  it('sin enlace (o uno que no es http), «comunícate con el consultorio» y ningún botón', () => {
    for (const u of [null, 'javascript:alert(1)']) {
      const c = correoComprobante({ ...COMPROBANTE, urlConfirmacion: u })
      expect(c.texto).toContain('Para cambiar o cancelar, comunícate con el consultorio.')
      expect(c.html).not.toMatch(/href="(?!tel:)/)
    }
  })
  it('nada clínico ni de la clínica; todo escapado', () => {
    const c = correoComprobante({ ...COMPROBANTE, paciente: '<i>Ana</i> & "B"', direccion: 'C/ <1>' })
    expect(c.html).toContain('Hola, &lt;i&gt;Ana&lt;/i&gt; &amp; &quot;B&quot;:')
    expect(c.html).toContain('C/ &lt;1&gt;')
    expect(c.html).not.toMatch(/<i>Ana|<1>/)
    const todo = `${c.asunto}\n${c.texto}\n${c.html}`
    for (const prohibido of ['Clínica', 'Tipo de cita', 'Ortopedia', 'notas', 'motivo', 'diagn']) expect(todo).not.toContain(prohibido)
  })
})

describe('el aviso a la clínica (punto 13)', () => {
  const r = { nombre: 'Ana Sofía Pech', medico: 'Dr. Admin Semilla Uno', consultorio: 'Consultorio Centro', inicio: COMPROBANTE.inicio, zona: 'America/Merida' }
  it('el mismo esqueleto: cabecera, píldora, fecha con zona, detalles y la razón; el remitente sigue siendo Spinus', () => {
    const c = correoReservaClinica({ ...r, reagendada: false })
    enOrden(leible(c.html), ['Consultorio Centro', 'Dr. Admin Semilla Uno', 'Reserva nueva', 'Reserva nueva por enlace',
      'Ana Sofía Pech reservó una cita para el', '08:00 h', 'hora de Yucatán', 'Paciente Ana Sofía Pech', 'Médico Dr. Admin Semilla Uno',
      'Recibes este correo porque', 'Enviado con Spinus'])
    expect(c.remitente).toBe('')
    expect(leible(correoReservaClinica({ ...r, reagendada: true }).html)).toContain('Cita reagendada')
  })
  it('escapa el nombre que escribió quien reservó', () => {
    const c = correoReservaClinica({ ...r, nombre: '<script>x</script>', reagendada: false })
    expect(c.html).not.toContain('<script>')
    expect(c.html).toContain('&lt;script&gt;')
  })
})
