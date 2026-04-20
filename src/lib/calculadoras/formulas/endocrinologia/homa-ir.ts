import type { Calculadora } from '../../types'

type HomaIrInputs = {
  glucosa: number
  insulina: number
}

export const homaIr: Calculadora<HomaIrInputs> = {
  slug: 'homa-ir',
  nombre: 'HOMA-IR (Resistencia a la Insulina)',
  especialidad: 'endocrinologia',
  descripcion: 'Estima resistencia insulínica a partir de glucosa e insulina basal en ayuno. Punto de corte en población mexicana: >2.5 sugiere resistencia a la insulina (Almeda-Valdés et al, INNSZ 2010).',
  fuente: 'Matthews DR et al. Diabetologia 1985;28(7):412-419. Punto de corte mexicano: Almeda-Valdés P et al. Salud Publica Mex 2010',

  inputs: [
    { tipo: 'number', key: 'glucosa',  label: 'Glucosa en ayuno',        unidad: 'mg/dL',  min: 30,  max: 500, step: 1,   requerido: true },
    { tipo: 'number', key: 'insulina', label: 'Insulina basal en ayuno', unidad: 'µUI/mL', min: 0.1, max: 200, step: 0.1, requerido: true },
  ],

  calcular: ({ glucosa, insulina }) => {
    const valor = (glucosa * insulina) / 405
    return Math.round(valor * 100) / 100
  },

  interpretar: (resultado) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    const observaciones = [
      'Punto de corte usado: >2.5 (población mexicana, Almeda-Valdés 2010, INNSZ). Otros consensos: >2.7 (NHANES) o >3.5 (algunos europeos). La heterogeneidad refleja diferencias étnicas.',
      'Requiere glucosa e insulina EN AYUNO de 8-12 horas. No válido en pacientes con diabetes establecida en tratamiento con insulina exógena.',
      'HOMA-IR es un marcador, no un diagnóstico. Correlacionar con contexto clínico: obesidad central, acantosis nigricans, dislipidemia aterogénica, hígado graso, SOP.',
      'Para precisión mayor, considerar clamp euglicémico-hiperinsulinémico (gold standard, no clínicamente práctico) o HOMA2-IR (calculadora online de Oxford).',
    ]

    const texto = `HOMA-IR: ${valor}`

    if (valor < 2.5) return {
      valor, categoria: 'Sensibilidad a insulina conservada', color: 'verde', texto, observaciones,
    }
    if (valor <= 3.8) return {
      valor, categoria: 'Resistencia a la insulina', color: 'amarillo', texto, observaciones,
    }
    return {
      valor, categoria: 'Resistencia a la insulina severa', color: 'rojo', texto, observaciones,
    }
  },
}
