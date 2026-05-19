-- ============================================================================
-- Sub-paso 4.A.8 — Eliminación del rol 'admin' legacy
-- Fecha de ejecución: 2026-05-19
-- Autor: Angel Ancona
-- 
-- Propósito:
-- Migrar los 9 profiles productivos con role='admin' al modelo nuevo
-- (role='medico' + es_admin_de_clinica=true) y eliminar 'admin' del 
-- CHECK constraint de la tabla profiles.
--
-- Pre-requisito: Sub-paso 1.bis (backfill es_admin_de_clinica=true)
-- Documentación: ROLES_POST_REFACTOR.md
-- Helper: src/lib/permissions.ts
--
-- Esta migración fue ejecutada vía Supabase SQL Editor con DO block
-- atómico que incluye pre-flight y post-flight checks.
-- Si CUALQUIER check falla, ROLLBACK automático.
-- ============================================================================

DO $$
DECLARE
  v_admins_pre integer;
  v_admins_post integer;
  v_medicos_post integer;
  v_constraint_def text;
BEGIN
  -- PRE-FLIGHT CHECKS
  SELECT count(*) INTO v_admins_pre FROM profiles WHERE role = 'admin';
  IF v_admins_pre <> 9 THEN
    RAISE EXCEPTION 'PRE-FLIGHT 1 FAIL: esperaba 9 admins, encontrado %', v_admins_pre;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE role = 'admin' AND es_admin_de_clinica = true
    HAVING count(*) = 9
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT 2 FAIL: no todos los admins tienen es_admin_de_clinica=true';
  END IF;
  
  -- OPERACIÓN 1: UPDATE role='admin' → 'medico'
  UPDATE profiles SET role = 'medico' WHERE role = 'admin';
  GET DIAGNOSTICS v_admins_post = ROW_COUNT;
  IF v_admins_post <> 9 THEN
    RAISE EXCEPTION 'UPDATE FAIL: esperaba 9 filas actualizadas, fueron %', v_admins_post;
  END IF;
  
  -- POST-UPDATE CHECKS
  SELECT count(*) INTO v_admins_post FROM profiles WHERE role = 'admin';
  IF v_admins_post <> 0 THEN
    RAISE EXCEPTION 'POST-UPDATE 1 FAIL: aún quedan % admins', v_admins_post;
  END IF;
  
  SELECT count(*) INTO v_medicos_post 
  FROM profiles WHERE role = 'medico' AND es_admin_de_clinica = true;
  IF v_medicos_post <> 9 THEN
    RAISE EXCEPTION 'POST-UPDATE 2 FAIL: esperaba 9 medicos con flag, hay %', v_medicos_post;
  END IF;
  
  SELECT count(*) INTO v_medicos_post FROM profiles WHERE role = 'medico';
  IF v_medicos_post <> 10 THEN
    RAISE EXCEPTION 'POST-UPDATE 3 FAIL: esperaba 10 medicos total, hay %', v_medicos_post;
  END IF;
  
  -- OPERACIÓN 2: ALTER CHECK CONSTRAINT
  ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('super_admin', 'medico', 'secretaria'));
  
  -- POST-ALTER VERIFICATION
  SELECT pg_get_constraintdef(oid) INTO v_constraint_def
  FROM pg_constraint 
  WHERE conrelid = 'profiles'::regclass AND contype = 'c';
  
  IF v_constraint_def LIKE '%''admin''%' THEN
    RAISE EXCEPTION 'POST-ALTER FAIL: constraint aún contiene admin: %', v_constraint_def;
  END IF;
  
  IF v_constraint_def NOT LIKE '%super_admin%' OR v_constraint_def NOT LIKE '%medico%' OR v_constraint_def NOT LIKE '%secretaria%' THEN
    RAISE EXCEPTION 'POST-ALTER FAIL: faltan roles en constraint: %', v_constraint_def;
  END IF;
END $$;
