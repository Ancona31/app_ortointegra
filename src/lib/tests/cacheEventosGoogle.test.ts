/**
 * cacheEventosGoogle.test.ts — Google fuera del camino crítico de la agenda
 * (A1.3). Fija lo que la página da por hecho de `@/lib/agenda/cacheEventosGoogle`:
 *
 *   · la respuesta que llega se entrega UNA vez por su aviso, y después sólo si
 *     sigue vigente (5 min y no es `error_google`);
 *   · los fallos —`error_google` y la caída de red— no se sirven de la caché:
 *     la siguiente traída vuelve a preguntar, como antes de A1.3;
 *   · una sola traída por clave a la vez;
 *   · tras `vaciarCacheGoogle` (cerrar sesión) no queda nada, y una traída que
 *     ya volaba no escribe al volver;
 *   · `pedirEventosGoogle` traduce la ruta igual que la fuente vieja.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  TTL_GOOGLE_MS, aEventosDeCalendario, claveGoogle, eventosProvisionales, leerGoogle,
  pedirEventosGoogle, quitarEventosImportados, traerGoogle, vaciarCacheGoogle, type RespuestaGoogle,
  type EventoGoogle as EventoGoogleC6,
} from '@/lib/agenda/cacheEventosGoogle'

const CLAVE = claveGoogle('u1', '', '2026-11-09T06:00:00.000Z', '2026-11-16T06:00:00.000Z')
const CONECTADO: RespuestaGoogle = {
  estado: 'conectado',
  events: [{ id: 'g1', summary: 'Junta', start: { dateTime: '2026-11-10T15:00:00Z' }, end: { dateTime: '2026-11-10T16:00:00Z' } }],
}

/** Una promesa que el test resuelve o rechaza cuando quiere. */
function diferida<T>(): { promesa: Promise<T>; resolver: (v: T) => void; rechazar: (e: Error) => void } {
  let resolver: (v: T) => void = () => {}
  let rechazar: (e: Error) => void = () => {}
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej })
  return { promesa, resolver, rechazar }
}

/** Trae con `pedir` y espera a que el aviso llegue. */
async function traerYEsperar(clave: string, pedir: () => Promise<RespuestaGoogle>): Promise<void> {
  await new Promise<void>(res => traerGoogle(clave, pedir, res))
}

beforeEach(() => { vaciarCacheGoogle() })
afterEach(() => { vi.unstubAllGlobals() })

describe('claveGoogle', () => {
  it('separa usuario, filtro y rango', () => {
    expect(claveGoogle('u1', 'm1', 'a', 'b')).not.toBe(claveGoogle('u2', 'm1', 'a', 'b'))
    expect(claveGoogle('u1', '', 'a', 'b')).not.toBe(claveGoogle('u1', 'm1', 'a', 'b'))
    expect(claveGoogle('u1', '', 'a', 'b')).not.toBe(claveGoogle('u1', '', 'a', 'c'))
  })
})

describe('leerGoogle', () => {
  it('sin nada guardado hay que preguntar', () => {
    expect(leerGoogle(CLAVE)).toBeNull()
  })

  it('entrega la respuesta por su aviso y la sigue sirviendo mientras vive', async () => {
    await traerYEsperar(CLAVE, async () => CONECTADO)
    expect(leerGoogle(CLAVE)).toEqual({ tipo: 'respuesta', datos: CONECTADO })
    expect(leerGoogle(CLAVE, Date.now() + TTL_GOOGLE_MS - 1000)).toEqual({ tipo: 'respuesta', datos: CONECTADO })
  })

  it('caducada a los 5 min: vuelve a preguntar, pero los eventos quedan de provisionales', async () => {
    await traerYEsperar(CLAVE, async () => CONECTADO)
    leerGoogle(CLAVE)
    expect(leerGoogle(CLAVE, Date.now() + TTL_GOOGLE_MS + 1)).toBeNull()
    expect(eventosProvisionales(CLAVE)).toEqual(CONECTADO.events)
  })

  it('un aviso que nadie consumió caduca igual: no se sirve pasado el TTL', async () => {
    // El usuario cambió de semana o de filtro antes de que llegara: el
    // `refetch` del aviso salió con OTRA clave y ésta se quedó por entregar.
    await traerYEsperar(CLAVE, async () => ({ estado: 'error_google', events: [] }))
    expect(leerGoogle(CLAVE, Date.now() + TTL_GOOGLE_MS * 10)).toBeNull()
    // Y no queda armado para la lectura siguiente.
    expect(leerGoogle(CLAVE)).toBeNull()
  })

  it('error_google se entrega UNA vez y no se sirve de la caché', async () => {
    await traerYEsperar(CLAVE, async () => ({ estado: 'error_google', events: [] }))
    expect(leerGoogle(CLAVE)).toEqual({ tipo: 'respuesta', datos: { estado: 'error_google', events: [] } })
    expect(leerGoogle(CLAVE)).toBeNull()
    expect(eventosProvisionales(CLAVE)).toEqual([])
  })

  it('la caída de red se entrega UNA vez como caída', async () => {
    await traerYEsperar(CLAVE, async () => { throw new Error('red') })
    const r = leerGoogle(CLAVE)
    expect(r?.tipo).toBe('caida')
    expect(r?.tipo === 'caida' ? r.error.message : '').toBe('red')
    expect(leerGoogle(CLAVE)).toBeNull()
  })

  it('sin_token sí se sirve de la caché: no es un fallo, es una clínica sin Google', async () => {
    await traerYEsperar(CLAVE, async () => ({ estado: 'sin_token', events: [] }))
    leerGoogle(CLAVE)
    expect(leerGoogle(CLAVE)).toEqual({ tipo: 'respuesta', datos: { estado: 'sin_token', events: [] } })
  })
})

