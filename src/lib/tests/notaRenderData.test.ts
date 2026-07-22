import { describe, it, expect } from 'vitest'
import { buildNotaRenderData, type AddendumInput } from '@/lib/notaRenderData'
import type { Consulta, Paciente, MedicoInfo } from '@/types'

// ── Fixtures ──
const medicoVivo: MedicoInfo = {
  nombre: 'Nombre Legacy Ignorado',
  titulo: 'Dr.',
  nombres: 'Angel',
  apellido_paterno: 'Ancona',
  apellido_materno: 'Pérez',
  especialidad: 'Ortopedia',
  cedula_profesional: '9552456',
  cedula_especialidad: '12085805',
  universidad: null,
  logo_url: 'https://vivo/logo.png',
  firma_url: 'https://vivo/firma.png',
  color_primario: '#1a3a5c',
  color_secundario: '#1e5fa8',
  direccion_consultorio: 'Calle Viva 1',
  telefono_consultorio: '5550000',
}

const paciente: Paciente = {
  id: 'p1',
  numero_expediente: 'EXP-2026-0001',
  nombre: 'Juan',
  apellidos: 'Pérez López',
  fecha_nacimiento: '1990-01-01',
  sexo: 'M',
  peso_kg: 70,
  talla_cm: 175,
  imc: 22.9,
  alergias: 'Penicilina',
}

const consultaSnapshot: Consulta = {
  id: 'c1',
  paciente_id: 'p1',
  fecha: '2026-07-21T15:00:00Z',
  motivo_consulta: 'Dolor lumbar',
  diagnosticos: [{ descripcion: 'Lumbalgia' }],
  notas_evolucion: '**[SUBJETIVO]:**\nrefiere dolor',
  medico_nombre: 'Dr. Snapshot Congelado',
  medico_especialidad: 'Traumatología',
  medico_cedula_profesional: '111',
  medico_cedula_especialidad: '222',
  medico_logo_url: 'https://snap/logo.png',
  consultorio_nombre: 'Consultorio Centro',
  consultorio_nombre_corto: 'Centro',
  consultorio_direccion: 'Av. Principal 100',
  consultorio_telefono: '5551234',
  signos_vitales: { peso_kg: 68, ta_sistolica: 120, ta_diastolica: 80 },
  proxima_cita: '2026-08-01T15:00:00Z',
  nota_origen: 'manual',
}

const consultaMinima: Consulta = {
  id: 'c2',
  paciente_id: 'p1',
  fecha: '2026-07-21T15:00:00Z',
  motivo_consulta: 'Cefalea',
}

describe('buildNotaRenderData — cascada snapshot → vivo y excepción de firma', () => {
  it('el snapshot de la consulta gana sobre el médico vivo', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente, medicoVivo })
    expect(r.medico.nombre).toBe('Dr. Snapshot Congelado')
    expect(r.medico.especialidad).toBe('Traumatología')
    expect(r.medico.cedulaProfesional).toBe('111')
    expect(r.medico.logoUrl).toBe('https://snap/logo.png')
  })

  it('la firma SIEMPRE sale del médico vivo, aunque el resto sea snapshot', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente, medicoVivo })
    expect(r.medico.firmaUrl).toBe('https://vivo/firma.png')
  })

  it('sin snapshot médico, compone el nombre desde el médico vivo', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaMinima, paciente, medicoVivo })
    expect(r.medico.nombre).toBe('Dr. Angel Ancona Pérez')
    expect(r.medico.especialidad).toBe('Ortopedia')
    expect(r.medico.firmaUrl).toBe('https://vivo/firma.png')
  })

  it('sin médico vivo, la firma queda vacía y el snapshot se conserva', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.medico.nombre).toBe('Dr. Snapshot Congelado')
    expect(r.medico.firmaUrl).toBe('')
  })
})

