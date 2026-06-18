-- ============================================================================
-- Migración 2.3: RLS de consultorios
-- Proyecto: Multiconsultorio Spinus
-- Branch: multiconsultorio
-- Aplicado en producción: 2026-06-15 vía SQL Editor de Supabase.
-- Smoke tests post-aplicación: pasados (RLS habilitada + 4 policies
-- verificadas con atributos correctos). Alerta CRITICAL del advisor de
-- Supabase eliminada.
-- ============================================================================
-- Propósito:
-- Habilitar Row Level Security en public.consultorios y crear 4 policies:
--   1. consultorios_select  (PERMISSIVE, SELECT)
--   2. consultorios_insert  (PERMISSIVE, INSERT)
--   3. consultorios_gates_insert (RESTRICTIVE, INSERT) — gates de subscription
--   4. consultorios_update  (PERMISSIVE, UPDATE)
-- Sin policy DELETE — el archivado se hace vía UPDATE (soft delete).
-- ============================================================================
-- Dependencias:
-- - Requiere tabla public.consultorios (migración 2.1).
-- - Requiere helpers RLS existentes: get_clinica_id, get_my_role,
--   soy_admin_de_clinica, clinica_no_suspendida, clinica_tiene_acceso.
-- ============================================================================

-- ====================
-- UP
-- ====================

-- Habilitar RLS en la tabla
ALTER TABLE public.consultorios ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Policy 1: consultorios_select (PERMISSIVE, SELECT)
-- ----------------------------------------------------------------------------
-- Quién puede leer un consultorio:
--   - El médico dueño (medico_id = auth.uid()), Y
--   - cualquier usuario de la misma clínica (clinica_id = get_clinica_id()),
--     CON el rol apropiado:
--       - médico (puede ver los suyos, ya cubierto por medico_id = auth.uid())
--       - admin de clínica (ve los de todos los médicos de su clínica)
--       - secretaria (ve los de todos los médicos de su clínica)
-- Nota: super_admin NO está cubierto por esta policy. Los endpoints de
-- super-admin usan service_role (createAdminClient) que bypasea RLS.
-- ----------------------------------------------------------------------------
CREATE POLICY consultorios_select
ON public.consultorios
FOR SELECT
TO authenticated
USING (
  clinica_id = public.get_clinica_id()
  AND (
    medico_id = auth.uid()
    OR public.soy_admin_de_clinica()
    OR public.get_my_role() = 'secretaria'
  )
);

-- ----------------------------------------------------------------------------
-- Policy 2: consultorios_insert (PERMISSIVE, INSERT)
-- ----------------------------------------------------------------------------
-- Solo el médico autenticado puede crear consultorios para sí mismo
-- (no para otros médicos), Y dentro de su propia clínica.
-- ----------------------------------------------------------------------------
CREATE POLICY consultorios_insert
ON public.consultorios
FOR INSERT
TO authenticated
WITH CHECK (
  medico_id = auth.uid()
  AND clinica_id = public.get_clinica_id()
  AND public.get_my_role() = 'medico'
);

-- ----------------------------------------------------------------------------
-- Policy 3: consultorios_gates_insert (RESTRICTIVE, INSERT)
-- ----------------------------------------------------------------------------
-- Gates de subscription: bloquea INSERT si la clínica está suspendida o
-- no tiene acceso vigente. RESTRICTIVE = AND con las demás policies.
-- Aplica solo a INSERT por diseño: clínicas suspendidas pueden gestionar
-- sus datos existentes (UPDATE) pero no crear nuevos consultorios.
-- ----------------------------------------------------------------------------
CREATE POLICY consultorios_gates_insert
ON public.consultorios
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.clinica_no_suspendida()
  AND public.clinica_tiene_acceso()
);

-- ----------------------------------------------------------------------------
-- Policy 4: consultorios_update (PERMISSIVE, UPDATE)
-- ----------------------------------------------------------------------------
-- Solo el médico dueño puede editar sus propios consultorios.
-- USING + WITH CHECK idénticos: la fila pre-update debe pertenecer al
-- médico autenticado, y la fila post-update también (evita transferir
-- consultorios entre médicos vía UPDATE).
-- ----------------------------------------------------------------------------
CREATE POLICY consultorios_update
ON public.consultorios
FOR UPDATE
TO authenticated
USING (
  medico_id = auth.uid()
  AND clinica_id = public.get_clinica_id()
)
WITH CHECK (
  medico_id = auth.uid()
  AND clinica_id = public.get_clinica_id()
);

-- ====================
-- DOWN (rollback)
-- ====================
-- Ejecutar en este orden:
--
-- DROP POLICY IF EXISTS consultorios_update ON public.consultorios;
-- DROP POLICY IF EXISTS consultorios_gates_insert ON public.consultorios;
-- DROP POLICY IF EXISTS consultorios_insert ON public.consultorios;
-- DROP POLICY IF EXISTS consultorios_select ON public.consultorios;
-- ALTER TABLE public.consultorios DISABLE ROW LEVEL SECURITY;
