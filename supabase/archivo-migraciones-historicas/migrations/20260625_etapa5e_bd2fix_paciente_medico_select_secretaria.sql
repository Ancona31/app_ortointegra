-- ═══════════════════════════════════════════════════════════
-- Etapa 5.E — BD-2 FIX: agregar rama secretaria a paciente_medico_select
-- Propuesto: 2026-06-25  ·  Aplicado a producción: (pendiente)
-- ═══════════════════════════════════════════════════════════
--
-- QUÉ CORRIGE
-- La policy original paciente_medico_select
-- (20260524_etapa5e_bd2_policies_paciente_medico.sql:28-34) tiene 2 ramas:
-- el propio médico y el admin de clínica. La policy INSERT, en cambio, SÍ
-- contempla a la secretaria (bd2:43). Resultado: la secretaria puede crear
-- vínculos paciente↔médico pero NO leerlos vía acceso directo a la tabla,
-- lo que rompe el listado de vínculos. Este fix agrega una TERCERA rama de
-- secretaria SOLO a la policy SELECT, simétrica a la del INSERT, restringida
-- al tenant vía paciente_pertenece_a_mi_clinica(paciente_id).
--
-- POR QUÉ NO TOCA INSERT NI DELETE
-- Decisión tomada: la lista solo necesita LEER. La secretaria ya puede
-- INSERT (bd2:36-45). Desvincular (DELETE) sigue reservado a médico/admin
-- (bd2:47-53) — no se amplía. Esta migración modifica EXCLUSIVAMENTE la
-- policy SELECT.
--
-- ANTI-RECURSIÓN
-- La nueva rama usa el helper paciente_pertenece_a_mi_clinica()
-- (20260522_etapa5c_helpers_rls.sql:72-82), que consulta public.pacientes
-- (NO public.paciente_medico) → SIN auto-referencia → SIN recursión posible.
-- Es el mismo helper que ya usan las otras ramas de esta policy y el INSERT.
-- NO se usa soy_medico_tratante() (ese sí consultaría paciente_medico).
--
-- UNIDAD DE APLICACIÓN (protocolo D-T6)
-- Todo el cuerpo ejecutable va envuelto en BEGIN; ... COMMIT; explícito,
-- porque el procedimiento del proyecto aplica SQL statement-by-statement en
-- el SQL Editor de Supabase (CLAUDE.md §Base de datos; cf. 20260429_b2_02:127-128),
-- que NO abre transacción automática. Con el wrapper: si el CREATE o el
-- POST-FLIGHT fallan (RAISE EXCEPTION), la transacción aborta y revierte el
-- DROP/CREATE — sin ventana fail-closed persistente, sin cambio a medio aplicar.
--
-- ── ROLLBACK (DOWN) — referencia, NO se ejecuta ──────────────
-- Texto verbatim de la policy original (bd2:28-34) listo para re-aplicar:
--
--   DROP POLICY IF EXISTS paciente_medico_select ON public.paciente_medico;
--   CREATE POLICY paciente_medico_select ON public.paciente_medico
--     FOR SELECT TO authenticated
--     USING (
--       medico_id = auth.uid()
--       OR (public.soy_admin_de_clinica()
--           AND public.paciente_pertenece_a_mi_clinica(paciente_id))
--     );
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- ─── PRE-FLIGHT: validar estado esperado ANTES de reemplazar ──
DO $$
DECLARE
  v_total_policies integer;
  v_select_qual    text;
