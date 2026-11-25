/**
 * Lógica pura de la receta compacta (un medicamento abierto, los demás
 * plegados). Sin React: lo prueban `src/lib/tests/recetaCompacta.test.ts`.
 *
 * ⚠️ NO CAMBIA LO QUE SE GUARDA: cada medicamento sigue siendo el mismo objeto
 * de seis claves (`nombre_comercial`, `presentacion`, `dosis`,
 * `principio_activo`, `indicacion`, `via_administracion`) que leen el PDF, el
 * expediente y las plantillas. Aquí sólo se decide qué falta y cómo se busca.
 */
import { MEDICAMENTOS, VIAS, type MedicamentoDB, type Via } from '@/data/medicamentos'
import type { Medicamento } from '@/types'

export type MedicamentoConVia = Medicamento & { via_administracion?: string }

/** Los cuatro botones rápidos de la vía; el resto va en «Otra…». */
export const VIAS_RAPIDAS: readonly { corta: string; via: Via }[] = [
  { corta: 'Oral', via: 'Oral' },
  { corta: 'IM', via: 'Intramuscular' },
  { corta: 'IV', via: 'Intravenosa' },
  { corta: 'Tópica', via: 'Tópica' },
]
export const VIAS_OTRAS: readonly Via[] = VIAS.filter(v => !VIAS_RAPIDAS.some(r => r.via === v))

/** Frases frecuentes que las fichas añaden al final de las indicaciones. */
export const FRASES = ['cada 8 horas', 'cada 12 horas', 'cada 24 horas', 'por 5 días', 'por 7 días', 'con alimentos', 'en caso de dolor'] as const

/** Minúsculas y sin acentos, para buscar «diclofenaco» o «PARACETAMOL» igual. */
export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Rótulo corto de la etiqueta de la línea plegada. */
export function etiquetaVia(via: string): string {
  const corta: Record<string, string> = { Intramuscular: 'IM', Intravenosa: 'IV', 'Subcutánea': 'SC' }
  return corta[via] ?? via
}

/** Familia de color de la etiqueta de vía (sólo pantalla; el PDF no la usa). */
export type ColorVia = 'oral' | 'im' | 'iv' | 'top' | 'sc' | 'otra'
export function colorVia(via: string): ColorVia {
  const tabla: Record<string, ColorVia> = {
    Oral: 'oral', Intramuscular: 'im', Intravenosa: 'iv', 'Tópica': 'top', 'Transdérmica': 'top', 'Subcutánea': 'sc',
  }
  return tabla[via] ?? 'otra'
}

/**
 * Busca en el catálogo por nombre comercial Y por genérico, sin acentos. Antes
 * van los comerciales que EMPIEZAN por lo escrito, luego los que lo contienen
 * y al final los que sólo coinciden por el genérico. Menos de 2 letras: nada.
 */
export function buscarEnCatalogo(
  texto: string, catalogo: readonly MedicamentoDB[] = MEDICAMENTOS, max = 8,
): MedicamentoDB[] {
  const q = sinAcentos(texto.trim())
  if (q.length < 2) return []
  const rango = (m: MedicamentoDB): number => {
    const c = sinAcentos(m.nombre_comercial)
    if (c.startsWith(q)) return 0
    if (c.includes(q)) return 1
    return sinAcentos(m.principio_activo).includes(q) ? 2 : -1
  }
  return catalogo
    .map((m, i) => ({ m, r: rango(m), i }))
    .filter(x => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, max)
    .map(x => x.m)
}

/**
 * Alguno de los cuatro campos de texto tiene contenido. La vía NO cuenta: un
 * bloque en el que sólo se tocó la vía no es un bloque escrito.
 */
export function conTexto(m: MedicamentoConVia): boolean {
  return !!(m.nombre_comercial.trim() || m.presentacion?.trim()
    || m.principio_activo?.trim() || m.indicacion.trim())
}

/** Los dos obligatorios de siempre del formato: comercial y genérico (§4). */
export function estaCompleto(m: MedicamentoConVia): boolean {
  return !!(m.nombre_comercial.trim() && m.principio_activo?.trim())
}

export type Falta = 'comercial' | 'generico' | 'via'

/**
 * Qué le falta a un medicamento CON ALGO ESCRITO para poder imprimirse:
 * los dos obligatorios de siempre más la vía (decisión del dueño, receta
 * compacta). Un bloque vacío no falta nada: se ignora, como siempre.
 */
export function faltasDe(m: MedicamentoConVia): Falta[] {
  if (!conTexto(m)) return []
  const f: Falta[] = []
  if (!m.nombre_comercial.trim()) f.push('comercial')
  if (!m.principio_activo?.trim()) f.push('generico')
  if (!m.via_administracion?.trim()) f.push('via')
  return f
}

export const NOMBRE_FALTA: Record<Falta, string> = {
  comercial: 'nombre comercial',
  generico: 'genérico',
  via: 'vía',
}

/*
 * Heurística de la pauta (aviso suave, NO bloquea). Se mira el texto sin
 * acentos y en minúsculas.
 *   Frecuencia: «cada», «c/», «horas», «hrs», «h» tras un número («8 h»,
 *     «8h»), «diario/diaria», «al día», «veces», «dosis única», «semanal»,
 *     «quincenal», «mensual», «anual», «en ayunas», «por la mañana/noche».
 *   Duración: «por» (por 7 días, por la noche…: es una heurística), «días»,
 *     «semanas», «meses», «dosis única», «en caso de», «hasta», «continuo»,
 *     «indefinido».
 * Falla hacia el aviso, nunca hacia el bloqueo: lo peor que hace es preguntar
 * de más.
 */
const RE_FRECUENCIA = /\bcada\b|\bc\/|\bhoras?\b|\bhrs?\b|\d\s*h\b|\bdiari[oa]s?\b|\bal dia\b|\bveces\b|\bdosis unica\b|\bsemanal\b|\bquincenal\b|\bmensual\b|\banual\b|\ben ayunas\b|\bpor la (manana|tarde|noche)\b/
const RE_DURACION = /\bpor\b|\bdias?\b|\bsemanas?\b|\bmes(es)?\b|\bdosis unica\b|\ben caso de\b|\bhasta\b|\bcontinu[oa]\b|\bindefinid[oa]\b/

export function pautaDeIndicacion(texto: string): { frecuencia: boolean; duracion: boolean } {
  const t = sinAcentos(texto)
  return { frecuencia: RE_FRECUENCIA.test(t), duracion: RE_DURACION.test(t) }
}

/** Indicaciones vacías o sin frecuencia o sin duración. */
export function sinPauta(texto: string): boolean {
  const p = pautaDeIndicacion(texto)
  return !(p.frecuencia && p.duracion)
}

/** Texto del aviso suave al imprimir. */
export function textoAvisoPauta(n: number): string {
  return n === 1
    ? 'A 1 medicamento le falta la frecuencia o la duración en las indicaciones.'
    : `A ${n} medicamentos les falta la frecuencia o la duración en las indicaciones.`
}

/** Añade una frase al final de las indicaciones; si estaban vacías, con mayúscula. */
export function anadirFrase(actual: string, frase: string): string {
  const s = actual.trim()
  if (!s) return frase.charAt(0).toUpperCase() + frase.slice(1)
  return `${s} ${frase}`
}
