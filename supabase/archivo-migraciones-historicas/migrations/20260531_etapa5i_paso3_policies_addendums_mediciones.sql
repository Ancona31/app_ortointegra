-- ═══════════════════════════════════════════════════════════
-- Etapa 5.I — Paso 3: Reescribir policies de addendums + mediciones_analitos
-- (privacidad bidireccional: creador OR admin de clínica + gates RESTRICTIVE)
-- Aplicado a producción: 2026-05-31
-- ═══════════════════════════════════════════════════════════
-- Reemplaza 6 policies viejas (2 addendums + 4 mediciones_analitos con
-- patrón "cualquier authenticated de la clínica") por 8 policies nuevas
-- con discriminación por creador-vs-admin.
--
-- D-5.I-1 (alcance): 2 tablas. calculadora_resultados queda FUERA
-- (D-5.I-CALCULADORA, feature en eliminación).
--
-- D-5.I-2 (addendums): SELECT con creador OR admin (auditoría),
-- INSERT con autoría RÍGIDA del autor de la consulta padre (D-5.I-H2),
-- inmutable (sin UPDATE/DELETE), CON gate RESTRICTIVE de suscripción.
--
-- D-5.I-3 (mediciones_analitos): creador OR admin, CON UPDATE/DELETE
-- permitidos al creador (mediciones son ayuda al médico, no documentación
-- inmutable), CON gate RESTRICTIVE de suscripción.
--
-- D-5.I-GATES: el gate de policy usa los helpers clinica_no_suspendida() y
-- clinica_tiene_acceso() ya en producción desde 5.C.
--
-- D-5.I-H2 (autoría addendum): SOLO el médico autor de la consulta puede
-- agregar addendums. Admin NO puede addendar consultas ajenas. Defense in
-- depth con el cableado TS-side en commit db4b15d (validación 403
-- forbidden_addendum + mensaje legible antes de llegar a la policy).
-- Consultas legacy con consultas.medico_id NULL quedan permanentemente
-- no-addendables (fail-closed: NULL = auth.uid() → NULL → policy bloquea).
-- Registrado como E5-DT-11 (87 huérfanas legacy en producción, fuga IA/manual
-- cerrada según smoke del 2026-05-31).
--
-- Sin rama de secretaria: estas son features clínicas exclusivas del médico,
-- no operaciones administrativas. Diferencia clave vs 5.H (appointments)
-- donde sí hay rama secretaria.
--
-- Sin rama medico_id/creado_por IS NULL en addendums/mediciones: ambos
-- discriminadores son NOT NULL por schema, y diagnóstico (a)+(b) del Paso 2
-- confirma 0 filas legacy NULL.
--
-- Bug latente corregido: mediciones_analitos.clinica_update actual tiene
-- USING pero NO WITH CHECK (vulnerabilidad teórica). Las policies nuevas
-- tienen USING + WITH CHECK idénticos (patrón 5.G/5.H).

BEGIN;

-- ─── PRE-FLIGHT ──────────────────────────────────────────────
DO $$
DECLARE
  v_addendums_viejas int;
  v_mediciones_viejas int;
BEGIN
  -- Validar RLS habilitada en ambas tablas
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'addendums'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: RLS no está habilitada en public.addendums';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'mediciones_analitos'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: RLS no está habilitada en public.mediciones_analitos';
  END IF;

  -- Validar conteo de policies viejas
  SELECT count(*) INTO v_addendums_viejas
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'addendums'
    AND cls.relnamespace = 'public'::regnamespace
    AND pol.polname IN ('addendums_select', 'addendums_insert');

  IF v_addendums_viejas <> 2 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 2 policies viejas en addendums, se encontraron %', v_addendums_viejas;
  END IF;

  SELECT count(*) INTO v_mediciones_viejas
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'mediciones_analitos'
    AND cls.relnamespace = 'public'::regnamespace
    AND pol.polname IN ('clinica_select', 'clinica_insert', 'clinica_update', 'clinica_delete');

  IF v_mediciones_viejas <> 4 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 4 policies viejas en mediciones_analitos, se encontraron %', v_mediciones_viejas;
  END IF;

  -- Validar helpers existentes
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

  RAISE NOTICE 'PRE-FLIGHT OK: 6 policies viejas presentes, 4 helpers disponibles, RLS habilitada en ambas tablas';
END $$;

-- ─── DROP de las 6 policies viejas ───────────────────────────
DROP POLICY IF EXISTS addendums_select ON public.addendums;
DROP POLICY IF EXISTS addendums_insert ON public.addendums;
DROP POLICY IF EXISTS clinica_select ON public.mediciones_analitos;
DROP POLICY IF EXISTS clinica_insert ON public.mediciones_analitos;
DROP POLICY IF EXISTS clinica_update ON public.mediciones_analitos;
DROP POLICY IF EXISTS clinica_delete ON public.mediciones_analitos;

-- ─── CREATE de las 3 policies nuevas en addendums ────────────

