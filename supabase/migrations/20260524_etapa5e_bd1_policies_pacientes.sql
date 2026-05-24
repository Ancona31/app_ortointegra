-- ═══════════════════════════════════════════════════════════
-- Etapa 5.E — Paso 5 (BD-1): policies RLS de pacientes (visibilidad M:N)
-- Aplicado a producción: 2026-05-24
-- ═══════════════════════════════════════════════════════════
-- Reemplaza las 5 policies viejas de pacientes por 5 nuevas que
-- implementan la visibilidad médico-paciente M:N: un médico invitado
-- ve solo SUS pacientes (vía soy_medico_tratante() → paciente_medico);
-- admin y secretaria ven todos los de su clínica. Decisiones:
--   D1   — visibilidad PERMISSIVE + gates RESTRICTIVE separados
--   D2-A — policy de inactivos solo para admin (sin rama super_admin)
--   D3-A — se elimina la policy DELETE (hard-delete solo service_role)
-- Anti-recursión: ninguna policy usa paciente_pertenece_a_mi_clinica()
-- ni subquery a pacientes. soy_medico_tratante() consulta paciente_medico.
-- NO activar FORCE RLS: clinica_dentro_de_limite() lee pacientes vía
-- SECURITY DEFINER owner=postgres; con FORCE RLS habría recursión.

BEGIN;

DO $$
DECLARE
  v_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.pacientes'::regclass
      AND relrowsecurity = true
      AND relforcerowsecurity = false
  ) THEN
    RAISE EXCEPTION 'pacientes: RLS no habilitada o FORCE RLS activo — abortar';
  END IF;
  SELECT count(*) INTO v_count
  FROM pg_policy WHERE polrelid = 'public.pacientes'::regclass;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'pacientes tiene % policies (esperado 5) — abortar', v_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.pacientes'::regclass AND polname = 'clinica_insert'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT: no se hallan las policies VIEJAS (clinica_insert). ¿BD-1 ya aplicada? Abortar.';
  END IF;
END $$;

DROP POLICY IF EXISTS clinica_insert                      ON public.pacientes;
DROP POLICY IF EXISTS clinica_update                      ON public.pacientes;
DROP POLICY IF EXISTS pacientes_delete_solo_sin_historial ON public.pacientes;
DROP POLICY IF EXISTS pacientes_select_activos            ON public.pacientes;
DROP POLICY IF EXISTS pacientes_select_inactivos_admin    ON public.pacientes;

CREATE POLICY pacientes_select_activos ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    clinica_id = public.get_clinica_id()
    AND (activo = true OR activo IS NULL)
    AND (
      public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
      OR public.soy_medico_tratante(id)
    )
  );

CREATE POLICY pacientes_select_inactivos_admin ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    clinica_id = public.get_clinica_id()
    AND activo = false
    AND public.soy_admin_de_clinica()
  );

CREATE POLICY pacientes_insert ON public.pacientes
  FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id = public.get_clinica_id()
    AND public.get_my_role() IN ('medico', 'secretaria')
  );

CREATE POLICY pacientes_update ON public.pacientes
  FOR UPDATE TO authenticated
  USING (
    clinica_id = public.get_clinica_id()
    AND (
      public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
      OR public.soy_medico_tratante(id)
    )
  )
  WITH CHECK (
    clinica_id = public.get_clinica_id()
    AND (
      public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
      OR public.soy_medico_tratante(id)
    )
  );

CREATE POLICY pacientes_gates_insert ON public.pacientes
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
    AND public.clinica_dentro_de_limite()
  );

DO $$
DECLARE
  v_esperadas text[] := ARRAY['pacientes_select_activos','pacientes_select_inactivos_admin',
                              'pacientes_insert','pacientes_update','pacientes_gates_insert'];
  v_actuales  text[];
BEGIN
  SELECT array_agg(polname ORDER BY polname) INTO v_actuales
  FROM pg_policy WHERE polrelid = 'public.pacientes'::regclass;
  IF v_actuales IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT: policies = % (esperado las 5 nuevas)', v_actuales;
  END IF;
  RAISE NOTICE 'POST-FLIGHT OK: pacientes con las 5 policies nuevas correctas';
END $$;

COMMIT;

-- ── ROLLBACK (DOWN) — referencia, no se ejecuta ──────────────
-- Para revertir: DROP de las 5 policies nuevas + recrear las 5 viejas.
-- (Las 5 viejas están en supabase/baseline/07_rls_policies.sql y en las
--  migraciones 20260429_b2_01 / 20260504_revert_phase81.)
