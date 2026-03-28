-- Agrega campos de contacto del consultorio al perfil del médico
-- Requeridos por el Reglamento de Insumos para la Salud (RIS) para recetas médicas

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS direccion_consultorio TEXT,
  ADD COLUMN IF NOT EXISTS telefono_consultorio  TEXT;
