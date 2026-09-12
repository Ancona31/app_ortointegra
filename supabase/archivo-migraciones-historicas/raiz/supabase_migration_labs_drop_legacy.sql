-- ============================================================
-- Migración: DROP tabla laboratorios legacy (sub-fase 8C2)
-- ============================================================
-- Ejecutar MANUALMENTE en Supabase SQL Editor por Angel.
-- Los 3 pasos deben ejecutarse en una sola sesión SQL.
-- Prerequisito: sub-fase 8C1 cerrada y pusheada.
-- ============================================================
--
-- CONTEXTO
--
-- La tabla public.laboratorios es huérfana tras la sub-fase 8C1:
-- cero consumidores en src/ (APIs, páginas, hooks, exportador ARCO
-- y /estado ya migrados al modelo nuevo mediciones_analitos /
-- analitos_catalogo).
--
-- Dependencias conocidas que caen automáticamente con el DROP TABLE:
--   * Trigger audit_laboratorios (AFTER INSERT/UPDATE/DELETE)
--   * 8 RLS policies (4 de supabase_schema.sql + 4 de
--     supabase_migration_rls.sql)
--   * 2 índices (idx_laboratorios_paciente + idx_laboratorios_paciente_fecha)
--   * FK laboratorios_paciente_id_fkey → pacientes(id)
--   * ~5 registros de data de prueba
--
-- Ninguna otra tabla tiene FK entrante hacia laboratorios (verificado).
--
-- El bucket "laboratorios-pdf" fue eliminado en sesiones anteriores
-- del rediseño (confirmado por Angel). No hay acción de Storage pendiente.
--
-- BLOQUEO PRE-DROP
--
-- La policy public.pacientes_delete_solo_sin_historial (definida en
-- supabase_migration_retencion_expedientes.sql) referencia laboratorios
-- en su cláusula USING. Postgres NO dropea automáticamente esa policy
-- al hacer DROP TABLE sin CASCADE: quedaría apuntando a una tabla
-- inexistente y cualquier DELETE sobre pacientes fallaría con
-- "relation laboratorios does not exist".
--
-- Por eso el orden estricto es: DROP POLICY → CREATE POLICY (sin
-- la referencia a laboratorios) → DROP TABLE. No se usa CASCADE.

-- ============================================================
-- Paso 1: DROP POLICY que referencia laboratorios
-- ============================================================
DROP POLICY IF EXISTS "pacientes_delete_solo_sin_historial"
  ON public.pacientes;

-- ============================================================
-- Paso 2: CREATE POLICY sin la referencia a laboratorios
-- ============================================================
-- Recreamos la policy idéntica al original
-- (supabase_migration_retencion_expedientes.sql:83-92) removiendo
-- ÚNICAMENTE la línea "AND NOT EXISTS (SELECT 1 FROM laboratorios l ...)".
-- Mantiene la protección contra DELETE de pacientes con consultas o
-- documentos activos, que es lo que realmente importa bajo NOM-004.
CREATE POLICY "pacientes_delete_solo_sin_historial"
  ON public.pacientes
  FOR DELETE
  TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND NOT EXISTS (SELECT 1 FROM consultas c WHERE c.paciente_id = pacientes.id)
    AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.paciente_id = pacientes.id)
  );

-- ============================================================
-- Paso 3: DROP TABLE laboratorios
-- ============================================================
-- Sin CASCADE intencionalmente. Dependencias conocidas que se van
-- automáticamente: trigger audit_laboratorios, 8 RLS policies,
-- 2 índices, FK saliente hacia pacientes, ~5 registros de prueba.
-- El bucket storage "laboratorios-pdf" ya fue eliminado en sesiones
-- anteriores del rediseño (no hay acción de storage pendiente).
DROP TABLE public.laboratorios;

-- ============================================================
-- VALIDACIONES POST-EJECUCIÓN (correr después, comentadas)
-- ============================================================
--
-- 1) Verificar que la tabla ya no existe:
--    SELECT to_regclass('public.laboratorios');
--    -- Esperado: NULL
--
-- 2) Verificar que la policy fue recreada y no referencia laboratorios:
--    SELECT polname, pg_get_expr(polqual, polrelid, true) AS using_clause
--      FROM pg_policy
--     WHERE polrelid = 'public.pacientes'::regclass
--       AND polname = 'pacientes_delete_solo_sin_historial';
--    -- Esperado: la cláusula USING menciona 'consultas' y 'documentos'
--    -- pero NO 'laboratorios'.
--
-- 3) Smoke test: insertar un paciente huérfano y eliminarlo debe
--    funcionar (fuera de este archivo, en un entorno de prueba).
--
-- 4) Verificar que Sentry no registra errores de
--    "relation \"laboratorios\" does not exist" en los 30 minutos
--    siguientes al despliegue.
