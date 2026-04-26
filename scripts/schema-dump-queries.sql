-- =============================================================================
-- Fase A — Recuperación READ-ONLY del schema real de prod.
--
-- Pegar cada bloque en el SQL Editor de Supabase (uno a la vez) y pegar el
-- resultado de vuelta al asistente. Ningún bloque modifica datos.
--
-- Orden sugerido: Q1 → Q11.
--
-- Todas las queries están scopeadas al schema `public`, excepto Q7 y Q8 que
-- también leen `auth.users` triggers.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Q1. Todas las tablas y views del schema public, con su owner.
-- Esperado: ~22 filas (21 tablas + 1+ views).
-- -----------------------------------------------------------------------------
SELECT
  c.relname        AS name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'matview'
    WHEN 'f' THEN 'foreign_table'
    ELSE c.relkind::text
  END              AS kind,
  pg_get_userbyid(c.relowner) AS owner,
  obj_description(c.oid, 'pg_class') AS comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','v','m','f')
ORDER BY c.relkind, c.relname;


-- -----------------------------------------------------------------------------
-- Q2. DDL completo (columnas, defaults, nullability, tipos) de TODAS las
--     tablas del schema public.
-- Formato: una fila por columna, ordenada por tabla y posición.
-- -----------------------------------------------------------------------------
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.identity_generation
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;


-- -----------------------------------------------------------------------------
-- Q3. PRIMARY KEY, UNIQUE y CHECK constraints (schema public).
-- Incluye el texto fuente del CHECK.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname        AS schema_name,
  rel.relname      AS table_name,
  con.conname      AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'x' THEN 'EXCLUDE'
    ELSE con.contype::text
  END              AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class rel  ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND con.contype IN ('p','u','c','x')
ORDER BY rel.relname, con.contype, con.conname;


-- -----------------------------------------------------------------------------
-- Q4. FOREIGN KEYS (schema public) con ON DELETE / ON UPDATE.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname                           AS schema_name,
  rel.relname                         AS table_name,
  con.conname                         AS constraint_name,
  pg_get_constraintdef(con.oid, true) AS definition,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete,
  CASE con.confupdtype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_update
FROM pg_constraint con
JOIN pg_class rel  ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND con.contype = 'f'
ORDER BY rel.relname, con.conname;


-- -----------------------------------------------------------------------------
-- Q5. Todos los índices (schema public) — incluye los implícitos de PK/FK.
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- -----------------------------------------------------------------------------
-- Q6. RLS: estado (enabled / forced) por tabla en public.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname       AS schema_name,
  c.relname       AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;


-- -----------------------------------------------------------------------------
-- Q7. RLS: policies (schema public) — nombre, comando, roles, USING, WITH CHECK.
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual       AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- -----------------------------------------------------------------------------
-- Q8. Triggers (schema public + auth.users) con definición completa.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname     AS schema_name,
  c.relname     AS table_name,
  t.tgname      AS trigger_name,
  pg_get_triggerdef(t.oid, true) AS definition,
  t.tgenabled   AS enabled_state
FROM pg_trigger t
JOIN pg_class c    ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = 'users'))
ORDER BY n.nspname, c.relname, t.tgname;


-- -----------------------------------------------------------------------------
-- Q9. Funciones custom del schema public — firma + cuerpo completo.
-- Excluye funciones de extensiones (pg_trgm, etc.) por owner = postgres sin
-- extowner. Mejor: filtramos por pg_depend para excluir las de extensiones.
-- -----------------------------------------------------------------------------
SELECT
  n.nspname        AS schema_name,
  p.proname        AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid)             AS returns,
  l.lanname        AS language,
  p.prosecdef      AS security_definer,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.objid = p.oid AND d.deptype = 'e'
  )
ORDER BY p.proname;


-- -----------------------------------------------------------------------------
-- Q10. ENUM types en el schema public (si los hay).
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  t.typname AS enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e       ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname
ORDER BY t.typname;


-- -----------------------------------------------------------------------------
-- Q11. Vistas (schema public) — definición fuente.
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;


-- -----------------------------------------------------------------------------
-- Q12. (OPCIONAL) Storage buckets definidos — para confirmar cuáles existen
-- aunque el repo declare algunos.
-- -----------------------------------------------------------------------------
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
ORDER BY name;


-- -----------------------------------------------------------------------------
-- Q13. (OPCIONAL) Extensions instaladas.
-- -----------------------------------------------------------------------------
SELECT extname, extversion, extrelocatable
FROM pg_extension
ORDER BY extname;
