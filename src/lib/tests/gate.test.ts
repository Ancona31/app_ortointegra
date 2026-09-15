import { describe, it, expect } from 'vitest'
import { evaluarPerfil, type DatosPerfilGate } from '@/lib/perfil/gate'

/* Base completa. Cada prueba la copia y altera UN campo, para que lo que falle
   sea siempre atribuible a ese campo y no a un descuido del fixture. Mismo
   patrón que registroSchema.test.ts. */
const DUENO_COMPLETO: DatosPerfilGate = {
  role: 'medico',
  nombres: 'Angel',
  especialidad: 'Traumatología',
  cedula_profesional: '9552456',
  clinica_id: 'f1a52dd0-e62b-4683-ab88-0f2fe2656e61',
  consultoriosActivos: 1,
}

/* Lo que distingue al invitado es QUIÉN lo dio de alta, no si administra la
   clínica. El uuid es el de su administrador. */
const INVITADO_COMPLETO: DatosPerfilGate = {
  ...DUENO_COMPLETO,
  invitado_por: '7c9e1b34-52a1-4f0e-9d3b-1a8c6e4f2b90',
}

describe('evaluarPerfil — roles exentos', () => {
  it('super_admin no requiere nada, ni siquiera clínica', () => {
    // Su perfil no tiene clínica POR DISEÑO: el caso realista es éste.
    const r = evaluarPerfil({
      role: 'super_admin',
      clinica_id: null,
      nombres: null,
      especialidad: null,
      cedula_profesional: null,
      consultoriosActivos: 0,
    })
    expect(r.completo).toBe(true)
    expect(r.pendientes).toEqual([])
    expect(r.siguiente).toBeNull()
    expect(r.exento).toBe('super_admin')
  })

  it('secretaria no requiere nada', () => {
    const r = evaluarPerfil({
      role: 'secretaria',
      clinica_id: 'clinica-1',
      nombres: null,
      especialidad: null,
      cedula_profesional: null,
      consultoriosActivos: 0,
    })
    expect(r.completo).toBe(true)
    expect(r.pendientes).toEqual([])
    expect(r.exento).toBe('secretaria')
  })

  it('un exento nunca trae campos faltantes ni requiere soporte', () => {
    const r = evaluarPerfil({ role: 'secretaria', consultoriosActivos: 0 })
    expect(r.camposFaltantes).toEqual([])
    expect(r.requiereSoporte).toBe(false)
  })
})

describe('evaluarPerfil — médico con todo', () => {
  it('el dueño completo pasa', () => {
    const r = evaluarPerfil(DUENO_COMPLETO)
    expect(r.completo).toBe(true)
    expect(r.pendientes).toEqual([])
    expect(r.siguiente).toBeNull()
    expect(r.camposFaltantes).toEqual([])
    expect(r.exento).toBeNull()
    expect(r.requiereSoporte).toBe(false)
  })

  it('el invitado completo pasa igual que el dueño', () => {
    const r = evaluarPerfil(INVITADO_COMPLETO)
    expect(r.completo).toBe(true)
    expect(r.pendientes).toEqual([])
  })

})

describe('evaluarPerfil — paso 1, datos del médico', () => {
  it('falta nombres', () => {
    const r = evaluarPerfil({ ...DUENO_COMPLETO, nombres: null })
    expect(r.completo).toBe(false)
    expect(r.pendientes).toEqual(['datos_medico'])
    expect(r.siguiente).toBe('datos_medico')
    expect(r.camposFaltantes).toEqual(['nombres'])
  })

  it('falta especialidad', () => {
    const r = evaluarPerfil({ ...DUENO_COMPLETO, especialidad: null })
    expect(r.camposFaltantes).toEqual(['especialidad'])
    expect(r.pendientes).toEqual(['datos_medico'])
  })

  it('falta cedula_profesional', () => {
    const r = evaluarPerfil({ ...DUENO_COMPLETO, cedula_profesional: null })
    expect(r.camposFaltantes).toEqual(['cedula_profesional'])
    expect(r.pendientes).toEqual(['datos_medico'])
  })

  it('un campo en blanco cuenta como ausente', () => {
    const r = evaluarPerfil({ ...DUENO_COMPLETO, cedula_profesional: '   ' })
    expect(r.camposFaltantes).toEqual(['cedula_profesional'])
  })

  it('faltan los tres, en orden de presentación', () => {
    const r = evaluarPerfil({
      ...DUENO_COMPLETO,
      nombres: null,
      especialidad: '',
      cedula_profesional: null,
    })
    expect(r.camposFaltantes).toEqual(['nombres', 'especialidad', 'cedula_profesional'])
    expect(r.pendientes).toEqual(['datos_medico'])
  })

  it('cedula_especialidad no se exige: no existe como campo del criterio', () => {
    // Un médico general no la tiene. El fixture no la lleva y pasa igual.
    expect(evaluarPerfil(DUENO_COMPLETO).completo).toBe(true)
  })
})

