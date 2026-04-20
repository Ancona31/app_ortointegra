import type { Calculadora, PacienteContexto } from '../../types'
import { calcularEdad } from '@/lib/patientUtils'

type CkdEpi2021Inputs = {
  edad: number
  sexo: 'M' | 'F'
  creatinina: number
}

export const ckdEpi2021: Calculadora<CkdEpi2021Inputs> = {
  slug: 'ckd-epi-2021',
  nombre: 'Filtrado Glomerular (CKD-EPI 2021)',
  especialidad: 'nefrologia',
  descripcion: 'Estima la tasa de filtración glomerular (eGFR) en mL/min/1.73m² según la ecuación CKD-EPI 2021 sin variable de raza.',
  fuente: 'Inker LA et al. NEJM 2021;385:1737-1749',

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
    const esMujer = sexo === 'F'
    const kappa = esMujer ? 0.7 : 0.9
    const alpha = esMujer ? -0.241 : -0.302
    const scrKappa = creatinina / kappa
    const minTerm = Math.pow(Math.min(scrKappa, 1), alpha)
    const maxTerm = Math.pow(Math.max(scrKappa, 1), -1.200)
    const ageTerm = Math.pow(0.9938, edad)
    const sexFactor = esMujer ? 1.012 : 1
    const valor = 142 * minTerm * maxTerm * ageTerm * sexFactor
    return Math.round(valor * 100) / 100
  },

  interpretar: (resultado, { edad }) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    const observaciones = [
      'CKD-EPI 2021 no incluye variable de raza (recomendación NKF/ASN Task Force 2021). Si su laboratorio reporta eGFR con la fórmula 2009 o 2012, los valores diferirán.',
      'Para diagnóstico de ERC se requiere eGFR <60 sostenido por ≥3 meses o presencia de marcadores de daño renal (albuminuria, alteraciones estructurales, etc.).',
    ]
    if (edad >= 65) {
      observaciones.push('En adultos mayores, eGFR 45-59 sin albuminuria puede representar envejecimiento renal fisiológico más que ERC verdadera.')
    }
    if (valor < 60) {
      observaciones.push('Considerar ajuste de dosis de fármacos de eliminación renal y evaluar nefroprotección (control TA, IECA/ARA II, SGLT2i si aplica).')
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
