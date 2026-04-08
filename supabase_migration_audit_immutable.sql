-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  MIGRACIÓN: Audit log inmutable — NOM-024-SSA3                        ║
-- ║  Fecha: 2026-04-08                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- El audit_log NO debe poder ser borrado ni modificado por NADIE.
-- Solo INSERT (vía service role/triggers) y SELECT (vía admin/super_admin).
--
-- 1. Eliminar cualquier política UPDATE/DELETE existente
-- 2. Crear trigger que impida UPDATE y DELETE a nivel de Postgres
-- 3. Restringir SELECT solo a super_admin (no admin regular)

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1: Limpiar políticas existentes y recrear
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "audit_admin_select" ON audit_log;

-- Solo super_admin puede LEER el audit log
CREATE POLICY "audit_super_admin_select" ON audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- No hay políticas de INSERT/UPDATE/DELETE para authenticated.
-- Solo el service role (backend) puede insertar vía logAudit().

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2: Trigger que impide UPDATE y DELETE en audit_log
-- Incluso el service role no puede modificar registros existentes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'El audit_log es inmutable. No se permite UPDATE ni DELETE.';
  RETURN NULL;
END;
$$;

-- Eliminar triggers previos si existen
DROP TRIGGER IF EXISTS prevent_audit_update ON audit_log;
DROP TRIGGER IF EXISTS prevent_audit_delete ON audit_log;

CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3: Agregar columna user_agent para logins (si no existe)
-- ═══════════════════════════════════════════════════════════════════════════

-- No es necesario — el campo 'descripcion' ya almacena info adicional
-- y la tabla acepta texto libre. Usar 'descripcion' para user_agent
-- mantiene el esquema simple sin migración de columnas.

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- Intentar borrar un registro debería fallar:
-- DELETE FROM audit_log WHERE id = (SELECT id FROM audit_log LIMIT 1);
-- ERROR: El audit_log es inmutable. No se permite UPDATE ni DELETE.
