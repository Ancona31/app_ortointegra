/**
 * Sanitiza inputs de texto antes de interpolarlos en prompts de IA.
 * Previene prompt injection eliminando patrones de instrucciones maliciosas
 * y truncando el texto al límite especificado.
 */
export function sanitizePromptInput(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return ''

  return input
    // Truncar al límite
    .slice(0, maxLength)
    // Eliminar caracteres de control (salvo saltos de línea y tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Neutralizar patrones comunes de prompt injection
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, '[texto omitido]')
    .replace(/system\s*:/gi, '[texto omitido]')
    .replace(/\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/g, '[texto omitido]')
    .trim()
}

/**
 * Sanitiza un número: devuelve el número si es válido, null si no.
 */
export function sanitizeNumber(value: unknown): number | null {
  const n = Number(value)
  return isFinite(n) && !isNaN(n) ? n : null
}
