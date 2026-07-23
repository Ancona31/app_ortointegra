import { describe, it, expect } from 'vitest'
import { anonimizarTexto } from '@/lib/anonimizar'

describe('anonimizarTexto — redacción de PII', () => {
  it('redacta nombre completo mexicano y conserva el dato clínico', () => {
    const result = anonimizarTexto('El paciente Juan Carlos López García presenta dolor abdominal')
    expect(result).not.toContain('Juan')
    expect(result).not.toContain('López')
    expect(result).not.toContain('García')
    expect(result).toContain('PACIENTE')
    expect(result).toContain('dolor abdominal')
  })

  it('redacta CURP', () => {
    const result = anonimizarTexto('CURP del paciente: LOGL850101HDFRRS09')
    expect(result).not.toContain('LOGL850101')
    expect(result).toContain('[CURP-REDACTADO]')
  })

  it('redacta email', () => {
    const result = anonimizarTexto('Contactar al paciente en juan.lopez@gmail.com para seguimiento')
    expect(result).not.toContain('juan.lopez@gmail.com')
    expect(result).toContain('[EMAIL-REDACTADO]')
  })

  it('redacta teléfono mexicano', () => {
    const result = anonimizarTexto('Teléfono de contacto: 9991234567')
    expect(result).not.toContain('9991234567')
    expect(result).toContain('[TEL-REDACTADO]')
  })

  it('redacta teléfono con formato', () => {
    const result = anonimizarTexto('Tel: +52 999 123 4567')
    expect(result).not.toContain('999 123 4567')
  })

  it('redacta RFC', () => {
    const result = anonimizarTexto('RFC: LOGL850101AB3')
    expect(result).not.toContain('LOGL850101AB3')
    expect(result).toContain('[RFC-REDACTADO]')
  })

  it('redacta número de expediente', () => {
    const result = anonimizarTexto('Expediente EXP-2026-0042 del paciente')
    expect(result).not.toContain('EXP-2026-0042')
    expect(result).toContain('[ID-REDACTADO]')
  })

  it('redacta UUID', () => {
    const result = anonimizarTexto('paciente_id: fabe1695-070a-40fb-99dd-0611ebae5dc1')
    expect(result).not.toContain('fabe1695')
    expect(result).toContain('[ID-REDACTADO]')
  })

  it('redacta fecha de nacimiento en contexto', () => {
    const result = anonimizarTexto('Fecha de nacimiento: 15/03/1985')
    expect(result).not.toContain('15/03/1985')
    expect(result).toContain('[FECHA-NAC-REDACTADA]')
  })

  it('redacta dirección postal', () => {
    const result = anonimizarTexto('Domicilio: Calle 25 #204 Col. García Ginerés, CP 97070')
    expect(result).not.toContain('Calle 25')
    expect(result).toContain('[DIRECCION-REDACTADA]')
  })
})

describe('anonimizarTexto — preservación de contenido clínico', () => {
  it('preserva términos médicos (Diabetes Mellitus)', () => {
    const result = anonimizarTexto('Diagnóstico: Diabetes Mellitus tipo 2 descontrolada')
    expect(result).toContain('Diabetes Mellitus')
  })

  it('preserva términos médicos (Artritis Reumatoide)', () => {
    const result = anonimizarTexto('Paciente con Artritis Reumatoide seropositiva')
    expect(result).toContain('Artritis Reumatoide')
  })

  it('preserva términos médicos (Resonancia Magnética)', () => {
    const result = anonimizarTexto('Se solicita Resonancia Magnética de columna lumbar')
    expect(result).toContain('Resonancia Magnética')
  })

  it('preserva síntomas, signos y tiempo de evolución', () => {
    const result = anonimizarTexto('paciente presenta cefalea intensa, náusea y vómito de 3 días de evolución')
    expect(result).toContain('cefalea')
    expect(result).toContain('náusea')
    expect(result).toContain('3 días de evolución')
  })

  it('preserva medicamentos y dosis', () => {
    const result = anonimizarTexto('Se prescribe Ketorolaco 30mg IV cada 8 horas y Omeprazol 20mg VO cada 24 horas')
    expect(result).toContain('Ketorolaco')
    expect(result).toContain('Omeprazol')
    expect(result).toContain('30mg')
  })

  it('preserva valores de laboratorio', () => {
    const result = anonimizarTexto('Hemoglobina 12.5 g/dL, Glucosa 95 mg/dL, Creatinina 0.9 mg/dL')
    expect(result).toContain('12.5')
    expect(result).toContain('Hemoglobina')
  })
})

describe('anonimizarTexto — texto combinado y bordes', () => {
  it('redacta múltiples PII en un solo texto sin tocar los datos clínicos', () => {
    const input = `María Fernanda Rodríguez Castillo, CURP: ROCM900515MDFRRL08,
RFC: ROCM900515AB1, email: maria.rodriguez@hotmail.com, Tel: 9995551234.
Domicilio: Avenida Colón #456 Col. Centro, CP 97000.
Expediente EXP-2026-0105.
Motivo de consulta: Dolor lumbar crónico de 6 meses de evolución,
irradiado a miembro pélvico derecho. Exploración física: Lasègue positivo
a 35° derecho. Resonancia Magnética muestra hernia discal L4-L5.
Diagnóstico: Hernia discal con radiculopatía L5 derecha.`

    const result = anonimizarTexto(input)

    // PII redactada
    expect(result).not.toContain('María')
    expect(result).not.toContain('Rodríguez')
    expect(result).not.toContain('ROCM900515')
    expect(result).not.toContain('maria.rodriguez')
    expect(result).not.toContain('9995551234')
    expect(result).not.toContain('EXP-2026-0105')

    // Datos clínicos preservados
    expect(result).toContain('Dolor lumbar crónico')
    expect(result).toContain('6 meses de evolución')
    expect(result).toContain('Lasègue positivo')
    expect(result).toContain('hernia discal')
    expect(result).toContain('Resonancia Magnética')
    expect(result).toContain('radiculopatía')
  })

  it('maneja texto vacío', () => {
    expect(anonimizarTexto('')).toBe('')
  })

  it('maneja texto sin PII sin modificarlo', () => {
    const input = 'paciente refiere dolor torácico opresivo de inicio súbito'
    expect(anonimizarTexto(input)).toBe(input)
  })
})
