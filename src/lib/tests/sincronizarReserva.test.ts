/**
 * D11 · la sincronización con Google antes de reservar por enlace
 * (`src/lib/reserva/sincronizarReserva.ts`). Todo en dobles: ni base ni
 * Google. Lo que se prueba es la decisión: umbral de 60 s en turnos, sin tope
 * al reservar (y espera del candado), ventana de 30 min, tope de tiempo que
 * aborta la señal, clínicas sin Google y migraciones ausentes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OpcionesSincronizacion, ResultadoSincronizacion } from '@/lib/gcalSincronizacion'
import type { ConexionGoogle } from '@/lib/gcalConexion'

const CLINICA = '33333333-3333-4333-8333-333333333333'
const OTRA = '99999999-9999-4999-8999-999999999999'

const d = vi.hoisted(() => ({
  conexion: null as ConexionGoogle | null | 'lanza',
  /** Lo que devuelve cada pasada, en orden; 'cuelga' = no termina nunca (salvo abortada). */
  pasadas: [] as Array<ResultadoSincronizacion['estado'] | 'cuelga'>,
  opciones: [] as OpcionesSincronizacion[],
  frescura: { ultimaOk: null as string | null, ocupada: false } as { ultimaOk: string | null; ocupada: boolean } | 'ausente' | 'lanza',
  /** La señal de la pasada colgada se abortó. */
  abortada: false,
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/gcalConexion', () => ({
  resolverConexionClinica: async (_s: unknown, clinicaId: string) => {
    if (d.conexion === 'lanza') throw new Error('base caída')
    return d.conexion ? { ...d.conexion, clinicaId: d.conexion.clinicaId || clinicaId } : null
  },
}))
vi.mock('@/lib/gcalSincronizacion', () => ({
  sincronizarClinica: async (_c: ConexionGoogle, op: OpcionesSincronizacion) => {
    d.opciones.push(op)
    const paso = d.pasadas.shift() ?? 'omitida'
    if (paso === 'cuelga') {
      return new Promise<ResultadoSincronizacion>(() => {
        op.senal?.addEventListener('abort', () => { d.abortada = true })
      })
    }
    return { estado: paso, cambios: 0, paginas: 0, errores: 0, restablecer: [] }
  },
}))
vi.mock('@/lib/gcalSincronizacionBase', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/gcalSincronizacionBase')>()
  return {
    SincronizacionNoDisponible: real.SincronizacionNoDisponible,
    frescuraSincronizacion: async () => {
      if (d.frescura === 'ausente') throw new real.SincronizacionNoDisponible('gcal_sync_frescura')
      if (d.frescura === 'lanza') throw new Error('base caída')
      return d.frescura
    },
  }
})

import {
  sincronizarAntesDeReservar, MIN_INTERVALO_TURNOS_SEG, TIEMPO_GOOGLE_MS, VENTANA_TOLERADA_MS,
} from '@/lib/reserva/sincronizarReserva'

const AHORA = Date.parse('2031-06-01T12:00:00Z')
const conexion: ConexionGoogle = {
  id: 'conexion-1', clinicaId: CLINICA, userId: 'dueno', rol: 'clinica', calendarId: 'cal', estado: 'activa', googleAccountEmail: null,
}
/** Reloj fijo; `dormir` no espera de verdad (las pruebas de espera usan su propio reloj). */
const reloj = { ahora: () => AHORA, dormir: async () => undefined }
const hace = (ms: number): string => new Date(AHORA - ms).toISOString()

