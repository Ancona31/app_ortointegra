-- ============================================================================
-- Migración: Etapa 1 — Schema declarativo nuevo para refactor de roles
-- Fecha: 2026-05-18
-- Autor: Angel Ancona
-- Referencia: ROLES_POST_REFACTOR.md
-- ============================================================================
--
-- Contexto:
-- Agregar las dos columnas declarativas que sustentan el nuevo modelo de roles:
--   1. profiles.es_admin_de_clinica: identifica al médico que administra
--      la clínica (reemplaza al rol 'admin' que se eliminará en Etapa 4).
--   2. clinicas.ha_tenido_acceso_premium: marca declarativa ONE-WAY usada por
--      Phase 8.1 v2 (bloqueo post-cancelación sin recursión).
--
-- Riesgo: BAJO
--   - Solo agregamos columnas con DEFAULT false → cero impacto en código
--     existente que aún no las conoce.
--   - El backfill solo actualiza filas con historia premium real (VIP o Stripe).
--   - RLS no se toca (Etapa 5).
--   - Código TS no se toca (Etapas 3-4).
--   - Las columnas existen pero nadie las lee todavía (preparación pura).
--
-- Backfill esperado:
--   ha_tenido_acceso_premium=true → 7 clínicas (las 7 VIP, que incluyen las 2 Stripe)
--   ha_tenido_acceso_premium=false → 8 clínicas (6 test + 2 free puras productivas)
--
-- Caso crítico validado:
--   OrtoIntegra (VIP + cancelado): quedará con ha_tenido_acceso_premium=true
--   pero con es_vip_grant=true → NO debe ser bloqueada por Phase 8.1 v2.
--   El refactor de RLS (Etapa 5) debe respetar esta combinación.
--
-- Rollback (si fuera necesario):
--   ALTER TABLE profiles DROP COLUMN es_admin_de_clinica;
--   ALTER TABLE clinicas DROP COLUMN ha_tenido_acceso_premium;
-- ============================================================================

-- 1. Agregar columna es_admin_de_clinica a profiles
--    Default false para que los profiles existentes no cambien comportamiento.
--    En Etapa 4 se hará UPDATE para marcar es_admin_de_clinica=true a los
--    profiles que actualmente tienen role='admin'.
ALTER TABLE profiles
ADD COLUMN es_admin_de_clinica boolean NOT NULL DEFAULT false;

-- 2. Agregar columna ha_tenido_acceso_premium a clinicas
--    Default false. Se hace backfill abajo para las clínicas con historia.
ALTER TABLE clinicas
ADD COLUMN ha_tenido_acceso_premium boolean NOT NULL DEFAULT false;

-- 3. Backfill: marcar clínicas con historia premium
--    Criterio: VIP O Stripe activo en algún momento.
--    ha_tenido_acceso_premium es ONE-WAY: false → true, nunca al revés.
UPDATE clinicas
SET ha_tenido_acceso_premium = true
WHERE es_vip_grant = true 
   OR stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- Fin de migración Etapa 1
-- ============================================================================
