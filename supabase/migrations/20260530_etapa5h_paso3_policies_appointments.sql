-- ═══════════════════════════════════════════════════════════
-- Etapa 5.H — Paso 3: Reescribir policies de appointments
-- (discriminación por rol: médico ve las suyas, admin/secretaria todas
-- + gate RESTRICTIVE de suscripción en INSERT)
-- Aplicado a producción: 2026-05-30
-- ═══════════════════════════════════════════════════════════
-- Reemplaza las 4 policies clinica_* (PERMISSIVE, filtro plano por
-- clinica_id) por 4 policies PERMISSIVE que ramifican por rol, más 1
-- policy RESTRICTIVE de gate de suscripción en INSERT.
--
-- D-5.H-1: visibilidad por rol. Médico invitado ve SOLO sus citas
-- (medico_id = auth.uid()); admin y secretaria ven TODAS las de su
-- clínica (gestión de agenda completa). Diferencia clave vs 5.F/5.G:
-- 5.H tiene rama de secretaria explícita (get_my_role() = 'secretaria').
--
-- D-5.H-2: NO crear helper nuevo. Usar get_my_role() inline (patrón ya
-- establecido en 5.E, en producción desde 2026-05-24).
--
-- D-5.H-3: cableado server-side de medico_id por rol ya aplicado en
-- Paso 1 (commit ffb484b). Las policies son defense-in-depth.
--
-- D-5.H-NULL: 2 citas legacy NULL en producción (1 de OrtoIntegra,
-- 1 de Dra. Ilse Casillas) quedan invisibles para médicos invitados
-- tras esta migración. Admin/secretaria de sus clínicas las siguen
-- viendo. Registrado como E5-DT-9 (orfandad aceptada).

BEGIN;

-- ─── PRE-FLIGHT ──────────────────────────────────────────────
DO $$
DECLARE
  v_policies_viejas int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'appointments'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: RLS no está habilitada en public.appointments';
  END IF;

  SELECT count(*) INTO v_policies_viejas
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'appointments'
    AND cls.relnamespace = 'public'::regnamespace
    AND pol.polname IN ('clinica_select', 'clinica_insert', 'clinica_update', 'clinica_delete');

  IF v_policies_viejas <> 4 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 4 policies viejas en appointments (clinica_*), se encontraron %', v_policies_viejas;
  END IF;

  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.get_clinica_id() no existe';
  END IF;
  IF to_regprocedure('public.soy_admin_de_clinica()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.soy_admin_de_clinica() no existe';
  END IF;
  IF to_regprocedure('public.get_my_role()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.get_my_role() no existe';
  END IF;
  IF to_regprocedure('public.clinica_no_suspendida()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.clinica_no_suspendida() no existe';
  END IF;
  IF to_regprocedure('public.clinica_tiene_acceso()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.clinica_tiene_acceso() no existe';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK: 4 policies viejas presentes, 5 helpers disponibles, RLS habilitada';
END $$;

-- ─── DROP de las 4 policies viejas ───────────────────────────
DROP POLICY IF EXISTS clinica_select ON public.appointments;
DROP POLICY IF EXISTS clinica_insert ON public.appointments;
DROP POLICY IF EXISTS clinica_update ON public.appointments;
DROP POLICY IF EXISTS clinica_delete ON public.appointments;

-- ─── CREATE de las 5 policies nuevas ─────────────────────────

CREATE POLICY appointments_select
  ON public.appointments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (
      appointments.medico_id = auth.uid()
      OR public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
    )
    AND appointments.clinica_id = public.get_clinica_id()
  );

CREATE POLICY appointments_insert
  ON public.appointments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      appointments.medico_id = auth.uid()
      OR public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
    )
    AND appointments.clinica_id = public.get_clinica_id()
  );

CREATE POLICY appointments_update
  ON public.appointments
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    (
      appointments.medico_id = auth.uid()
      OR public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
    )
    AND appointments.clinica_id = public.get_clinica_id()
  )
  WITH CHECK (
    (
      appointments.medico_id = auth.uid()
      OR public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
    )
    AND appointments.clinica_id = public.get_clinica_id()
  );

CREATE POLICY appointments_delete
  ON public.appointments
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    (
      appointments.medico_id = auth.uid()
      OR public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
    )
    AND appointments.clinica_id = public.get_clinica_id()
  );

CREATE POLICY appointments_gates_insert
  ON public.appointments
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
  );

-- ─── POST-FLIGHT (IS DISTINCT FROM con normalización de colación) ─
DO $$
DECLARE
  v_esperadas text[] := ARRAY['appointments_delete', 'appointments_gates_insert', 'appointments_insert', 'appointments_select', 'appointments_update'];
  v_actuales  text[];
BEGIN
  SELECT array_agg(pol.polname ORDER BY pol.polname) INTO v_actuales
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'appointments'
    AND cls.relnamespace = 'public'::regnamespace;

  IF v_actuales IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: policies en appointments = %, esperado %', v_actuales, v_esperadas;
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: las 5 policies esperadas existen y no hay extras';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (DOWN) — referencia, no se ejecuta
-- ═══════════════════════════════════════════════════════════
-- Restaura el estado pre-Paso 3: drop las 5 nuevas, recrea las 4
-- clinica_* tal como estaban en el snapshot del Paso 2 (capturado
-- 2026-05-30). Verificado byte-a-byte contra la captura: las 4 son
-- PERMISSIVE, TO authenticated; clinica_update con USING + WITH CHECK
-- (a diferencia de documentos que solo tenía USING); las 4 tienen
-- predicado plano clinica_id = get_clinica_id() (sin EXISTS).
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS appointments_select       ON public.appointments;
-- DROP POLICY IF EXISTS appointments_insert       ON public.appointments;
-- DROP POLICY IF EXISTS appointments_update       ON public.appointments;
-- DROP POLICY IF EXISTS appointments_delete       ON public.appointments;
-- DROP POLICY IF EXISTS appointments_gates_insert ON public.appointments;
--
-- CREATE POLICY clinica_select
--   ON public.appointments AS PERMISSIVE FOR SELECT TO authenticated
--   USING (clinica_id = public.get_clinica_id());
--
-- CREATE POLICY clinica_insert
--   ON public.appointments AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (clinica_id = public.get_clinica_id());
--
-- CREATE POLICY clinica_update
--   ON public.appointments AS PERMISSIVE FOR UPDATE TO authenticated
--   USING (clinica_id = public.get_clinica_id())
--   WITH CHECK (clinica_id = public.get_clinica_id());
--
-- CREATE POLICY clinica_delete
--   ON public.appointments AS PERMISSIVE FOR DELETE TO authenticated
--   USING (clinica_id = public.get_clinica_id());
--
-- COMMIT;
