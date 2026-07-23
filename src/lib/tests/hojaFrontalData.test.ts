import { describe, it, expect } from 'vitest'
import { buildHojaFrontalData, type BuildHojaFrontalInput } from '@/lib/hojaFrontalData'
import type { Paciente } from '@/types'

// ── Fixtures ──

const pacienteCompleto: Paciente = {
  id: 'p1',
  numero_expediente: 'EXP-2026-0001',
  nombre: 'Juan',
  apellidos: 'Pérez López',
  fecha_nacimiento: '1990-03-15',
  sexo: 'M',
  telefono: '555-123-4567',
  email: 'juan@example.com',
  direccion: 'Av. Reforma 100, CDMX',
  ant_no_patologicos: 'Tabaquismo negado',
  ant_patologicos: 'Hipertensión arterial, DM2',
  ant_quirurgicos: 'Apendicectomía 2010',
  ant_familiares: 'Madre con DM2',
  alergias: 'Penicilina',
  medicamentos_actuales: 'Metformina 850mg',
}

/** Solo los campos NOT NULL de la tabla. Todo lo opcional ausente. */
const pacienteMinimo: Paciente = {
  id: 'p2',
  nombre: 'Ana',
  apellidos: 'Ruiz',
  fecha_nacimiento: null,
  sexo: 'F',
}

const clinica = {
  nombre: 'Clínica Spinus',
  subtitulo: 'Ortopedia y Traumatología',
  logoUrl: 'data:image/png;base64,AAA',
}

function build(over: Partial<BuildHojaFrontalInput> = {}) {
  return buildHojaFrontalData({
    paciente: pacienteCompleto,
    clinica,
    responsableNombre: 'Dr. Angel Ancona Pérez',
    fechaAperturaISO: '2026-03-10T16:00:00Z',
    colorPrimario: '#1a3a5c',
    colorSecundario: '#1e5fa8',
    ...over,
  })
}

// ── Campos completos ──

describe('buildHojaFrontalData — campos completos', () => {
  it('mapea paciente, clínica, responsable y colores', () => {
    const r = build()

    expect(r.paciente.nombreCompleto).toBe('Juan Pérez López')
    expect(r.paciente.numeroExpediente).toBe('EXP-2026-0001')
    expect(r.paciente.telefono).toBe('555-123-4567')
    expect(r.paciente.email).toBe('juan@example.com')
    expect(r.paciente.direccion).toBe('Av. Reforma 100, CDMX')
    expect(r.paciente.antNoPatologicos).toBe('Tabaquismo negado')
    expect(r.paciente.antQuirurgicos).toBe('Apendicectomía 2010')
    expect(r.paciente.antFamiliares).toBe('Madre con DM2')
    expect(r.paciente.medicamentosActuales).toBe('Metformina 850mg')

    expect(r.clinica).toEqual(clinica)
    expect(r.responsable.nombre).toBe('Dr. Angel Ancona Pérez')
    expect(r.colorPrimario).toBe('#1a3a5c')
    expect(r.colorSecundario).toBe('#1e5fa8')
  })

  it('ant_patologicos se expone como padecimientosCronicos', () => {
    expect(build().paciente.padecimientosCronicos).toBe('Hipertensión arterial, DM2')
  })

  it('alergias presentes se conservan (la banda roja las consume)', () => {
    expect(build().paciente.alergias).toBe('Penicilina')
  })

  it('sexo se traduce a etiqueta legible', () => {
    expect(build().paciente.sexo).toBe('Masculino')
    expect(build({ paciente: pacienteMinimo }).paciente.sexo).toBe('Femenino')
  })

  it('fecha de nacimiento se formatea como fecha-solo, sin correr el día', () => {
    // '1990-03-15' es un `date` en BD: debe salir el 15, no el 14, aunque la
    // zona de la clínica esté detrás de UTC.
    expect(build().paciente.fechaNacimiento).toBe('15 de marzo de 1990')
  })

  it('edad se calcula desde la fecha de nacimiento', () => {
    const r = build()
    expect(r.paciente.edad).not.toBe('—')
    expect(r.paciente.edad).toMatch(/^\d+ (años?|meses|mes|días?)$/)
  })

  it('fecha de apertura se formatea en la zona de la clínica', () => {
    // 2026-03-10T16:00:00Z → 10:00 en America/Mexico_City, mismo día.
    expect(build().fechaApertura).toBe('10 de marzo de 2026')
  })
})

