-- ─── Migración: campo universidad en profiles ────────────────────────────────
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS universidad text;
