import type { Calculadora } from '../../types'

type IndiceChoqueInputs = {
  fc: number
  tas: number
}

export const indiceChoque: Calculadora<IndiceChoqueInputs> = {
  slug: 'indice-choque',
  nombre: 'Índice de Choque',
  especialidad: 'cardiologia',
  descripcion: 'Calcula la razón FC/TAS. Marcador temprano de choque hemodinámico. Más sensible que cualquier signo vital aislado para detectar inestabilidad hemodinámica oculta.',
  fuente: 'Allgöwer M, Burri C. Dtsch Med Wochenschr 1967;92(43):1947-1950',

  inputs: [
    { tipo: 'number', key: 'fc',  label: 'Frecuencia cardíaca', unidad: 'lpm',  min: 30, max: 250, step: 1, requerido: true },
    { tipo: 'number', key: 'tas', label: 'TA sistólica',        unidad: 'mmHg', min: 40, max: 250, step: 1, requerido: true },
  ],

  calcular: ({ fc, tas }) => {
    const valor = fc / tas
    return Math.round(valor * 100) / 100
  },

  interpretar: (resultado) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    const observaciones = [
      'Más sensible que TAS aislada para detectar choque oculto. Útil en triage, trauma, sepsis y hemorragia.',
      'IC ≥1.0 en trauma se asocia con necesidad de transfusión masiva. IC ≥1.4 con mortalidad >25% en sepsis.',
      'Índice de choque modificado (IC × edad) puede ser más útil en adultos mayores.',
      'No usar de forma aislada: combinar con perfusión periférica, diuresis, lactato y nivel de conciencia.',
    ]

    const texto = `Índice de choque: ${valor}`

    if (valor < 0.7) return {
      valor, categoria: 'Índice de choque normal', color: 'verde', texto, observaciones,
    }
    if (valor < 0.9) return {
      valor, categoria: 'Índice de choque normal alto', color: 'verde', texto, observaciones,
    }
    if (valor < 1.0) return {
      valor, categoria: 'Índice de choque elevado — vigilancia', color: 'amarillo', texto, observaciones,
    }
    if (valor <= 1.4) return {
      valor, categoria: 'Choque incipiente — actuar', color: 'amarillo', texto, observaciones,
    }
    return {
      valor, categoria: 'Choque franco — reanimación urgente', color: 'rojo', texto, observaciones,
    }
  },
}
