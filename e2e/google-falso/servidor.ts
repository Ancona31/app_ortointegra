/**
 * e2e/google-falso/servidor.ts
 *
 * Un Google Calendar FALSO para las e2e del bloque C (sincronización en los
 * dos sentidos). Escucha SÓLO en 127.0.0.1 y lo arranca la propia prueba, en
 * su proceso; la app lo alcanza porque `src/lib/gcalFalso.ts` desvía el
 * `rootUrl` de `googleapis` hacia aquí —con la doble guarda: nunca con
 * `NODE_ENV=production` ni con una Supabase que no sea local—.
 *
 * Imita lo que Spinus usa de la API v3, con la forma de la documentación:
 *   · calendars.get;
 *   · events.list: con `singleEvents=true` (la vista de solo lectura) expande
 *     las series diarias y filtra por `timeMin`/`timeMax`; sin él (la
 *     sincronización) devuelve las series sin expandir, los borrados con
 *     `showDeleted`, y un `nextSyncToken` que con `syncToken` trae sólo lo
 *     cambiado después;
 *   · events.get / events.insert / events.patch (con `If-Match` → 412) /
 *     events.delete (deja el evento `cancelled`, como Google con el organizador).
 *
 * No es Google: no valida tokens (acepta cualquier `Authorization`), no pagina
 * y sólo entiende `RRULE:FREQ=DAILY;COUNT=n`. Lo que cada prueba necesita lo
 * escribe con `crear`, `modificar` y `borrar`, que cambian el evento «como si
 * lo hubieran tocado en Google» (nuevo `etag` y `updated`).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface EventoFalso {
  id: string
  etag: string
  status: 'confirmed' | 'cancelled'
  updated: string
  summary?: string
  description?: string
  start?: { dateTime?: string | null; date?: string | null; timeZone?: string | null }
  end?: { dateTime?: string | null; date?: string | null; timeZone?: string | null }
  recurrence?: string[]
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> }
  colorId?: string
  attendees?: Array<Record<string, unknown>>
  [otro: string]: unknown
}

export interface Peticion { metodo: string; ruta: string; ifMatch: string | null; cuerpo: Record<string, unknown> | null }

export interface GoogleFalso {
  url: string
  eventos: Map<string, EventoFalso>
  peticiones: Peticion[]
  /** Crea un evento como si se hubiera creado en Google. */
  crear: (e: Omit<EventoFalso, 'id' | 'etag' | 'updated' | 'status'> & { id?: string }) => EventoFalso
  /** Lo cambia como si lo hubieran editado en Google (nuevo etag y updated). */
  modificar: (id: string, cambios: Partial<EventoFalso>) => EventoFalso
  /** Lo borra como Google: queda `cancelled`. */
  borrar: (id: string) => void
  cerrar: () => Promise<void>
}

let secuencia = 0
const CALENDARIO = 'cal-spinus-falso@group.calendar.google.com'

function sellar(e: EventoFalso, cambios: Partial<EventoFalso>, marcas: Map<string, number>): EventoFalso {
  secuencia += 1
  const nuevo: EventoFalso = { ...e, ...cambios, etag: `"falso-${secuencia}"`, updated: new Date().toISOString() }
  marcas.set(nuevo.id, secuencia)
  return nuevo
}

