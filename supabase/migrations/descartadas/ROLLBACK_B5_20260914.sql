-- ═══════════════════════════════════════════════════════════════════════
-- ⛔ GUION DE EMERGENCIA — NO ES UNA MIGRACIÓN. NO SE APLICA POR TURNO.
-- ═══════════════════════════════════════════════════════════════════════
-- Archivo: ROLLBACK_B5_20260914.sql
-- Vive en `supabase/migrations/descartadas/` A PROPÓSITO: fuera de
-- `migrations/` no lo arrastra ningún `db push` ni figura en
-- `supabase migration list`. Si algún día aparece en `migrations/`, alguien lo
-- movió por error y hay que devolverlo aquí.
--
-- QUÉ REVIERTE: `supabase/migrations/20260913_b5_perfil_completo_rls.sql`
-- —el gate de «perfil completo» en la capa de datos (Bloque B5)—, entera.
-- Deshace las tres cosas que aquella instaló:
--   1. las SEIS policies `*_gates_insert` vuelven a su predicado anterior,
--      sin `perfil_completo()`;
--   2. el RPC `crear_paciente_con_medico_v2` vuelve a su cuerpo ORIGINAL, sin
--      el PASO 3 del gate;
--   3. se reabre el EXECUTE del RPC v1 a `anon` y `authenticated`.
--
-- CUÁNDO SE USA: solo si tras aplicar aquella migración en producción hay que
-- dar marcha atrás. Se pega COMPLETO en el SQL Editor de Supabase, de una vez.
-- Existe para que en caliente no haya que ir a buscar el cuerpo original del
-- RPC a un dump de 4.000 líneas.
--
-- ⚠️⚠️ EL GRANT DEL RPC v1 VA SOLO SI SE REVIERTE TODO, Y ES LA ADVERTENCIA
-- MÁS IMPORTANTE DE ESTE ARCHIVO. Ese RPC es SECURITY DEFINER propiedad de
-- `postgres` (BYPASSRLS), inserta en `public.pacientes` SIN el gate de perfil y
-- está publicado en PostgREST: con él abierto, cualquiera con sesión rodea las
-- policies con un `curl` a /rest/v1/rpc/crear_paciente_con_medico. Es el
-- agujero que el §4 de aquella auditoría cerró.
-- Dejar el candado puesto —las policies con el gate— y la puerta trasera
-- abierta —el v1 con EXECUTE— es PEOR que no revertir nada: se conserva la
-- molestia del gate y se pierde su garantía. O va todo el archivo, o ninguno.
--
-- ⚠️ `perfil_completo()` NO SE BORRA AQUÍ. Sin llamadores no hace nada, y
-- borrarla antes de revertir las policies y el RPC haría fallar el DROP por
-- dependencia. El `DROP` queda al final, comentado, para después y aparte.
--
-- ⚠️ EL CUERPO DEL RPC v2 DE ABAJO ES COPIA LITERAL de
-- `supabase/migrations/20260912190416_remote_schema.sql` líneas 1074-1270 —el
-- dump de producción anterior al gate—. No se reescribió ni una línea.
-- Verificado al copiarlo: la línea 1074 abre el `CREATE OR REPLACE` del v2, la
-- 1270 es su `$function$;` de cierre, no hay otra definición de función dentro
-- del rango, y el texto no contiene `perfil_completo` — o sea que es de verdad
-- la versión sin gate. Si algún día ese dump se renumera, esta copia sigue
-- siendo válida: lo que manda es el texto de aquí, no el rango.
--
-- ⚠️ NO REVIERTE el criterio de la aplicación. `src/lib/perfil/gate.ts` y el
-- gate visible siguen donde estén desplegados; esto solo toca la base. Si se
-- revierte la base, el modal seguirá pidiendo lo mismo —pero ya no habrá nada
-- que lo respalde si el médico lo rodea.
--
-- Escrito: 2026-09-14 · Rama: feature/auth-a · NO EJECUTADO CONTRA NINGUNA BASE
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------- 1 · Las seis policies vuelven a su predicado anterior ----------
-- Copiadas del bloque ROLLBACK de la propia migración (líneas 905-916),
-- descomentadas. `ALTER POLICY … WITH CHECK` no toca `USING`, `FOR` ni `TO`.

ALTER POLICY pacientes_gates_insert ON public.pacientes
  WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso() AND public.clinica_dentro_de_limite());
ALTER POLICY consultas_gates_insert ON public.consultas
  WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
ALTER POLICY documentos_gates_insert ON public.documentos
  WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
ALTER POLICY appointments_gates_insert ON public.appointments
  WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
ALTER POLICY addendums_gates_insert ON public.addendums
  WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());
ALTER POLICY mediciones_gates_insert ON public.mediciones_analitos
  WITH CHECK (public.clinica_no_suspendida() AND public.clinica_tiene_acceso());

