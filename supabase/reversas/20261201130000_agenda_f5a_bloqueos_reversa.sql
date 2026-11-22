-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201130000_agenda_f5a_bloqueos.sql (F5a).
-- Quita la tabla agenda_bloqueos (con sus índices, policies y disparadores,
-- que caen con ella sin CASCADE) y agenda_bloqueo_preparar().
-- Orden del conjunto: va DESPUÉS de quitar F5b, F4, F2 y F3. F3
-- (reserva_ocupacion, reservar_por_enlace), F2 (gcal_bloqueo_aplicar) y F5b
-- (cita_proteger_bloqueo) nombran la tabla en su cuerpo; el catálogo no lo
-- registra como dependencia, así que la reversa lo comprueba y aborta si
-- alguna sigue ahí (quedaría rota en silencio).
-- ⚠️ Datos: si hay bloqueos, ABORTA. Respáldalos antes y decide; la reversa no
--   borra datos de nadie. La auditoría de esos bloqueos (audit_log) se queda.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_quien text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_quien
    FROM pg_proc p
   WHERE p.prosrc LIKE '%agenda_bloqueos%' AND p.oid <> coalesce(to_regprocedure('public.agenda_bloqueo_preparar()'), 0);
  IF v_quien IS NOT NULL THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: estas funciones todavía nombran agenda_bloqueos: %. Quita antes F5b, F2 y F3 (orden inverso de bloques).', v_quien;
  END IF;
  IF to_regclass('public.agenda_bloqueos') IS NOT NULL AND EXISTS (SELECT 1 FROM public.agenda_bloqueos) THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: public.agenda_bloqueos tiene filas. Respáldalas antes; la reversa no borra datos.';
  END IF;
END $$;

DROP TABLE IF EXISTS public.agenda_bloqueos;
DROP FUNCTION IF EXISTS public.agenda_bloqueo_preparar();

DO $$
BEGIN
  IF to_regclass('public.agenda_bloqueos') IS NOT NULL OR to_regprocedure('public.agenda_bloqueo_preparar()') IS NOT NULL THEN
    RAISE EXCEPTION 'REVERSA: quedó algún objeto de F5a.';
  END IF;
END $$;

COMMIT;

SELECT 'F5a quitada' AS resultado;
