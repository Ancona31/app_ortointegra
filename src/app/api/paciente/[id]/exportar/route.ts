import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { MedicionAnalito, AnalitoCatalogo } from '@/types'

/**
 * POST /api/paciente/[id]/exportar — Derecho de Acceso (ARCO)
 *
 * LFPDPPP Art. 28: El titular tiene derecho a acceder a sus datos personales.
 * Genera un JSON con TODOS los datos del paciente: datos personales,
 * consultas con addendums, mediciones (con analito del catálogo embebido),
 * documentos y recetas.
 *
 * Accesible por médicos y admins de la misma clínica.
 */
type MedicionConAnalito = MedicionAnalito & {
  analito: AnalitoCatalogo | null
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/paciente/[id]/exportar'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role')
      .eq('id', user.id)
      .single()
    if (!profile?.clinica_id) return NextResponse.json({ error: 'Sin clínica' }, { status: 403 })

    const { id } = await ctx.params
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // Verificar que el paciente pertenece a la clínica (RLS)
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .single()
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Cargar todos los datos clínicos en paralelo
    const [
      { data: consultas },
      { data: mediciones },
      { data: documentos },
      { data: addendums },
    ] = await Promise.all([
      supabase.from('consultas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
      supabase
        .from('mediciones_analitos')
        .select('*, analito:analitos_catalogo(*)')
        .eq('paciente_id', id)
        .order('medido_en', { ascending: false }),
      supabase.from('documentos').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
      supabase.from('addendums').select('*').order('created_at', { ascending: true }),
    ])

    // Vincular addendums a sus consultas
    const consultaIds = new Set((consultas ?? []).map(c => c.id))
    const allAddendums = addendums ?? []
    const addendumsPorConsulta: Record<string, typeof allAddendums> = {}
    for (const a of allAddendums) {
      if (consultaIds.has(a.consulta_id)) {
        if (!addendumsPorConsulta[a.consulta_id]) addendumsPorConsulta[a.consulta_id] = []
        addendumsPorConsulta[a.consulta_id]!.push(a)
      }
    }

    const consultasConAddendums = (consultas ?? []).map(c => ({
      ...c,
      addendums: addendumsPorConsulta[c.id] ?? [],
    }))

    const expediente = {
      exportado_en: new Date().toISOString(),
      version: 'v1.1',
      derecho_arco: 'ACCESO',
      paciente,
      consultas: consultasConAddendums,
      mediciones: (mediciones ?? []) as MedicionConAnalito[],
      documentos: documentos ?? [],
    }

    // Registrar en audit_log
    logAudit({
      userId: user.id,
      accion: 'arco_acceso',
      tabla: 'pacientes',
      registroId: id,
      ip,
      descripcion: 'Exportación completa de expediente (Derecho de Acceso ARCO)',
    })

    return NextResponse.json(expediente)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
