-- =============================================================================
-- 09_storage_buckets.sql
-- 4 storage buckets del proyecto.
--
-- Estos INSERTs son idempotentes (ON CONFLICT DO NOTHING) — re-correrlos
-- no falla si ya existen.
-- =============================================================================


-- clinica-logos: público, sin límite de tamaño, sin restricción de MIME.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('clinica-logos', 'clinica-logos', true, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- documentos-pdf: privado, sin límite de tamaño, sin restricción de MIME.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos-pdf', 'documentos-pdf', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- firmas-medicos: privado, sin límite de tamaño, sin restricción de MIME.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('firmas-medicos', 'firmas-medicos', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- labs-documentos: privado, 50 MB max, MIMEs permitidos para resultados/imágenes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'labs-documentos',
  'labs-documentos',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/dicom',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- TODO: storage policies deben recuperarse desde dashboard de Supabase
-- (Storage → cada bucket → Policies). El SQL Editor del proyecto no expuso
-- las policies de `storage.objects` en el dump de Q1–Q13. Para reconstruir
-- un Supabase local idéntico, hay que copiarlas manualmente o exportarlas
-- vía Management API.
-- =============================================================================
