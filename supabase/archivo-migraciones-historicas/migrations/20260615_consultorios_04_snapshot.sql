-- ============================================================================
-- Migración 2.4: ALTERs a appointments y consultas para snapshot de consultorio
-- Proyecto: Multiconsultorio Spinus
-- Branch: multiconsultorio
-- Aplicado en producción: 2026-06-15 vía SQL Editor de Supabase.
-- Smoke tests post-aplicación: pasados.
--   - 12 columnas snapshot agregadas (6 por tabla).
--   - 2 FKs (ON DELETE SET NULL / ON UPDATE NO ACTION) instaladas.
--   - 2 CHECKs instalados con expresión correcta.
--   - 2 índices parciales creados.
--   - Filas existentes preservadas en estado válido (38 appointments
--     + 118 consultas, todas con consultorio_id NULL).
-- ============================================================================
-- Propósito:
-- Añadir 6 columnas snapshot + FK + CHECK + índice parcial a cada una de las
-- 2 tablas (appointments, consultas). El snapshot inmutable congela los datos
-- del consultorio al momento de crear la cita/consulta. Sin backfill: las
-- filas existentes quedan con consultorio_id IS NULL (todos los snapshot NULL).
-- ============================================================================
-- Dependencias:
-- - Requiere tabla public.consultorios (migración 2.1).
-- ============================================================================
-- Riesgo operativo:
-- - Metadata-only: ADD COLUMN nullable sin default sin backfill = sin re-write.
-- - ADD CONSTRAINT CHECK sobre filas existentes: scan trivial porque todas
--   tienen consultorio_id IS NULL, predicado se satisface en primer término.
-- - ADD CONSTRAINT FK a tabla consultorios (vacía al momento de aplicar):
--   instantáneo, sin lock prolongado.
-- - Lock breve ACCESS EXCLUSIVE durante cada ALTER (sub-segundo en tablas
--   pequeñas de producción).
-- ============================================================================

-- ====================
-- UP
-- ====================

-- ----------------------------------------------------------------------------
-- appointments: 6 ADD COLUMN + FK + CHECK + índice parcial
-- ----------------------------------------------------------------------------

ALTER TABLE public.appointments
  ADD COLUMN consultorio_id               uuid,
  ADD COLUMN consultorio_nombre           text,
  ADD COLUMN consultorio_nombre_corto     text,
  ADD COLUMN consultorio_direccion        text,
  ADD COLUMN consultorio_telefono         text,
  ADD COLUMN consultorio_timezone         text;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_consultorio_id_fkey
  FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_consultorio_snapshot_check
  CHECK (consultorio_id IS NULL OR consultorio_nombre IS NOT NULL);

CREATE INDEX idx_appointments_consultorio
  ON public.appointments (consultorio_id)
  WHERE consultorio_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- consultas: 6 ADD COLUMN + FK + CHECK + índice parcial
-- ----------------------------------------------------------------------------

ALTER TABLE public.consultas
  ADD COLUMN consultorio_id               uuid,
  ADD COLUMN consultorio_nombre           text,
  ADD COLUMN consultorio_nombre_corto     text,
  ADD COLUMN consultorio_direccion        text,
  ADD COLUMN consultorio_telefono         text,
  ADD COLUMN consultorio_timezone         text;

ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_consultorio_id_fkey
  FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_consultorio_snapshot_check
  CHECK (consultorio_id IS NULL OR consultorio_nombre IS NOT NULL);

CREATE INDEX idx_consultas_consultorio
  ON public.consultas (consultorio_id)
  WHERE consultorio_id IS NOT NULL;

-- ====================
-- DOWN (rollback)
-- ====================
-- IMPORTANTE: Si esta migración ya tuvo escrituras (filas con consultorio_id
-- IS NOT NULL en appointments o consultas), el DROP COLUMN pierde los
-- snapshots irreversiblemente. PostgreSQL no tiene DROP COLUMN reversible
-- nativo. Antes de ejecutar el DOWN: hacer pg_dump o COPY de las columnas
-- snapshot de las filas afectadas como respaldo.
--
-- Orden: DROP INDEX → DROP CONSTRAINT (CHECK y FK) → DROP COLUMN.
--
-- DROP INDEX IF EXISTS public.idx_consultas_consultorio;
-- DROP INDEX IF EXISTS public.idx_appointments_consultorio;
--
-- ALTER TABLE public.consultas DROP CONSTRAINT IF EXISTS consultas_consultorio_snapshot_check;
-- ALTER TABLE public.consultas DROP CONSTRAINT IF EXISTS consultas_consultorio_id_fkey;
--
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_consultorio_snapshot_check;
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_consultorio_id_fkey;
--
-- ALTER TABLE public.consultas
--   DROP COLUMN IF EXISTS consultorio_timezone,
--   DROP COLUMN IF EXISTS consultorio_telefono,
--   DROP COLUMN IF EXISTS consultorio_direccion,
--   DROP COLUMN IF EXISTS consultorio_nombre_corto,
--   DROP COLUMN IF EXISTS consultorio_nombre,
--   DROP COLUMN IF EXISTS consultorio_id;
--
-- ALTER TABLE public.appointments
--   DROP COLUMN IF EXISTS consultorio_timezone,
--   DROP COLUMN IF EXISTS consultorio_telefono,
--   DROP COLUMN IF EXISTS consultorio_direccion,
--   DROP COLUMN IF EXISTS consultorio_nombre_corto,
--   DROP COLUMN IF EXISTS consultorio_nombre,
--   DROP COLUMN IF EXISTS consultorio_id;
