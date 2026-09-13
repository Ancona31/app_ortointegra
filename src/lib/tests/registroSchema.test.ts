import { describe, it, expect } from 'vitest'
import { RegistroSchema } from '@/lib/perfil/schemas'

/* Base válida mínima. Cada prueba la copia y altera UN campo, para que lo que
   falle sea siempre atribuible a ese campo y no a un descuido del fixture. */
const REGISTRO_VALIDO = {
  email: 'medico@ejemplo.com',
  password: 'contrasena-segura-1',
  nombres: 'Angel',
  apellido_paterno: 'Ancona',
  apellido_materno: 'Pérez',
  nombreClinica: 'Consultorio Spinus',
  titulo: 'Dr.',
  especialidad: 'Traumatología',
  cedula_profesional: '9552456',
  cedula_especialidad: '12085805',
  tipo: 'independiente' as const,
}

describe('RegistroSchema — registro válido', () => {
  it('acepta un registro completo', () => {
    const r = RegistroSchema.safeParse(REGISTRO_VALIDO)
    expect(r.success).toBe(true)
  })

  it('conserva los campos tal como se enviaron', () => {
    const r = RegistroSchema.safeParse(REGISTRO_VALIDO)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.nombres).toBe('Angel')
    expect(r.data.apellido_paterno).toBe('Ancona')
    expect(r.data.apellido_materno).toBe('Pérez')
    expect(r.data.email).toBe('medico@ejemplo.com')
  })

  it('tipo cae a independiente cuando no se envía', () => {
    const { tipo: _tipo, ...sinTipo } = REGISTRO_VALIDO
    const r = RegistroSchema.safeParse(sinTipo)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.tipo).toBe('independiente')
  })
})

describe('RegistroSchema — tope de longitud del nombre (80)', () => {
  const DE_80 = 'a'.repeat(80)
  const DE_81 = 'a'.repeat(81)

  it('nombres de 80 caracteres pasa', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: DE_80 })
    expect(r.success).toBe(true)
  })

  it('nombres de 81 caracteres falla', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: DE_81 })
    expect(r.success).toBe(false)
  })

  it('apellido_paterno de 80 caracteres pasa', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_paterno: DE_80 })
    expect(r.success).toBe(true)
  })

  it('apellido_paterno de 81 caracteres falla', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_paterno: DE_81 })
    expect(r.success).toBe(false)
  })

  it('apellido_materno de 80 caracteres pasa', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_materno: DE_80 })
    expect(r.success).toBe(true)
  })

  it('apellido_materno de 81 caracteres falla', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_materno: DE_81 })
    expect(r.success).toBe(false)
  })

  it('el mensaje de error nombra el campo y el límite', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: DE_81 })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.issues[0]?.message).toBe('El nombre no puede exceder 80 caracteres')
  })

  it('el tope se mide DESPUÉS del trim: 80 caracteres con espacios alrededor pasa', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: `   ${DE_80}   ` })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.nombres).toBe(DE_80)
  })
})

describe('RegistroSchema — nombre obligatorio', () => {
  it('nombres vacío falla', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: '' })
    expect(r.success).toBe(false)
  })

  it('nombres de solo espacios falla — el trim lo deja vacío', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: '     ' })
    expect(r.success).toBe(false)
  })

  it('apellido_paterno vacío falla', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_paterno: '' })
    expect(r.success).toBe(false)
  })
})

describe('RegistroSchema — apellido_materno se normaliza a null', () => {
  it('ausente se transforma a null', () => {
    const { apellido_materno: _am, ...sinMaterno } = REGISTRO_VALIDO
    const r = RegistroSchema.safeParse(sinMaterno)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })

  it('vacío se transforma a null', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_materno: '' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })

  it('solo espacios se transforma a null', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_materno: '   ' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })

  it('null explícito se queda en null', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_materno: null })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })
})

describe('RegistroSchema — el caso de seguridad', () => {
  /* /api/auth/registro es una ruta PÚBLICA y sin sesión, y las tres columnas de
     `profiles` son `text` en Postgres: sin el tope del schema, nada impide que
     una fila de registro guarde kilobytes en el nombre — que además acaba
     interpolado en el correo de confirmación. */
  const DE_64KB = 'a'.repeat(64 * 1024)

  it('un nombre de 64 KB es rechazado', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: DE_64KB })
    expect(r.success).toBe(false)
  })

  it('un apellido_paterno de 64 KB es rechazado', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_paterno: DE_64KB })
    expect(r.success).toBe(false)
  })

  it('un apellido_materno de 64 KB es rechazado', () => {
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, apellido_materno: DE_64KB })
    expect(r.success).toBe(false)
  })

  it('un nombre con marcado HTML dentro del tope SÍ pasa el schema', () => {
    /* El schema acota longitud, NO sanea: escapar es trabajo de escapeHtml en el
       punto de interpolación. Esta prueba fija esa frontera para que nadie
       confunda «pasó la validación» con «es seguro pintarlo en HTML». */
    const r = RegistroSchema.safeParse({ ...REGISTRO_VALIDO, nombres: '<script>x</script>' })
    expect(r.success).toBe(true)
  })
})
