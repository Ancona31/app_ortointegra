import type { Calculadora, PacienteContexto } from '../../types'

type ImcInputs = {
  peso: number
  talla: number
}

export const imc: Calculadora<ImcInputs> = {
  slug: 'imc',
  nombre: 'Índice de Masa Corporal (IMC)',
  especialidad: 'nutricion-metabolismo',
  descripcion: 'Evalúa el estado nutricional general basado en peso y talla.',
  fuente: 'Organización Mundial de la Salud (OMS)',

  inputs: [
    { tipo: 'number', key: 'peso',  label: 'Peso',  unidad: 'kg', min: 1,  max: 500, step: 0.1, requerido: true },
    { tipo: 'number', key: 'talla', label: 'Talla', unidad: 'cm', min: 30, max: 250, step: 0.1, requerido: true },
  ],

  autocompletar: {
    peso:  (p: PacienteContexto) => p.peso_kg,
    talla: (p: PacienteContexto) => p.talla_cm,
  },

  calcular: ({ peso, talla }) => {
    const tallaM = talla / 100
    const valor = peso / (tallaM * tallaM)
    return Math.round(valor * 10) / 10
  },

  interpretar: (resultado) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    if (valor < 18.5) return {
      valor,
      unidad: 'kg/m²',
      categoria: 'Bajo peso',
      color: 'amarillo',
      texto: 'Peso por debajo del rango saludable',
      observaciones: ['Considerar evaluación nutricional', 'Descartar causas patológicas de bajo peso'],
    }
    if (valor < 25) return {
      valor,
      unidad: 'kg/m²',
      categoria: 'Peso normal',
      color: 'verde',
      texto: 'Peso dentro del rango saludable',
    }
    if (valor < 30) return {
      valor,
      unidad: 'kg/m²',
      categoria: 'Sobrepeso',
      color: 'amarillo',
      texto: 'Peso por encima del rango saludable',
      observaciones: ['Recomendar cambios en estilo de vida', 'Evaluar factores de riesgo cardiovascular'],
    }
    if (valor < 35) return {
      valor,
      unidad: 'kg/m²',
      categoria: 'Obesidad grado I',
      color: 'rojo',
      texto: 'Obesidad leve',
      observaciones: ['Intervención nutricional y ejercicio', 'Evaluar comorbilidades metabólicas'],
    }
    if (valor < 40) return {
      valor,
      unidad: 'kg/m²',
      categoria: 'Obesidad grado II',
      color: 'rojo',
      texto: 'Obesidad moderada',
      observaciones: ['Evaluación multidisciplinaria', 'Considerar farmacoterapia'],
    }
    return {
      valor,
      unidad: 'kg/m²',
      categoria: 'Obesidad grado III',
      color: 'rojo',
      texto: 'Obesidad severa (mórbida)',
      observaciones: ['Evaluación para cirugía bariátrica', 'Alto riesgo cardiovascular y metabólico'],
    }
  },
}
