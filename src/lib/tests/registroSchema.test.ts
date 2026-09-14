import { describe, it, expect } from 'vitest'
import { RegistroSchema, CrearUsuarioSchema } from '@/lib/perfil/schemas'

/**
 * Dos schemas en un archivo, y es a propósito.
 *
 * El registro se recortó a correo y contraseña (Bloque B5, quinta parte), así
 * que `RegistroSchema` ya no lleva `nombreAltaShape` ni, con él, el tope de
 * `MAX_NOMBRE`. Esa forma NO desapareció: la sigue llevando
 * `CrearUsuarioSchema`, el alta que hace el admin de la clínica — su comentario
 * en `schemas.ts` ya decía que el tope acota «TAMBIÉN» a ese schema.
 *
 * Las pruebas del tope se mudaron ahí en vez de borrarse. Lo que vigilan sigue
 * siendo lo mismo: las tres columnas de `profiles` son `text` sin límite en
 * Postgres, y el nombre viaja a encabezados de PDF y a correos. Si el tope se
 * va, nadie más lo pone.
 */

/* Base válida mínima. Cada prueba la copia y altera UN campo, para que lo que
   falle sea siempre atribuible a ese campo y no a un descuido del fixture. */
const REGISTRO_VALIDO = {
  email: 'medico@ejemplo.com',
  password: 'contrasena-segura-1',
}

const ALTA_VALIDA = {
  role: 'medico' as const,
  email: 'invitado@ejemplo.com',
  password: 'contrasena-segura-1',
  nombres: 'Angel',
  apellido_paterno: 'Ancona',
  apellido_materno: 'Pérez',
}

describe('RegistroSchema — registro válido', () => {
  it('acepta correo y contraseña', () => {
    const r = RegistroSchema.safeParse(REGISTRO_VALIDO)
    expect(r.success).toBe(true)
  })

  it('conserva los campos tal como se enviaron', () => {
    const r = RegistroSchema.safeParse(REGISTRO_VALIDO)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.email).toBe('medico@ejemplo.com')
    expect(r.data.password).toBe('contrasena-segura-1')
  })

  it('descarta los campos que el registro ya no pide', () => {
    /* Zod hace strip por defecto, y aquí eso es la barrera: un cliente viejo
       —o uno hecho a mano— que siga mandando el formulario completo no puede
       colar nombre, cédulas ni clínica por esta ruta. Lo que llegue de más no
       alcanza el `upsert` de `profiles`. */
    const r = RegistroSchema.safeParse({
      ...REGISTRO_VALIDO,
      nombres: 'Angel',
      apellido_paterno: 'Ancona',
      nombreClinica: 'Consultorio Spinus',
      cedula_profesional: '9552456',
      tipo: 'independiente',
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(Object.keys(r.data).sort()).toEqual(['email', 'password'])
  })
})

describe('CrearUsuarioSchema — tope de longitud del nombre (80)', () => {
  const DE_80 = 'a'.repeat(80)
  const DE_81 = 'a'.repeat(81)

  it('nombres de 80 caracteres pasa', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: DE_80 })
    expect(r.success).toBe(true)
  })

  it('nombres de 81 caracteres falla', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: DE_81 })
    expect(r.success).toBe(false)
  })

  it('apellido_paterno de 80 caracteres pasa', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_paterno: DE_80 })
    expect(r.success).toBe(true)
  })

  it('apellido_paterno de 81 caracteres falla', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_paterno: DE_81 })
    expect(r.success).toBe(false)
  })

  it('apellido_materno de 80 caracteres pasa', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_materno: DE_80 })
    expect(r.success).toBe(true)
  })

  it('apellido_materno de 81 caracteres falla', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_materno: DE_81 })
    expect(r.success).toBe(false)
  })

  it('el mensaje de error nombra el campo y el límite', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: DE_81 })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.issues[0]?.message).toBe('El nombre no puede exceder 80 caracteres')
  })

  it('el tope se mide DESPUÉS del trim: 80 caracteres con espacios alrededor pasa', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: `   ${DE_80}   ` })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.nombres).toBe(DE_80)
  })
})

describe('CrearUsuarioSchema — nombre obligatorio', () => {
  it('nombres vacío falla', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: '' })
    expect(r.success).toBe(false)
  })

  it('nombres de solo espacios falla — el trim lo deja vacío', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: '     ' })
    expect(r.success).toBe(false)
  })

  it('apellido_paterno vacío falla', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_paterno: '' })
    expect(r.success).toBe(false)
  })
})

describe('CrearUsuarioSchema — apellido_materno se normaliza a null', () => {
  it('ausente se transforma a null', () => {
    const { apellido_materno: _am, ...sinMaterno } = ALTA_VALIDA
    const r = CrearUsuarioSchema.safeParse(sinMaterno)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })

  it('vacío se transforma a null', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_materno: '' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })

  it('solo espacios se transforma a null', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_materno: '   ' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })

  it('null explícito se queda en null', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_materno: null })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })
})

describe('CrearUsuarioSchema — el caso de seguridad', () => {
  /* El alta de admin exige sesión, a diferencia del registro público donde
     vivían antes estas pruebas — pero el tope no sobra por eso: las tres
     columnas de `profiles` son `text` en Postgres, sin límite, y el nombre
     acaba en encabezados de PDF y en el correo del alta. Lo que cambió es quién
     puede intentarlo, no lo que pasa si nadie lo acota. */
  const DE_64KB = 'a'.repeat(64 * 1024)

  it('un nombre de 64 KB es rechazado', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: DE_64KB })
    expect(r.success).toBe(false)
  })

  it('un apellido_paterno de 64 KB es rechazado', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_paterno: DE_64KB })
    expect(r.success).toBe(false)
  })

  it('un apellido_materno de 64 KB es rechazado', () => {
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, apellido_materno: DE_64KB })
    expect(r.success).toBe(false)
  })

  it('un nombre con marcado HTML dentro del tope SÍ pasa el schema', () => {
    /* El schema acota longitud, NO sanea: escapar es trabajo de escapeHtml en el
       punto de interpolación. Esta prueba fija esa frontera para que nadie
       confunda «pasó la validación» con «es seguro pintarlo en HTML». */
    const r = CrearUsuarioSchema.safeParse({ ...ALTA_VALIDA, nombres: '<script>x</script>' })
    expect(r.success).toBe(true)
  })
})
