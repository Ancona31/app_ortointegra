-- ═══════════════════════════════════════════════════════════
-- DUP-RPC — Paso 1: RPC crear_paciente_con_medico_v2
-- Estrategia V3 (RPC con nombre nuevo) — ver DUPRPC_PLAN.md §4, §8, §9
-- Aplicado a producción: (pendiente)
-- ═══════════════════════════════════════════════════════════
-- Versión 2 del RPC de creación de pacientes. Es IDÉNTICA al RPC de
-- 5.E (crear_paciente_con_medico) en sus PASOS 1-6 (validación del
-- caller, del médico objetivo, gates de suscripción, generación de
-- numero_expediente, INSERT en pacientes, INSERT en paciente_medico),
-- MÁS:
--   1) un parámetro nuevo p_force_create boolean DEFAULT false,
--   2) un PASO de detección de duplicados (entre gates y numero_exp),
--   3) un RETURNS plano de 9 columnas que expresa 'creado'|'duplicado'
--      (el contrato de duplicado va por RETURNS, no por RAISE).
--
-- La función original crear_paciente_con_medico NO se toca: queda
-- intacta hasta que el código nuevo esté desplegado (Paso 2) y luego
-- se elimina (Paso 4). Ver DUPRPC_PLAN.md §8.
--
-- NOTA permisos: anon conserva EXECUTE (default de Supabase, GRANT
-- directo no removible vía REVOKE FROM PUBLIC). Sin riesgo: el PASO 1
-- rechaza a anon con ERRCODE 42501 (auth.uid() IS NULL).

BEGIN;

-- PRE-FLIGHT: la función v2 NO debe existir aún (estado inesperado)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'crear_paciente_con_medico_v2'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'crear_paciente_con_medico_v2 ya existe — abortar (estado inesperado)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crear_paciente_con_medico_v2(
  p_datos         jsonb,
  p_medico_id     uuid,
  p_force_create  boolean DEFAULT false
)
RETURNS TABLE (
  resultado          text,
  id                 uuid,
  numero_expediente  text,
  dup_id             uuid,
  dup_nombre         text,
  dup_apellidos      text,
  dup_numero_exp     text,
  dup_fecha_nac      date,
  dup_es_mio         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
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
  -- variables de la detección de duplicados (PASO NUEVO).
  -- prefijo v_ para no colisionar con los OUT params id, numero_expediente,
  -- dup_id, dup_nombre, etc. que existen como variables en esta función.
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
  -- Solo si p_force_create = false. Solo aplica a pacientes ACTIVOS (D-D).
  -- El RPC corre como postgres (SECURITY DEFINER): el SELECT ve TODA la
  -- clínica, no solo los pacientes del médico (esa es la razón de ser de
  -- este paso post-5.E). Califica columnas con alias p. para no colisionar
  -- con los OUT params id / numero_expediente.
  IF p_force_create IS NOT TRUE THEN
    v_nombre    := p_datos->>'nombre';
    v_apellidos := p_datos->>'apellidos';
    v_fecha_nac := NULLIF(p_datos->>'fecha_nacimiento','')::date;

    -- igual condición que la detección actual de route.ts: solo dispara si
    -- vienen nombre, apellidos Y fecha_nacimiento no vacíos.
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
        -- dup_es_mio: ¿el médico TRATANTE ya está vinculado al duplicado?
        --   caller médico     -> auth.uid()
        --   caller secretaria -> p_medico_id (registra en nombre de otro)
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
    ant_patologicos, ant_quirurgicos, ant_familiares,
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
$fn$;

REVOKE EXECUTE ON FUNCTION public.crear_paciente_con_medico_v2(jsonb, uuid, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crear_paciente_con_medico_v2(jsonb, uuid, boolean) TO authenticated;

-- POST-FLIGHT: v2 creada, SECURITY DEFINER, owner=postgres, EXECUTE a authenticated
DO $$
DECLARE
  v_secdef boolean;
  v_owner  text;
  v_grant  boolean;
BEGIN
  SELECT p.prosecdef, r.rolname
    INTO v_secdef, v_owner
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = 'crear_paciente_con_medico_v2'
    AND p.pronamespace = 'public'::regnamespace;
  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT: la funcion v2 no se creo';
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-FLIGHT: la funcion v2 NO es SECURITY DEFINER';
  END IF;
  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'POST-FLIGHT: owner es % (esperado postgres)', v_owner;
  END IF;
  v_grant := has_function_privilege(
    'authenticated',
    'public.crear_paciente_con_medico_v2(jsonb, uuid, boolean)',
    'EXECUTE'
  );
  IF v_grant IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-FLIGHT: authenticated NO tiene EXECUTE';
  END IF;
  RAISE NOTICE 'POST-FLIGHT OK: RPC v2 creado, SECURITY DEFINER, owner=postgres, EXECUTE a authenticated';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── ROLLBACK (DOWN) — referencia, no se ejecuta ──────────────
-- DROP FUNCTION IF EXISTS public.crear_paciente_con_medico_v2(jsonb, uuid, boolean);
