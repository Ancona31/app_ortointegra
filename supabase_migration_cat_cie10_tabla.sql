-- ═══════════════════════════════════════════════════════════════════════
-- Migración: Catálogo CIE-10 — estructura de tabla
-- Fecha: 2026-04-16
-- Descripción: Tabla de referencia con clasificación CIE-10 completa
--   en español para diagnósticos médicos universales.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Extensión para búsqueda por trigramas (tolerante a errores ortográficos)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tabla principal
CREATE TABLE IF NOT EXISTS public.cat_cie10 (
  codigo      text PRIMARY KEY,
  descripcion text NOT NULL,
  capitulo    text NOT NULL
);

-- 3. Índice trigram para búsqueda parcial (ILIKE %texto%)
CREATE INDEX IF NOT EXISTS idx_cie10_trgm_desc
  ON public.cat_cie10 USING gin(descripcion gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cie10_trgm_codigo
  ON public.cat_cie10 USING gin(codigo gin_trgm_ops);

-- 4. Índice para búsqueda por capítulo
CREATE INDEX IF NOT EXISTS idx_cie10_capitulo
  ON public.cat_cie10 (capitulo);

-- 5. RLS: lectura para todos los usuarios autenticados (catálogo público)
ALTER TABLE public.cat_cie10 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON public.cat_cie10
  FOR SELECT TO authenticated
  USING (true);
