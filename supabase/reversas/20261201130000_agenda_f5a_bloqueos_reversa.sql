-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201130000_agenda_f5a_bloqueos.sql (F5a)
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE: quita la tabla agenda_bloqueos (con sus índices, policies y
--   disparadores, que caen con ella sin CASCADE) y agenda_bloqueo_preparar().
-- DEPENDE DE: va DESPUÉS de las reversas de F5b, F4, F2 y F3. F3
--   (reserva_ocupacion, reservar_por_enlace), F2 (gcal_bloqueo_aplicar) y F5b
--   (cita_proteger_bloqueo) nombran la tabla en su cuerpo; el catálogo no lo
--   registra como dependencia, así que la reversa lo comprueba y aborta si
--   alguna sigue ahí (quedaría rota en silencio).
-- DATOS: si agenda_bloqueos tiene filas, ABORTA sin tocar nada. Para quitarla
--   igualmente (se pierden esos bloqueos), respáldalos y confírmalo:
--     CREATE TABLE respaldos.agenda_bloqueos_AAAAMMDD AS SELECT * FROM public.agenda_bloqueos;
--   y añade «SET LOCAL spinus.reversa_con_datos = 'si';» justo después del
--   BEGIN de este archivo (o corre «SET spinus.reversa_con_datos = 'si';» en
--   la misma sesión antes de él). La auditoría de esos bloqueos se queda.
-- GUARDA DE DATOS, SIN CORRER LA REVERSA (auditoría ronda 1, A5): consulta de
--   SÓLO LECTURA con la misma condición que la negativa de abajo, para
--   comprobar TODA la cadena de reversas antes de deshacer la primera. Con la
--   migración aplicada; 0 filas = esta reversa no se negará por datos.
--     SELECT 'F5a: agenda_bloqueos' AS motivo, count(*) FROM public.agenda_bloqueos HAVING count(*) > 0;
-- RIESGO: bajo. DROP TABLE de una tabla propia; las FK hacia clinicas y
--   profiles caen con ella (ACCESS EXCLUSIVE sobre agenda_bloqueos y SHARE ROW
--   EXCLUSIVE un instante sobre clinicas y profiles; lock_timeout 5 s).
-- SEGUNDA PASADA: no cambia nada (todo va con IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_quien text;
  v_n     bigint;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_quien
    FROM pg_catalog.pg_proc p
   WHERE p.prosrc LIKE '%agenda_bloqueos%' AND p.oid <> coalesce(to_regprocedure('public.agenda_bloqueo_preparar()'), 0);
  IF v_quien IS NOT NULL THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: estas funciones todavía nombran agenda_bloqueos: %. Quita antes F5b, F2 y F3 (orden inverso de bloques).', v_quien;
  END IF;
  IF to_regclass('public.agenda_bloqueos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.agenda_bloqueos' INTO v_n;
    IF v_n > 0 AND current_setting('spinus.reversa_con_datos', true) IS DISTINCT FROM 'si' THEN
      RAISE EXCEPTION 'REVERSA ABORTADA: public.agenda_bloqueos tiene % fila(s) y se perderían. No se tocó nada. Respáldalas y confírmalo con spinus.reversa_con_datos = ''si'' (ver la cabecera).', v_n;
    END IF;
    IF v_n > 0 THEN
      RAISE NOTICE 'Confirmado spinus.reversa_con_datos = si: se quitan % bloqueo(s).', v_n;
    END IF;
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
