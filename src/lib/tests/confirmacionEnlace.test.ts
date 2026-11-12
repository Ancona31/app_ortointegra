/**
 * confirmacionEnlace.test.ts — agenda E2: el enlace de confirmación se deriva
 * del id (no se guarda), la URL no lleva datos personales, el cliente de
 * servicio sólo hace `.rpc()` con `p_clinica_id`, y todo falla cerrado (sin
 * secreto, sin las RPC de E1 o ante un error) sin lanzar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'node:crypto'

interface Llamada { rpc: string; args: Record<string, unknown>; single: boolean }
type Respuesta = { data: unknown; error: { code?: string; message: string } | null }
const llamadas: Llamada[] = []
let responder: (rpc: string, args: Record<string, unknown>) => Respuesta = () => ({ data: null, error: null })
let lanzar = false

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (lanzar) throw new Error('sin variables')
    return {
      from: () => { throw new Error('E2 no debe usar .from() con el cliente de servicio') },
      rpc: (rpc: string, args: Record<string, unknown>) => {
        // Perezoso, como el constructor de PostgREST: sólo «sale» al esperarlo o al pedir .single().
        return {
          single: async () => { llamadas.push({ rpc, args, single: true }); return responder(rpc, args) },
          then: (ok: (r: Respuesta) => unknown, mal?: (e: unknown) => unknown) => {
            llamadas.push({ rpc, args, single: false })
            return Promise.resolve(responder(rpc, args)).then(ok, mal)
          },
        }
      },
    }
  },
}))

const { codigoDeConfirmacion } = await import('@/lib/reserva/secretos')
const {
  emitirEnlaceConfirmacion, resolverEnlaceConfirmacion, responderEnlaceConfirmacion, revocarEnlaceConfirmacion, urlDeConfirmacion,
} = await import('@/lib/confirmacion/enlaceConfirmacion')

const SECRETO = 'c3'.repeat(32)
const CLINICA = '00000000-0000-4000-8000-0000000e2c01'
const CITA = '00000000-0000-4000-8000-0000000e2a01'
const MEDICO = '00000000-0000-4000-8000-0000000e2b01'
const VIGENTE = '00000000-0000-4000-8000-0000000e2e01'
const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex')
const URL_CONFIRMAR = /^https:\/\/spinus\.prueba\/confirmar\/[A-Za-z0-9_-]{22}$/

const CONTEXTO = {
  clinica_id: CLINICA, estado: 'agendada', inicio: '2026-11-14T16:00:00+00:00', fin: '2026-11-14T16:30:00+00:00',
  zona: 'America/Mexico_City',
  medico: { titulo: 'Dr.', nombres: 'Ana', apellido_paterno: 'Pérez', apellido_materno: null },
  consultorio: { nombre: 'Consultorio Uno', direccion: 'Calle 1', telefono: null },
  puede_confirmar: true, puede_cancelar: true, corte_cancelar: '2026-11-14T15:00:00.123456+00:00', respuesta: null,
}

beforeEach(() => {
  vi.stubEnv('RESERVA_SECRETO', SECRETO)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://spinus.prueba/')
  llamadas.length = 0
  lanzar = false
  responder = () => ({ data: null, error: null })
})
afterEach(() => { vi.unstubAllEnvs() })

/** La base de E1: devuelve el id que le mandan (emisión nueva) con su hash. */
function emisionNueva(rpc: string, args: Record<string, unknown>): Respuesta {
  if (rpc === 'cita_confirmacion_emitir') return { data: { r_id: args.p_id, r_codigo_hash: args.p_codigo_hash }, error: null }
  if (rpc === 'cita_confirmacion_revocar') return { data: 1, error: null }
  return { data: null, error: null }
}

