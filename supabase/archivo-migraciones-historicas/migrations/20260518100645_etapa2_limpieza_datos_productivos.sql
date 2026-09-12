-- ============================================================================
-- Migración: Etapa 2 — Limpieza de datos productivos
-- Fecha: 2026-05-18
-- Autor: Angel Ancona
-- Referencia: ROLES_POST_REFACTOR.md
-- ============================================================================
--
-- Contexto:
-- Esta migración consolida múltiples sub-pasos de limpieza de datos
-- productivos aplicados durante Etapa 2 del refactor de roles.
--
-- Sub-pasos incluidos:
--   2.3 — Eliminar 6 clínicas test + 2 profiles test + 8 pacientes test
--         + cascada de documentos asociados
--   2.5 — Corregir bug histórico de suscripcion_estado en 2 clínicas
--         (free puras marcadas como 'activo' por bug de onboarding)
--   2.6 — Corregir tipo de Consultorio Dr. Urrea (clinica → independiente)
--   2.7 — Asignar medico_id a 8 pacientes huérfanos
--
-- Sub-pasos NO incluidos:
--   2.4 — CANCELADO (no modificar profile Angel Ancona en Dr. Ancona TYO,
--         es cuenta de prueba intencional del usuario)
--   2.10 — Saltado (limpieza de PDFs huérfanos en storage es deuda 
--          técnica menor, no bloquea el refactor)
--
-- Riesgo: MEDIO (modificación masiva de datos productivos)
--
-- Estado pre-migración:
--   - 15 clínicas (6 test + 9 productivas)
--   - 15 profiles (2 test + 13 productivos)
--   - 108 pacientes (8 test + 100 productivos)
--   - Múltiples inconsistencias documentadas
--
-- Estado post-migración:
--   - 9 clínicas (todas productivas)
--   - 13 profiles (todos productivos)
--   - 100 pacientes (todos productivos)
--   - Datos consistentes, 0 pacientes huérfanos sin médico
--
-- Aplicado: 2026-05-18 vía Supabase SQL Editor en transacciones BEGIN/COMMIT
--
-- Rollback (si fuera necesario):
--   No es viable rollback automático. Los datos test borrados se perdieron
--   intencionalmente. Las reasignaciones de medico_id pueden revertirse
--   manualmente si fuera necesario, consultando el commit anterior del 
--   baseline o backups de Supabase.
-- ============================================================================

-- ============================================================================
-- Sub-paso 2.3: Limpieza de 6 clínicas test + 2 profiles test + cascada
-- ============================================================================

BEGIN;

-- 1. Borrar appointments asociados a pacientes test
DELETE FROM appointments 
WHERE paciente_id IN (
  SELECT id FROM pacientes WHERE clinica_id IN (
    '5b0a9948-6286-4320-8af0-157944bdfa5a',  -- asdf
    '0df7d972-bc67-4280-8396-3f9484aea5ad',  -- asdfasd
    '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',  -- asdfasdfasd
    '2834850c-1e42-464b-a164-94bc45b41415',  -- dr mike
    '3a994b1f-0b65-4075-bd8c-9eab99a79686',  -- Dr Mike
    '916e8d90-238a-4eba-bfd5-fa88efbfc174'   -- Mike
  )
);

-- 2. Borrar consultas asociadas a pacientes test
DELETE FROM consultas 
WHERE paciente_id IN (
  SELECT id FROM pacientes WHERE clinica_id IN (
    '5b0a9948-6286-4320-8af0-157944bdfa5a',
    '0df7d972-bc67-4280-8396-3f9484aea5ad',
    '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',
    '2834850c-1e42-464b-a164-94bc45b41415',
    '3a994b1f-0b65-4075-bd8c-9eab99a79686',
    '916e8d90-238a-4eba-bfd5-fa88efbfc174'
  )
);

-- 3. Borrar documentos asociados a pacientes test (17 documentos)
DELETE FROM documentos 
WHERE paciente_id IN (
  SELECT id FROM pacientes WHERE clinica_id IN (
    '5b0a9948-6286-4320-8af0-157944bdfa5a',
    '0df7d972-bc67-4280-8396-3f9484aea5ad',
    '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',
    '2834850c-1e42-464b-a164-94bc45b41415',
    '3a994b1f-0b65-4075-bd8c-9eab99a79686',
    '916e8d90-238a-4eba-bfd5-fa88efbfc174'
  )
);

-- 4. Borrar calculadora_resultados asociados a pacientes test
DELETE FROM calculadora_resultados 
WHERE paciente_id IN (
  SELECT id FROM pacientes WHERE clinica_id IN (
    '5b0a9948-6286-4320-8af0-157944bdfa5a',
    '0df7d972-bc67-4280-8396-3f9484aea5ad',
    '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',
    '2834850c-1e42-464b-a164-94bc45b41415',
    '3a994b1f-0b65-4075-bd8c-9eab99a79686',
    '916e8d90-238a-4eba-bfd5-fa88efbfc174'
  )
);

