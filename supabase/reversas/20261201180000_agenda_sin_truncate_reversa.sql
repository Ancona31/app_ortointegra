-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de supabase/migrations/20261201180000_agenda_sin_truncate.sql
-- NO es una migración: vive fuera de supabase/migrations/ para que ni la CLI
-- ni un db reset la apliquen. Se pega a mano y SÓLO si Angel lo pide: deja a
-- postgres y supabase_admin vaciar con TRUNCATE las tablas de la agenda con
-- datos de personas (TRUNCATE no pasa por la RLS ni por la auditoría).
-- ───────────────────────────────────────────────────────────────────────
-- Quita los 11 disparadores trg_<tabla>_sin_truncate de la agenda (las tablas
-- que no existan se saltan). NO toca public.prohibir_truncate() ni los 11
-- disparadores de 20261126120000, que son de esa migración, y NO devuelve
-- TRUNCATE a nadie: en el ensayo la migración no quitó ninguno (fila 4 de su
-- rejilla = 0). Si en producción esa fila listó alguna tabla, devolver ese
-- privilegio es decisión aparte de Angel (reabriría el hueco).
-- Va ANTES que las reversas del conjunto fundido (F5b … F1), que borran estas
-- tablas.
-- Ensayo: clon de la foto de producción, 2026-11-22 (ver la cabecera de la ida).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  v_tablas constant text[] := ARRAY['agenda_bloqueos', 'avisos_clinica', 'cita_confirmaciones', 'cita_correos',
    'cita_reagendos', 'gcal_movimientos_rechazados', 'reserva_contactos', 'reserva_empalmes_google',
    'reserva_enlaces', 'reserva_incidencias', 'reserva_verificaciones'];
  v_t text;
BEGIN
  FOREACH v_t IN ARRAY v_tablas LOOP
    IF to_regclass('public.' || v_t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || v_t || '_sin_truncate', v_t);
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparadores sin_truncate de la agenda que quedan' AS comprobacion,
         (SELECT count(*)::text FROM pg_trigger g
           WHERE g.tgname LIKE 'trg\_%\_sin\_truncate' AND NOT g.tgisinternal
             AND g.tgrelid IN (SELECT to_regclass('public.' || x) FROM unnest(ARRAY['agenda_bloqueos', 'avisos_clinica',
               'cita_confirmaciones', 'cita_correos', 'cita_reagendos', 'gcal_movimientos_rechazados', 'reserva_contactos',
               'reserva_empalmes_google', 'reserva_enlaces', 'reserva_incidencias', 'reserva_verificaciones']) x)) AS valor,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'disparadores sin_truncate de 20261126120000, intactos',
         (SELECT count(*)::text FROM pg_trigger g WHERE g.tgname LIKE 'trg\_%\_sin\_truncate' AND NOT g.tgisinternal),
         '11'
  UNION ALL
  SELECT 3, 'public.prohibir_truncate() sigue', (to_regprocedure('public.prohibir_truncate()') IS NOT NULL)::text,
         'true'
) t
ORDER BY t.n;
