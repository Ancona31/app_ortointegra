-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: extender CHECK documentos.tipo (labs — sub-fase 1A)
-- Agrega 'resultado_laboratorio' y 'estudio_imagen' al set válido.
-- La última migración que tocó este CHECK fue
-- supabase_migration_nota_honorarios.sql (9 valores previos).
-- Ejecutar en Supabase SQL Editor.
-- ════════════════════════════════════════════════════════

alter table documentos
  drop constraint if exists documentos_tipo_check;

alter table documentos
  add constraint documentos_tipo_check check (
    tipo in (
      'receta',
      'solicitud_lab',
      'solicitud_imagen',
      'informe_clinico',
      'plan_suplementacion',
      'escrito_medico',
      'solicitud_internamiento',
      'consentimiento_informado',
      'nota_honorarios',
      'resultado_laboratorio',
      'estudio_imagen'
    )
  );
