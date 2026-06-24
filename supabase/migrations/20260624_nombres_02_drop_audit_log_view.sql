-- =============================================================================
-- 20260624_nombres_02_drop_audit_log_view.sql
--
-- Fase 5.D del proyecto de normalización de nombres (NOMBRES_PLAN.md).
--
-- Elimina la vista huérfana public.audit_log_view. La vista hacía
--   p.nombre AS usuario_nombre
-- sobre profiles, es decir leía la columna legacy `nombre` que se elimina en
-- Fase 6. Auditoría previa: CERO consumidores en código (src/) y en DB
-- (ninguna otra vista/función/policy depende de ella). El endpoint de audit
-- log de la app no usa esta vista; consulta audit_log directamente.
--
-- Quitarla ahora despeja una dependencia de `nombre` antes del DROP de Fase 6.
--
-- ESTADO: ya aplicada a mano en producción (Fase 5.D). Versionada
-- retroactivamente. Idempotente (DROP VIEW IF EXISTS).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.audit_log_view;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Recreación EXACTA de la vista tal como existía en el baseline original
-- (supabase/baseline/08_view.sql, antes de esta migración). Bloque comentado
-- para evitar ejecución silenciosa. Nota: vuelve a referenciar profiles.nombre,
-- por lo que solo es válido mientras esa columna exista (pre-Fase 6).
--
-- CREATE OR REPLACE VIEW public.audit_log_view AS
-- SELECT
--   a.id,
--   a.user_id,
--   p.nombre AS usuario_nombre,
--   u.email  AS usuario_email,
--   a.accion,
--   a.tabla,
--   a.registro_id,
--   a.ip,
--   a.descripcion,
--   a.created_at
-- FROM public.audit_log a
-- LEFT JOIN public.profiles p ON p.id::text = a.user_id
-- LEFT JOIN auth.users      u ON u.id::text = a.user_id
-- ORDER BY a.created_at DESC;
