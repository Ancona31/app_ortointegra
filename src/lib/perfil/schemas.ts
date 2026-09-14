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
/* El máximo lo pone el schema porque la base no lo pone: las tres columnas de
   `profiles` son `text` (20260912190416_remote_schema.sql:570-572), sin bound.
   Sin esto una fila de registro —ruta pública, sin sesión— admite un nombre de
   kilobytes. 80 cubre nombres compuestos con holgura y por encima de eso el
   nombre ya no cabe en la maqueta del correo, que es una tabla de 540px.
   ⚠️ VA AQUÍ, EN LA FORMA COMPARTIDA, así que acota TAMBIÉN a CrearUsuarioSchema
   (el alta de admin), no solo al registro. Es deliberado: las dos vías escriben
   las mismas columnas sin límite. */
const MAX_NOMBRE = 80

const nombreAltaShape = {
  nombres: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(MAX_NOMBRE, `El nombre no puede exceder ${MAX_NOMBRE} caracteres`),
  apellido_paterno: z
    .string()
    .trim()
    .min(1, 'El apellido paterno es obligatorio')
    .max(MAX_NOMBRE, `El apellido paterno no puede exceder ${MAX_NOMBRE} caracteres`),
  apellido_materno: z
    .string()
    .trim()
    .max(MAX_NOMBRE, `El apellido materno no puede exceder ${MAX_NOMBRE} caracteres`)
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
/**
 * Registro público — SOLO correo y contraseña (Bloque B5, quinta parte).
 *
 * Todo lo demás lo pide el gate de onboarding, que es donde el médico lo ve con
 * contexto y puede corregirlo: nombre y apellidos, título, especialidad,
 * cédulas, la clínica y el consultorio. Aquí pedirlo tenía dos costes: un
 * formulario de nueve campos delante de alguien que todavía no ha visto el
 * producto, y una segunda fuente de verdad para datos que el gate vuelve a
 * exigir con otro criterio.
 *
 * ⚠️ `nombreAltaShape` YA NO SE USA AQUÍ, PERO NO SE BORRA: lo sigue llevando
 * `CrearUsuarioSchema` (el alta que hace el admin de la clínica), y con él el
 * tope de `MAX_NOMBRE`. Las pruebas de ese tope viven en
 * `src/lib/tests/registroSchema.test.ts` y apuntan a ese schema desde este
 * recorte.
 *
 * ⚠️ EL CAMPO QUE SE FUE SE LLAMABA MAL: `nombreClinica` decía «nombre del
 * consultorio» en su mensaje de error y lo que creaba era la CLÍNICA —la
 * cuenta—. El consultorio es el lugar físico, otra tabla. En el onboarding se
 * piden por separado y con ese nombre.
 */
export const RegistroSchema = z.object({
  email: z.email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})
export type RegistroInput = z.infer<typeof RegistroSchema>

/**
 * Login (POST /api/auth/login). Deliberadamente laxo con la contraseña: aquí
 * solo se exige que VENGA. El mínimo real lo impone GoTrue, y duplicarlo aquí
 * crearía dos fuentes de verdad que se desincronizan — unificarlo es de otro
 * bloque. El tope de 254 del correo es el de la RFC 5321, y sirve para que un
 * cuerpo de kilobytes no llegue a la clave del limitador ni a `audit_log`,
 * que es inmutable por trigger.
 */
export const LoginSchema = z.object({
  email: z
    .email('Correo electrónico inválido')
    .max(254, 'El correo no puede exceder 254 caracteres'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})
export type LoginInput = z.infer<typeof LoginSchema>
