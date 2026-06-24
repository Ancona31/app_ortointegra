-- =============================================================================
-- 20260624_nombres_01_columnas_estructuradas.sql
--
-- Fase 1 del proyecto de normalización de nombres de médicos (NOMBRES_PLAN.md).
--
-- Añade a public.profiles las columnas estructuradas que son la nueva fuente
-- de verdad del nombre del médico: nombres + apellido_paterno +
-- apellido_materno (+ titulo, que ya existía en el baseline). La app compone
-- el display en el punto de render vía src/lib/nombreMedico.ts.
--
-- nombre_confirmado marca si el médico ya validó/migró su nombre a la
-- estructura (banner de onboarding de Fase 3).
--
-- ESTADO: estas columnas YA fueron aplicadas a mano en producción durante la
-- Fase 1. Esta migración las versiona retroactivamente para que el repo sea
-- fiel a prod. Es ADITIVA e IDEMPOTENTE (ADD COLUMN IF NOT EXISTS): re-aplicarla
-- sobre prod no tiene efecto.
--
-- La columna legacy `nombre` NO se toca aquí: sigue viva en prod y se elimina
-- en Fase 6 (DROP COLUMN), no en este momento.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nombres text,
  ADD COLUMN IF NOT EXISTS apellido_paterno text,
  ADD COLUMN IF NOT EXISTS apellido_materno text,
  ADD COLUMN IF NOT EXISTS nombre_confirmado boolean NOT NULL DEFAULT false;


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Inverso aditivo. Bloque comentado para evitar ejecución silenciosa al pegar
-- el archivo completo en el SQL Editor. Descomentar solo para revertir manualmente.
--
-- ALTER TABLE public.profiles
--   DROP COLUMN IF EXISTS nombre_confirmado,
--   DROP COLUMN IF EXISTS apellido_materno,
--   DROP COLUMN IF EXISTS apellido_paterno,
--   DROP COLUMN IF EXISTS nombres;
