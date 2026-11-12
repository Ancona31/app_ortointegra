/**
 * Lectura de Mailpit (el buzón LOCAL de Supabase, `config.toml` [local_smtp],
 * puerto 54324) para las e2e de la reserva por enlace (agenda D10). Sólo
 * lectura y sólo loopback: nunca se llama a `/release` ni se borra el buzón
 * (otras pruebas o personas pueden estar usándolo); cada prueba busca por un
 * destinatario único suyo.
 *
 * API: `GET /api/v1/search?query=` y `GET /api/v1/message/{ID}`
 * (verificado en `/api/v1/swagger.json` de Mailpit v1.30, plan_D.md §0.6).
 */
const MAILPIT = 'http://127.0.0.1:54324'

export interface CorreoCapturado { id: string; asunto: string; texto: string; html: string }

interface Resumen { ID: string; Subject: string; Created: string }

function esResumen(x: unknown): x is Resumen {
  return typeof x === 'object' && x !== null && 'ID' in x && 'Subject' in x && 'Created' in x
    && typeof x.ID === 'string' && typeof x.Subject === 'string' && typeof x.Created === 'string'
}

async function buscar(para: string, asunto: string): Promise<Resumen[]> {
  const q = encodeURIComponent(`to:"${para}" subject:"${asunto}"`)
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${q}`)
  if (!r.ok) throw new Error(`Mailpit search ${r.status}`)
  const datos: unknown = await r.json()
  const lista = typeof datos === 'object' && datos !== null && 'messages' in datos && Array.isArray(datos.messages) ? datos.messages : []
  return lista.filter(esResumen).sort((a, b) => b.Created.localeCompare(a.Created))
}

async function leer(id: string): Promise<CorreoCapturado> {
  const r = await fetch(`${MAILPIT}/api/v1/message/${encodeURIComponent(id)}`)
  if (!r.ok) throw new Error(`Mailpit message ${r.status}`)
  const m: unknown = await r.json()
  const campo = (k: string): string => (typeof m === 'object' && m !== null && k in m ? String(Reflect.get(m, k) ?? '') : '')
  return { id, asunto: campo('Subject'), texto: campo('Text'), html: campo('HTML') }
}

/** Cuántos correos hay ya para ese destinatario con ese asunto (para esperar uno NUEVO). */
export async function contarCorreos(para: string, asunto: string): Promise<number> {
  return (await buscar(para, asunto)).length
}

/**
 * Espera (sondeo cada 200 ms, hasta `ms`) a que haya MÁS de `previos`
 * correos para `para` con `asunto` dentro, y devuelve el más reciente.
 */
export async function esperarCorreo(para: string, asunto: string, previos = 0, ms = 8000): Promise<CorreoCapturado> {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    const lista = await buscar(para, asunto)
    if (lista.length > previos && lista[0]) return leer(lista[0].ID)
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`No llegó a Mailpit un correo «${asunto}» para ${para} en ${ms} ms`)
}

/** El código de 6 dígitos de un correo. */
export function codigoDe(texto: string): string {
  const m = /\b(\d{6})\b/.exec(texto)
  if (!m?.[1]) throw new Error('El correo no trae un código de 6 dígitos')
  return m[1]
}
