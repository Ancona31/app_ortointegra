import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ folio: string }> }) {
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
