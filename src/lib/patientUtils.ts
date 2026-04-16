import { differenceInYears, differenceInMonths, differenceInDays, parseISO } from 'date-fns'

/* ──────────────────────────────────────────────────────────────────────
   Title Case — normalización de nombres de pacientes
   ────────────────────────────────────────────────────────────────────── */

/** Partículas que se mantienen en minúscula (excepto como primera palabra) */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

/**
 * Convierte un string a Title Case respetando partículas del español.
 * Limpia espacios extra y normaliza a un solo espacio entre palabras.
 *
 * "JUAN CARLOS de la CRUZ" → "Juan Carlos de la Cruz"
 * "maría del carmen" → "María del Carmen"
 */
export function toTitleCase(str: string): string {
  const palabras = str.trim().replace(/\s+/g, ' ').toLowerCase().split(' ')

  return palabras
    .map((palabra, i) => {
      if (i > 0 && PARTICULAS.has(palabra)) return palabra
      if (palabra.length === 0) return ''
      return palabra.charAt(0).toUpperCase() + palabra.slice(1)
    })
    .join(' ')
}

/* ──────────────────────────────────────────────────────────────────────
   Cálculo de edad — precisión médica
   ────────────────────────────────────────────────────────────────────── */

export interface EdadPaciente {
  anios: number
  meses: number
  totalMeses: number
  textoElegante: string
}

/**
 * Calcula la edad cronológica exacta de un paciente.
 *
 * Reglas de negocio para textoElegante:
 *   - < 1 mes        → "Recién nacido" o "X días"
 *   - 1-23 meses     → "X meses"
 *   - ≥ 2 años       → "X años"
 */
export function calcularEdad(fechaNacimiento: string): EdadPaciente {
  const nacimiento = parseISO(fechaNacimiento)
  const hoy = new Date()

  const anios = differenceInYears(hoy, nacimiento)
  const totalMeses = differenceInMonths(hoy, nacimiento)
  const mesesRestantes = totalMeses - (anios * 12)

  let textoElegante: string

  if (totalMeses < 1) {
    const dias = differenceInDays(hoy, nacimiento)
    textoElegante = dias <= 0 ? 'Recién nacido' : `${dias} día${dias === 1 ? '' : 's'}`
  } else if (totalMeses < 24) {
    textoElegante = `${totalMeses} mes${totalMeses === 1 ? '' : 'es'}`
  } else {
    textoElegante = `${anios} año${anios === 1 ? '' : 's'}`
  }

  return {
    anios,
    meses: mesesRestantes,
    totalMeses,
    textoElegante,
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Validación de fecha de nacimiento
   ────────────────────────────────────────────────────────────────────── */

/** Fecha de hoy en formato YYYY-MM-DD (para attr max de input[type=date]) */
export function fechaHoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fecha mínima razonable para un paciente (1900-01-01) */
export const FECHA_MIN_NACIMIENTO = '1900-01-01'