-- 5. Borrar mediciones_analitos asociadas a pacientes test
DELETE FROM mediciones_analitos 
WHERE paciente_id IN (
  SELECT id FROM pacientes WHERE clinica_id IN (
    '5b0a9948-6286-4320-8af0-157944bdfa5a',
    '0df7d972-bc67-4280-8396-3f9484aea5ad',
    '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',
    '2834850c-1e42-464b-a164-94bc45b41415',
    '3a994b1f-0b65-4075-bd8c-9eab99a79686',
    '916e8d90-238a-4eba-bfd5-fa88efbfc174'
  )
);

-- 6. Borrar solicitudes_arco asociadas a pacientes test
DELETE FROM solicitudes_arco 
WHERE paciente_id IN (
  SELECT id FROM pacientes WHERE clinica_id IN (
    '5b0a9948-6286-4320-8af0-157944bdfa5a',
    '0df7d972-bc67-4280-8396-3f9484aea5ad',
    '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',
    '2834850c-1e42-464b-a164-94bc45b41415',
    '3a994b1f-0b65-4075-bd8c-9eab99a79686',
    '916e8d90-238a-4eba-bfd5-fa88efbfc174'
  )
);

-- 7. Borrar 8 pacientes test
DELETE FROM pacientes 
WHERE clinica_id IN (
  '5b0a9948-6286-4320-8af0-157944bdfa5a',
  '0df7d972-bc67-4280-8396-3f9484aea5ad',
  '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',
  '2834850c-1e42-464b-a164-94bc45b41415',
  '3a994b1f-0b65-4075-bd8c-9eab99a79686',
  '916e8d90-238a-4eba-bfd5-fa88efbfc174'
);

-- 8. Borrar 2 profiles test
DELETE FROM profiles 
WHERE id IN (
  '2508df85-1d5e-495c-8dab-2b3953ec5102',  -- asdfasdfasdfasdf (admin de asdfasd)
  'ae0abfac-b75f-4be5-97a9-b7ef013074d2'   -- Mike (admin de Mike)
);

-- 9. Borrar 6 clínicas test
DELETE FROM clinicas 
WHERE id IN (
  '5b0a9948-6286-4320-8af0-157944bdfa5a',  -- asdf
  '0df7d972-bc67-4280-8396-3f9484aea5ad',  -- asdfasd
  '78e1c408-9be6-4bc7-ad89-b6efa57ad1d6',  -- asdfasdfasd
  '2834850c-1e42-464b-a164-94bc45b41415',  -- dr mike
  '3a994b1f-0b65-4075-bd8c-9eab99a79686',  -- Dr Mike
  '916e8d90-238a-4eba-bfd5-fa88efbfc174'   -- Mike
);

COMMIT;

-- ============================================================================
-- Sub-paso 2.5: Corregir bug histórico de suscripcion_estado
-- Causa: src/app/api/auth/registro/route.ts:58 setea 'activo' por default
-- Efecto: clínicas free puras quedan marcadas como 'activo' incorrectamente
-- Corrección: ajustar a 'free' las que NO tienen VIP ni Stripe
-- Etapa 3 corregirá el código TS para prevenir el bug en futuros signups
-- ============================================================================

BEGIN;

UPDATE clinicas
SET suscripcion_estado = 'free'
WHERE plan = 'free'
  AND suscripcion_estado = 'activo'
  AND es_vip_grant = false
  AND stripe_subscription_id IS NULL;
-- Resultado: 2 clínicas actualizadas
-- (Consultorio Dr. Hugo Vilchis, Trauma Center)

COMMIT;

-- ============================================================================
-- Sub-paso 2.6: Corregir tipo de Consultorio Dr. Urrea
-- Estado anterior: tipo='clinica' (incorrecto)
-- Estado actual: 1 médico, 0 secretarias → debe ser 'independiente'
-- Coherente con invariante 18 (tipo='independiente' = 1 médico + 0 secretarias)
-- ============================================================================

BEGIN;

UPDATE clinicas
SET tipo = 'independiente'
WHERE id = '85321589-a342-4c27-8d41-2fe00cd969bd';

COMMIT;

-- ============================================================================
-- Sub-paso 2.7: Asignar medico_id a 8 pacientes huérfanos
-- Causa: bug histórico en 4 formularios de creación de pacientes (BITÁCORA #74)
-- Efecto: pacientes creados sin medico_id asignado
-- Etapa 3 corregirá los formularios para prevenir nuevos huérfanos
-- ============================================================================

BEGIN;

-- 7 pacientes en OrtoIntegra → Angel M. Ancona Pérez (admin)
UPDATE pacientes
SET medico_id = '990b59fd-e536-4ba8-aef0-c82f68289ba6'
WHERE clinica_id = '360b9738-8e21-4523-851b-9fa397081a1e'
  AND medico_id IS NULL;

-- 1 paciente en Consultorio Dr. Urrea → Guillermo Urrea Martínez (admin)
UPDATE pacientes
SET medico_id = '02496cdb-c488-4140-9911-572384f896b8'
WHERE clinica_id = '85321589-a342-4c27-8d41-2fe00cd969bd'
  AND medico_id IS NULL;

COMMIT;

-- ============================================================================
-- Fin de migración Etapa 2
-- ============================================================================
