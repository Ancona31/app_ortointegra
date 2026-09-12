-- ============================================================
-- Etapa 5.B.2 — Crear tabla paciente_medico (modelo M:N) + backfill
-- Fecha: 2026-05-21 · Protocolo D-T6
-- Aplicado a produccion y verificado (chunks 5-8 OK).
-- Backfill: 111 filas (1 por paciente con medico_id no nulo).
-- ============================================================

-- ---------- UP ----------
DO $$
DECLARE
  v_pacientes_con_medico integer;
  v_filas_backfill       integer;
BEGIN
  -- PRE-FLIGHT
  IF to_regclass('public.paciente_medico') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: la tabla paciente_medico ya existe. Abortando.';
  END IF;
  IF to_regclass('public.pacientes') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla pacientes no encontrada. Abortando.';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla profiles no encontrada. Abortando.';
  END IF;

  -- Congelar pacientes: conteo y backfill ven el mismo estado.
  LOCK TABLE public.pacientes IN SHARE ROW EXCLUSIVE MODE;

  SELECT count(*) INTO v_pacientes_con_medico
  FROM public.pacientes
  WHERE medico_id IS NOT NULL;

  -- CAMBIO 1: crear la tabla
  CREATE TABLE public.paciente_medico (
    paciente_id  uuid        NOT NULL,
    medico_id    uuid        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    asignado_por uuid        NULL,
    CONSTRAINT paciente_medico_pkey
      PRIMARY KEY (paciente_id, medico_id),
    CONSTRAINT paciente_medico_paciente_id_fkey
      FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id)
      ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT paciente_medico_medico_id_fkey
      FOREIGN KEY (medico_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT paciente_medico_asignado_por_fkey
      FOREIGN KEY (asignado_por) REFERENCES public.profiles(id)
      ON DELETE SET NULL ON UPDATE NO ACTION
  );

  -- CAMBIO 2: indice secundario sobre medico_id
  CREATE INDEX idx_paciente_medico_medico
    ON public.paciente_medico(medico_id);

  -- CAMBIO 3: habilitar RLS (sin policies; policies en 5.E)
  ALTER TABLE public.paciente_medico ENABLE ROW LEVEL SECURITY;

  -- CAMBIO 4: backfill
  INSERT INTO public.paciente_medico (paciente_id, medico_id, asignado_por)
  SELECT id, medico_id, NULL
  FROM public.pacientes
  WHERE medico_id IS NOT NULL;

  GET DIAGNOSTICS v_filas_backfill = ROW_COUNT;

  -- POST-FLIGHT
  IF to_regclass('public.paciente_medico') IS NULL THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: paciente_medico no se creo. Rollback automatico.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.paciente_medico'::regclass
      AND contype  = 'p'
      AND conname  = 'paciente_medico_pkey'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: PK paciente_medico_pkey no se creo. Rollback automatico.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'paciente_medico'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: RLS no habilitada en paciente_medico. Rollback automatico.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'paciente_medico'
      AND indexname  = 'idx_paciente_medico_medico'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: idx_paciente_medico_medico no se creo. Rollback automatico.';
  END IF;

  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'public.paciente_medico'::regclass
        AND contype = 'f') <> 3 THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: se esperaban 3 FK en paciente_medico. Rollback automatico.';
  END IF;

  IF v_filas_backfill <> v_pacientes_con_medico THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: backfill inserto % filas, se esperaban %. Rollback automatico.',
      v_filas_backfill, v_pacientes_con_medico;
  END IF;

  RAISE NOTICE '5.B.2 aplicado: paciente_medico creada, RLS ON, % filas backfilleadas (esperadas: %).',
    v_filas_backfill, v_pacientes_con_medico;
END $$;

NOTIFY pgrst, 'reload schema';

-- ---------- DOWN (rollback) ----------
-- DO $$
-- BEGIN
--   DROP TABLE IF EXISTS public.paciente_medico;
--   RAISE NOTICE '5.B.2 revertido: tabla paciente_medico eliminada.';
-- END $$;
