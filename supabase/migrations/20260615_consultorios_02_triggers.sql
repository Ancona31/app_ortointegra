-- ============================================================================
-- Migración 2.2: Funciones y triggers de consultorios
-- Proyecto: Multiconsultorio Spinus
-- Branch: multiconsultorio
-- Aplicado en producción: 2026-06-15 vía SQL Editor de Supabase.
-- Smoke tests post-aplicación: pasados (4 funciones + 6 triggers verificados).
-- ============================================================================
-- Propósito:
-- Crear 4 funciones + 6 triggers sobre public.consultorios para:
--   1. Actualizar updated_at automáticamente.
--   2. Enforzar cap de 10 consultorios activos por médico.
--   3. Forzar es_default = true en el primer consultorio del médico.
--   4. Garantizar la invariante condicional "≥1 default activo si hay
--      activos" tras UPDATE o DELETE (statement-level).
--   5. Auditar cambios vía log_tabla_change (función existente).
-- ============================================================================
-- Dependencias:
-- - Requiere tabla public.consultorios (migración 2.1).
-- - Requiere función existente public.log_tabla_change() para el audit trigger.
-- ============================================================================

-- ====================
-- UP
-- ====================

-- ----------------------------------------------------------------------------
-- Función 1: actualizar updated_at automáticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_consultorios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Función 2: enforzar cap de 10 consultorios activos por médico
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_cap_10_consultorios_activos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Solo validar si la operación deja el consultorio en estado activo.
  IF NEW.activo = false THEN
    RETURN NEW;
  END IF;

  -- En UPDATE: si OLD.activo ya era true, no se está incrementando el
  -- conteo del médico. Solo validar cuando se activa un consultorio
  -- (de archivado a activo) o en INSERT.
  IF TG_OP = 'UPDATE' AND OLD.activo = true THEN
    RETURN NEW;
  END IF;

  -- Contar consultorios activos del médico, excluyendo NEW.id si es UPDATE
  -- (para evitar contarse a sí mismo en el caso de reactivación).
  SELECT COUNT(*) INTO v_count
  FROM public.consultorios
  WHERE medico_id = NEW.medico_id
    AND activo = true
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'Límite alcanzado: máximo 10 consultorios activos por médico (médico %)', NEW.medico_id
      USING errcode = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Función 3: forzar es_default=true en el primer consultorio del médico
-- ----------------------------------------------------------------------------
-- Contrato (PLAN_CONSULTORIOS.md sección 2.2): "Si no existe otro consultorio
-- activo del médico → fuerza NEW.es_default = true. Único propósito:
-- garantizar que el primer consultorio de un médico siempre nace como default."
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_consultorio_default_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_otros_activos integer;
BEGIN
  -- Contar otros consultorios activos del mismo médico.
  SELECT COUNT(*) INTO v_otros_activos
  FROM public.consultorios
  WHERE medico_id = NEW.medico_id
    AND activo = true;

  -- Si no hay otros activos, este es el primero → forzar es_default = true.
  -- Override del input del cliente (decisión: Opción A en auditoría).
  IF v_otros_activos = 0 THEN
    NEW.es_default = true;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Función 4: invariante "≥1 default activo si hay activos" (statement-level)
-- ----------------------------------------------------------------------------
-- Esta función se comparte entre 2 triggers: AFTER UPDATE y AFTER DELETE.
-- Lee SOLO old_consultorios (disponible en ambos eventos).
-- Para una invariante de piso, basta con saber qué medico_id verificar
-- (no necesita new_consultorios).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_consultorio_default_existencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r_medico record;
  v_activos integer;
  v_defaults integer;
BEGIN
  -- Iterar sobre medico_id distintos afectados por el statement.
  -- old_consultorios existe tanto en UPDATE como en DELETE.
  FOR r_medico IN
    SELECT DISTINCT medico_id FROM old_consultorios
  LOOP
    -- Re-consultar estado vivo de la tabla para este médico.
    SELECT
      COUNT(*) FILTER (WHERE activo = true),
      COUNT(*) FILTER (WHERE activo = true AND es_default = true)
    INTO v_activos, v_defaults
    FROM public.consultorios
    WHERE medico_id = r_medico.medico_id;

    -- Invariante condicional: si hay activos pero ningún default, error.
    -- Caso "0 activos" es válido (médico archivó todo, equivalente a
    -- pre-onboarding).
    IF v_activos >= 1 AND v_defaults = 0 THEN
      RAISE EXCEPTION 'Inconsistencia: el médico % tiene % consultorio(s) activo(s) pero ningún default. Marque uno como default antes de continuar.', r_medico.medico_id, v_activos
        USING errcode = 'check_violation';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- Triggers (6 en total)
-- ----------------------------------------------------------------------------

CREATE TRIGGER trg_consultorios_updated_at
BEFORE UPDATE ON public.consultorios
FOR EACH ROW
EXECUTE FUNCTION public.update_consultorios_updated_at();

CREATE TRIGGER trg_consultorios_cap_10
BEFORE INSERT OR UPDATE ON public.consultorios
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cap_10_consultorios_activos();

CREATE TRIGGER trg_consultorios_default_insert
BEFORE INSERT ON public.consultorios
FOR EACH ROW
EXECUTE FUNCTION public.enforce_consultorio_default_insert();

CREATE TRIGGER trg_consultorios_default_existencia_update
AFTER UPDATE ON public.consultorios
REFERENCING OLD TABLE AS old_consultorios NEW TABLE AS new_consultorios
FOR EACH STATEMENT
EXECUTE FUNCTION public.enforce_consultorio_default_existencia();

CREATE TRIGGER trg_consultorios_default_existencia_delete
AFTER DELETE ON public.consultorios
REFERENCING OLD TABLE AS old_consultorios
FOR EACH STATEMENT
EXECUTE FUNCTION public.enforce_consultorio_default_existencia();

CREATE TRIGGER audit_consultorios
AFTER INSERT OR DELETE OR UPDATE ON public.consultorios
FOR EACH ROW
EXECUTE FUNCTION public.log_tabla_change();

-- ====================
-- DOWN (rollback)
-- ====================
-- Ejecutar en este orden exacto: triggers primero, luego funciones.
-- Las funciones tienen dependencias de triggers (función 4 es usada por 2
-- triggers); dropear funciones antes que sus triggers requeriría CASCADE.
--
-- DROP TRIGGER IF EXISTS audit_consultorios ON public.consultorios;
-- DROP TRIGGER IF EXISTS trg_consultorios_default_existencia_delete ON public.consultorios;
-- DROP TRIGGER IF EXISTS trg_consultorios_default_existencia_update ON public.consultorios;
-- DROP TRIGGER IF EXISTS trg_consultorios_default_insert ON public.consultorios;
-- DROP TRIGGER IF EXISTS trg_consultorios_cap_10 ON public.consultorios;
-- DROP TRIGGER IF EXISTS trg_consultorios_updated_at ON public.consultorios;
--
-- DROP FUNCTION IF EXISTS public.enforce_consultorio_default_existencia();
-- DROP FUNCTION IF EXISTS public.enforce_consultorio_default_insert();
-- DROP FUNCTION IF EXISTS public.enforce_cap_10_consultorios_activos();
-- DROP FUNCTION IF EXISTS public.update_consultorios_updated_at();
