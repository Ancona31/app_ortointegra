-- ═══════════════════════════════════════════════════════════
-- Etapa 5.E — Paso 2 (TS-1a): RPC crear_paciente_con_medico
-- Aplicado a producción: 2026-05-24
-- ═══════════════════════════════════════════════════════════
-- RPC SECURITY DEFINER (owner=postgres) que crea, en una transacción
-- atómica, un paciente + su vínculo en paciente_medico. Es la puerta
-- de creación de pacientes: route.ts lo invocará (Paso 3, TS-1b).
-- Al ser owner=postgres se salta la RLS de pacientes/paciente_medico,
-- lo que permite que un médico invitado cree un paciente aunque la
-- fila nueva todavía no tenga vínculo M:N (el RPC lo crea acto seguido).
--
-- NOTA permisos: anon conserva EXECUTE (default de Supabase, GRANT
-- directo no removible vía REVOKE FROM PUBLIC). Sin riesgo: el PASO 1
-- rechaza a anon con ERRCODE 42501 (auth.uid() IS NULL).

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'crear_paciente_con_medico'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'crear_paciente_con_medico ya existe — abortar (estado inesperado)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crear_paciente_con_medico(
  p_datos      jsonb,
  p_medico_id  uuid
)
RETURNS TABLE (id uuid, numero_expediente text)
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

  RETURN QUERY SELECT v_nuevo_id, v_num_exp;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.crear_paciente_con_medico(jsonb, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crear_paciente_con_medico(jsonb, uuid) TO authenticated;

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
  WHERE p.proname = 'crear_paciente_con_medico'
    AND p.pronamespace = 'public'::regnamespace;
  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT: la funcion no se creo';
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-FLIGHT: la funcion NO es SECURITY DEFINER';
  END IF;
  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'POST-FLIGHT: owner es % (esperado postgres)', v_owner;
  END IF;
  v_grant := has_function_privilege(
    'authenticated',
    'public.crear_paciente_con_medico(jsonb, uuid)',
    'EXECUTE'
  );
  IF v_grant IS NOT TRUE THEN
    RAISE EXCEPTION 'POST-FLIGHT: authenticated NO tiene EXECUTE';
  END IF;
  RAISE NOTICE 'POST-FLIGHT OK: RPC creado, SECURITY DEFINER, owner=postgres, EXECUTE a authenticated';
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── ROLLBACK (DOWN) — referencia, no se ejecuta ──────────────
-- DROP FUNCTION IF EXISTS public.crear_paciente_con_medico(jsonb, uuid);
