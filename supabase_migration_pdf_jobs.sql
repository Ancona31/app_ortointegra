-- ============================================================
-- Procesamiento asíncrono de PDFs de laboratorios
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- 1. Tabla de trabajos
CREATE TABLE IF NOT EXISTS pdf_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  file_path     text NOT NULL DEFAULT '',
  result        jsonb,
  error_message text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. RLS
ALTER TABLE pdf_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_pdf_jobs" ON pdf_jobs
  FOR ALL USING (user_id = auth.uid());

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_user_status
  ON pdf_jobs (user_id, status);

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pdf_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pdf_jobs_updated_at ON pdf_jobs;
CREATE TRIGGER pdf_jobs_updated_at
  BEFORE UPDATE ON pdf_jobs
  FOR EACH ROW EXECUTE FUNCTION update_pdf_jobs_updated_at();

-- 5. Storage bucket para PDFs temporales
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'labs-pdfs',
  'labs-pdfs',
  false,
  20971520,          -- 20 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 6. RLS para storage (cada usuario solo accede a su carpeta)
CREATE POLICY "users_upload_own_pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'labs-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_read_own_pdfs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'labs-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_delete_own_pdfs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'labs-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
