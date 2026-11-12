/**
 * gestionReserva.test.ts — la gestión de la reserva por enlace desde la
 * clínica (bloque D; lo que quedó pendiente de D1 y D2): quién gestiona qué
 * (lista A, punto 16), los cuerpos de las rutas, el estado de un enlace y la
 * traducción de errores de Postgres.
 */
import { describe, it, expect } from 'vitest'
import {
  CrearEnlaceSchema, MarcarContactoSchema, RevocarEnlaceSchema, estadoEnlace, frasearHistorial,
  gestionaTodos, puedeGestionarDelMedico, respuestaErrorEnlace, type PerfilGestion,
} from '@/lib/reserva/gestionReserva'

const YO = '00000000-0000-4000-8000-0000000000a1'
const OTRO = '00000000-0000-4000-8000-0000000000b1'

const admin: PerfilGestion = { id: YO, role: 'medico', es_admin_de_clinica: true }
const invitado: PerfilGestion = { id: YO, role: 'medico', es_admin_de_clinica: false }
const secretaria: PerfilGestion = { id: YO, role: 'secretaria', es_admin_de_clinica: false }
const superAdmin: PerfilGestion = { id: YO, role: 'super_admin' }

describe('puedeGestionarDelMedico (lista A, punto 16)', () => {
  it('administrador y secretaria gestionan los de cualquier médico', () => {
    expect(puedeGestionarDelMedico(admin, OTRO)).toBe(true)
    expect(puedeGestionarDelMedico(secretaria, OTRO)).toBe(true)
    expect(gestionaTodos(admin)).toBe(true)
    expect(gestionaTodos(secretaria)).toBe(true)
  })
  it('el médico invitado, sólo los suyos', () => {
    expect(puedeGestionarDelMedico(invitado, YO)).toBe(true)
    expect(puedeGestionarDelMedico(invitado, OTRO)).toBe(false)
    expect(gestionaTodos(invitado)).toBe(false)
  })
  it('falla cerrado: sin perfil, sin médico o con un rol que no es de la clínica', () => {
    expect(puedeGestionarDelMedico(null, YO)).toBe(false)
    expect(puedeGestionarDelMedico(admin, null)).toBe(false)
    expect(puedeGestionarDelMedico(superAdmin, YO)).toBe(false)
    expect(gestionaTodos(null)).toBe(false)
  })
})

describe('CrearEnlaceSchema', () => {
  it('acepta el fijo y el único, con o sin etiqueta', () => {
    expect(CrearEnlaceSchema.safeParse({ clase: 'fijo', medico_id: YO }).success).toBe(true)
    expect(CrearEnlaceSchema.safeParse({ clase: 'unico', medico_id: YO }).success).toBe(true)
    const r = CrearEnlaceSchema.safeParse({ clase: 'unico', medico_id: YO, etiqueta: '  Sra. López  ' })
    expect(r.success && r.data.clase === 'unico' && r.data.etiqueta).toBe('Sra. López')
  })
  it('rechaza claves de más: ni clínica, ni vigencia, ni caducidad viajan del navegador', () => {
    expect(CrearEnlaceSchema.safeParse({ clase: 'unico', medico_id: YO, clinica_id: OTRO }).success).toBe(false)
    expect(CrearEnlaceSchema.safeParse({ clase: 'unico', medico_id: YO, vigencia_dias: 30 }).success).toBe(false)
    expect(CrearEnlaceSchema.safeParse({ clase: 'unico', medico_id: YO, caduca_en: '2099-01-01' }).success).toBe(false)
    expect(CrearEnlaceSchema.safeParse({ clase: 'fijo', medico_id: YO, etiqueta: 'x' }).success).toBe(false)
  })
  it('rechaza una clase desconocida, un médico que no es uuid y una etiqueta vacía o de más de 60', () => {
    expect(CrearEnlaceSchema.safeParse({ clase: 'publico', medico_id: YO }).success).toBe(false)
    expect(CrearEnlaceSchema.safeParse({ clase: 'fijo', medico_id: 'yo' }).success).toBe(false)
    expect(CrearEnlaceSchema.safeParse({ clase: 'unico', medico_id: YO, etiqueta: '   ' }).success).toBe(false)
    expect(CrearEnlaceSchema.safeParse({ clase: 'unico', medico_id: YO, etiqueta: 'x'.repeat(61) }).success).toBe(false)
  })
})

