-- ═══════════════════════════════════════════════════════════
-- Etapa 5.F — Paso 3: Reescribir policies de consultas
-- (privacidad bidireccional + gate RESTRICTIVE de suscripción)
-- Aplicado a producción: 2026-05-30
-- ═══════════════════════════════════════════════════════════
-- Reemplaza las 4 policies clinica_* (PERMISSIVE, filtro solo por
-- clinica_id) por 3 policies PERMISSIVE con privacidad bidireccional
-- (medico_id = auth.uid() OR soy_admin_de_clinica()) AND paciente
-- en clínica, más 1 policy RESTRICTIVE de gate de suscripción en
-- INSERT (clinica_no_suspendida AND clinica_tiene_acceso).
--
-- NO crea policy DELETE (D-delete): notas clínicas son inmutables
-- por regla de proyecto; sin policy = bloqueo total para el cliente
-- de usuario.
--
-- Trazabilidad rígida (decisión Angel): cada médico inserta y actualiza
-- SOLO sus propias consultas. Admin ve todas las de su clínica pero
-- NO puede modificar las de otros (cadena de custodia clínica).
--
-- Addendum (Confirm-1, Lectura A): solo el médico original o admin
-- pueden agregar addendum a una consulta. Un médico suplente NO puede
-- añadir addendums a notas de otros; si necesita documentar algo,
-- crea su propia consulta.
--
-- Legacy: consultas con medico_id NULL (creadas antes de 5.F Paso 1,
-- o tras ON DELETE SET NULL de un médico borrado) solo visibles para
-- admin de clínica (D-legacy).

BEGIN;

-- ─── PRE-FLIGHT ──────────────────────────────────────────────
DO $$
DECLARE
  v_policies_viejas int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'consultas'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: RLS no está habilitada en public.consultas';
  END IF;

  SELECT count(*) INTO v_policies_viejas
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'consultas'
    AND cls.relnamespace = 'public'::regnamespace
    AND pol.polname IN ('clinica_select', 'clinica_insert', 'clinica_update', 'clinica_delete');

  IF v_policies_viejas <> 4 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 4 policies viejas en consultas (clinica_*), se encontraron %', v_policies_viejas;
  END IF;

  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.get_clinica_id() no existe';
  END IF;
  IF to_regprocedure('public.soy_admin_de_clinica()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.soy_admin_de_clinica() no existe';
  END IF;
  IF to_regprocedure('public.clinica_no_suspendida()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.clinica_no_suspendida() no existe';
  END IF;
  IF to_regprocedure('public.clinica_tiene_acceso()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.clinica_tiene_acceso() no existe';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK: 4 policies viejas presentes, 4 helpers disponibles, RLS habilitada';
END $$;

-- ─── DROP de las 4 policies viejas ───────────────────────────
DROP POLICY IF EXISTS clinica_select ON public.consultas;
DROP POLICY IF EXISTS clinica_insert ON public.consultas;
DROP POLICY IF EXISTS clinica_update ON public.consultas;
DROP POLICY IF EXISTS clinica_delete ON public.consultas;

-- ─── CREATE de las 4 policies nuevas ─────────────────────────

CREATE POLICY consultas_select
  ON public.consultas
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (consultas.medico_id = auth.uid() OR public.soy_admin_de_clinica())
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY consultas_insert
  ON public.consultas
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    consultas.medico_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY consultas_update
  ON public.consultas
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    consultas.medico_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  )
  WITH CHECK (
    consultas.medico_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY consultas_gates_insert
  ON public.consultas
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
  );

-- ─── POST-FLIGHT (R1: IS DISTINCT FROM con normalización de colación) ─
DO $$
DECLARE
  v_esperadas text[] := ARRAY['consultas_gates_insert', 'consultas_insert', 'consultas_select', 'consultas_update'];
  v_actuales  text[];
BEGIN
  SELECT array_agg(pol.polname ORDER BY pol.polname) INTO v_actuales
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'consultas'
    AND cls.relnamespace = 'public'::regnamespace;

  IF v_actuales IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: policies en consultas = %, esperado %', v_actuales, v_esperadas;
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: las 4 policies esperadas existen y no hay extras';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (DOWN) — referencia, no se ejecuta
-- ═══════════════════════════════════════════════════════════
-- Restaura el estado pre-Paso 3: drop las 4 nuevas, recrea las 4
-- clinica_* tal como estaban en el snapshot post-B2-01 (Paso 2 Query 1,
-- capturado 2026-05-28). Verificado byte-a-byte contra la captura:
-- las 4 son PERMISSIVE, TO authenticated; clinica_update solo USING
-- (sin WITH CHECK); las 4 tienen el mismo predicado EXISTS sobre
-- pacientes filtrando por clinica_id.
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS consultas_select       ON public.consultas;
-- DROP POLICY IF EXISTS consultas_insert       ON public.consultas;
-- DROP POLICY IF EXISTS consultas_update       ON public.consultas;
-- DROP POLICY IF EXISTS consultas_gates_insert ON public.consultas;
--
-- CREATE POLICY clinica_select
--   ON public.consultas AS PERMISSIVE FOR SELECT TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = consultas.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- CREATE POLICY clinica_insert
--   ON public.consultas AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = consultas.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- CREATE POLICY clinica_update
--   ON public.consultas AS PERMISSIVE FOR UPDATE TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = consultas.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- CREATE POLICY clinica_delete
--   ON public.consultas AS PERMISSIVE FOR DELETE TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = consultas.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- COMMIT;