/** `patch` de Google: fusiona objetos y reemplaza arrays; un `null` borra la clave. */
function fusionar(base: Record<string, unknown>, parche: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(parche)) {
    if (v === null) delete r[k]
    else if (typeof v === 'object' && !Array.isArray(v) && typeof r[k] === 'object' && r[k] !== null && !Array.isArray(r[k])) {
      r[k] = fusionar(r[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else r[k] = v
  }
  return r
}

/** Instancias de una serie diaria, para la vista con `singleEvents`. */
function expandir(e: EventoFalso): EventoFalso[] {
  const regla = e.recurrence?.[0]?.match(/FREQ=DAILY;COUNT=(\d+)/)
  if (!regla || !e.start?.dateTime || !e.end?.dateTime) return [e]
  const ini = Date.parse(e.start.dateTime)
  const dur = Date.parse(e.end.dateTime) - ini
  return Array.from({ length: Number(regla[1]) }, (_, i) => {
    const s = new Date(ini + i * 86_400_000).toISOString()
    return {
      ...e, id: `${e.id}_${i}`, recurringEventId: e.id, recurrence: undefined,
      start: { dateTime: s }, end: { dateTime: new Date(Date.parse(s) + dur).toISOString() },
    }
  })
}

function enVentana(e: EventoFalso, desde: string | null, hasta: string | null): boolean {
  const ini = Date.parse(e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`)
  const fin = Date.parse(e.end?.dateTime ?? `${e.end?.date}T00:00:00Z`)
  return (!hasta || ini < Date.parse(hasta)) && (!desde || fin > Date.parse(desde))
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
  res.writeHead(estado, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(cuerpo))
}

async function leerCuerpo(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const trozos: Buffer[] = []
  for await (const t of req) trozos.push(t as Buffer)
  const texto = Buffer.concat(trozos).toString('utf8')
  return texto ? JSON.parse(texto) as Record<string, unknown> : null
}

function listar(g: GoogleFalso, marcas: Map<string, number>, q: URLSearchParams): unknown {
  const sync = q.get('syncToken')
  if (q.get('singleEvents') === 'true') {
    const items = [...g.eventos.values()].filter((e) => e.status !== 'cancelled')
      .flatMap(expandir).filter((e) => enVentana(e, q.get('timeMin'), q.get('timeMax')))
    return { kind: 'calendar#events', timeZone: 'America/Merida', items }
  }
  const desde = sync ? Number(sync.replace('tok-', '')) : -1
  const items = [...g.eventos.values()].filter((e) => (marcas.get(e.id) ?? 0) > desde)
    .filter((e) => sync || e.status !== 'cancelled' || q.get('showDeleted') === 'true')
  return { kind: 'calendar#events', timeZone: 'America/Merida', items, nextSyncToken: `tok-${secuencia}` }
}

function atender(g: GoogleFalso, marcas: Map<string, number>, metodo: string, partes: string[], q: URLSearchParams, cuerpo: Record<string, unknown> | null, ifMatch: string | null): [number, unknown] {
  // partes: ['calendars', cal, 'events', id?]
  if (partes[0] !== 'calendars' || !partes[1]) return [404, { error: { code: 404, message: 'Not Found' } }]
  if (partes.length === 2) return [200, { id: decodeURIComponent(partes[1]), summary: 'Spinus' }]
  if (partes[2] !== 'events') return [404, { error: { code: 404, message: 'Not Found' } }]
  const id = partes[3] ? decodeURIComponent(partes[3]) : null
  if (!id && metodo === 'GET') return [200, listar(g, marcas, q)]
  if (!id && metodo === 'POST') {
    const nuevo = sellar({ id: `falso${secuencia + 1}x`, status: 'confirmed', etag: '', updated: '', ...(cuerpo ?? {}) } as EventoFalso, {}, marcas)
    g.eventos.set(nuevo.id, nuevo)
    return [200, nuevo]
  }
  const e = id ? g.eventos.get(id) : undefined
  if (!e) return [404, { error: { code: 404, message: 'Not Found' } }]
  if (ifMatch && ifMatch !== e.etag) return [412, { error: { code: 412, message: 'Precondition Failed' } }]
  if (metodo === 'GET') return [200, e]
  if (metodo === 'PATCH' || metodo === 'PUT') {
    const nuevo = sellar(fusionar(e, cuerpo ?? {}) as EventoFalso, {}, marcas)
    g.eventos.set(nuevo.id, nuevo)
    return [200, nuevo]
  }
  if (metodo === 'DELETE') {
    g.eventos.set(e.id, sellar(e, { status: 'cancelled' }, marcas))
    return [204, null]
  }
  return [405, { error: { code: 405, message: 'Method Not Allowed' } }]
}

/** Arranca el Google falso en 127.0.0.1 (puerto libre si no se da). */
export async function arrancarGoogleFalso(puerto = 0): Promise<GoogleFalso> {
  const marcas = new Map<string, number>()
  const g: GoogleFalso = {
    url: '', eventos: new Map(), peticiones: [],
    crear: (datos) => {
      const id = datos.id ?? `google${secuencia + 1}`
      const e = sellar({ ...datos, id, status: 'confirmed', etag: '', updated: '' }, {}, marcas)
      g.eventos.set(id, e)
      return e
    },
    modificar: (id, cambios) => {
      const e = g.eventos.get(id)
      if (!e) throw new Error(`google falso: no existe ${id}`)
      const nuevo = sellar(e, cambios, marcas)
      g.eventos.set(id, nuevo)
      return nuevo
    },
    borrar: (id) => { g.modificar(id, { status: 'cancelled' }) },
    cerrar: async () => { await new Promise<void>((ok) => servidor.close(() => ok())) },
  }
  const servidor: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const partes = url.pathname.replace(/^\/calendar\/v3\//, '').split('/').filter(Boolean)
      const cuerpo = await leerCuerpo(req)
      const ifMatch = typeof req.headers['if-match'] === 'string' ? req.headers['if-match'] : null
      g.peticiones.push({ metodo: req.method ?? 'GET', ruta: url.pathname + url.search, ifMatch, cuerpo })
      const [estado, salida] = atender(g, marcas, req.method ?? 'GET', partes, url.searchParams, cuerpo, ifMatch)
      if (estado === 204) { res.writeHead(204); res.end(); return }
      responder(res, estado, salida)
    })().catch((err: unknown) => responder(res, 500, { error: { code: 500, message: String(err) } }))
  })
  await new Promise<void>((ok) => servidor.listen(puerto, '127.0.0.1', () => ok()))
  g.url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/`
  return g
}

export { CALENDARIO }
