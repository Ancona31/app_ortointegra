-- Agregar 'escrito_medico' al constraint de tipo en documentos
-- (incluye todos los tipos anteriores + los nuevos)
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
    'suplementacion',
    'solicitud_internamiento',
    'escrito_medico'
  ));
