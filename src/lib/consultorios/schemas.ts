import { z } from 'zod'

/**
 * Lista de zonas IANA válidas en el runtime actual.
 * Se construye una vez al cargar el módulo (Node 20+).
 */
const ZONAS_IANA_VALIDAS = new Set(Intl.supportedValuesOf('timeZone'))

/**
 * Validador de zona IANA: rechaza cualquier string que no sea zona válida.
 */
const timezoneSchema = z
  .string()
  .trim()
  .min(1, 'Zona horaria requerida')
  .refine((tz) => ZONAS_IANA_VALIDAS.has(tz), {
    message: 'Zona horaria inválida',
  })

/**
 * Validador del campo `nombre_corto` para POST: obligatorio si se envía,
 * máximo 12 caracteres tras trim.
 */
const nombreCortoSchema = z
  .string()
  .trim()
  .min(1, 'Nombre corto requerido')
  .max(12, 'Nombre corto debe tener máximo 12 caracteres')

/**
 * Validador del horario JSONB. Estructura espejo de clinicas.horario_consulta.
 */
const diaHorarioSchema = z.object({
  activo: z.boolean(),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM inválido'),
  fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM inválido'),
})

const horarioSchema = z.object({
  lunes: diaHorarioSchema,
  martes: diaHorarioSchema,
  miercoles: diaHorarioSchema,
  jueves: diaHorarioSchema,
  viernes: diaHorarioSchema,
  sabado: diaHorarioSchema,
  domingo: diaHorarioSchema,
})

/**
 * Schema de creación de consultorio (POST).
 *
 * Reglas:
 * - `nombre` y `direccion` obligatorios, tras trim.
 * - `nombre_corto` opcional: si no se envía y nombre.length <= 12,
 *   se autocompleta server-side con nombre.
 * - `telefono` opcional.
 * - `timezone` validado contra Intl.
 * - `horario` opcional (si no se envía, BD usa el default JSONB).
 *
 * NO acepta `es_default`: el default lo gobiernan triggers BD (primer
 * consultorio activo) y el endpoint marcar-default (cambios posteriores).
 * Plan §2.5: solo nombre y nombre_corto son los campos relevantes del input.
 */
export const CrearConsultorioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'Nombre requerido'),
    nombre_corto: nombreCortoSchema.optional(),
    direccion: z.string().trim().min(1, 'Dirección requerida'),
    telefono: z.string().trim().min(1).optional().nullable(),
    timezone: timezoneSchema,
    horario: horarioSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Si no envió nombre_corto y nombre > 12 chars, exigir nombre_corto.
    if (!data.nombre_corto && data.nombre.length > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nombre corto requerido cuando el nombre supera 12 caracteres',
        path: ['nombre_corto'],
      })
    }
  })

export type CrearConsultorioInput = z.infer<typeof CrearConsultorioSchema>

/**
 * Schema de edición de consultorio (PATCH).
 *
 * Todos los campos opcionales. Solo se actualizan los que vengan en el body.
 *
 * Regla del PATCH (plan §2.5 nota A):
 * - Si nombre_corto NO viene → conservar el previo (no se incluye en payload).
 * - Si nombre_corto viene como null o string vacío → el handler debe re-derivar
 *   desde el nombre (nuevo o existente) si nombre.length <= 12. Por eso aquí
 *   permitimos nullable y validación condicional en el handler.
 * - Si nombre_corto viene como string no vacío → validar 1-12 chars.
 */
export const EditarConsultorioSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  nombre_corto: z
    .string()
    .trim()
    .max(12, 'Nombre corto debe tener máximo 12 caracteres')
    .nullable()
    .optional(),
  direccion: z.string().trim().min(1).optional(),
  telefono: z.string().trim().min(1).nullable().optional(),
  timezone: timezoneSchema.optional(),
  horario: horarioSchema.optional(),
})

export type EditarConsultorioInput = z.infer<typeof EditarConsultorioSchema>
