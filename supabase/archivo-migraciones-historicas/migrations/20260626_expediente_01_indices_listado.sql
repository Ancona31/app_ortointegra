-- ═══════════════════════════════════════════════════════════
-- Expediente — Paso 1: índices para la lista "Expediente Clínico"
-- Propuesto: 2026-06-26  ·  Aplicado a producción: (PENDIENTE — auditoría)
-- ═══════════════════════════════════════════════════════════
--
-- QUÉ CREA
--   1. idx_pacientes_nombre_trgm     — GIN pg_trgm sobre pacientes.nombre
--   2. idx_pacientes_apellidos_trgm  — GIN pg_trgm sobre pacientes.apellidos
--   3. idx_pacientes_clinica_activo_created — btree compuesto
--        (clinica_id, activo, created_at DESC)
--
-- POR QUÉ DOS GIN SEPARADOS (no uno combinado)
--   La búsqueda es `nombre ILIKE '%term%' OR apellidos ILIKE '%term%'`
--   (HECHO sub-fase 1; replicado en el RPC del Paso 2). Un btree NO sirve
--   un patrón con comodín a la izquierda; pg_trgm sí. Con DOS índices
--   por columna el planner hace BitmapOr (uno por rama del OR). Un índice
--   combinado sobre la expresión `(nombre||' '||apellidos)` solo se usaría
--   reescribiendo el predicado a ILIKE sobre la concatenación —cambia la
--   semántica (matchearía cruzando el límite nombre/apellido)— y no es como
--   consulta la UI. Mismo criterio que el baseline ya aplica a cat_cie10:
--   idx_cie10_trgm_codigo + idx_cie10_trgm_desc, dos índices separados
--   (supabase/baseline/03_indexes.sql:59-62). pg_trgm YA está instalado
--   (supabase/baseline/01_extensions.sql:9).
--
-- POR QUÉ EL COMPUESTO (clinica_id, activo, created_at)
--   La RLS de pacientes inyecta en TODA lectura el predicado
--   `clinica_id = get_clinica_id() AND (activo = true OR activo IS NULL)`
--   (20260524_etapa5e_bd1_policies_pacientes.sql:51-60). Las columnas
--   líderes del índice (clinica_id, activo) calzan EXACTO con ese predicado;
--   el created_at final cubre el orden por defecto (ingreso reciente arriba).
--   El parcial existente idx_pacientes_created_activo (created_at DESC sin
--   clinica_id, 03_indexes.sql:129-130) no acota por clínica, por eso no basta.
--   NO se crea el compuesto de apellidos (diferido a optimización medible).
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ DECISIÓN ABIERTA Nº1 — CONCURRENTLY vs índice normal en transacción   │
-- │ RECOMENDACIÓN: índice NORMAL dentro de BEGIN/COMMIT (lo de abajo).     │
-- │                                                                        │
-- │ Justificación por TAMAÑO REAL: pacientes es una tabla pequeña en TODAS │
-- │ las clínicas. El backfill de paciente_medico fue de 111 filas — 1 por  │
-- │ paciente con médico (20260521_etapa5b2_paciente_medico.sql, cabecera). │
-- │ Aun con crecimiento posterior estamos en el orden de cientos de filas. │
-- │ A ese volumen un CREATE INDEX normal toma milisegundos y el ACCESS     │
-- │ EXCLUSIVE lock es imperceptible.                                       │
-- │                                                                        │
-- │ CONCURRENTLY (a) NO puede correr dentro de transacción —rompería el    │
-- │ patrón BEGIN/COMMIT que el proyecto exige porque aplica statement-by-  │
-- │ statement en el SQL Editor (CLAUDE.md §Base de datos)— y (b) deja un   │
-- │ índice INVALID si falla a media construcción, requiriendo limpieza     │
-- │ manual. Su único beneficio (no bloquear escrituras) es irrelevante en  │
-- │ una tabla de este tamaño. Por eso: índice normal, transaccional.       │
-- │ → CONFIRMAR antes de aplicar.                                          │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- UNIDAD DE APLICACIÓN (protocolo D-T6): BEGIN; … COMMIT; explícito, como el
-- resto del proyecto. Si PRE/POST-FLIGHT fallan (RAISE EXCEPTION) la tx aborta
-- y NO deja índices a medio crear.
--
-- ── ROLLBACK (DOWN) — referencia, NO se ejecuta ──────────────
--   DROP INDEX IF EXISTS public.idx_pacientes_nombre_trgm;
--   DROP INDEX IF EXISTS public.idx_pacientes_apellidos_trgm;
--   DROP INDEX IF EXISTS public.idx_pacientes_clinica_activo_created;
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- ─── PRE-FLIGHT ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: extensión pg_trgm no instalada. Abortando.';
  END IF;
  IF to_regclass('public.pacientes') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla pacientes no encontrada. Abortando.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pacientes'
      AND column_name IN ('nombre','apellidos','clinica_id','activo','created_at')
    GROUP BY table_name HAVING count(*) = 5
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: faltan columnas requeridas en pacientes. Abortando.';
  END IF;
  RAISE NOTICE 'PRE-FLIGHT OK: pg_trgm presente; pacientes con las 5 columnas requeridas.';
END $$;

-- ─── CAMBIO: 3 índices (idempotentes) ────────────────────────
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre_trgm
  ON public.pacientes USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pacientes_apellidos_trgm
  ON public.pacientes USING gin (apellidos gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pacientes_clinica_activo_created
  ON public.pacientes USING btree (clinica_id, activo, created_at DESC);

-- ─── POST-FLIGHT ─────────────────────────────────────────────
DO $$
DECLARE
  v_faltan text;
BEGIN
  SELECT string_agg(esperado, ', ')
    INTO v_faltan
  FROM (VALUES
    ('idx_pacientes_nombre_trgm'),
    ('idx_pacientes_apellidos_trgm'),
    ('idx_pacientes_clinica_activo_created')
  ) AS e(esperado)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'pacientes'
      AND indexname = e.esperado
  );

  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: no se crearon los índices: %. Rollback automático.', v_faltan;
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: 3 índices presentes (2 GIN trgm + 1 btree compuesto).';
END $$;

COMMIT;
