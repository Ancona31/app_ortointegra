-- ============================================================
-- Etapa 5.C — 6 helpers SECURITY DEFINER para policies RLS
-- Fecha: 2026-05-22 · Protocolo D-T6
-- Crea las 6 funciones helper que las policies de 5.E-5.K usaran.
-- Crear en el SQL Editor (owner = postgres) -> bypass anti-recursion.
-- No toca datos. No crea policies. Riesgo bajo.
-- Aplicado a produccion y verificado (chunks 1-3 OK, smoke test
-- de los 6 helpers con sesion simulada: true/true/false/false).
-- ============================================================

-- ---------- UP ----------
DO $$
BEGIN
  -- PRE-FLIGHT
  IF to_regclass('public.clinicas') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla clinicas no encontrada. Abortando.';
  END IF;
  IF to_regclass('public.pacientes') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla pacientes no encontrada. Abortando.';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla profiles no encontrada. Abortando.';
  END IF;
  IF to_regclass('public.paciente_medico') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla paciente_medico no encontrada (requiere 5.B.2). Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc
    WHERE proname='get_clinica_id' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: get_clinica_id() no existe. Abortando.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinicas'
      AND column_name IN ('es_vip_grant','stripe_subscription_id','suscripcion_estado',
                          'max_pacientes','suspendida','ha_tenido_acceso_premium')
    GROUP BY table_name HAVING count(*) = 6) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: faltan columnas requeridas en clinicas. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='es_admin_de_clinica') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: profiles.es_admin_de_clinica no existe. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pacientes'
      AND column_name='clinica_id') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: pacientes.clinica_id no existe. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='paciente_medico'
      AND column_name IN ('paciente_id','medico_id')
    GROUP BY table_name HAVING count(*) = 2) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: faltan columnas requeridas en paciente_medico. Abortando.';
  END IF;

  -- HELPER 1: soy_medico_tratante
  CREATE OR REPLACE FUNCTION public.soy_medico_tratante(p_paciente_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM public.paciente_medico pm
      WHERE pm.paciente_id = p_paciente_id
        AND pm.medico_id   = auth.uid()
    );
  $fn$;
  COMMENT ON FUNCTION public.soy_medico_tratante(uuid) IS
    'True si el paciente esta vinculado al usuario actual en paciente_medico (5.C). NO usar en policy de paciente_medico.';

  -- HELPER 2: paciente_pertenece_a_mi_clinica
  CREATE OR REPLACE FUNCTION public.paciente_pertenece_a_mi_clinica(p_paciente_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = p_paciente_id
        AND p.clinica_id = public.get_clinica_id()
    );
  $fn$;
  COMMENT ON FUNCTION public.paciente_pertenece_a_mi_clinica(uuid) IS
    'True si el paciente es de la clinica del usuario actual (5.C). NO usar en policy de pacientes.';

  -- HELPER 3: soy_admin_de_clinica
  CREATE OR REPLACE FUNCTION public.soy_admin_de_clinica()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'medico'
        AND pr.es_admin_de_clinica IS TRUE
    );
  $fn$;
  COMMENT ON FUNCTION public.soy_admin_de_clinica() IS
    'True si el usuario actual es medico con es_admin_de_clinica=true (5.C).';

  -- HELPER 4: clinica_no_suspendida
  CREATE OR REPLACE FUNCTION public.clinica_no_suspendida()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT COALESCE(
      (SELECT NOT c.suspendida
       FROM public.clinicas c
       WHERE c.id = public.get_clinica_id()),
      false
    );
  $fn$;
  COMMENT ON FUNCTION public.clinica_no_suspendida() IS
    'True si la clinica del usuario NO esta suspendida. Fail-closed (5.C).';

  -- HELPER 5: clinica_dentro_de_limite (GATE 1)
  CREATE OR REPLACE FUNCTION public.clinica_dentro_de_limite()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM public.clinicas c
      WHERE c.id = public.get_clinica_id()
        AND (
          c.es_vip_grant IS TRUE
          OR (c.stripe_subscription_id IS NOT NULL
              AND c.suscripcion_estado = 'activo')
          OR (
            SELECT count(*) FROM public.pacientes p
            WHERE p.clinica_id = c.id
          ) < COALESCE(c.max_pacientes, 5)
        )
    );
  $fn$;
  COMMENT ON FUNCTION public.clinica_dentro_de_limite() IS
    'GATE 1: true si la clinica puede agregar pacientes. VIP/pago sin tope; free topado al total de pacientes < COALESCE(max_pacientes,5) (5.C).';

  -- HELPER 6: clinica_tiene_acceso (GATE 2)
  CREATE OR REPLACE FUNCTION public.clinica_tiene_acceso()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM public.clinicas c
      WHERE c.id = public.get_clinica_id()
        AND (
          c.es_vip_grant IS TRUE
          OR (c.stripe_subscription_id IS NOT NULL
              AND c.suscripcion_estado = 'activo')
          OR c.ha_tenido_acceso_premium IS NOT TRUE
        )
    );
  $fn$;
  COMMENT ON FUNCTION public.clinica_tiene_acceso() IS
    'GATE 2: true si la clinica puede generar consultas/documentos. VIP/pago/free-virgen tienen acceso; free degradado (premium=true) queda solo-lectura (5.C).';

  -- POST-FLIGHT
  IF to_regprocedure('public.soy_medico_tratante(uuid)')                IS NULL
     OR to_regprocedure('public.paciente_pertenece_a_mi_clinica(uuid)') IS NULL
     OR to_regprocedure('public.soy_admin_de_clinica()')                IS NULL
     OR to_regprocedure('public.clinica_no_suspendida()')               IS NULL
     OR to_regprocedure('public.clinica_dentro_de_limite()')            IS NULL
     OR to_regprocedure('public.clinica_tiene_acceso()')                IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: falta crear alguno de los 6 helpers con su firma esperada. Rollback automatico.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('soy_medico_tratante','paciente_pertenece_a_mi_clinica',
                        'soy_admin_de_clinica','clinica_no_suspendida',
                        'clinica_dentro_de_limite','clinica_tiene_acceso')
      AND r.rolname <> 'postgres'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: algun helper no quedo owned por postgres (bypass RLS no garantizado). Revertir y re-aplicar en SQL Editor.';
  END IF;

  RAISE NOTICE '5.C aplicado: 6 helpers SECURITY DEFINER creados (firma + owner=postgres verificados).';
END $$;

-- ---------- DOWN (rollback) ----------
-- Valido solo antes de que las policies de 5.E+ consuman estos helpers;
-- una vez referenciados, DROP FUNCTION fallaria sin CASCADE.
-- DO $$
-- BEGIN
--   DROP FUNCTION IF EXISTS public.soy_medico_tratante(uuid);
--   DROP FUNCTION IF EXISTS public.paciente_pertenece_a_mi_clinica(uuid);
--   DROP FUNCTION IF EXISTS public.soy_admin_de_clinica();
--   DROP FUNCTION IF EXISTS public.clinica_no_suspendida();
--   DROP FUNCTION IF EXISTS public.clinica_dentro_de_limite();
--   DROP FUNCTION IF EXISTS public.clinica_tiene_acceso();
--   RAISE NOTICE '5.C revertido: 6 helpers eliminados.';
-- END $$;
