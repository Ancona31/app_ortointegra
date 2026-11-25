/**
 * /api/avisos — los «Avisos» de la clínica (tanda I, punto 19 de Angel).
 *
 *   GET   → `{ avisos, avisos_disponibles }`: los sin revisar, los más nuevos
 *           primero (`leerAvisosClinica`). En la agenda NO se pide: viajan en
 *           la respuesta de «Por confirmar», que ya se pedía (cero peticiones
 *           de más al abrir). Es la puerta para montar la lista en otra página.
 *   PATCH → `{ ids: uuid[] }`: marca revisados SÓLO esos (los que la persona
 *           tenía a la vista; nunca «todos los de la clínica»).
 *
 * Puertas: `entradaGestion()` (sesión, clínica, interruptor de la v2: 401 /
 * 403 / 404). Cliente de SESIÓN y `clinica_id` explícito; la RLS de la tabla
 * decide qué avisos ve y revisa cada quien.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { entradaGestion } from '@/lib/reserva/gestionServidor'
import { leerAvisosClinica, marcarAvisosRevisados, TOPE_AVISOS } from '@/lib/avisos/avisosServidor'

export const dynamic = 'force-dynamic'

const Revisar = z.strictObject({ ids: z.array(z.string().uuid()).min(1).max(TOPE_AVISOS) })

export async function GET(): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  const r = await leerAvisosClinica(e.supabase, e.clinicaId)
  return NextResponse.json({ avisos: r.avisos, avisos_disponibles: r.disponible, avisos_mas_antiguos: r.mas_antiguos === true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  const cuerpo = Revisar.safeParse(await req.json().catch(() => null))
  if (!cuerpo.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const r = await marcarAvisosRevisados(e.supabase, e.clinicaId, e.perfil.id, cuerpo.data.ids)
  if (!r.ok) return NextResponse.json({ error: r.motivo }, { status: r.motivo === 'no_disponible' ? 503 : 500 })
  return NextResponse.json({ revisados: r.revisados })
}
