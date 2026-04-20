import type { Calculadora, PacienteContexto } from '../../types'
import { calcularEdad } from '@/lib/patientUtils'

type MdrdInputs = {
  edad: number
  sexo: 'M' | 'F'
  creatinina: number
}

export const mdrd: Calculadora<MdrdInputs> = {
  slug: 'mdrd',
  nombre: 'Filtrado Glomerular (MDRD-4 IDMS)',
  especialidad: 'nefrologia',
  descripcion: 'Estima la tasa de filtración glomerular (eGFR) con la ecuación MDRD-4 IDMS (sin variable de raza). Fórmula histórica útil para reconciliar reportes de laboratorio; KDIGO 2024 recomienda CKD-EPI 2021 como fórmula preferida.',
  fuente: 'Levey AS et al. Ann Intern Med 1999;130(6):461-470. Re-expresión IDMS: Levey AS et al. Ann Intern Med 2006;145(4):247-254',

  inputs: [
    { tipo: 'number', key: 'edad',       label: 'Edad',       unidad: 'años',  min: 18,  max: 120, step: 1,    requerido: true },
    { tipo: 'select', key: 'sexo',       label: 'Sexo',       opciones: [
      { valor: 'M', label: 'Masculino' },
      { valor: 'F', label: 'Femenino' },
    ], requerido: true },
    { tipo: 'number', key: 'creatinina', label: 'Creatinina', unidad: 'mg/dL', min: 0.1, max: 20,  step: 0.01, requerido: true },
  ],

  autocompletar: {
    edad: (p: PacienteContexto) => p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento).anios : undefined,
    sexo: (p: PacienteContexto) => (p.sexo === 'M' || p.sexo === 'F') ? p.sexo : undefined,
  },

  calcular: ({ edad, sexo, creatinina }) => {
    const scrTerm = Math.pow(creatinina, -1.154)
    const ageTerm = Math.pow(edad, -0.203)
    const sexFactor = sexo === 'F' ? 0.742 : 1
    const valor = 175 * scrTerm * ageTerm * sexFactor
    return Math.round(valor * 100) / 100
  },

  interpretar: (resultado, { edad }) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    const observaciones = [
      'MDRD es la fórmula histórica (1999, re-expresada IDMS 2005). KDIGO 2024 recomienda CKD-EPI 2021 como fórmula preferida. MDRD subestima el filtrado en valores cercanos a la normalidad.',
      'Esta implementación NO incluye variable de raza, alineada con la recomendación NKF/ASN Task Force 2021. Si su laboratorio reporta MDRD con factor racial, los valores diferirán.',
      'Para diagnóstico de ERC se requiere eGFR <60 sostenido por ≥3 meses o presencia de marcadores de daño renal.',
    ]
    if (edad >= 65) {
      observaciones.push('En adultos mayores, eGFR 45-59 sin albuminuria puede representar envejecimiento renal fisiológico más que ERC verdadera.')
    }
    if (valor < 60) {
      observaciones.push('Considerar ajuste de dosis de fármacos de eliminación renal y evaluar nefroprotección.')
    }

    if (valor >= 90) return {
      valor,
      unidad: 'mL/min/1.73m²',
      categoria: 'G1 — Normal o alta',
      color: 'verde',
      texto: 'G1 — Filtrado glomerular normal o alto',
      observaciones,
    }
    if (valor >= 60) return {
      valor,
      unidad: 'mL/min/1.73m²',
      categoria: 'G2 — Disminución leve',
      color: 'verde',
      texto: 'G2 — Disminución leve del filtrado glomerular',
      observaciones,
    }
    if (valor >= 45) return {
      valor,
      unidad: 'mL/min/1.73m²',
      categoria: 'G3a — Disminución leve a moderada',
      color: 'amarillo',
      texto: 'G3a — Disminución leve a moderada del filtrado glomerular',
      observaciones,
    }
    if (valor >= 30) return {
      valor,
      unidad: 'mL/min/1.73m²',
      categoria: 'G3b — Disminución moderada a severa',
      color: 'amarillo',
      texto: 'G3b — Disminución moderada a severa del filtrado glomerular',
      observaciones,
    }
    if (valor >= 15) return {
      valor,
      unidad: 'mL/min/1.73m²',
      categoria: 'G4 — Disminución severa',
      color: 'rojo',
      texto: 'G4 — Disminución severa del filtrado glomerular',
      observaciones,
    }
    return {
      valor,
      unidad: 'mL/min/1.73m²',
      categoria: 'G5 — Falla renal',
      color: 'rojo',
      texto: 'G5 — Falla renal (filtrado glomerular <15)',
      observaciones,
    }
  },
}
