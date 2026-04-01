import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkIpRateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limited = await checkIpRateLimit(ip, 'verificar-receta', 30)
  if (limited) return limited

  const { folio } = await params
  if (!folio) return NextResponse.json({ error: 'Folio requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('documentos')
    .select('contenido, created_at')
    .eq('tipo', 'receta')
    .filter('contenido->>folio', 'eq', folio)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })

  return NextResponse.json({ receta: data.contenido, emitida: data.created_at })
}
