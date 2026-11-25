/**
 * C6 · `POST /api/google/sync`, el sondeo al abrir la agenda. Fija el orden de
 * las puertas (getUser → rol → interruptor → S3 con la sesión → conexión) y que
 * NADA llegue a `sincronizarClinica` (el cliente de servicio) sin pasarlas, y
 * que la respuesta sólo lleve `{ estado, cambios }`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  usuario: { id: 'u1' } as { id: string } | null,
  perfil: { id: 'u1', clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true } as Record<string, unknown> | null,
  v2: true,
  rpc: { clinica_no_suspendida: { data: true, error: null }, clinica_tiene_acceso: { data: true, error: null } } as Record<string, { data: unknown; error: unknown }>,
  conexion: { id: 'conexion-1', clinicaId: 'clinica-1', userId: 'u1', rol: 'clinica', estado: 'activa', calendarId: 'cal' } as Record<string, unknown> | null,
  orden: [] as string[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => { h.orden.push('getUser'); return { data: { user: h.usuario } } } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.perfil }) }) }) }),
    rpc: async (nombre: string) => { h.orden.push(nombre); return h.rpc[nombre] },
  }),
}))
vi.mock('@/lib/agenda/ajustesAgenda', () => ({ agendaV2Encendida: async () => { h.orden.push('v2'); return h.v2 } }))
vi.mock('@/lib/gcalConexion', () => ({ resolverConexionClinica: async () => { h.orden.push('conexion'); return h.conexion } }))
const sincronizar = vi.hoisted(() => vi.fn(async () => ({ estado: 'ok', cambios: 2, paginas: 1, errores: 0, restablecer: ['x'] })))
vi.mock('@/lib/gcalSincronizacion', () => ({ sincronizarClinica: sincronizar }))

import { POST } from '@/app/api/google/sync/route'

beforeEach(() => {
  h.usuario = { id: 'u1' }
  h.perfil = { id: 'u1', clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true }
  h.v2 = true
  h.rpc = { clinica_no_suspendida: { data: true, error: null }, clinica_tiene_acceso: { data: true, error: null } }
  h.conexion = { id: 'conexion-1', clinicaId: 'clinica-1', userId: 'u1', rol: 'clinica', estado: 'activa', calendarId: 'cal' }
  h.orden = []
  sincronizar.mockClear()
})

async function llamar(): Promise<{ status: number; cuerpo: Record<string, unknown> }> {
  const res = await POST()
  return { status: res.status, cuerpo: await res.json() }
}

describe('POST /api/google/sync', () => {
  it('sin sesión: 401 y nada más', async () => {
    h.usuario = null
    expect((await llamar()).status).toBe(401)
    expect(h.orden).toEqual(['getUser'])
    expect(sincronizar).not.toHaveBeenCalled()
  })

  it('médico invitado: omitida, sin leer el interruptor', async () => {
    h.perfil = { id: 'u1', clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: false }
    expect((await llamar()).cuerpo).toEqual({ estado: 'omitida', cambios: 0 })
    expect(h.orden).toEqual(['getUser'])
    expect(sincronizar).not.toHaveBeenCalled()
  })

  it('secretaria: sí sondea', async () => {
    h.perfil = { id: 'u1', clinica_id: 'clinica-1', role: 'secretaria', es_admin_de_clinica: false }
    expect((await llamar()).cuerpo).toEqual({ estado: 'ok', cambios: 2 })
  })

  it('interruptor apagado: omitida, sin S3 ni conexión', async () => {
    h.v2 = false
    expect((await llamar()).cuerpo).toEqual({ estado: 'omitida', cambios: 0 })
    expect(h.orden).toEqual(['getUser', 'v2'])
    expect(sincronizar).not.toHaveBeenCalled()
  })

  it('S3: clínica sin acceso o suspendida (o error): sin_acceso, nunca llega al cliente de servicio', async () => {
    for (const rpc of [
      { clinica_no_suspendida: { data: true, error: null }, clinica_tiene_acceso: { data: false, error: null } },
      { clinica_no_suspendida: { data: false, error: null }, clinica_tiene_acceso: { data: true, error: null } },
      { clinica_no_suspendida: { data: true, error: null }, clinica_tiene_acceso: { data: null, error: { code: 'PGRST202' } } },
    ]) {
      h.rpc = rpc
      h.orden = []
      expect((await llamar()).cuerpo).toEqual({ estado: 'sin_acceso', cambios: 0 })
      expect(h.orden).not.toContain('conexion')
    }
    expect(sincronizar).not.toHaveBeenCalled()
  })

  it('sin conexión: sin_conexion', async () => {
    h.conexion = null
    expect((await llamar()).cuerpo).toEqual({ estado: 'sin_conexion', cambios: 0 })
    expect(sincronizar).not.toHaveBeenCalled()
  })

  it('ok: el orden de las puertas, 60 s mínimos, y la respuesta sólo con estado y cambios', async () => {
    const { cuerpo } = await llamar()
    expect(cuerpo).toEqual({ estado: 'ok', cambios: 2 })
    expect(h.orden).toEqual(['getUser', 'v2', 'clinica_no_suspendida', 'clinica_tiene_acceso', 'conexion'])
    expect(sincronizar).toHaveBeenCalledWith(h.conexion, expect.objectContaining({ actorId: 'u1', minIntervaloSeg: 60, presupuestoMs: 8000 }))
  })

  it('un fallo inesperado: error, sin detalle', async () => {
    sincronizar.mockRejectedValueOnce(new Error('detalle interno con datos'))
    expect((await llamar()).cuerpo).toEqual({ estado: 'error', cambios: 0 })
  })
})
