import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMedico } from '@/lib/permissions';
import { normalizarParaBusqueda } from '@/lib/patientUtils';
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

    // ─── DETECCIÓN TS-SIDE DE DUPLICADOS (Bug #1 fix, 2026-06-08) ──────────────
    // El RPC crear_paciente_con_medico_v2 tiene un gate que SOLO dispara la
    // detección si llega fecha_nacimiento (líneas 134-144 del RPC). Como 3 de
    // los 4 modales no recogen fecha o la marcan opcional, la alerta dispara
    // <10% de las veces y los duplicados se cuelan.
    //
    // Esta detección TS-side cubre el caso "sin fecha": busca por nombre+apellidos
    // con normalización equivalente a la del RPC (lower + trim + colapso espacios
    // vía helper normalizarParaBusqueda).
    //
    // Exclusividad con el RPC:
    // - Si HAY fecha → el RPC lo cubre. Este bloque NO interviene.
    // - Si NO HAY fecha → el fix TS detecta. El RPC se salta detección por su gate.
    // Por tanto nunca compiten sobre el mismo input; no hay doble 409.
    //
    // Limitaciones aceptadas (registradas como deudas):
    // - E5-DT-23: tildes no normalizadas (unaccent instalada pero no cableada).
    // - E5-DT-24: médico invitado (no admin) solo ve sus propios pacientes por
    //   RLS, así que no detecta cross-médico sin fecha. Para admin/secretaria
    //   funciona completo (RLS deja ver todos los pacientes de la clínica).
    //
    // Saltamos si forceCreate=true (usuario ya confirmó "es otra persona").
    // Si la query falla → log y dejar pasar (fail-open): el RPC sigue siendo
    // el guard primario cuando hay fecha.
    if (body.forceCreate !== true) {
      const nombreNorm    = normalizarParaBusqueda(p_datos.nombre);
      const apellidosNorm = normalizarParaBusqueda(p_datos.apellidos);
      const fechaNorm     = p_datos.fecha_nacimiento;

      if (nombreNorm && apellidosNorm && !fechaNorm) {
        const { data: candidatos, error: candError } = await supabase
          .from('pacientes')
          .select('id, nombre, apellidos, numero_expediente, fecha_nacimiento, medico_id')
          .eq('clinica_id', profile.clinica_id)
          .or('activo.is.true,activo.is.null')
          .filter('nombre', 'ilike', nombreNorm)
          .filter('apellidos', 'ilike', apellidosNorm)
          .order('created_at', { ascending: true })
          .limit(1);

        if (candError) {
          console.error('[pacientes] Error en detección TS-side de duplicados:', candError);
          // No bloqueamos: fail-open hacia el RPC.
        } else if (candidatos && candidatos.length > 0) {
          const dup = candidatos[0];
          const dup_es_mio = dup.medico_id === medico_id;

          const response: DuplicatePatientResponse = {
            error: 'DUPLICATE_PATIENT',
            existingPatient: {
              id: dup.id,
              nombre: dup.nombre,
              apellidos: dup.apellidos,
              numero_expediente: dup.numero_expediente,
              fecha_nacimiento: dup.fecha_nacimiento,
            },
            message: 'Ya existe un paciente con estos datos',
            existingPatientIsMine: dup_es_mio,
          };
          return NextResponse.json(response, { status: 409 });
        }
      }
    }
    // ─── FIN DETECCIÓN TS-SIDE ─────────────────────────────────────────────────

    // 8. LLAMAR AL RPC
    const { data, error } = await supabase
      .rpc('crear_paciente_con_medico_v2', {
        p_datos,
        p_medico_id: medico_id,
        p_force_create: body.forceCreate === true,
      })
      .single<{
        resultado: 'creado' | 'duplicado';
        id: string | null;
        numero_expediente: string | null;
        dup_id: string | null;
        dup_nombre: string | null;
        dup_apellidos: string | null;
        dup_numero_exp: string | null;
        dup_fecha_nac: string | null;
        dup_es_mio: boolean | null;
      }>();

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

    // 10. RESULTADO DEL RPC
    if (!data) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    // 10a. DUPLICADO DETECTADO — responder 409 con el contrato DuplicatePatientResponse
    if (data.resultado === 'duplicado') {
      const response: DuplicatePatientResponse = {
        error: 'DUPLICATE_PATIENT',
        existingPatient: {
          id: data.dup_id as string,
          nombre: data.dup_nombre as string,
          apellidos: data.dup_apellidos as string,
          numero_expediente: data.dup_numero_exp ?? null,
          fecha_nacimiento: data.dup_fecha_nac ?? null,
        },
        message: 'Ya existe un paciente con estos datos',
        existingPatientIsMine: data.dup_es_mio ?? false,
      };
      return NextResponse.json(response, { status: 409 });
    }

    // 10b. PACIENTE CREADO
    return NextResponse.json({
      id: data.id,
      numero_expediente: data.numero_expediente,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
