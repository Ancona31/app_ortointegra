-- Soft delete para pacientes — plan free no puede liberar slots borrando pacientes
-- El paciente se oculta visualmente pero sigue contando en el límite

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;

-- Índice para filtrar rápido
CREATE INDEX IF NOT EXISTS idx_pacientes_activo ON pacientes(clinica_id, activo);
