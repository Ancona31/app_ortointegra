/**
 * B7 · Las reglas de empalme de P3 (`empalmesCita.ts`) y la validación del
 * cuerpo `empalmes_aceptados` (`empalmesServidor.ts`).
 */
import { describe, it, expect } from 'vitest'
import { empalmesDe, mensajeEmpalme, unirAceptados, ESTADOS_SIN_EMPALME, type TramoCita } from '@/lib/agenda/empalmesCita'
import { leerAceptados, TOPE_ACEPTADOS } from '@/lib/agenda/empalmesServidor'

const MEDICO = 'medico-1'
const d = (hhmm: string): Date => new Date(`2026-11-18T${hhmm}:00`)

function tramo(id: string, desde: string, hasta: string, extra: Partial<TramoCita> = {}): TramoCita {
  return {
    id, medicoId: MEDICO, inicio: d(desde), fin: d(hasta), todoElDia: false, noOcupa: false,
    deGoogle: false, titulo: `Cita ${id}`, ...extra,
  }
}

const CITA = tramo('nueva', '10:00', '10:30')

describe('empalmesDe (P3)', () => {
  it('10:00–10:30 y 10:30–11:00 no se empalman (semiabierto), por ninguno de los dos lados', () => {
    expect(empalmesDe(CITA, [tramo('a', '10:30', '11:00'), tramo('b', '09:30', '10:00')])).toEqual([])
  })

  it('un solape de un minuto sí cuenta, y lo devuelve con su nombre y sus horas', () => {
    const [e] = empalmesDe(CITA, [tramo('a', '10:29', '11:00')])
    expect(e).toEqual({ id: 'a', titulo: 'Cita a', inicio: d('10:29').toISOString(), fin: d('11:00').toISOString() })
  })

  it('una cita que contiene a la otra, y una contenida, cuentan', () => {
    expect(empalmesDe(CITA, [tramo('a', '09:00', '12:00'), tramo('b', '10:10', '10:20')]).map(e => e.id)).toEqual(['a', 'b'])
  })

  it('no cuentan: cancelada o no_show, todo el día, de Google ni de otro médico', () => {
    const otras = [
      tramo('c', '10:00', '10:30', { noOcupa: true }),
      tramo('t', '00:00', '23:59', { todoElDia: true }),
      tramo('g', '10:00', '10:30', { deGoogle: true }),
      tramo('m', '10:00', '10:30', { medicoId: 'otro' }),
    ]
    expect(empalmesDe(CITA, otras)).toEqual([])
  })

  it('se excluye la propia cita (en la edición, la de antes del gesto)', () => {
    expect(empalmesDe(CITA, [tramo('nueva', '10:00', '10:30')])).toEqual([])
  })

  it('una cita de todo el día, cancelada/no_show o sin médico no se empalma con nada', () => {
    const otra = [tramo('a', '10:00', '10:30')]
    expect(empalmesDe({ ...CITA, todoElDia: true }, otra)).toEqual([])
    expect(empalmesDe({ ...CITA, noOcupa: true }, otra)).toEqual([])
    expect(empalmesDe({ ...CITA, medicoId: null }, otra)).toEqual([])
  })

  it('no_show y cancelled están en ESTADOS_SIN_EMPALME (corrección de Angel a P3)', () => {
    expect([...ESTADOS_SIN_EMPALME].sort()).toEqual(['cancelled', 'no_show'])
  })
})

describe('mensajeEmpalme', () => {
  it('nombra la cita y su hora', () => {
    const msg = mensajeEmpalme(empalmesDe(CITA, [tramo('a', '10:15', '10:45', { titulo: 'Paciente Prueba 07' })]))
    expect(msg).toBe('Se empalma con «Paciente Prueba 07» (10:15–10:45). ¿Guardar de todos modos?')
  })

  it('nombra tres y cuenta el resto', () => {
    const otras = ['a', 'b', 'c', 'e', 'f'].map(id => tramo(id, '10:00', '10:30'))
    const msg = mensajeEmpalme(empalmesDe(CITA, otras))
    expect(msg).toContain('«Cita a»')
    expect(msg).toContain('«Cita c»')
    expect(msg).not.toContain('«Cita e»')
    expect(msg).toContain('y 2 más')
  })
})

describe('empalmes_aceptados', () => {
  const U = '11111111-1111-4111-8111-111111111111'
  it('ausente o null es lista vacía; uuids válidos pasan', () => {
    expect(leerAceptados(undefined)).toEqual([])
    expect(leerAceptados(null)).toEqual([])
    expect(leerAceptados([U])).toEqual([U])
  })
  it('rechaza lo que no es lista de uuid y más de 20', () => {
    expect(leerAceptados('x')).toBeNull()
    expect(leerAceptados(['no-es-uuid'])).toBeNull()
    expect(leerAceptados([U, 3])).toBeNull()
    expect(leerAceptados(Array.from({ length: TOPE_ACEPTADOS + 1 }, () => U))).toBeNull()
  })
  it('unirAceptados no repite', () => {
    expect(unirAceptados(['a'], [{ id: 'a', titulo: '', inicio: '', fin: '' }, { id: 'b', titulo: '', inicio: '', fin: '' }])).toEqual(['a', 'b'])
  })
})
