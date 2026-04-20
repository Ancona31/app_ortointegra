import type { Calculadora, PacienteContexto } from '../../types'

type BsaDuboisInputs = {
  peso: number
  talla: number
}

export const bsaDubois: Calculadora<BsaDuboisInputs> = {
  slug: 'bsa-dubois',
  nombre: 'Superficie Corporal (Dubois)',
  especialidad: 'nutricion-metabolismo',
  descripcion: 'Calcula la superficie corporal en m² mediante la fórmula de Dubois & Dubois (1916). Útil para dosificación de fármacos oncológicos, cálculos cardíacos (índice cardíaco) y nutrición.',
  fuente: 'Du Bois D, Du Bois EF. Arch Intern Med 1916;17:863-871',

  inputs: [
    { tipo: 'number', key: 'peso',  label: 'Peso',  unidad: 'kg', min: 1,  max: 500, step: 0.1, requerido: true },
    { tipo: 'number', key: 'talla', label: 'Talla', unidad: 'cm', min: 30, max: 250, step: 0.1, requerido: true },
  ],

  autocompletar: {
    peso:  (p: PacienteContexto) => p.peso_kg,
    talla: (p: PacienteContexto) => p.talla_cm,
  },

  calcular: ({ peso, talla }) => {
    const valor = 0.007184 * Math.pow(peso, 0.425) * Math.pow(talla, 0.725)
    return Math.round(valor * 100) / 100
  },

  interpretar: (resultado) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))
    return {
      valor,
      unidad: 'm²',
      categoria: 'Superficie corporal',
      color: 'gris',
      texto: 'Superficie corporal calculada por fórmula de Dubois',
      observaciones: [
        'Útil para dosificación de quimioterapia, cálculo de índice cardíaco (GC/BSA) y requerimientos nutricionales.',
        'Otras fórmulas disponibles: Mosteller (más simple), Haycock (pediátrica). Dubois es la clásica y la más usada en oncología.',
      ],
    }
  },
}
