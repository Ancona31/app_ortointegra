-- =============================================================================
-- 20260504_revert_phase81_recursion.sql
--
-- Propósito:
--   Revertir las 3 policies RESTRICTIVE creadas por Phase 8.1
--   (20260503_phase81_block_post_cancellation.sql) por causar error
--   "infinite recursion detected in policy for relation pacientes"
--   al intentar crear pacientes en producción.
--
-- Causa raíz:
--   La policy `pacientes_block_post_cancellation` contenía un subquery
--   `SELECT count(*) FROM public.pacientes` dentro de su propio WITH CHECK.
--   Postgres dispara la policy al evaluar el subquery, que vuelve a
--   evaluar la policy, generando recursión infinita. Las policies de
--   `consultas` y `documentos` no eran auto-recursivas (referenciaban
--   `pacientes`, no a sí mismas) pero compartían el predicado defectuoso
--   y se descartaron juntas porque el diseño correcto las reemplaza.
--
-- Por qué pasó silencioso 24 horas:
--   Postgres no valida semánticamente policies en CREATE POLICY, solo
--   al ejecutar la operación que las invoca. La migración del 2026-05-03
--   corrió "OK", pero el primer INSERT a pacientes (~2026-05-04 noche)
--   disparó el error.
--
-- Aplicación:
--   Las 3 DROPs se ejecutaron manualmente en Supabase SQL Editor el
--   2026-05-04 ~10:00 (timezone Mérida) tras reporte de betatester.
--   Esta migración formaliza el cambio en el repo para mantener
--   coherencia entre supabase/migrations/ y el estado real de prod.
--
-- Trade-off temporal:
--   Sin estas policies, el bloqueo a clínicas con suscripcion_estado
--   = 'cancelado' Y >5 pacientes queda solo en los gates server-side
--   de los 4 endpoints API. Frontend que inserta directo a Supabase
--   (9 formularios de documentos) queda sin barrera RLS hasta que
--   apliquemos el fix correcto.
--
-- Fix correcto pendiente (ver PARTE 6 del plan de refactor):
--   1. Agregar columna `clinicas.ha_tenido_acceso_premium boolean`
--      one-way (false→true al primer pago/VIP).
--   2. Reescribir las 3 policies usando ese flag declarativo en
--      lugar de `count(pacientes) > 5`. Sin self-reference, sin
--      recursión.
--   3. Validar en local con `supabase start` antes de aplicar a prod.
--
-- Riesgo: NULO. Solo elimina policies. Idempotente (IF EXISTS).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS pacientes_block_post_cancellation ON public.pacientes;
DROP POLICY IF EXISTS consultas_block_post_cancellation ON public.consultas;
DROP POLICY IF EXISTS documentos_block_post_cancellation ON public.documentos;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- NO recrear las policies de Phase 8.1: tienen el bug de recursión.
-- Para restablecer el bloqueo, implementar la migración correcta basada
-- en `clinicas.ha_tenido_acceso_premium` (ver PARTE 6 del refactor plan).


-- -----------------------------------------------------------------------------
-- Verificación post-aplicación
-- -----------------------------------------------------------------------------
-- Ya verificado el 2026-05-04 al ejecutar manualmente:
--
-- SELECT schemaname, tablename, policyname, permissive, cmd
-- FROM   pg_policies
-- WHERE  policyname IN (
--          'pacientes_block_post_cancellation',
--          'consultas_block_post_cancellation',
--          'documentos_block_post_cancellation'
--        );
-- → 0 rows. Confirmed.