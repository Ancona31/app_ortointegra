-- =============================================================================
-- 20260427_b1_02_sa_functions_role_check.sql
--
-- Propósito:
--   Añadir verificación interna de rol al inicio de las 4 funciones
--   `sa_*` (SECURITY DEFINER) de modo que no puedan ser invocadas por
--   usuarios authenticated que no sean `super_admin`.
--
-- Hallazgo Fase A que corrige:
--   C3 — `Funciones sa_* son SECURITY DEFINER sin check interno de rol`
--   (docs/schema-recovery-report-final.md líneas 108-115).
--   Cualquier usuario autenticado puede invocar
--     POST /rest/v1/rpc/sa_top_medicos
--   y leer agregados de actividad de toda la plataforma, incluyendo el
--   cruce de audit_log con nombre del médico y nombre de clínica.
--
-- Riesgo estimado: MEDIO.
--   - El endpoint actual `/api/super-admin/dashboard/uso/route.ts`
--     invoca las 4 funciones vía `admin.rpc(...)` (service_role client).
--     Un check estricto `IF get_my_role() != 'super_admin'` rompería ese
--     endpoint porque service_role tiene `auth.uid() = NULL`, lo que
--     hace que `get_my_role()` devuelva NULL, y aunque `NULL != 'super_admin'`
--     evalúa NULL (no TRUE) — el riesgo de regresión silenciosa es alto.
--   - Solución aplicada: check DUAL que permite explícitamente
--     `auth.role() = 'service_role'` Y/O `get_my_role() = 'super_admin'`.
--     Defense-in-depth: el endpoint server ya valida super_admin con
--     `requireSuperAdmin()`; este check añade barrera adicional para
--     bloquear invocaciones directas vía PostgREST con JWT de
--     authenticated.
--
-- Decisión de diseño aplicada (presentar en reporte):
--   - Cambio `LANGUAGE sql` → `LANGUAGE plpgsql`. Necesario para tener
--     control de flujo (IF/RAISE). Firma de cada función se mantiene
--     IDÉNTICA (mismo nombre, mismos parámetros, mismo RETURNS TABLE),
--     por lo que `admin.rpc('sa_top_medicos', { dias_atras, limite })`
--     y consumers JS no requieren cambios.
--   - Conservo `SET search_path TO 'public'` que ya tenían (no parte
--     del scope de B1.03, pero ya está bien).
--   - Uso `GROUP BY 1, 2` y `ORDER BY 1, 2` (posicionales) en
--     `sa_heatmap_horarios` para evitar cualquier colisión potencial
--     entre alias de columnas y nombres de variables del RETURNS TABLE
--     bajo plpgsql.
--   - Mantengo el cuerpo de cada SELECT funcionalmente idéntico al
--     baseline (mismas WHERE, GROUP BY, ORDER BY, LIMIT, expresiones).
--
-- Hallazgo de auditoría de código (relevante):
--   Búsqueda en src/, app/, lib/, components/, scripts/:
--     - sa_ranking_funciones: 1 llamada (super-admin/dashboard/uso)
--     - sa_heatmap_horarios:  1 llamada (super-admin/dashboard/uso)
--     - sa_top_medicos:       1 llamada (super-admin/dashboard/uso)
--     - sa_uso_ia:            1 llamada (super-admin/dashboard/uso)
--   Todas vía `admin.rpc(...)` con service_role, en ruta protegida por
--   `requireSuperAdmin()`. Ningún call-site espera estas funciones
--   desde código de médico/admin de clínica/secretaria.
--
-- Smoke tests recomendados (post-aplicación):
--   1) Como super_admin autenticado vía endpoint normal:
--        GET /api/super-admin/dashboard/uso
--      → 200 OK con payload completo (rankingFunciones, heatmap,
--        topMedicos, usoIA).
--   2) Como médico autenticado, simulando ataque directo:
--        curl -X POST $SUPABASE_URL/rest/v1/rpc/sa_top_medicos \
--             -H "apikey: $ANON_KEY" \
--             -H "Authorization: Bearer $JWT_MEDICO" \
--             -H "Content-Type: application/json" \
--             -d '{"dias_atras": 30, "limite": 10}'
--      → 500 / SQL exception "unauthorized: super_admin required"
--        (errcode 42501, "insufficient_privilege").
--   3) Como service_role (simulando endpoint server interno):
--        curl -X POST $SUPABASE_URL/rest/v1/rpc/sa_top_medicos \
--             -H "apikey: $SERVICE_ROLE_KEY" \
--             -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--             -H "Content-Type: application/json" \
--             -d '{"dias_atras": 30, "limite": 10}'
--      → 200 OK con datos.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

-- sa_heatmap_horarios -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.sa_heatmap_horarios(dias_atras integer DEFAULT 90)
RETURNS TABLE(hora integer, dia_semana integer, total bigint)
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
    EXTRACT(hour FROM al.created_at AT TIME ZONE 'America/Mexico_City')::int,
    EXTRACT(dow  FROM al.created_at AT TIME ZONE 'America/Mexico_City')::int,
    count(*)::bigint
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$function$;


