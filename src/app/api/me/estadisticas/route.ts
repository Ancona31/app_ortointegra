import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { differenceInYears, parseISO } from 'date-fns'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hace6meses = new Date()
  hace6meses.setMonth(hace6meses.getMonth() - 5)
  hace6meses.setDate(1)
  hace6meses.setHours(0, 0, 0, 0)

  const [
    { data: consultas },
    { data: todasConsultas },
    { data: recetas },
    { data: pacientes },
  ] = await Promise.all([
    supabase
      .from('consultas')
      .select('diagnosticos, fecha, pacientes!inner(id)')
      .gte('fecha', hace6meses.toISOString()),
    supabase
      .from('consultas')
      .select('diagnosticos, pacientes!inner(id)')
      .limit(2000),
    supabase
      .from('documentos')
      .select('contenido, pacientes!inner(id)')
      .eq('tipo', 'receta')
      .limit(2000),
    supabase
      .from('pacientes')
      .select('fecha_nacimiento, sexo')
      .limit(5000),
  ])

  // 1. Consultas por mes (últimos 6 meses)
  const mesesMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    mesesMap[key] = 0
  }
  for (const c of (consultas || [])) {
    const d = new Date(c.fecha)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (key in mesesMap) mesesMap[key]++
  }
  const consultasPorMes = Object.entries(mesesMap).map(([mes, total]) => {
    const [year, month] = mes.split('-')
    const label = new Date(parseInt(year), parseInt(month) - 1)
      .toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
      .replace('.', '')
    return { mes: label, total }
  })

  // 2. Top diagnósticos (histórico completo)
  const diagCount: Record<string, number> = {}
  for (const c of (todasConsultas || [])) {
    const diags = (c.diagnosticos as Array<{ codigo_cie10?: string; descripcion?: string }>) || []
    for (const d of diags) {
      if (d.descripcion?.trim()) {
        const key = d.descripcion.trim()
        diagCount[key] = (diagCount[key] || 0) + 1
      }
    }
  }
  const topDiagnosticos = Object.entries(diagCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([nombre, total]) => ({ nombre, total }))

  // 3. Medicamentos más recetados
  const medCount: Record<string, number> = {}
  for (const r of (recetas || [])) {
    const meds = ((r.contenido as any)?.medicamentos as Array<{ nombre_comercial?: string }>) || []
    for (const m of meds) {
      const nombre = m.nombre_comercial?.trim()
      if (nombre) medCount[nombre] = (medCount[nombre] || 0) + 1
    }
  }
  const topMedicamentos = Object.entries(medCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([nombre, total]) => ({ nombre, total }))

  // 4. Distribución por sexo
  const sexoCount = { M: 0, F: 0, Otro: 0 }
  for (const p of (pacientes || [])) {
    if (p.sexo === 'M') sexoCount.M++
    else if (p.sexo === 'F') sexoCount.F++
    else if (p.sexo) sexoCount.Otro++
  }
  const distribucionSexo = [
    { nombre: 'Masculino', total: sexoCount.M, color: '#3b82f6' },
    { nombre: 'Femenino', total: sexoCount.F, color: '#ec4899' },
    ...(sexoCount.Otro > 0 ? [{ nombre: 'Otro', total: sexoCount.Otro, color: '#8b5cf6' }] : []),
  ]

  // 5. Distribución por edad
  const edadRanges: Record<string, number> = {
    '0–17': 0, '18–30': 0, '31–45': 0, '46–60': 0, '61–75': 0, '76+': 0,
  }
  const hoy = new Date()
  for (const p of (pacientes || [])) {
    if (!p.fecha_nacimiento) continue
    const edad = differenceInYears(hoy, parseISO(p.fecha_nacimiento))
    if (edad <= 17) edadRanges['0–17']++
    else if (edad <= 30) edadRanges['18–30']++
    else if (edad <= 45) edadRanges['31–45']++
    else if (edad <= 60) edadRanges['46–60']++
    else if (edad <= 75) edadRanges['61–75']++
    else edadRanges['76+']++
  }
  const distribucionEdad = Object.entries(edadRanges).map(([rango, total]) => ({ rango, total }))

  return NextResponse.json({
    consultasPorMes,
    topDiagnosticos,
    topMedicamentos,
    distribucionSexo,
    distribucionEdad,
  })
}
