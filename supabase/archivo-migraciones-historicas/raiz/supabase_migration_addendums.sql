-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRACIÓN: Addendums para notas clínicas — NOM-004-SSA3              ║
-- ║  Fecha: 2026-04-08                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Las notas clínicas son inmutables una vez guardadas.
-- Los addendums permiten agregar aclaraciones o correcciones sin
-- modificar la nota original, cumpliendo con la normativa.

CREATE TABLE IF NOT EXISTS addendums (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consulta_id   uuid NOT NULL REFERENCES consultas(id) ON DELETE RESTRICT,
  contenido     text NOT NULL,
  medico_id     uuid NOT NULL,
  medico_nombre text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addendums_consulta ON addendums(consulta_id, created_at);

-- RLS
ALTER TABLE addendums ENABLE ROW LEVEL SECURITY;

-- SELECT: ver addendums de consultas de tu clínica
CREATE POLICY "addendums_select" ON addendums
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.id = addendums.consulta_id
      AND p.clinica_id = get_clinica_id()
    )
  );

-- INSERT: médicos de la clínica pueden agregar addendums
CREATE POLICY "addendums_insert" ON addendums
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.id = addendums.consulta_id
      AND p.clinica_id = get_clinica_id()
    )
  );

-- NO hay políticas de UPDATE ni DELETE — addendums son inmutables

-- Trigger de auditoría
CREATE TRIGGER audit_addendums
  AFTER INSERT ON addendums
  FOR EACH ROW EXECUTE FUNCTION log_tabla_change();
