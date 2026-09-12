-- ============================================================
-- Etapa 5.B.1 — Agregar consultas.medico_id
-- Fecha: 2026-05-21 · Protocolo D-T6
-- Aplicado a producción y verificado (4 chunks OK).
-- ============================================================

-- ---------- UP ----------
DO $$
BEGIN
  -- PRE-FLIGHT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultas'
      AND column_name = 'medico_id'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: consultas.medico_id ya existe. Abortando.';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla profiles no encontrada. Abortando.';
  END IF;

  -- CAMBIO
  ALTER TABLE public.consultas
    ADD COLUMN medico_id uuid;

  ALTER TABLE public.consultas
    ADD CONSTRAINT consultas_medico_id_fkey
    FOREIGN KEY (medico_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL ON UPDATE NO ACTION;

  CREATE INDEX idx_consultas_medico
    ON public.consultas(medico_id);

  -- POST-FLIGHT
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultas'
      AND column_name = 'medico_id'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: consultas.medico_id no se creo. Rollback automatico.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'consultas_medico_id_fkey'
      AND conrelid = 'public.consultas'::regclass
      AND contype  = 'f'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: FK consultas_medico_id_fkey no se creo. Rollback automatico.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'consultas'
      AND indexname  = 'idx_consultas_medico'
  ) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: idx_consultas_medico no se creo. Rollback automatico.';
  END IF;

  RAISE NOTICE '5.B.1 aplicado: consultas.medico_id + FK + indice creados.';
END $$;

NOTIFY pgrst, 'reload schema';

-- ---------- DOWN (rollback) ----------
-- DO $$
-- BEGIN
--   DROP INDEX IF EXISTS public.idx_consultas_medico;
--   ALTER TABLE public.consultas DROP CONSTRAINT IF EXISTS consultas_medico_id_fkey;
--   ALTER TABLE public.consultas DROP COLUMN IF EXISTS medico_id;
--   RAISE NOTICE '5.B.1 revertido.';
-- END $$;
