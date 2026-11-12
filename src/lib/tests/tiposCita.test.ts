/**
 * tiposCita.test.ts — tipos de cita (plan del bloque B, paso B6; P5): los
 * esquemas de alta y edición con los límites de los CHECK, la compatibilidad
 * con el médico, la decisión de qué escribir en `tipo_cita_*` al guardar una
 * cita, y la traducción de errores de Postgres.
 */
import { describe, it, expect } from 'vitest'
import {
  CrearTipoCitaSchema, EditarTipoCitaSchema, LIMITES_TIPO_CITA, tipoCompatible, validarTipoParaCita,
  respuestaErrorTipoCita,
} from '@/lib/agenda/tiposCita'

const MEDICO_A = '00000000-0000-4000-8000-0000000000a1'
const MEDICO_B = '00000000-0000-4000-8000-0000000000b1'
const TIPO = '00000000-0000-4000-8000-0000000000f1'

describe('CrearTipoCitaSchema', () => {
  it('acepta un tipo de clínica mínimo y uno personal completo', () => {
    expect(CrearTipoCitaSchema.safeParse({ nombre: 'Primera vez', duracion_min: 45 }).success).toBe(true)
    expect(CrearTipoCitaSchema.safeParse({
      nombre: 'Valoración', duracion_min: 30, color: 'indigo', medico_id: MEDICO_A,
    }).success).toBe(true)
    expect(CrearTipoCitaSchema.safeParse({ nombre: 'X', duracion_min: 5, color: null, medico_id: null }).success).toBe(true)
  })

  it('recorta el nombre y rechaza el vacío o el de más de 60', () => {
    const r = CrearTipoCitaSchema.safeParse({ nombre: '  Control  ', duracion_min: 15 })
    expect(r.success && r.data.nombre).toBe('Control')
    expect(CrearTipoCitaSchema.safeParse({ nombre: '   ', duracion_min: 15 }).success).toBe(false)
    expect(CrearTipoCitaSchema.safeParse({ nombre: 'x'.repeat(61), duracion_min: 15 }).success).toBe(false)
    expect(CrearTipoCitaSchema.safeParse({ nombre: 'x'.repeat(60), duracion_min: 15 }).success).toBe(true)
  })

  it('duración: 5 a 600 en múltiplos de 5 (los mismos bordes que el CHECK)', () => {
    for (const d of [LIMITES_TIPO_CITA.duracionMin, 45, LIMITES_TIPO_CITA.duracionMax]) {
      expect(CrearTipoCitaSchema.safeParse({ nombre: 'a', duracion_min: d }).success).toBe(true)
    }
    for (const d of [0, 3, 7, 12.5, 605, -5]) {
      expect(CrearTipoCitaSchema.safeParse({ nombre: 'a', duracion_min: d }).success).toBe(false)
    }
  })

  it('sólo los seis colores de las citas', () => {
    expect(CrearTipoCitaSchema.safeParse({ nombre: 'a', duracion_min: 5, color: 'rojo' }).success).toBe(false)
  })

  it('rechaza claves de más en vez de ignorarlas (clinica_id, activo, id)', () => {
    for (const extra of [{ clinica_id: MEDICO_A }, { activo: false }, { id: TIPO }]) {
      expect(CrearTipoCitaSchema.safeParse({ nombre: 'a', duracion_min: 5, ...extra }).success).toBe(false)
    }
  })

  it('un medico_id que no es uuid se rechaza', () => {
    expect(CrearTipoCitaSchema.safeParse({ nombre: 'a', duracion_min: 5, medico_id: 'abc' }).success).toBe(false)
  })
})

describe('EditarTipoCitaSchema', () => {
  it('acepta cambios parciales y el archivo', () => {
    expect(EditarTipoCitaSchema.safeParse({ activo: false }).success).toBe(true)
    expect(EditarTipoCitaSchema.safeParse({ nombre: 'Nuevo', duracion_min: 60, color: null }).success).toBe(true)
  })

  it('no deja cambiar el ámbito ni la clínica, y exige algo que cambiar', () => {
    expect(EditarTipoCitaSchema.safeParse({ medico_id: MEDICO_A }).success).toBe(false)
    expect(EditarTipoCitaSchema.safeParse({ clinica_id: MEDICO_A }).success).toBe(false)
    expect(EditarTipoCitaSchema.safeParse({}).success).toBe(false)
    expect(EditarTipoCitaSchema.safeParse(null).success).toBe(false)
  })
})