describe('emitirEnlaceConfirmacion', () => {
  it('manda a la RPC el id nuevo y sha256 de SU código, con p_clinica_id; la URL lleva sólo el código', async () => {
    responder = emisionNueva
    const e = await emitirEnlaceConfirmacion(CLINICA, CITA, MEDICO)
    expect(llamadas).toHaveLength(1)
    const { rpc, args, single } = llamadas[0]
    expect(rpc).toBe('cita_confirmacion_emitir')
    expect(single).toBe(true)
    expect(Object.keys(args).sort()).toEqual(['p_cita_id', 'p_clinica_id', 'p_codigo_hash', 'p_creado_por', 'p_id'])
    expect(args.p_clinica_id).toBe(CLINICA)
    expect(args.p_cita_id).toBe(CITA)
    expect(args.p_creado_por).toBe(MEDICO)
    expect(args.p_codigo_hash).toBe(sha(codigoDeConfirmacion(String(args.p_id)) ?? ''))
    expect(e?.id).toBe(args.p_id)
    expect(e?.codigo).toBe(codigoDeConfirmacion(String(args.p_id)))
    expect(e?.url).toMatch(URL_CONFIRMAR)
    expect(e?.url).toBe(`https://spinus.prueba/confirmar/${e?.codigo}`)
    for (const dato of [CLINICA, CITA, MEDICO, String(args.p_id), String(args.p_codigo_hash)]) expect(e?.url).not.toContain(dato)
  })

  it('si la base devuelve el enlace VIGENTE, la URL usa el código de ESE id', async () => {
    responder = (rpc) => rpc === 'cita_confirmacion_emitir'
      ? { data: { r_id: VIGENTE, r_codigo_hash: sha(codigoDeConfirmacion(VIGENTE) ?? '') }, error: null }
      : { data: null, error: null }
    const e = await emitirEnlaceConfirmacion(CLINICA, CITA, null)
    expect(e).toEqual({ id: VIGENTE, codigo: codigoDeConfirmacion(VIGENTE), url: `https://spinus.prueba/confirmar/${codigoDeConfirmacion(VIGENTE)}` })
    expect(llamadas[0].args.p_creado_por).toBeNull()
    expect(llamadas).toHaveLength(1)
  })

  it('un vigente emitido con OTRO secreto se revoca y se emite otro, una sola vez', async () => {
    let emisiones = 0
    responder = (rpc, args) => {
      if (rpc === 'cita_confirmacion_emitir' && emisiones++ === 0) return { data: { r_id: VIGENTE, r_codigo_hash: 'f'.repeat(64) }, error: null }
      return emisionNueva(rpc, args)
    }
    const e = await emitirEnlaceConfirmacion(CLINICA, CITA, null)
    expect(llamadas.map(l => l.rpc)).toEqual(['cita_confirmacion_emitir', 'cita_confirmacion_revocar', 'cita_confirmacion_emitir'])
    expect(llamadas[1].args).toEqual({ p_clinica_id: CLINICA, p_cita_id: CITA })
    expect(e?.id).toBe(llamadas[2].args.p_id)
    expect(e?.url).toMatch(URL_CONFIRMAR)
  })

  it('si el código sigue sin coincidir tras revocar, null (no da un enlace muerto)', async () => {
    responder = (rpc) => rpc === 'cita_confirmacion_emitir'
      ? { data: { r_id: VIGENTE, r_codigo_hash: 'f'.repeat(64) }, error: null }
      : { data: 1, error: null }
    expect(await emitirEnlaceConfirmacion(CLINICA, CITA, null)).toBeNull()
    expect(llamadas.map(l => l.rpc)).toEqual(['cita_confirmacion_emitir', 'cita_confirmacion_revocar', 'cita_confirmacion_emitir'])
  })

  it('si revocar el vigente muerto falla, null sin volver a emitir', async () => {
    responder = (rpc) => rpc === 'cita_confirmacion_emitir'
      ? { data: { r_id: VIGENTE, r_codigo_hash: 'f'.repeat(64) }, error: null }
      : { data: null, error: { code: 'XX000', message: 'x' } }
    expect(await emitirEnlaceConfirmacion(CLINICA, CITA, null)).toBeNull()
    expect(llamadas.map(l => l.rpc)).toEqual(['cita_confirmacion_emitir', 'cita_confirmacion_revocar'])
  })

  it('«no aplica» (r_id NULL) da null', async () => {
    responder = () => ({ data: { r_id: null, r_codigo_hash: null }, error: null })
    expect(await emitirEnlaceConfirmacion(CLINICA, CITA, null)).toBeNull()
  })

  it('sin secreto, con ids inválidos o sin base de URL válida: null sin llamar a la base (no escribe un enlace inservible)', async () => {
    responder = emisionNueva
    expect(await emitirEnlaceConfirmacion(CLINICA, 'no-es-uuid', null)).toBeNull()
    expect(await emitirEnlaceConfirmacion('x', CITA, null)).toBeNull()
    vi.stubEnv('RESERVA_SECRETO', '')
    expect(await emitirEnlaceConfirmacion(CLINICA, CITA, null)).toBeNull()
    vi.stubEnv('RESERVA_SECRETO', SECRETO)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'javascript:alert(1)')
    expect(await emitirEnlaceConfirmacion(CLINICA, CITA, null)).toBeNull()
    expect(llamadas).toHaveLength(0)
  })

  it('un autor que no es uuid viaja como null', async () => {
    responder = emisionNueva
    await emitirEnlaceConfirmacion(CLINICA, CITA, 'cron')
    expect(llamadas[0].args.p_creado_por).toBeNull()
  })

  it.each(['PGRST202', '42883', '42P01', 'PGRST205', '22023', undefined])('tolerante: error %s → null sin lanzar', async (code) => {
    responder = () => ({ data: null, error: { code, message: 'algo con datos' } })
    await expect(emitirEnlaceConfirmacion(CLINICA, CITA, null)).resolves.toBeNull()
  })

  it('si el cliente no se puede crear (variables ausentes), null sin lanzar', async () => {
    lanzar = true
    await expect(emitirEnlaceConfirmacion(CLINICA, CITA, null)).resolves.toBeNull()
  })

  it('una forma inesperada de la fila da null', async () => {
    responder = () => ({ data: { r_id: 'no-uuid', r_codigo_hash: 'x' }, error: null })
    expect(await emitirEnlaceConfirmacion(CLINICA, CITA, null)).toBeNull()
  })
})

