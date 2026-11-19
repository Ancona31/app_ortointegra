/**
 * correosCita.test.ts — confirmación, recordatorio y aviso de cambio (E4, G3,
 * I9), con la maqueta `correo-confirmar-cita.html` (tanda M, M5 puntos 12 a
 * 14): píldora de estado, «Hola, nombre:» u «Hola:», fecha con «hora de …»,
 * «Confirmo mi asistencia» y «No podré asistir» con sus enlaces de siempre, el
 * plazo y el teléfono, detalles, nada clínico, todo escapado, deterministas.
 *
 * MUTACIONES (vistas en rojo): quitar `?paso=confirmar` del primer botón →
 * «los enlaces de siempre»; píldora fija «Pendiente de confirmar» también en la
 * confirmada → «la píldora dice el estado»; quitar `saludoDe(nombre)` de
 * `correoConfirmacion` → «saluda por el nombre»; `llamada` sin teléfono en la
 * plantilla → «sin teléfono ni dirección»; zona fija 'hora del centro de
 * México' → «la zona del consultorio manda».
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { correoCambio, correoConfirmacion, correoRecordatorio, PLAZO_CANCELAR, type DatosRecordatorio } from '@/lib/confirmacion/correosCita'

const URL_ENLACE = 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv'
const BASE: DatosRecordatorio = {
  inicio: '2026-11-17T16:00:00+00:00', zona: 'America/Mexico_City', medico: 'Dr. Ana Pérez',
  consultorio: { nombre: 'Consultorio <Uno>', direccion: 'Calle "1" & 2', telefono: '5555555555' },
  confirmada: false, url: URL_ENLACE,
}
const SIN_DATOS: DatosRecordatorio = { ...BASE, consultorio: { nombre: 'Consultorio Uno', direccion: null, telefono: null } }

const leible = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const vistaPrevia = (html: string): string => /<div style="display:none[^"]*">([^<]*)<\/div>/.exec(html)?.[1] ?? ''
const LOS_TRES = (d: DatosRecordatorio = BASE) => [correoConfirmacion(d, 'Ana'), correoRecordatorio(d), correoCambio(d)]

afterEach(() => { vi.useRealTimers() })

describe('la estructura de la maqueta', () => {
  it('cabecera, píldora, saludo, fecha, botones, nota del plazo, detalles, aviso de seguridad y pie, en ese orden', () => {
    const t = leible(correoConfirmacion(BASE, 'Ana').html)
    const orden = ['Consultorio &lt;Uno&gt;', 'Dr. Ana Pérez', 'Pendiente de confirmar', 'Hola, Ana:', 'Tienes una cita próxima',
      'Martes', '17 de noviembre', '10:00 h', 'hora del centro de México', 'Confirmo mi asistencia', 'No podré asistir',
      `Puedes cancelar con este botón hasta ${PLAZO_CANCELAR} antes de tu cita.`, 'Después, llámanos al 555 555 5555',
      'Médico Dr. Ana Pérez', 'Consultorio Consultorio &lt;Uno&gt;', 'Dirección Calle &quot;1&quot; &amp; 2', 'Teléfono 555 555 5555',
      '¿No reconoces esta cita? Ignora este correo; no se hará ningún cambio.', 'Enviado con Spinus']
    let desde = 0
    for (const parte of orden) {
      const i = t.indexOf(parte, desde)
      expect(i, parte).toBeGreaterThanOrEqual(desde)
      desde = i + parte.length
    }
  })
  it('el texto plano lleva lo mismo, con la URL simple (K2) y el pie', () => {
    const c = correoConfirmacion(BASE, 'Ana')
    expect(c.texto).toContain('Pendiente de confirmar\n\nHola, Ana:\n\nTienes una cita próxima.')
    expect(c.texto).toContain('Fecha: martes 17 de noviembre a las 10:00 h, hora del centro de México.')
    expect(c.texto).toContain(`Confirmar o avisar que no podré asistir: ${URL_ENLACE}\n`)
    expect(c.texto).not.toContain('?paso=')
    expect(c.texto).toContain('Después, llámanos al 555 555 5555.')
    expect(c.texto).toContain('Dirección: Calle "1" & 2\nTeléfono: 555 555 5555')
    expect(c.texto.endsWith('por favor no respondas a este correo.\nEnviado con Spinus')).toBe(true)
  })
  it('la vista previa de la maqueta: «Confirma tu cita del … a las … con …»', () => {
    expect(vistaPrevia(correoConfirmacion(BASE).html)).toBe('Confirma tu cita del martes 17 de noviembre de 2026 a las 10:00 h con Dr. Ana Pérez.')
    expect(vistaPrevia(correoCambio(BASE).html)).toBe('Tu cita cambió: ahora es el martes 17 de noviembre de 2026 a las 10:00 h con Dr. Ana Pérez.')
    expect(vistaPrevia(correoConfirmacion({ ...BASE, medico: '' }).html)).toBe('Confirma tu cita del martes 17 de noviembre de 2026 a las 10:00 h.')
  })
  it('los enlaces de siempre: «Confirmo» a `?paso=confirmar`, «No podré asistir» a `?paso=cancelar`', () => {
    for (const c of LOS_TRES()) {
      expect(c.html).toMatch(new RegExp(`<a href="${URL_ENLACE}\\?paso=confirmar"[^>]*>Confirmo mi asistencia</a>`))
      expect(c.html).toMatch(new RegExp(`<a href="${URL_ENLACE}\\?paso=cancelar"[^>]*>No podré asistir</a>`))
    }
  })
})

describe('la píldora dice el estado', () => {
  it('por confirmar: «Pendiente de confirmar»; confirmada: «✓ Cita confirmada» y sólo «No podré asistir»', () => {
    for (const c of [correoConfirmacion(BASE), correoRecordatorio(BASE)]) expect(leible(c.html)).toContain('Pendiente de confirmar')
    for (const c of [correoConfirmacion({ ...BASE, confirmada: true }), correoRecordatorio({ ...BASE, confirmada: true })]) {
      expect(c.html).toContain('&#10003;&nbsp; Cita confirmada')
      expect(leible(c.html)).not.toContain('Pendiente')
      expect(c.html).not.toContain('Confirmo mi asistencia')
      expect(c.html).toContain(`href="${URL_ENLACE}?paso=cancelar"`)
      expect(c.texto).toContain(`Avisar que no podré asistir: ${URL_ENLACE}`)
      expect(c.texto).not.toContain('Confirmar o')
    }
  })
  it('el aviso de cambio: «Cita reagendada» y «Tu cita cambió»', () => {
    const c = correoCambio(BASE)
    expect(leible(c.html)).toContain('Cita reagendada')
    expect(c.texto).toContain('Tu cita cambió')
  })
})

describe('reglas de los correos (punto 14)', () => {
  it('saluda por el nombre sólo la confirmación; sin nombre (o vacío, o desmedido), «Hola:»', () => {
    const c = correoConfirmacion(BASE, 'Ana Sofía')
    expect(c.html).toMatch(/<h1[^>]*>Hola, Ana Sofía:<\/h1>/)
    expect(c.asunto).not.toContain('Ana')
    for (const n of [null, '', '   ', 'x'.repeat(121)]) expect(correoConfirmacion(BASE, n).html).toMatch(/<h1[^>]*>Hola:<\/h1>/)
    for (const otro of [correoRecordatorio(BASE), correoCambio(BASE)]) expect(otro.html).toMatch(/<h1[^>]*>Hola:<\/h1>/)
  })
  it('el nombre va escapado en el HTML; en el texto, tal cual con los espacios juntados', () => {
    const c = correoConfirmacion(BASE, '  <b>Ana</b>\n & "Co" ')
    expect(c.html).toContain('Hola, &lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Co&quot;:')
    expect(c.html).not.toContain('<b>Ana')
    expect(c.texto).toContain('Hola, <b>Ana</b> & "Co":')
  })
  it('sin teléfono ni dirección: sus filas y la frase «Después, llámanos…» desaparecen enteras', () => {
    for (const c of LOS_TRES(SIN_DATOS)) {
      expect(`${leible(c.html)}\n${c.texto}`).not.toMatch(/Dirección|Teléfono|llámanos|tel:|comunícate/)
      expect(leible(c.html)).toContain(`Puedes cancelar con este botón hasta ${PLAZO_CANCELAR} antes de tu cita.`)
    }
  })
  it('sin médico: sin fila «Médico», la cabecera dice «Spinus» y el remitente es el de siempre', () => {
    const c = correoConfirmacion({ ...BASE, medico: '  ' })
    expect(leible(c.html)).not.toContain('Médico')
    expect(c.remitente).toBe('')
    expect(c.texto.startsWith('Spinus\nConsultorio <Uno>\n\n')).toBe(true)
  })
  it('el remitente es el médico; el asunto no lleva ni el médico ni el consultorio', () => {
    for (const c of LOS_TRES()) {
      expect(c.remitente).toBe('Dr. Ana Pérez')
      expect(c.asunto).not.toMatch(/Ana|Consultorio/)
    }
    expect(correoRecordatorio(BASE).asunto).toMatch(/^Recordatorio: tu cita del martes,? 17 de noviembre$/)
    expect(correoConfirmacion(BASE).asunto).toMatch(/^Confirma tu cita del martes,? 17 de noviembre$/)
    expect(correoConfirmacion({ ...BASE, confirmada: true }).asunto).toMatch(/^Tu cita del martes,? 17 de noviembre$/)
    expect(correoCambio(BASE).asunto).toMatch(/^Cambio en tu cita: ahora es el martes,? 17 de noviembre$/)
  })
  it('la confirmación puede salir días antes: no dice «recordatorio»', () => {
    for (const c of [correoConfirmacion(BASE), correoConfirmacion({ ...BASE, confirmada: true }), correoCambio(BASE)]) {
      expect(`${c.asunto}\n${c.texto}\n${c.html}`).not.toMatch(/recordatorio|recordamos/i)
    }
  })
  it('la zona del consultorio manda, con su nombre junto a la hora', () => {
    expect(correoRecordatorio({ ...BASE, zona: 'America/Cancun' }).html).toMatch(/>11:00 h <span[^>]*>&nbsp;hora de Quintana Roo</)
    expect(correoRecordatorio({ ...BASE, zona: 'America/Merida' }).texto).toContain('a las 10:00 h, hora de Yucatán.')
    for (const z of [null, 'No/Existe']) expect(correoRecordatorio({ ...BASE, zona: z }).texto).toContain('a las 10:00 h, hora del centro de México.')
  })
  it('nada clínico: no hay sitio para título, notas, tipo, especialidad ni apellidos', () => {
    for (const c of LOS_TRES()) {
      const todo = `${c.asunto}\n${c.texto}\n${c.html}`
      for (const prohibido of ['Ortopedia', 'Consulta:', 'notas', 'Paciente', 'motivo', 'Tipo de cita', 'diagn']) expect(todo).not.toContain(prohibido)
    }
  })
  it('escapa lo que escribe la clínica', () => {
    for (const c of LOS_TRES()) {
      expect(c.html).toContain('Consultorio &lt;Uno&gt;')
      expect(c.html).toContain('Calle &quot;1&quot; &amp; 2')
      expect(c.html).not.toContain('<Uno>')
    }
  })
})

describe('determinista', () => {
  it('el mismo correo con el reloj movido (Resend exige el mismo cuerpo con la misma llave)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'))
    const a = LOS_TRES()
    vi.setSystemTime(new Date('2026-11-17T15:59:00Z'))
    expect(LOS_TRES()).toEqual(a)
  })
  it('lanza con un inicio que no es fecha (quien llama lo marca omitido/plantilla)', () => {
    expect(() => correoRecordatorio({ ...BASE, inicio: 'mañana' })).toThrow()
  })
})
