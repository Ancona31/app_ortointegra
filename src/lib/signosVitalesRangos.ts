/**
 * signosVitalesRangos.ts — fuente única de rangos de signos vitales.
 *
 * Módulo neutro (sin 'use client', sin logger, sin throw): lo importan tanto
 * el componente cliente SignosVitalesCard (semáforo + validación UI) como el
 * route handler servidor /api/consultas (límites duros). No depende de React
 * ni de next; solo constantes y funciones puras.
 *
 * Dos conceptos DISTINTOS:
 *  - Límites duros ({@link LIMITES_DUROS}): rango fisiológicamente posible. Fuera
 *    de esto es dato inválido → BLOQUEA el guardado (UI y API).
 *  - Umbrales de semáforo ({@link evaluarEstado}): clasificación clínica
 *    informativa (normal/vigilar/fuera). NUNCA bloquea nada.
 */

export type EstadoVital = 'vacio' | 'normal' | 'vigilar' | 'fuera'

export type SignoVitalKey = 'ta_sistolica' | 'ta_diastolica' | 'fc' | 'fr' | 'temp' | 'spo2'

/** Límites fisiológicos duros [min, max] inclusivos. Fuera = dato inválido. */
export const LIMITES_DUROS: Record<SignoVitalKey, readonly [number, number]> = {
  ta_sistolica: [40, 300],
  ta_diastolica: [40, 300],
  fc: [20, 300],
  fr: [4, 80],
  temp: [30, 45],
  spo2: [40, 100],
} as const

/** true si el valor cae fuera del rango fisiológico posible del signo. */
export function fueraDeLimitesDuros(key: SignoVitalKey, valor: number): boolean {
  if (!Number.isFinite(valor)) return true
  const [min, max] = LIMITES_DUROS[key]
  return valor < min || valor > max
}

function esVacio(valor: number | undefined | null): boolean {
  return valor === undefined || valor === null || !Number.isFinite(valor)
}

/**
 * Clasifica un signo individual según los umbrales clínicos del spec.
 * undefined/null/NaN → 'vacio'. La presión arterial NO se evalúa aquí como
 * tile combinado (usar {@link evaluarPA}); sys/dia individuales sí se soportan.
 */
export function evaluarEstado(key: SignoVitalKey, valor: number | undefined | null): EstadoVital {
  if (esVacio(valor)) return 'vacio'
  const v = valor as number
  switch (key) {
    case 'ta_sistolica':
      if (v < 90) return 'fuera'
      if (v < 130) return 'normal'
      if (v <= 139) return 'vigilar'
      return 'fuera'
    case 'ta_diastolica':
      if (v < 60) return 'fuera'
      if (v < 85) return 'normal'
      if (v <= 89) return 'vigilar'
      return 'fuera'
    case 'fc':
      if (v >= 60 && v <= 100) return 'normal'
      if ((v >= 50 && v <= 59) || (v >= 101 && v <= 120)) return 'vigilar'
      return 'fuera'
    case 'fr':
      if (v >= 12 && v <= 20) return 'normal'
      if ((v >= 10 && v <= 11) || (v >= 21 && v <= 24)) return 'vigilar'
      return 'fuera'
    case 'temp':
      if (v >= 36.0 && v <= 37.4) return 'normal'
      if ((v >= 37.5 && v <= 37.9) || (v >= 35.0 && v <= 35.9)) return 'vigilar'
      return 'fuera'
    case 'spo2':
      if (v >= 95) return 'normal'
      if (v >= 90 && v <= 94) return 'vigilar'
      return 'fuera'
  }
}

/**
 * Evalúa el tile de presión arterial: gana el peor de sys/dia.
 * Ambos vacíos → 'vacio'; uno solo capturado → evalúa el presente.
 */
export function evaluarPA(sys?: number | null, dia?: number | null): EstadoVital {
  const sVacio = esVacio(sys)
  const dVacio = esVacio(dia)
  if (sVacio && dVacio) return 'vacio'
  const estados: EstadoVital[] = []
  if (!sVacio) estados.push(evaluarEstado('ta_sistolica', sys))
  if (!dVacio) estados.push(evaluarEstado('ta_diastolica', dia))
  const orden: EstadoVital[] = ['fuera', 'vigilar', 'normal']
  for (const nivel of orden) {
    if (estados.includes(nivel)) return nivel
  }
  return 'vacio'
}
