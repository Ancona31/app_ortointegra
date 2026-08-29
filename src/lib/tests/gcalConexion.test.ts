/**
 * El módulo dueño de la conexión de Google — lo que no se puede romper en
 * silencio.
 *
 * Este archivo fija las propiedades que, si se caen, NO producen un error
 * visible: producen una clínica que deja de sincronizar, o dos fuentes que
 * divergen y bloquean el corte del archivo B semanas después. Ninguna de ellas
 * se nota probando la aplicación a mano.
 *
 *   · Los tres filtros de la resolución. Sin `rol` la garantía de «cero o una
 *     fila» se cae; sin `estado` una conexión revocada se lee como buena.
 *   · Los cinco errores con nombre del alta. Cada uno tiene una salida distinta
 *     de cara al médico y tragarse uno deja la clínica muda.
 *   · El comparar-y-cambiar, que prende o no prende, y su espejo, que también
 *     es un CAS (H10).
 *   · El orden de la doble escritura y su única excepción, la del refresco (H9).
 *
 * NOTA PARA EL COMMIT 6 (el cerrojo de §2.2 del plan): este archivo nombra
 * `clinica_conexiones_google` y `google_tokens` a propósito —comprobar a qué
 * tabla fue cada escritura es justo lo que se está probando—, así que la prueba
 * que prohíbe esos literales fuera del módulo tiene que eximir a sus propios
 * tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

/* Cifrado determinista: así se puede afirmar que el MISMO string llegó a las
   dos fuentes (plan §2.3). Con el `encrypt` real, el IV aleatorio daría dos
   ciphertexts distintos y la propiedad sería inobservable. */
vi.mock('@/lib/encrypt', () => ({
  encrypt: (claro: string) => `cifrado(${claro})`,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

let clienteAdmin: ClienteFalso
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => clienteAdmin,
}))

import { logger } from '@/lib/logger'
import {
  resolverConexionClinica,
  altaConexion,
  guardarSecretos,
  guardarCalendarIdSiEsperado,
  borrarConexion,
  leerConexionConSecretos,
  ERRORES_ALTA,
  type ConexionGoogle,
} from '@/lib/gcalConexion'

/* ── El doble de Supabase ───────────────────────────────── */

const NUEVA   = 'clinica_conexiones_google'
const ESPEJO  = 'google_tokens'

type Respuesta = { data: unknown; error: { message: string } | null }

interface Escritura {
  tabla:    string
  verbo:    'select' | 'update' | 'upsert' | 'delete'
  valores?: Record<string, unknown>
  filtros:  Record<string, unknown>
}

interface Rpc {
  nombre: string
  args:   Record<string, unknown>
}

interface ClienteFalso {
  escrituras: Escritura[]
  rpcs:       Rpc[]
  orden:      string[]
  rpc(nombre: string, args: Record<string, unknown>): Promise<Respuesta>
  from(tabla: string): unknown
}

/**
 * Devuelve las `respuestas` en el orden en que se consuman. Cada operación
 * awaited consume una; lo que no se configure sale como `{ data: null, error:
 * null }`, que es «cero filas» y no un fallo.
 */
