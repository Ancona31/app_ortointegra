import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const en14dias = new Date()
  en14dias.setDate(en14dias.getDate() + 14)

  const { data } = await supabase
    .from('consultas')
    .select('id, proxima_cita, motivo_consulta, paciente_id, pacientes!inner(id, nombre, apellidos)')
    .not('proxima_cita', 'is', null)
    .lte('proxima_cita', en14dias.toISOString())
    .order('proxima_cita', { ascending: true })
    .limit(20)

  const seguimientos = (data || []).map((c: any) => {
    const pac = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes
    return {
      consulta_id: c.id,
      paciente_id: c.paciente_id,
      paciente_nombre: pac ? `${pac.nombre} ${pac.apellidos}` : 'Paciente',
      proxima_cita: c.proxima_cita,
      motivo_consulta: c.motivo_consulta,
    }
  })

  return NextResponse.json({ seguimientos })
}
