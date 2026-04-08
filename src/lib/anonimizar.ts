/**
 * Anonimización de datos personales identificables (PII) en texto clínico.
 *
 * FUNDAMENTO LEGAL:
 * La Ley Federal de Protección de Datos Personales en Posesión de los
 * Particulares (LFPDPPP) clasifica los datos de salud como "datos personales
 * sensibles" (Art. 3, fracción VI). El Art. 9 exige consentimiento expreso
 * para su tratamiento. Esta función minimiza la exposición de PII al enviar
 * datos clínicos a APIs externas (Google Gemini, Anthropic Claude),
 * cumpliendo con el principio de minimización de datos (Art. 6, fracción III).
 *
 * PRESERVA: síntomas, signos vitales, medicamentos, diagnósticos, valores
 * de laboratorio, antecedentes clínicos — datos necesarios para que la IA
 * genere contenido médico útil.
 *
 * REDACTA: nombres propios, CURP, RFC, teléfonos, emails, direcciones
 * postales, números de expediente y cualquier identificador directo.
 */

// ── Patrones de PII ──────────────────────────────────────────────────────

// CURP: 18 caracteres alfanuméricos con formato específico
const CURP_RE = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi

// RFC: 12-13 caracteres alfanuméricos
const RFC_RE = /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3}\b/gi

// Teléfono mexicano: 10 dígitos con o sin formato
const PHONE_RE = /(?:\+?52\s?)?(?:\(?\d{2,3}\)?\s?)?[\d\s\-]{7,10}\d/g

// Email
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Número de expediente (formato EXP-YYYY-NNNN o variaciones)
const EXPEDIENTE_RE = /\b(?:EXP|exp|Exp)[-\s]?\d{4}[-\s]?\d{2,6}\b/g

// UUID
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

// Fecha de nacimiento en contexto (después de "nacimiento", "nació", "FN:", etc.)
const FN_CONTEXT_RE = /(?:nacimiento|naci[óo]|FN|f\.?\s*n\.?)\s*[:=]?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/gi

// Dirección postal (calle + número + colonia pattern)
const ADDRESS_RE = /(?:calle|av(?:enida)?|blvd|boulevard|carretera|privada|fraccionamiento|col(?:onia)?\.?)\s+[^\n,]{5,60}(?:,\s*(?:col|cp|c\.?p\.?|mz|lt|int|ext|depto|num|#)[\s\S]{0,40})?/gi

// Nombres propios: 2-4 palabras capitalizadas seguidas (heurística)
// Solo se aplica cuando el texto NO es un término médico conocido
const PROPER_NAME_RE = /\b(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\s+(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})(?:\s+(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})){0,2}\b/g

// Términos médicos comunes que NO deben redactarse aunque parezcan nombres
const MEDICAL_TERMS = new Set([
  // Anatomía
  'Arteria Femoral', 'Arteria Carótida', 'Nervio Ciático', 'Columna Lumbar',
  'Columna Cervical', 'Columna Torácica', 'Plexo Braquial', 'Tendón Aquiles',
  'Ganglio Centinela', 'Músculo Cuádriceps', 'Ligamento Cruzado',
  // Síndromes y enfermedades
  'Síndrome Down', 'Enfermedad Parkinson', 'Enfermedad Alzheimer',
  'Síndrome Turner', 'Síndrome Cushing', 'Síndrome Guillain',
  'Diabetes Mellitus', 'Lupus Eritematoso', 'Artritis Reumatoide',
  'Esclerosis Múltiple', 'Hernia Discal', 'Insuficiencia Renal',
  'Insuficiencia Cardíaca', 'Hipertensión Arterial', 'Infarto Agudo',
  // Escalas y clasificaciones
  'Escala Glasgow', 'Escala Norton', 'Escala Daniels', 'Escala Ashworth',
  'Clasificación Kellgren', 'Grado Fisher', 'Estadio Tanner',
  // Medicamentos comunes (2 palabras)
  'Ácido Acetilsalicílico', 'Ácido Fólico', 'Vitamina D',
  // Procedimientos
  'Resonancia Magnética', 'Tomografía Computarizada', 'Rayos X',
  'Ultrasonido Doppler', 'Punción Lumbar', 'Biopsia Hepática',
  // Estudios de laboratorio
  'Biometría Hemática', 'Química Sanguínea', 'Proteína Reactiva',
  'Velocidad Sedimentación', 'Tiempo Protrombina', 'Factor Reumatoide',
])

function esMedico(texto: string): boolean {
  const lower = texto.toLowerCase()
  for (const term of MEDICAL_TERMS) {
    if (lower === term.toLowerCase()) return true
  }
  return false
}

// ── Función principal ────────────────────────────────────────────────────

/**
 * Anonimiza texto clínico reemplazando PII con placeholders.
 * Preserva datos clínicos necesarios para la IA.
 */
export function anonimizarTexto(texto: string): string {
  if (!texto) return texto

  let result = texto

  // Orden: patrones más específicos primero para evitar falsos positivos
  result = result.replace(CURP_RE, '[CURP-REDACTADO]')
  result = result.replace(RFC_RE, '[RFC-REDACTADO]')
  result = result.replace(EMAIL_RE, '[EMAIL-REDACTADO]')
  result = result.replace(EXPEDIENTE_RE, '[ID-REDACTADO]')
  result = result.replace(UUID_RE, '[ID-REDACTADO]')
  result = result.replace(FN_CONTEXT_RE, '[FECHA-NAC-REDACTADA]')
  result = result.replace(PHONE_RE, '[TEL-REDACTADO]')
  result = result.replace(ADDRESS_RE, '[DIRECCION-REDACTADA]')

  // Nombres propios: reemplazar solo si NO son términos médicos
  result = result.replace(PROPER_NAME_RE, (match) => {
    if (esMedico(match)) return match
    return 'PACIENTE'
  })

  return result
}

/**
 * Anonimiza un array de mensajes de chat (historial de consulta rápida).
 */
export function anonimizarHistorial(
  mensajes: { rol: string; texto: string }[]
): { rol: string; texto: string }[] {
  return mensajes.map(m => ({
    ...m,
    texto: anonimizarTexto(m.texto),
  }))
}
