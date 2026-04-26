-- =============================================================================
-- 06_triggers.sql
-- 12 triggers activos sobre tablas de public.
--
-- Aplicar después de 05_functions.sql.
-- Patrón DROP IF EXISTS + CREATE para idempotencia.
--
-- NOTA: NO existe ningún trigger sobre auth.users. La creación del profile
-- se hace desde backend en /api/auth/registro/route.ts.
-- =============================================================================


-- Table: addendums
DROP TRIGGER IF EXISTS audit_addendums ON public.addendums;
CREATE TRIGGER audit_addendums
  AFTER INSERT ON public.addendums
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();


-- Table: audit_log (inmutabilidad)
DROP TRIGGER IF EXISTS prevent_audit_delete ON public.audit_log;
CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

DROP TRIGGER IF EXISTS prevent_audit_update ON public.audit_log;
CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();


-- Table: consultas
DROP TRIGGER IF EXISTS audit_consultas ON public.consultas;
CREATE TRIGGER audit_consultas
  AFTER INSERT OR DELETE OR UPDATE ON public.consultas
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();


-- Table: documentos
DROP TRIGGER IF EXISTS audit_documentos ON public.documentos;
CREATE TRIGGER audit_documentos
  AFTER INSERT OR DELETE OR UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

DROP TRIGGER IF EXISTS trg_documentos_limite_paciente ON public.documentos;
CREATE TRIGGER trg_documentos_limite_paciente
  BEFORE INSERT ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_limite_documentos_paciente();


-- Table: mediciones_analitos
DROP TRIGGER IF EXISTS audit_mediciones_analitos ON public.mediciones_analitos;
CREATE TRIGGER audit_mediciones_analitos
  AFTER INSERT OR DELETE OR UPDATE ON public.mediciones_analitos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

DROP TRIGGER IF EXISTS mediciones_sync_antropometria ON public.mediciones_analitos;
CREATE TRIGGER mediciones_sync_antropometria
  AFTER INSERT OR DELETE OR UPDATE ON public.mediciones_analitos
  FOR EACH ROW EXECUTE FUNCTION public.trg_mediciones_antropometria();


-- Table: pacientes
DROP TRIGGER IF EXISTS audit_pacientes ON public.pacientes;
CREATE TRIGGER audit_pacientes
  AFTER INSERT OR DELETE OR UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();


-- Table: pdf_jobs
DROP TRIGGER IF EXISTS pdf_jobs_updated_at ON public.pdf_jobs;
CREATE TRIGGER pdf_jobs_updated_at
  BEFORE UPDATE ON public.pdf_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_pdf_jobs_updated_at();


-- Table: plantillas_honorarios
DROP TRIGGER IF EXISTS trg_plantillas_honorarios_updated_at ON public.plantillas_honorarios;
CREATE TRIGGER trg_plantillas_honorarios_updated_at
  BEFORE UPDATE ON public.plantillas_honorarios
  FOR EACH ROW EXECUTE FUNCTION public.update_plantillas_honorarios_updated_at();


-- Table: solicitudes_arco
DROP TRIGGER IF EXISTS trg_arco_fecha_limite ON public.solicitudes_arco;
CREATE TRIGGER trg_arco_fecha_limite
  BEFORE INSERT OR UPDATE ON public.solicitudes_arco
  FOR EACH ROW EXECUTE FUNCTION public.arco_set_fecha_limite();
