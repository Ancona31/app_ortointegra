-- ============================================================
-- Soporte para usuarios independientes (sin clínica)
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'clinica'
  CHECK (tipo IN ('clinica', 'independiente'));