describe('evaluarPerfil — paso 2, clínica', () => {
  it('el dueño sin clinica_id debe crear la clínica', () => {
    // Dueño = nadie lo invitó. El fixture no lleva `invitado_por`.
    const r = evaluarPerfil({ ...DUENO_COMPLETO, clinica_id: null })
    expect(r.pendientes).toEqual(['clinica'])
    expect(r.siguiente).toBe('clinica')
    expect(r.requiereSoporte).toBe(false)
  })

  it('el invitado CON clínica no requiere soporte', () => {
    /* `invitado_por` sin el `sinClinica` mandaría a soporte a TODOS los
       invitados de la aplicación. Éste es el caso que lo impide. */
    expect(evaluarPerfil(INVITADO_COMPLETO).requiereSoporte).toBe(false)
  })

  it('el invitado sin clinica_id también se bloquea, pero no puede resolverlo', () => {
    // Estado alcanzable: profiles_clinica_id_fkey es ON DELETE SET NULL.
    const r = evaluarPerfil({ ...INVITADO_COMPLETO, clinica_id: null })
    expect(r.completo).toBe(false)
    expect(r.pendientes).toEqual(['clinica'])
    expect(r.requiereSoporte).toBe(true)
  })

  it('invitado_por ausente se trata como DUEÑO, no como invitado', () => {
    /* El lado al que falla es lo que importa: sin procedencia el gate enseña
       un formulario de clínica de más, nunca el panel de soporte, que es un
       encierro sin salida. La versión anterior de esta prueba afirmaba lo
       contrario sobre `es_admin_de_clinica` —«ausente se trata como
       invitado»—, y ese default false era precisamente el encierro. */
    const sinProcedencia: DatosPerfilGate = { ...INVITADO_COMPLETO, clinica_id: null }
    delete sinProcedencia.invitado_por
    const r = evaluarPerfil(sinProcedencia)
    expect(r.completo).toBe(false)
    expect(r.requiereSoporte).toBe(false)
  })

  it('invitado_por en blanco es dueño, igual que ausente', () => {
    const r = evaluarPerfil({ ...INVITADO_COMPLETO, invitado_por: '  ', clinica_id: null })
    expect(r.requiereSoporte).toBe(false)
  })

  it('clinica_id en blanco no cuenta como clínica', () => {
    const r = evaluarPerfil({ ...DUENO_COMPLETO, clinica_id: '  ' })
    expect(r.pendientes).toEqual(['clinica'])
  })
})

describe('evaluarPerfil — paso 3, consultorio', () => {
  it('sin consultorios, falta el paso', () => {
    const r = evaluarPerfil({ ...DUENO_COMPLETO, consultoriosActivos: 0 })
    expect(r.pendientes).toEqual(['consultorio'])
    expect(r.siguiente).toBe('consultorio')
  })

  it('el invitado también necesita el suyo', () => {
    const r = evaluarPerfil({ ...INVITADO_COMPLETO, consultoriosActivos: 0 })
    expect(r.pendientes).toEqual(['consultorio'])
  })

  it('varios consultorios bastan igual que uno', () => {
    expect(evaluarPerfil({ ...DUENO_COMPLETO, consultoriosActivos: 4 }).completo).toBe(true)
  })

  it('un conteo no numérico cuenta como falta, no como cumplido', () => {
    const r = evaluarPerfil({ ...DUENO_COMPLETO, consultoriosActivos: Number.NaN })
    expect(r.pendientes).toEqual(['consultorio'])
  })
})

describe('evaluarPerfil — orden y pureza', () => {
  it('un médico vacío devuelve los tres pasos en orden', () => {
    const r = evaluarPerfil({
      role: 'medico',
      nombres: null,
      especialidad: null,
      cedula_profesional: null,
      clinica_id: null,
      consultoriosActivos: 0,
    })
    expect(r.pendientes).toEqual(['datos_medico', 'clinica', 'consultorio'])
    expect(r.siguiente).toBe('datos_medico')
    expect(r.completo).toBe(false)
  })

  it('la misma entrada da la misma salida y no muta el argumento', () => {
    // (c) del encargo: servidor y cliente tienen que concluir lo mismo.
    const entrada: DatosPerfilGate = { ...DUENO_COMPLETO, nombres: null }
    const copia = { ...entrada }
    expect(evaluarPerfil(entrada)).toEqual(evaluarPerfil(entrada))
    expect(entrada).toEqual(copia)
  })
})
