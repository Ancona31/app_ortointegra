-- ============================================================
-- Etapa 5.B.3 — Trigger latch de clinicas.ha_tenido_acceso_premium
-- Fecha: 2026-05-21 · Protocolo D-T6
-- Repara el mantenimiento de la columna (estaba congelada desde el
-- backfill del 2026-05-18). El diagnostico confirmo 0 clinicas
-- desincronizadas, por lo que NO incluye backfill correctivo.
-- Aplicado a produccion y verificado (chunks 1-3 OK, smoke test
-- del one-way confirmado).
-- ============================================================

-- ---------- UP ----------
DO $$
BEGIN
  -- PRE-FLIGHT
  IF to_regclass('public.clinicas') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: tabla clinicas no encontrada. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinicas'
      AND column_name='ha_tenido_acceso_premium') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: clinicas.ha_tenido_acceso_premium no existe. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinicas'
      AND column_name='es_vip_grant') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: clinicas.es_vip_grant no existe. Abortando.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinicas'
      AND column_name='stripe_subscription_id') THEN
    RAISE EXCEPTION 'PRE-FLIGHT FALLO: clinicas.stripe_subscription_id no existe. Abortando.';
  END IF;

  -- CAMBIO 1: funcion trigger
  CREATE OR REPLACE FUNCTION public.clinicas_latch_premium()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, pg_temp
  AS $function$
  BEGIN
    IF NEW.es_vip_grant IS TRUE
       OR NEW.stripe_subscription_id IS NOT NULL THEN
      NEW.ha_tenido_acceso_premium := true;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.ha_tenido_acceso_premium IS TRUE THEN
        NEW.ha_tenido_acceso_premium := true;
      END IF;
    END IF;

    RETURN NEW;
  END;
  $function$;

  COMMENT ON FUNCTION public.clinicas_latch_premium() IS
    'Latch one-way de ha_tenido_acceso_premium: true cuando es_vip_grant o stripe_subscription_id; nunca vuelve a false (5.B.3).';

  -- CAMBIO 2: el trigger
  DROP TRIGGER IF EXISTS trg_clinicas_latch_premium ON public.clinicas;
  CREATE TRIGGER trg_clinicas_latch_premium
    BEFORE INSERT OR UPDATE ON public.clinicas
    FOR EACH ROW
    EXECUTE FUNCTION public.clinicas_latch_premium();

  -- POST-FLIGHT
  IF NOT EXISTS (SELECT 1 FROM pg_proc
    WHERE proname='clinicas_latch_premium' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: funcion clinicas_latch_premium no se creo. Rollback automatico.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgname='trg_clinicas_latch_premium' AND tgrelid='public.clinicas'::regclass
      AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'POST-FLIGHT FALLO: trigger trg_clinicas_latch_premium no se creo. Rollback automatico.';
  END IF;

  RAISE NOTICE '5.B.3 aplicado: funcion clinicas_latch_premium + trigger trg_clinicas_latch_premium creados.';
END $$;

-- ---------- DOWN (rollback) ----------
-- DO $$
-- BEGIN
--   DROP TRIGGER IF EXISTS trg_clinicas_latch_premium ON public.clinicas;
--   DROP FUNCTION IF EXISTS public.clinicas_latch_premium();
--   RAISE NOTICE '5.B.3 revertido: trigger y funcion eliminados.';
-- END $$;
