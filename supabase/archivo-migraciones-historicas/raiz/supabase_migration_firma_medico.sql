-- ─── Migración: firma autógrafa del médico ────────────────────────────────
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firma_url text;

-- ─── Storage bucket (ejecutar en Supabase Dashboard → Storage) ─────────────
-- 1. Crear bucket "firmas-medicos" con Public = OFF  (privado)
-- 2. No se necesitan políticas de RLS en el bucket porque el acceso
--    se hace exclusivamente desde el server con el service_role key.
--    El cliente nunca accede directo al bucket — solo vía /api/me/firma.