BEGIN
  -- RLS habilitada
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.paciente_medico'::regclass AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: paciente_medico no tiene RLS habilitada';
  END IF;

  -- Exactamente 3 policies (SELECT, INSERT, DELETE)
  SELECT count(*) INTO v_total_policies
  FROM pg_policy
  WHERE polrelid = 'public.paciente_medico'::regclass;

  IF v_total_policies <> 3 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 3 policies en paciente_medico, se encontraron %', v_total_policies;
  END IF;

  -- Las 3 policies esperadas existen con su nombre canónico
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.paciente_medico'::regclass AND polname = 'paciente_medico_select') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: no existe policy paciente_medico_select';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.paciente_medico'::regclass AND polname = 'paciente_medico_insert') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: no existe policy paciente_medico_insert';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.paciente_medico'::regclass AND polname = 'paciente_medico_delete') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: no existe policy paciente_medico_delete';
  END IF;

  -- La SELECT vigente tiene la forma esperada de 2 ramas (médico + admin)
  -- y NO contiene aún la rama de secretaria (idempotencia: aborta si ya se aplicó).
  SELECT pg_get_expr(polqual, polrelid) INTO v_select_qual
  FROM pg_policy
  WHERE polrelid = 'public.paciente_medico'::regclass AND polname = 'paciente_medico_select';

  IF v_select_qual NOT LIKE '%auth.uid()%' THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: paciente_medico_select no tiene la forma esperada (falta rama del médico auth.uid())';
  END IF;
  IF v_select_qual NOT LIKE '%soy_admin_de_clinica%' THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: paciente_medico_select no tiene la forma esperada (falta rama admin)';
  END IF;
  IF v_select_qual NOT LIKE '%paciente_pertenece_a_mi_clinica%' THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: paciente_medico_select no tiene la forma esperada (falta helper de tenant)';
  END IF;
  IF v_select_qual LIKE '%secretaria%' THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: paciente_medico_select ya contiene rama secretaria — el fix ya fue aplicado (abortar)';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK: paciente_medico con 3 policies; SELECT con 2 ramas (médico + admin) sin secretaria';
END $$;


-- ─── CAMBIO: reemplazar SOLO la policy SELECT ────────────────
-- Patrón del proyecto: DROP POLICY IF EXISTS + CREATE POLICY (cf. 20260602_etapa5j:147-177).
-- Las 2 ramas originales se conservan INTACTAS; se agrega la 3.ª rama de secretaria.
-- Paréntesis explícitos para fijar precedencia AND/OR.
DROP POLICY IF EXISTS paciente_medico_select ON public.paciente_medico;

CREATE POLICY paciente_medico_select ON public.paciente_medico
  FOR SELECT TO authenticated
  USING (
    medico_id = auth.uid()
    OR (public.soy_admin_de_clinica()
        AND public.paciente_pertenece_a_mi_clinica(paciente_id))
    OR (public.get_my_role() = 'secretaria'
        AND public.paciente_pertenece_a_mi_clinica(paciente_id))
  );


-- ─── POST-FLIGHT: validar estado resultante DESPUÉS del cambio ─
DO $$
DECLARE
  v_total_policies integer;
  v_select_qual    text;
BEGIN
  -- Siguen siendo exactamente 3 policies (no se creó/borró INSERT ni DELETE)
  SELECT count(*) INTO v_total_policies
  FROM pg_policy
  WHERE polrelid = 'public.paciente_medico'::regclass;

  IF v_total_policies <> 3 THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: se esperaban 3 policies tras el cambio, hay %', v_total_policies;
  END IF;

  -- INSERT y DELETE siguen presentes e intactas (por nombre)
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.paciente_medico'::regclass AND polname = 'paciente_medico_insert') THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: desapareció paciente_medico_insert';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.paciente_medico'::regclass AND polname = 'paciente_medico_delete') THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: desapareció paciente_medico_delete';
  END IF;

  -- La SELECT ahora tiene 3 ramas: conserva médico (auth.uid) + admin y suma secretaria
  SELECT pg_get_expr(polqual, polrelid) INTO v_select_qual
  FROM pg_policy
  WHERE polrelid = 'public.paciente_medico'::regclass AND polname = 'paciente_medico_select';

  IF v_select_qual NOT LIKE '%auth.uid()%' THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: se perdió la rama del médico (auth.uid()) en paciente_medico_select';
  END IF;
  IF v_select_qual NOT LIKE '%soy_admin_de_clinica%' THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: se perdió la rama admin en paciente_medico_select';
  END IF;
  IF v_select_qual NOT LIKE '%secretaria%' THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: no se agregó la rama secretaria en paciente_medico_select';
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: paciente_medico con 3 policies; SELECT ahora con 3 ramas (médico + admin + secretaria)';
END $$;

COMMIT;
