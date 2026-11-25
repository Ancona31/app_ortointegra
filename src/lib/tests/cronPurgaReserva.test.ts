/**
 * cronPurgaReserva.test.ts — AG-DT-274: `GET /api/cron/purga-reserva`.
 *
 * El cliente de servicio es un doble (sólo `.rpc()`). Se prueba la puerta
 * (`CRON_SECRET`, la misma `autorizada()` de las otras tareas), que la
 * respuesta no lleve datos, que repita mientras la base diga que quedan, que
 * pare por el tope de pasadas y que un fallo de la base dé 500 sin cuerpo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

type Respuesta = { data: unknown; error: { code?: string; message: string } | null }

const h = vi.hoisted(() => ({
  llamadas: [] as Array<{ rpc: string; args: Record<string, unknown> }>,
  respuestas: [] as Respuesta[],
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => { throw new Error('la purga no debe usar .from() con el cliente de servicio') },
    rpc: (rpc: string, args: Record<string, unknown>) => ({
      single: async () => {
        h.llamadas.push({ rpc, args })
        return h.respuestas[Math.min(h.llamadas.length - 1, h.respuestas.length - 1)]
      },
    }),
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { GET, dynamic, maxDuration } = await import('@/app/api/cron/purga-reserva/route')

const SECRETO_CRON = 'secretoDePrueba1234567890'
const BUENA = `Bearer ${SECRETO_CRON}`
const pasada = (quedan: boolean, n = 0): Respuesta =>
  ({ data: { r_verificaciones: n, r_limites: n, r_correos: n, r_quedan: quedan }, error: null })
const pedir = (autorizacion?: string): Promise<Response> =>
  GET(new NextRequest('http://localhost/api/cron/purga-reserva', autorizacion === undefined ? {} : { headers: { authorization: autorizacion } }))

beforeEach(() => {
  h.llamadas = []
  h.respuestas = [pasada(false)]
  vi.stubEnv('CRON_SECRET', SECRETO_CRON)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('GET /api/cron/purga-reserva', () => {
  it('sin el secreto, o con uno malo: 401 sin cuerpo y sin tocar la base', async () => {
    for (const mala of [undefined, `Bearer ${SECRETO_CRON}x`, SECRETO_CRON, 'Bearer ']) {
      const r = await pedir(mala)
      expect(r.status).toBe(401)
      expect(await r.text()).toBe('')
    }
    vi.stubEnv('CRON_SECRET', '')
    expect((await pedir(BUENA)).status).toBe(401)
    expect(h.llamadas).toEqual([])
  })

  it('una pasada sin nada pendiente: una llamada, con el lote máximo, y la respuesta no lleva datos', async () => {
    h.respuestas = [pasada(false, 7)]
    const r = await pedir(BUENA)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(h.llamadas).toEqual([{ rpc: 'reserva_purgar', args: { p_lote: 5000 } }])
  })

  it('repite mientras la base diga que quedan, y para cuando dice que no', async () => {
    h.respuestas = [pasada(true, 5000), pasada(true, 5000), pasada(false, 12)]
    expect((await pedir(BUENA)).status).toBe(200)
    expect(h.llamadas).toHaveLength(3)
  })

  it('si siempre quedan, para en el tope de pasadas (no gira sin fin)', async () => {
    h.respuestas = [pasada(true, 5000)]
    expect((await pedir(BUENA)).status).toBe(200)
    expect(h.llamadas).toHaveLength(40)
  })

  it.each<[string, Respuesta]>([
    ['la función no existe (base sin M4)', { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }],
    ['la base falla', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }],
    ['la base contesta otra cosa', { data: { r_verificaciones: 'muchas' }, error: null }],
  ])('500 sin cuerpo cuando %s', async (_caso, respuesta) => {
    h.respuestas = [respuesta]
    const r = await pedir(BUENA)
    expect(r.status).toBe(500)
    expect(await r.text()).toBe('')
    expect(h.llamadas).toHaveLength(1)
  })

  it('no sirve una respuesta en caché, dura menos que su frecuencia y está en vercel.json una vez al día', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(maxDuration).toBeLessThanOrEqual(60)
    const vercel: { crons: Array<{ path: string; schedule: string }> } = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'))
    const tarea = vercel.crons.filter(c => c.path === '/api/cron/purga-reserva')
    expect(tarea).toHaveLength(1)
    expect(tarea[0].schedule).toMatch(/^\d+ \d+ \* \* \*$/)
  })

  it('usa la autorizada() compartida y sólo llama a reserva_purgar', () => {
    const fuente = readFileSync(join(process.cwd(), 'src/app/api/cron/purga-reserva/route.ts'), 'utf8')
    expect(fuente).toContain("from '@/lib/cronAutorizacion'")
    expect(fuente.match(/\.rpc\(/g)).toHaveLength(1)
    expect(fuente).not.toMatch(/\.from\(/)
  })
})
