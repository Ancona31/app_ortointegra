-- ═══════════════════════════════════════════════════════════
-- Etapa 5.E — Paso 4: Backfill correctivo set-based
-- Aplicado a producción: 2026-05-24 — 6 vínculos M:N creados
-- ═══════════════════════════════════════════════════════════
-- Vincula en paciente_medico a todo paciente ACTIVO con medico_id
-- que aún no tenga vínculo M:N. Idempotente (el NOT EXISTS lo hace
-- re-ejecutable sin daño). Respeta D4-A: el filtro activo excluye
-- a los pacientes de prueba soft-deleted. Necesario ANTES de BD-1
-- (Paso 5): tras BD-1 un paciente activo sin vínculo M:N solo lo
-- vería el admin, no su médico tratante.

BEGIN;

-- Pre-flight: confirmar que hay exactamente 6 huérfanos backfilleables
DO $$
DECLARE
  v_huerfanos int;
BEGIN
  SELECT count(*) INTO v_huerfanos
  FROM public.pacientes p
  WHERE (p.activo IS TRUE OR p.activo IS NULL)
    AND p.medico_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.paciente_medico pm WHERE pm.paciente_id = p.id
    );
  IF v_huerfanos <> 6 THEN
    RAISE EXCEPTION 'PRE-FLIGHT: se esperaban 6 huerfanos backfilleables, hay % — abortar', v_huerfanos;
  END IF;
  RAISE NOTICE 'PRE-FLIGHT OK: 6 huerfanos backfilleables confirmados';
END $$;

-- Backfill set-based
INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
SELECT p.id, p.medico_id, NULL
FROM public.pacientes p
WHERE (p.activo IS TRUE OR p.activo IS NULL)
  AND p.medico_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.paciente_medico pm WHERE pm.paciente_id = p.id
  );

-- Post-flight: tras el backfill NO debe quedar ningún huérfano activo
DO $$
DECLARE
  v_restantes int;
BEGIN
  SELECT count(*) INTO v_restantes
  FROM public.pacientes p
  WHERE (p.activo IS TRUE OR p.activo IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM public.paciente_medico pm WHERE pm.paciente_id = p.id
    );
  IF v_restantes <> 0 THEN
    RAISE EXCEPTION 'POST-FLIGHT: quedan % huerfanos activos (esperado 0) — revisar', v_restantes;
  END IF;
  RAISE NOTICE 'POST-FLIGHT OK: 0 huerfanos activos — backfill completo';
END $$;

COMMIT;

-- ── ROLLBACK (DOWN) — referencia, no se ejecuta ──────────────
-- No hay DOWN trivial: las filas del backfill (asignado_por NULL)
-- no se distinguen por sí solas de las 111 del backfill de 5.B.2.
-- Si se necesitara revertir, identificar las 6 filas por su
-- created_at de la fecha de esta migración.
