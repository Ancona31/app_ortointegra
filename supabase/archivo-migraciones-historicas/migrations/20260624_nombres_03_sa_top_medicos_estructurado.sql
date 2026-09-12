-- =============================================================================
-- 20260624_nombres_03_sa_top_medicos_estructurado.sql
--
-- Fase 5.D del proyecto de normalización de nombres (NOMBRES_PLAN.md).
--
-- Recrea public.sa_top_medicos para que la columna de salida `nombre` se
-- componga desde los campos estructurados de profiles (titulo + nombres +
-- apellido_paterno + apellido_materno) en lugar de leer la columna legacy
-- profiles.nombre. La FIRMA no cambia (mismos parámetros, mismo RETURNS TABLE
-- user_id/nombre/clinica_nombre/total): el endpoint
-- /api/super-admin/dashboard/uso (único consumidor, vía service_role) no
-- requiere cambios.
--
-- Conserva el role check dual (service_role O super_admin) y el
-- LANGUAGE plpgsql introducidos en 20260427_b1_02_sa_functions_role_check.sql,
-- y el SET search_path TO 'public'.
--
-- La composición replica componerNombreMedicoCompleto() de
-- src/lib/nombreMedico.ts: filtra vacíos/NULL (NULLIF + concat_ws) y cae a
-- '(sin perfil)' cuando no hay profile o todos los campos están vacíos.
--
-- ESTADO: ya aplicada a mano en producción (sub-fase 5.D-2). Versionada
-- retroactivamente. Idempotente (CREATE OR REPLACE).
--
-- Cuerpo cotejado contra pg_get_functiondef de prod: idéntico (verbatim).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sa_top_medicos(dias_atras integer DEFAULT 30, limite integer DEFAULT 10)
RETURNS TABLE(user_id text, nombre text, clinica_nombre text, total bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.user_id::text,
    COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ',
        NULLIF(p.titulo, ''),
        NULLIF(p.nombres, ''),
        NULLIF(p.apellido_paterno, ''),
        NULLIF(p.apellido_materno, '')
      )), ''),
      '(sin perfil)'
    )::text,
    c.nombre::text,
    count(*)::bigint
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id::text = al.user_id
  LEFT JOIN public.clinicas c ON c.id = p.clinica_id
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND al.user_id IS NOT NULL
    AND al.user_id <> 'anonymous'
  GROUP BY al.user_id, p.titulo, p.nombres, p.apellido_paterno, p.apellido_materno, c.nombre
  ORDER BY 4 DESC
  LIMIT limite;
END;
$function$;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Restaura la versión previa (la de b1_02: plpgsql + role check, componiendo
-- desde la columna legacy profiles.nombre). Bloque comentado para evitar
-- ejecución silenciosa. Solo válido mientras profiles.nombre exista (pre-Fase 6).
--
-- CREATE OR REPLACE FUNCTION public.sa_top_medicos(dias_atras integer DEFAULT 30, limite integer DEFAULT 10)
-- RETURNS TABLE(user_id text, nombre text, clinica_nombre text, total bigint)
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO 'public'
-- AS $function$
-- BEGIN
--   IF auth.role() <> 'service_role'
--      AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
--     RAISE EXCEPTION 'unauthorized: super_admin required'
--       USING ERRCODE = '42501';
--   END IF;
--
--   RETURN QUERY
--   SELECT
--     al.user_id::text,
--     COALESCE(p.nombre, '(sin perfil)')::text,
--     c.nombre::text,
--     count(*)::bigint
--   FROM public.audit_log al
--   LEFT JOIN public.profiles p ON p.id::text = al.user_id
--   LEFT JOIN public.clinicas c ON c.id = p.clinica_id
--   WHERE al.created_at >= now() - make_interval(days => dias_atras)
--     AND al.user_id IS NOT NULL
--     AND al.user_id <> 'anonymous'
--   GROUP BY al.user_id, p.nombre, c.nombre
--   ORDER BY 4 DESC
--   LIMIT limite;
-- END;
-- $function$;
