import { describe, it, expect } from 'vitest'
import { RegistroSchema, InvitarUsuarioSchema, PerfilMedicoUpdateSchema } from '@/lib/perfil/schemas'

/**
 * Tres schemas en un archivo, y es a propósito: los tres se mueven juntos
 * cuando se mueve el nombre.
 *
 * El registro se recortó a correo y contraseña (Bloque B5, quinta parte) y la
 * invitación se recortó a correo y rol (B5-bis), así que ninguno de los dos
 * escribe ya un nombre. El único que lo escribe es
 * `PerfilMedicoUpdateSchema`, el PUT de Mi Perfil y del onboarding — y ahí es
 * donde vive ahora el tope de 80.
 *
 * ⚠️ LAS PRUEBAS DEL TOPE SE MUDARON CON ÉL, no se borraron, y esa mudanza es
 * el motivo de que este archivo siga existiendo con este nombre. Lo que
 * vigilan no ha cambiado: las tres columnas de `profiles` son `text` sin
 * límite en Postgres, y el nombre viaja a encabezados de PDF y a correos. Si
 * el tope se va, nadie más lo pone.
 *
 * ⚠️ Y VIGILAN ALGO QUE ANTES NO HACÍA FALTA: hasta B5-bis el camino acotado
 * era el alta y el del PUT estaba sin acotar. Al quedarse el PUT como único
 * escritor, un descuido aquí ya no deja «un camino sin tope», deja el ÚNICO
 * camino sin tope.
 */

/* Base válida mínima. Cada prueba la copia y altera UN campo, para que lo que
   falle sea siempre atribuible a ese campo y no a un descuido del fixture. */
const REGISTRO_VALIDO = {
  email: 'medico@ejemplo.com',
  password: 'contrasena-segura-1',
}

/* La invitación ya no tiene ramas: los dos roles mandan lo mismo. */
const INVITACION_MEDICO = {
  role: 'medico' as const,
  email: 'invitado@ejemplo.com',
}

