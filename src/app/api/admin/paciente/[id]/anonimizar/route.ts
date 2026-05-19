import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { canManageClinica } from '@/lib/permissions'

/**
 * POST /api/admin/paciente/[id]/anonimizar — Derecho de Cancelación (ARCO)
 *
 * LFPDPPP Art. 33: El titular puede solicitar la cancelación de sus datos.
 * En datos de salud, no se borran físicamente (NOM-004 exige retención
 * de 5 años). En su lugar, se anonimizan: el nombre se reemplaza por un
 * identificador genérico, y se borran email, teléfono y dirección.
 *
 * Los datos clínicos permanecen intactos pero dejan de ser vinculables
 * a una persona identificable.
 *
 * Solo accesible por admin de la misma clínica.
 * Requiere confirmación explícita (confirmar: true en el body).
 */
export async function POST(req: NextRequest, ctx: RouteContext<'/api/admin/paciente/[id]/anonimizar'>) {
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
      return NextResponse.json({ error: 'Solo administradores pueden anonimizar datos' }, { status: 403 })
    }

    const { id } = await ctx.params
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { confirmar } = await req.json()

    if (confirmar !== true) {
      return NextResponse.json(
        { error: 'Se requiere confirmación explícita. Envíe { "confirmar": true } en el body.' },
        { status: 400 }
      )
    }

    // Verificar que el paciente existe y pertenece a la clínica (RLS)
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id, nombre, apellidos, email, telefono')
      .eq('id', id)
      .single()
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Verificar que no esté ya anonimizado
    if (paciente.nombre?.startsWith('PACIENTE-ANONIMIZADO')) {
      return NextResponse.json({ error: 'Este paciente ya fue anonimizado' }, { status: 400 })
    }

    const idCorto = id.slice(0, 8)

    const { error } = await supabase
      .from('pacientes')
      .update({
        nombre: `PACIENTE-ANONIMIZADO-${idCorto}`,
        apellidos: '',
        email: null,
        telefono: null,
        direccion: null,
        activo: false,
        fecha_baja: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Registrar anonimización en audit_log con datos anteriores
    logAudit({
      userId: user.id,
      accion: 'arco_cancelacion',
      tabla: 'pacientes',
      registroId: id,
      ip,
      descripcion: `Anonimización ARCO: nombre="${paciente.nombre} ${paciente.apellidos}", email/tel/dirección eliminados. Datos clínicos preservados.`,
    })

    return NextResponse.json({
      ok: true,
      mensaje: 'Paciente anonimizado. Los datos clínicos se conservan pero ya no son vinculables a una persona identificable.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
