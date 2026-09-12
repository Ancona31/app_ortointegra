-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: Ampliar constraint tipo en tabla documentos
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

ALTER TABLE documentos
  DROP CONSTRAINT IF EXISTS documentos_tipo_check;

ALTER TABLE documentos
  ADD CONSTRAINT documentos_tipo_check CHECK (
    tipo IN (
      'receta',
      'solicitud_lab',
      'solicitud_imagen',
      'informe_clinico',
      'plan_suplementacion',
      'escrito_medico',
      'solicitud_internamiento',
      'consentimiento_informado'
    )
  );
