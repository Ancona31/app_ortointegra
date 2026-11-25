import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bloqueDeFaltante, camposDePlantilla, estadoBorrador, estadoSeccion, faltantesConsentimiento,
  fechaYEdadAlFirmar, noPuedeFirmarDe, ofreceRegenerar, plantillaConsentimiento, quienFirmaDe,
  resumenAutorizaciones, resumenDatos, resumenFirmantes, resumenTexto, TEXTO_CASILLA_FOTOS,
  CLAVES_SECCION, type ClaveSeccion,
} from '@/components/documentos/consentimientoEmbudo'

const DEF: Record<ClaveSeccion, string> = {
  preoperatorio: 'p', beneficios: 'b', anestesia: 'a', descripcion: '',
  riesgosComunes: 'rc', riesgosEspecificos: '', alternativas: 'al',
}
const completo = {
  fecha: '2026-11-22', lugar: 'Hospital', paciente: 'Paciente Prueba 01', edad: '73 años',
  diagnostico: 'Dx', procedimiento: 'Proc', familiar: '', pacienteNoPuedeFirmar: false,
  autorizaTransfusion: 'si' as const, secciones: { ...DEF, descripcion: 'd', riesgosEspecificos: 'r' },
  esDenegacion: false,
}

describe('faltantes (las mismas reglas de siempre)', () => {
  it('consentimiento completo: ninguno', () => {
    expect(faltantesConsentimiento(completo)).toEqual([])
  })
  it('los nueve, en orden de lectura', () => {
    const f = faltantesConsentimiento({
      ...completo, fecha: '', lugar: ' ', paciente: '', edad: '', diagnostico: '', procedimiento: '',
      pacienteNoPuedeFirmar: true, autorizaTransfusion: null, secciones: DEF,
    })
    expect(f.map(x => x.clave)).toEqual([
      'fecha', 'lugar', 'paciente', 'edad', 'diagnostico', 'procedimiento', 'familiar',
      'transfusion', 'seccion-descripcion', 'seccion-riesgosEspecificos',
    ])
    expect(f.find(x => x.clave === 'seccion-descripcion')?.nombre).toBe('Descripción del procedimiento')
  })
  it('familiar sólo obligatorio si el paciente no puede firmar', () => {
    expect(faltantesConsentimiento({ ...completo, familiar: '' }).some(x => x.clave === 'familiar')).toBe(false)
    expect(faltantesConsentimiento({ ...completo, pacienteNoPuedeFirmar: true }).map(x => x.clave)).toEqual(['familiar'])
  })
  it('denegación: sin diagnóstico, transfusión ni secciones; familiar siempre', () => {
    const f = faltantesConsentimiento({ ...completo, esDenegacion: true, diagnostico: '', autorizaTransfusion: null, secciones: DEF })
    expect(f.map(x => x.clave)).toEqual(['familiar'])
  })
  it('cada faltante cae en su bloque', () => {
    expect(['lugar', 'edad', 'fecha'].map(bloqueDeFaltante)).toEqual(['dat', 'dat', 'dat'])
    expect(bloqueDeFaltante('seccion-descripcion')).toBe('txt')
    expect(bloqueDeFaltante('transfusion')).toBe('aut')
    expect(bloqueDeFaltante('familiar')).toBe('fir')
  })
})

describe('resúmenes de los bloques', () => {
  it('datos', () => {
    expect(resumenDatos({ paciente: 'Ana', edad: '70 años', procedimiento: 'Artrodesis', lugar: 'H', diagnostico: 'D' }))
      .toEqual({ texto: 'Ana · 70 años · Artrodesis', completa: true })
    expect(resumenDatos({ paciente: '', edad: '', procedimiento: '', lugar: '', diagnostico: '' }))
      .toEqual({ texto: 'Sin datos', completa: false })
  })
  it('texto: estándar, escrita por ti, obligatoria que falta', () => {
    expect(estadoSeccion('p', 'p', false)).toBe('estandar')
    expect(estadoSeccion('otro', 'p', false)).toBe('propia')
    expect(estadoSeccion('  ', '', true)).toBe('falta')
    expect(resumenTexto(DEF, DEF)).toEqual({ texto: 'Faltan 2 secciones obligatorias', completa: false })
    expect(resumenTexto({ ...DEF, descripcion: 'x' }, DEF).texto).toBe('Falta 1 sección obligatoria')
    expect(resumenTexto(completo.secciones, DEF)).toEqual({ texto: '7 secciones · 2 escritas por ti', completa: true })
  })
  it('autorizaciones: la transfusión no tiene valor por defecto', () => {
    expect(resumenAutorizaciones(null, true).completa).toBe(false)
    expect(resumenAutorizaciones('no', true).texto).toBe('Transfusión: No · Fotografías: Sí')
  })
  it('quién firma', () => {
    expect(resumenFirmantes({ pacienteNoPuedeFirmar: false, familiar: '', testigo1: '', testigo2: '' }).texto)
      .toBe('Firma el paciente · sin testigos')
    expect(resumenFirmantes({ pacienteNoPuedeFirmar: true, familiar: '', testigo1: 'J', testigo2: '' }))
      .toEqual({ texto: 'Firma un familiar o representante · 1 testigo', completa: false })
    expect(resumenFirmantes({ pacienteNoPuedeFirmar: true, familiar: 'María', testigo1: 'J', testigo2: 'K' }).texto)
      .toBe('Firma María · 2 testigos')
  })
})