describe('buildNotaRenderData — separación signosVitales vs paciente', () => {
  it('signosVitales sale de la consulta; pesoKg del paciente es dato vivo separado', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.signosVitales?.peso_kg).toBe(68)
    expect(r.signosVitales?.ta_sistolica).toBe(120)
    expect(r.paciente.pesoKg).toBe(70)
    expect(r.paciente.tallaCm).toBe(175)
  })

  it('consulta sin signos_vitales → null (no se mezcla con el peso del paciente)', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaMinima, paciente })
    expect(r.signosVitales).toBeNull()
    expect(r.paciente.pesoKg).toBe(70)
  })
})

describe('buildNotaRenderData — diagnosticos y fallback a motivoConsulta', () => {
  it('expone el array completo de diagnosticos y el motivo por separado', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.diagnosticos).toEqual([{ descripcion: 'Lumbalgia' }])
    expect(r.motivoConsulta).toBe('Dolor lumbar')
  })

  it('diagnosticos vacío deja el motivo disponible como fallback', () => {
    const sinDx: Consulta = { ...consultaSnapshot, diagnosticos: [], motivo_consulta: 'Cefalea tensional' }
    const r = buildNotaRenderData({ origen: 'consulta', consulta: sinDx, paciente })
    expect(r.diagnosticos).toEqual([])
    expect(r.motivoConsulta).toBe('Cefalea tensional')
  })
})

describe('buildNotaRenderData — addendums formateados', () => {
  it('parsea, formatea fecha en TZ clínica y toma el nombre del médico', () => {
    const addendums: AddendumInput[] = [
      { contenido: 'Se corrige la dosis del analgésico.', medico_nombre: 'Dr. Vivo', created_at: '2026-07-22T15:00:00Z' },
    ]
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente, medicoVivo, addendums })
    expect(r.addendums).toHaveLength(1)
    expect(r.addendums[0].medicoNombre).toBe('Dr. Vivo')
    // 2026-07-22T15:00:00Z → 09:00 en America/Mexico_City (UTC-6, sin DST)
    expect(r.addendums[0].fechaFormateada).toBe('22 de julio de 2026 · 9:00 a.m.')
    expect(r.addendums[0].parseado.secciones[0].tipo).toBe('desconocida')
  })

  it('sin addendums → array vacío', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.addendums).toEqual([])
  })
})

describe('buildNotaRenderData — fechas y paciente', () => {
  it('fechaFormateada usa renderEnTZ (día correcto en zona de la clínica)', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.fechaFormateada).toBe('21 de julio de 2026')
    expect(r.proximaCita).toBe('1 de agosto de 2026')
  })

  it('nombre completo del paciente y edad calculada', () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.paciente.nombreCompleto).toBe('Juan Pérez López')
    expect(r.paciente.edad).not.toBeNull()
    expect(typeof r.paciente.edad?.anios).toBe('number')
  })

  it('paciente sin fecha de nacimiento → edad null', () => {
    const sinFecha: Paciente = { ...paciente, fecha_nacimiento: null }
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaMinima, paciente: sinFecha })
    expect(r.paciente.edad).toBeNull()
  })
})

describe('buildNotaRenderData — horaFormateada compacta', () => {
  it("origen 'consulta': deriva la hora de la fecha en TZ clínica, compacta 'a.m.'", () => {
    // 2026-07-21T15:00:00Z → 09:00 en America/Mexico_City (UTC-6, sin DST)
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.horaFormateada).toBe('9:00 a.m.')
  })

  it("origen 'formulario': usa la hora actual con el formato compacto esperado", () => {
    const r = buildNotaRenderData({
      origen: 'formulario',
      paciente,
      medicoVivo,
      fecha: '2026-07-21T15:00:00Z',
      notasEvolucion: null,
      diagnosticos: [],
      motivoConsulta: '',
    })
    expect(r.horaFormateada).toMatch(/^\d{1,2}:\d{2}\s[ap]\.m\.$/)
  })
})

