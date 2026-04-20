import type { Calculadora } from '../../types'

type BrechaAnionicaInputs = {
  sodio: number
  cloro: number
  bicarbonato: number
}

export const brechaAnionica: Calculadora<BrechaAnionicaInputs> = {
  slug: 'brecha-anionica',
  nombre: 'Brecha Aniónica',
  especialidad: 'nefrologia',
  descripcion: 'Calcula la diferencia entre cationes y aniones medidos en plasma. Útil para clasificar acidosis metabólica (BA elevada vs BA normal) y orientar el diagnóstico diferencial (cetoacidosis, acidosis láctica, intoxicaciones, pérdidas digestivas/renales).',
  fuente: 'Emmett M, Narins RG. Medicine (Baltimore) 1977;56(1):38-54',

  inputs: [
    { tipo: 'number', key: 'sodio',       label: 'Sodio (Na⁺)',         unidad: 'mEq/L', min: 100, max: 180, step: 1, requerido: true },
    { tipo: 'number', key: 'cloro',       label: 'Cloro (Cl⁻)',         unidad: 'mEq/L', min: 60,  max: 140, step: 1, requerido: true },
    { tipo: 'number', key: 'bicarbonato', label: 'Bicarbonato (HCO₃⁻)', unidad: 'mEq/L', min: 5,   max: 50,  step: 1, requerido: true },
  ],

  calcular: ({ sodio, cloro, bicarbonato }) => {
    return Math.round(sodio - (cloro + bicarbonato))
  },

  interpretar: (resultado) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    const observaciones = [
      'Esta versión NO incluye K⁺ ni corrige por albúmina. Si albúmina <4 g/dL, considerar fórmula corregida: BA + 2.5 × (4 - albúmina).',
      'BA elevada — causas: MUDPILES (Metanol, Uremia, cetoacidosis Diabética/alcohólica, Paraldehído/Propilenglicol, Iron/INH/Inhalantes, Lactato, Etilenglicol, Salicilatos).',
      'BA normal con acidosis — causas: HARDUP (Hiperalimentación, Acetazolamida, Renal tubular acidosis, Diarrea, Ureterosigmoidostomía, Pancreaticoduodenal). Pérdida de HCO₃⁻ digestiva o renal.',
      'BA baja (<8) — causas raras: hipoalbuminemia, mieloma múltiple (paraproteínas catiónicas), intoxicación por litio o bromo.',
    ]

    const texto = `Brecha aniónica: ${valor} mEq/L (rango normal 8-12)`

    if (valor < 8) return {
      valor, unidad: 'mEq/L', categoria: 'Brecha aniónica baja', color: 'amarillo', texto, observaciones,
    }
    if (valor <= 12) return {
      valor, unidad: 'mEq/L', categoria: 'Brecha aniónica normal', color: 'verde', texto, observaciones,
    }
    if (valor <= 20) return {
      valor, unidad: 'mEq/L', categoria: 'Brecha aniónica elevada', color: 'amarillo', texto, observaciones,
    }
    return {
      valor, unidad: 'mEq/L', categoria: 'Brecha aniónica severamente elevada', color: 'rojo', texto, observaciones,
    }
  },
}