describe('resolverEnlaceConfirmacion', () => {
  const codigo = (): string => codigoDeConfirmacion(VIGENTE) ?? ''

  it('busca por sha256 del código y devuelve el contexto con su hash', async () => {
    responder = () => ({ data: CONTEXTO, error: null })
    const c = await resolverEnlaceConfirmacion(codigo())
    expect(llamadas).toEqual([{ rpc: 'cita_confirmacion_contexto', args: { p_codigo_hash: sha(codigo()) }, single: false }])
    expect(c).toEqual({ ...CONTEXTO, codigo_hash: sha(codigo()) })
  })

  it('un código sin forma no toca la base', async () => {
    for (const malo of ['', 'corto', `${codigo()}x`, 'a/b+c'.padEnd(22, 'x')]) expect(await resolverEnlaceConfirmacion(malo)).toBeNull()
    expect(llamadas).toHaveLength(0)
  })

  it('NULL de la base (inexistente, revocado, apagado), forma inesperada, RPC ausente o sin secreto: null', async () => {
    responder = () => ({ data: null, error: null })
    expect(await resolverEnlaceConfirmacion(codigo())).toBeNull()
    responder = () => ({ data: { ...CONTEXTO, title: undefined, estado: 'otra' }, error: null })
    expect(await resolverEnlaceConfirmacion(codigo())).toBeNull()
    responder = () => ({ data: null, error: { code: 'PGRST202', message: 'x' } })
    expect(await resolverEnlaceConfirmacion(codigo())).toBeNull()
    const antes = llamadas.length
    vi.stubEnv('RESERVA_SECRETO', '')
    expect(await resolverEnlaceConfirmacion('A'.repeat(22))).toBeNull()
    expect(llamadas).toHaveLength(antes)
  })
})

describe('responderEnlaceConfirmacion y revocarEnlaceConfirmacion', () => {
  const ctx = { ...CONTEXTO, estado: 'agendada' as const, respuesta: null, codigo_hash: 'a'.repeat(64) }

  it('responder manda la clínica y el hash del contexto, en una fila', async () => {
    responder = () => ({ data: { r_resultado: 'cancelada', r_cita_id: CITA, r_google_event_id: 'ev', r_gcal_etag: '"1"' }, error: null })
    const r = await responderEnlaceConfirmacion(ctx, 'cancelar')
    expect(llamadas).toEqual([{ rpc: 'cita_confirmacion_responder', single: true,
      args: { p_clinica_id: CLINICA, p_codigo_hash: 'a'.repeat(64), p_accion: 'cancelar' } }])
    expect(r).toEqual({ r_resultado: 'cancelada', r_cita_id: CITA, r_google_event_id: 'ev', r_gcal_etag: '"1"' })
  })

  it('responder: acción desconocida no llama; resultado desconocido o error dan null', async () => {
    // @ts-expect-error — una acción fuera de la unión, como llegaría de un formulario sin validar.
    expect(await responderEnlaceConfirmacion(ctx, 'borrar')).toBeNull()
    expect(llamadas).toHaveLength(0)
    responder = () => ({ data: { r_resultado: 'otro', r_cita_id: null, r_google_event_id: null, r_gcal_etag: null }, error: null })
    expect(await responderEnlaceConfirmacion(ctx, 'confirmar')).toBeNull()
    responder = () => ({ data: null, error: { code: '42883', message: 'x' } })
    expect(await responderEnlaceConfirmacion(ctx, 'confirmar')).toBeNull()
  })

  it('revocar: p_clinica_id y p_cita_id; true si la llamada salió; false con error o ids inválidos', async () => {
    responder = () => ({ data: 0, error: null })
    expect(await revocarEnlaceConfirmacion(CLINICA, CITA)).toBe(true)
    expect(llamadas).toEqual([{ rpc: 'cita_confirmacion_revocar', args: { p_clinica_id: CLINICA, p_cita_id: CITA }, single: false }])
    responder = () => ({ data: null, error: { code: 'PGRST202', message: 'x' } })
    expect(await revocarEnlaceConfirmacion(CLINICA, CITA)).toBe(false)
    expect(await revocarEnlaceConfirmacion(CLINICA, 'x')).toBe(false)
    expect(llamadas).toHaveLength(2)
  })
})

describe('urlDeConfirmacion', () => {
  it('sólo códigos con forma, sin barra doble, y sólo bases http(s) sin ruta', () => {
    const c = codigoDeConfirmacion(VIGENTE) ?? ''
    expect(urlDeConfirmacion(c)).toBe(`https://spinus.prueba/confirmar/${c}`)
    expect(urlDeConfirmacion('../x')).toBeNull()
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3001')
    expect(urlDeConfirmacion(c)).toBe(`http://localhost:3001/confirmar/${c}`)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://spinus.prueba/otra/ruta')
    expect(urlDeConfirmacion(c)).toBeNull()
  })
})