CREATE POLICY addendums_select
  ON public.addendums
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (addendums.medico_id = auth.uid() OR public.soy_admin_de_clinica())
    AND EXISTS (
      SELECT 1
      FROM public.consultas c
      JOIN public.pacientes p ON p.id = c.paciente_id
      WHERE c.id = addendums.consulta_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

-- D-5.I-H2: solo el médico autor de la consulta puede addendar.
-- La línea AND c.medico_id = auth.uid() es la defensa BD-side del cableado
-- TS-side ya aplicado en commit db4b15d (forbidden_addendum 403).
CREATE POLICY addendums_insert
  ON public.addendums
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    addendums.medico_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.consultas c
      JOIN public.pacientes p ON p.id = c.paciente_id
      WHERE c.id = addendums.consulta_id
        AND p.clinica_id = public.get_clinica_id()
        AND c.medico_id = auth.uid()
    )
  );

CREATE POLICY addendums_gates_insert
  ON public.addendums
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.clinica_no_suspendida()
    AND public.clinica_tiene_acceso()
  );

-- ─── CREATE de las 5 policies nuevas en mediciones_analitos ──

CREATE POLICY mediciones_select
  ON public.mediciones_analitos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (mediciones_analitos.creado_por = auth.uid() OR public.soy_admin_de_clinica())
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY mediciones_insert
  ON public.mediciones_analitos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    mediciones_analitos.creado_por = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY mediciones_update
  ON public.mediciones_analitos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    mediciones_analitos.creado_por = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  )
  WITH CHECK (
    mediciones_analitos.creado_por = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY mediciones_delete
  ON public.mediciones_analitos
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    mediciones_analitos.creado_por = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY mediciones_gates_insert
  ON public.mediciones_analitos
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
  v_esperadas_addendums  text[] := ARRAY['addendums_gates_insert', 'addendums_insert', 'addendums_select'];
  v_esperadas_mediciones text[] := ARRAY['mediciones_delete', 'mediciones_gates_insert', 'mediciones_insert', 'mediciones_select', 'mediciones_update'];
  v_actuales_addendums   text[];
  v_actuales_mediciones  text[];
BEGIN
  SELECT array_agg(pol.polname ORDER BY pol.polname) INTO v_actuales_addendums
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'addendums'
    AND cls.relnamespace = 'public'::regnamespace;

  IF v_actuales_addendums IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas_addendums) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: policies en addendums = %, esperado %', v_actuales_addendums, v_esperadas_addendums;
  END IF;

  SELECT array_agg(pol.polname ORDER BY pol.polname) INTO v_actuales_mediciones
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'mediciones_analitos'
    AND cls.relnamespace = 'public'::regnamespace;

  IF v_actuales_mediciones IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas_mediciones) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: policies en mediciones_analitos = %, esperado %', v_actuales_mediciones, v_esperadas_mediciones;
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: 3 policies en addendums, 5 en mediciones_analitos, sin extras';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (DOWN) — referencia, no se ejecuta
-- ═══════════════════════════════════════════════════════════
-- Restaura el estado pre-Paso 3: drop las 8 nuevas, recrea las 6 viejas
-- semánticamente equivalentes al snapshot del Paso 2 (capturado 2026-05-31).
--
-- Nota sobre cualificación de schema: este ROLLBACK usa nombres
-- schema-cualificados (public.X) consistentes con la salida de pg_policy
-- (snapshot live del Paso 2 Query 1), mientras el baseline
-- 07_rls_policies.sql los escribe sin cualificar. Funcionalmente idénticos
-- vía search_path; la cualificación explícita evita ambigüedad si el
-- search_path se modifica.
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS addendums_select        ON public.addendums;
-- DROP POLICY IF EXISTS addendums_insert        ON public.addendums;
-- DROP POLICY IF EXISTS addendums_gates_insert  ON public.addendums;
-- DROP POLICY IF EXISTS mediciones_select       ON public.mediciones_analitos;
-- DROP POLICY IF EXISTS mediciones_insert       ON public.mediciones_analitos;
-- DROP POLICY IF EXISTS mediciones_update       ON public.mediciones_analitos;
-- DROP POLICY IF EXISTS mediciones_delete       ON public.mediciones_analitos;
-- DROP POLICY IF EXISTS mediciones_gates_insert ON public.mediciones_analitos;
--
-- CREATE POLICY addendums_select
--   ON public.addendums AS PERMISSIVE FOR SELECT TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.consultas c JOIN public.pacientes p ON p.id = c.paciente_id WHERE c.id = addendums.consulta_id AND p.clinica_id = public.get_clinica_id()));
--
-- CREATE POLICY addendums_insert
--   ON public.addendums AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (EXISTS (SELECT 1 FROM public.consultas c JOIN public.pacientes p ON p.id = c.paciente_id WHERE c.id = addendums.consulta_id AND p.clinica_id = public.get_clinica_id()));
--
-- CREATE POLICY clinica_select
--   ON public.mediciones_analitos AS PERMISSIVE FOR SELECT TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = mediciones_analitos.paciente_id AND p.clinica_id = public.get_clinica_id()));
--
-- CREATE POLICY clinica_insert
--   ON public.mediciones_analitos AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = mediciones_analitos.paciente_id AND p.clinica_id = public.get_clinica_id()));
--
-- CREATE POLICY clinica_update
--   ON public.mediciones_analitos AS PERMISSIVE FOR UPDATE TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = mediciones_analitos.paciente_id AND p.clinica_id = public.get_clinica_id()));
--
-- CREATE POLICY clinica_delete
--   ON public.mediciones_analitos AS PERMISSIVE FOR DELETE TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = mediciones_analitos.paciente_id AND p.clinica_id = public.get_clinica_id()));
--
-- COMMIT;
