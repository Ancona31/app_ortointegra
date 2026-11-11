/**
 * `/api/google/events`: la resta de duplicados contra `appointments` arranca
 * EN PARALELO con `events.list`, y la salida no cambia por ello.
 *
 * Fija dos cosas distintas:
 *
 *   · LA SALIDA, caso por caso: sin conexión, eventos `null`, eventos `[]`
 *     (donde la consulta en paralelo se ignora y su fallo NO se propaga), resta
 *     correcta, resta incompleta (`error_google`), excepción de Google y
 *     excepción de la consulta. Estos casos ya pasaban con la consulta en serie;
 *     si alguno se cae, el paralelo cambió el comportamiento.
 *   · EL ORDEN: la consulta de citas se ARRANCA (se llama a su `then`) antes de
 *     que resuelva `events.list`, y nunca antes de pasar los cortes de
 *     autorización ni sin conexión.
 *
 * El doble de la consulta es un thenable PEREZOSO, como el builder real de
 * PostgREST: no hace nada hasta que alguien llama a `then`. Así «arrancó» es
 * observable. Un rechazo sin manejar haría fallar la corrida de Vitest, de modo
 * que los casos con la consulta rota y el resultado ignorado prueban también el
 * `.catch` de la ruta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

interface FilaCita { google_event_id: string }
interface ResultadoCitas {
  data:  FilaCita[] | null
  count: number | null
  error: { message: string } | null
}
interface PerfilFalso {
  clinica_id: string
  role: 'medico' | 'secretaria'
  es_admin_de_clinica: boolean
}
interface EventoGoogle { id: string; summary: string; start: { dateTime: string }; end: { dateTime: string } }
interface ConexionFalsa { id: string; clinicaId: string; userId: string }

interface Estado {
  registro: string[]
  tablas:   string[]
  perfil:   PerfilFalso | null
  conexion: ConexionFalsa | null
  /** Lo que devuelve la consulta de citas cuando alguien la arranca. */
  citas: () => Promise<unknown>
  /** Qué hace `conCalendarioSpinus`: 'operar' llama a la operación de la ruta. */
  calendario: () => Promise<unknown>
  /** Lo que contesta cada página de `events.list`. */
  lista: () => Promise<unknown>
}

const h = vi.hoisted(() => {
  const estado: Estado = {
    registro: [],
    tablas: [],
    perfil: null,
    conexion: null,
    citas: () => Promise.resolve({ data: [], count: 0, error: null }),
    calendario: () => Promise.resolve(null),
    lista: () => Promise.resolve({ data: { items: [] } }),
  }
  return { estado }
})

class ConsultaPerfil {
  select(): this { return this }
  eq(): this { return this }
  single(): Promise<{ data: unknown }> { return Promise.resolve({ data: h.estado.perfil }) }
}

class ConsultaCitas implements PromiseLike<unknown> {
  select(): this { return this }
  eq(): this { return this }
  lte(): this { return this }
  gte(): this { return this }
  not(): this { return this }
  then<A = unknown, B = never>(
    ok?: ((v: unknown) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    h.estado.registro.push('citas:arranca')
    return h.estado.citas().then(ok, ko)
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'usuario-1' } } }) },
    from: (tabla: string) => {
      h.estado.tablas.push(tabla)
      return tabla === 'appointments' ? new ConsultaCitas() : new ConsultaPerfil()
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ soy: 'admin' }),
}))

vi.mock('@/lib/gcalConexion', () => ({
  resolverConexionClinica: async () => h.estado.conexion,
}))

vi.mock('@/lib/gcal', () => ({
  conCalendarioSpinus: async (
    conexion: unknown,
    _admin: unknown,
    operacion: (calendar: unknown, calendarId: string) => Promise<unknown>,
  ) => {
    if (!conexion) return null
    h.estado.registro.push('google:abre')
    const resultado = await h.estado.calendario()
    if (resultado !== 'operar') return resultado
    const calendar = {
      events: {
        list: async () => {
          h.estado.registro.push('lista:llamada')
          const pagina = await h.estado.lista()
          h.estado.registro.push('lista:resuelve')
          return pagina
        },
      },
    }
    return operacion(calendar, 'cal-1')
  },
  registrarFalloGCal: vi.fn(),
  esCredencialInvalida: () => false,
}))

