import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Total pacientes visibles para este usuario (RLS se encarga del filtro por clínica/médico)
  const { count: totalPacientes } = await supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })

  // IDs de pacientes visibles (RLS, sin límite de 1000 — paginamos de ser necesario)
  const { data: pacientesData } = await supabase
    .from('pacientes')
    .select('id')
    .limit(5000)

  const pacienteIds = (pacientesData || []).map(p => p.id)

  let consultasMes = 0
  let ultimaConsulta: { created_at: string; motivo_consulta: string; paciente_nombre?: string } | null = null
  let docsTotal = 0

  if (pacienteIds.length > 0) {
    // Consultas este mes — usando join con pacientes para evitar límite del IN
    const { count: cMes } = await supabase
      .from('consultas')
      .select('id, pacientes!inner(id)', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString())
    consultasMes = cMes || 0

    // Última consulta con nombre del paciente via join (solo pacientes accesibles por RLS)
    const { data: ultimaData } = await supabase
      .from('consultas')
      .select('created_at, motivo_consulta, paciente_id, pacientes!inner(nombre, apellidos)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ultimaData) {
      const pacRaw = ultimaData.pacientes as unknown
      const pac = (Array.isArray(pacRaw) ? pacRaw[0] : pacRaw) as { nombre: string; apellidos: string } | null
      ultimaConsulta = {
        created_at: ultimaData.created_at,
        motivo_consulta: ultimaData.motivo_consulta,
        paciente_nombre: pac ? `${pac.nombre} ${pac.apellidos}` : undefined,
      }
    }

    // Documentos generados total — join con pacientes
    const { count: dTotal } = await supabase
      .from('documentos')
      .select('id, pacientes!inner(id)', { count: 'exact', head: true })
    docsTotal = dTotal || 0
  }

  return NextResponse.json({
    total_pacientes: totalPacientes || 0,
    consultas_este_mes: consultasMes,
    documentos_total: docsTotal,
    ultima_consulta: ultimaConsulta,
  })
}
