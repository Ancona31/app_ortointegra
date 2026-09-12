-- Agregar 'solicitud_internamiento' al constraint de tipo en documentos
ALTER TABLE documentos
  DROP CONSTRAINT IF EXISTS documentos_tipo_check;

ALTER TABLE documentos
  ADD CONSTRAINT documentos_tipo_check
  CHECK (tipo IN (
    'receta',
    'solicitud_lab',
    'solicitud_imagen',
    'informe_clinico',
    'plan_suplementacion',
    'solicitud_internamiento'
  ));
