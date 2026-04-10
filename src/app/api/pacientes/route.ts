import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role, id')
      .eq('id', user.id)
      .single()

    if (!profile?.clinica_id) {
      return NextResponse.json({ error: 'Sin clínica asignada' }, { status: 403 })
    }

    const body = await req.json()

    // ── Verificar límite de pacientes (cuenta todos, incluso inactivos) ──
    const { data: clinica } = await supabase
      .from('clinicas')
      .select('max_pacientes')
      .eq('id', profile.clinica_id)
      .single()

    if (clinica?.max_pacientes && clinica.max_pacientes > 0) {
      const { count } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', profile.clinica_id)
      if ((count ?? 0) >= clinica.max_pacientes) {
        return NextResponse.json(
          { error: `Has alcanzado el límite de ${clinica.max_pacientes} pacientes de tu plan. Actualiza tu plan para continuar.` },
          { status: 403 }
        )
      }
    }

    // ── Generar número de expediente ──────────────────────────────
    const year = new Date().getFullYear()
    const prefix = `EXP-${year}-`

    const { data: ultimo } = await supabase
      .from('pacientes')
      .select('numero_expediente')
      .eq('clinica_id', profile.clinica_id)
      .like('numero_expediente', `${prefix}%`)
      .order('numero_expediente', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextNum = 1
    if (ultimo?.numero_expediente) {
      const parsed = parseInt(ultimo.numero_expediente.replace(prefix, ''), 10)
      if (!isNaN(parsed)) nextNum = parsed + 1
    }

    const numero_expediente = `${prefix}${String(nextNum).padStart(4, '0')}`

    // ── Determinar medico_id ──────────────────────────────────────
    const medico_id = body.medico_id
      || (['medico', 'admin', 'super_admin'].includes(profile.role) ? profile.id : null)

    // ── LFPDPPP Art. 9: consentimiento expreso para datos sensibles de salud ──
    if (!body.consentimiento_otorgado) {
      return NextResponse.json({ error: 'Se requiere el consentimiento del aviso de privacidad' }, { status: 400 })
    }

    // ── Insertar paciente ─────────────────────────────────────────
    const { data: nuevo, error } = await supabase
      .from('pacientes')
      .insert({
        nombre:                body.nombre,
        apellidos:             body.apellidos,
        fecha_nacimiento:      body.fecha_nacimiento || null,
        sexo:                  body.sexo || null,
        peso_kg:               body.peso_kg ?? null,
        talla_cm:              body.talla_cm ?? null,
        imc:                   body.imc ?? null,
        telefono:              body.telefono || null,
        email:                 body.email || null,
        direccion:             body.direccion || null,
        ant_patologicos:       body.ant_patologicos || null,
        ant_quirurgicos:       body.ant_quirurgicos || null,
        ant_familiares:        body.ant_familiares || null,
        alergias:              body.alergias || null,
        medicamentos_actuales: body.medicamentos_actuales || null,
        clinica_id:            profile.clinica_id,
        medico_id,
        numero_expediente,
        consentimiento_otorgado: true,
        fecha_consentimiento: new Date().toISOString(),
        version_aviso_privacidad: 'v1.0-2026-04-08',
      })
      .select('id, numero_expediente')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: nuevo.id, numero_expediente: nuevo.numero_expediente })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