function clienteFalso(respuestas: Respuesta[] = []): ClienteFalso {
  const escrituras: Escritura[] = []
  const rpcs: Rpc[] = []
  const orden: string[] = []
  let i = 0
  const siguiente = (): Respuesta => respuestas[i++] ?? { data: null, error: null }

  function anotar(tabla: string, verbo: Escritura['verbo'], valores?: Record<string, unknown>): Escritura {
    const reg: Escritura = { tabla, verbo, valores, filtros: {} }
    escrituras.push(reg)
    orden.push(`${verbo}:${tabla}`)
    return reg
  }

  function encadenable(reg: Escritura) {
    const api = {
      select: () => api,
      eq: (col: string, val: unknown) => { reg.filtros[col] = val; return api },
      is: (col: string, val: unknown) => { reg.filtros[col] = val; return api },
      maybeSingle: () => Promise.resolve(siguiente()),
      then: (ok: (r: Respuesta) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve(siguiente()).then(ok, mal),
    }
    return api
  }

  return {
    escrituras,
    rpcs,
    orden,
    rpc(nombre, args) {
      rpcs.push({ nombre, args })
      orden.push(`rpc:${nombre}`)
      return Promise.resolve(siguiente())
    },
    from(tabla: string) {
      return {
        select: () => encadenable(anotar(tabla, 'select')),
        update: (v: Record<string, unknown>) => encadenable(anotar(tabla, 'update', v)),
        upsert: (v: Record<string, unknown>) => encadenable(anotar(tabla, 'upsert', v)),
        delete: () => encadenable(anotar(tabla, 'delete')),
      }
    },
  }
}

/* Un doble de prueba no puede implementar la superficie entera de
   `SupabaseClient`, y tipar los ~40 métodos que no se usan no probaría nada.
   La conversión está confinada a esta línea y no sale de los tests. */
const comoSesion = (falso: ClienteFalso): SupabaseClient =>
  falso as unknown as SupabaseClient

const CONEXION: ConexionGoogle = {
  id:         'cx-1',
  clinicaId:  'cl-1',
  userId:     'us-1',
  rol:        'clinica',
  calendarId: 'cal-viejo',
  estado:     'activa',
  googleAccountEmail: 'consultorio@gmail.test',
}

const FILA_CONEXION = {
  id: 'cx-1', clinica_id: 'cl-1', user_id: 'us-1',
  rol: 'clinica', calendar_id: 'cal-viejo', estado: 'activa',
  google_account_email: 'consultorio@gmail.test',
}

const errorEspejo = () =>
  vi.mocked(logger.error).mock.calls.map(([, msg]) => msg).join(' | ')

beforeEach(() => {
  vi.clearAllMocks()
  clienteAdmin = clienteFalso()
})

/* ── Resolución ─────────────────────────────────────────── */

describe('resolverConexionClinica', () => {
  it('filtra por clinica_id, por rol de clínica y por estado activa', async () => {
    const sesion = clienteFalso([{ data: FILA_CONEXION, error: null }])
    await resolverConexionClinica(comoSesion(sesion), 'cl-1')

    expect(sesion.escrituras[0].tabla).toBe(NUEVA)
    expect(sesion.escrituras[0].filtros).toEqual({
      clinica_id: 'cl-1',
      rol:        'clinica',
      estado:     'activa',
    })
  })

  it('mapea la fila al descriptor, sin secretos', async () => {
    const sesion = clienteFalso([{ data: FILA_CONEXION, error: null }])
    expect(await resolverConexionClinica(comoSesion(sesion), 'cl-1')).toEqual(CONEXION)
  })

  /* El correo puede faltar y eso NO es un defecto: las conexiones anteriores a
     los scopes `openid`/`email` lo tienen vacío hasta que su dueño reconecte
     (plan §12.17). El descriptor tiene que dejarlo pasar como null en vez de
     tropezar, porque quien lo pinta decide por él. */
  it('deja pasar el correo en null — identidad desconocida, no conexión rota', async () => {
    const sesion = clienteFalso([
      { data: { ...FILA_CONEXION, google_account_email: null }, error: null },
    ])
    expect(await resolverConexionClinica(comoSesion(sesion), 'cl-1'))
      .toEqual({ ...CONEXION, googleAccountEmail: null })
  })

  it('devuelve null cuando la clínica no tiene conexión', async () => {
    const sesion = clienteFalso([{ data: null, error: null }])
    expect(await resolverConexionClinica(comoSesion(sesion), 'cl-1')).toBeNull()
  })

  it('LANZA si la consulta falla, en vez de confundirlo con «no hay conexión»', async () => {
    const sesion = clienteFalso([{ data: null, error: { message: 'timeout' } }])
    await expect(resolverConexionClinica(comoSesion(sesion), 'cl-1')).rejects.toThrow('timeout')
  })
})

/* ── Alta ───────────────────────────────────────────────── */

describe('altaConexion', () => {
  const ARGS = {
    userId: 'us-1', clinicaId: 'cl-1', rol: 'clinica' as const,
    cuenta: { sub: null, email: null },
    tokens: { accessToken: 'ACC', refreshToken: 'REF', expiresAt: 111 },
  }

  it.each(ERRORES_ALTA)('devuelve %s como respuesta, no como excepción', async (nombre) => {
    clienteAdmin = clienteFalso([{ data: null, error: { message: nombre } }])
    const res = await altaConexion(ARGS)

    expect(res).toEqual({ ok: false, error: nombre })
    // Nada se escribió en la fuente nueva: el espejo no se toca.
    expect(clienteAdmin.escrituras).toHaveLength(0)
  })

  it('propaga los fallos que no son errores con nombre', async () => {
    clienteAdmin = clienteFalso([{ data: null, error: { message: 'permission denied' } }])
    await expect(altaConexion(ARGS)).rejects.toThrow('permission denied')
  })

  it('cifra una sola vez y escribe los MISMOS bytes en las dos fuentes', async () => {
    clienteAdmin = clienteFalso([
      { data: [{ conexion_id: 'cx-1', calendar_id: null, rol: 'clinica', estado: 'activa' }], error: null },
      { data: null, error: null },
    ])
    const res = await altaConexion(ARGS)

    expect(res).toEqual({
      ok: true,
      alta: { conexionId: 'cx-1', calendarId: null, rol: 'clinica', estado: 'activa' },
    })

    const puente = clienteAdmin.rpcs[0]
    const espejo = clienteAdmin.escrituras[0]
    expect(puente.nombre).toBe('alta_conexion_google')
    expect(espejo.tabla).toBe(ESPEJO)
    expect(espejo.verbo).toBe('upsert')
    expect(puente.args.p_access).toBe('cifrado(ACC)')
    expect(espejo.valores?.access_token).toBe(puente.args.p_access)
    expect(puente.args.p_refresh).toBe('cifrado(REF)')
    expect(espejo.valores?.refresh_token).toBe(puente.args.p_refresh)
  })

  it('escribe primero la fuente nueva y después el espejo', async () => {
    clienteAdmin = clienteFalso([
      { data: [{ conexion_id: 'cx-1', calendar_id: null, rol: 'clinica', estado: 'activa' }], error: null },
      { data: null, error: null },
    ])
    await altaConexion(ARGS)
    expect(clienteAdmin.orden).toEqual([`rpc:alta_conexion_google`, `upsert:${ESPEJO}`])
  })
})

/* ── Refresco (H9) ──────────────────────────────────────── */

describe('guardarSecretos', () => {
  const ARGS = { clinicaId: 'cl-1', conexion: CONEXION, accessToken: 'ACC2', expiresAt: 222 }

  it('no manda el refresh token: null significa «no lo toques»', async () => {
    clienteAdmin = clienteFalso([{ data: null, error: null }, { data: null, error: null }])
    await guardarSecretos(ARGS)
    expect(clienteAdmin.rpcs[0].args.p_refresh).toBeNull()
  })

  it('escribe access_token y expires_at juntos, en las dos fuentes', async () => {
    clienteAdmin = clienteFalso([{ data: null, error: null }, { data: null, error: null }])
    await guardarSecretos(ARGS)

    expect(clienteAdmin.rpcs[0].args.p_access).toBe('cifrado(ACC2)')
    expect(clienteAdmin.rpcs[0].args.p_expires).toBe(222)
    expect(clienteAdmin.escrituras[0].valores).toEqual({
      access_token: 'cifrado(ACC2)',
      expires_at:   222,
    })
    expect(clienteAdmin.orden).toEqual([`rpc:guardar_secretos_conexion`, `update:${ESPEJO}`])
  })

  it('H9 — si la fuente nueva falla NO aborta y NO toca el espejo', async () => {
    clienteAdmin = clienteFalso([{ data: null, error: { message: 'se cayó' } }])

    await expect(guardarSecretos(ARGS)).resolves.toBeUndefined()
    expect(clienteAdmin.escrituras).toHaveLength(0)
    expect(errorEspejo()).toContain('se cayó')
  })

  it('si falla el espejo se sigue adelante y queda la línea greppable', async () => {
    clienteAdmin = clienteFalso([
      { data: null, error: null },
      { data: null, error: { message: 'espejo roto' } },
    ])

    await expect(guardarSecretos(ARGS)).resolves.toBeUndefined()
    expect(errorEspejo()).toContain('doble_escritura_espejo')
  })
})

/* ── Calendario: el CAS y el CAS del espejo (H10) ───────── */

describe('guardarCalendarIdSiEsperado', () => {
  const ARGS = { conexion: CONEXION, nuevo: 'cal-nuevo', esperado: 'cal-viejo' }

  it('devuelve true cuando el comparar-y-cambiar prende, y espeja', async () => {
    clienteAdmin = clienteFalso([
      { data: { calendar_id: 'cal-nuevo' }, error: null },
      { data: { calendar_id: 'cal-nuevo' }, error: null },
    ])

    expect(await guardarCalendarIdSiEsperado(ARGS)).toBe(true)
    expect(clienteAdmin.orden).toEqual([`update:${NUEVA}`, `update:${ESPEJO}`])
  })

  it('devuelve false y NO espeja cuando el CAS no prende', async () => {
    clienteAdmin = clienteFalso([{ data: null, error: null }])

    expect(await guardarCalendarIdSiEsperado(ARGS)).toBe(false)
    expect(clienteAdmin.orden).toEqual([`update:${NUEVA}`])
  })

  it('H10 — el espejo compara contra el MISMO esperado', async () => {
    clienteAdmin = clienteFalso([
      { data: { calendar_id: 'cal-nuevo' }, error: null },
      { data: { calendar_id: 'cal-nuevo' }, error: null },
    ])
    await guardarCalendarIdSiEsperado(ARGS)

    expect(clienteAdmin.escrituras[0].filtros).toEqual({
      id: 'cx-1', clinica_id: 'cl-1', calendar_id: 'cal-viejo',
    })
    expect(clienteAdmin.escrituras[1].filtros).toEqual({
      user_id: 'us-1', calendar_id: 'cal-viejo',
    })
  })

  it('con esperado null compara contra NULL en las dos fuentes', async () => {
    clienteAdmin = clienteFalso([
      { data: { calendar_id: 'cal-nuevo' }, error: null },
      { data: { calendar_id: 'cal-nuevo' }, error: null },
    ])
    await guardarCalendarIdSiEsperado({ ...ARGS, esperado: null })

    expect(clienteAdmin.escrituras[0].filtros.calendar_id).toBeNull()
    expect(clienteAdmin.escrituras[1].filtros.calendar_id).toBeNull()
  })

  it('avisa cuando el CAS del espejo no prende, sin tumbar la operación', async () => {
    clienteAdmin = clienteFalso([
      { data: { calendar_id: 'cal-nuevo' }, error: null },
      { data: null, error: null },
    ])

    expect(await guardarCalendarIdSiEsperado(ARGS)).toBe(true)
    expect(errorEspejo()).toContain('doble_escritura_espejo')
  })
})

/* ── Baja ───────────────────────────────────────────────── */

describe('borrarConexion', () => {
  it('borra primero la fuente nueva y después el espejo', async () => {
    clienteAdmin = clienteFalso([{ data: null, error: null }, { data: null, error: null }])
    await borrarConexion({ conexion: CONEXION })

    expect(clienteAdmin.orden).toEqual([`delete:${NUEVA}`, `delete:${ESPEJO}`])
    expect(clienteAdmin.escrituras[0].filtros).toEqual({ id: 'cx-1', clinica_id: 'cl-1' })
  })

  it('si el espejo no se borra, se registra y no se lanza', async () => {
    clienteAdmin = clienteFalso([
      { data: null, error: null },
      { data: null, error: { message: 'espejo roto' } },
    ])

    await expect(borrarConexion({ conexion: CONEXION })).resolves.toBeUndefined()
    expect(errorEspejo()).toContain('doble_escritura_espejo')
  })

  it('si falla la fuente nueva, lanza y no toca el espejo', async () => {
    clienteAdmin = clienteFalso([{ data: null, error: { message: 'no se pudo' } }])

    await expect(borrarConexion({ conexion: CONEXION })).rejects.toThrow('no se pudo')
    expect(clienteAdmin.orden).toEqual([`delete:${NUEVA}`])
  })
})

/* ── Lectura de tokens: no decide nada (D4) ─────────────── */

describe('leerConexionConSecretos', () => {
  it('devuelve la fila con tieneSecretos, sin interpretarla', async () => {
    clienteAdmin = clienteFalso([{
      data: [{
        conexion_id: 'cx-1', clinica_id: 'cl-1', user_id: 'us-1', rol: 'clinica',
        calendar_id: null, estado: 'activa', tiene_secretos: true,
        access_token: 'a', refresh_token: 'r', expires_at: 9,
      }],
      error: null,
    }])

    const { fila, error } = await leerConexionConSecretos({ clinicaId: 'cl-1', conexionId: 'cx-1' })
    expect(error).toBeNull()
    expect(fila?.tieneSecretos).toBe(true)
    expect(fila?.accessToken).toBe('a')
  })

  it('NO lanza con tieneSecretos=false: quien decide es abrirSesionGoogle', async () => {
    clienteAdmin = clienteFalso([{
      data: [{
        conexion_id: 'cx-1', clinica_id: 'cl-1', user_id: 'us-1', rol: 'clinica',
        calendar_id: null, estado: 'activa', tiene_secretos: false,
        access_token: null, refresh_token: null, expires_at: null,
      }],
      error: null,
    }])

    const { fila } = await leerConexionConSecretos({ clinicaId: 'cl-1', conexionId: 'cx-1' })
    expect(fila?.tieneSecretos).toBe(false)
  })

  it('distingue cero filas de error, y no lanza en ninguno de los dos', async () => {
    clienteAdmin = clienteFalso([{ data: [], error: null }])
    expect(await leerConexionConSecretos({ clinicaId: 'cl-1', conexionId: 'cx-1' }))
      .toEqual({ fila: null, error: null })

    clienteAdmin = clienteFalso([{ data: null, error: { message: 'PGRST202' } }])
    expect(await leerConexionConSecretos({ clinicaId: 'cl-1', conexionId: 'cx-1' }))
      .toEqual({ fila: null, error: 'PGRST202' })
  })
})
