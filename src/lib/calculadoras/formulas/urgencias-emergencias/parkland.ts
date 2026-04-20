import type { Calculadora, PacienteContexto } from '../../types'
import { calcularEdad } from '@/lib/patientUtils'

type ParklandInputs = {
  peso: number
  porcentajeSCQ: number
  edad: number
}

const formatMl = (n: number): string => String(Math.round(n * 10) / 10)

export const parkland: Calculadora<ParklandInputs> = {
  slug: 'parkland',
  nombre: 'Fórmula de Parkland (reanimación en quemados)',
  especialidad: 'urgencias-emergencias',
  descripcion: 'Calcula el volumen de cristaloides (Ringer lactato) para reanimación en las primeras 24 horas tras una quemadura mayor en adultos (Parkland clásica).',
  fuente: 'Baxter CR, Shires T. Ann N Y Acad Sci 1968;150(3):874-894',

  inputs: [
    { tipo: 'number', key: 'peso',          label: 'Peso',                                           unidad: 'kg',   min: 1, max: 500, step: 0.1, requerido: true },
    { tipo: 'number', key: 'porcentajeSCQ', label: '% Superficie corporal quemada (2° grado o más)', unidad: '%',    min: 0, max: 100, step: 1,   requerido: true },
    { tipo: 'number', key: 'edad',          label: 'Edad',                                           unidad: 'años', min: 0, max: 120, step: 1,   requerido: true },
  ],

  autocompletar: {
    peso: (p: PacienteContexto) => p.peso_kg,
    edad: (p: PacienteContexto) => p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento).anios : undefined,
  },

  calcular: ({ peso, porcentajeSCQ }) => {
    return 4 * peso * porcentajeSCQ
  },

  interpretar: (resultado, { porcentajeSCQ, edad }) => {
    const valor = typeof resultado === 'number' ? resultado : parseFloat(String(resultado))

    const primeraMitad = valor / 2
    const mlHoraPrimera = primeraMitad / 8
    const mlHoraSegunda = primeraMitad / 16

    const observaciones: string[] = [
      'Líquido recomendado: Ringer lactato. Volumen calculado para las primeras 24 horas desde el momento de la quemadura (NO desde el ingreso hospitalario).',
      `Esquema de infusión: 50% en primeras 8h, 50% en siguientes 16h. Para ${formatMl(valor)} mL totales: ${formatMl(primeraMitad)} mL (${formatMl(mlHoraPrimera)} mL/h) en 8h, luego ${formatMl(primeraMitad)} mL (${formatMl(mlHoraSegunda)} mL/h) en 16h.`,
      'Parkland es punto de partida. Ajustar según diuresis horaria (objetivo 0.5 mL/kg/h en adultos, 1 mL/kg/h en pediátricos), estado hemodinámico y respuesta clínica.',
      "Sobrestimación de volumen ('fluid creep') incrementa riesgo de edema pulmonar, síndrome compartimental abdominal y mortalidad. Subestimación causa choque hipovolémico. Reanimación titulada es esencial.",
    ]

    if (edad < 14) {
      observaciones.push('Paciente pediátrico: Parkland clásica no incluye líquidos de mantenimiento. Considerar Parkland modificada con líquidos de mantenimiento basal (Holliday-Segar).')
    }
    if (porcentajeSCQ < 20) {
      observaciones.push('Si la quemadura es por inhalación de humo, lesión eléctrica o trauma asociado, las indicaciones de reanimación intravenosa pueden ampliarse incluso con %SCQ <20.')
    }

    if (porcentajeSCQ < 20) {
      return {
        valor,
        unidad: 'mL',
        categoria: 'Quemadura menor',
        color: 'gris',
        texto: 'Reanimación de Parkland generalmente no indicada en quemaduras <20% SCQ en adultos. Considerar reposición oral.',
        observaciones,
      }
    }
    if (porcentajeSCQ <= 40) {
      return {
        valor,
        unidad: 'mL',
        categoria: 'Quemadura mayor',
        color: 'amarillo',
        texto: 'Quemadura mayor — reanimación intensiva con cristaloides según Parkland.',
        observaciones,
      }
    }
    return {
      valor,
      unidad: 'mL',
      categoria: 'Quemadura crítica',
      color: 'rojo',
      texto: 'Quemadura crítica — reanimación intensiva en UCI, monitorización estricta.',
      observaciones,
    }
  },
}