describe('RevocarEnlaceSchema y MarcarContactoSchema', () => {
  it('revocar es lo único que admite el PATCH', () => {
    expect(RevocarEnlaceSchema.safeParse({ accion: 'revocar' }).success).toBe(true)
    expect(RevocarEnlaceSchema.safeParse({ accion: 'reactivar' }).success).toBe(false)
    expect(RevocarEnlaceSchema.safeParse({ accion: 'revocar', revocado_en: null }).success).toBe(false)
  })
  it('bloquear o desbloquear, por cita', () => {
    expect(MarcarContactoSchema.safeParse({ cita_id: YO, accion: 'bloquear' }).success).toBe(true)
    expect(MarcarContactoSchema.safeParse({ cita_id: YO, accion: 'desbloquear' }).success).toBe(true)
    expect(MarcarContactoSchema.safeParse({ cita_id: YO, accion: 'borrar' }).success).toBe(false)
    expect(MarcarContactoSchema.safeParse({ cita_id: 'x', accion: 'bloquear' }).success).toBe(false)
    expect(MarcarContactoSchema.safeParse({ cita_id: YO, accion: 'bloquear', medico_id: OTRO }).success).toBe(false)
  })
})

describe('estadoEnlace', () => {
  const ahora = new Date('2026-11-12T12:00:00Z')
  const base = { clase: 'unico' as const, caduca_en: '2026-11-19T12:00:00Z', usado_en: null, revocado_en: null }
  it('un único sin usar ni caducar está vigente; un fijo no caduca', () => {
    expect(estadoEnlace(base, ahora)).toBe('vigente')
    expect(estadoEnlace({ clase: 'fijo', caduca_en: null, usado_en: null, revocado_en: null }, ahora)).toBe('vigente')
  })
  it('revocado gana a todo; luego usado; luego caducado (en el instante exacto ya caducó)', () => {
    expect(estadoEnlace({ ...base, usado_en: '2026-11-12T00:00:00Z', revocado_en: '2026-11-12T01:00:00Z' }, ahora)).toBe('revocado')
    expect(estadoEnlace({ ...base, usado_en: '2026-11-12T00:00:00Z', caduca_en: '2026-11-01T00:00:00Z' }, ahora)).toBe('usado')
    expect(estadoEnlace({ ...base, caduca_en: '2026-11-12T12:00:00Z' }, ahora)).toBe('caducado')
    expect(estadoEnlace({ ...base, caduca_en: null }, ahora)).toBe('caducado')
  })
})

describe('frasearHistorial', () => {
  it('cuenta en singular y plural, y calla si no hay nada', () => {
    expect(frasearHistorial(0, 0)).toBeNull()
    expect(frasearHistorial(1, 0)).toBe('1 cancelación')
    expect(frasearHistorial(3, 1)).toBe('3 cancelaciones · 1 inasistencia')
    expect(frasearHistorial(0, 2)).toBe('2 inasistencias')
  })
})

describe('respuestaErrorEnlace', () => {
  it('traduce sin devolver el texto de la base', () => {
    expect(respuestaErrorEnlace({ code: '23505' }).status).toBe(409)
    expect(respuestaErrorEnlace({ code: '23514' }).body.error).toBe('medico_invalido')
    expect(respuestaErrorEnlace({ code: '42501' }).status).toBe(403)
    expect(respuestaErrorEnlace({ code: 'XX000' }).status).toBe(500)
  })
})
