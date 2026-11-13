/**
 * POST /api/confirmar/[codigo] — la respuesta del paciente desde el enlace de
 * su cita (agenda E3): «Confirmo» o «No podré asistir».
 *
 * ⚠️ SÓLO EXPORTA POST, Y ES EL ÚNICO SITIO QUE CAMBIA EL ESTADO. Abrir el
 * enlace (GET de la página) nunca escribe: los filtros de correo y la vista
 * previa de WhatsApp abren los enlaces solos (§5 E). Un GET o HEAD aquí da 405.
 *
 * Pública y sin sesión. Orden:
 *   1. `Origin` (o, sin él, `Sec-Fetch-Site: same-origin`) del propio host: 403;
 *   2. forma del código: 404 sin tocar la base;
 *   3. `accion` ∈ {confirmar, cancelar} del formulario: 400;
 *   3-bis. seg1 (punto 8): límite por IP (30 cada hora) ANTES de la primera
 *      consulta a la base: 303 a `?r=limite`. (E3 lo ponía después del
 *      contexto para que un código inventado no dejara filas; ahora deja, a
 *      lo sumo, la de su IP, una por IP y no una por código.)
 *   4. `cita_confirmacion_contexto` (STABLE): 404 si no hay enlace vigente
 *      (revocado, apagado, suspendida, paciente cambiado, RPC ausente…);
 *   5. límite por enlace (10 cada hora): 303 a `?r=limite`;
 *   6. `cita_confirmacion_responder`: la base decide transiciones y plazos
 *      (cancelar hasta T−1h estricto) bajo sus candados, y audita con
 *      `via='enlace_paciente'`; `invalido` o un fallo: 404;
 *   7. con `confirmada`/`cancelada` y evento de Google, `after()` → Google;
 *   8. 303 a la página con `?r=<resultado>` (POST→GET: recargar no reenvía).
 *      ⚠️ `NextResponse.redirect(…, 303)`, nunca `redirect()`, que en un Route
 *      Handler responde 307 y conserva el POST (plan_E hallazgo 6).
 * El cliente de servicio sólo hace `.rpc()` (enlaceConfirmacion.ts); la
 * clínica sale del hash del código, nunca de la petición.
 */
import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { esCodigoDeEnlace } from '@/lib/reserva/secretos'
import { resolverEnlaceConfirmacion, responderEnlaceConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'
import { dentroDeLimites, ipDe, seudonimoRed } from '@/lib/reserva/limitesReserva'
import { reflejarEnGoogle } from '@/lib/confirmacion/googleConfirmacion'

export const dynamic = 'force-dynamic'

const AccionSchema = z.enum(['confirmar', 'cancelar'])
const SIN_CACHE = { 'Cache-Control': 'no-store' }

function vacia(status: number): NextResponse {
  return new NextResponse(null, { status, headers: SIN_CACHE })
}

/** ¿Viene del propio sitio? `Origin` igual al host; sin `Origin`, sólo `Sec-Fetch-Site: same-origin`. */
function mismoOrigen(req: NextRequest): boolean {
  const host = req.headers.get('host') ?? req.nextUrl.host
  const origen = req.headers.get('origin')
  if (origen === null) return req.headers.get('sec-fetch-site') === 'same-origin'
  try {
    return new URL(origen).host === host
  } catch {
    return false // `Origin: null` y cualquier otra cosa que no sea una URL
  }
}

async function accionDe(req: NextRequest): Promise<'confirmar' | 'cancelar' | null> {
  try {
    const p = AccionSchema.safeParse((await req.formData()).get('accion'))
    return p.success ? p.data : null
  } catch {
    return null
  }
}

function volver(req: NextRequest, codigo: string, resultado: string): NextResponse {
  const destino = new URL(`/confirmar/${codigo}`, req.url)
  destino.searchParams.set('r', resultado)
  return NextResponse.redirect(destino, { status: 303, headers: SIN_CACHE })
}

export async function POST(req: NextRequest, rctx: RouteContext<'/api/confirmar/[codigo]'>): Promise<NextResponse> {
  if (!mismoOrigen(req)) return vacia(403)
  const { codigo } = await rctx.params
  if (!esCodigoDeEnlace(codigo)) return vacia(404)
  const accion = await accionDe(req)
  if (!accion) return vacia(400)

  if (!(await dentroDeLimites('confirmar', { ip: seudonimoRed('ip', ipDe(req.headers)) }))) return volver(req, codigo, 'limite')
  const ctx = await resolverEnlaceConfirmacion(codigo)
  if (!ctx) return vacia(404)
  if (!(await dentroDeLimites('confirmar', { enlace: ctx.codigo_hash }))) return volver(req, codigo, 'limite')

  const r = await responderEnlaceConfirmacion(ctx, accion)
  if (!r || r.r_resultado === 'invalido') return vacia(404)
  if ((r.r_resultado === 'confirmada' || r.r_resultado === 'cancelada') && r.r_cita_id && r.r_google_event_id) {
    const cita = { clinicaId: ctx.clinica_id, citaId: r.r_cita_id, eventId: r.r_google_event_id, etag: r.r_gcal_etag }
    after(() => reflejarEnGoogle(cita))
  }
  return volver(req, codigo, r.r_resultado)
}
