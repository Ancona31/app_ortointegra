import { describe, expect, it } from 'vitest'
import { nombreCortoDeTexto, nombreCortoPaciente } from '@/lib/agenda/nombresTarjeta'

describe('nombreCortoPaciente (F1.7)', () => {
  it('primer nombre e inicial del primer apellido', () => {
    expect(nombreCortoPaciente('Hugo', 'Interián Pérez')).toBe('Hugo I.')
    expect(nombreCortoPaciente('María José', 'López Ruiz')).toBe('María L.')
  })
  it('apellido compuesto: salta las partículas', () => {
    expect(nombreCortoPaciente('Ana', 'de la Cruz Gómez')).toBe('Ana C.')
    expect(nombreCortoPaciente('Luis', 'del Valle')).toBe('Luis V.')
  })
  it('un solo nombre, sin apellidos', () => {
    expect(nombreCortoPaciente('Hugo', '')).toBe('Hugo')
    expect(nombreCortoPaciente('  Hugo  ', '   ')).toBe('Hugo')
  })
  it('sin apellidos, el segundo nombre hace de apellido', () => {
    expect(nombreCortoPaciente('Hugo Alberto', '')).toBe('Hugo A.')
  })
  it('la inicial va en mayúscula y respeta acentos', () => {
    expect(nombreCortoPaciente('Eva', 'ávila')).toBe('Eva Á.')
  })
  it('nunca reduce el nombre a una sola letra', () => {
    expect(nombreCortoPaciente('Paciente', 'Prueba 20')).toBe('Paciente P.')
  })
})

describe('nombreCortoDeTexto (cita por ligar)', () => {
  it('primera palabra e inicial de la siguiente', () => {
    expect(nombreCortoDeTexto('Juan Pérez García')).toBe('Juan P.')
    expect(nombreCortoDeTexto('Rosa')).toBe('Rosa')
    expect(nombreCortoDeTexto('   ')).toBe('')
  })
})
