import type { Calculadora, PacienteContexto } from '../../types'
import { calcularEdad } from '@/lib/patientUtils'

type CockcroftGaultInputs = {
  edad: number
  sexo: 'M' | 'F'
  peso: number
  creatinina: number
}

export const cockcroftGault: Calculadora<CockcroftGaultInputs> = {
  slug: 'cockcroft-gault',
  nombre: 'Aclaramiento de Creatinina (Cockcroft-Gault)',
  especialidad: 'nefrologia',
  descripcion: 'Estima el aclaramiento de creatinina (CrCl) para ajuste de dosis de fármacos renales.',
  fuente: 'Cockcroft DW, Gault MH. Nephron 1976;16(1):31-41',

  inputs: [
    { tipo: 'number', key: 'edad',       label: 'Edad',       unidad: 'años',  min: 1,   max: 120, step: 1,    requerido: true },
    { tipo: 'select', key: 'sexo',       label: 'Sexo',       opciones: [
      { valor: 'M', label: 'Masculino' },
      { valor: 'F', label: 'Femenino' },
    ], requerido: true },
    { tipo: 'number', key: 'peso',       label: 'Peso',       unidad: 'kg',    min: 1,   max: 500, step: 0.1,  requerido: true },
    { tipo: 'number', key: 'creatinina', label: 'Creatinina', unidad: 'mg/dL', min: 0.1, max: 20,  step: 0.01, requerido: true },
  ],

  autocompletar: {
    edad: (p: PacienteContexto) => p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento).anios : undefined,
    sexo: (p: PacienteContexto) => (p.sexo === 'M' || p.sexo === 'F') ? p.sexo : undefined,
    peso: (p: PacienteContexto) => p.peso_kg,
  },

  calcular: ({ edad, sexo, peso, creatinina }) => {
    const base = ((140 - edad) * peso) / (72 * creatinina)
    const valor = sexo === 'F' ? base * 0.85 : base
    return Math.round(valor * 100) / 100
  },

  interpretar: (resultado, { edad }) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    const observaciones = [
      'En pacientes con obesidad (IMC ≥30), considerar usar peso ideal o peso ajustado en lugar de peso actual; el peso actual puede sobreestimar el CrCl.',
      'En pacientes con creatinina <0.8 mg/dL, considerar redondear a 0.8 para evitar sobreestimación; especialmente en ancianos sarcopénicos.',
    ]
    if (edad >= 65) {
      observaciones.push('Edad avanzada: la masa muscular reducida puede sobreestimar la función renal real.')
    }

    if (valor >= 90) return {
      valor,
      unidad: 'mL/min',
      categoria: 'Función renal normal',
      color: 'verde',
      texto: 'Aclaramiento de creatinina dentro del rango normal',
      observaciones,
    }
    if (valor >= 60) return {
      valor,
      unidad: 'mL/min',
      categoria: 'Disminución leve',
      color: 'verde',
      texto: 'Disminución leve del aclaramiento de creatinina',
      observaciones,
    }
    if (valor >= 30) return {
      valor,
      unidad: 'mL/min',
      categoria: 'Disminución moderada',
      color: 'amarillo',
      texto: 'Disminución moderada del aclaramiento de creatinina',
      observaciones,
    }
    if (valor >= 15) return {
      valor,
      unidad: 'mL/min',
      categoria: 'Disminución severa',
      color: 'rojo',
      texto: 'Disminución severa del aclaramiento de creatinina',
      observaciones,
    }
    return {
      valor,
      unidad: 'mL/min',
      categoria: 'Falla renal',
      color: 'rojo',
      texto: 'Falla renal: aclaramiento <15 mL/min',
      observaciones,
    }
  },
}
