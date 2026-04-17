import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface CIE10Row {
  codigo: string
  descripcion: string
}

/**
 * GET /api/cie10?q=estenosis
 *
 * Busca en el catálogo CIE-10 por código o descripción.
 * Mínimo 3 caracteres. Retorna máximo 15 resultados.
 * Usa ILIKE para tolerancia a mayúsculas/minúsculas.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (q.length < 3) {
    return NextResponse.json({ resultados: [] })
  }

  try {
    const supabase = await createClient()

    // Buscar por código (exacto o parcial) O por descripción (parcial)
    const { data, error } = await supabase
      .from('cat_cie10')
      .select('codigo, descripcion')
      .or(`codigo.ilike.%${q}%,descripcion.ilike.%${q}%`)
      .order('codigo')
      .limit(15)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const resultados: CIE10Row[] = (data ?? []).map(row => ({
      codigo: row.codigo,
      descripcion: row.descripcion,
    }))

    return NextResponse.json({ resultados })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
