import { z } from 'zod'

/* El máximo lo pone el schema porque la base no lo pone: las tres columnas de
   `profiles` son `text` (20260912190416_remote_schema.sql:570-572), sin bound.
   80 cubre nombres compuestos con holgura y por encima de eso el nombre ya no
   cabe en la maqueta del correo, que es una tabla de 540px.

   ⚠️ VIVÍA EN EL ALTA Y SE MUDÓ AQUÍ EN B5-bis, Y LA MUDANZA ES EL PUNTO. El
   tope acotaba `CrearUsuarioSchema`, el formulario donde el administrador
   escribía el nombre de su equipo. Ese campo ya no existe —la invitación solo
   lleva correo y rol—, así que el ÚNICO escritor que le queda a esas tres
   columnas es este PUT, que hasta ahora tenía `min(1)` y ningún `max`. Quitar
   el tope de allí sin ponerlo aquí no habría sido moverlo: habría sido
   borrarlo, dejando el hueco que sus pruebas de 64 KB vigilan desde
   `src/lib/tests/registroSchema.test.ts`.

   ⚠️ NO ES EL ÚNICO CAMPO SIN BOUND de este schema —`especialidad`,
   `universidad` y las cédulas tampoco lo tienen—, y eso queda como está: son
   otra decisión, con otras pruebas, y no se cuelan en este cambio. */
const MAX_NOMBRE = 80

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
  nombres: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(MAX_NOMBRE, `El nombre no puede exceder ${MAX_NOMBRE} caracteres`)
    .optional(),
  apellido_paterno: z
    .string()
    .trim()
    .min(1, 'El apellido paterno es obligatorio')
    .max(MAX_NOMBRE, `El apellido paterno no puede exceder ${MAX_NOMBRE} caracteres`)
    .optional(),
  apellido_materno: z
    .string()
    .trim()
    .max(MAX_NOMBRE, `El apellido materno no puede exceder ${MAX_NOMBRE} caracteres`)
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

// ── Invitación por correo (Bloque B5-bis) ──
/**
 * CORREO Y ROL. Nada más, y cada ausencia tiene su motivo.
 *
 * ⚠️ NO LLEVA CONTRASEÑA. Hasta B5-bis esto se llamaba `CrearUsuarioSchema` y
 * pedía una: el administrador escribía la contraseña de su médico o de su
 * secretaria y se la dictaba, con lo que quedaba conociendo la clave de alguien
 * que firma en un expediente clínico. La elige el invitado en `/invitacion`.
 *
 * ⚠️ NO LLEVA DATOS MÉDICOS (título, especialidad, cédulas): son los que se
 * imprimen en recetas y documentos legales, y los tecleaba quien no es su
 * dueño. El gate se los pide al médico en su onboarding y la base los vuelve a
 * exigir en `perfil_completo()` antes de dejarle escribir una sola fila.
 *
 * ⚠️ Y NO LLEVA NOMBRE, que fue lo último en salir. Mismo argumento llevado
 * hasta el final: lo que teclee el administrador lo reescribe el invitado. El
 * médico lo pone en el paso `datos` de su onboarding; la secretaria, en el paso
 * `nombre` que `lib/perfil/gate.ts` le pide desde B5-bis — y que existe
 * precisamente porque al quitar este campo el suyo se quedó sin ningún otro
 * sitio donde escribirse.
 *
 * Al quedarse en dos campos iguales para los dos roles, esto dejó de ser una
 * unión discriminada: un `z.object` con el rol acotado dice lo mismo sin
 * ramas. El tope de 254 del correo es el de la RFC 5321, mismo criterio que
 * `LoginSchema`: que un cuerpo de kilobytes no llegue al `audit_log` ni a la
 * clave del limitador por IP.
 */
export const InvitarUsuarioSchema = z.object({
  /* Los dos roles que un administrador puede dar de alta. `super_admin` no
     entra aquí ni debe: esa cuenta no se crea desde una clínica. */
  role: z.enum(['medico', 'secretaria']),
  email: z
    .email('Email inválido')
    .max(254, 'El correo no puede exceder 254 caracteres'),
})
export type InvitarUsuarioInput = z.infer<typeof InvitarUsuarioSchema>

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
 * ⚠️ `nombreAltaShape` SE FUE DEL TODO EN B5-bis. Era la forma compartida del
 * nombre en las altas, y cuando la invitación dejó de pedirlo se quedó sin un
 * solo consumidor. Lo que NO se fue es su tope: `MAX_NOMBRE` vive ahora en
 * `PerfilMedicoUpdateSchema`, que pasó a ser el único escritor de esas tres
 * columnas. Las pruebas de ese tope siguen en
 * `src/lib/tests/registroSchema.test.ts`, apuntando a su nuevo dueño.
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
