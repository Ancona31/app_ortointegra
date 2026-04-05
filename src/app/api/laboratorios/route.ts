import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* ── POST /api/laboratorios — crear laboratorio ────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id, role')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const body = await req.json()
    const { paciente_id, fecha_toma, valores, resultados, analisis_ia } = body
    if (!paciente_id) return NextResponse.json({ error: 'paciente_id requerido' }, { status: 400 })

    const admin = createAdminClient()

    // Verificar que el paciente pertenece a la clínica
    const { data: paciente } = await admin
      .from('pacientes')
      .select('id')
      .eq('id', paciente_id)
      .eq('clinica_id', profile.clinica_id)
      .single()
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const { data: lab, error } = await admin.from('laboratorios').insert({
      paciente_id,
      fecha_toma: fecha_toma || null,
      valores: valores || null,
      resultados: resultados || null,
      analisis_ia: analisis_ia || null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ laboratorio: lab })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
