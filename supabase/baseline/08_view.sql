-- =============================================================================
-- 08_view.sql
-- Vistas del schema public.
--
-- Aplicar después de 02_tables.sql (depende de audit_log y profiles).
-- =============================================================================


CREATE OR REPLACE VIEW public.audit_log_view AS
SELECT
  a.id,
  a.user_id,
  p.nombre AS usuario_nombre,
  u.email  AS usuario_email,
  a.accion,
  a.tabla,
  a.registro_id,
  a.ip,
  a.descripcion,
  a.created_at
FROM public.audit_log a
LEFT JOIN public.profiles p ON p.id::text = a.user_id
LEFT JOIN auth.users      u ON u.id::text = a.user_id
ORDER BY a.created_at DESC;
