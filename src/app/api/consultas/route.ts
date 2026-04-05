import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* ── POST /api/consultas — crear nota médica ───────────── */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinica_id, role, nombre, titulo, especialidad, cedula_profesional, cedula_especialidad')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const body = await req.json()
    const { paciente_id } = body
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

    // Obtener info del médico (logo desde clinica)
    const { data: clinica } = await admin
      .from('clinicas')
      .select('logo_url')
      .eq('id', profile.clinica_id)
      .single()

    // Fecha del servidor — no del cliente
    const { data: consulta, error } = await admin.from('consultas').insert({
      paciente_id,
      fecha: new Date().toISOString(),
      motivo_consulta:           body.motivo_consulta || null,
      exploracion_fisica:        body.exploracion_fisica || null,
      diagnosticos:              body.diagnosticos || null,
      plan_tratamiento:          body.plan_tratamiento || null,
      notas_evolucion:           body.notas_evolucion || null,
      proxima_cita:              body.proxima_cita || null,
      medicamentos:              body.medicamentos || null,
      medico_nombre:             `${profile.titulo || ''} ${profile.nombre || ''}`.trim() || null,
      medico_especialidad:       profile.especialidad || null,
      medico_cedula_profesional: profile.cedula_profesional || null,
      medico_cedula_especialidad: profile.cedula_especialidad || null,
      medico_logo_url:           clinica?.logo_url || null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ consulta })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