import { GET } from '@/app/api/google/events/route'
import { registrarFalloGCal } from '@/lib/gcal'

/* ── Escenarios ─────────────────────────────────────────── */

const ADMIN: PerfilFalso = { clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: true }
const INVITADO: PerfilFalso = { clinica_id: 'clinica-1', role: 'medico', es_admin_de_clinica: false }
const CONEXION: ConexionFalsa = {
  id: 'conexion-1', clinicaId: 'clinica-1', userId: '11111111-1111-1111-1111-111111111111',
}
const AJENO = '22222222-2222-2222-2222-222222222222'

function evento(id: string): EventoGoogle {
  return { id, summary: `ev ${id}`, start: { dateTime: '2026-11-10T10:00:00Z' }, end: { dateTime: '2026-11-10T11:00:00Z' } }
}

function citas(resultado: ResultadoCitas): () => Promise<unknown> {
  return () => Promise.resolve(resultado)
}

function pedir(extra = ''): Promise<Response> {
  return GET(new NextRequest(
    `http://localhost/api/google/events?from=2026-11-09T00:00:00Z&to=2026-11-16T00:00:00Z${extra}`,
  ))
}

async function cuerpo(res: Response): Promise<unknown> {
  expect(res.status).toBe(200)
  return res.json()
}

/** Un rechazo que se crea al arrancar la consulta, no antes. */
const consultaRota = (): Promise<unknown> => Promise.reject(new Error('fetch roto'))

beforeEach(() => {
  vi.mocked(registrarFalloGCal).mockClear()
  h.estado.registro = []
  h.estado.tablas = []
  h.estado.perfil = ADMIN
  h.estado.conexion = CONEXION
  h.estado.citas = citas({ data: [], count: 0, error: null })
  h.estado.calendario = () => Promise.resolve('operar')
  h.estado.lista = () => Promise.resolve({ data: { items: [] } })
})

/* ── Salida ─────────────────────────────────────────────── */

