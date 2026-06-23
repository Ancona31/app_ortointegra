import { z } from 'zod'

/**
 * Allowlist de columnas de `profiles` que el médico puede editar en su propia
 * fila vía PUT /api/me/perfil-medico. Actualización PARCIAL: Mi Perfil y los
 * pasos del onboarding envían subconjuntos distintos, por eso TODO es opcional.
 * Zod descarta por defecto las keys fuera del schema (strip) → primera barrera
 * antes del trigger BD que congela role/clinica_id/es_admin_de_clinica.
 * NUNCA incluye el campo legacy `nombre` (NOMBRES_PLAN.md, Fase 4 ya migrada).
 *
 * Regla de nombre: si `nombres`/`apellido_paterno` vienen, no pueden ir vacíos
 * (min 1 tras trim). `apellido_materno` nullable: vacío se normaliza a null.
 */
export const PerfilMedicoUpdateSchema = z.object({
  titulo: z.string().trim().min(1).optional(),
  nombres: z.string().trim().min(1, 'El nombre es obligatorio').optional(),
  apellido_paterno: z.string().trim().min(1, 'El apellido paterno es obligatorio').optional(),
  apellido_materno: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  especialidad: z.string().optional(),
  cedula_profesional: z.string().optional(),
  cedula_especialidad: z.string().optional(),
  universidad: z.string().optional(),
  direccion_consultorio: z.string().optional(),
  telefono_consultorio: z.string().optional(),
})

export type PerfilMedicoUpdateInput = z.infer<typeof PerfilMedicoUpdateSchema>

/**
 * Altas (NOMBRES_PLAN.md, Fase 3.B). A diferencia del PUT parcial de 3.A,
 * crear-usuario y registro CREAN el perfil: nombres + apellido_paterno son
 * OBLIGATORIOS. apellido_materno nullable (vacío → null). NUNCA escriben `nombre`.
 */
const nombreAltaShape = {
  nombres: z.string().trim().min(1, 'El nombre es obligatorio'),
  apellido_paterno: z.string().trim().min(1, 'El apellido paterno es obligatorio'),
  apellido_materno: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
}

// ── Alta-admin: discriminated union por rol ──
// medico → datos médicos opcionales (se conserva el comportamiento actual:
//          título cae a 'Dr.' en la ruta, especialidad/cédulas pueden ir vacías).
// secretaria → SIN datos médicos. El título NULL se fuerza en la ruta, no aquí.
const CrearUsuarioBase = {
  email: z.email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  ...nombreAltaShape,
}

export const CrearUsuarioSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('medico'),
    ...CrearUsuarioBase,
    titulo: z.string().trim().optional(),
    especialidad: z.string().trim().optional(),
    cedula_profesional: z.string().trim().optional(),
    cedula_especialidad: z.string().trim().optional(),
  }),
  z.object({
    role: z.literal('secretaria'),
    ...CrearUsuarioBase,
  }),
])
export type CrearUsuarioInput = z.infer<typeof CrearUsuarioSchema>

// ── Registro (auto-alta médico-dueño): siempre médico, datos médicos requeridos
//    como hoy (titulo/especialidad/cedula_profesional obligatorios). ──
export const RegistroSchema = z.object({
  email: z.email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  ...nombreAltaShape,
  nombreClinica: z.string().trim().min(1, 'El nombre del consultorio es obligatorio'),
  titulo: z.string().trim().min(1),
  especialidad: z.string().trim().min(1, 'La especialidad es obligatoria'),
  cedula_profesional: z.string().trim().min(1, 'La cédula profesional es obligatoria'),
  cedula_especialidad: z.string().trim().nullable().optional().transform((v) => (v ? v : null)),
  tipo: z.enum(['independiente', 'clinica']).default('independiente'),
})
export type RegistroInput = z.infer<typeof RegistroSchema>
