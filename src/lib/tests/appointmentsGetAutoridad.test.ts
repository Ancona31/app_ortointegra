/* VELOCIDAD (punto 2) · El GET de /api/appointments verifica la sesión en local
   (`getClaims()`) y NO sale a Auth (`getUser()`): de tres saltos en serie
   (getUser → profiles → citas) a dos. Y la otra mitad, que importa más: el
   POST, que escribe y usa cliente de servicio, SIGUE con `getUser()`. Si
   alguien «optimiza» también el POST, esta prueba falla. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const getClaims = vi.fn()
const pasos: string[] = []
let perfil: { id: string; clinica_id: string | null; role: string; es_admin_de_clinica: boolean } | null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => { pasos.push('getUser'); return getUser() },
      getClaims: async () => { pasos.push('getClaims'); return getClaims() },
    },
    from: (tabla: string) => ({
      select: () => ({
        eq: (_col: string, valor: string) => ({
          single: async () => { pasos.push(`${tabla}:${valor}`); return { data: perfil } },
        }),
      }),
    }),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('el GET no usa cliente de servicio') } }))
vi.mock('@/lib/gcal', () => ({ conCalendarioSpinus: vi.fn(), registrarFalloGCal: vi.fn() }))
vi.mock('@/lib/gcalConexion', () => ({ resolverConexionClinica: vi.fn() }))
vi.mock('@/lib/agenda/consultaCitas', () => ({
  consultaCitas: async (_s: unknown, o: { clinicaId: string }) => {
    pasos.push(`citas:${o.clinicaId}`)
    return { ok: true, appointments: [], incompleta: false, bloqueos: [] }
  },
}))

import { GET, POST } from '@/app/api/appointments/route'

const pedir = () => GET(new NextRequest('http://localhost/api/appointments?from=2026-11-23&to=2026-11-30'))

beforeEach(() => {
  pasos.length = 0
  getUser.mockReset().mockResolvedValue({ data: { user: null } })
  getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null })
  perfil = { id: 'u1', clinica_id: 'c1', role: 'medico', es_admin_de_clinica: false }
})

describe('GET /api/appointments · sesión verificada en local', () => {
  it('dos saltos en serie (profiles → citas) y ninguno a Auth', async () => {
    const res = await pedir()
    expect(res.status).toBe(200)
    expect(pasos).toEqual(['getClaims', 'profiles:u1', 'citas:c1'])
    expect(getUser).not.toHaveBeenCalled()
  })

  it('sin sesión válida: 401 y no se lee nada', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    expect((await pedir()).status).toBe(401)
    expect(pasos).toEqual(['getClaims'])
  })

  it('un payload sin `sub` no es la sesión de nadie: 401', async () => {
    getClaims.mockResolvedValue({ data: { claims: {} }, error: null })
    expect((await pedir()).status).toBe(401)
  })

  it('si `getClaims()` lanza, falla cerrado: 401, no 500 ni datos', async () => {
    getClaims.mockRejectedValue(new Error('WebCrypto'))
    expect((await pedir()).status).toBe(401)
    expect(pasos).toEqual(['getClaims'])
  })

  it('sin perfil o sin clínica: 401', async () => {
    perfil = null
    expect((await pedir()).status).toBe(401)
  })
})

describe('POST /api/appointments · la escritura sigue preguntando a Auth', () => {
  it('usa `getUser()` y no `getClaims()`', async () => {
    const res = await POST(new NextRequest('http://localhost/api/appointments', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    expect(pasos).toEqual(['getUser'])
  })
})
