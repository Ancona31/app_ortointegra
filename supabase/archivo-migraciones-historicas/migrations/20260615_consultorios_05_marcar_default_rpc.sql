-- ============================================================================
-- Migración 2.2-bis: Función RPC marcar_consultorio_default
-- Proyecto: Multiconsultorio Spinus
-- Branch: multiconsultorio
-- Aplicado en producción: 2026-06-15 vía SQL Editor de Supabase.
-- Smoke tests post-aplicación: pasados.
--   - Función creada con firma marcar_consultorio_default(p_target_id uuid)
--     RETURNS public.consultorios.
--   - SECURITY INVOKER, search_path TO 'public', VOLATILE plpgsql.
--   - GRANT EXECUTE a authenticated. anon/postgres/service_role mantienen
--     EXECUTE por configuración default de Supabase (comportamiento idéntico
--     al precedente crear_paciente_con_medico_v2). La función está protegida
--     dentro de su cuerpo vía auth.uid() filter + RLS.
-- ============================================================================
-- Propósito:
-- Exponer una función SQL que el endpoint API
-- PATCH /api/consultorios/[id]/marcar-default invoca vía supabase.rpc().
--
-- La función ejecuta un UPDATE atómico single-statement que recalcula el flag
-- es_default de TODOS los consultorios activos del médico autenticado en una
-- sola sentencia. Esto evita:
--   - Estados intermedios donde 0 consultorios tengan es_default = true
--     (bloqueado por trigger enforce_consultorio_default_existencia).
--   - Estados intermedios donde 2 consultorios tengan es_default = true
--     (bloqueado por índice consultorios_default_unico).
--
-- La función es SECURITY INVOKER: las policies RLS de migración 2.3
-- (consultorios_update) aplican naturalmente. Solo el médico dueño puede
-- ejecutar el UPDATE sobre sus propias filas.
-- ============================================================================
-- Dependencias:
-- - Requiere tabla public.consultorios (migración 2.1).
-- - Requiere triggers de invariantes (migración 2.2):
--     enforce_consultorio_default_existencia (statement-level)
--     consultorios_default_unico (índice UNIQUE PARCIAL)
-- - Requiere policies RLS de consultorios (migración 2.3):
--     consultorios_update (USING + WITH CHECK con medico_id = auth.uid())
-- ============================================================================
-- Comportamiento:
-- - Valida que el target existe, pertenece al médico autenticado, y está activo.
-- - Si no encuentra el target activo del médico → RAISE EXCEPTION con SQLSTATE
--   'P0002' (no_data_found), traducido a HTTP 404 por PostgREST.
-- - Idempotente: si el target ya es default, el UPDATE corre como no-op de
--   datos pero el statement valida la invariante igualmente.
-- - Retorna la fila del consultorio target tras el UPDATE.
-- ============================================================================
-- Nota de seguridad:
-- - anon recibe EXECUTE por configuración default de Supabase (no removible
--   con REVOKE FROM PUBLIC). La función está protegida porque sin auth.uid()
--   válido el SELECT inicial nunca matchea → RAISE P0002 → 404. Cero
--   modificación posible sin sesión válida.
-- ============================================================================

-- ====================
-- UP
-- ====================

CREATE OR REPLACE FUNCTION public.marcar_consultorio_default(
  p_target_id uuid
)
RETURNS public.consultorios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_medico_id uuid;
  v_resultado public.consultorios;
BEGIN
  -- Validar que el target existe, pertenece al usuario autenticado, y está activo.
  -- RLS aplica aquí (SECURITY INVOKER): solo verá la fila si la policy SELECT
  -- de consultorios la permite. El filtro explícito medico_id = auth.uid()
  -- añade defensa explícita.
  SELECT medico_id INTO v_medico_id
  FROM public.consultorios
  WHERE id = p_target_id
    AND activo = true
    AND medico_id = auth.uid();

  IF v_medico_id IS NULL THEN
    RAISE EXCEPTION 'Consultorio no encontrado, archivado, o no pertenece al usuario'
      USING ERRCODE = 'P0002';
  END IF;

  -- UPDATE atómico single-statement.
  -- - Cambia es_default de TODOS los consultorios activos del médico:
  --   target → true, los demás → false.
  -- - El índice UNIQUE PARCIAL (consultorios_default_unico) garantiza que al
  --   final solo 1 fila tenga es_default = true AND activo = true.
  -- - El trigger AFTER STATEMENT (enforce_consultorio_default_existencia)
  --   valida la invariante "≥1 default activo si hay activos" al cierre.
  -- - RLS UPDATE policy aplica (SECURITY INVOKER): solo se mutan filas donde
  --   medico_id = auth.uid().
  UPDATE public.consultorios
  SET
    es_default = (id = p_target_id),
    updated_at = now()
  WHERE medico_id = v_medico_id
    AND activo = true;

  -- Retornar la fila target tras el UPDATE.
  SELECT * INTO v_resultado
  FROM public.consultorios
  WHERE id = p_target_id;

  RETURN v_resultado;
END;
$$;

-- Alineación con patrón del repo (crear_paciente_con_medico_v2):
-- REVOKE EXECUTE FROM PUBLIC antes del GRANT TO authenticated.
-- Nota operativa: en Supabase, anon/authenticated/service_role mantienen
-- EXECUTE por configuración del proyecto independiente del REVOKE FROM PUBLIC.
-- La protección real vive dentro del cuerpo de la función (auth.uid() filter).
REVOKE EXECUTE ON FUNCTION public.marcar_consultorio_default(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_consultorio_default(uuid) TO authenticated;

-- ====================
-- DOWN (rollback)
-- ====================
-- DROP FUNCTION IF EXISTS public.marcar_consultorio_default(uuid);
-- (Los GRANT/REVOKE se eliminan automáticamente al hacer DROP.)
