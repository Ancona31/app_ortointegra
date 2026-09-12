-- =============================================================================
-- 03_indexes.sql
-- Índices secundarios del schema public.
--
-- NO se incluyen:
--   - *_pkey: vienen automáticos con PRIMARY KEY
--   - *_key (UNIQUE): vienen automáticos con UNIQUE constraint en 02_tables.sql
-- =============================================================================


-- Table: addendums
CREATE INDEX IF NOT EXISTS idx_addendums_consulta
  ON public.addendums USING btree (consulta_id, created_at);


-- Table: analitos_catalogo
CREATE INDEX IF NOT EXISTS idx_analitos_catalogo_categoria
  ON public.analitos_catalogo USING btree (categoria) WHERE (activo = true);
CREATE INDEX IF NOT EXISTS idx_analitos_catalogo_clave
  ON public.analitos_catalogo USING btree (clave) WHERE (activo = true);


-- Table: appointments
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_client_id
  ON public.appointments USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_appointments_clinica
  ON public.appointments USING btree (clinica_id);
CREATE INDEX IF NOT EXISTS idx_appointments_gcal_sync
  ON public.appointments USING btree (gcal_sync_status) WHERE (gcal_sync_status = 'pending'::text);
-- Una cita por evento de Google, con ámbito de clínica: los ids de evento son
-- únicos por calendario, no entre calendarios (un evento copiado conserva el
-- id). clinica_id y no medico_id porque medico_id es nullable y en un índice
-- único los NULL son distintos entre sí.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_clinica_google_event_id_uniq
  ON public.appointments (clinica_id, google_event_id)
  WHERE google_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_medico
  ON public.appointments USING btree (medico_id);
CREATE INDEX IF NOT EXISTS idx_appointments_paciente
  ON public.appointments USING btree (paciente_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time
  ON public.appointments USING btree (start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON public.appointments USING btree (status);


-- Table: audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_tabla_registro
  ON public.audit_log USING btree (tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_fecha
  ON public.audit_log USING btree (user_id, created_at DESC);


-- Table: calculadora_resultados
CREATE INDEX IF NOT EXISTS idx_calc_resultados_clinica
  ON public.calculadora_resultados USING btree (clinica_id);
CREATE INDEX IF NOT EXISTS idx_calc_resultados_paciente
  ON public.calculadora_resultados USING btree (paciente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_calc_resultados_slug
  ON public.calculadora_resultados USING btree (calculadora_slug);


-- Table: cat_cie10
CREATE INDEX IF NOT EXISTS idx_cie10_capitulo
  ON public.cat_cie10 USING btree (capitulo);
CREATE INDEX IF NOT EXISTS idx_cie10_trgm_codigo
  ON public.cat_cie10 USING gin (codigo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cie10_trgm_desc
  ON public.cat_cie10 USING gin (descripcion gin_trgm_ops);


-- Table: clinicas
CREATE INDEX IF NOT EXISTS idx_clinicas_stripe_customer
  ON public.clinicas USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_clinicas_stripe_subscription
  ON public.clinicas USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_clinicas_suspendida
  ON public.clinicas USING btree (suspendida) WHERE (suspendida = true);


-- Table: consultas
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultas_client_id
  ON public.consultas USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_consultas_paciente
  ON public.consultas USING btree (paciente_id);
CREATE INDEX IF NOT EXISTS idx_consultas_paciente_fecha
  ON public.consultas USING btree (paciente_id, fecha DESC);


-- Table: documentos
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_client_id
  ON public.documentos USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente
  ON public.documentos USING btree (paciente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_paciente_created
  ON public.documentos USING btree (paciente_id, created_at DESC);


-- Table: invitaciones
CREATE INDEX IF NOT EXISTS idx_invitaciones_clinica
  ON public.invitaciones USING btree (clinica_id);
CREATE INDEX IF NOT EXISTS idx_invitaciones_email
  ON public.invitaciones USING btree (email);
CREATE INDEX IF NOT EXISTS idx_invitaciones_token
  ON public.invitaciones USING btree (token);


-- Table: ip_rate_limits
CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_ip_ruta_fecha
  ON public.ip_rate_limits USING btree (ip, ruta, created_at);


-- Table: medicamentos
CREATE INDEX IF NOT EXISTS idx_medicamentos_nombre_comercial
  ON public.medicamentos USING btree (nombre_comercial);
CREATE INDEX IF NOT EXISTS idx_medicamentos_principio_activo
  ON public.medicamentos USING btree (principio_activo);


-- Table: mediciones_analitos
CREATE INDEX IF NOT EXISTS idx_mediciones_paciente_analito
  ON public.mediciones_analitos USING btree (paciente_id, analito_id) WHERE (analito_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_mediciones_paciente_medido_en
  ON public.mediciones_analitos USING btree (paciente_id, medido_en DESC);


-- Table: pacientes
CREATE INDEX IF NOT EXISTS idx_pacientes_activo
  ON public.pacientes USING btree (clinica_id, activo);
CREATE INDEX IF NOT EXISTS idx_pacientes_apellidos
  ON public.pacientes USING btree (apellidos);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_client_id
  ON public.pacientes USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pacientes_clinica
  ON public.pacientes USING btree (clinica_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_created_activo
  ON public.pacientes USING btree (created_at DESC) WHERE ((activo = true) OR (activo IS NULL));
CREATE INDEX IF NOT EXISTS idx_pacientes_fecha_baja
  ON public.pacientes USING btree (clinica_id, fecha_baja) WHERE (fecha_baja IS NULL);


-- Table: pdf_jobs
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_user_status
  ON public.pdf_jobs USING btree (user_id, status);


-- Table: plantillas_honorarios
CREATE UNIQUE INDEX IF NOT EXISTS idx_plantillas_honorarios_unique_name
  ON public.plantillas_honorarios USING btree (user_id, lower(TRIM(BOTH FROM nombre)));
CREATE INDEX IF NOT EXISTS idx_plantillas_honorarios_user
  ON public.plantillas_honorarios USING btree (user_id, created_at DESC);


-- Table: rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_ruta_fecha
  ON public.rate_limits USING btree (user_id, ruta, created_at);


-- Table: solicitudes_arco
CREATE INDEX IF NOT EXISTS idx_arco_clinica
  ON public.solicitudes_arco USING btree (clinica_id);
CREATE INDEX IF NOT EXISTS idx_arco_creado_en
  ON public.solicitudes_arco USING btree (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_arco_estado
  ON public.solicitudes_arco USING btree (estado);
