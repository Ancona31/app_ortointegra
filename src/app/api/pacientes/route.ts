import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMedico } from '@/lib/permissions'
import type { DuplicatePatientResponse } from '@/types'

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

    // ── Gate Fase 8.1: bloquear creación si la clínica está cancelada,
    //    no es VIP y ya tiene >5 pacientes activos (ex-cliente pagado).
    //    Free de buena fe (≤5 pacientes) NO se ve afectado. ──
    const { data: clinicaSub } = await supabase
      .from('clinicas')
      .select('suscripcion_estado, es_vip_grant')
      .eq('id', profile.clinica_id)
      .single()
    if (clinicaSub?.suscripcion_estado === 'cancelado' && !clinicaSub?.es_vip_grant) {
      const { count: activosCount } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', profile.clinica_id)
        .or('activo.eq.true,activo.is.null')
      if ((activosCount ?? 0) > 5) {
        return NextResponse.json(
          { error: 'subscription_cancelled', message: 'Tu suscripción terminó. Reactívala desde Facturación para crear nuevos pacientes.' },
          { status: 403 }
        )
      }
    }

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

    // ── Detección de duplicados ─────────────────────────────────
    const inputNombre = (body.nombre as string ?? '').trim().toLowerCase()
    const inputApellidos = (body.apellidos as string ?? '').trim().toLowerCase()
    const inputFechaNac: string | null = body.fecha_nacimiento ?? null

    if (!body.forceCreate && inputNombre && inputApellidos && inputFechaNac) {
      const { data: duplicado } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos, numero_expediente, fecha_nacimiento')
        .eq('clinica_id', profile.clinica_id)
        .eq('fecha_nacimiento', inputFechaNac)
        .neq('activo', false)
        .limit(1)

      // Supabase no soporta LOWER(TRIM(...)) en .eq(), así que filtramos en JS
      const match = (duplicado ?? []).find(
        (p) =>
          p.nombre.trim().toLowerCase() === inputNombre &&
          p.apellidos.trim().toLowerCase() === inputApellidos,
      )

      if (match) {
        const response: DuplicatePatientResponse = {
          error: 'DUPLICATE_PATIENT',
          existingPatient: {
            id: match.id as string,
            nombre: match.nombre as string,
            apellidos: match.apellidos as string,
            numero_expediente: (match.numero_expediente as string | null) ?? null,
            fecha_nacimiento: (match.fecha_nacimiento as string | null) ?? null,
          },
          message: 'Ya existe un paciente con estos datos',
        }
        return NextResponse.json(response, { status: 409 })
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
    // Validación: secretaria DEBE asignar medico_id explícitamente (invariante post-refactor)
    // El frontend muestra dropdown obligatorio; el backend es defensa en profundidad.
    if (profile.role === 'secretaria' && !body.medico_id) {
      return NextResponse.json(
        { error: 'Las secretarias deben asignar un médico al paciente' },
        { status: 400 }
      )
    }
    const medico_id = body.medico_id
      || (isMedico(profile) ? profile.id : null)

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
