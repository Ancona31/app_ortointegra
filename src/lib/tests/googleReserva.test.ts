/**
 * googleReserva.test.ts — agenda D8: el evento de Google de una reserva por
 * enlace lleva «Cita médica: {nombre}», la descripción de una cita con
 * paciente, y NADA más de la persona (ni teléfono, ni correo, ni notas, ni
 * tipo); el único invitado es el médico. Y el comprobante no lleva el tipo.
 */
import { describe, it, expect } from 'vitest'
import { eventoDeReserva, type CitaReservada } from '@/lib/reserva/googleReserva'
import { eventoParaGoogle } from '@/lib/appointments'
import { correoComprobante } from '@/lib/reserva/correosReserva'

const CITA: CitaReservada = {
  clinicaId: '00000000-0000-4000-8000-000000000001', citaId: '00000000-0000-4000-8000-0000000000c1',
  medicoId: '00000000-0000-4000-8000-0000000000a1', nombre: 'Ana López Pérez',
  inicio: '2031-05-06T16:00:00.000Z', fin: '2031-05-06T16:30:00.000Z', zona: 'America/Merida',
  clinica: { nombre: 'Clínica Uno', nombre_display: null },
}

describe('eventoDeReserva', () => {
  it('título «Cita médica: {nombre}», sin espacio colgando', () => {
    expect(eventoDeReserva(CITA, 'medico@x.mx').summary).toBe('Cita médica: Ana López Pérez')
  })
  it('descripción como la de una cita con paciente y sin datos de contacto', () => {
    const ev = eventoDeReserva(CITA, 'medico@x.mx')
    const d = ev.description ?? ''
    expect(d).toContain('Consulta:')
    expect(d).toContain('Ana López Pérez')
    expect(d.split('\n').every(l => l === l.trimEnd())).toBe(true)
    expect(JSON.stringify(ev)).not.toMatch(/@reserva|5512345678|Primera vez/)
  })
  it('sólo el médico es invitado; sin correo del médico, nadie', () => {
    expect(eventoDeReserva(CITA, 'medico@x.mx').attendees?.map(a => a.email)).toEqual(['medico@x.mx'])
    expect(eventoDeReserva(CITA, null).attendees).toEqual([])
  })
  it('lleva la marca privada de Spinus y las puntas con la zona del consultorio', () => {
    const ev = eventoDeReserva(CITA, null)
    expect(ev.extendedProperties?.private).toEqual({ spinus_cita: CITA.citaId, spinus_v: '2' })
    expect(ev.start).toEqual({ dateTime: CITA.inicio, timeZone: 'America/Merida' })
    expect(ev.guestsCanSeeOtherGuests).toBe(false)
  })
})

describe('convenio de la cita por ligar', () => {
  it('apellidos vacíos: el título no lleva espacio al final y es el que el espejo de D4 espera', () => {
    expect(eventoParaGoogle({ nombre: 'Ana', apellidos: '' }, null, '', null, 'America/Merida', 'scheduled').summary).toBe('Cita médica: Ana')
    expect(eventoParaGoogle({ nombre: 'Ana', apellidos: '' }, null, '', null, 'America/Merida', 'cancelled').summary)
      .toBe('CANCELADA — Cita médica: Ana')
    expect(eventoParaGoogle({ nombre: 'Ana', apellidos: 'Pérez' }, null, '', null, 'America/Merida', 'scheduled').summary)
      .toBe('Cita médica: Ana Pérez')
  })
})

describe('correoComprobante', () => {
  it('fecha y hora en la zona del consultorio, médico, lugar, teléfono; sin tipo ni clínica', () => {
    const c = correoComprobante({ medico: 'Dr. X', consultorio: 'Centro', direccion: 'Calle 1', telefono: '9991234567',
      inicio: '2031-05-06T16:00:00.000Z', zona: 'America/Merida' })
    expect(c.texto).toContain('10:00')
    expect(c.texto).toContain('6 de mayo de 2031')
    expect(c.texto).toContain('Dr. X')
    expect(c.texto).toContain('Centro, Calle 1')
    expect(c.texto).toContain('9991234567')
    expect(c.texto).toContain('Para cambiar o cancelar, comunícate con el consultorio')
    expect(c.texto).not.toMatch(/Clínica|tipo/i)
  })
  it('escapa el HTML', () => {
    const c = correoComprobante({ medico: '<b>x</b>', consultorio: 'C', direccion: null, telefono: null,
      inicio: '2031-05-06T16:00:00.000Z', zona: 'America/Merida' })
    expect(c.html).not.toContain('<b>x</b>')
    expect(c.html).toContain('&lt;b&gt;')
  })
  it('E5: con el enlace de confirmación, lo lleva en texto y en el href; sin él, el cierre de D8', () => {
    const url = 'https://www.spinus.com.mx/confirmar/AbCdEfGhIjKlMnOpQrSt_-'
    const base = { medico: 'Dr. X', consultorio: 'C', direccion: null, telefono: null, inicio: '2031-05-06T16:00:00.000Z', zona: 'America/Merida' }
    const con = correoComprobante({ ...base, urlConfirmacion: url })
    expect(con.texto).toContain(url)
    expect(con.texto).toContain('Para confirmar tu asistencia o avisar que no podrás ir')
    expect(con.texto).not.toContain('comunícate con el consultorio')
    expect(con.html).toContain(`href="${url}"`)
    for (const sin of [null, undefined, 'javascript:alert(1)', 'https://x.mx/"><b>']) {
      const c = correoComprobante({ ...base, urlConfirmacion: sin })
      expect(c.texto).toContain('Para cambiar o cancelar, comunícate con el consultorio')
      expect(c.html).not.toContain('href=')
    }
  })
  it('E5: el cuerpo es determinista (mismos datos, mismo correo)', () => {
    const d = { medico: 'Dr. X', consultorio: 'C', direccion: null, telefono: null, inicio: '2031-05-06T16:00:00.000Z', zona: 'America/Merida',
      urlConfirmacion: 'https://www.spinus.com.mx/confirmar/AbCdEfGhIjKlMnOpQrSt_-' }
    expect(correoComprobante(d)).toEqual(correoComprobante(d))
  })
})
