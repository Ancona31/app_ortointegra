import { differenceInYears, differenceInMonths, differenceInDays } from 'date-fns'
import { hoyEnTZ, fechaSoloSegura } from '@/lib/dates'

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

/**
 * Normaliza un string para búsqueda y comparación de pacientes.
 *
 * Aplica: trim() + colapso de espacios internos + lowercase.
 * NO normaliza tildes: la extensión unaccent está instalada en BD pero
 * todavía no cableada en las queries de búsqueda/detección (deuda E5-DT-23).
 *
 * Convergente con la primera mitad de toTitleCase: ambos aplican trim +
 * colapso de espacios; toTitleCase añade capitalización; este helper añade
 * lowercase para normalizar input antes de comparar contra valores ya
 * guardados con toTitleCase (que mantiene tildes y capitalización).
 *
 * Uso típico:
 * - Input al endpoint /api/pacientes para detección TS-side de duplicados.
 * - Cualquier comparación case-insensitive entre input y valor en BD.
 *
 * @param s String a normalizar (puede ser null/undefined; devuelve '').
 * @returns String normalizado o cadena vacía si entrada inválida.
 */
export function normalizarParaBusqueda(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
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
  const nacimiento = fechaSoloSegura(fechaNacimiento)
  const hoy = fechaSoloSegura(hoyEnTZ())

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
  return hoyEnTZ()
}

/** Fecha mínima razonable para un paciente (1900-01-01) */
export const FECHA_MIN_NACIMIENTO = '1900-01-01'

/* ──────────────────────────────────────────────────────────────────────
   Nomenclatura de archivos PDF
   ────────────────────────────────────────────────────────────────────── */

/**
 * Elimina acentos y caracteres especiales de un string.
 * "María José López-Ñúñez" → "Maria Jose Lopez-Nunez"
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Genera un nombre de archivo estandarizado para documentos PDF.
 *
 * Formato: YYYY-MM-DD_HHmm_TipoDoc_NombrePaciente.pdf
 * Ejemplo: 2026-04-16_1430_Receta_Juan_Garcia_Lopez.pdf
 *
 * - Reemplaza espacios por guiones bajos
 * - Elimina acentos y caracteres no alfanuméricos (excepto - y _)
 * - Si el paciente está vacío, usa "Sin_Nombre"
 */
export function generateDocFileName(
  nombrePaciente: string,
  tipoDocumento: string,
  fecha?: Date,
): string {
  const d = fecha ?? new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')

  const timestamp = `${yyyy}-${mm}-${dd}_${hh}${min}`

  const tipo = removeAccents(tipoDocumento.trim())
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')

  const paciente = nombrePaciente.trim()
    ? removeAccents(nombrePaciente.trim())
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
    : 'Sin_Nombre'

  return `${timestamp}_${tipo}_${paciente}.pdf`
}

/* ──────────────────────────────────────────────────────────────────────
   Edad → fecha de nacimiento ficticia
   ────────────────────────────────────────────────────────────────────── */

/**
 * Convierte una edad en años a una fecha de nacimiento ficticia
 * usando convención 1 de enero del año calculado.
 *
 * Uso: cuando el paciente no recuerda su fecha exacta de nacimiento,
 * el médico o secretaria ingresa solo la edad y este helper calcula
 * una fecha ficticia compatible con la columna fecha_nacimiento.
 *
 * La convención 01-01 (1 de enero) hace evidente que es aproximada,
 * a diferencia de una fecha intermedia del año que podría confundirse
 * con un dato real.
 *
 * @param edad - Edad en años (entero positivo entre 0 y 120)
 * @returns Fecha en formato 'YYYY-MM-DD'
 * @example
 *   edadAFechaFicticia(35) // → '1991-01-01' (si año actual es 2026)
 */
export function edadAFechaFicticia(edad: number): string {
  const anioActual = Number(hoyEnTZ().slice(0, 4))
  const anioNacimiento = anioActual - edad
  return `${anioNacimiento}-01-01`
}
