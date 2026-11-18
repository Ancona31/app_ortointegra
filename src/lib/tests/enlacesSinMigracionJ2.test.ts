/**
 * Integración de la tanda J (tolerancia): `/api/agenda/enlaces` con el código
 * de J2 y la base SIN su migración (`20261122120000`: `reserva_enlaces.agotado_en`
 * y `reserva_enlace_emitir` de 9 argumentos). Con la v2 encendida, la lista
 * daba 500 (42703 por la columna) y emitir también (PGRST202 por la firma), así
 * que la pantalla «Tu enlace» se quedaba en «No se pudieron leer los enlaces».
 *
 *   · sin la columna, la lista se lee con el filtro de antes;
 *   · sin la firma de 9 y SIN correo, se emite con la de 7 (la misma emisión);
 *   · sin la firma de 9 y CON correo, no se emite (un único cuyo correo no se
 *     guardara no mandaría el comprobante a nadie);
 *   · con la migración, una sola consulta y una sola llamada, como J2.
 *
 * MUTACIONES: quitar el reintento del 42703 en `GET` → rojo «la lista…»;
 * quitar el reintento del PGRST202 en `emitirEnBase` → rojo «emitir sin correo…».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  conJ2: false,
  filtros: [] as string[],
  llamadas: [] as Record<string, unknown>[],
}))

/* La lista con la sesión: sin la migración, un filtro con `agotado_en` es 42703. */
class Consulta implements PromiseLike<unknown> {
  private filtro = ''
  select(): this { return this }
  eq(): this { return this }
  is(): this { return this }
  order(): this { return this }
  limit(): this { return this }
  /* K3 (punto 14): la consulta aparte de los fijos pausados (`.not('pausado_en', 'is', null)`); no lleva `or`. */
  not(): this { return this }
  or(f: string): this { this.filtro = f; return this }
  maybeSingle(): Promise<unknown> { return Promise.resolve({ data: { id: 'e1', clase: 'unico' }, error: null }) }
  then<A = unknown, B = never>(ok?: ((v: unknown) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    if (this.filtro) h.filtros.push(this.filtro)
    const r = !h.conJ2 && this.filtro.includes('agotado_en')
      ? { data: null, error: { code: '42703' } }
      : { data: [], error: null }
    return Promise.resolve(r).then(ok, ko)
  }
}

vi.mock('@/lib/reserva/gestionServidor', () => ({
  entradaGestion: async () => ({
    ok: true, supabase: { from: () => new Consulta() }, clinicaId: 'c1',
    perfil: { id: '11111111-1111-4111-8111-111111111111', role: 'medico', es_admin_de_clinica: true },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (_f: string, args: Record<string, unknown>) => {
      h.llamadas.push(args)
      return !h.conJ2 && 'p_correo' in args ? { error: { code: 'PGRST202' } } : { error: null }
    },
  }),
}))
vi.mock('@/lib/reserva/secretos', () => ({
  secretoDisponible: () => true, codigoDeEnlace: () => 'codigo-de-prueba', hashDeCodigo: () => 'h'.repeat(64),
  hmacContacto: () => 'a'.repeat(64),
}))
vi.mock('@/lib/reserva/avisoReserva', () => ({ avisoPublicable: () => true }))
vi.mock('@/lib/reserva/preparacionServidor', () => ({ preparacionDe: async () => null }))

const { GET, POST } = await import('@/app/api/agenda/enlaces/route')

const MEDICO = '11111111-1111-4111-8111-111111111111'
const alta = (cuerpo: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/agenda/enlaces', { method: 'POST', body: JSON.stringify(cuerpo) }))

beforeEach(() => { h.filtros = []; h.llamadas = [] })

describe('/api/agenda/enlaces sin la migración de J2 (integración J)', () => {
  it('la lista se lee con el filtro de antes', async () => {
    h.conJ2 = false
    const r = await GET()
    expect(r.status).toBe(200)
    expect(h.filtros).toHaveLength(2)
    expect(h.filtros[1]).not.toContain('agotado_en')
  })

  it('emitir sin correo cae en la firma de 7 argumentos', async () => {
    h.conJ2 = false
    const r = await alta({ clase: 'unico', medico_id: MEDICO })
    expect(r.status).toBe(201)
    expect(h.llamadas).toHaveLength(2)
    expect(h.llamadas[1]).not.toHaveProperty('p_correo')
  })

  it('emitir CON correo no cae en la de 7: no se emite un único que perdería su correo', async () => {
    h.conJ2 = false
    const r = await alta({ clase: 'unico', medico_id: MEDICO, correo: 'beto@prueba.test' })
    expect(r.status).toBe(500)
    expect(h.llamadas).toHaveLength(1)
  })
})

describe('/api/agenda/enlaces con la migración de J2', () => {
  it('una consulta con «agotado» y una llamada con el correo', async () => {
    h.conJ2 = true
    expect((await GET()).status).toBe(200)
    expect(h.filtros).toEqual([expect.stringContaining('agotado_en.is.null')])
    expect((await alta({ clase: 'unico', medico_id: MEDICO, correo: 'beto@prueba.test' })).status).toBe(201)
    expect(h.llamadas).toEqual([expect.objectContaining({ p_correo: 'beto@prueba.test', p_correo_hmac: 'a'.repeat(64) })])
  })
})
