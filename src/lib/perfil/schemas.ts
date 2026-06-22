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