beforeEach(() => {
  Object.assign(d, { conexion, pasadas: [], opciones: [], frescura: { ultimaOk: null, ocupada: false }, abortada: false })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('clínicas sin Google: sin cambios', () => {
  it('sin conexión: seguir, sin pasada', async () => {
    d.conexion = null
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
    expect(d.opciones).toHaveLength(0)
  })

  it('conexión sin calendario: seguir, sin pasada', async () => {
    d.conexion = { ...conexion, calendarId: null }
    expect(await sincronizarAntesDeReservar(CLINICA, 'turnos', reloj)).toBe('seguir')
    expect(d.opciones).toHaveLength(0)
  })

  it('una conexión que no es de esa clínica no se sincroniza', async () => {
    d.conexion = { ...conexion, clinicaId: OTRA }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
    expect(d.opciones).toHaveLength(0)
  })

  it('migraciones de C ausentes (no_disponible): seguir, como hoy', async () => {
    d.pasadas = ['no_disponible']
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
  })
})

describe('turnos (GET): umbral de 60 s', () => {
  it('pasa a la pasada los 60 s mínimos (los impone gcal_sync_tomar)', async () => {
    d.pasadas = ['ok']
    expect(await sincronizarAntesDeReservar(CLINICA, 'turnos', reloj)).toBe('seguir')
    expect(MIN_INTERVALO_TURNOS_SEG).toBe(60)
    expect(d.opciones[0]).toMatchObject({ minIntervaloSeg: 60, actorId: 'reserva' })
    expect(d.opciones[0].senal).toBeInstanceOf(AbortSignal)
  })

  it('omitida porque la última buena es reciente: seguir, sin reintentar', async () => {
    d.pasadas = ['omitida']
    d.frescura = { ultimaOk: hace(20_000), ocupada: false }
    expect(await sincronizarAntesDeReservar(CLINICA, 'turnos', reloj)).toBe('seguir')
    expect(d.opciones).toHaveLength(1)
  })

  it('omitida con otra pasada en curso: no espera (sólo el POST espera) y aplica la ventana', async () => {
    d.pasadas = ['omitida', 'ok']
    d.frescura = { ultimaOk: hace(VENTANA_TOLERADA_MS + 1), ocupada: true }
    expect(await sincronizarAntesDeReservar(CLINICA, 'turnos', reloj)).toBe('no_por_ahora')
    expect(d.opciones).toHaveLength(1)
  })
})

describe('reservar (POST): siempre, sin el tope de 60 s', () => {
  it('minIntervaloSeg 0', async () => {
    d.pasadas = ['ok']
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
    expect(d.opciones[0]).toMatchObject({ minIntervaloSeg: 0 })
  })

  it('candado ocupado por otra pasada: espera y hace la suya', async () => {
    d.pasadas = ['omitida', 'omitida', 'ok']
    d.frescura = { ultimaOk: hace(VENTANA_TOLERADA_MS * 10), ocupada: true }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
    expect(d.opciones).toHaveLength(3)
  })

  it('omitida sin candado tomado (espera creciente tras fallos): no gira, aplica la ventana', async () => {
    d.pasadas = ['omitida', 'ok']
    d.frescura = { ultimaOk: hace(5 * 60_000), ocupada: false }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
    expect(d.opciones).toHaveLength(1)
  })

  it('la espera del candado no pasa del tope', async () => {
    let t = AHORA
    const lento = { ahora: () => t, dormir: async (ms: number) => { t += ms } }
    d.pasadas = Array.from({ length: 100 }, () => 'omitida' as const)
    d.frescura = { ultimaOk: hace(VENTANA_TOLERADA_MS * 2), ocupada: true }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', lento)).toBe('no_por_ahora')
    expect(t - AHORA).toBeLessThanOrEqual(TIEMPO_GOOGLE_MS)
    expect(d.opciones.length).toBeLessThan(100)
  })
})

describe('Google falla o tarda: ventana de 30 min', () => {
  it.each(['error', 'parcial'] as const)('%s con la última buena de hace 10 min: seguir', async (estado) => {
    d.pasadas = [estado]
    d.frescura = { ultimaOk: hace(10 * 60_000), ocupada: false }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
  })

  it('sin_acceso (S3) con la última buena vieja: seguir (la RPC lo rechaza con su 404 uniforme)', async () => {
    d.pasadas = ['sin_acceso']
    d.frescura = { ultimaOk: hace(VENTANA_TOLERADA_MS * 4), ocupada: false }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
  })

  it('error con la última buena de hace 30 min justos o más: no_por_ahora', async () => {
    d.pasadas = ['error']
    d.frescura = { ultimaOk: hace(VENTANA_TOLERADA_MS), ocupada: false }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('no_por_ahora')
  })

  it('error y nunca hubo una buena: no_por_ahora', async () => {
    d.pasadas = ['error']
    expect(await sincronizarAntesDeReservar(CLINICA, 'turnos', reloj)).toBe('no_por_ahora')
  })

  it('Google colgado: responde al tope y ABORTA la señal', async () => {
    vi.useFakeTimers()
    try {
      d.pasadas = ['cuelga']
      d.frescura = { ultimaOk: hace(60 * 60_000), ocupada: false }
      const v = sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)
      await vi.advanceTimersByTimeAsync(TIEMPO_GOOGLE_MS)
      expect(await v).toBe('no_por_ahora')
      expect(d.abortada).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('el tope elegido es corto (≤ 4 s)', () => {
    expect(TIEMPO_GOOGLE_MS).toBeLessThanOrEqual(4_000)
  })
})

describe('tolerancia y fallos de la base', () => {
  it('sin la migración de D11 (frescura ausente): seguir, como hoy', async () => {
    d.pasadas = ['error']
    d.frescura = 'ausente'
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
  })

  it('no se puede leer la conexión ni la frescura: no_por_ahora (cerrado)', async () => {
    d.conexion = 'lanza'
    d.frescura = 'lanza'
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('no_por_ahora')
  })

  it('no se puede leer la conexión pero la última buena es reciente: seguir', async () => {
    d.conexion = 'lanza'
    d.frescura = { ultimaOk: hace(60_000), ocupada: false }
    expect(await sincronizarAntesDeReservar(CLINICA, 'reservar', reloj)).toBe('seguir')
  })
})
