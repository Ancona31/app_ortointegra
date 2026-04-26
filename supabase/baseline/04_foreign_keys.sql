-- =============================================================================
-- 04_foreign_keys.sql
-- 28 foreign keys del schema public.
--
-- Aplicar después de 02_tables.sql. Asume DB limpia (sin estos constraints).
-- ON DELETE y ON UPDATE explícitos para evitar ambigüedad.
-- =============================================================================


-- Table: addendums
ALTER TABLE public.addendums
  ADD CONSTRAINT addendums_consulta_id_fkey
  FOREIGN KEY (consulta_id) REFERENCES public.consultas(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Table: appointments
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_medico_id_fkey
  FOREIGN KEY (medico_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;


-- Table: calculadora_resultados
ALTER TABLE public.calculadora_resultados
  ADD CONSTRAINT calculadora_resultados_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.calculadora_resultados
  ADD CONSTRAINT calculadora_resultados_medico_id_fkey
  FOREIGN KEY (medico_id) REFERENCES public.profiles(id)
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.calculadora_resultados
  ADD CONSTRAINT calculadora_resultados_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Table: consultas
ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Table: documentos
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_consulta_id_fkey
  FOREIGN KEY (consulta_id) REFERENCES public.consultas(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_subido_por_fkey
  FOREIGN KEY (subido_por) REFERENCES public.profiles(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Table: google_tokens
ALTER TABLE public.google_tokens
  ADD CONSTRAINT google_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;


-- Table: invitaciones
ALTER TABLE public.invitaciones
  ADD CONSTRAINT invitaciones_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;


-- Table: mediciones_analitos
ALTER TABLE public.mediciones_analitos
  ADD CONSTRAINT mediciones_analitos_analito_id_fkey
  FOREIGN KEY (analito_id) REFERENCES public.analitos_catalogo(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE public.mediciones_analitos
  ADD CONSTRAINT mediciones_analitos_creado_por_fkey
  FOREIGN KEY (creado_por) REFERENCES public.profiles(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE public.mediciones_analitos
  ADD CONSTRAINT mediciones_analitos_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Table: pacientes
ALTER TABLE public.pacientes
  ADD CONSTRAINT pacientes_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.pacientes
  ADD CONSTRAINT pacientes_medico_id_fkey
  FOREIGN KEY (medico_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;


-- Table: pdf_jobs
ALTER TABLE public.pdf_jobs
  ADD CONSTRAINT pdf_jobs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;


-- Table: plantillas_honorarios
ALTER TABLE public.plantillas_honorarios
  ADD CONSTRAINT plantillas_honorarios_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.plantillas_honorarios
  ADD CONSTRAINT plantillas_honorarios_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;


-- Table: profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;


-- Table: rate_limits
ALTER TABLE public.rate_limits
  ADD CONSTRAINT rate_limits_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;


-- Table: solicitudes_arco
ALTER TABLE public.solicitudes_arco
  ADD CONSTRAINT solicitudes_arco_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE public.solicitudes_arco
  ADD CONSTRAINT solicitudes_arco_creado_por_fkey
  FOREIGN KEY (creado_por) REFERENCES auth.users(id)
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.solicitudes_arco
  ADD CONSTRAINT solicitudes_arco_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;
