-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRACIÓN: Índices para paginación cursor-based                      ║
-- ║  Fecha: 2026-04-08                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Consultas: paginación por fecha descendente dentro de un paciente
CREATE INDEX IF NOT EXISTS idx_consultas_paciente_fecha
  ON consultas(paciente_id, fecha DESC);

-- Laboratorios: paginación por fecha_toma descendente
CREATE INDEX IF NOT EXISTS idx_laboratorios_paciente_fecha
  ON laboratorios(paciente_id, fecha_toma DESC);

-- Documentos: paginación por created_at descendente
CREATE INDEX IF NOT EXISTS idx_documentos_paciente_created
  ON documentos(paciente_id, created_at DESC);

-- Pacientes: paginación por created_at descendente + filtro activo
CREATE INDEX IF NOT EXISTS idx_pacientes_created_activo
  ON pacientes(created_at DESC)
  WHERE activo = true OR activo IS NULL;
