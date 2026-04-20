import type { Calculadora } from '../../types'

type QtcInputs = {
  qt: number
  fc: number
}

export const qtc: Calculadora<QtcInputs> = {
  slug: 'qtc',
  nombre: 'QT corregido (Bazett y Fridericia)',
  especialidad: 'cardiologia',
  descripcion: 'Corrige el intervalo QT por la frecuencia cardíaca usando las fórmulas de Bazett (1920) y Fridericia (1920). Bazett sobreestima a frecuencias altas; Fridericia es más precisa fuera del rango 60-100 lpm.',
  fuente: 'Bazett HC. Heart 1920;7:353-370. Fridericia LS. Acta Med Scand 1920;53:469-486',

  inputs: [
    { tipo: 'number', key: 'qt', label: 'Intervalo QT',        unidad: 'ms',  min: 200, max: 700, step: 1, requerido: true },
    { tipo: 'number', key: 'fc', label: 'Frecuencia cardíaca', unidad: 'lpm', min: 30,  max: 250, step: 1, requerido: true },
  ],

  calcular: ({ qt, fc }) => {
    const rr = 60 / fc
    const bazett = qt / Math.sqrt(rr)
    return Math.round(bazett)
  },

  interpretar: (resultado, { qt, fc }) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))
    const rr = 60 / fc
    const fridericia = Math.round(qt / Math.pow(rr, 1 / 3))

    const observaciones = [
      'Bazett (QT/√RR) sobreestima a FC altas y subestima a FC bajas. Fridericia (QT/RR^⅓) es más precisa fuera del rango 60-100 lpm.',
      'Rangos por sexo (más precisos): hombres QTc <430 ms normal, 430-450 límite, >450 prolongado. Mujeres <450 normal, 450-470 límite, >470 prolongado. Esta calculadora usa rango unisex (<440 normal, 440-460 límite, >460 prolongado).',
      'QTc >500 ms se asocia con riesgo significativo de torsades de pointes. Revisar fármacos que prolongan QT (antiarrítmicos, antipsicóticos, macrólidos, fluoroquinolonas).',
    ]

    const texto = `QTc Bazett: ${valor} ms · QTc Fridericia: ${fridericia} ms`

    if (valor < 440) return {
      valor, unidad: 'ms', categoria: 'QTc normal', color: 'verde', texto, observaciones,
    }
    if (valor <= 460) return {
      valor, unidad: 'ms', categoria: 'QTc en límite alto', color: 'amarillo', texto, observaciones,
    }
    return {
      valor, unidad: 'ms', categoria: 'QTc prolongado', color: 'rojo', texto, observaciones,
    }
  },
}
