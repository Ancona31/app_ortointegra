-- =============================================================================
-- 01_extensions.sql
-- Extensiones requeridas por el schema. Aplicar antes de 02_tables.sql.
--
-- plpgsql NO se incluye: viene por defecto en cualquier Postgres.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