-- ---------- 2 · El RPC v2, cuerpo original sin el gate ----------
-- Copia literal de remote_schema.sql:1074-1270. NO EDITAR: lo que da valor a
-- este bloque es ser exactamente lo que corría antes.

CREATE OR REPLACE FUNCTION public.crear_paciente_con_medico_v2 (
  p_datos        jsonb,
  p_medico_id    uuid,
  p_force_create boolean DEFAULT false
)
  RETURNS TABLE (
    resultado         text,
    id                uuid,
    numero_expediente text,
    dup_id            uuid,
    dup_nombre        text,
    dup_apellidos     text,
    dup_numero_exp    text,
    dup_fecha_nac     date,
    dup_es_mio        boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_rol          text;
  v_clinica_id   uuid;
  v_es_admin     boolean;
  v_medico_rol   text;
  v_medico_clin  uuid;
  v_anio         text := to_char(now(), 'YYYY');
  v_correlativo  int;
  v_num_exp      text;
  v_nuevo_id     uuid;
  v_nombre       text;
  v_apellidos    text;
  v_fecha_nac    date;
  v_dup_id       uuid;
  v_dup_nombre   text;
  v_dup_apell    text;
  v_dup_num_exp  text;
  v_dup_fnac     date;
  v_dup_es_mio   boolean;
  v_medico_eval  uuid;
BEGIN
  -- PASO 1 — validar quién llama
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id, pr.es_admin_de_clinica
    INTO v_rol, v_clinica_id, v_es_admin
  FROM public.profiles pr WHERE pr.id = v_uid;
  IF v_clinica_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene clinica asignada.' USING ERRCODE = '42501';
  END IF;
  IF v_rol NOT IN ('medico','secretaria') THEN
    RAISE EXCEPTION 'El rol % no puede crear pacientes.', v_rol USING ERRCODE = '42501';
  END IF;

  -- PASO 2 — validar el médico objetivo
  IF p_medico_id IS NULL THEN
    RAISE EXCEPTION 'Debe especificarse el medico tratante.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role, pr.clinica_id INTO v_medico_rol, v_medico_clin
  FROM public.profiles pr WHERE pr.id = p_medico_id;
  IF v_medico_rol IS NULL THEN
    RAISE EXCEPTION 'El medico especificado no existe.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_rol <> 'medico' THEN
    RAISE EXCEPTION 'El usuario asignado no es un medico.' USING ERRCODE = '42501';
  END IF;
  IF v_medico_clin IS DISTINCT FROM v_clinica_id THEN
    RAISE EXCEPTION 'El medico no pertenece a la clinica del usuario.' USING ERRCODE = '42501';
  END IF;
  IF v_rol = 'medico' AND v_es_admin IS NOT TRUE AND p_medico_id <> v_uid THEN
    RAISE EXCEPTION 'Un medico invitado solo puede asignarse pacientes a si mismo.'
      USING ERRCODE = '42501';
  END IF;

  -- PASO 3 — gates de suscripción
  IF NOT public.clinica_no_suspendida() THEN
    RAISE EXCEPTION 'La clinica esta suspendida.' USING ERRCODE = 'SP002';
  END IF;
  IF NOT public.clinica_tiene_acceso() THEN
    RAISE EXCEPTION 'La clinica no tiene una suscripcion activa.' USING ERRCODE = 'SP003';
  END IF;
  IF NOT public.clinica_dentro_de_limite() THEN
    RAISE EXCEPTION 'La clinica alcanzo su limite de pacientes.' USING ERRCODE = 'SP001';
  END IF;

  -- PASO NUEVO — detección de duplicados (DUP-RPC Fase 1; ver DUPRPC_PLAN.md §4.3)
  IF p_force_create IS NOT TRUE THEN
    v_nombre    := p_datos->>'nombre';
    v_apellidos := p_datos->>'apellidos';
    v_fecha_nac := NULLIF(p_datos->>'fecha_nacimiento','')::date;

    IF v_nombre IS NOT NULL AND btrim(v_nombre) <> ''
       AND v_apellidos IS NOT NULL AND btrim(v_apellidos) <> ''
       AND v_fecha_nac IS NOT NULL
    THEN
      SELECT p.id, p.nombre, p.apellidos, p.numero_expediente, p.fecha_nacimiento
        INTO v_dup_id, v_dup_nombre, v_dup_apell, v_dup_num_exp, v_dup_fnac
      FROM public.pacientes p
      WHERE p.clinica_id = v_clinica_id
        AND (p.activo = true OR p.activo IS NULL)
        AND p.fecha_nacimiento = v_fecha_nac
        AND lower(btrim(p.nombre))    = lower(btrim(v_nombre))
        AND lower(btrim(p.apellidos)) = lower(btrim(v_apellidos))
      ORDER BY p.created_at ASC
      LIMIT 1;

      IF v_dup_id IS NOT NULL THEN
        IF v_rol = 'medico' THEN
          v_medico_eval := v_uid;
        ELSE
          v_medico_eval := p_medico_id;
        END IF;

        v_dup_es_mio := EXISTS (
          SELECT 1 FROM public.paciente_medico pm
          WHERE pm.paciente_id = v_dup_id
            AND pm.medico_id = v_medico_eval
        );

        RETURN QUERY SELECT
          'duplicado'::text,
          NULL::uuid,
          NULL::text,
          v_dup_id,
          v_dup_nombre,
          v_dup_apell,
          v_dup_num_exp,
          v_dup_fnac,
          v_dup_es_mio;
        RETURN;  -- NO inserta nada
      END IF;
    END IF;
  END IF;

  -- PASO 4 — generar numero_expediente
  SELECT COALESCE(MAX(
           NULLIF(regexp_replace(p.numero_expediente, '^EXP-\d{4}-', ''), '')::int
         ), 0) + 1
    INTO v_correlativo
  FROM public.pacientes p
  WHERE p.clinica_id = v_clinica_id
    AND p.numero_expediente ~ ('^EXP-' || v_anio || '-[0-9]+$');
  v_num_exp := 'EXP-' || v_anio || '-' || lpad(v_correlativo::text, 4, '0');

  -- PASO 5 — insert en pacientes
  INSERT INTO public.pacientes (
    nombre, apellidos, fecha_nacimiento, sexo,
    peso_kg, talla_cm, imc,
    telefono, email, direccion,
    ant_no_patologicos, ant_patologicos, ant_quirurgicos, ant_familiares,
    alergias, medicamentos_actuales,
    clinica_id, medico_id, numero_expediente,
    consentimiento_otorgado, fecha_consentimiento, version_aviso_privacidad
  ) VALUES (
    p_datos->>'nombre',
    p_datos->>'apellidos',
    NULLIF(p_datos->>'fecha_nacimiento','')::date,
    NULLIF(p_datos->>'sexo', ''),
    NULLIF(p_datos->>'peso_kg', '')::numeric,
    NULLIF(p_datos->>'talla_cm', '')::numeric,
    NULLIF(p_datos->>'imc', '')::numeric,
    NULLIF(p_datos->>'telefono', ''),
    NULLIF(p_datos->>'email', ''),
    NULLIF(p_datos->>'direccion', ''),
    NULLIF(p_datos->>'ant_no_patologicos', ''),
    NULLIF(p_datos->>'ant_patologicos', ''),
    NULLIF(p_datos->>'ant_quirurgicos', ''),
    NULLIF(p_datos->>'ant_familiares', ''),
    NULLIF(p_datos->>'alergias', ''),
    NULLIF(p_datos->>'medicamentos_actuales', ''),
    v_clinica_id,
    p_medico_id,
    v_num_exp,
    true,
    now(),
    'v1.0-2026-04-08'
  )
  RETURNING pacientes.id INTO v_nuevo_id;

  -- PASO 6 — insert en paciente_medico
  INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
  VALUES (v_nuevo_id, p_medico_id, v_uid);

  RETURN QUERY SELECT
    'creado'::text,
    v_nuevo_id,
    v_num_exp,
    NULL::uuid,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::date,
    false;
END;
$function$;

-- ---------- 3 · Reabrir el RPC v1 ----------
-- ⚠️ SOLO CON LO DE ARRIBA YA APLICADO. Ver la advertencia de la cabecera: sin
-- los pasos 1 y 2, esta línea abre la puerta trasera dejando el gate puesto.
GRANT EXECUTE ON FUNCTION public.crear_paciente_con_medico(jsonb, uuid) TO anon, authenticated;

COMMIT;

-- ---------- Después, y solo si se quiere limpiar ----------
-- Va APARTE y DESPUÉS del COMMIT de arriba: mientras alguna policy o el RPC la
-- referencien, el DROP falla por dependencia.
-- DROP FUNCTION IF EXISTS public.perfil_completo();

-- ---------- Comprobación posterior (§7 del protocolo de auditoría) ----------
-- Pegar DESPUÉS de revertir, para que el rollback quede respaldado por un dato
-- y no por la palabra de quien lo pegó. Esperado tras revertir: false · 0 · true
--   SELECT (SELECT count(*) FROM pg_policy
--            WHERE polname LIKE '%gates%'
--              AND pg_get_expr(polwithcheck, polrelid) LIKE '%perfil_completo%') > 0
--            AS alguna_policy_con_gate,
--          (SELECT count(*) FROM pg_proc
--            WHERE oid = to_regprocedure('public.crear_paciente_con_medico_v2(jsonb,uuid,boolean)')
--              AND prosrc LIKE '%perfil_completo%') AS rpc_v2_con_gate,
--          has_function_privilege('authenticated',
--            'public.crear_paciente_con_medico(jsonb,uuid)', 'EXECUTE') AS v1_reabierto;
