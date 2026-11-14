/**
 * aperturaEnlace.test.ts — la regla única de «¿va a abrir este enlace?»
 * (tanda T2, punto 8). La página pública cierra con «Este enlace ya no está
 * disponible» por los mismos motivos que la pantalla de configuración marca:
 * usado, caducado, sin consultorio o sin tipos. Sin días abiertos, la página
 * abre (como hoy) pero la clínica recibe el aviso.
 */
import { describe, it, expect } from 'vitest'
import { avisoDeEnlace, cierraLaPagina, motivosApertura, TEXTO_MOTIVO, type DatosApertura } from '@/lib/reserva/aperturaEnlace'

const CERRADO = { activo: false, inicio: '09:00', fin: '14:00' }
const TODO_CERRADO = {
  lunes: CERRADO, martes: CERRADO, miercoles: CERRADO, jueves: CERRADO, viernes: CERRADO, sabado: CERRADO, domingo: CERRADO,
}
const LUNES = { ...TODO_CERRADO, lunes: { activo: true, inicio: '08:00', fin: '12:00' } }

const BIEN: DatosApertura = {
  estado: 'vigente',
  consultorios: [{ horario: TODO_CERRADO, horario_propio: false }],
  tipos: 1,
  horarioClinica: LUNES,
}

const cierra = (d: DatosApertura) => motivosApertura(d).some(cierraLaPagina)

describe('motivosApertura', () => {
  it('un enlace vigente con consultorio, tipo y un día abierto abre sin motivos', () => {
    expect(motivosApertura(BIEN)).toEqual([])
    expect(cierra(BIEN)).toBe(false)
  })

  it('cierra la página exactamente por lo que la cerraba antes: usado, caducado, sin consultorio o sin tipos', () => {
    expect(motivosApertura({ ...BIEN, estado: 'usado' })).toEqual(['enlace_usado'])
    expect(motivosApertura({ ...BIEN, estado: 'caducado' })).toEqual(['enlace_caducado'])
    expect(motivosApertura({ ...BIEN, consultorios: [] })).toEqual(['sin_consultorio'])
    expect(motivosApertura({ ...BIEN, tipos: 0 })).toEqual(['sin_tipos'])
    for (const d of [{ ...BIEN, estado: 'usado' as const }, { ...BIEN, consultorios: [] }, { ...BIEN, tipos: 0 }]) {
      expect(cierra(d)).toBe(true)
    }
  })

  it('sin ningún día abierto avisa a la clínica pero NO cierra la página (como hoy)', () => {
    const d = { ...BIEN, consultorios: [{ horario: TODO_CERRADO, horario_propio: true }] }
    expect(motivosApertura(d)).toEqual(['sin_disponibilidad'])
    expect(cierra(d)).toBe(false)
  })

  it('el horario propio manda sobre el de la clínica, y uno abierto basta', () => {
    const clinicaCerrada = { ...BIEN, horarioClinica: TODO_CERRADO }
    expect(motivosApertura(clinicaCerrada)).toEqual(['sin_disponibilidad'])
    expect(motivosApertura({ ...clinicaCerrada, consultorios: [
      { horario: TODO_CERRADO, horario_propio: false }, { horario: LUNES, horario_propio: true },
    ] })).toEqual([])
  })

  it('una clínica sin horario usa el de fábrica (abre entre semana), igual que los turnos', () => {
    expect(motivosApertura({ ...BIEN, horarioClinica: null })).toEqual([])
  })

  it('suma los motivos y cada uno tiene su frase para la clínica', () => {
    expect(motivosApertura({ ...BIEN, consultorios: [], tipos: 0 })).toEqual(['sin_consultorio', 'sin_tipos'])
    for (const t of Object.values(TEXTO_MOTIVO)) expect(t.length).toBeGreaterThan(5)
  })
})

describe('avisoDeEnlace', () => {
  it('dice «No abrirá» con los motivos que cierran, «Abrirá sin horarios» sin días abiertos, y nada si abre', () => {
    expect(avisoDeEnlace([])).toBeNull()
    expect(avisoDeEnlace(['sin_tipos'])).toBe('No abrirá: no hay un tipo de cita para este médico.')
    expect(avisoDeEnlace(['no_abre', 'sin_tipos'])).toMatch(/^No abrirá: la clínica no puede recibir reservas.*; no hay un tipo de cita/)
    expect(avisoDeEnlace(['sin_disponibilidad'])).toBe('Abrirá sin horarios: ningún consultorio del médico tiene días abiertos.')
  })
})
