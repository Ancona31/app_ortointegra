/**
 * GET /api/agenda/respuestas?cita=<uuid> — la última respuesta del paciente
 * por el enlace de confirmación de una cita (agenda E8): `{ respuesta,
 * respondido_en }` (`confirmo` | `cancelo` | null). La pide la agenda abierta
 * SÓLO cuando el canal de tiempo real trae una cancelación ajena de una cita
 * pintada, para decidir si avisa «Un paciente canceló…».
 *
 * Puertas: `entradaGestion()` (401 / 403 / 404 con el interruptor apagado).
 * Cliente de SESIÓN: la RLS de `cita_confirmaciones` (E1: 7 columnas, sólo
 * los enlaces de las citas que quien pregunta ya ve) decide, con `clinica_id`
 * explícito. Sin la tabla (E1 sin aplicar): `{ respuesta: null }`.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { entradaGestion } from '@/lib/reserva/gestionServidor'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const
const AUSENTE = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])
const Fila = z.object({ respuesta: z.enum(['confirmo', 'cancelo']).nullable(), respondido_en: z.string().nullable() })

export async function GET(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  const citaId = req.nextUrl.searchParams.get('cita') ?? ''
  if (!z.guid().safeParse(citaId).success) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
  try {
    const { data, error } = await e.supabase.from('cita_confirmaciones').select('respuesta, respondido_en')
      .eq('appointment_id', citaId).eq('clinica_id', e.clinicaId).not('respondido_en', 'is', null)
      .order('respondido_en', { ascending: false }).limit(1)
    if (error) {
      if (error.code && AUSENTE.has(error.code)) return NextResponse.json({ respuesta: null, respondido_en: null }, { headers: SIN_CACHE })
      logger.error('agenda', `respuesta del paciente sin leer: ${error.code ?? ''}`)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    const fila = z.array(Fila).parse(data ?? [])[0]
    return NextResponse.json({ respuesta: fila?.respuesta ?? null, respondido_en: fila?.respondido_en ?? null }, { headers: SIN_CACHE })
  } catch {
    logger.error('agenda', 'GET respuestas: forma inesperada o fallo')
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
