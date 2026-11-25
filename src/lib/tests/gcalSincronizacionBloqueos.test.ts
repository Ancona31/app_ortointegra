import { beforeEach, describe, expect, it, vi } from 'vitest'

// Lecturas de `agenda_bloqueos` que hace la sincronización con los borrados de una página.
const lecturas: { clinica: unknown; ids: string[] }[] = []
const llamadas: Record<string, unknown>[] = []
const fallos: Error[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, clinica: unknown) => ({
          in: async (_col: string, ids: string[]) => {
            lecturas.push({ clinica, ids })
            return { data: ids.filter((id) => id.endsWith('-b')).map((id) => ({ google_event_id: id })), error: null }
          },
        }),
      }),
    }),
  }),
}))
vi.mock('@/lib/gcalSincronizacionBase', () => ({
  SincronizacionNoDisponible: class extends Error {},
  llamarBloqueo: async (_clinica: string, args: Record<string, unknown>) => {
    llamadas.push(args)
    const fallo = fallos.shift()
    if (fallo) throw fallo
    return 1
  },
  /* AG-DT-264 (C): pasajero = el error lo dice (aquí, una marca del doble). */
  esFalloPasajeroDeLaBase: (err: unknown) => err instanceof Error && err.message === 'pasajero',
}))

import { aplicarBloqueosDePagina } from '@/lib/gcalSincronizacionBloqueos'

describe('aplicarBloqueosDePagina · borrados de Google', () => {
  beforeEach(() => { lecturas.length = 0; llamadas.length = 0; fallos.length = 0 })

  it('lee en tandas de 50, acotadas a la clínica, y sólo aplica los borrados que son de un bloqueo', async () => {
    // 120 borrados: uno de cada diez es de un bloqueo (id terminado en «-b»).
    const borrados = Array.from({ length: 120 }, (_, i) => ({ id: `ev${i}${i % 10 === 0 ? '-b' : ''}`, status: 'cancelled' }))
    const errores = await aplicarBloqueosDePagina('clinica-1', 'cal-1', [], borrados)
    expect(errores).toEqual({ errores: 0, pasajeros: 0 })
    expect(lecturas.map((l) => l.ids.length)).toEqual([50, 50, 20])
    expect(lecturas.every((l) => l.clinica === 'clinica-1')).toBe(true)
    expect(llamadas).toHaveLength(12)
    expect(llamadas.every((a) => a.p_borrar === true)).toBe(true)
  })

  it('AG-DT-264 (C): cuenta aparte los fallos PASAJEROS de la base (con alguno, la página no avanza) y sigue con los demás', async () => {
    fallos.push(new Error('pasajero'), new Error('definitivo'))
    const borrados = ['ev0-b', 'ev1-b', 'ev2-b'].map(id => ({ id, status: 'cancelled' }))
    expect(await aplicarBloqueosDePagina('clinica-1', 'cal-1', [], borrados)).toEqual({ errores: 2, pasajeros: 1 })
    expect(llamadas).toHaveLength(3)
  })
})
