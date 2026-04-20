import type { Calculadora, PacienteContexto } from '../../types'
import { calcularEdad } from '@/lib/patientUtils'

type GradienteAaInputs = {
  fio2: number
  pao2: number
  paco2: number
  edad: number
  presionBarometrica: number
}

export const gradienteAa: Calculadora<GradienteAaInputs> = {
  slug: 'gradiente-aa',
  nombre: 'Gradiente Alvéolo-arterial de Oxígeno (A-a)',
  especialidad: 'neumologia',
  descripcion: 'Calcula el gradiente entre la presión alveolar (PAO₂) y arterial (PaO₂) de oxígeno. Útil para diferenciar causas de hipoxemia (gradiente normal: hipoventilación; gradiente elevado: shunt, V/Q alterado, alteración de difusión).',
  fuente: 'Mellemgaard K. Acta Physiol Scand 1966;67(1):10-20',

  inputs: [
    { tipo: 'number', key: 'fio2',               label: 'FiO₂ (fracción inspirada de O₂)', min: 0.21, max: 1.0, step: 0.01, requerido: true },
    { tipo: 'number', key: 'pao2',               label: 'PaO₂ arterial',                   unidad: 'mmHg', min: 20,  max: 600, step: 1, requerido: true },
    { tipo: 'number', key: 'paco2',              label: 'PaCO₂ arterial',                  unidad: 'mmHg', min: 10,  max: 100, step: 1, requerido: true },
    { tipo: 'number', key: 'edad',               label: 'Edad',                            unidad: 'años', min: 1,   max: 120, step: 1, requerido: true },
    { tipo: 'number', key: 'presionBarometrica', label: 'Presión barométrica',             unidad: 'mmHg', min: 400, max: 800, step: 1, placeholder: '760', requerido: true },
  ],

  autocompletar: {
    edad: (p: PacienteContexto) => p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento).anios : undefined,
  },

  calcular: ({ fio2, pao2, paco2, presionBarometrica }) => {
    const pAO2 = fio2 * (presionBarometrica - 47) - (paco2 / 0.8)
    const valor = pAO2 - pao2
    return Math.round(valor * 10) / 10
  },

  interpretar: (resultado, { edad }) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))
    const esperado = edad / 4 + 4

    const observaciones = [
      'Gradiente esperado por edad: (edad/4)+4. Aumenta ~3 mmHg por década de vida.',
      'Gradiente NORMAL con hipoxemia: hipoventilación pura (sobredosis, enfermedad neuromuscular, EPOC con CO₂ elevado).',
      'Gradiente ELEVADO con hipoxemia: shunt (atelectasia, neumonía, SDRA), alteración V/Q (TEP, EPOC), defecto de difusión (fibrosis).',
      'Para altitudes elevadas (CDMX 2240m, Patm ~585 mmHg), ajustar presión barométrica al introducirla en el formulario.',
    ]

    const texto = `Gradiente A-a: ${valor.toFixed(1)} mmHg (esperado por edad ≤${esperado.toFixed(1)} mmHg)`

    if (valor <= esperado) return {
      valor, unidad: 'mmHg', categoria: 'Gradiente normal', color: 'verde', texto, observaciones,
    }
    if (valor <= esperado + 10) return {
      valor, unidad: 'mmHg', categoria: 'Gradiente levemente elevado', color: 'amarillo', texto, observaciones,
    }
    return {
      valor, unidad: 'mmHg', categoria: 'Gradiente significativamente elevado', color: 'rojo', texto, observaciones,
    }
  },
}
