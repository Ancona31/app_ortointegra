/**
 * porAsignar.test.ts — I3 (punto 10): un evento NUEVO de Google «por asignar»
 * (`google_asignacion = 'por_asignar'`, sin paciente ni reserva) se trata como
 * una cita por ligar: marca «Por asignar», cuenta como cita en la cabecera y en
 * el desglose, sale «Iniciar consulta» y la tarjeta ofrece «¿No es una cita?».
 * Tras «¿No es una cita?» (`evento`) vuelve a ser un evento con «Convertir en
 * cita». Sin la columna (`undefined`) todo queda como antes.
 *
 * MUTACIONES (comprobadas en rojo): `esPorAsignar` siempre `false` → seis de
 * nueve (todas las que miran una por asignar sin ligar); quitar el `push('no-es-cita')` de
 * `disposicionSinCambios` → «la tarjeta ofrece ¿No es una cita?»; pasar sin
 * `google_asignacion` en `contarVisibles` → «cuenta como cita».
 */
import { describe, it, expect } from 'vitest'
import type { EventApi } from '@fullcalendar/core'
import { esEventoGenerico, esPorAsignar, esPorLigar, marcaPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { accionesDeTarjeta, disposicionDeTarjeta, esConvertible, nombreDeTarjeta, puedeIniciarConsulta } from '@/lib/agenda/accionesTarjeta'
import { contarVisibles } from '@/lib/agenda/conteoAgenda'
import { desgloseDeEstados } from '@/lib/agenda/huecosAgenda'

const POR_ASIGNAR = { paciente_id: null, reserva_canal: null, google_asignacion: 'por_asignar' } as const
const EVENTO = { paciente_id: null, reserva_canal: null, google_asignacion: 'evento' } as const

describe('clasificación', () => {
  it('por asignar: es una por ligar, no un evento', () => {
    expect(esPorAsignar(POR_ASIGNAR)).toBe(true)
    expect(esPorLigar(POR_ASIGNAR)).toBe(true)
    expect(esEventoGenerico(POR_ASIGNAR)).toBe(false)
  })
  it('«evento» (¿No es una cita?) y sin columna: un evento como siempre', () => {
    for (const f of [EVENTO, { paciente_id: null }, { paciente_id: null, reserva_canal: null }]) {
      expect(esPorAsignar(f)).toBe(false)
      expect(esPorLigar(f)).toBe(false)
      expect(esEventoGenerico(f)).toBe(true)
    }
  })
  it('ligada a un paciente, una cita normal (la marca ya no cuenta)', () => {
    const ligada = { ...POR_ASIGNAR, paciente_id: 'p1' }
    expect(esPorAsignar(ligada)).toBe(false)
    expect(esPorLigar(ligada)).toBe(false)
    expect(esEventoGenerico(ligada)).toBe(false)
  })
  it('la marca dice «Por asignar» (sin número) y la frase entera va en el title', () => {
    expect(marcaPorLigar(POR_ASIGNAR)).toEqual({ texto: 'Por asignar', titulo: 'Por asignar: evento nuevo de Google, aún sin paciente' })
    expect(marcaPorLigar(EVENTO)).toBeNull()
  })
})

describe('tarjeta', () => {
  const cita = { ...POR_ASIGNAR, status: 'scheduled' as const, origen: 'google' as const, all_day: false, medico_id: 'm1' }
  it('la tarjeta ofrece «¿No es una cita?», sin «Convertir en cita»', () => {
    expect(accionesDeTarjeta(cita, true)).toEqual(['iniciar-consulta', 'confirmar', 'reagendar', 'editar', 'no-es-cita', 'cancelar'])
    expect(disposicionDeTarjeta(cita, false).secundarias).toContain('no-es-cita')
    expect(esConvertible(cita)).toBe(false)
  })
  it('tras «¿No es una cita?», evento con «Convertir en cita» (para volver atrás) y sin la pregunta', () => {
    const evento = { ...cita, google_asignacion: 'evento' as const }
    expect(accionesDeTarjeta(evento, true)).toEqual(['editar', 'convertir', 'eliminar'])
  })
  it('«Iniciar consulta» con las condiciones de una por ligar; el nombre es el título de Google', () => {
    const quien = { esMedico: true, perfilId: 'm1', consultorioExiste: true }
    expect(puedeIniciarConsulta({ ...cita, pacientes: null }, quien)).toBe(true)
    expect(puedeIniciarConsulta({ ...cita, pacientes: null, google_asignacion: 'evento' }, quien)).toBe(false)
    expect(nombreDeTarjeta({ ...cita, title: 'Revisión de rodilla', pacientes: null, reserva_nombre: null })).toBe('Revisión de rodilla')
  })
})

describe('conteos', () => {
  const a = (h: number) => new Date(2026, 10, 18, h, 0)
  it('cuenta como cita en la cabecera (contarVisibles)', () => {
    const ev = (extendedProps: Record<string, unknown>, h: number) => ({ start: a(h), end: a(h + 1), extendedProps })
    expect(contarVisibles([ev({ ...POR_ASIGNAR, status: 'scheduled' }, 10), ev({ ...EVENTO, status: 'scheduled' }, 11)], null, []))
      .toEqual({ citas: 1, eventos: 1, google: 0 })
  })
  it('entra en el desglose de estados del panel', () => {
    const evento = (h: number, extendedProps: Record<string, unknown>) =>
      ({ start: a(h), end: a(h + 1), allDay: false, extendedProps }) as unknown as EventApi
    expect(desgloseDeEstados([evento(9, { ...POR_ASIGNAR, status: 'confirmed' }), evento(10, { ...EVENTO, status: 'scheduled' })],
      new Date(2026, 10, 18))).toEqual([{ estado: 'confirmed', n: 1 }])
  })
})