// ── Opcionales ausentes ──

describe('buildHojaFrontalData — todos los opcionales null', () => {
  const r = buildHojaFrontalData({
    paciente: pacienteMinimo,
    clinica: { nombre: 'Consultorio Solo' },
    fechaAperturaISO: null,
  })

  it('los campos opcionales del paciente caen a null, no a undefined ni a ""', () => {
    expect(r.paciente.telefono).toBeNull()
    expect(r.paciente.email).toBeNull()
    expect(r.paciente.direccion).toBeNull()
    expect(r.paciente.antNoPatologicos).toBeNull()
    expect(r.paciente.antQuirurgicos).toBeNull()
    expect(r.paciente.antFamiliares).toBeNull()
    expect(r.paciente.medicamentosActuales).toBeNull()
    expect(r.paciente.padecimientosCronicos).toBeNull()
    expect(r.paciente.alergias).toBeNull()
  })

  it('sin fecha de nacimiento → edad y nacimiento en "—"', () => {
    expect(r.paciente.edad).toBe('—')
    expect(r.paciente.fechaNacimiento).toBe('—')
  })

  it('sin número de expediente → "—" (el badge nunca queda vacío)', () => {
    expect(r.paciente.numeroExpediente).toBe('—')
  })

  it('clínica sin subtítulo ni logo → null; responsable ausente → "—"', () => {
    expect(r.clinica.nombre).toBe('Consultorio Solo')
    expect(r.clinica.subtitulo).toBeNull()
    expect(r.clinica.logoUrl).toBeNull()
    expect(r.responsable.nombre).toBe('—')
  })

  it('sin colores → undefined, para que derivarPaletaNota caiga al fallback', () => {
    expect(r.colorPrimario).toBeUndefined()
    expect(r.colorSecundario).toBeUndefined()
  })

  it('strings de solo espacios se colapsan a null', () => {
    const conBasura = buildHojaFrontalData({
      paciente: { ...pacienteMinimo, telefono: '   ', alergias: '', ant_patologicos: '\n ' },
      clinica: { nombre: 'X', subtitulo: '  ' },
      responsableNombre: '   ',
      fechaAperturaISO: null,
    })
    expect(conBasura.paciente.telefono).toBeNull()
    expect(conBasura.paciente.alergias).toBeNull()
    expect(conBasura.paciente.padecimientosCronicos).toBeNull()
    expect(conBasura.clinica.subtitulo).toBeNull()
    expect(conBasura.responsable.nombre).toBe('—')
  })
})

// ── Apertura ──

describe('buildHojaFrontalData — fecha de apertura', () => {
  it('null cuando el paciente no tiene notas', () => {
    expect(build({ fechaAperturaISO: null }).fechaApertura).toBeNull()
  })

  it('null cuando el caller ni siquiera pasa el campo', () => {
    expect(build({ fechaAperturaISO: undefined }).fechaApertura).toBeNull()
  })
})

// ── Sexo fuera de la tabla ──

describe('buildHojaFrontalData — sexo nulo o desconocido', () => {
  it('sexo null en BD → "—"', () => {
    // `pacientes.sexo` es NULLABLE en BD aunque el tipo lo declare no-nulo.
    const paciente = { ...pacienteMinimo, sexo: null } as unknown as Paciente
    expect(buildHojaFrontalData({ paciente, clinica: { nombre: 'X' } }).paciente.sexo).toBe('—')
  })

  it('valor fuera del CHECK → "—" en vez de imprimirlo crudo', () => {
    const paciente = { ...pacienteMinimo, sexo: 'X' } as unknown as Paciente
    expect(buildHojaFrontalData({ paciente, clinica: { nombre: 'X' } }).paciente.sexo).toBe('—')
  })

  it('"Otro" se conserva', () => {
    const paciente: Paciente = { ...pacienteMinimo, sexo: 'Otro' }
    expect(buildHojaFrontalData({ paciente, clinica: { nombre: 'X' } }).paciente.sexo).toBe('Otro')
  })
})
