import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const raw = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    // Solo letras, números, espacios y guiones — evita inyección de operadores PostgREST
    const q = raw.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ0-9 \-]/g, '').trim()

    if (q.length < 2) {
      return NextResponse.json([])
    }

    const { data, error } = await supabase
      .from('medicamentos')
      .select('nombre_comercial, principio_activo, presentacion, dosis_sugerida')
      .or(`nombre_comercial.ilike.%${q}%,principio_activo.ilike.%${q}%`)
      .limit(8)

    if (error) {
      console.error('Error buscando medicamentos:', error)
      return NextResponse.json({ error: 'Error al buscar medicamentos' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('Error inesperado en /api/medicamentos:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
