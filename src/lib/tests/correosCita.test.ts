/**
 * correosCita.test.ts — agenda E4: el recordatorio no lleva nada clínico, va
 * escapado, lleva la URL del enlace y sale IDÉNTICO con la misma entrada
 * aunque cambie el reloj (Resend exige el mismo cuerpo con la misma llave).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { correoCambio, correoConfirmacion, correoRecordatorio, type DatosRecordatorio } from '@/lib/confirmacion/correosCita'

const URL_ENLACE = 'https://spinus.prueba/confirmar/AbCdEfGhIjKlMnOpQrStUv'
const BASE: DatosRecordatorio = {
  inicio: '2026-11-17T16:00:00+00:00', zona: 'America/Mexico_City', medico: 'Dr. Ana Pérez',
  consultorio: { nombre: 'Consultorio <Uno>', direccion: 'Calle "1" & 2', telefono: '5555555555' },
  confirmada: false, url: URL_ENLACE,
}

afterEach(() => { vi.useRealTimers() })

describe('correoRecordatorio', () => {
  it('fecha y hora en la zona del consultorio, médico, consultorio, dirección, teléfono y la URL', () => {
    const c = correoRecordatorio(BASE)
    expect(c.asunto).toMatch(/^Recordatorio: tu cita del martes,? 17 de noviembre$/)
    expect(c.texto).toContain('10:00')
    expect(c.texto).toContain('Dr. Ana Pérez')
    expect(c.texto).toContain('Calle "1" & 2')
    expect(c.texto).toContain('5555555555')
    expect(c.texto).toContain(URL_ENLACE)
    expect(c.texto).toContain('Confirmar o avisar que no podré asistir')
    expect(c.html).toContain(`href="${URL_ENLACE}"`)
  })

  it('el asunto no lleva el médico ni el consultorio', () => {
    const c = correoRecordatorio(BASE)
    expect(c.asunto).not.toContain('Ana')
    expect(c.asunto).not.toContain('Consultorio')
  })

  it('escapa el HTML de lo que escribe la clínica', () => {
    const c = correoRecordatorio(BASE)
    expect(c.html).toContain('Consultorio &lt;Uno&gt;')
    expect(c.html).toContain('Calle &quot;1&quot; &amp; 2')
    expect(c.html).not.toContain('<Uno>')
  })

  it('una cita confirmada no ofrece «Confirmar»', () => {
    const c = correoRecordatorio({ ...BASE, confirmada: true })
    expect(c.texto).not.toContain('Confirmar')
    expect(c.texto).toContain('Avisar que no podré asistir')
  })

  it('sin teléfono ni dirección ni médico, frases neutras', () => {
    const c = correoRecordatorio({ ...BASE, medico: '', consultorio: { nombre: null, direccion: null, telefono: null } })
    expect(c.texto).toContain('comunícate con el consultorio')
    expect(c.texto).not.toContain(' con .')
    expect(c.texto).toContain('en el consultorio.')
  })

  it('la zona del consultorio manda: la misma hora UTC en Cancún es otra hora local', () => {
    expect(correoRecordatorio({ ...BASE, zona: 'America/Cancun' }).texto).toContain('11:00')
    expect(correoRecordatorio({ ...BASE, zona: null }).texto).toContain('10:00')
    expect(correoRecordatorio({ ...BASE, zona: 'No/Existe' }).texto).toContain('10:00')
  })

  it('es determinista: el mismo correo con el reloj movido', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'))
    const a = correoRecordatorio(BASE)
    vi.setSystemTime(new Date('2026-11-17T15:59:00Z'))
    const b = correoRecordatorio(BASE)
    expect(b).toEqual(a)
  })

  it('nada clínico: no hay campos para título, notas, tipo, especialidad ni paciente', () => {
    const c = correoRecordatorio(BASE)
    const todo = `${c.asunto}\n${c.texto}\n${c.html}`
    for (const prohibido of ['Ortopedia', 'Consulta:', 'notas', 'Paciente']) expect(todo).not.toContain(prohibido)
  })

  it('lanza con un inicio que no es fecha (quien llama lo marca omitido/plantilla)', () => {
    expect(() => correoRecordatorio({ ...BASE, inicio: 'mañana' })).toThrow()
  })
})

/* Integración G1/G3: la confirmación usa el armado de G1 con el cuerpo del
   recordatorio, pero puede salir DÍAS antes: no puede decir «Recordatorio». */
