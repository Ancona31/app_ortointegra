-- ============================================================================
-- Migración 2.6: RLS de consultorios — fix SELECT owner-only para médicos
-- Proyecto: Multiconsultorio Spinus
-- Branch: multiconsultorio
-- Aplicado en producción: 2026-06-16 vía SQL Editor de Supabase (owner postgres).
-- Smoke tests post-aplicación: pasados.
--   - V1: pg_policy.using_expr SIN soy_admin_de_clinica ✓
--   - V2: exactamente 1 policy FOR SELECT ✓
--   - V3: 4 policies del módulo intactas (gates_insert, insert, select, update) ✓
--   - V4 (app): médico admin ve solo sus consultorios; secretaria sigue
--     viendo toda la clínica ✓
--
-- BUG ARREGLADO:
-- La policy consultorios_select (creada en 20260615_consultorios_03_rls.sql)
-- incluía una rama OR `public.soy_admin_de_clinica()` que daba a los médicos
-- admin de clínica visibilidad sobre los consultorios de OTROS médicos de
-- su clínica. Esto contradice el modelo de producto:
-- "los consultorios son pertenencia exclusiva del médico, no de la clínica".
--
-- Síntoma confirmado: médico admin veía en /perfil consultorios ajenos
-- (incluyendo badges DEFAULT de otros médicos), rompiendo el modelo de
-- ownership.
--
-- FIX:
-- DROP + CREATE de la policy consultorios_select, eliminando la rama
-- soy_admin_de_clinica(). Se conservan:
--   - medico_id = auth.uid() → médico ve los suyos.
--   - get_my_role() = 'secretaria' → secretaria sigue viendo toda la clínica
--     (necesario para gestionar agenda/citas de cualquier médico).
--
-- NO TOCADO:
-- - Policies UPDATE/INSERT (gates + ownership): ya eran owner-only correctamente.
-- - Función soy_admin_de_clinica(): sigue existiendo, usada por ~9 otras tablas.
-- - RPC marcar_consultorio_default: depende de la rama medico_id (conservada).
-- - FKs de appointments/consultas a consultorios: bypassan RLS.
-- ============================================================================

-- ============================================================================
-- UP — Aplicar en producción
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS consultorios_select ON public.consultorios;

CREATE POLICY consultorios_select
ON public.consultorios
FOR SELECT
TO authenticated
USING (
  clinica_id = public.get_clinica_id()
  AND (
    medico_id = auth.uid()
    OR public.get_my_role() = 'secretaria'
  )
);

COMMENT ON POLICY consultorios_select ON public.consultorios IS
  'Owner-only: el médico ve solo los suyos. La secretaria ve toda la clínica para agendar citas. El admin_de_clinica NO ensancha la visibilidad sobre consultorios — son pertenencia del médico, no de la clínica.';

COMMIT;

-- ============================================================================
-- ROLLBACK (NO ejecutar a menos que sea emergencia de regresión)
-- Restaura la policy original con la rama soy_admin_de_clinica()
-- ============================================================================
-- BEGIN;
--
-- DROP POLICY IF EXISTS consultorios_select ON public.consultorios;
--
-- CREATE POLICY consultorios_select
-- ON public.consultorios
-- FOR SELECT
-- TO authenticated
-- USING (
--   clinica_id = public.get_clinica_id()
--   AND (
--     medico_id = auth.uid()
--     OR public.soy_admin_de_clinica()
--     OR public.get_my_role() = 'secretaria'
--   )
-- );
--
-- COMMIT;
-- ============================================================================
