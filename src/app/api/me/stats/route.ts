import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Total pacientes del médico
  const { count: totalPacientes } = await supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })
    .eq('medico_id', user.id)

  // IDs de pacientes del médico (para joins)
  const { data: pacientesData } = await supabase
    .from('pacientes')
    .select('id')
    .eq('medico_id', user.id)

  const pacienteIds = (pacientesData || []).map(p => p.id)

  let consultasMes = 0
  let ultimaConsulta: { created_at: string; motivo_consulta: string; paciente_nombre?: string } | null = null
  let docsTotal = 0

  if (pacienteIds.length > 0) {
    // Consultas este mes
    const { count: cMes } = await supabase
      .from('consultas')
      .select('id', { count: 'exact', head: true })
      .in('paciente_id', pacienteIds)
      .gte('created_at', startOfMonth.toISOString())
    consultasMes = cMes || 0

    // Última consulta
    const { data: ultimaData } = await supabase
      .from('consultas')
      .select('created_at, motivo_consulta, paciente_id')
      .in('paciente_id', pacienteIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (ultimaData) {
      // Buscar nombre del paciente
      const { data: pac } = await supabase
        .from('pacientes')
        .select('nombre, apellidos')
        .eq('id', ultimaData.paciente_id)
        .single()
      ultimaConsulta = {
        created_at: ultimaData.created_at,
        motivo_consulta: ultimaData.motivo_consulta,
        paciente_nombre: pac ? `${pac.nombre} ${pac.apellidos}` : undefined,
      }
    }

    // Documentos generados total
    const { count: dTotal } = await supabase
      .from('documentos')
      .select('id', { count: 'exact', head: true })
      .in('paciente_id', pacienteIds)
    docsTotal = dTotal || 0
  }

  return NextResponse.json({
    total_pacientes: totalPacientes || 0,
    consultas_este_mes: consultasMes,
    documentos_total: docsTotal,
    ultima_consulta: ultimaConsulta,
  })
}
