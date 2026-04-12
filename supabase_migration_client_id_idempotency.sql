-- ═══════════════════════════════════════════════════════════════════════
-- Migración: client_id para idempotencia del outbox-engine
-- ═══════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   El Sprint 1 de reingeniería offline-first introduce el outbox-engine
--   (commit acdacdf), que envía cada mutación con un clientId generado
--   en el cliente (UUID v4 o folio determinista). Este ID permite:
--
--     1. Deduplicación en reintentos tras timeouts falsos — si el request
--        llegó al server pero el cliente no recibió el ACK, el retry con
--        el mismo client_id es detectado y devuelve el registro existente.
--
--     2. Correlación entre el folio visible del documento (ej: R-abc123
--        en el QR de verificación de una receta) y el registro en DB.
--
--     3. Rastreo de items en la Dead Letter Queue — el médico puede ver
--        qué receta específica falló por su folio/clientId.
--
-- Alcance:
--   - documentos  → client_id TEXT UNIQUE (nullable)
--   - consultas   → client_id TEXT UNIQUE (nullable)
--   - pacientes   → client_id TEXT UNIQUE (nullable)
--   - appointments → client_id TEXT UNIQUE (nullable)
--
-- Compatibilidad:
--   - Registros existentes quedan con client_id = NULL (permitido).
--   - Solo nuevos registros creados vía outbox-engine tendrán client_id.
--   - UNIQUE constraint usa WHERE client_id IS NOT NULL (partial index)
--     para permitir múltiples NULLs sin violar la constraint.
--
-- Idempotencia de la migración:
--   Todas las sentencias usan IF NOT EXISTS para que la migración pueda
--   re-ejecutarse sin error si parte ya fue aplicada.
--
-- LFPDPPP / NOM-004: client_id NO contiene datos personales — es un UUID
-- opaco generado por el cliente. Cero impacto en privacidad.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Tabla documentos (recetas, solicitudes, consentimientos, etc.)
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS client_id TEXT;

COMMENT ON COLUMN public.documentos.client_id IS
  'Identificador de idempotencia generado en el cliente (UUID v4 o folio). '
  'Usado por el outbox-engine para deduplicar reintentos. NULL permitido '
  'en registros pre-existentes.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_client_id
  ON public.documentos (client_id)
  WHERE client_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Tabla consultas (notas médicas / notas de evolución)
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS client_id TEXT;

COMMENT ON COLUMN public.consultas.client_id IS
  'Identificador de idempotencia del outbox-engine. NULL en registros '
  'anteriores al Sprint 1 de refactor offline.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_consultas_client_id
  ON public.consultas (client_id)
  WHERE client_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Tabla pacientes (pacientes creados offline con tempId)
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS client_id TEXT;

COMMENT ON COLUMN public.pacientes.client_id IS
  'Identificador de idempotencia del outbox-engine. Para pacientes creados '
  'offline, corresponde al tempId usado para remapear referencias en notas '
  'y documentos hasta que el sync asigna el UUID real de Supabase.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_client_id
  ON public.pacientes (client_id)
  WHERE client_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 4. Tabla appointments (citas de agenda)
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_id TEXT;

COMMENT ON COLUMN public.appointments.client_id IS
  'Identificador de idempotencia del outbox-engine. Permite crear citas '
  'offline y evita duplicados al reintentar sync tras timeout.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_client_id
  ON public.appointments (client_id)
  WHERE client_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 5. Grant de permisos (mantiene las policies RLS existentes)
-- ──────────────────────────────────────────────────────────────────────
-- Las policies RLS definidas previamente operan sobre clinica_id / medico_id,
-- no sobre client_id. No se requiere ajuste de policies — el cliente sigue
-- pudiendo leer/escribir solo sus propios registros.
--
-- Sin embargo, confirmamos que la columna es accesible al role authenticated
-- para INSERT/SELECT:

DO $$
BEGIN
  -- documentos
  IF EXISTS (SELECT 1 FROM information_schema.table_privileges
             WHERE table_schema='public' AND table_name='documentos'
             AND grantee='authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON public.documentos TO authenticated;
  END IF;

  -- consultas
  IF EXISTS (SELECT 1 FROM information_schema.table_privileges
             WHERE table_schema='public' AND table_name='consultas'
             AND grantee='authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON public.consultas TO authenticated;
  END IF;

  -- pacientes
  IF EXISTS (SELECT 1 FROM information_schema.table_privileges
             WHERE table_schema='public' AND table_name='pacientes'
             AND grantee='authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON public.pacientes TO authenticated;
  END IF;

  -- appointments
  IF EXISTS (SELECT 1 FROM information_schema.table_privileges
             WHERE table_schema='public' AND table_name='appointments'
             AND grantee='authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
  END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- Verificación post-migración
-- ═══════════════════════════════════════════════════════════════════════
-- Ejecuta estas queries después del COMMIT para confirmar que todo quedó:
--
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public'
--     AND column_name='client_id'
--     AND table_name IN ('documentos','consultas','pacientes','appointments');
--
-- Resultado esperado: 4 filas, todas con data_type=text, is_nullable=YES
--
-- SELECT indexname, tablename
--   FROM pg_indexes
--   WHERE schemaname='public'
--     AND indexname LIKE 'idx_%_client_id';
--
-- Resultado esperado: 4 índices únicos parciales
--
-- ═══════════════════════════════════════════════════════════════════════
-- Rollback (si necesitas revertir)
-- ═══════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_documentos_client_id;
-- DROP INDEX IF EXISTS public.idx_consultas_client_id;
-- DROP INDEX IF EXISTS public.idx_pacientes_client_id;
-- DROP INDEX IF EXISTS public.idx_appointments_client_id;
-- ALTER TABLE public.documentos   DROP COLUMN IF EXISTS client_id;
-- ALTER TABLE public.consultas    DROP COLUMN IF EXISTS client_id;
-- ALTER TABLE public.pacientes    DROP COLUMN IF EXISTS client_id;
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS client_id;
-- COMMIT;
