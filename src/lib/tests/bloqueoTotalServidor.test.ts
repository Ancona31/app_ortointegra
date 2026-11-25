/**
 * bloqueoTotalServidor.test.ts — Tanda L (L1, punto 6) · el veto del bloqueo
 * TOTAL en las rutas: qué consulta, cuándo mira el PUT, cómo reconoce el 42501
 * del disparador y que sin la tabla no rompe. Cada caso se vio en rojo con la
 * mutación que nombra (notas_l1.md).
 */
import { describe, it, expect, vi } from 'vitest'
import type { createClient } from '@/lib/supabase/server'
import {
  bloqueoDelPut, caeEnBloqueo, CUERPO_HORARIO_BLOQUEADO, esErrorDeBloqueo, HINT_HORARIO_BLOQUEADO,
} from '@/lib/agenda/bloqueoTotalServidor'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>
type Respuesta = { count: number | null; error: { code?: string } | null }

/** Un cliente de mentira que apunta los filtros y responde `r`. */
function cliente(r: Respuesta): { c: ClienteSesion; filtros: string[]; tabla: () => string | null } {
  const filtros: string[] = []
  let tabla: string | null = null
  const q = {
    select: () => q,
    eq: (k: string, v: string) => { filtros.push(`${k}=${v}`); return q },
    lt: (k: string, v: string) => { filtros.push(`${k}<${v}`); return q },
    gt: (k: string, v: string) => { filtros.push(`${k}>${v}`); return q },
    then: (ok: (x: Respuesta) => unknown) => Promise.resolve(r).then(ok),
  }
  const c = { from: (t: string) => { tabla = t; return q } }
  // El cliente real tiene cientos de miembros; la prueba sólo usa `from` encadenado.
  return { c: c as unknown as ClienteSesion, filtros, tabla: () => tabla }
}

const P = { clinicaId: 'cl', medicoId: 'm1', inicio: '2026-12-10T16:00:00.000Z', fin: '2026-12-10T17:00:00.000Z' }

describe('caeEnBloqueo', () => {
  it('pregunta por la clínica, el médico y el solape semiabierto (MUTACIÓN: sin el eq de clínica)', async () => {
    const f = cliente({ count: 1, error: null })
    expect(await caeEnBloqueo(f.c, P)).toBe(true)
    expect(f.tabla()).toBe('agenda_bloqueos')
    expect(f.filtros).toEqual(['clinica_id=cl', 'medico_id=m1', `inicio<${P.fin}`, `fin>${P.inicio}`])
  })
  it('sin bloqueos, o sin médico, no veta (MUTACIÓN: `>= 0`)', async () => {
    expect(await caeEnBloqueo(cliente({ count: 0, error: null }).c, P)).toBe(false)
    const f = cliente({ count: 1, error: null })
    expect(await caeEnBloqueo(f.c, { ...P, medicoId: null })).toBe(false)
    expect(f.tabla()).toBeNull()
  })
  it('sin la tabla (base sin K1) o con error, sigue: decide la base (MUTACIÓN: lanzar)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(await caeEnBloqueo(cliente({ count: null, error: { code: 'PGRST205' } }).c, P)).toBe(false)
    expect(await caeEnBloqueo(cliente({ count: null, error: { code: '42P01' } }).c, P)).toBe(false)
    expect(aviso).not.toHaveBeenCalled()
    expect(await caeEnBloqueo(cliente({ count: null, error: { code: '57014' } }).c, P)).toBe(false)
    expect(aviso).toHaveBeenCalledTimes(1)
    aviso.mockRestore()
  })
})

describe('bloqueoDelPut', () => {
  const antes = { medico_id: 'm1', start_time: '2026-12-10T15:30:00Z', end_time: '2026-12-10T16:30:00Z' }
  it('lo que ya estaba dentro y no se mueve, pasa sin consultar (MUTACIÓN: sin `mueve`)', async () => {
    const f = cliente({ count: 1, error: null })
    expect(await bloqueoDelPut(f.c, 'cl', antes, { status: 'confirmed', notes: 'x' })).toBe(false)
    // las mismas puntas con otra escritura (milisegundos) tampoco es moverse
    expect(await bloqueoDelPut(f.c, 'cl', antes, { start_time: '2026-12-10T15:30:00.000Z', end_time: '2026-12-10T16:30:00.000+00:00' })).toBe(false)
    expect(f.tabla()).toBeNull()
  })
  it('mover el inicio, el fin o el médico consulta con lo que QUEDA (MUTACIÓN: medir con `antes`)', async () => {
    const f = cliente({ count: 1, error: null })
    expect(await bloqueoDelPut(f.c, 'cl', antes, { start_time: '2026-12-10T16:00:00Z', end_time: '2026-12-10T17:00:00Z' })).toBe(true)
    expect(f.filtros).toEqual(['clinica_id=cl', 'medico_id=m1', 'inicio<2026-12-10T17:00:00Z', 'fin>2026-12-10T16:00:00Z'])
    const g = cliente({ count: 1, error: null })
    expect(await bloqueoDelPut(g.c, 'cl', antes, { medico_id: 'm2' })).toBe(true)
    expect(g.filtros).toContain('medico_id=m2')
    const h = cliente({ count: 1, error: null })
    expect(await bloqueoDelPut(h.c, 'cl', antes, { end_time: '2026-12-10T17:00:00Z' })).toBe(true)
  })
})

describe('esErrorDeBloqueo y el 409', () => {
  it('sólo el 42501 con NUESTRO hint (MUTACIÓN: mirar sólo el código; otro 42501 es la RLS)', () => {
    expect(esErrorDeBloqueo({ code: '42501', hint: HINT_HORARIO_BLOQUEADO })).toBe(true)
    expect(esErrorDeBloqueo({ code: '42501', hint: null })).toBe(false)
    expect(esErrorDeBloqueo({ code: '42501', hint: 'agenda_atendida_con_nota' })).toBe(false)
    expect(esErrorDeBloqueo({ code: '23514', hint: HINT_HORARIO_BLOQUEADO })).toBe(false)
    expect(esErrorDeBloqueo(null)).toBe(false)
  })
  it('el hint es el de la migración y el mensaje, el de Angel', () => {
    expect(HINT_HORARIO_BLOQUEADO).toBe('agenda_horario_bloqueado')
    expect(CUERPO_HORARIO_BLOQUEADO).toEqual({ error: 'horario_bloqueado', message: 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.' })
  })
})
