export type EspecialidadSlug =
  | 'cardiologia' | 'nefrologia' | 'neumologia' | 'terapia-intensiva'
  | 'neurologia' | 'gastroenterologia' | 'hematologia' | 'ortopedia-traumatologia'
  | 'pediatria' | 'urgencias-emergencias' | 'cirugia-anestesia' | 'endocrinologia'
  | 'nutricion-metabolismo' | 'obstetricia-ginecologia' | 'psiquiatria'
  | 'infectologia' | 'oncologia' | 'reumatologia' | 'dermatologia'

export type InputTipo = 'number' | 'select' | 'checkbox'

export type InputNumber = {
  tipo: 'number'
  key: string
  label: string
  unidad?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
  requerido?: boolean
}

export type InputSelect = {
  tipo: 'select'
  key: string
  label: string
  opciones: { valor: string; label: string }[]
  requerido?: boolean
}

export type InputCheckbox = {
  tipo: 'checkbox'
  key: string
  label: string
  descripcion?: string
}

export type CalculadoraInput = InputNumber | InputSelect | InputCheckbox

export type ResultadoInterpretacion = {
  valor: number | string
  unidad?: string
  categoria?: string
  color: 'verde' | 'amarillo' | 'rojo' | 'gris'
  texto: string
  observaciones?: string[]
}

export type PacienteContexto = {
  id: string
  nombre: string
  apellidos: string
  sexo: 'M' | 'F' | 'Otro'
  fecha_nacimiento: string | null
  peso_kg?: number
  talla_cm?: number
}

export type Calculadora<TInputs extends Record<string, unknown> = Record<string, unknown>> = {
  slug: string
  nombre: string
  especialidad: EspecialidadSlug
  descripcion: string
  fuente?: string

  inputs: CalculadoraInput[]

  autocompletar?: {
    [K in keyof TInputs]?: (paciente: PacienteContexto) => TInputs[K] | undefined
  }

  calcular: (inputs: TInputs) => number | string
  interpretar: (resultado: number | string, inputs: TInputs) => ResultadoInterpretacion
}
