-- ============================================================================
-- Migración: Etapa 0 — Limpieza pre-refactor del sistema de roles
-- Fecha: 2026-05-18
-- Autor: Angel Ancona
-- Referencia: ROLES_POST_REFACTOR.md (sección 9: Apéndice de migraciones)
-- ============================================================================
--
-- Contexto:
-- Esta es la primera migración del refactor del sistema de roles. Elimina dos
-- vestigios identificados durante el scouting que no tienen uso productivo.
--
-- Riesgo: MÍNIMO
--   - pacientes.client_id: 0 referencias en código TS (verificado en E3)
--     Solo aparece en /api/documentos como patrón de idempotencia para
--     DOCUMENTOS, NO para pacientes. La columna en pacientes nunca se usa.
--   - get_max_pacientes(): 0 referencias en código TS (verificado en E5)
--     Función SECURITY DEFINER sin llamadores en RLS ni endpoints.
--
-- Rollback (si fuera necesario):
--   ALTER TABLE pacientes ADD COLUMN client_id text;
--   CREATE OR REPLACE FUNCTION public.get_max_pacientes() ...
--   (cuerpo original en supabase/baseline/baseline.sql)
-- ============================================================================

-- 1. Eliminar columna vestigio pacientes.client_id
ALTER TABLE pacientes DROP COLUMN client_id;

-- 2. Eliminar función vestigio get_max_pacientes
DROP FUNCTION IF EXISTS public.get_max_pacientes();

-- ============================================================================
-- Fin de migración Etapa 0
-- ============================================================================
