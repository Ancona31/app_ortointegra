import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMedico } from '@/lib/permissions';
import type { DuplicatePatientResponse } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. AUTH
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. PROFILE
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinica_id, role, id')
      .eq('id', user.id)
      .single();
    if (!profile?.clinica_id) {
      return NextResponse.json({ error: 'Sin clínica asignada' }, { status: 403 });
    }

    const body = await req.json();

    // 3. GATE SECRETARIA
    if (profile.role === 'secretaria' && !body.medico_id) {
      return NextResponse.json(
        { error: 'Las secretarias deben asignar un médico al paciente' },
        { status: 400 }
      );
    }

    // 4. GATE CONSENTIMIENTO
    if (!body.consentimiento_otorgado) {
      return NextResponse.json(
        { error: 'Se requiere el consentimiento del aviso de privacidad' },
        { status: 400 }
      );
    }

    // 5. DETECCIÓN DE DUPLICADOS
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

    // 6. CALCULAR medico_id
    const medico_id =
      body.medico_id || (isMedico(profile) ? profile.id : null);

    // 7. CONSTRUIR p_datos
    const p_datos = {
      nombre: body.nombre,
      apellidos: body.apellidos,
      fecha_nacimiento: body.fecha_nacimiento || null,
      sexo: body.sexo ?? null,
      peso_kg: body.peso_kg ?? null,
      talla_cm: body.talla_cm ?? null,
      imc: body.imc ?? null,
      telefono: body.telefono ?? null,
      email: body.email ?? null,
      direccion: body.direccion ?? null,
      ant_patologicos: body.ant_patologicos ?? null,
      ant_quirurgicos: body.ant_quirurgicos ?? null,
      ant_familiares: body.ant_familiares ?? null,
      alergias: body.alergias ?? null,
      medicamentos_actuales: body.medicamentos_actuales ?? null,
    };

    // 8. LLAMAR AL RPC
    const { data, error } = await supabase
      .rpc('crear_paciente_con_medico', { p_datos, p_medico_id: medico_id })
      .single<{ id: string; numero_expediente: string }>();

    // 9. MAPEAR ERRORES DEL RPC
    if (error) {
      const map: Record<string, { status: number; token: string }> = {
        '42501': { status: 403, token: 'forbidden' },
        'SP001': { status: 403, token: 'patient_limit' },
        'SP002': { status: 403, token: 'clinic_suspended' },
        'SP003': { status: 403, token: 'subscription_inactive' },
      };
      const mapped = map[error.code ?? ''];
      if (mapped) {
        return NextResponse.json(
          { error: mapped.token, message: error.message },
          { status: mapped.status }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 10. ÉXITO
    if (!data) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
    return NextResponse.json({
      id: data.id,
      numero_expediente: data.numero_expediente,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
