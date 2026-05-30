-- ═══════════════════════════════════════════════════════════
-- Etapa 5.G — Paso 4: Reescribir policies de documentos
-- (privacidad absoluta del creador + gate RESTRICTIVE)
-- Aplicado a producción: 2026-05-30
-- ═══════════════════════════════════════════════════════════
-- Reemplaza las 4 policies clinica_* (PERMISSIVE, filtro solo por
-- clinica_id) por 4 policies PERMISSIVE con privacidad absoluta
-- del creador (subido_por = auth.uid()), más 1 policy RESTRICTIVE
-- de gate de suscripción en INSERT.
--
-- D-5.G-1: trazabilidad absoluta. Admin de clínica NO ve documentos
-- ajenos. Sin rama soy_admin_de_clinica() en ninguna policy.
-- Los documentos generados (recetas, cotizaciones, solicitudes) son
-- instrumentos profesionales del médico tratante.
--
-- D-5.G-2 Opción C: legacy NULL con visibilidad amplia SOLO en SELECT
-- (rama subido_por IS NULL en USING). INSERT/UPDATE/DELETE estrictos,
-- sin rama NULL. Sin backfill (669 docs legacy → leak intra-clínica
-- aceptado, 0 hoy porque clínicas son mono-médico).
--
-- D-5.G-3: DELETE habilitado (hard delete real). A diferencia de
-- consultas en 5.F (sin policy DELETE = inmutables), documentos no
-- están bajo NOM-004 ni ARCO; el creador puede borrar lo suyo.
-- El handler de la Ruta A (/api/documentos/[id]) ya complementa con
-- hard delete del PDF en bucket 'documentos-pdf' (Paso 2, commit bfe4368).

BEGIN;

-- ─── PRE-FLIGHT ──────────────────────────────────────────────
DO $$
DECLARE
  v_policies_viejas int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'documentos'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: RLS no está habilitada en public.documentos';
  END IF;

  SELECT count(*) INTO v_policies_viejas
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'documentos'
    AND cls.relnamespace = 'public'::regnamespace
    AND pol.polname IN ('clinica_select', 'clinica_insert', 'clinica_update', 'clinica_delete');

  IF v_policies_viejas <> 4 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 4 policies viejas en documentos (clinica_*), se encontraron %', v_policies_viejas;
  END IF;

  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.get_clinica_id() no existe';
  END IF;
  IF to_regprocedure('public.clinica_no_suspendida()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.clinica_no_suspendida() no existe';
  END IF;
  IF to_regprocedure('public.clinica_tiene_acceso()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.clinica_tiene_acceso() no existe';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK: 4 policies viejas presentes, 3 helpers disponibles, RLS habilitada';
END $$;

-- ─── DROP de las 4 policies viejas ───────────────────────────
DROP POLICY IF EXISTS clinica_select ON public.documentos;
DROP POLICY IF EXISTS clinica_insert ON public.documentos;
DROP POLICY IF EXISTS clinica_update ON public.documentos;
DROP POLICY IF EXISTS clinica_delete ON public.documentos;

-- ─── CREATE de las 5 policies nuevas ─────────────────────────

CREATE POLICY documentos_select
  ON public.documentos
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (documentos.subido_por = auth.uid() OR documentos.subido_por IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY documentos_insert
  ON public.documentos
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    documentos.subido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY documentos_update
  ON public.documentos
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    documentos.subido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  )
  WITH CHECK (
    documentos.subido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY documentos_delete
  ON public.documentos
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    documentos.subido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = public.get_clinica_id()
    )
  );

CREATE POLICY documentos_gates_insert
  ON public.documentos
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
  v_esperadas text[] := ARRAY['documentos_delete', 'documentos_gates_insert', 'documentos_insert', 'documentos_select', 'documentos_update'];
  v_actuales  text[];
BEGIN
  SELECT array_agg(pol.polname ORDER BY pol.polname) INTO v_actuales
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'documentos'
    AND cls.relnamespace = 'public'::regnamespace;

  IF v_actuales IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: policies en documentos = %, esperado %', v_actuales, v_esperadas;
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: las 5 policies esperadas existen y no hay extras';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (DOWN) — referencia, no se ejecuta
-- ═══════════════════════════════════════════════════════════
-- Restaura el estado pre-Paso 4: drop las 5 nuevas, recrea las 4
-- clinica_* tal como estaban en el snapshot del Paso 3 (Query 1,
-- capturado 2026-05-30). Verificado byte-a-byte contra la captura:
-- las 4 son PERMISSIVE, TO authenticated; clinica_update solo USING
-- (sin WITH CHECK); las 4 tienen el mismo predicado EXISTS sobre
-- pacientes filtrando por clinica_id.
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS documentos_select       ON public.documentos;
-- DROP POLICY IF EXISTS documentos_insert       ON public.documentos;
-- DROP POLICY IF EXISTS documentos_update       ON public.documentos;
-- DROP POLICY IF EXISTS documentos_delete       ON public.documentos;
-- DROP POLICY IF EXISTS documentos_gates_insert ON public.documentos;
--
-- CREATE POLICY clinica_select
--   ON public.documentos AS PERMISSIVE FOR SELECT TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = documentos.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- CREATE POLICY clinica_insert
--   ON public.documentos AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = documentos.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- CREATE POLICY clinica_update
--   ON public.documentos AS PERMISSIVE FOR UPDATE TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = documentos.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- CREATE POLICY clinica_delete
--   ON public.documentos AS PERMISSIVE FOR DELETE TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.id = documentos.paciente_id
--       AND p.clinica_id = public.get_clinica_id()
--   ));
--
-- COMMIT;