const INVITACION_SECRETARIA = {
  role: 'secretaria' as const,
  email: 'asistente@ejemplo.com',
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

describe('InvitarUsuarioSchema — solo correo y rol', () => {
  it('una invitación de médico con lo justo pasa', () => {
    const r = InvitarUsuarioSchema.safeParse(INVITACION_MEDICO)
    expect(r.success).toBe(true)
  })

  it('una invitación de asistente con lo justo pasa', () => {
    const r = InvitarUsuarioSchema.safeParse(INVITACION_SECRETARIA)
    expect(r.success).toBe(true)
  })

  it('sin correo falla', () => {
    const r = InvitarUsuarioSchema.safeParse({ role: 'medico' })
    expect(r.success).toBe(false)
  })

  it('un correo mal formado falla', () => {
    const r = InvitarUsuarioSchema.safeParse({ ...INVITACION_MEDICO, email: 'no-es-un-correo' })
    expect(r.success).toBe(false)
  })

  it('un rol que no sea medico o secretaria falla', () => {
    const r = InvitarUsuarioSchema.safeParse({ ...INVITACION_MEDICO, role: 'super_admin' })
    expect(r.success).toBe(false)
  })

  it('el correo tiene el tope de 254 de la RFC 5321', () => {
    const cabe = 'a'.repeat(254 - '@ejemplo.com'.length)
    const noCabe = 'a'.repeat(255 - '@ejemplo.com'.length)
    expect(InvitarUsuarioSchema.safeParse({ ...INVITACION_MEDICO, email: `${cabe}@ejemplo.com` }).success).toBe(true)
    expect(InvitarUsuarioSchema.safeParse({ ...INVITACION_MEDICO, email: `${noCabe}@ejemplo.com` }).success).toBe(false)
  })
})

describe('InvitarUsuarioSchema — lo que B5-bis dejó de aceptar', () => {
  /* Estas tres pruebas son el cambio entero, vigilado desde el schema. Zod hace
     strip por defecto: lo que llegue de más no alcanza el `upsert` de
     `profiles`. Así, un cliente viejo —o uno hecho a mano— que siga mandando el
     formulario de antes no puede fijarle la contraseña a otra persona, ni
     escribirle unas cédulas que no son suyas, ni ponerle un nombre que le toca
     poner a ella. */
  it('la contraseña se descarta', () => {
    const r = InvitarUsuarioSchema.safeParse({ ...INVITACION_MEDICO, password: 'la-que-el-admin-eligio' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect('password' in r.data).toBe(false)
  })

  it('el nombre se descarta: lo pone su dueño al entrar', () => {
    const r = InvitarUsuarioSchema.safeParse({
      ...INVITACION_SECRETARIA,
      nombres: 'María',
      apellido_paterno: 'González',
      apellido_materno: 'López',
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(Object.keys(r.data).sort()).toEqual(['email', 'role'])
  })

  it('los datos médicos se descartan', () => {
    const r = InvitarUsuarioSchema.safeParse({
      ...INVITACION_MEDICO,
      titulo: 'Dra.',
      especialidad: 'Ortopedia',
      cedula_profesional: '9552456',
      cedula_especialidad: '12085805',
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(Object.keys(r.data).sort()).toEqual(['email', 'role'])
  })
})

describe('PerfilMedicoUpdateSchema — tope de longitud del nombre (80)', () => {
  const DE_80 = 'a'.repeat(80)
  const DE_81 = 'a'.repeat(81)

  it('nombres de 80 caracteres pasa', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ nombres: DE_80 }).success).toBe(true)
  })

  it('nombres de 81 caracteres falla', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ nombres: DE_81 }).success).toBe(false)
  })

  it('apellido_paterno de 81 caracteres falla', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ apellido_paterno: DE_81 }).success).toBe(false)
  })

  it('apellido_materno de 81 caracteres falla', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ apellido_materno: DE_81 }).success).toBe(false)
  })

  it('el mensaje de error nombra el campo y el límite', () => {
    const r = PerfilMedicoUpdateSchema.safeParse({ apellido_paterno: DE_81 })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.issues[0]?.message).toBe('El apellido paterno no puede exceder 80 caracteres')
  })

  it('el tope se mide DESPUÉS del trim: 80 caracteres con espacios alrededor pasa', () => {
    const r = PerfilMedicoUpdateSchema.safeParse({ nombres: `   ${DE_80}   ` })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.nombres).toBe(DE_80)
  })

  it('sigue exigiendo que nombres no venga vacío si viene', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ nombres: '' }).success).toBe(false)
    expect(PerfilMedicoUpdateSchema.safeParse({ nombres: '   ' }).success).toBe(false)
  })

  it('apellido_materno vacío se sigue normalizando a null', () => {
    const r = PerfilMedicoUpdateSchema.safeParse({ apellido_materno: '  ' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.apellido_materno).toBeNull()
  })
})

describe('PerfilMedicoUpdateSchema — el caso de seguridad', () => {
  /* Este PUT exige sesión, a diferencia del registro público donde vivían antes
     estas pruebas — pero el tope no sobra por eso: las tres columnas de
     `profiles` son `text` en Postgres, sin límite, y el nombre acaba en
     encabezados de PDF y en correos. Lo que cambió es quién puede intentarlo,
     no lo que pasa si nadie lo acota. */
  const DE_64KB = 'a'.repeat(64 * 1024)

  it('un nombre de 64 KB es rechazado', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ nombres: DE_64KB }).success).toBe(false)
  })

  it('un apellido_paterno de 64 KB es rechazado', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ apellido_paterno: DE_64KB }).success).toBe(false)
  })

  it('un apellido_materno de 64 KB es rechazado', () => {
    expect(PerfilMedicoUpdateSchema.safeParse({ apellido_materno: DE_64KB }).success).toBe(false)
  })

  it('un nombre con marcado HTML dentro del tope SÍ pasa el schema', () => {
    /* El schema acota longitud, NO sanea: escapar es trabajo de escapeHtml en el
       punto de interpolación. Esta prueba fija esa frontera para que nadie
       confunda «pasó la validación» con «es seguro pintarlo en HTML». */
    expect(PerfilMedicoUpdateSchema.safeParse({ nombres: '<script>x</script>' }).success).toBe(true)
  })
})
