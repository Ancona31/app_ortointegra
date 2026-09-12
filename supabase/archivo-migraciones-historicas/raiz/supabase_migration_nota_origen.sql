-- ============================================================
-- Migración: campo nota_origen en tabla consultas
-- Trazabilidad NOM-004-SSA3-2012
-- Ejecutar en Supabase SQL Editor (service role)
-- ============================================================

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS nota_origen varchar(10)
    NOT NULL DEFAULT 'ia'
    CHECK (nota_origen IN ('ia', 'manual'));

-- Retroactivamente todas las notas existentes se marcan como 'ia'
-- ya que el único flujo disponible antes era con Gemini.
UPDATE public.consultas SET nota_origen = 'ia' WHERE nota_origen IS NULL;

COMMENT ON COLUMN public.consultas.nota_origen IS
  'Origen de la nota clínica: ''ia'' = generada con Gemini, ''manual'' = escrita por el médico. NOM-004 trazabilidad.';
