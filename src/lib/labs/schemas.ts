import { z } from 'zod'

export const CATEGORIAS_ANALITO = [
  'antropometria',
  'signos_vitales',
  'hematologia',
  'quimica',
  'hueso',
  'endocrino',
  'inmunologia',
  'coagulacion',
  'cardiaco',
  'marcador_tumoral',
  'vitaminas_minerales',
  'otros',
] as const

const fechaRegex = /^\d{4}-\d{2}-\d{2}$/
const horaRegex = /^\d{2}:\d{2}$/

const camposTemporales = {
  fecha: z.string().regex(fechaRegex, 'Fecha inválida (YYYY-MM-DD)'),
  hora: z.string().regex(horaRegex, 'Hora inválida (HH:mm)'),
  notas: z.string().max(500, 'Máximo 500 caracteres').optional(),
}

export const MedicionCatalogoSchema = z.object({
  tipo: z.literal('catalogo'),
  analitoId: z.string().uuid('Analito inválido'),
  valor: z.number().finite('Valor numérico requerido'),
  ...camposTemporales,
})

export const MedicionCustomSchema = z.object({
  tipo: z.literal('custom'),
  nombreCustom: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100),
  unidadCustom: z.string().trim().min(1, 'Unidad requerida').max(30),
  categoriaCustom: z.enum(CATEGORIAS_ANALITO),
  valor: z.number().finite('Valor numérico requerido'),
  ...camposTemporales,
})

export const MedicionTASchema = z.object({
  tipo: z.literal('ta'),
  valorSistolica: z.number().positive('Sistólica debe ser mayor que 0'),
  valorDiastolica: z.number().positive('Diastólica debe ser mayor que 0'),
  ...camposTemporales,
}).refine(
  data => data.valorSistolica > data.valorDiastolica,
  { message: 'La presión sistólica debe ser mayor que la diastólica', path: ['valorSistolica'] },
)

export const CrearMedicionSchema = z.discriminatedUnion('tipo', [
  MedicionCatalogoSchema,
  MedicionCustomSchema,
  MedicionTASchema,
])

export type MedicionCatalogoInput = z.infer<typeof MedicionCatalogoSchema>
export type MedicionCustomInput = z.infer<typeof MedicionCustomSchema>
export type MedicionTAInput = z.infer<typeof MedicionTASchema>
export type CrearMedicionInput = z.infer<typeof CrearMedicionSchema>