describe('quién firma ⇄ pacienteNoPuedeFirmar', () => {
  it('ida y vuelta', () => {
    expect(quienFirmaDe(false)).toBe('paciente')
    expect(quienFirmaDe(true)).toBe('familiar')
    expect(noPuedeFirmarDe('familiar')).toBe(true)
    expect(noPuedeFirmarDe(quienFirmaDe(false))).toBe(false)
  })
})

describe('fecha y edad al firmar (CI-DT-3)', () => {
  const fn = '1953-02-11'
  it('la fecha pasa a hoy', () => {
    expect(fechaYEdadAlFirmar({ hoy: '2026-11-22', fechaActual: '2026-01-05', edadActual: '72 años', fechaNacimiento: fn }).fecha)
      .toBe('2026-11-22')
  })
  it('la edad de la ficha del día del borrador se recalcula', () => {
    // El 5 de enero de 2026 tenía 72; el 22 de noviembre, 73.
    expect(fechaYEdadAlFirmar({ hoy: '2026-11-22', fechaActual: '2026-01-05', edadActual: '72 años', fechaNacimiento: fn }))
      .toEqual({ fecha: '2026-11-22', edad: '73 años', edadManual: false })
  })
  it('la edad tecleada a mano se respeta y se marca', () => {
    expect(fechaYEdadAlFirmar({ hoy: '2026-11-22', fechaActual: '2026-01-05', edadActual: '72 años y medio', fechaNacimiento: fn }))
      .toEqual({ fecha: '2026-11-22', edad: '72 años y medio', edadManual: true })
  })
  it('sin fecha de nacimiento, no hay con qué recalcular', () => {
    expect(fechaYEdadAlFirmar({ hoy: '2026-11-22', fechaActual: '2026-01-05', edadActual: '50 años' }))
      .toEqual({ fecha: '2026-11-22', edad: '50 años', edadManual: true })
  })
  it('vacía y con ficha, la de hoy', () => {
    expect(fechaYEdadAlFirmar({ hoy: '2026-11-22', fechaActual: '2026-11-22', edadActual: '', fechaNacimiento: fn }).edad).toBe('73 años')
  })
})

describe('plantillas sin testigos (CI-DT-19)', () => {
  it('guardar no incluye testigos', () => {
    const p = plantillaConsentimiento('H', 'P', DEF)
    expect(Object.keys(p).sort()).toEqual(['_v', 'lugar', 'procedimiento', 'secciones'])
  })
  it('una plantilla antigua con testigos no los trae', () => {
    const c = camposDePlantilla({ lugar: 'H', procedimiento: 'P', testigo1: 'Otro', testigo2: 'Más' })
    expect(c).toEqual({ lugar: 'H', procedimiento: 'P' })
  })
})

describe('estado de un borrador', () => {
  it('completo: «Falta firmar»', () => {
    expect(estadoBorrador({ ...completo }).etiqueta).toBe('Falta firmar')
  })
  it('con faltantes: «Faltan N datos»', () => {
    expect(estadoBorrador({ paciente: 'Ana', edad: '54 años', lugar: 'H', diagnostico: 'D', procedimiento: 'P', fecha: '2026-11-01' }))
      .toEqual({ etiqueta: 'Faltan 3 datos', faltan: 3 })
    expect(estadoBorrador({ ...completo, autorizaTransfusion: null }).etiqueta).toBe('Falta 1 dato')
    expect(estadoBorrador(null).faltan).toBeGreaterThan(0)
  })
})

describe('regenerar (CI-DT-1)', () => {
  it('un consentimiento sellado no se regenera; una receta sí', () => {
    expect(ofreceRegenerar('consentimiento_informado', 'firmado')).toBe(false)
    expect(ofreceRegenerar('denegacion_consentimiento', 'firmado')).toBe(false)
    expect(ofreceRegenerar('consentimiento_informado', 'emitido_firma_manual')).toBe(true)
    expect(ofreceRegenerar('receta', 'firmado')).toBe(true)
    expect(ofreceRegenerar('receta', 'emitido_firma_manual')).toBe(true)
  })
})

describe('texto de la casilla de fotografías (CI-DT-4)', () => {
  it('dice la misma finalidad que el PDF', () => {
    const pdf = readFileSync(join(process.cwd(), 'src/lib/pdf/v2/formatos/ConsentimientoInformado.tsx'), 'utf8')
    const finalidad = 'fotografías clínicas con fines de documentación médica y seguimiento del tratamiento'
    expect(pdf).toContain(finalidad)
    expect(TEXTO_CASILLA_FOTOS).toContain(finalidad)
    expect(TEXTO_CASILLA_FOTOS).not.toMatch(/educativ|académic|publicaci/)
  })
  it('las siete claves de siempre (preoperatorio incluida)', () => {
    expect(CLAVES_SECCION).toEqual(['preoperatorio', 'beneficios', 'anestesia', 'descripcion', 'riesgosComunes', 'riesgosEspecificos', 'alternativas'])
  })
})
