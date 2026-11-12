/**
 * La tarea programada de Google (bloque C, paso C7): `GET /api/cron/google-sync`.
 *
 * Todo simulado: el listado de conexiones y `sincronizarClinica` son dobles,
 * así que no se toca ninguna base ni ningún Google. Lo que se prueba es la
 * puerta (S2: `CRON_SECRET` en tiempo constante, 401 en cualquier otro caso),
 * que la respuesta no lleve datos, y el recorrido: una pasada por clínica,
 * con el presupuesto y los parámetros del candado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import type { ConexionGoogle } from '@/lib/gcalConexion'
import type { OpcionesSincronizacion, ResultadoSincronizacion } from '@/lib/gcalSincronizacion'

const crypto = vi.hoisted(() => ({ llamadas: [] as Array<[Buffer, Buffer]> }))

vi.mock('node:crypto', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:crypto')>()
  const timingSafeEqual = (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView): boolean => {
    crypto.llamadas.push([Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)])
    return real.timingSafeEqual(a, b)
  }
  return { ...real, default: { ...real, timingSafeEqual }, timingSafeEqual }
})

const dobles = vi.hoisted(() => ({
  conexiones: [] as ConexionGoogle[],
  listarFalla: false,
  pasadas: [] as Array<{ clinicaId: string; op: OpcionesSincronizacion }>,
  duracionMs: 0,
  reloj: { t: 1_000_000 },
}))

vi.mock('@/lib/gcalConexion', () => ({
  listarConexionesParaSincronizar: vi.fn(async (limite: number) => {
    if (dobles.listarFalla) throw new Error('listarConexionesParaSincronizar: relación secreta 42P01')
    return dobles.conexiones.slice(0, limite)
  }),
}))

vi.mock('@/lib/gcalSincronizacion', () => ({
  sincronizarClinica: vi.fn(async (conexion: ConexionGoogle, op: OpcionesSincronizacion): Promise<ResultadoSincronizacion> => {
    dobles.pasadas.push({ clinicaId: conexion.clinicaId, op })
    dobles.reloj.t += dobles.duracionMs
    return { estado: 'ok', cambios: 7, paginas: 2, errores: 1, restablecer: ['cita-secreta'] }
  }),
}))

const { GET, dynamic, maxDuration } = await import('@/app/api/cron/google-sync/route')

const SECRETO = 'secretoDePrueba1234567890'

function conexion(n: number): ConexionGoogle {
  const id = String(n).padStart(12, '0')
  return {
    id: `11111111-1111-4111-8111-${id}`, clinicaId: `22222222-2222-4222-8222-${id}`,
    userId: `33333333-3333-4333-8333-${id}`, rol: 'clinica', calendarId: `cal-${n}@group.calendar.google.com`,
    estado: 'activa', googleAccountEmail: `medico${n}@ejemplo.test`,
  }
}

function peticion(authorization?: string): NextRequest {
  const headers = new Headers()
  if (authorization !== undefined) headers.set('authorization', authorization)
  return new NextRequest('http://localhost/api/cron/google-sync', { headers })
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRETO)
  dobles.conexiones = [conexion(1), conexion(2), conexion(3)]
  dobles.listarFalla = false
  dobles.pasadas = []
  dobles.duracionMs = 0
  dobles.reloj.t = 1_000_000
  crypto.llamadas = []
  vi.spyOn(Date, 'now').mockImplementation(() => dobles.reloj.t)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/cron/google-sync — la puerta (S2)', () => {
  it('declara force-dynamic y un maxDuration por encima del presupuesto', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(maxDuration).toBe(60)
  })

  it('401 sin cabecera Authorization', async () => {
    const res = await GET(peticion())
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('')
    expect(dobles.pasadas).toEqual([])
  })

  it('401 con el secreto equivocado, con otro esquema o sin el prefijo', async () => {
    for (const mala of [`Bearer ${SECRETO}x`, `Bearer ${SECRETO.slice(0, -1)}`, `Basic ${SECRETO}`, SECRETO, `bearer ${SECRETO}`, 'Bearer ', '']) {
      const res = await GET(peticion(mala))
      expect(res.status, mala).toBe(401)
    }
    expect(dobles.pasadas).toEqual([])
  })

  it('401 si CRON_SECRET no está configurado o está vacío, aunque la cabecera diga «Bearer »', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(peticion('Bearer '))).status).toBe(401)
    expect((await GET(peticion('Bearer undefined'))).status).toBe(401)
    vi.stubEnv('CRON_SECRET', undefined)
    expect((await GET(peticion('Bearer '))).status).toBe(401)
    expect((await GET(peticion('Bearer undefined'))).status).toBe(401)
    expect(dobles.pasadas).toEqual([])
  })

  it('compara con timingSafeEqual sobre buffers de la misma longitud, y una longitud distinta no lanza', async () => {
    const corta = await GET(peticion('Bearer x'))
    const larga = await GET(peticion(`Bearer ${SECRETO.repeat(50)}`))
    expect(corta.status).toBe(401)
    expect(larga.status).toBe(401)
    expect(crypto.llamadas).toHaveLength(2)
    for (const [a, b] of crypto.llamadas) {
      expect(a.length).toBe(32)
      expect(b.length).toBe(32)
    }
    const buena = await GET(peticion(`Bearer ${SECRETO}`))
    expect(buena.status).toBe(200)
    expect(crypto.llamadas).toHaveLength(3)
  })
})

describe('GET /api/cron/google-sync — el recorrido', () => {
  it('con el secreto correcto llama a sincronizarClinica una vez por cada clínica listada', async () => {
    const res = await GET(peticion(`Bearer ${SECRETO}`))
    expect(res.status).toBe(200)
    expect(dobles.pasadas.map((p) => p.clinicaId)).toEqual(dobles.conexiones.map((c) => c.clinicaId))
    for (const { op } of dobles.pasadas) {
      expect(op).toMatchObject({ actorId: 'cron', leaseSeg: 90, minIntervaloSeg: 60 })
      expect(op.presupuestoMs).toBeLessThanOrEqual(15_000)
      expect(op.presupuestoMs).toBeGreaterThan(0)
    }
  })

  it('la respuesta no contiene datos: ni conteos, ni ids, ni correos, ni errores', async () => {
    const res = await GET(peticion(`Bearer ${SECRETO}`))
    const texto = await res.text()
    expect(JSON.parse(texto)).toEqual({ ok: true })
    for (const c of dobles.conexiones) {
      for (const dato of [c.id, c.clinicaId, c.userId, c.calendarId ?? '', c.googleAccountEmail ?? '']) {
        expect(texto).not.toContain(dato)
      }
    }
    expect(texto).not.toContain('cita-secreta')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('si el listado falla: 500 sin cuerpo, sin el mensaje de Postgres', async () => {
    dobles.listarFalla = true
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(peticion(`Bearer ${SECRETO}`))
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('')
    expect(JSON.stringify(error.mock.calls)).not.toContain('42P01')
  })

  it('sin clínicas pendientes responde igual, { ok: true }', async () => {
    dobles.conexiones = []
    const res = await GET(peticion(`Bearer ${SECRETO}`))
    expect(await res.json()).toEqual({ ok: true })
    expect(dobles.pasadas).toEqual([])
  })

  it('respeta el presupuesto total: deja de empezar clínicas antes de pasarse', async () => {
    dobles.conexiones = Array.from({ length: 10 }, (_, i) => conexion(i + 1))
    dobles.duracionMs = 12_000
    await GET(peticion(`Bearer ${SECRETO}`))
    // 0, 12, 24 y 36 s empiezan (quedan ≥ 5 s de 45); a los 48 s ya no.
    expect(dobles.pasadas).toHaveLength(4)
    expect(dobles.pasadas.map((p) => p.op.presupuestoMs)).toEqual([15_000, 15_000, 15_000, 9_000])
  })

  it('la ruta no consulta la base por sí misma ni crea clientes de servicio', () => {
    const fuente = readFileSync(join(process.cwd(), 'src/app/api/cron/google-sync/route.ts'), 'utf8')
    expect(fuente).not.toMatch(/\.\s*from\s*\(/)
    expect(fuente).not.toMatch(/\.\s*rpc\s*\(/)
    expect(fuente).not.toMatch(/createAdminClient|createClient/)
  })
})