describe('buildNotaRenderData — fechaCorta para el chip de encabezado', () => {
  it("origen 'consulta': formato corto 'dd / mmm / yyyy' en minúsculas sin puntos", () => {
    // 2026-07-21T15:00:00Z → 21 jul 2026 en America/Mexico_City
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.fechaCorta).toBe('21 / jul / 2026')
  })

  it("origen 'formulario': deriva la fecha corta de input.fecha", () => {
    const r = buildNotaRenderData({
      origen: 'formulario',
      paciente,
      medicoVivo,
      fecha: '2026-07-21T15:00:00Z',
      notasEvolucion: null,
      diagnosticos: [],
      motivoConsulta: '',
    })
    expect(r.fechaCorta).toBe('21 / jul / 2026')
  })
})

describe('buildNotaRenderData — origen formulario (datos en vuelo)', () => {
  it('arma la nota desde fuentes vivas sin snapshot', () => {
    const r = buildNotaRenderData({
      origen: 'formulario',
      paciente,
      medicoVivo,
      consultorio: { nombre: 'Consultorio Norte', nombre_corto: 'Norte', direccion: 'Calle 5', telefono: '999' },
      fecha: '2026-07-21T15:00:00Z',
      notasEvolucion: '**[PLAN]:**\nreposo relativo',
      diagnosticos: [{ descripcion: 'Gonalgia' }],
      motivoConsulta: 'Dolor de rodilla',
      signosVitales: { fc: 72 },
      proximaCita: '2026-08-01T15:00:00Z',
      notaOrigen: 'ia',
    })
    expect(r.medico.nombre).toBe('Dr. Angel Ancona Pérez')
    expect(r.medico.firmaUrl).toBe('https://vivo/firma.png')
    expect(r.consultorio.nombreCorto).toBe('Norte')
    expect(r.fechaFormateada).toBe('21 de julio de 2026')
    expect(r.proximaCita).toBe('1 de agosto de 2026')
    expect(r.diagnosticos).toEqual([{ descripcion: 'Gonalgia' }])
    expect(r.signosVitales?.fc).toBe(72)
    expect(r.notaParseada.secciones[0].tipo).toBe('plan')
    expect(r.notaOrigen).toBe('ia')
    expect(r.addendums).toEqual([])
  })

  it('formulario con campos mínimos no truena', () => {
    const r = buildNotaRenderData({
      origen: 'formulario',
      paciente,
      medicoVivo,
      fecha: '2026-07-21T15:00:00Z',
      notasEvolucion: null,
      diagnosticos: [],
      motivoConsulta: '',
    })
    expect(r.consultorio.nombreCorto).toBe('')
    expect(r.notaParseada).toEqual({ secciones: [] })
    expect(r.proximaCita).toBeNull()
    expect(r.notaOrigen).toBeNull()
    expect(r.signosVitales).toBeNull()
  })
})

describe('buildNotaRenderData — colores del perfil para tematizar el PDF', () => {
  it("origen 'formulario': toma color primario y secundario del médico vivo", () => {
    const r = buildNotaRenderData({
      origen: 'formulario',
      paciente,
      medicoVivo,
      fecha: '2026-07-21T15:00:00Z',
      notasEvolucion: null,
      diagnosticos: [],
      motivoConsulta: '',
    })
    expect(r.medico.colorPrimario).toBe('#1a3a5c')
    expect(r.medico.colorSecundario).toBe('#1e5fa8')
  })

  it("origen 'consulta': el color sale del médico vivo (no hay snapshot de color)", () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente, medicoVivo })
    expect(r.medico.colorPrimario).toBe('#1a3a5c')
    expect(r.medico.colorSecundario).toBe('#1e5fa8')
  })

  it("origen 'consulta' sin médico vivo → color undefined (la plantilla cae al fallback azul)", () => {
    const r = buildNotaRenderData({ origen: 'consulta', consulta: consultaSnapshot, paciente })
    expect(r.medico.colorPrimario).toBeUndefined()
    expect(r.medico.colorSecundario).toBeUndefined()
  })
})