describe('correoConfirmacion', () => {
  it('mismo cuerpo que el recordatorio, con su asunto y su título, y sin la palabra «Recordatorio»', () => {
    const c = correoConfirmacion(BASE)
    expect(c.asunto).toMatch(/^Confirma tu cita del martes,? 17 de noviembre$/)
    for (const parte of [c.texto, c.html]) {
      expect(parte).toContain('Confirma tu cita')
      expect(parte).not.toMatch(/recordatorio|es mañana/i)
    }
    expect(c.texto.startsWith('Dr. Ana Pérez\nConsultorio <Uno>\n\nConfirma tu cita')).toBe(true)
    expect(c.texto).toContain(URL_ENLACE)
    expect(c.html).toContain(`href="${URL_ENLACE}"`)
    expect(c.html).toContain('Calle &quot;1&quot; &amp; 2')
  })

  it('ya confirmada: «Tu cita», sin «Confirmo» y sin «Recordatorio»', () => {
    const c = correoConfirmacion({ ...BASE, confirmada: true })
    expect(c.asunto).toMatch(/^Tu cita del /)
    expect(c.texto.startsWith('Dr. Ana Pérez\nConsultorio <Uno>\n\nTu cita')).toBe(true)
    expect(c.html).not.toContain('Confirmo mi asistencia')
    expect(`${c.texto}\n${c.html}`).not.toMatch(/recordatorio/i)
  })

  it('el recordatorio sigue diciendo «Recordatorio de tu cita»', () => {
    expect(correoRecordatorio(BASE).texto.startsWith('Dr. Ana Pérez\nConsultorio <Uno>\n\nRecordatorio de tu cita')).toBe(true)
  })
})

/* Tanda I, punto 21: a nombre del MÉDICO (cabecera, remitente y texto), con el
   consultorio debajo y «Enviado con Spinus» pequeño al pie. Punto 9: el aviso de
   cambio es el mismo armado, con los datos nuevos y el enlace. */
describe('a nombre del médico (I, punto 21) y el aviso de cambio (I, punto 9)', () => {
  it('remitente, cabecera y pie: el médico arriba, el consultorio debajo, Spinus sólo al pie', () => {
    for (const c of [correoRecordatorio(BASE), correoConfirmacion(BASE), correoCambio(BASE)]) {
      expect(c.remitente).toBe('Dr. Ana Pérez')
      expect(c.texto.endsWith('\n\nEnviado con Spinus')).toBe(true)
      expect(c.texto.split('Spinus').length - 1).toBe(1)
      const cabecera = c.html.indexOf('Dr. Ana Pérez')
      expect(cabecera).toBeGreaterThan(-1)
      expect(c.html.indexOf('Consultorio &lt;Uno&gt;')).toBeGreaterThan(cabecera)
      expect(c.html).toMatch(/font:400 11px[^>]*>Enviado con Spinus</)
    }
  })
  it('el aviso de cambio dice la fecha nueva en el asunto y lleva el enlace', () => {
    const c = correoCambio(BASE)
    expect(c.asunto).toMatch(/^Cambio en tu cita: ahora es el martes,? 17 de noviembre/)
    expect(c.texto).toContain('Tu cita cambió')
    expect(c.texto).toContain('10:00')
    expect(c.html).toContain(`href="${URL_ENLACE}"`)
    expect(`${c.texto}\n${c.html}`).not.toMatch(/recordatorio/i)
  })
})