describe('tipoCompatible', () => {
  it('un tipo de clínica vale para cualquier médico; uno personal sólo para el suyo', () => {
    expect(tipoCompatible({ medico_id: null }, MEDICO_A)).toBe(true)
    expect(tipoCompatible({ medico_id: null }, null)).toBe(true)
    expect(tipoCompatible({ medico_id: MEDICO_A }, MEDICO_A)).toBe(true)
    expect(tipoCompatible({ medico_id: MEDICO_A }, MEDICO_B)).toBe(false)
    expect(tipoCompatible({ medico_id: MEDICO_A }, null)).toBe(false)
  })
})

describe('validarTipoParaCita', () => {
  const tipoPersonal = { id: TIPO, medico_id: MEDICO_A, nombre: 'Valoración', activo: true }
  const base = { tipoCitaId: TIPO, tipo: tipoPersonal, medicoId: MEDICO_A, conPaciente: true, recienAsignado: true }

  it('asignar un tipo compatible y activo escribe el id y la instantánea del nombre', () => {
    expect(validarTipoParaCita(base)).toEqual({
      ok: true, columnas: { tipo_cita_id: TIPO, tipo_cita_nombre: 'Valoración' },
    })
  })

  it('quitar el tipo escribe nulos; no tocarlo no escribe nada', () => {
    expect(validarTipoParaCita({ ...base, tipoCitaId: null, tipo: null }))
      .toEqual({ ok: true, columnas: { tipo_cita_id: null, tipo_cita_nombre: null } })
    expect(validarTipoParaCita({ ...base, tipoCitaId: null, tipo: null, recienAsignado: false }))
      .toEqual({ ok: true, columnas: null })
  })

  it('un tipo que la RLS no deja ver (o que no es el pedido) no existe', () => {
    expect(validarTipoParaCita({ ...base, tipo: null })).toEqual({ ok: false, error: 'tipo_no_encontrado' })
    expect(validarTipoParaCita({ ...base, tipo: { ...tipoPersonal, id: MEDICO_B } }))
      .toEqual({ ok: false, error: 'tipo_no_encontrado' })
  })

  it('sólo en citas con paciente', () => {
    expect(validarTipoParaCita({ ...base, conPaciente: false })).toEqual({ ok: false, error: 'tipo_sin_paciente' })
  })

  it('quitar el paciente sin quitar el tipo falla; quitando los dos, sale bien', () => {
    expect(validarTipoParaCita({ ...base, conPaciente: false, recienAsignado: false }))
      .toEqual({ ok: false, error: 'tipo_sin_paciente' })
    expect(validarTipoParaCita({ ...base, tipoCitaId: null, tipo: null, conPaciente: false }))
      .toEqual({ ok: true, columnas: { tipo_cita_id: null, tipo_cita_nombre: null } })
  })

  it('un tipo archivado no se asigna, pero el que ya tenía la cita se conserva', () => {
    const archivado = { ...tipoPersonal, activo: false }
    expect(validarTipoParaCita({ ...base, tipo: archivado })).toEqual({ ok: false, error: 'tipo_archivado' })
    expect(validarTipoParaCita({ ...base, tipo: archivado, recienAsignado: false })).toEqual({ ok: true, columnas: null })
  })

  it('reasignar la cita a un médico incompatible con su tipo → tipo_incompatible (P5)', () => {
    expect(validarTipoParaCita({ ...base, medicoId: MEDICO_B, recienAsignado: false }))
      .toEqual({ ok: false, error: 'tipo_incompatible' })
    expect(validarTipoParaCita({ ...base, medicoId: MEDICO_B })).toEqual({ ok: false, error: 'tipo_incompatible' })
    expect(validarTipoParaCita({ ...base, medicoId: MEDICO_B, tipo: { ...tipoPersonal, medico_id: null } }).ok).toBe(true)
  })
})

describe('respuestaErrorTipoCita', () => {
  it('nombre repetido → 409; médico ajeno → 400; RLS → 403; lo demás → 500 sin el mensaje crudo', () => {
    expect(respuestaErrorTipoCita({ code: '23505', message: 'duplicate key' }).status).toBe(409)
    expect(respuestaErrorTipoCita({ code: '23514', message: 'El médico del tipo de cita no pertenece a la clínica' }))
      .toEqual({ status: 400, body: { error: 'medico_invalido', mensaje: 'El médico elegido no es de esta clínica' } })
    expect(respuestaErrorTipoCita({ code: '23514', message: 'violates check constraint' }).body.error).toBe('datos_invalidos')
    expect(respuestaErrorTipoCita({ code: '42501', message: 'new row violates row-level security' }).status).toBe(403)
    const r = respuestaErrorTipoCita({ code: 'XX000', message: 'secreto interno' })
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.body)).not.toContain('secreto')
  })
})
