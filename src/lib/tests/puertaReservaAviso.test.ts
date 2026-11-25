/**
 * puertaReservaAviso.test.ts — privacidad 2026-12, punto 5: un enlace de
 * reserva no abre si el consultorio principal no tiene dirección o no hay
 * teléfono de contacto (los avisos saldrían con huecos). El mismo null de
 * siempre, que la página y las rutas convierten en el 404 uniforme.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContextoReserva } from '@/lib/reserva/servidorReserva'

const h = vi.hoisted(() => ({ ctx: null as unknown }))
vi.mock('@/lib/reserva/secretos', () => ({
  secretoDisponible: () => true, esCodigoDeEnlace: () => true, hashDeCodigo: () => 'a'.repeat(64),
}))
vi.mock('@/lib/reserva/servidorReserva', () => ({ contextoDeEnlace: async () => h.ctx }))

import { abrirEnlace, datosDelAviso } from '@/lib/reserva/puertaReserva'

const ID = '00000000-0000-4000-8000-000000000001'
type Consultorio = ContextoReserva['consultorios'][number]

function consultorio(c: Partial<Consultorio> = {}): Consultorio {
  return { id: ID, nombre: 'Centro', direccion: 'Calle 1, Mérida', telefono: '9990000001', timezone: 'America/Merida', horario: null, ...c }
}
function contexto(consultorios: Consultorio[], telefonoMedico: string | null = null): ContextoReserva {
  return {
    clinica_id: ID, enlace_id: ID, medico_id: ID, clase: 'fijo', estado: 'vigente',
    medico: { titulo: 'Dr.', nombres: 'Uno', apellido_paterno: 'Dos', apellido_materno: null, especialidad: null, telefono: telefonoMedico },
    clinica: null, consultorios, tipos: [], ajustes: { anticipacion_min_horas: 2, horizonte_dias: 60 },
  }
}

describe('datosDelAviso', () => {
  it('toma el consultorio principal (el primero) y su teléfono', () => {
    const ctx = contexto([consultorio(), consultorio({ nombre: 'Norte', direccion: 'Otra' })])
    expect(datosDelAviso(ctx)).toEqual({ consultorio: 'Centro', direccion: 'Calle 1, Mérida', telefono: '9990000001' })
  })
  it('sin teléfono en el consultorio vale el del médico', () => {
    expect(datosDelAviso(contexto([consultorio({ telefono: null })], '9995550000'))?.telefono).toBe('9995550000')
  })
  it('sin dirección, con la dirección en blanco o sin ningún teléfono: null', () => {
    expect(datosDelAviso(contexto([consultorio({ direccion: null })]))).toBeNull()
    expect(datosDelAviso(contexto([consultorio({ direccion: '   ' })]))).toBeNull()
    expect(datosDelAviso(contexto([consultorio({ telefono: null })]))).toBeNull()
    expect(datosDelAviso(contexto([consultorio({ telefono: ' ' })], ' '))).toBeNull()
  })
})

describe('abrirEnlace', () => {
  beforeEach(() => { h.ctx = null })
  it('abre con dirección y teléfono', async () => {
    h.ctx = contexto([consultorio()])
    expect((await abrirEnlace('x'))?.ctx.enlace_id).toBe(ID)
  })
  it('no abre si falta la dirección o el teléfono', async () => {
    h.ctx = contexto([consultorio({ direccion: null })])
    expect(await abrirEnlace('x')).toBeNull()
    h.ctx = contexto([consultorio({ telefono: null })])
    expect(await abrirEnlace('x')).toBeNull()
  })
  it('sin ningún consultorio sigue como antes: lo decide motivosApertura, no esta puerta', async () => {
    h.ctx = contexto([])
    expect(await abrirEnlace('x')).not.toBeNull()
  })
})
