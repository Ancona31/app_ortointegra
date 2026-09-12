-- Agregar nota_honorarios al check constraint de documentos.tipo
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
      'consentimiento_informado',
      'nota_honorarios'
    )
  );
