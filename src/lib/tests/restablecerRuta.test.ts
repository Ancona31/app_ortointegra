/**
 * restablecerRuta.test.ts — tanda H, punto 10: `POST /api/agenda/restablecer`.
 *
 * `entradaGestion()` (getUser → perfil → interruptor) y el cliente de servicio
 * son dobles. Se prueba que SÓLO el administrador llega a la función (la
 * secretaria y el médico invitado reciben 403 sin ninguna llamada), que hace
 * falta la palabra escrita, que la clínica y el actor salen de la SESIÓN y
 * nunca del cuerpo, y las respuestas de la función.
 * MUTACIÓN (comprobada en rojo): quitar `if (!canManageClinica(e.perfil))` →
 * «la secretaria y el médico invitado: 403» falla.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

type Perfil = { id: string; role: string; es_admin_de_clinica: boolean }
const h = vi.hoisted(() => ({
  entrada: 'ok' as 'ok' | 401 | 403 | 404,
  perfil: { id: 'admin-1', role: 'medico', es_admin_de_clinica: true } as Perfil,
  rpcs: [] as Array<{ nombre: string; args: Record<string, unknown> }>,
  respuesta: { data: [{ r_resultado: 'ok', r_consultorios: 2, r_tipos: 3, r_enlaces: 1 }], error: null } as
    { data: unknown; error: { code?: string; message?: string } | null },
}))

vi.mock('@/lib/reserva/gestionServidor', () => ({
  entradaGestion: async () => (h.entrada === 'ok'
    ? { ok: true, clinicaId: 'clinica-1', perfil: h.perfil, supabase: {} }
    : { ok: false, respuesta: NextResponse.json({ error: 'x' }, { status: h.entrada }) }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (nombre: string, args: Record<string, unknown>) => { h.rpcs.push({ nombre, args }); return h.respuesta },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

const { POST } = await import('@/app/api/agenda/restablecer/route')

const pedir = (cuerpo: unknown) => new NextRequest('http://localhost/api/agenda/restablecer', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
})
const BUENO = { confirmacion: 'RESTABLECER' }

beforeEach(() => {
  h.entrada = 'ok'
  h.perfil = { id: 'admin-1', role: 'medico', es_admin_de_clinica: true }
  h.rpcs = []
  h.respuesta = { data: [{ r_resultado: 'ok', r_consultorios: 2, r_tipos: 3, r_enlaces: 1 }], error: null }
})

describe('POST /api/agenda/restablecer — quién', () => {
  it('el administrador: llama a la función con la clínica y el actor DE LA SESIÓN', async () => {
    const res = await POST(pedir(BUENO))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, consultorios: 2, tipos: 3, enlaces: 1 })
    expect(h.rpcs).toEqual([{ nombre: 'agenda_restablecer_configuracion', args: { p_clinica_id: 'clinica-1', p_actor: 'admin-1' } }])
  })

  it.each<[string, Perfil]>([
    ['la secretaria', { id: 'sec-1', role: 'secretaria', es_admin_de_clinica: false }],
    ['el médico invitado', { id: 'inv-1', role: 'medico', es_admin_de_clinica: false }],
  ])('%s: 403 y ninguna llamada a la base', async (_q, perfil) => {
    h.perfil = perfil
    const res = await POST(pedir(BUENO))
    expect(res.status).toBe(403)
    expect(h.rpcs).toEqual([])
  })

  it.each([401, 403, 404] as const)('sin sesión, sin clínica o con la v2 apagada (%s): no llama a nada', async (codigo) => {
    h.entrada = codigo
    expect((await POST(pedir(BUENO))).status).toBe(codigo)
    expect(h.rpcs).toEqual([])
  })
})

describe('POST /api/agenda/restablecer — la confirmación fuerte', () => {
  it.each([
    ['sin cuerpo', null], ['otra palabra', { confirmacion: 'restablecer' }], ['vacía', { confirmacion: '' }],
    ['con otra clínica en el cuerpo', { confirmacion: 'RESTABLECER', clinica_id: 'otra' }],
    ['con otro actor en el cuerpo', { confirmacion: 'RESTABLECER', p_actor: 'otro' }],
  ])('%s: 400 y nada', async (_c, cuerpo) => {
    expect((await POST(pedir(cuerpo))).status).toBe(400)
    expect(h.rpcs).toEqual([])
  })
})

describe('POST /api/agenda/restablecer — lo que dice la función', () => {
  it('sin la migración (PGRST202): 503 no_disponible', async () => {
    h.respuesta = { data: null, error: { code: 'PGRST202', message: 'no existe' } }
    const res = await POST(pedir(BUENO))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'no_disponible' })
  })
  it('otro error: 500 sin el mensaje de Postgres', async () => {
    h.respuesta = { data: null, error: { code: '23503', message: 'detalle interno' } }
    const res = await POST(pedir(BUENO))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('detalle interno')
  })
  it.each([['sin_permiso', 403], ['apagado', 404]] as const)('%s → %s', async (resultado, codigo) => {
    h.respuesta = { data: [{ r_resultado: resultado, r_consultorios: 0, r_tipos: 0, r_enlaces: 0 }], error: null }
    expect((await POST(pedir(BUENO))).status).toBe(codigo)
  })
  it('una forma inesperada: 500', async () => {
    h.respuesta = { data: [{ r_resultado: 'raro' }], error: null }
    expect((await POST(pedir(BUENO))).status).toBe(500)
  })
})
