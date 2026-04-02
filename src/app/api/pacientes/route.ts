import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    const admin = createAdminClient()

    // ── Generar número de expediente ──────────────────────────────
    const year = new Date().getFullYear()
    const prefix = `EXP-${year}-`

    const { data: ultimo } = await admin
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
      || (profile.role === 'medico' ? profile.id : null)

    // ── Insertar paciente ─────────────────────────────────────────
    const { data: nuevo, error } = await admin
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
      })
      .select('id, numero_expediente')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: nuevo.id, numero_expediente: nuevo.numero_expediente })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
