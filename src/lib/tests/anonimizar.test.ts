import { anonimizarTexto } from '../anonimizar'

// ── Helper ──
function test(nombre: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${nombre}`)
  } catch (e) {
    console.error(`  ❌ ${nombre}`)
    console.error(`     ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

// ── Tests ──

console.log('\n🔒 Tests de anonimización de PII\n')

// 1. Nombre completo mexicano
test('Redacta nombre completo mexicano', () => {
  const input = 'El paciente Juan Carlos López García presenta dolor abdominal'
  const result = anonimizarTexto(input)
  assert(!result.includes('Juan'), `Nombre "Juan" no fue redactado: "${result}"`)
  assert(!result.includes('López'), `Apellido "López" no fue redactado: "${result}"`)
  assert(!result.includes('García'), `Apellido "García" no fue redactado: "${result}"`)
  assert(result.includes('PACIENTE'), `No se insertó placeholder PACIENTE: "${result}"`)
  assert(result.includes('dolor abdominal'), `Se redactó dato clínico: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 2. CURP
test('Redacta CURP', () => {
  const input = 'CURP del paciente: LOGL850101HDFRRS09'
  const result = anonimizarTexto(input)
  assert(!result.includes('LOGL850101'), `CURP no fue redactado: "${result}"`)
  assert(result.includes('[CURP-REDACTADO]'), `Placeholder CURP no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 3. Email
test('Redacta email', () => {
  const input = 'Contactar al paciente en juan.lopez@gmail.com para seguimiento'
  const result = anonimizarTexto(input)
  assert(!result.includes('juan.lopez@gmail.com'), `Email no fue redactado: "${result}"`)
  assert(result.includes('[EMAIL-REDACTADO]'), `Placeholder email no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 4. Teléfono
test('Redacta teléfono mexicano', () => {
  const input = 'Teléfono de contacto: 9991234567'
  const result = anonimizarTexto(input)
  assert(!result.includes('9991234567'), `Teléfono no fue redactado: "${result}"`)
  assert(result.includes('[TEL-REDACTADO]'), `Placeholder teléfono no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

test('Redacta teléfono con formato', () => {
  const input = 'Tel: +52 999 123 4567'
  const result = anonimizarTexto(input)
  assert(!result.includes('999 123 4567'), `Teléfono formateado no fue redactado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 5. RFC
test('Redacta RFC', () => {
  const input = 'RFC: LOGL850101AB3'
  const result = anonimizarTexto(input)
  assert(!result.includes('LOGL850101AB3'), `RFC no fue redactado: "${result}"`)
  assert(result.includes('[RFC-REDACTADO]'), `Placeholder RFC no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 6. Número de expediente
test('Redacta número de expediente', () => {
  const input = 'Expediente EXP-2026-0042 del paciente'
  const result = anonimizarTexto(input)
  assert(!result.includes('EXP-2026-0042'), `Expediente no fue redactado: "${result}"`)
  assert(result.includes('[ID-REDACTADO]'), `Placeholder ID no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 7. UUID
test('Redacta UUID', () => {
  const input = 'paciente_id: fabe1695-070a-40fb-99dd-0611ebae5dc1'
  const result = anonimizarTexto(input)
  assert(!result.includes('fabe1695'), `UUID no fue redactado: "${result}"`)
  assert(result.includes('[ID-REDACTADO]'), `Placeholder UUID no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 8. Fecha de nacimiento en contexto
test('Redacta fecha de nacimiento en contexto', () => {
  const input = 'Fecha de nacimiento: 15/03/1985'
  const result = anonimizarTexto(input)
  assert(!result.includes('15/03/1985'), `Fecha de nacimiento no fue redactada: "${result}"`)
  assert(result.includes('[FECHA-NAC-REDACTADA]'), `Placeholder FN no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 9. Dirección postal
test('Redacta dirección postal', () => {
  const input = 'Domicilio: Calle 25 #204 Col. García Ginerés, CP 97070'
  const result = anonimizarTexto(input)
  assert(!result.includes('Calle 25'), `Dirección no fue redactada: "${result}"`)
  assert(result.includes('[DIRECCION-REDACTADA]'), `Placeholder dirección no insertado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 10. Términos médicos que NO deben redactarse
test('Preserva términos médicos (Diabetes Mellitus)', () => {
  const input = 'Diagnóstico: Diabetes Mellitus tipo 2 descontrolada'
  const result = anonimizarTexto(input)
  assert(result.includes('Diabetes Mellitus'), `Término médico fue redactado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

test('Preserva términos médicos (Artritis Reumatoide)', () => {
  const input = 'Paciente con Artritis Reumatoide seropositiva'
  const result = anonimizarTexto(input)
  assert(result.includes('Artritis Reumatoide'), `Término médico fue redactado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

test('Preserva términos médicos (Resonancia Magnética)', () => {
  const input = 'Se solicita Resonancia Magnética de columna lumbar'
  const result = anonimizarTexto(input)
  assert(result.includes('Resonancia Magnética'), `Término médico fue redactado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

test('Preserva síntomas y signos', () => {
  const input = 'paciente presenta cefalea intensa, náusea y vómito de 3 días de evolución'
  const result = anonimizarTexto(input)
  assert(result.includes('cefalea'), `Síntoma "cefalea" fue redactado: "${result}"`)
  assert(result.includes('náusea'), `Síntoma "náusea" fue redactado: "${result}"`)
  assert(result.includes('3 días de evolución'), `Tiempo de evolución fue redactado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

test('Preserva medicamentos', () => {
  const input = 'Se prescribe Ketorolaco 30mg IV cada 8 horas y Omeprazol 20mg VO cada 24 horas'
  const result = anonimizarTexto(input)
  assert(result.includes('Ketorolaco'), `Medicamento fue redactado: "${result}"`)
  assert(result.includes('Omeprazol'), `Medicamento fue redactado: "${result}"`)
  assert(result.includes('30mg'), `Dosis fue redactada: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

test('Preserva valores de laboratorio', () => {
  const input = 'Hemoglobina 12.5 g/dL, Glucosa 95 mg/dL, Creatinina 0.9 mg/dL'
  const result = anonimizarTexto(input)
  assert(result.includes('12.5'), `Valor de lab fue redactado: "${result}"`)
  assert(result.includes('Hemoglobina'), `Nombre de parámetro fue redactado: "${result}"`)
  console.log(`     Input:  "${input}"`)
  console.log(`     Output: "${result}"`)
})

// 11. Texto combinado con múltiples PII
test('Redacta múltiples PII en un solo texto', () => {
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
  assert(!result.includes('María'), `Nombre no redactado: "${result}"`)
  assert(!result.includes('Rodríguez'), `Apellido no redactado`)
  assert(!result.includes('ROCM900515'), `CURP no redactado`)
  assert(!result.includes('maria.rodriguez'), `Email no redactado`)
  assert(!result.includes('9995551234'), `Teléfono no redactado`)
  assert(!result.includes('EXP-2026-0105'), `Expediente no redactado`)

  // Datos clínicos preservados
  assert(result.includes('Dolor lumbar crónico'), `Motivo redactado`)
  assert(result.includes('6 meses de evolución'), `Tiempo de evolución redactado`)
  assert(result.includes('Lasègue positivo'), `Exploración física redactada`)
  assert(result.includes('hernia discal'), `Diagnóstico redactado`)
  assert(result.includes('Resonancia Magnética'), `Término médico redactado`)
  assert(result.includes('radiculopatía'), `Diagnóstico específico redactado`)

  console.log(`     Input (extracto): "${input.slice(0, 80)}..."`)
  console.log(`     Output (extracto): "${result.slice(0, 120)}..."`)
})

// 12. Texto vacío y null
test('Maneja texto vacío', () => {
  assert(anonimizarTexto('') === '', 'Texto vacío no devolvió vacío')
})

test('Maneja texto sin PII', () => {
  const input = 'paciente refiere dolor torácico opresivo de inicio súbito'
  const result = anonimizarTexto(input)
  assert(result === input, `Texto sin PII fue modificado: "${result}"`)
})

console.log('\n✅ Tests completados\n')
