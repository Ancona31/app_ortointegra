import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { canManageClinica } from '@/lib/permissions'

/**
 * PUT /api/admin/paciente/[id]/rectificar — Derecho de Rectificación (ARCO)
 *
 * LFPDPPP Art. 31: El titular puede solicitar la corrección de sus datos
 * personales cuando sean inexactos o incompletos.
 *
 * Solo permite corregir datos personales (nombre, fecha_nacimiento, email,
 * teléfono, dirección, sexo). Los datos clínicos NO son rectificables
 * por esta vía — para eso existen los addendums.
 *
 * Solo accesible por admin de la misma clínica.
 */

const CAMPOS_PERMITIDOS = [
  'nombre', 'apellidos', 'fecha_nacimiento', 'sexo',
  'email', 'telefono', 'direccion',
]

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/admin/paciente/[id]/rectificar'>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role, es_admin_de_clinica')
      .eq('id', user.id)
      .single()

    if (!profile?.clinica_id || !canManageClinica(profile)) {
      return NextResponse.json({ error: 'Solo administradores pueden rectificar datos' }, { status: 403 })
    }

    const { id } = await ctx.params
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const body = await req.json()

    // Verificar que el paciente pertenece a la clínica (RLS)
    const { data: pacienteActual } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .single()
    if (!pacienteActual) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Filtrar solo campos permitidos
    const updates: Record<string, unknown> = {}
    const cambios: string[] = []

    for (const campo of CAMPOS_PERMITIDOS) {
      if (campo in body && body[campo] !== pacienteActual[campo]) {
        updates[campo] = body[campo] ?? null
        cambios.push(`${campo}: "${pacienteActual[campo] ?? ''}" → "${body[campo] ?? ''}"`)
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pacientes')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Registrar cada campo rectificado en audit_log
    logAudit({
      userId: user.id,
      accion: 'arco_rectificacion',
      tabla: 'pacientes',
      registroId: id,
      ip,
      descripcion: `Rectificación ARCO: ${cambios.join('; ')}`,
    })

    return NextResponse.json({ ok: true, cambios })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
