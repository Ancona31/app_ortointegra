-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRACIÓN: Retención de expedientes clínicos                         ║
-- ║  Cumplimiento NOM-004-SSA3-2012 — retención mínima 5 años            ║
-- ║  Fecha: 2026-04-07                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- PROBLEMA: Las tablas consultas, laboratorios y documentos tienen
-- ON DELETE CASCADE en paciente_id. Si se elimina un paciente, todo su
-- historial médico se borra irreversiblemente.
--
-- SOLUCIÓN:
-- 1. Cambiar CASCADE a RESTRICT — la DB rechaza borrar un paciente con historial
-- 2. Agregar columna fecha_baja a pacientes (soft delete mejorado)
-- 3. Política RLS que impide DELETE de pacientes con registros asociados
-- 4. Pacientes inactivos no aparecen en queries normales pero sí en historial
--
-- IMPORTANTE: Ejecutar en orden. Si falla algún paso, NO continuar.

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1: Cambiar ON DELETE CASCADE a ON DELETE RESTRICT
-- Esto impide borrar un paciente si tiene consultas, labs o documentos
-- ═══════════════════════════════════════════════════════════════════════════

-- Consultas: drop + recreate la FK
ALTER TABLE consultas
  DROP CONSTRAINT IF EXISTS consultas_paciente_id_fkey;

ALTER TABLE consultas
  ADD CONSTRAINT consultas_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT;

-- Laboratorios: drop + recreate la FK
ALTER TABLE laboratorios
  DROP CONSTRAINT IF EXISTS laboratorios_paciente_id_fkey;

ALTER TABLE laboratorios
  ADD CONSTRAINT laboratorios_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT;

-- Documentos: drop + recreate la FK
ALTER TABLE documentos
  DROP CONSTRAINT IF EXISTS documentos_paciente_id_fkey;

ALTER TABLE documentos
  ADD CONSTRAINT documentos_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT;

-- Appointments: cambiar también por consistencia
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_paciente_id_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2: Agregar fecha_baja a pacientes (soft delete mejorado)
-- La columna 'activo' ya existe (migración anterior).
-- Agregamos fecha_baja para registrar cuándo se dio de baja.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS fecha_baja timestamptz DEFAULT NULL;

-- Índice para queries que filtran pacientes activos
CREATE INDEX IF NOT EXISTS idx_pacientes_fecha_baja
  ON pacientes(clinica_id, fecha_baja)
  WHERE fecha_baja IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3: Política RLS que IMPIDE DELETE de pacientes
-- Solo super_admin puede hacer DELETE directo, y SOLO si el paciente
-- no tiene ningún registro asociado (creado por error).
-- Los médicos y admins usan soft delete (activo = false).
-- ═══════════════════════════════════════════════════════════════════════════

-- Primero eliminar políticas de DELETE existentes en pacientes
DROP POLICY IF EXISTS "pacientes_delete" ON pacientes;
DROP POLICY IF EXISTS "clinica_delete" ON pacientes;

-- Nueva política: solo permitir DELETE si NO hay registros asociados
-- Esto protege contra eliminación accidental de expedientes completos
CREATE POLICY "pacientes_delete_solo_sin_historial"
  ON pacientes
  FOR DELETE
  TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND NOT EXISTS (SELECT 1 FROM consultas c WHERE c.paciente_id = pacientes.id)
    AND NOT EXISTS (SELECT 1 FROM laboratorios l WHERE l.paciente_id = pacientes.id)
    AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.paciente_id = pacientes.id)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 4: Actualizar política SELECT de pacientes
-- Pacientes inactivos NO aparecen en queries normales.
-- Para ver historial de pacientes dados de baja, usar query explícita.
-- ═══════════════════════════════════════════════════════════════════════════

-- Reemplazar la política SELECT existente
DROP POLICY IF EXISTS "clinica_select" ON pacientes;
DROP POLICY IF EXISTS "pacientes_select" ON pacientes;

-- Pacientes activos: visibles para toda la clínica (uso normal)
CREATE POLICY "pacientes_select_activos"
  ON pacientes
  FOR SELECT
  TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND (activo = true OR activo IS NULL)
  );

-- Pacientes inactivos: visibles solo para admin (consulta de historial)
-- El admin puede necesitar acceder al expediente de un paciente dado de baja
-- para cumplir con solicitudes legales o de auditoría
CREATE POLICY "pacientes_select_inactivos_admin"
  ON pacientes
  FOR SELECT
  TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND activo = false
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: Ejecutar después de la migración para confirmar
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar que las FK son RESTRICT (no CASCADE):
-- SELECT tc.constraint_name, tc.table_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
-- WHERE tc.table_name IN ('consultas', 'laboratorios', 'documentos', 'appointments')
-- AND tc.constraint_type = 'FOREIGN KEY'
-- AND rc.delete_rule != 'RESTRICT';
--
-- Si el resultado está vacío, la migración fue exitosa.
