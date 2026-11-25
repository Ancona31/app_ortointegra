-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de M5 (20261205120000_gcal_empalmes_pendientes.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE: quita los dos disparadores de appointments, las dos funciones y la
--   tabla public.gcal_empalmes_pendientes.
-- QUÉ VUELVE: AG-DT-264 (los empalmes pendientes vuelven a vivir sólo en la
--   memoria del servidor). El código nuevo no encuentra la función (PGRST202) y
--   cae solo en ese camino.
-- QUÉ SE PIERDE: los apuntes que hubiera en la cola (citas cuyos empalmes
--   faltaban por mirar). Para no perderlos, ANTES de revertir: dejar correr una
--   pasada de la sincronización, o llamar como service_role a
--   reserva_empalmes_pendientes_procesar(<clínica>) por cada clínica con apuntes.
-- GUARDA DE DATOS (dimensión 31; copiada en plan/reversa-previa.sql): se NIEGA
--   si quedan apuntes, salvo con SET LOCAL spinus.reversa_con_datos = 'si'.
--     SELECT count(*) FROM public.gcal_empalmes_pendientes;
-- ORDEN EN LA CADENA: antes que la de F2 (usa reserva_empalmes_registrar).
--   Respecto de M4, MA y M3 es indiferente.
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS).
-- Bloqueos: SHARE ROW EXCLUSIVE sobre appointments (DROP TRIGGER), en un bloque.
-- Ensayo: stack local, 2026-11-25: ida, reversa, ida otra vez; y con un apunte
--   en la cola (se niega; con la confirmación, sigue).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  v_n bigint := 0;
BEGIN
  IF to_regclass('public.gcal_empalmes_pendientes') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM public.gcal_empalmes_pendientes;
  END IF;
  IF v_n > 0 AND coalesce(current_setting('spinus.reversa_con_datos', true), '') <> 'si' THEN
    RAISE EXCEPTION 'REVERSA de M5 ABORTADA: quedan % apunte(s) en gcal_empalmes_pendientes (empalmes por mirar). Procésalos antes, o confirma la pérdida con SET LOCAL spinus.reversa_con_datos = ''si''. No se tocó nada.', v_n;
  END IF;
  IF v_n > 0 THEN
    RAISE WARNING 'REVERSA de M5 CON DATOS: se pierden % apunte(s) de gcal_empalmes_pendientes.', v_n;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_appointments_empalme_google_alta ON public.appointments;
    DROP TRIGGER IF EXISTS trg_appointments_empalme_google_cambio ON public.appointments;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.reserva_empalmes_pendientes_procesar(uuid, integer);
DROP FUNCTION IF EXISTS public.gcal_empalme_apuntar();
DROP TABLE IF EXISTS public.gcal_empalmes_pendientes;

COMMIT;

SELECT 1 AS n, 'tabla, funciones y disparadores de M5 que quedan' AS comprobacion,
       ((to_regclass('public.gcal_empalmes_pendientes') IS NOT NULL)::int
        + (to_regprocedure('public.gcal_empalme_apuntar()') IS NOT NULL)::int
        + (to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') IS NOT NULL)::int
        + (SELECT count(*) FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
             AND tgname IN ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio')))::text AS valor,
       '0' AS esperado,
       CASE WHEN to_regclass('public.gcal_empalmes_pendientes') IS NULL
                 AND to_regprocedure('public.gcal_empalme_apuntar()') IS NULL
                 AND to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') IS NULL
                 AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
                                   AND tgname IN ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio'))
            THEN 'OK' ELSE 'REVISAR' END AS estado;
