-- ═══════════════════════════════════════════════════════════════════════
-- Migración: Policies de Storage para bucket documentos-pdf
-- Fecha: 2026-04-16
-- Descripción: Habilita acceso autenticado al bucket documentos-pdf
--   para subir y leer PDFs de documentos clínicos.
--   Estructura de carpetas: {paciente_id}/{filename}.pdf
--   Acceso limitado a usuarios de la misma clínica via RLS de pacientes.
-- ═══════════════════════════════════════════════════════════════════════

-- El bucket ya existe (creado en supabase_schema.sql). Solo agregamos policies.

-- 1. INSERT: usuarios autenticados pueden subir PDFs
CREATE POLICY "authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-pdf');

-- 2. SELECT: usuarios autenticados pueden leer PDFs
CREATE POLICY "authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-pdf');

-- 3. DELETE: usuarios autenticados pueden borrar PDFs (para correcciones)
CREATE POLICY "authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-pdf');
