-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de supabase/migrations/20261125170000_audit_log_sin_truncate.sql
-- NO es una migración: vive fuera de supabase/migrations/ para que ni la CLI
-- ni un db reset la apliquen. Se pega a mano y SÓLO si Angel lo pide:
-- reabre el hueco (TRUNCATE no pasa por la RLS ni dispara los disparadores de
-- fila, así que deja vaciar audit_log sin rastro).
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE: deja audit_log como estaba antes de la migración:
--   · quita el disparador prevent_audit_truncate;
--   · devuelve TRUNCATE sobre public.audit_log a anon, authenticated y
--     service_role (los tres lo tenían en producción antes de la migración,
--     concedido por postgres: foto de la estructura de producción).
--   No toca prevent_audit_modification(), prevent_audit_delete,
--   prevent_audit_update, las policies ni ninguna fila. No hace TRUNCATE.
-- DEPENDE DE: que la migración esté aplicada (si no, aborta sin tocar nada) y
--   que la de 20261126120000_public_sin_truncate NO lo esté (su invariante es
--   «ningún TRUNCATE para esos roles en public»): se corre DESPUÉS de su
--   reversa; si public.prohibir_truncate() existe todavía, aborta.
-- RIESGO: bajo. GRANT sólo escribe catálogo; DROP TRIGGER toma ACCESS
--   EXCLUSIVE un instante sobre audit_log (lock_timeout 5 s: si está ocupada,
--   aborta entera sin cambiar nada). Una transacción.
-- GUARDA DE DATOS: ninguna (no se niega por datos; sólo por el estado del
--   catálogo, ver el pre-vuelo). Se corre SÓLO por orden de Angel.
-- SEGUNDA PASADA: aborta limpio (la migración ya no está).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: no existe public.audit_log.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
                  WHERE t.tgrelid = 'public.audit_log'::regclass AND t.tgname = 'prevent_audit_truncate'
                    AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: 20261125170000 no está aplicada (no existe prevent_audit_truncate). No se toca nada.';
  END IF;
  IF to_regprocedure('public.prohibir_truncate()') IS NOT NULL THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: 20261126120000_public_sin_truncate sigue aplicada (existe public.prohibir_truncate()). Corre antes su reversa.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_catalog.pg_class WHERE oid = 'public.audit_log'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: el rol % no es dueño de public.audit_log.', current_user;
  END IF;
END $$;

DROP TRIGGER prevent_audit_truncate ON public.audit_log;
GRANT TRUNCATE ON TABLE public.audit_log TO anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
              WHERE t.tgrelid = 'public.audit_log'::regclass AND t.tgname = 'prevent_audit_truncate')
     OR NOT has_table_privilege('anon', 'public.audit_log', 'TRUNCATE')
     OR NOT has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE')
     OR NOT has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE') THEN
    RAISE EXCEPTION 'REVERSA: audit_log no quedó como antes de la migración.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor
FROM (
  SELECT 1 AS n, 'TRUNCATE: anon / authenticated / service_role' AS comprobacion,
         has_table_privilege('anon', 'public.audit_log', 'TRUNCATE')::text
           || ' / ' || has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE')::text
           || ' / ' || has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE')::text AS valor
  UNION ALL
  SELECT 2, 'disparadores de audit_log que quedan',
         coalesce((SELECT string_agg(t.tgname || ':' || t.tgenabled::text, ',' ORDER BY t.tgname) FROM pg_catalog.pg_trigger t
                    WHERE t.tgrelid = 'public.audit_log'::regclass AND NOT t.tgisinternal), 'NINGUNO')
) t
ORDER BY t.n;