describe('traerGoogle', () => {
  it('al escribir purga lo vencido ya entregado, y no lo vigente ni lo pendiente', async () => {
    const VIEJA = claveGoogle('u1', '', 'viejo-a', 'viejo-b')
    const PENDIENTE = claveGoogle('u1', '', 'pend-a', 'pend-b')
    const VIGENTE = claveGoogle('u1', '', 'vig-a', 'vig-b')
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      await traerYEsperar(VIEJA, async () => CONECTADO)
      leerGoogle(VIEJA)                       // entregada
      await traerYEsperar(PENDIENTE, async () => CONECTADO)  // sin entregar
      vi.setSystemTime(Date.now() + TTL_GOOGLE_MS + 1)
      await traerYEsperar(VIGENTE, async () => CONECTADO)
      expect(eventosProvisionales(VIEJA)).toEqual([])
      expect(eventosProvisionales(PENDIENTE)).toEqual(CONECTADO.events)
      expect(eventosProvisionales(VIGENTE)).toEqual(CONECTADO.events)
    } finally {
      vi.useRealTimers()
    }
  })

  it('una sola traída por clave mientras vuela', async () => {
    const d = diferida<RespuestaGoogle>()
    const pedir = vi.fn(() => d.promesa)
    const avisos = vi.fn()
    traerGoogle(CLAVE, pedir, avisos)
    traerGoogle(CLAVE, pedir, avisos)
    d.resolver(CONECTADO)
    await d.promesa
    await new Promise(res => setTimeout(res, 0))
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(avisos).toHaveBeenCalledTimes(1)
    // Ya volvió: la siguiente sí sale.
    await traerYEsperar(CLAVE, pedir)
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it('tras vaciar, la traída que volaba no escribe ni avisa', async () => {
    const d = diferida<RespuestaGoogle>()
    const avisos = vi.fn()
    traerGoogle(CLAVE, () => d.promesa, avisos)
    vaciarCacheGoogle()
    d.resolver(CONECTADO)
    await d.promesa
    await new Promise(res => setTimeout(res, 0))
    expect(avisos).not.toHaveBeenCalled()
    expect(leerGoogle(CLAVE)).toBeNull()
    expect(eventosProvisionales(CLAVE)).toEqual([])
  })

  it('vaciar borra lo guardado', async () => {
    await traerYEsperar(CLAVE, async () => CONECTADO)
    vaciarCacheGoogle()
    expect(leerGoogle(CLAVE)).toBeNull()
  })
})

describe('pedirEventosGoogle', () => {
  /* Una `Response` nueva por llamada: el cuerpo sólo se puede leer una vez. */
  function stubFetch(respuesta: () => Response): ReturnType<typeof vi.fn> {
    const f = vi.fn(async () => respuesta())
    vi.stubGlobal('fetch', f)
    return f
  }

  it('manda medico_id sólo con filtro', async () => {
    const f = stubFetch(() => Response.json(CONECTADO))
    await pedirEventosGoogle('a', 'b', '')
    await pedirEventosGoogle('a', 'b', 'm1')
    expect(f.mock.calls.map(c => c[0])).toEqual([
      '/api/google/events?from=a&to=b',
      '/api/google/events?from=a&to=b&medico_id=m1',
    ])
  })

  it('un res.ok falso es fallo de Google, no caída', async () => {
    stubFetch(() => new Response('{}', { status: 401 }))
    await expect(pedirEventosGoogle('a', 'b', '')).resolves.toEqual({ estado: 'error_google', events: [] })
  })

  it('un 200 sin estado se lee como fallo de Google', async () => {
    stubFetch(() => Response.json({}))
    await expect(pedirEventosGoogle('a', 'b', '')).resolves.toEqual({ estado: 'error_google', events: [] })
  })

  it('la red caída lanza', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(pedirEventosGoogle('a', 'b', '')).rejects.toThrow('Failed to fetch')
  })
})

describe('aEventosDeCalendario', () => {
  it('día completo cuando no hay dateTime; título por omisión; no editable', () => {
    const [ev] = aEventosDeCalendario([{ id: 'x', start: { date: '2026-11-10' }, end: { date: '2026-11-11' } }])
    expect(ev).toMatchObject({ id: 'gcal-x', title: 'Evento sin título', start: '2026-11-10', end: '2026-11-11', allDay: true, editable: false })
  })
})

describe('C6 · quitarEventosImportados (sin duplicados tras el sondeo)', () => {
  const ev = (id: string): EventoGoogleC6 => ({ id, summary: id, start: { dateTime: '2031-06-06T16:00:00Z' }, end: { dateTime: '2031-06-06T17:00:00Z' } })

  it('quita los que ya son filas de Spinus y deja el resto (recurrentes incluidos)', () => {
    const lista = [ev('importado'), ev('serie_0'), ev('otro')]
    expect(quitarEventosImportados(lista, new Set(['importado'])).map((e) => e.id)).toEqual(['serie_0', 'otro'])
  })

  it('sin citas ligadas devuelve la misma lista', () => {
    const lista = [ev('a')]
    expect(quitarEventosImportados(lista, new Set())).toBe(lista)
  })
})
