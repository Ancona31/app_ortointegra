-- ============================================================================
-- Migración: Etapa 1bis — Backfill de es_admin_de_clinica para profiles admin
-- Fecha: 2026-05-18
-- Autor: Angel Ancona
-- Referencia: ROLES_POST_REFACTOR.md
-- ============================================================================
--
-- Contexto:
-- Esta migración corrige un blindspot del scouting original.
--
-- Etapa 1 agregó la columna profiles.es_admin_de_clinica con DEFAULT false.
-- Hizo backfill para clinicas (ha_tenido_acceso_premium) pero NO para profiles.
-- Como resultado, los 9 admins productivos quedaron con es_admin_de_clinica=false
-- a pesar de ser dueños de su clínica.
--
-- Esta migración hace el backfill que faltó: marca con es_admin_de_clinica=true
-- a TODOS los profiles que actualmente tienen role='admin'.
--
-- Estado transitorio aceptable post-migración:
-- - Profiles tendrán role='admin' Y es_admin_de_clinica=true simultáneamente
-- - Esto NO rompe nada porque:
--   * El CHECK constraint sigue aceptando role='admin'
--   * Las RLS actuales NO usan es_admin_de_clinica todavía (se usará en Etapa 5)
--   * El código TS nuevo (Fix 5+6 de Etapa 3) valida ambas condiciones combinadas
--
-- Etapa 4 después migrará:
-- - UPDATE profiles SET role='medico' WHERE role='admin'
-- - ALTER CHECK CONSTRAINT para eliminar 'admin' del enum
-- - Cleanup de código TS legacy (16 archivos con arrays ['admin', 'super_admin'])
--
-- Riesgo: MÍNIMO (single UPDATE específico, sin afectar otros roles, sin
-- tocar planes ni VIPs)
--
-- Estado pre-migración: 9 admins con es_admin_de_clinica=false
-- Estado post-migración: 9 admins con es_admin_de_clinica=true
--
-- Aplicado: 2026-05-18 vía Supabase SQL Editor en transacción BEGIN/COMMIT
--
-- Rollback (si fuera necesario):
--   UPDATE profiles SET es_admin_de_clinica=false WHERE role='admin';
--   Pero NO se recomienda porque el código nuevo de Etapa 3 depende de este flag.
-- ============================================================================

BEGIN;

-- Pre-flight check
SELECT 'Pre-UPDATE check' AS status, count(*) AS profiles_a_actualizar
FROM profiles WHERE role = 'admin' AND es_admin_de_clinica = false;

-- UPDATE específico con WHERE doble (defensa)
UPDATE profiles
SET es_admin_de_clinica = true
WHERE role = 'admin' 
  AND es_admin_de_clinica = false;
-- Resultado: 9 profiles actualizados (1 admin por cada clínica productiva)

-- Post-flight check
SELECT 'Post-UPDATE check' AS status, count(*) AS admins_con_flag_correcto
FROM profiles WHERE role = 'admin' AND es_admin_de_clinica = true;

COMMIT;

-- ============================================================================
-- Profiles afectados (9 admins productivos al momento de aplicar):
--
-- - Angel M. Ancona Pérez          | OrtoIntegra
-- - Angel Ancona                   | Dr. Ancona TYO (cuenta de pruebas)
-- - Guillermo Urrea Martínez       | Consultorio Dr. Urrea
-- - José Antonio Asiain Velazquez  | Consultorio 19 playamed
-- - Edgar Luis Villegas Esquivel   | Star Médica Lomas Verdes
-- - Jorge Alejandro Moguel Canto   | Trauma Center
-- - Hugo Vilchis Sámano            | Consultorio Dr. Hugo Vilchis
-- - Mónica Alexandra Arámbula      | Dra. Arámbula
-- - Ilse Haidee Casillas Venegas   | Dra. Ilse Casillas
-- ============================================================================