describe('/api/google/events — salida', () => {
  it('sin conexión: sin_token y la consulta de citas NO arranca', async () => {
    h.estado.conexion = null
    expect(await cuerpo(await pedir())).toEqual({ estado: 'sin_token' })
    expect(h.estado.tablas).not.toContain('appointments')
  })

  it('médico invitado: vacío y la consulta de citas NO arranca', async () => {
    h.estado.perfil = INVITADO
    expect(await cuerpo(await pedir())).toEqual({ estado: 'conectado', events: [] })
    expect(h.estado.tablas).not.toContain('appointments')
  })

  it('filtro en un médico ajeno al conector: vacío y la consulta NO arranca', async () => {
    expect(await cuerpo(await pedir(`&medico_id=${AJENO}`))).toEqual({ estado: 'conectado', events: [] })
    expect(h.estado.tablas).not.toContain('appointments')
  })

  it('eventos null: error_google, aunque la consulta en paralelo reviente', async () => {
    h.estado.calendario = () => Promise.resolve(null)
    h.estado.citas = consultaRota
    expect(await cuerpo(await pedir())).toEqual({ estado: 'error_google' })
    expect(registrarFalloGCal).not.toHaveBeenCalled()
  })

  it('eventos []: conectado y vacío; el fallo de la consulta se ignora', async () => {
    h.estado.citas = consultaRota
    expect(await cuerpo(await pedir())).toEqual({ estado: 'conectado', events: [] })
    expect(registrarFalloGCal).not.toHaveBeenCalled()
  })

  it('eventos []: un conjunto incompleto tampoco levanta error_google', async () => {
    h.estado.citas = citas({ data: [], count: 9, error: null })
    expect(await cuerpo(await pedir())).toEqual({ estado: 'conectado', events: [] })
  })

  it('resta correcta: quita los eventos que ya son cita', async () => {
    h.estado.lista = () => Promise.resolve({ data: { items: [evento('a'), evento('b'), evento('c')] } })
    h.estado.citas = citas({ data: [{ google_event_id: 'b' }], count: 1, error: null })
    expect(await cuerpo(await pedir())).toEqual({
      estado: 'conectado',
      events: [
        { id: 'a', summary: 'ev a', start: { dateTime: '2026-11-10T10:00:00Z' }, end: { dateTime: '2026-11-10T11:00:00Z' } },
        { id: 'c', summary: 'ev c', start: { dateTime: '2026-11-10T10:00:00Z' }, end: { dateTime: '2026-11-10T11:00:00Z' } },
      ],
    })
  })

  it('resta incompleta (count > filas): error_google y se registra con el calendario', async () => {
    h.estado.lista = () => Promise.resolve({ data: { items: [evento('a')] } })
    h.estado.citas = citas({ data: [{ google_event_id: 'b' }], count: 3, error: null })
    expect(await cuerpo(await pedir())).toEqual({ estado: 'error_google' })
    expect(registrarFalloGCal).toHaveBeenCalledWith(
      expect.objectContaining({ operacion: 'resta de citas (agenda, conjunto incompleto)', calendarId: 'cal-1' }),
      expect.any(Error),
    )
  })

  it('resta con error de PostgREST: error_google', async () => {
    h.estado.lista = () => Promise.resolve({ data: { items: [evento('a')] } })
    h.estado.citas = citas({ data: null, count: null, error: { message: 'rls' } })
    expect(await cuerpo(await pedir())).toEqual({ estado: 'error_google' })
    expect(registrarFalloGCal).toHaveBeenCalledWith(
      expect.objectContaining({ operacion: 'resta de citas (agenda, conjunto incompleto)' }),
      { message: 'rls' },
    )
  })

  it('excepción de Google: error_google con error, y el rechazo paralelo no se escapa', async () => {
    h.estado.lista = () => Promise.reject(new Error('google caído'))
    h.estado.citas = consultaRota
    expect(await cuerpo(await pedir())).toEqual({ estado: 'error_google', error: 'Error al obtener eventos' })
    expect(registrarFalloGCal).toHaveBeenCalledTimes(1)
    expect(vi.mocked(registrarFalloGCal).mock.calls[0][1]).toEqual(new Error('google caído'))
  })

  it('excepción de la consulta con eventos: error_google con error, registrado como events.list', async () => {
    h.estado.lista = () => Promise.resolve({ data: { items: [evento('a')] } })
    h.estado.citas = consultaRota
    expect(await cuerpo(await pedir())).toEqual({ estado: 'error_google', error: 'Error al obtener eventos' })
    expect(registrarFalloGCal).toHaveBeenCalledWith(
      expect.objectContaining({ operacion: 'events.list (agenda)', conexionId: 'conexion-1', calendarId: 'cal-1' }),
      new Error('fetch roto'),
    )
  })
})

/* ── Orden ──────────────────────────────────────────────── */

describe('/api/google/events — orden', () => {
  it('la consulta de citas arranca ANTES de que resuelva events.list', async () => {
    let soltarLista: (v: unknown) => void = () => {}
    h.estado.lista = () => new Promise((resolver) => { soltarLista = resolver })
    h.estado.citas = citas({ data: [], count: 0, error: null })

    const respuesta = pedir()
    await vi.waitFor(() => expect(h.estado.registro).toContain('lista:llamada'))
    // Se deja correr todo lo pendiente con `events.list` todavía en vuelo.
    await new Promise((r) => setTimeout(r, 0))
    expect(h.estado.registro).toContain('citas:arranca')

    soltarLista({ data: { items: [evento('a')] } })
    expect(await cuerpo(await respuesta)).toEqual({
      estado: 'conectado',
      events: [{ id: 'a', summary: 'ev a', start: { dateTime: '2026-11-10T10:00:00Z' }, end: { dateTime: '2026-11-10T11:00:00Z' } }],
    })
    const r = h.estado.registro
    expect(r.indexOf('citas:arranca')).toBeLessThan(r.indexOf('lista:resuelve'))
    // Una sola consulta: el paralelo no se suma a la de siempre.
    expect(r.filter((x) => x === 'citas:arranca')).toHaveLength(1)
  })
})
