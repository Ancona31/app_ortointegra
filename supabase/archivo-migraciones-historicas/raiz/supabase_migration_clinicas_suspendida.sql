-- ════════════════════════════════════════════════════════
-- OrthoIntegra — Clínicas: campo suspendida
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS suspendida boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clinicas_suspendida ON clinicas(suspendida) WHERE suspendida = true;