-- sa_ranking_funciones ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.sa_ranking_funciones(limite integer DEFAULT 20)
RETURNS TABLE(accion text, total bigint)
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
    al.accion::text,
    count(*)::bigint
  FROM public.audit_log al
  GROUP BY al.accion
  ORDER BY 2 DESC
  LIMIT limite;
END;
$function$;


-- sa_top_medicos ----------------------------------------------------------
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
    COALESCE(p.nombre, '(sin perfil)')::text,
    c.nombre::text,
    count(*)::bigint
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id::text = al.user_id
  LEFT JOIN public.clinicas c ON c.id = p.clinica_id
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND al.user_id IS NOT NULL
    AND al.user_id <> 'anonymous'
  GROUP BY al.user_id, p.nombre, c.nombre
  ORDER BY 4 DESC
  LIMIT limite;
END;
$function$;


-- sa_uso_ia ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sa_uso_ia(dias_atras integer DEFAULT 30)
RETURNS TABLE(accion text, total bigint)
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
    al.accion::text,
    count(*)::bigint
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND (al.accion LIKE 'ia_%'
         OR al.accion IN ('generar_pdf', 'nota_generada', 'receta_generada', 'enviar_documento'))
  GROUP BY al.accion
  ORDER BY 2 DESC;
END;
$function$;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Restaura las definiciones EXACTAS del baseline (supabase/baseline/05_functions.sql,
-- líneas 277-348). Mantiene LANGUAGE sql original y elimina el role check.
--
-- IMPORTANTE: bloque comentado para evitar ejecución silenciosa si se pega
-- el archivo completo en SQL Editor. Para revertir manualmente, descomentar
-- las líneas siguientes y ejecutarlas.

-- CREATE OR REPLACE FUNCTION public.sa_heatmap_horarios(dias_atras integer DEFAULT 90)
-- RETURNS TABLE(hora integer, dia_semana integer, total bigint)
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path TO 'public'
-- AS $function$
--   SELECT
--     EXTRACT(hour FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS hora,
--     EXTRACT(dow  FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS dia_semana,
--     count(*)::bigint AS total
--   FROM public.audit_log
--   WHERE created_at >= now() - make_interval(days => dias_atras)
--   GROUP BY hora, dia_semana
--   ORDER BY hora, dia_semana
-- $function$;

-- CREATE OR REPLACE FUNCTION public.sa_ranking_funciones(limite integer DEFAULT 20)
-- RETURNS TABLE(accion text, total bigint)
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path TO 'public'
-- AS $function$
--   SELECT
--     al.accion::text,
--     count(*)::bigint AS total
--   FROM public.audit_log al
--   GROUP BY al.accion
--   ORDER BY total DESC
--   LIMIT limite
-- $function$;

-- CREATE OR REPLACE FUNCTION public.sa_top_medicos(dias_atras integer DEFAULT 30, limite integer DEFAULT 10)
-- RETURNS TABLE(user_id text, nombre text, clinica_nombre text, total bigint)
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path TO 'public'
-- AS $function$
--   SELECT
--     al.user_id::text,
--     COALESCE(p.nombre, '(sin perfil)')::text AS nombre,
--     c.nombre::text AS clinica_nombre,
--     count(*)::bigint AS total
--   FROM public.audit_log al
--   LEFT JOIN public.profiles p ON p.id::text = al.user_id
--   LEFT JOIN public.clinicas c ON c.id = p.clinica_id
--   WHERE al.created_at >= now() - make_interval(days => dias_atras)
--     AND al.user_id IS NOT NULL
--     AND al.user_id <> 'anonymous'
--   GROUP BY al.user_id, p.nombre, c.nombre
--   ORDER BY total DESC
--   LIMIT limite
-- $function$;

-- CREATE OR REPLACE FUNCTION public.sa_uso_ia(dias_atras integer DEFAULT 30)
-- RETURNS TABLE(accion text, total bigint)
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path TO 'public'
-- AS $function$
--   SELECT
--     al.accion::text,
--     count(*)::bigint AS total
--   FROM public.audit_log al
--   WHERE al.created_at >= now() - make_interval(days => dias_atras)
--     AND (al.accion LIKE 'ia_%'
--          OR al.accion IN ('generar_pdf', 'nota_generada', 'receta_generada', 'enviar_documento'))
--   GROUP BY al.accion
--   ORDER BY total DESC
-- $function$;


-- -----------------------------------------------------------------------------
-- Verificación post-aplicación
-- -----------------------------------------------------------------------------
-- Pegar en SQL Editor:
--
-- SELECT
--   p.proname,
--   pg_get_functiondef(p.oid) AS definicion
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('sa_heatmap_horarios', 'sa_ranking_funciones',
--                     'sa_top_medicos', 'sa_uso_ia')
-- ORDER BY p.proname;
--
-- Confirmar en `definicion` de cada una:
--   - LANGUAGE plpgsql
--   - SECURITY DEFINER
--   - SET search_path TO 'public'
--   - El cuerpo contiene
--     "IF auth.role() <> 'service_role' AND coalesce(public.get_my_role(), '') <> 'super_admin'"
--     y "RAISE EXCEPTION 'unauthorized: super_admin required'".
